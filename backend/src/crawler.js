// Crawler optimisé pour le plan GRATUIT FMP — 250 appels/jour
//
// ⚠️ CONTRAINTE FMP FREE : quote?symbol=A,B,C est PREMIUM.
//    Seul quote?symbol=AAPL (1 symbole) est gratuit.
//
// Stratégie — cycle toutes les 30min :
//   1. fetch_quotes   : 5 quotes individuels (5 appels), rotation sur 87 symboles
//                       → couvre tout en 87/5 = 18 cycles = 9h
//   2. fetch_profile  : 1 profil par cycle (1 appel)
//   3. fetch_dividends: 1 dividende par cycle (1 appel)
//   4. calculate_scores : 0 appel, calcul pur DB
//
// Budget 200/jour, cycle 30min → 48 cycles/jour
// Quotes : 5 × 48 = 240 max → refresh complet possible chaque jour

const pool = require('./config/database');
const fmpService = require('./services/fmpService');
const dbService = require('./services/dbService');
const { FMP_FREE_SYMBOLS, FMP_SYMBOLS_META } = require('./fmpSymbols');

// === CONFIGURATION ===
let CONFIG = {
  crawlerBudget: 200,         // appels/jour pour le crawler
  pauseMs: 2000,              // pause entre appels individuels
  profileRefreshDays: 30,
  dividendRefreshDays: 30,
  quoteRefreshHours: 8,       // considère quote périmé après 8h
  quotesPerCycle: 5,          // quotes individuels par cycle
  cycleIntervalMs: 1800000,   // 30 minutes
  enabled: true,
};

// Rotation quotes : index du prochain symbole à updater
let quoteRotationIndex = 0;
let crawlerRunning = false;
let crawlerInterval = null;
let dailyCallCount = 0;
let lastResetDate = new Date().toDateString();

// === COMPTEUR D'APPELS ===
function trackCall() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailyCallCount = 0;
    lastResetDate = today;
    console.log('[Crawler] 🔄 Reset compteur — nouveau jour');
  }
  dailyCallCount++;
}

function canMakeCall(n = 1) {
  const today = new Date().toDateString();
  if (today !== lastResetDate) { dailyCallCount = 0; lastResetDate = today; }
  return dailyCallCount + n <= CONFIG.crawlerBudget && CONFIG.enabled;
}

function pause() { return new Promise(r => setTimeout(r, CONFIG.pauseMs)); }

// ============================================================
// === TÂCHE 0 : Init symboles (0 appel API) ===
// ============================================================
async function initSymbols() {
  console.log('[Crawler] 📋 Initialisation des symboles...');
  let inseres = 0;
  for (const symbol of FMP_FREE_SYMBOLS) {
    const meta = FMP_SYMBOLS_META[symbol] || {};
    try {
      await pool.query(`
        INSERT INTO stocks (symbol, name, exchange, country, sector, currency, is_pea_eligible)
        VALUES ($1, $2, 'NASDAQ', $3, $4, $5, FALSE)
        ON CONFLICT (symbol) DO UPDATE SET
          name=COALESCE(EXCLUDED.name, stocks.name),
          sector=COALESCE(EXCLUDED.sector, stocks.sector),
          country=COALESCE(EXCLUDED.country, stocks.country),
          currency=COALESCE(EXCLUDED.currency, stocks.currency),
          updated_at=NOW()
      `, [symbol, meta.name || symbol, meta.country || 'US', meta.sector || null, meta.currency || 'USD']);
      inseres++;
    } catch (err) {
      console.warn(`[Crawler] ⚠️ Insert ${symbol}:`, err.message);
    }
  }
  await updateCrawlerState('init_symbols', 'idle', null, inseres, FMP_FREE_SYMBOLS.length);
  console.log(`[Crawler] ✅ ${inseres} symboles initialisés (0 appel API)`);
  return inseres;
}

// ============================================================
// === TÂCHE 1 : Quotes individuels — 5 par cycle ===
// Plan gratuit : 1 symbole par appel uniquement
// Rotation sur FMP_FREE_SYMBOLS, reprend là où on s'est arrêté
// ============================================================
async function fetchNextQuotes() {
  const n = CONFIG.quotesPerCycle;
  if (!canMakeCall(n)) {
    console.log(`[Crawler] 🚫 Budget insuffisant — skip quotes (${dailyCallCount}/${CONFIG.crawlerBudget})`);
    return 0;
  }

  // Sélectionner les N prochains symboles dans la rotation
  const total = FMP_FREE_SYMBOLS.length;
  const batch = [];
  for (let i = 0; i < n; i++) {
    batch.push(FMP_FREE_SYMBOLS[quoteRotationIndex % total]);
    quoteRotationIndex++;
  }

  console.log(`[Crawler] 📈 Quotes [${batch.join(', ')}] (${n} appels individuels — index ${quoteRotationIndex - n} → ${quoteRotationIndex - 1})`);

  let sauvegardes = 0;
  for (const symbol of batch) {
    if (!canMakeCall(1)) break;
    try {
      trackCall();
      const data = await fmpService.getQuote(symbol);
      const quote = Array.isArray(data) ? data[0] : data;
      if (quote && quote.price) {
        await dbService.sauvegarderQuote(symbol, quote);
        sauvegardes++;
      }
    } catch (err) {
      if (err.code === 'QUOTA_DEPASSE') { CONFIG.enabled = false; break; }
      console.warn(`[Crawler] ⚠️ Quote ${symbol}:`, err.message);
    }
    await pause();
  }

  await updateCrawlerState('fetch_quotes', 'idle', batch[batch.length - 1], sauvegardes, total);
  console.log(`[Crawler] ✅ ${sauvegardes}/${n} quotes sauvegardés | total appels : ${dailyCallCount}/${CONFIG.crawlerBudget}`);
  return sauvegardes;
}

