// Crawler : collecte et mise à jour des données actions par roulement
// Budget RÉEL : 250 appels FMP/jour (plan gratuit)
// - 200 réservés pour la navigation utilisateur
// - 50 pour le crawler, répartis entre 4 tâches par rotation
//
// Ordre de priorité des tâches :
//   1. collect_symbols  (1x/semaine, ~5 appels)
//   2. update_quotes    (priorité haute, prix des actions populaires)
//   3. update_profiles  (1x/mois, données statiques)
//   4. update_ratios    (1x/7 jours, trimestriel)
//   5. update_dividends (1x/30 jours, mensuel)
//   6. calculate_scores (0 appel API, calcul pur DB)

const pool = require('./config/database');
const fmpService = require('./services/fmpService');
const dbService = require('./services/dbService');

// === CONFIGURATION ===
let CRAWLER_CONFIG = {
  dailyBudget: 250,
  reservedForUser: 200,
  crawlerBudget: 50,
  pauseBetweenRequests: 5000, // 5s entre chaque appel API
  batchSize: 3,               // 3 actions par cycle (prudent avec 50/jour)
  cycleInterval: 1800000,     // Toutes les 30 min
  dividendRefreshDays: 30,
  profileRefreshDays: 30,
  ratiosRefreshDays: 7,
  quotesRefreshHours: 1,
  enabled: true,
};

const EXCHANGES_TO_COLLECT = [
  { exchange: 'EURONEXT', limit: 5000, peaEligible: true },
  { exchange: 'NASDAQ',   limit: 200,  peaEligible: false },
  { exchange: 'NYSE',     limit: 200,  peaEligible: false },
  { exchange: 'TSE',      limit: 100,  peaEligible: false },
  { exchange: 'HKSE',     limit: 100,  peaEligible: false },
];

let crawlerRunning = false;
let crawlerInterval = null;
let dailyCallCount = 0;
let lastResetDate = new Date().toDateString();

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
  if (today !== lastResetDate) { dailyCallCount = 0; lastResetDate = today; }
  return dailyCallCount < CRAWLER_CONFIG.crawlerBudget;
}

function pause() {
  return new Promise(r => setTimeout(r, CRAWLER_CONFIG.pauseBetweenRequests));
}

// ============================================
// === TÂCHE 1 : Collecte des symboles ===
// ============================================
async function collectSymbols() {
  console.log('[Crawler] 🔍 Collecte des symboles...');
  await updateCrawlerState('collect_symbols', 'running');
  let total = 0;

  for (const cfg of EXCHANGES_TO_COLLECT) {
    if (!canMakeCall()) break;
    try {
      trackCall();
      const stocks = await fmpService.getStockScreener(cfg.exchange, cfg.limit);
      if (!Array.isArray(stocks) || stocks.length === 0) continue;

      for (const stock of stocks) {
        if (!stock.symbol || !stock.companyName) continue;
        if (!stock.price || stock.price <= 0) continue;
        if (!stock.marketCap || stock.marketCap <= 0) continue;

        await pool.query(`
          INSERT INTO stocks (symbol, name, exchange, country, sector, industry, market_cap, price, currency, is_pea_eligible, last_quote_update)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
          ON CONFLICT (symbol) DO UPDATE SET
            name        = COALESCE(EXCLUDED.name, stocks.name),
            sector      = COALESCE(EXCLUDED.sector, stocks.sector),
            industry    = COALESCE(EXCLUDED.industry, stocks.industry),
            market_cap  = COALESCE(EXCLUDED.market_cap, stocks.market_cap),
            price       = COALESCE(EXCLUDED.price, stocks.price),
            currency    = COALESCE(EXCLUDED.currency, stocks.currency),
            last_quote_update = NOW(),
            updated_at  = NOW()
        `, [
          stock.symbol, stock.companyName,
          stock.exchangeShortName || cfg.exchange,
          getCountry(stock.symbol, cfg.exchange),
          stock.sector || null, stock.industry || null,
          stock.marketCap || null, stock.price || null,
          getCurrency(stock.symbol, cfg.exchange),
          cfg.peaEligible,
        ]);

        // Sauvegarder le quote issu du screener en DB directement (prix frais, 0 appel supplémentaire)
        await dbService.sauvegarderQuote(stock.symbol, {
          name: stock.companyName,
          price: stock.price,
          marketCap: stock.marketCap,
          change: stock.change || null,
          changesPercentage: stock.changesPercentage || null,
          volume: stock.volume || null,
        });

        total++;
      }
      console.log(`[Crawler] ✅ ${cfg.exchange}: ${stocks.length} actions`);
      await pause();
    } catch (err) {
      console.error(`[Crawler] ❌ ${cfg.exchange}:`, err.message);
    }
  }

  await updateCrawlerState('collect_symbols', 'idle', null, total, total);
  console.log(`[Crawler] ✅ Symboles : ${total} en base`);
  return total;
}

