// Crawler optimisé pour le plan GRATUIT FMP — 250 appels/jour
//
// Stratégie de remplissage :
//   Jour 1 : 1 appel batch quotes (87 symboles en 1 appel) = 1 appel
//            + 87 profils × 1 appel = 87 appels → total ~88
//   Jour 2 : 87 dividendes × 1 appel = 87 appels
//   Jour 3+ : maintenance quotes (~3 appels batch/jour) + dividendes rare
//
// Budget journalier : 250 appels
//   - 200 pour le crawler
//   - 50 réservés pour les requêtes utilisateur
//
// Tâches (rotation) :
//   1. init_symbols  — insérer les 87 symboles depuis la liste fixe (0 appel API)
//   2. batch_quotes  — 1 seul appel pour tous les prix
//   3. fetch_profiles — 1 profil par cycle (données statiques, refresh 30j)
//   4. fetch_dividends — 1 dividende par cycle (refresh 30j)
//   5. calculate_scores — 0 appel, calcul pur DB

const pool = require('./config/database');
const fmpService = require('./services/fmpService');
const dbService = require('./services/dbService');
const { FMP_FREE_SYMBOLS, FMP_SYMBOLS_META } = require('./fmpSymbols');

// === CONFIGURATION ===
let CONFIG = {
  dailyBudget: 250,
  crawlerBudget: 200,       // 200 appels/jour pour le crawler
  pauseMs: 4000,            // 4s entre chaque appel individuel (prudent)
  profileRefreshDays: 30,
  dividendRefreshDays: 30,
  quoteRefreshHours: 6,     // Refresh quotes toutes les 6h (données EOD)
  cycleIntervalMs: 3600000, // Cycle toutes les heures
  enabled: true,
};

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
  console.log(`[Crawler] 📊 Appels aujourd'hui : ${dailyCallCount}/${CONFIG.crawlerBudget}`);
}

function canMakeCall(n = 1) {
  const today = new Date().toDateString();
  if (today !== lastResetDate) { dailyCallCount = 0; lastResetDate = today; }
  return dailyCallCount + n <= CONFIG.crawlerBudget && CONFIG.enabled;
}

function pause() {
  return new Promise(r => setTimeout(r, CONFIG.pauseMs));
}

