// Crawler : collecte et mise à jour des données actions par roulement
// Budget : 1000 appels FMP/jour — dividendes refresh mensuel, étalé sur 30 jours
const pool = require('./config/database');
const fmpService = require('./services/fmpService');

// === CONFIGURATION ===
// Budget : 1000 appels/jour
// Stratégie : les dividendes changent peu → refresh 1x/mois
// On étale sur 30 jours pour garder de la marge
let CRAWLER_CONFIG = {
  dailyBudget: 1000,
  reservedForUser: 700,       // 700 appels pour navigation + futures features
  dividendBudget: 300,        // 300 appels/jour max pour dividendes
  pauseBetweenRequests: 3000, // 3s entre chaque appel
  batchSize: 10,              // 10 actions par cycle
  cycleInterval: 600000,      // 10 min entre chaque cycle
  dividendRefreshDays: 30,    // Ne re-fetch que si > 30 jours
  enabled: true,
};

let crawlerRunning = false;
let crawlerInterval = null;
let dailyCallCount = 0;
let lastResetDate = new Date().toDateString();

// Compteur d'appels quotidiens
function trackCall() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyCallCount = 0;
    lastResetDate = today;
    console.log('[Crawler] 🔄 Reset compteur quotidien');
  }
  dailyCallCount++;
}

function canMakeCall() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyCallCount = 0;
    lastResetDate = today;
  }
  return dailyCallCount < (CRAWLER_CONFIG.dailyBudget - CRAWLER_CONFIG.reservedForUser);
}

// === ÉTAPE 1 : Collecter tous les symboles Euronext (1 appel API) ===
async function collectSymbols() {
  if (!canMakeCall()) {
    console.log('[Crawler] ⚠️ Budget quotidien atteint');
    return 0;
  }

  console.log('[Crawler] 🔍 Collecte des symboles Euronext (1 appel API)...');
  await updateCrawlerState('collect_symbols', 'running');

  try {
    trackCall();
    const stocks = await fmpService.getStockScreener('EURONEXT', 5000);
    if (!Array.isArray(stocks) || stocks.length === 0) {
      await updateCrawlerState('collect_symbols', 'error', null, 0, 0, 'Aucun résultat');
      return 0;
    }

    let inserted = 0;
    for (const stock of stocks) {
      if (!stock.symbol || !stock.companyName) continue;

      let country = 'FR';
      if (stock.symbol.endsWith('.AS')) country = 'NL';
      else if (stock.symbol.endsWith('.BR')) country = 'BE';
      else if (stock.symbol.endsWith('.LS')) country = 'PT';
      else if (stock.symbol.endsWith('.IR')) country = 'IE';

      await pool.query(`
        INSERT INTO stocks (symbol, name, exchange, country, sector, industry, market_cap, price, is_pea_eligible, last_quote_update)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
        ON CONFLICT (symbol) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, stocks.name),
          sector = COALESCE(EXCLUDED.sector, stocks.sector),
          industry = COALESCE(EXCLUDED.industry, stocks.industry),
          market_cap = COALESCE(EXCLUDED.market_cap, stocks.market_cap),
          price = COALESCE(EXCLUDED.price, stocks.price),
          last_quote_update = NOW(),
          updated_at = NOW()
      `, [
        stock.symbol,
        stock.companyName,
        stock.exchangeShortName || 'EURONEXT',
        country,
        stock.sector || null,
        stock.industry || null,
        stock.marketCap || null,
        stock.price || null,
      ]);
      inserted++;
    }

    await updateCrawlerState('collect_symbols', 'idle', null, inserted, inserted);
    console.log(`[Crawler] ✅ ${inserted} symboles Euronext en base`);
    return inserted;
  } catch (err) {
    await updateCrawlerState('collect_symbols', 'error', null, 0, 0, err.message);
    console.error('[Crawler] ❌ Erreur collecte:', err.message);
    return 0;
  }
}

// === ÉTAPE 2 : Mettre à jour les dividendes (seulement si > 30 jours) ===
async function updateDividendsBatch() {
  if (!canMakeCall()) {
    console.log(`[Crawler] ⚠️ Budget atteint (${dailyCallCount}/${CRAWLER_CONFIG.dailyBudget})`);
    return 0;
  }

  try {
    // Actions dont les dividendes n'ont jamais été récupérés OU > 30 jours
    const { rows } = await pool.query(`
      SELECT symbol FROM stocks 
      WHERE is_pea_eligible = TRUE AND price > 0
        AND (last_dividend_update IS NULL 
             OR last_dividend_update < NOW() - INTERVAL '${CRAWLER_CONFIG.dividendRefreshDays} days')
      ORDER BY last_dividend_update ASC NULLS FIRST
      LIMIT $1
    `, [CRAWLER_CONFIG.batchSize]);

    if (rows.length === 0) {
      console.log('[Crawler] ✅ Tous les dividendes sont à jour (< 30 jours)');
      return 0;
    }

    let updated = 0;
    for (const row of rows) {
      if (!canMakeCall()) break;

      try {
        trackCall();
        const divData = await fmpService.getDividends(row.symbol);
        let dividends = [];
        if (Array.isArray(divData)) dividends = divData;
        else if (divData?.historical) dividends = divData.historical;

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

        await pool.query(
          'UPDATE stocks SET last_dividend_update = NOW(), updated_at = NOW() WHERE symbol = $1',
          [row.symbol]
        );
        updated++;
        await new Promise(r => setTimeout(r, CRAWLER_CONFIG.pauseBetweenRequests));
      } catch (err) {
        console.error(`[Crawler] Erreur div ${row.symbol}:`, err.message);
        // Marquer comme traité pour ne pas reboucler dessus
        await pool.query(
          'UPDATE stocks SET last_dividend_update = NOW() WHERE symbol = $1',
          [row.symbol]
        );
      }
    }

    const { rows: remaining } = await pool.query(`
      SELECT COUNT(*) as c FROM stocks 
      WHERE is_pea_eligible = TRUE AND price > 0
        AND (last_dividend_update IS NULL 
             OR last_dividend_update < NOW() - INTERVAL '${CRAWLER_CONFIG.dividendRefreshDays} days')
    `);

    await updateCrawlerState('update_dividends', 'idle', rows[rows.length - 1]?.symbol, updated, rows.length);
    console.log(`[Crawler] 📊 Dividendes : ${updated} mis à jour | ${remaining[0].c} restants | appels aujourd'hui : ${dailyCallCount}`);
    return updated;
  } catch (err) {
    console.error('[Crawler] Erreur batch dividendes:', err.message);
    return 0;
  }
}