// ============================================
// === TÂCHE 2 : Mise à jour des quotes ===
// Priorité aux actions sans quote récent
// ============================================
async function updateQuotesBatch() {
  if (!canMakeCall()) return 0;

  // Prioriser : actions sans quote du tout, puis les plus anciennes
  // On cible surtout les actions populaires (forte capitalisation)
  const { rows } = await pool.query(`
    SELECT s.symbol FROM stocks s
    LEFT JOIN stock_quotes q ON q.symbol = s.symbol
    WHERE s.price > 0
      AND (q.symbol IS NULL OR q.updated_at < NOW() - INTERVAL '${CRAWLER_CONFIG.quotesRefreshHours} hours')
    ORDER BY s.market_cap DESC NULLS LAST, q.updated_at ASC NULLS FIRST
    LIMIT $1
  `, [CRAWLER_CONFIG.batchSize]);

  if (rows.length === 0) {
    console.log('[Crawler] ✅ Tous les quotes sont à jour');
    return 0;
  }

  let updated = 0;
  for (const row of rows) {
    if (!canMakeCall()) break;
    try {
      trackCall();
      const data = await fmpService.getQuote(row.symbol);
      const quote = Array.isArray(data) ? data[0] : data;
      if (quote) {
        await dbService.sauvegarderQuote(row.symbol, quote);
        updated++;
      }
      await pause();
    } catch (err) {
      console.error(`[Crawler] ❌ Quote ${row.symbol}:`, err.message);
    }
  }

  await updateCrawlerState('update_quotes', 'idle', rows[rows.length - 1]?.symbol, updated, rows.length);
  console.log(`[Crawler] 📈 Quotes : ${updated} mis à jour | appels : ${dailyCallCount}/${CRAWLER_CONFIG.crawlerBudget}`);
  return updated;
}

// ============================================
// === TÂCHE 3 : Mise à jour des profils ===
// 1x/30 jours — données quasi-statiques
// ============================================
async function updateProfilesBatch() {
  if (!canMakeCall()) return 0;

  const { rows } = await pool.query(`
    SELECT s.symbol FROM stocks s
    LEFT JOIN stock_profiles p ON p.symbol = s.symbol
    WHERE s.price > 0
      AND (p.symbol IS NULL OR p.updated_at < NOW() - INTERVAL '${CRAWLER_CONFIG.profileRefreshDays} days')
    ORDER BY s.market_cap DESC NULLS LAST, p.updated_at ASC NULLS FIRST
    LIMIT $1
  `, [CRAWLER_CONFIG.batchSize]);

  if (rows.length === 0) {
    console.log('[Crawler] ✅ Tous les profils sont à jour');
    return 0;
  }

  let updated = 0;
  for (const row of rows) {
    if (!canMakeCall()) break;
    try {
      trackCall();
      const data = await fmpService.getCompanyProfile(row.symbol);
      const profile = Array.isArray(data) ? data[0] : data;
      if (profile) {
        await dbService.sauvegarderProfile(row.symbol, profile);
        updated++;
      }
      await pause();
    } catch (err) {
      console.error(`[Crawler] ❌ Profil ${row.symbol}:`, err.message);
    }
  }

  await updateCrawlerState('update_profiles', 'idle', rows[rows.length - 1]?.symbol, updated, rows.length);
  console.log(`[Crawler] 🏢 Profils : ${updated} mis à jour | appels : ${dailyCallCount}/${CRAWLER_CONFIG.crawlerBudget}`);
  return updated;
}