// ============================================================
// === TÂCHE 2 : Profils — 1 par cycle ===
// ============================================================
async function fetchNextProfile() {
  if (!canMakeCall(1)) return 0;

  const { rows } = await pool.query(`
    SELECT s.symbol FROM stocks s
    LEFT JOIN stock_profiles p ON p.symbol = s.symbol
    WHERE s.symbol = ANY($1::text[])
      AND (p.symbol IS NULL OR p.updated_at < NOW() - INTERVAL '${CONFIG.profileRefreshDays} days')
    ORDER BY p.updated_at ASC NULLS FIRST
    LIMIT 1
  `, [FMP_FREE_SYMBOLS]);

  if (rows.length === 0) {
    console.log('[Crawler] ✅ Tous les profils sont à jour');
    return 0;
  }

  const symbol = rows[0].symbol;
  try {
    trackCall();
    const data = await fmpService.getCompanyProfile(symbol);
    const profile = Array.isArray(data) ? data[0] : data;
    if (profile) {
      await dbService.sauvegarderProfile(symbol, profile);
      console.log(`[Crawler] 🏢 Profil ${symbol} sauvegardé`);
    }
    await pause();
    await updateCrawlerState('fetch_profiles', 'idle', symbol, 1, 1);
    return 1;
  } catch (err) {
    if (err.code === 'QUOTA_DEPASSE') CONFIG.enabled = false;
    else console.error(`[Crawler] ❌ Profil ${symbol}:`, err.message);
    return 0;
  }
}

// ============================================================
// === TÂCHE 3 : Dividendes — 1 par cycle ===
// ============================================================
async function fetchNextDividends() {
  if (!canMakeCall(1)) return 0;

  const { rows } = await pool.query(`
    SELECT symbol FROM stocks
    WHERE symbol = ANY($1::text[])
      AND (last_dividend_update IS NULL OR last_dividend_update < NOW() - INTERVAL '${CONFIG.dividendRefreshDays} days')
    ORDER BY last_dividend_update ASC NULLS FIRST
    LIMIT 1
  `, [FMP_FREE_SYMBOLS]);

  if (rows.length === 0) {
    console.log('[Crawler] ✅ Tous les dividendes sont à jour');
    return 0;
  }

  const symbol = rows[0].symbol;
  try {
    trackCall();
    const divData = await fmpService.getDividends(symbol);
    const dividends = Array.isArray(divData) ? divData : (divData?.historical || []);

    let inseres = 0;
    for (const div of dividends) {
      const exDate = div.date || div.exDate || null;
      const amount = parseFloat(div.dividend || div.adjDividend || 0);
      if (!exDate || amount <= 0) continue;
      try {
        await pool.query(`
          INSERT INTO dividends (symbol, ex_date, payment_date, record_date, declaration_date, amount, currency)
          VALUES ($1,$2,$3,$4,$5,$6,'USD')
          ON CONFLICT (symbol, ex_date, amount) DO NOTHING
        `, [symbol, exDate, div.paymentDate || null, div.recordDate || null, div.declarationDate || null, amount]);
        inseres++;
      } catch {}
    }
    await pool.query('UPDATE stocks SET last_dividend_update=NOW(), updated_at=NOW() WHERE symbol=$1', [symbol]);
    console.log(`[Crawler] 💰 Dividendes ${symbol} : ${inseres} enregistrements`);
    await pause();
    await updateCrawlerState('fetch_dividends', 'idle', symbol, 1, 1);
    return 1;
  } catch (err) {
    if (err.code === 'QUOTA_DEPASSE') CONFIG.enabled = false;
    else console.error(`[Crawler] ❌ Dividendes ${symbol}:`, err.message);
    await pool.query('UPDATE stocks SET last_dividend_update=NOW() WHERE symbol=$1', [symbol]).catch(() => {});
    return 0;
  }
}

