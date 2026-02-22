// Crawler : collecte et mise à jour des données actions par roulement
// Respecte le rate limit FMP en espaçant les requêtes
const pool = require('./config/database');
const fmpService = require('./services/fmpService');

// Configuration — sera ajustée selon les limites FMP exactes
let CRAWLER_CONFIG = {
  requestsPerMinute: 4,       // Limite par défaut (plan gratuit), à ajuster
  batchSize: 1,               // 1 action à la fois pour être safe
  pauseBetweenRequests: 16000, // ~16s entre chaque requête (4/min)
  enabled: true,
};

// Exchanges éligibles PEA
const PEA_EXCHANGES = ['EURONEXT', 'PAR', 'AMS', 'BRU', 'LIS'];

// Le crawler peut être stoppé proprement
let crawlerRunning = false;
let crawlerInterval = null;

// === ÉTAPE 1 : Collecter les symboles Euronext depuis FMP ===
async function collectSymbols() {
  console.log('[Crawler] 🔍 Collecte des symboles Euronext...');
  await updateCrawlerState('collect_symbols', 'running');

  try {
    // Utiliser le stock screener FMP pour récupérer les actions Euronext
    // On fait plusieurs appels avec différents filtres pour couvrir large
    const exchanges = ['EURONEXT'];
    let totalInserted = 0;

    for (const exchange of exchanges) {
      try {
        const stocks = await fmpService.getStockScreener(exchange, 1000);
        if (!Array.isArray(stocks)) continue;

        for (const stock of stocks) {
          if (!stock.symbol || !stock.companyName) continue;

          // Déterminer le pays depuis le suffixe
          let country = 'FR';
          if (stock.symbol.endsWith('.AS')) country = 'NL';
          else if (stock.symbol.endsWith('.BR')) country = 'BE';
          else if (stock.symbol.endsWith('.LS')) country = 'PT';

          await pool.query(`
            INSERT INTO stocks (symbol, name, exchange, country, sector, industry, market_cap, price, is_pea_eligible)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
            ON CONFLICT (symbol) DO UPDATE SET
              name = COALESCE(EXCLUDED.name, stocks.name),
              sector = COALESCE(EXCLUDED.sector, stocks.sector),
              industry = COALESCE(EXCLUDED.industry, stocks.industry),
              market_cap = COALESCE(EXCLUDED.market_cap, stocks.market_cap),
              price = COALESCE(EXCLUDED.price, stocks.price),
              updated_at = NOW()
          `, [
            stock.symbol,
            stock.companyName,
            stock.exchangeShortName || exchange,
            country,
            stock.sector || null,
            stock.industry || null,
            stock.marketCap || null,
            stock.price || null,
          ]);
          totalInserted++;
        }
        console.log(`[Crawler] ${exchange}: ${stocks.length} actions récupérées`);
      } catch (err) {
        console.error(`[Crawler] Erreur pour ${exchange}:`, err.message);
      }
    }

    await updateCrawlerState('collect_symbols', 'idle', null, totalInserted, totalInserted);
    console.log(`[Crawler] ✅ ${totalInserted} symboles en base`);
    return totalInserted;
  } catch (err) {
    await updateCrawlerState('collect_symbols', 'error', null, 0, 0, err.message);
    console.error('[Crawler] ❌ Erreur collecte symboles:', err.message);
    return 0;
  }
}

// === ÉTAPE 2 : Mettre à jour les quotes (prix, marketCap) par roulement ===
async function updateQuotesBatch() {
  try {
    // Prendre les actions les plus anciennes (ou jamais mises à jour)
    const { rows } = await pool.query(`
      SELECT symbol FROM stocks 
      WHERE is_pea_eligible = TRUE
      ORDER BY last_quote_update ASC NULLS FIRST
      LIMIT $1
    `, [CRAWLER_CONFIG.batchSize]);

    if (rows.length === 0) return 0;

    for (const row of rows) {
      try {
        const quoteData = await fmpService.getQuote(row.symbol);
        const quote = Array.isArray(quoteData) ? quoteData[0] : null;
        
        if (quote && quote.price) {
          await pool.query(`
            UPDATE stocks SET 
              price = $1, market_cap = $2, name = COALESCE($3, name),
              last_quote_update = NOW(), updated_at = NOW()
            WHERE symbol = $4
          `, [quote.price, quote.marketCap || null, quote.name || null, row.symbol]);
        }

        await pause();
      } catch (err) {
        console.error(`[Crawler] Erreur quote ${row.symbol}:`, err.message);
      }
    }

    return rows.length;
  } catch (err) {
    console.error('[Crawler] Erreur batch quotes:', err.message);
    return 0;
  }
}