// ============================================
// === TÂCHE 4 : Mise à jour des ratios TTM ===
// 1x/7 jours — changent trimestriellement
// ============================================
async function updateRatiosBatch() {
  if (!canMakeCall()) return 0;

  const { rows } = await pool.query(`
    SELECT s.symbol FROM stocks s
    LEFT JOIN stock_ratios r ON r.symbol = s.symbol
    WHERE s.price > 0
      AND (r.symbol IS NULL OR r.updated_at < NOW() - INTERVAL '${CRAWLER_CONFIG.ratiosRefreshDays} days')
    ORDER BY s.market_cap DESC NULLS LAST, r.updated_at ASC NULLS FIRST
    LIMIT $1
  `, [CRAWLER_CONFIG.batchSize]);

  if (rows.length === 0) {
    console.log('[Crawler] ✅ Tous les ratios sont à jour');
    return 0;
  }

  let updated = 0;
  for (const row of rows) {
    if (!canMakeCall()) break;
    try {
      trackCall();
      const data = await fmpService.getRatiosTTM(row.symbol);
      const ratios = Array.isArray(data) ? data[0] : data;
      if (ratios) {
        await dbService.sauvegarderRatios(row.symbol, ratios);
        updated++;
      }
      await pause();
    } catch (err) {
      console.error(`[Crawler] ❌ Ratios ${row.symbol}:`, err.message);
    }
  }

  await updateCrawlerState('update_ratios', 'idle', rows[rows.length - 1]?.symbol, updated, rows.length);
  console.log(`[Crawler] 📊 Ratios : ${updated} mis à jour | appels : ${dailyCallCount}/${CRAWLER_CONFIG.crawlerBudget}`);
  return updated;
}

// ============================================
// === TÂCHE 5 : Mise à jour des dividendes ===
// 1x/30 jours
// ============================================
async function updateDividendsBatch() {
  if (!canMakeCall()) return 0;

  const { rows } = await pool.query(`
    SELECT symbol FROM stocks
    WHERE price > 0
      AND (last_dividend_update IS NULL
           OR last_dividend_update < NOW() - INTERVAL '${CRAWLER_CONFIG.dividendRefreshDays} days')
    ORDER BY last_dividend_update ASC NULLS FIRST
    LIMIT $1
  `, [CRAWLER_CONFIG.batchSize]);

  if (rows.length === 0) {
    console.log('[Crawler] ✅ Tous les dividendes sont à jour');
    return 0;
  }

  let updated = 0;
  for (const row of rows) {
    if (!canMakeCall()) break;
    try {
      trackCall();
      const divData = await fmpService.getDividends(row.symbol);
      let dividends = Array.isArray(divData) ? divData : (divData?.historical || []);

      for (const div of dividends) {
        const exDate = div.date || div.exDate || null;
        const amount = div.dividend || div.adjDividend || 0;
        if (!exDate || amount <= 0) continue;
        await pool.query(`
          INSERT INTO dividends (symbol, ex_date, payment_date, record_date, declaration_date, amount)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (symbol, ex_date, amount) DO NOTHING
        `, [row.symbol, exDate, div.paymentDate || null, div.recordDate || null, div.declarationDate || null, amount]);
      }

      await pool.query(
        'UPDATE stocks SET last_dividend_update = NOW(), updated_at = NOW() WHERE symbol = $1',
        [row.symbol]
      );
      updated++;
      await pause();
    } catch (err) {
      console.error(`[Crawler] ❌ Dividendes ${row.symbol}:`, err.message);
      await pool.query('UPDATE stocks SET last_dividend_update = NOW() WHERE symbol = $1', [row.symbol]);
    }
  }

  await updateCrawlerState('update_dividends', 'idle', rows[rows.length - 1]?.symbol, updated, rows.length);
  console.log(`[Crawler] 💰 Dividendes : ${updated} mis à jour | appels : ${dailyCallCount}/${CRAWLER_CONFIG.crawlerBudget}`);
  return updated;
}