// ============================================================
// === TÂCHE 0 : Initialisation des symboles (0 appel API) ===
// Insère les 87 symboles avec métadonnées statiques
// ============================================================
async function initSymbols() {
  console.log('[Crawler] 📋 Initialisation des 87 symboles...');
  let inseres = 0;

  for (const symbol of FMP_FREE_SYMBOLS) {
    const meta = FMP_SYMBOLS_META[symbol] || {};
    try {
      await pool.query(`
        INSERT INTO stocks (symbol, name, exchange, country, sector, currency, is_pea_eligible)
        VALUES ($1, $2, 'NASDAQ', $3, $4, $5, FALSE)
        ON CONFLICT (symbol) DO UPDATE SET
          name     = COALESCE(EXCLUDED.name, stocks.name),
          sector   = COALESCE(EXCLUDED.sector, stocks.sector),
          country  = COALESCE(EXCLUDED.country, stocks.country),
          currency = COALESCE(EXCLUDED.currency, stocks.currency),
          updated_at = NOW()
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
// === TÂCHE 1 : Batch quotes — 1 seul appel pour tous ===
// Rafraîchit les prix de tous les 87 symboles en 1 appel FMP
// ============================================================
async function batchQuotes() {
  if (!canMakeCall(1)) {
    console.log('[Crawler] 🚫 Budget atteint — skip batch quotes');
    return 0;
  }

  console.log(`[Crawler] 📈 Batch quotes — ${FMP_FREE_SYMBOLS.length} symboles en 1 appel...`);
  try {
    trackCall();
    const data = await fmpService.getBatchQuotes(FMP_FREE_SYMBOLS);
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[Crawler] ⚠️ Batch quotes : réponse vide');
      return 0;
    }

    let sauvegardes = 0;
    for (const quote of data) {
      if (!quote.symbol || !quote.price) continue;
      await dbService.sauvegarderQuote(quote.symbol, quote);
      sauvegardes++;
    }

    await updateCrawlerState('batch_quotes', 'idle', null, sauvegardes, data.length);
    console.log(`[Crawler] ✅ Batch quotes : ${sauvegardes}/${FMP_FREE_SYMBOLS.length} mis à jour (1 appel)`);
    return sauvegardes;
  } catch (err) {
    if (err.code === 'QUOTA_DEPASSE') {
      console.warn('[Crawler] 🚫 QUOTA DÉPASSÉ sur batch quotes');
      CONFIG.enabled = false;
    } else {
      console.error('[Crawler] ❌ Batch quotes:', err.message);
    }
    return 0;
  }
}

// ============================================================
// === TÂCHE 2 : Profils — 1 par cycle (1 appel) ===
// Priorité aux symboles sans profil, puis les plus anciens
// ============================================================
async function fetchNextProfile() {
  if (!canMakeCall(1)) return 0;

  // Trouver le prochain symbole sans profil (ou profil périmé)
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
// === TÂCHE 3 : Dividendes — 1 par cycle (1 appel) ===
// Priorité aux symboles sans dividendes (ou > 30j)
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
    let dividends = Array.isArray(divData) ? divData : (divData?.historical || []);

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

    await pool.query(
      'UPDATE stocks SET last_dividend_update = NOW(), updated_at = NOW() WHERE symbol = $1',
      [symbol]
    );

    console.log(`[Crawler] 💰 Dividendes ${symbol} : ${inseres} enregistrements (${dividends.length} reçus)`);
    await pause();
    await updateCrawlerState('fetch_dividends', 'idle', symbol, 1, 1);
    return 1;
  } catch (err) {
    if (err.code === 'QUOTA_DEPASSE') CONFIG.enabled = false;
    else console.error(`[Crawler] ❌ Dividendes ${symbol}:`, err.message);
    // Marquer quand même pour ne pas bloquer sur ce symbole
    await pool.query('UPDATE stocks SET last_dividend_update = NOW() WHERE symbol = $1', [symbol]).catch(() => {});
    return 0;
  }
}

// ============================================================
// === TÂCHE 4 : Calcul des scores dividendes (0 appel API) ===
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
      FROM dividends
      WHERE symbol = $1 AND ex_date >= $2
      GROUP BY year ORDER BY year DESC
    `, [stock.symbol, `${currentYear - 6}-01-01`]);

    if (divRows.length === 0) continue;

    const latestDiv = parseFloat(divRows[0]?.total) || 0;
    const currentYield = (latestDiv / parseFloat(stock.price)) * 100;
    if (currentYield < 1) continue; // Ignorer les actions sans dividende significatif

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

    const trend = growth > 10 ? 'growing' : growth < -10 ? 'declining' : 'stable';
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
    `, [stock.symbol, Math.round(currentYield * 100) / 100, Math.round(avgYield * 100) / 100,
        Math.round(latestDiv * 1000) / 1000, yearsWithDiv, Math.round(growth * 10) / 10,
        trend, regularity, score, JSON.stringify(history)]);
    calcules++;
  }

  await updateCrawlerState('calculate_scores', 'idle', null, calcules, stocks.length);
  console.log(`[Crawler] 🧮 Scores : ${calcules} actions calculées (0 appel API)`);
  return calcules;
}

// ============================================================
// === BOUCLE PRINCIPALE ===
// Rotation : batch_quotes → profiles → dividends → scores
// Le batch_quotes ne tourne que si les quotes sont périmés (>6h)
// ============================================================
let rotation = 0;
const TACHES = ['batch_quotes', 'fetch_profile', 'fetch_dividends', 'calculate_scores'];

async function runCrawlerCycle() {
  if (!CONFIG.enabled || crawlerRunning) return;
  crawlerRunning = true;

  try {
    // Vérifier si les symboles sont en base
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM stocks');
    const count = parseInt(rows[0].count);

    // Première fois : insérer les symboles (0 appel API)
    if (count === 0) {
      await initSymbols();
      crawlerRunning = false;
      return;
    }

    // Vérifier si les quotes sont périmés (> quoteRefreshHours)
    const { rows: perimesRows } = await pool.query(`
      SELECT COUNT(*) as count FROM stocks s
      LEFT JOIN stock_quotes q ON q.symbol = s.symbol
      WHERE s.symbol = ANY($1::text[])
        AND (q.symbol IS NULL OR q.updated_at < NOW() - INTERVAL '${CONFIG.quoteRefreshHours} hours')
    `, [FMP_FREE_SYMBOLS]);
    const quotesPerimes = parseInt(perimesRows[0].count);

    if (quotesPerimes > 0) {
      console.log(`[Crawler] 🕐 ${quotesPerimes} quotes périmés → batch_quotes`);
      await batchQuotes();
      crawlerRunning = false;
      return;
    }

    // Sinon, suivre la rotation normale
    const tache = TACHES[rotation % TACHES.length];
    rotation++;

    console.log(`[Crawler] 🔄 Cycle ${rotation} → ${tache} | ${dailyCallCount}/${CONFIG.crawlerBudget} appels`);

    switch (tache) {
      case 'batch_quotes':
        // Déjà géré ci-dessus si nécessaire, sinon skip
        break;
      case 'fetch_profile':
        await fetchNextProfile();
        break;
      case 'fetch_dividends':
        const updated = await fetchNextDividends();
        if (updated > 0) await calculateScores(); // Recalculer le score après nouveau dividende
        break;
      case 'calculate_scores':
        await calculateScores();
        break;
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
        status = $2, last_run_at = NOW(), updated_at = NOW(),
        last_symbol_processed = COALESCE($3, last_symbol_processed),
        symbols_processed = COALESCE($4, symbols_processed),
        symbols_total = COALESCE($5, symbols_total)
      WHERE task_name = $1
    `, [taskName, status, lastSymbol, processed, total]);
  } catch {}
}

function startCrawler(config = {}) {
  Object.assign(CONFIG, config);
  console.log(`[Crawler] 🕷️ Démarrage — budget ${CONFIG.crawlerBudget}/jour | cycle ${CONFIG.cycleIntervalMs / 60000}min`);
  console.log(`[Crawler] 📦 ${FMP_FREE_SYMBOLS.length} symboles à gérer (plan FMP gratuit)`);

  // Premier cycle immédiat
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

function setCrawlerConfig(config) {
  Object.assign(CONFIG, config);
}

module.exports = {
  startCrawler, stopCrawler, getCrawlerConfig, setCrawlerConfig,
  initSymbols, batchQuotes, fetchNextProfile, fetchNextDividends, calculateScores,
};