// === ÉTAPE 3 : Mettre à jour les dividendes par roulement ===
async function updateDividendsBatch() {
  try {
    // Prendre les actions dont les dividendes sont les plus anciens
    const { rows } = await pool.query(`
      SELECT symbol FROM stocks 
      WHERE is_pea_eligible = TRUE
      ORDER BY last_dividend_update ASC NULLS FIRST
      LIMIT $1
    `, [CRAWLER_CONFIG.batchSize]);

    if (rows.length === 0) return 0;

    for (const row of rows) {
      try {
        const divData = await fmpService.getDividends(row.symbol);
        let dividends = [];
        if (Array.isArray(divData)) dividends = divData;
        else if (divData?.historical) dividends = divData.historical;

        // Insérer les dividendes
        for (const div of dividends) {
          const exDate = div.date || div.exDate || null;
          const amount = div.dividend || div.adjDividend || 0;
          if (!exDate || amount <= 0) continue;

          await pool.query(`
            INSERT INTO dividends (symbol, ex_date, payment_date, record_date, declaration_date, amount)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (symbol, ex_date, amount) DO NOTHING
          `, [
            row.symbol,
            exDate,
            div.paymentDate || null,
            div.recordDate || null,
            div.declarationDate || null,
            amount,
          ]);
        }

        await pool.query(`
          UPDATE stocks SET last_dividend_update = NOW(), updated_at = NOW()
          WHERE symbol = $1
        `, [row.symbol]);

        await pause();
      } catch (err) {
        console.error(`[Crawler] Erreur dividendes ${row.symbol}:`, err.message);
      }
    }

    return rows.length;
  } catch (err) {
    console.error('[Crawler] Erreur batch dividendes:', err.message);
    return 0;
  }
}

// === ÉTAPE 4 : Recalculer les scores de dividendes ===
async function calculateScores() {
  try {
    const currentYear = new Date().getFullYear();

    // Récupérer toutes les actions PEA avec leur prix
    const { rows: stocks } = await pool.query(`
      SELECT s.symbol, s.name, s.sector, s.price, s.market_cap
      FROM stocks s
      WHERE s.is_pea_eligible = TRUE AND s.price > 0
    `);

    let calculated = 0;

    for (const stock of stocks) {
      // Récupérer les dividendes annuels (somme par année)
      const { rows: divRows } = await pool.query(`
        SELECT EXTRACT(YEAR FROM ex_date)::INTEGER as year, SUM(amount) as total
        FROM dividends
        WHERE symbol = $1 AND ex_date >= $2
        GROUP BY year
        ORDER BY year DESC
      `, [stock.symbol, `${currentYear - 6}-01-01`]);

      if (divRows.length === 0) continue;

      const latestAnnualDiv = divRows[0]?.total || 0;
      const currentYield = (latestAnnualDiv / stock.price) * 100;

      // Seuil : on ne calcule que pour les rendements >= 5% (marge pour les fluctuations)
      if (currentYield < 5) continue;

      const avgDiv = divRows.reduce((s, r) => s + parseFloat(r.total), 0) / divRows.length;
      const avgYield = (avgDiv / stock.price) * 100;
      const yearsWithDiv = Math.min(divRows.length, 5);
      const regularity = Math.round((yearsWithDiv / 5) * 100);

      // Croissance
      let growth = 0;
      if (divRows.length >= 2) {
        const newest = parseFloat(divRows[0].total);
        const oldest = parseFloat(divRows[divRows.length - 1].total);
        if (oldest > 0) growth = ((newest - oldest) / oldest) * 100;
      }

      // Score composite
      const yieldScore = Math.min(currentYield / 15 * 40, 40);
      const regularityScore = (regularity / 100) * 30;
      const growthScore = Math.min(Math.max(growth + 20, 0) / 40 * 20, 20);
      const avgScore = Math.min(avgYield / 12 * 10, 10);
      const score = Math.round(yieldScore + regularityScore + growthScore + avgScore);

      let trend = 'stable';
      if (growth > 10) trend = 'croissant';
      else if (growth < -10) trend = 'décroissant';

      const history = divRows.slice(0, 5).map(r => ({
        year: r.year,
        dividend: Math.round(parseFloat(r.total) * 1000) / 1000,
        yield: Math.round((parseFloat(r.total) / stock.price) * 10000) / 100,
      }));

      await pool.query(`
        INSERT INTO dividend_analysis 
          (symbol, current_yield, avg_yield_5y, latest_annual_div, years_of_dividends,
           dividend_growth, trend, regularity, composite_score, dividend_history, calculated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (symbol) DO UPDATE SET
          current_yield = $2, avg_yield_5y = $3, latest_annual_div = $4,
          years_of_dividends = $5, dividend_growth = $6, trend = $7,
          regularity = $8, composite_score = $9, dividend_history = $10,
          calculated_at = NOW()
      `, [
        stock.symbol,
        Math.round(currentYield * 100) / 100,
        Math.round(avgYield * 100) / 100,
        Math.round(latestAnnualDiv * 1000) / 1000,
        yearsWithDiv,
        Math.round(growth * 10) / 10,
        trend,
        regularity,
        score,
        JSON.stringify(history),
      ]);

      calculated++;
    }

    await updateCrawlerState('calculate_scores', 'idle', null, calculated, stocks.length);
    console.log(`[Crawler] ✅ Scores calculés pour ${calculated}/${stocks.length} actions`);
    return calculated;
  } catch (err) {
    console.error('[Crawler] Erreur calcul scores:', err.message);
    return 0;
  }
}