// ============================================
// === TÂCHE 6 : Calcul des scores (0 appel) ===
// ============================================
async function calculateScores() {
  try {
    const currentYear = new Date().getFullYear();
    const { rows: stocks } = await pool.query(
      'SELECT symbol, name, sector, price, market_cap FROM stocks WHERE price > 0'
    );
    let calculated = 0;

    for (const stock of stocks) {
      const { rows: divRows } = await pool.query(`
        SELECT EXTRACT(YEAR FROM ex_date)::INTEGER as year, SUM(amount) as total
        FROM dividends WHERE symbol = $1 AND ex_date >= $2
        GROUP BY year ORDER BY year DESC
      `, [stock.symbol, `${currentYear - 6}-01-01`]);

      if (divRows.length === 0) continue;

      const latestAnnualDiv = parseFloat(divRows[0]?.total) || 0;
      const currentYield = (latestAnnualDiv / parseFloat(stock.price)) * 100;
      if (currentYield < 3) continue;

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

      const score = Math.round(
        Math.min(currentYield / 15 * 40, 40) +
        (regularity / 100) * 30 +
        Math.min(Math.max(growth + 20, 0) / 40 * 20, 20) +
        Math.min(avgYield / 12 * 10, 10)
      );

      const trend = growth > 10 ? 'croissant' : growth < -10 ? 'décroissant' : 'stable';
      const history = divRows.slice(0, 5).map(r => ({
        year: r.year,
        dividend: Math.round(parseFloat(r.total) * 1000) / 1000,
        yield: Math.round((parseFloat(r.total) / parseFloat(stock.price)) * 10000) / 100,
      }));

      await pool.query(`
        INSERT INTO dividend_analysis
          (symbol, current_yield, avg_yield_5y, latest_annual_div, years_of_dividends,
           dividend_growth, trend, regularity, composite_score, dividend_history, calculated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (symbol) DO UPDATE SET
          current_yield=$2, avg_yield_5y=$3, latest_annual_div=$4,
          years_of_dividends=$5, dividend_growth=$6, trend=$7,
          regularity=$8, composite_score=$9, dividend_history=$10, calculated_at=NOW()
      `, [
        stock.symbol,
        Math.round(currentYield * 100) / 100,
        Math.round(avgYield * 100) / 100,
        Math.round(latestAnnualDiv * 1000) / 1000,
        yearsWithDiv,
        Math.round(growth * 10) / 10,
        trend, regularity, score,
        JSON.stringify(history),
      ]);
      calculated++;
    }

    await updateCrawlerState('calculate_scores', 'idle', null, calculated, stocks.length);
    console.log(`[Crawler] ✅ Scores : ${calculated} actions calculées`);
    return calculated;
  } catch (err) {
    console.error('[Crawler] Erreur calcul scores:', err.message);
    return 0;
  }
}

// ============================================
// === BOUCLE PRINCIPALE — Rotation des tâches ===
// Chaque cycle on effectue UNE seule tâche pour
// étaler les appels API sur la journée
// ============================================
let tacheActuelle = 0;
const ROTATION_TACHES = [
  'update_quotes',
  'update_profiles',
  'update_ratios',
  'update_dividends',
  'calculate_scores',
];