// ============================================================
// === TÂCHE 4 : Scores dividendes (0 appel API) ===
// ============================================================
async function calculateScores() {
  const currentYear = new Date().getFullYear();
  const { rows: stocks } = await pool.query(
    'SELECT symbol, price FROM stocks WHERE symbol = ANY($1::text[]) AND price > 0',
    [FMP_FREE_SYMBOLS]
  );
  let calcules = 0;

  for (const stock of stocks) {
    const { rows: divRows } = await pool.query(`
      SELECT EXTRACT(YEAR FROM ex_date)::INTEGER as year, SUM(amount) as total
      FROM dividends WHERE symbol=$1 AND ex_date >= $2
      GROUP BY year ORDER BY year DESC
    `, [stock.symbol, `${currentYear - 6}-01-01`]);

    if (divRows.length === 0) continue;
    const latestDiv  = parseFloat(divRows[0]?.total) || 0;
    const currentYield = (latestDiv / parseFloat(stock.price)) * 100;
    if (currentYield < 0.5) continue;

    const avgDiv   = divRows.reduce((s, r) => s + parseFloat(r.total), 0) / divRows.length;
    const avgYield = (avgDiv / parseFloat(stock.price)) * 100;
    const yearsWithDiv = Math.min(divRows.length, 5);
    const regularity   = Math.round((yearsWithDiv / 5) * 100);

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

    const trend   = growth > 10 ? 'growing' : growth < -10 ? 'declining' : 'stable';
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
    `, [stock.symbol,
        Math.round(currentYield*100)/100, Math.round(avgYield*100)/100,
        Math.round(latestDiv*1000)/1000, yearsWithDiv, Math.round(growth*10)/10,
        trend, regularity, score, JSON.stringify(history)]);
    calcules++;
  }

  await updateCrawlerState('calculate_scores', 'idle', null, calcules, stocks.length);
  console.log(`[Crawler] 🧮 Scores : ${calcules} actions calculées (0 appel API)`);
  return calcules;
}

// ============================================================
// === BOUCLE PRINCIPALE ===
// Priorité : quotes périmés > profils manquants > dividendes > scores
// ============================================================
let rotation = 0;

async function runCrawlerCycle() {
  if (!CONFIG.enabled || crawlerRunning) return;
  crawlerRunning = true;

  try {
    // Vérifier si les symboles sont en base
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM stocks');
    if (parseInt(rows[0].count) === 0) {
      await initSymbols();
      crawlerRunning = false;
      return;
    }

    // Compter les quotes périmés
    const { rows: perimesRows } = await pool.query(`
      SELECT COUNT(*) as count FROM stocks s
      LEFT JOIN stock_quotes q ON q.symbol = s.symbol
      WHERE s.symbol = ANY($1::text[])
        AND (q.symbol IS NULL OR q.updated_at < NOW() - INTERVAL '${CONFIG.quoteRefreshHours} hours')
    `, [FMP_FREE_SYMBOLS]);
    const quotesPerimes = parseInt(perimesRows[0].count);

    console.log(`[Crawler] 🔄 Cycle | quotes périmés: ${quotesPerimes} | appels: ${dailyCallCount}/${CONFIG.crawlerBudget}`);

    // Toujours commencer par des quotes si nécessaire
    if (quotesPerimes > 0 && canMakeCall(CONFIG.quotesPerCycle)) {
      await fetchNextQuotes();
    }

    // Ensuite profil ou dividende en rotation
    rotation++;
    if (rotation % 3 === 0) {
      await calculateScores();
    } else if (rotation % 2 === 0) {
      const updated = await fetchNextDividends();
      if (updated > 0) await calculateScores();
    } else {
      await fetchNextProfile();
    }

  } catch (err) {
    console.error('[Crawler] ❌ Erreur cycle:', err.message);
  }

  crawlerRunning = false;
}

// ============================================================
// === UTILITAIRES ===
// ============================================================
async function updateCrawlerState(taskName, status, lastSymbol, processed, total) {
  try {
    await pool.query(`
      UPDATE crawler_state SET
        status=$2, last_run_at=NOW(), updated_at=NOW(),
        last_symbol_processed=COALESCE($3, last_symbol_processed),
        symbols_processed=COALESCE($4, symbols_processed),
        symbols_total=COALESCE($5, symbols_total)
      WHERE task_name=$1
    `, [taskName, status, lastSymbol, processed, total]);
  } catch {}
}

function startCrawler(config = {}) {
  Object.assign(CONFIG, config);
  console.log(`[Crawler] 🕷️ Démarrage — budget ${CONFIG.crawlerBudget}/jour | cycle ${CONFIG.cycleIntervalMs / 60000}min`);
  console.log(`[Crawler] 📦 ${FMP_FREE_SYMBOLS.length} symboles | ${CONFIG.quotesPerCycle} quotes/cycle | 1 symbole/appel (plan gratuit)`);
  setTimeout(runCrawlerCycle, 3000);
  crawlerInterval = setInterval(runCrawlerCycle, CONFIG.cycleIntervalMs);
}

function stopCrawler() {
  CONFIG.enabled = false;
  if (crawlerInterval) clearInterval(crawlerInterval);
  console.log('[Crawler] 🛑 Arrêté');
}

function getCrawlerConfig() {
  return { ...CONFIG, dailyCallCount, canMakeMoreCalls: canMakeCall(), totalSymbols: FMP_FREE_SYMBOLS.length };
}

function setCrawlerConfig(cfg) { Object.assign(CONFIG, cfg); }

module.exports = {
  startCrawler, stopCrawler, getCrawlerConfig, setCrawlerConfig,
  initSymbols, fetchNextQuotes, fetchNextProfile, fetchNextDividends, calculateScores,
};