// === ÉTAPE 3 : Recalculer les scores (0 appel API) ===
async function calculateScores() {
  try {
    const currentYear = new Date().getFullYear();

    const { rows: stocks } = await pool.query(`
      SELECT s.symbol, s.name, s.sector, s.price, s.market_cap
      FROM stocks s
      WHERE s.is_pea_eligible = TRUE AND s.price > 0
    `);

    let calculated = 0;

    for (const stock of stocks) {
      const { rows: divRows } = await pool.query(`
        SELECT EXTRACT(YEAR FROM ex_date)::INTEGER as year, SUM(amount) as total
        FROM dividends
        WHERE symbol = $1 AND ex_date >= $2
        GROUP BY year
        ORDER BY year DESC
      `, [stock.symbol, `${currentYear - 6}-01-01`]);

      if (divRows.length === 0) continue;

      const latestAnnualDiv = parseFloat(divRows[0]?.total) || 0;
      const currentYield = (latestAnnualDiv / parseFloat(stock.price)) * 100;

      if (currentYield < 5) continue;

      const avgDiv = divRows.reduce((s, r) => s + parseFloat(r.total), 0) / divRows.length;
      const avgYield = (avgDiv / parseFloat(stock.price)) * 100;
      const yearsWithDiv = Math.min(divRows.length, 5);
      const regularity = Math.round((yearsWithDiv / 5) * 100);

      let growth = 0;
      if (divRows.length >= 2) {
        const newest = parseFloat(divRows[0].total);
        const oldest = parseFloat(divRows[divRows.length - 1].total);
        if (oldest > 0) growth = ((newest - oldest) / oldest) * 100;
      }

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
        yield: Math.round((parseFloat(r.total) / parseFloat(stock.price)) * 10000) / 100,
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
    console.log(`[Crawler] ✅ Scores : ${calculated} actions avec rendement ≥ 5%`);
    return calculated;
  } catch (err) {
    console.error('[Crawler] Erreur calcul scores:', err.message);
    return 0;
  }
}

// === BOUCLE PRINCIPALE ===
async function runCrawlerCycle() {
  if (!CRAWLER_CONFIG.enabled || crawlerRunning) return;
  crawlerRunning = true;

  try {
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM stocks WHERE is_pea_eligible = TRUE');
    const stockCount = parseInt(rows[0].count);

    if (stockCount === 0) {
      await collectSymbols();
    } else {
      const updated = await updateDividendsBatch();
      if (updated > 0) {
        await calculateScores();
      }
    }
  } catch (err) {
    console.error('[Crawler] Erreur cycle:', err.message);
  }

  crawlerRunning = false;
}

// Utilitaires
async function updateCrawlerState(taskName, status, lastSymbol = null, processed = null, total = null, errorMsg = null) {
  try {
    const sets = ['status = $2', 'last_run_at = NOW()', 'updated_at = NOW()'];
    const params = [taskName, status];
    let idx = 3;
    if (lastSymbol !== null) { sets.push(`last_symbol_processed = $${idx}`); params.push(lastSymbol); idx++; }
    if (processed !== null) { sets.push(`symbols_processed = $${idx}`); params.push(processed); idx++; }
    if (total !== null) { sets.push(`symbols_total = $${idx}`); params.push(total); idx++; }
    if (errorMsg !== null) { sets.push(`error_message = $${idx}`); params.push(errorMsg); idx++; }
    await pool.query(`UPDATE crawler_state SET ${sets.join(', ')} WHERE task_name = $1`, params);
  } catch (e) {
    // Silencieux si la table n'existe pas encore
  }
}

// === API PUBLIQUE ===
function startCrawler(config = {}) {
  Object.assign(CRAWLER_CONFIG, config);
  console.log(`[Crawler] 🕷️ Démarrage — budget ${CRAWLER_CONFIG.dailyBudget}/jour, ${CRAWLER_CONFIG.dividendBudget} pour dividendes, refresh tous les ${CRAWLER_CONFIG.dividendRefreshDays}j`);

  setTimeout(runCrawlerCycle, 5000);
  crawlerInterval = setInterval(runCrawlerCycle, CRAWLER_CONFIG.cycleInterval);
}

function stopCrawler() {
  CRAWLER_CONFIG.enabled = false;
  if (crawlerInterval) clearInterval(crawlerInterval);
  console.log('[Crawler] 🛑 Arrêté');
}

function getCrawlerConfig() {
  return { ...CRAWLER_CONFIG, dailyCallCount, canMakeMoreCalls: canMakeCall() };
}

function setCrawlerConfig(config) {
  Object.assign(CRAWLER_CONFIG, config);
}

module.exports = {
  startCrawler, stopCrawler, getCrawlerConfig, setCrawlerConfig,
  collectSymbols, updateDividendsBatch, calculateScores,
};