async function runCrawlerCycle() {
  if (!CRAWLER_CONFIG.enabled || crawlerRunning) return;
  crawlerRunning = true;

  try {
    // Vérifier si on a des actions en base
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM stocks');
    const stockCount = parseInt(rows[0].count);

    // Collecte initiale si DB vide
    if (stockCount === 0) {
      await collectSymbols();
      crawlerRunning = false;
      return;
    }

    // Recollecte hebdomadaire des symboles
    const { rows: stateRows } = await pool.query(
      "SELECT last_run_at FROM crawler_state WHERE task_name = 'collect_symbols'"
    );
    const lastCollect = stateRows[0]?.last_run_at;
    if (!lastCollect || (Date.now() - new Date(lastCollect).getTime()) > 7 * 24 * 3600 * 1000) {
      await collectSymbols();
      crawlerRunning = false;
      return;
    }

    // Rotation des autres tâches (1 par cycle)
    const tache = ROTATION_TACHES[tacheActuelle % ROTATION_TACHES.length];
    tacheActuelle++;

    console.log(`[Crawler] 🔄 Cycle ${tacheActuelle} — tâche : ${tache} | appels aujourd'hui : ${dailyCallCount}/${CRAWLER_CONFIG.crawlerBudget}`);

    switch (tache) {
      case 'update_quotes':
        await updateQuotesBatch();
        break;
      case 'update_profiles':
        await updateProfilesBatch();
        break;
      case 'update_ratios':
        await updateRatiosBatch();
        break;
      case 'update_dividends': {
        const updated = await updateDividendsBatch();
        if (updated > 0) await calculateScores();
        break;
      }
      case 'calculate_scores':
        await calculateScores();
        break;
    }

  } catch (err) {
    console.error('[Crawler] Erreur cycle:', err.message);
  }

  crawlerRunning = false;
}

// ============================================
// === UTILITAIRES ===
// ============================================
async function updateCrawlerState(taskName, status, lastSymbol = null, processed = null, total = null, errorMsg = null) {
  try {
    const sets = ['status = $2', 'last_run_at = NOW()', 'updated_at = NOW()'];
    const params = [taskName, status];
    let idx = 3;
    if (lastSymbol !== null) { sets.push(`last_symbol_processed = $${idx}`); params.push(lastSymbol); idx++; }
    if (processed !== null) { sets.push(`symbols_processed = $${idx}`); params.push(processed); idx++; }
    if (total !== null)     { sets.push(`symbols_total = $${idx}`);      params.push(total);     idx++; }
    if (errorMsg !== null)  { sets.push(`error_message = $${idx}`);      params.push(errorMsg);  idx++; }
    await pool.query(`UPDATE crawler_state SET ${sets.join(', ')} WHERE task_name = $1`, params);
  } catch (e) {}
}

function getCountry(symbol, exchange) {
  if (symbol.endsWith('.PA')) return 'FR';
  if (symbol.endsWith('.AS')) return 'NL';
  if (symbol.endsWith('.BR')) return 'BE';
  if (symbol.endsWith('.LS')) return 'PT';
  if (symbol.endsWith('.IR')) return 'IE';
  if (symbol.endsWith('.T'))  return 'JP';
  if (symbol.endsWith('.HK')) return 'HK';
  if (symbol.endsWith('.KS')) return 'KR';
  if (symbol.endsWith('.SS') || symbol.endsWith('.SZ')) return 'CN';
  if (exchange === 'NASDAQ' || exchange === 'NYSE') return 'US';
  if (exchange === 'TSE')  return 'JP';
  if (exchange === 'HKSE') return 'HK';
  return 'XX';
}

function getCurrency(symbol, exchange) {
  if (exchange === 'NASDAQ' || exchange === 'NYSE') return 'USD';
  if (exchange === 'TSE')  return 'JPY';
  if (exchange === 'HKSE') return 'HKD';
  if (symbol.endsWith('.L')) return 'GBP';
  return 'EUR';
}

function startCrawler(config = {}) {
  Object.assign(CRAWLER_CONFIG, config);
  console.log(`[Crawler] 🕷️ Démarrage — budget ${CRAWLER_CONFIG.crawlerBudget}/jour | cycle ${CRAWLER_CONFIG.cycleInterval / 60000}min`);
  console.log(`[Crawler] 📡 Marchés : ${EXCHANGES_TO_COLLECT.map(e => e.exchange).join(', ')}`);
  console.log(`[Crawler] 🔄 Rotation : ${ROTATION_TACHES.join(' → ')}`);
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
  collectSymbols, updateQuotesBatch, updateProfilesBatch,
  updateRatiosBatch, updateDividendsBatch, calculateScores,
};