// === Boucle principale du crawler ===
async function runCrawlerCycle() {
  if (!CRAWLER_CONFIG.enabled || crawlerRunning) return;
  crawlerRunning = true;

  try {
    // Vérifier si on a des symboles en base
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM stocks WHERE is_pea_eligible = TRUE');
    const stockCount = parseInt(rows[0].count);

    if (stockCount === 0) {
      // Première exécution : collecter les symboles
      console.log('[Crawler] 🚀 Première exécution — collecte des symboles...');
      await collectSymbols();
    } else {
      // Roulement : alterner quotes et dividendes
      const { rows: stateRows } = await pool.query(
        "SELECT * FROM crawler_state WHERE task_name IN ('update_quotes', 'update_dividends') ORDER BY last_run_at ASC NULLS FIRST LIMIT 1"
      );
      
      const nextTask = stateRows[0]?.task_name || 'update_quotes';
      
      if (nextTask === 'update_quotes') {
        const updated = await updateQuotesBatch();
        if (updated > 0) {
          await updateCrawlerState('update_quotes', 'idle');
        }
      } else {
        const updated = await updateDividendsBatch();
        if (updated > 0) {
          await updateCrawlerState('update_dividends', 'idle');
          // Recalculer les scores après mise à jour des dividendes
          await calculateScores();
        }
      }
    }
  } catch (err) {
    console.error('[Crawler] Erreur cycle:', err.message);
  }

  crawlerRunning = false;
}

// Utilitaires
async function pause() {
  return new Promise(resolve => setTimeout(resolve, CRAWLER_CONFIG.pauseBetweenRequests));
}

async function updateCrawlerState(taskName, status, lastSymbol = null, processed = null, total = null, error = null) {
  const sets = ['status = $2', 'last_run_at = NOW()', 'updated_at = NOW()'];
  const params = [taskName, status];
  let idx = 3;

  if (lastSymbol !== null) { sets.push(`last_symbol_processed = $${idx}`); params.push(lastSymbol); idx++; }
  if (processed !== null) { sets.push(`symbols_processed = $${idx}`); params.push(processed); idx++; }
  if (total !== null) { sets.push(`symbols_total = $${idx}`); params.push(total); idx++; }
  if (error !== null) { sets.push(`error_message = $${idx}`); params.push(error); idx++; }

  await pool.query(`UPDATE crawler_state SET ${sets.join(', ')} WHERE task_name = $1`, params);
}

// Démarrer le crawler
function startCrawler(config = {}) {
  Object.assign(CRAWLER_CONFIG, config);
  
  console.log(`[Crawler] 🕷️ Démarrage — ${CRAWLER_CONFIG.requestsPerMinute} req/min, pause ${CRAWLER_CONFIG.pauseBetweenRequests/1000}s`);
  
  // Premier cycle après 10s (laisser le serveur démarrer)
  setTimeout(runCrawlerCycle, 10000);
  
  // Puis toutes les 20s
  crawlerInterval = setInterval(runCrawlerCycle, 20000);
}

function stopCrawler() {
  CRAWLER_CONFIG.enabled = false;
  if (crawlerInterval) clearInterval(crawlerInterval);
  console.log('[Crawler] 🛑 Arrêté');
}

function getCrawlerConfig() {
  return CRAWLER_CONFIG;
}

function setCrawlerConfig(config) {
  Object.assign(CRAWLER_CONFIG, config);
  console.log('[Crawler] ⚙️ Config mise à jour:', CRAWLER_CONFIG);
}

module.exports = {
  startCrawler, stopCrawler, getCrawlerConfig, setCrawlerConfig,
  collectSymbols, updateQuotesBatch, updateDividendsBatch, calculateScores,
};
