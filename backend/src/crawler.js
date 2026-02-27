// Crawler yahoo-finance2 — US + Europe, pas de limite de symboles
//
// Stratégie :
//   - Quotes : batch Yahoo (1 appel pour N symboles) toutes les 6h
//   - Profils : 3 par cycle (données statiques, refresh 30j)
//   - Dividendes : 3 par cycle (refresh 30j)
//   - Scores : calcul pur DB (0 appel)
//
// Cycle : 30min
// Pas de quota à gérer — Yahoo n'a pas de limite d'appels stricte
// (prudence quand même : pause 1s entre appels individuels)

const pool = require('./config/database');
const yahoo = require('./services/yahooService');
const dbService = require('./services/dbService');
const { YAHOO_SYMBOLS, SYMBOLS_META } = require('./yahooSymbols');

// === CONFIGURATION ===
let CONFIG = {
  pauseMs:             1000,   // 1s entre appels individuels
  profileRefreshDays:  30,
  dividendRefreshDays: 30,
  quoteRefreshHours:   6,
  profilesPerCycle:    3,      // profils par cycle
  dividendsPerCycle:   3,      // dividendes par cycle
  cycleIntervalMs:     1800000, // 30 minutes
  enabled:             true,
};

let crawlerRunning  = false;
let crawlerInterval = null;

function pause(ms = CONFIG.pauseMs) {
  return new Promise(r => setTimeout(r, ms));
}

// ============================================================
// === TÂCHE 0 : Init symboles (0 appel API) ===
// ============================================================
async function initSymbols() {
  console.log(`[Crawler] 📋 Init ${YAHOO_SYMBOLS.length} symboles...`);
  let inseres = 0;
  for (const symbol of YAHOO_SYMBOLS) {
    const meta = SYMBOLS_META[symbol] || {};
    const currency = meta.currency || (symbol.endsWith('.PA') || symbol.endsWith('.DE') || symbol.endsWith('.AS') ? 'EUR' : symbol.endsWith('.L') ? 'GBp' : symbol.endsWith('.SW') ? 'CHF' : 'USD');
    const country  = meta.country  || (symbol.endsWith('.PA') ? 'FR' : symbol.endsWith('.DE') ? 'DE' : symbol.endsWith('.AS') ? 'NL' : symbol.endsWith('.L') ? 'GB' : symbol.endsWith('.SW') ? 'CH' : 'US');
    try {
      await pool.query(`
        INSERT INTO stocks (symbol, name, exchange, country, sector, currency, is_pea_eligible)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (symbol) DO UPDATE SET
          name=COALESCE(EXCLUDED.name, stocks.name),
          sector=COALESCE(EXCLUDED.sector, stocks.sector),
          country=COALESCE(EXCLUDED.country, stocks.country),
          currency=COALESCE(EXCLUDED.currency, stocks.currency),
          updated_at=NOW()
      `, [
        symbol,
        meta.name || symbol,
        meta.exchange || null,
        country,
        meta.sector || null,
        currency,
        // PEA éligible = actions françaises + quelques européennes
        country === 'FR' || (country !== 'US' && country !== 'GB' && country !== 'CH'),
      ]);
      inseres++;
    } catch (err) {
      console.warn(`[Crawler] ⚠️ Insert ${symbol}:`, err.message);
    }
  }
  await updateCrawlerState('init_symbols', 'idle', null, inseres, YAHOO_SYMBOLS.length);
  console.log(`[Crawler] ✅ ${inseres} symboles initialisés`);
  return inseres;
}

// ============================================================
// === TÂCHE 1 : Batch quotes — 1 seul appel Yahoo ===
// Yahoo supporte un tableau de symboles en 1 requête
// ============================================================
async function batchQuotes() {
  console.log(`[Crawler] 📈 Batch quotes Yahoo — ${YAHOO_SYMBOLS.length} symboles...`);
  try {
    const quotes = await yahoo.getBatchQuotes(YAHOO_SYMBOLS);
    let sauvegardes = 0;
    for (const q of quotes) {
      if (!q.symbol || !q.price) continue;
      await dbService.sauvegarderQuote(q.symbol, q);
      // Mettre à jour le dividend yield dans stocks si disponible
      if (q.dividendYield != null) {
        await pool.query(
          'UPDATE stocks SET current_yield=$2, updated_at=NOW() WHERE symbol=$1',
          [q.symbol, q.dividendYield]
        ).catch(() => {});
      }
      sauvegardes++;
    }
    await updateCrawlerState('batch_quotes', 'idle', null, sauvegardes, YAHOO_SYMBOLS.length);
    console.log(`[Crawler] ✅ Batch quotes : ${sauvegardes}/${YAHOO_SYMBOLS.length} mis à jour`);
    return sauvegardes;
  } catch (err) {
    console.error('[Crawler] ❌ Batch quotes Yahoo:', err.message);
    return 0;
  }
}

// ============================================================
// === TÂCHE 2 : Profils — N par cycle ===
// ============================================================
async function fetchNextProfiles() {
  const { rows } = await pool.query(`
    SELECT s.symbol FROM stocks s
    LEFT JOIN stock_profiles p ON p.symbol = s.symbol
    WHERE s.symbol = ANY($1::text[])
      AND (p.symbol IS NULL OR p.updated_at < NOW() - INTERVAL '${CONFIG.profileRefreshDays} days')
    ORDER BY p.updated_at ASC NULLS FIRST
    LIMIT $2
  `, [YAHOO_SYMBOLS, CONFIG.profilesPerCycle]);

  if (rows.length === 0) {
    console.log('[Crawler] ✅ Tous les profils sont à jour');
    return 0;
  }

  let done = 0;
  for (const { symbol } of rows) {
    try {
      const profile = await yahoo.getCompanyProfile(symbol);
      if (profile) {
        await dbService.sauvegarderProfile(symbol, profile);
        // Stocker les stats supplémentaires dans stock_quotes si dispo
        if (profile.dividendYield != null || profile.beta != null) {
          await pool.query(`
            UPDATE stock_quotes SET
              dividend_yield = COALESCE($2, dividend_yield),
              beta           = COALESCE($3, beta),
              updated_at     = NOW()
            WHERE symbol = $1
          `, [symbol, profile.dividendYield, profile.beta]).catch(() => {});
        }
        console.log(`[Crawler] 🏢 Profil ${symbol} sauvegardé`);
        done++;
      }
    } catch (err) {
      console.warn(`[Crawler] ⚠️ Profil ${symbol}:`, err.message);
    }
    await pause();
  }
  await updateCrawlerState('fetch_profiles', 'idle', rows[rows.length-1]?.symbol, done, YAHOO_SYMBOLS.length);
  return done;
}

// ============================================================
// === TÂCHE 3 : Dividendes — N par cycle ===
// ============================================================
async function fetchNextDividends() {
  const { rows } = await pool.query(`
    SELECT symbol FROM stocks
    WHERE symbol = ANY($1::text[])
      AND (last_dividend_update IS NULL OR last_dividend_update < NOW() - INTERVAL '${CONFIG.dividendRefreshDays} days')
    ORDER BY last_dividend_update ASC NULLS FIRST
    LIMIT $2
  `, [YAHOO_SYMBOLS, CONFIG.dividendsPerCycle]);

  if (rows.length === 0) {
    console.log('[Crawler] ✅ Tous les dividendes sont à jour');
    return 0;
  }

  let done = 0;
  for (const { symbol } of rows) {
    try {
      const dividends = await yahoo.getDividends(symbol);
      let inseres = 0;
      for (const div of dividends) {
        const amount = parseFloat(div.dividend || div.adjDividend || 0);
        if (!div.date || amount <= 0) continue;
        try {
          await pool.query(`
            INSERT INTO dividends (symbol, ex_date, amount, currency)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (symbol, ex_date, amount) DO NOTHING
          `, [symbol, div.date, amount, 'USD']);
          inseres++;
        } catch {}
      }
      await pool.query(
        'UPDATE stocks SET last_dividend_update=NOW(), updated_at=NOW() WHERE symbol=$1',
        [symbol]
      );
      console.log(`[Crawler] 💰 Dividendes ${symbol} : ${inseres} enregistrements`);
      done++;
    } catch (err) {
      console.warn(`[Crawler] ⚠️ Dividendes ${symbol}:`, err.message);
      await pool.query('UPDATE stocks SET last_dividend_update=NOW() WHERE symbol=$1', [symbol]).catch(() => {});
    }
    await pause();
  }
  await updateCrawlerState('fetch_dividends', 'idle', rows[rows.length-1]?.symbol, done, YAHOO_SYMBOLS.length);
  return done;
}

// ============================================================
// === TÂCHE 4 : Scores dividendes (0 appel API) ===
// ============================================================
async function calculateScores() {
  const currentYear = new Date().getFullYear();
  const { rows: stocks } = await pool.query(
    'SELECT symbol, price FROM stocks WHERE symbol = ANY($1::text[]) AND price > 0',
    [YAHOO_SYMBOLS]
  );
  let calcules = 0;

  for (const stock of stocks) {
    const { rows: divRows } = await pool.query(`
      SELECT EXTRACT(YEAR FROM ex_date)::INTEGER as year, SUM(amount) as total
      FROM dividends WHERE symbol=$1 AND ex_date >= $2
      GROUP BY year ORDER BY year DESC
    `, [stock.symbol, `${currentYear - 6}-01-01`]);

    if (divRows.length === 0) continue;
    const latestDiv   = parseFloat(divRows[0]?.total) || 0;
    const currentYield = (latestDiv / parseFloat(stock.price)) * 100;
    if (currentYield < 0.5) continue;

    const avgDiv    = divRows.reduce((s, r) => s + parseFloat(r.total), 0) / divRows.length;
    const avgYield  = (avgDiv / parseFloat(stock.price)) * 100;
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
      year:     r.year,
      dividend: Math.round(parseFloat(r.total) * 1000) / 1000,
      yield:    Math.round((parseFloat(r.total) / parseFloat(stock.price)) * 10000) / 100,
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
  console.log(`[Crawler] 🧮 Scores : ${calcules} actions calculées`);
  return calcules;
}

// ============================================================
// === BOUCLE PRINCIPALE ===
// ============================================================
let rotation = 0;

async function runCrawlerCycle() {
  if (!CONFIG.enabled || crawlerRunning) return;
  crawlerRunning = true;

  try {
    // Init si DB vide
    const { rows } = await pool.query('SELECT COUNT(*) as count FROM stocks');
    if (parseInt(rows[0].count) === 0) {
      await initSymbols();
      crawlerRunning = false;
      return;
    }

    // Vérifier si quotes périmés
    const { rows: perimesRows } = await pool.query(`
      SELECT COUNT(*) as count FROM stocks s
      LEFT JOIN stock_quotes q ON q.symbol = s.symbol
      WHERE s.symbol = ANY($1::text[])
        AND (q.symbol IS NULL OR q.updated_at < NOW() - INTERVAL '${CONFIG.quoteRefreshHours} hours')
    `, [YAHOO_SYMBOLS]);
    const quotesPerimes = parseInt(perimesRows[0].count);

    console.log(`[Crawler] 🔄 Cycle | quotes périmés: ${quotesPerimes}/${YAHOO_SYMBOLS.length}`);

    // Quotes en priorité si périmés
    if (quotesPerimes > 0) {
      await batchQuotes();
    }

    // Rotation profils / dividendes / scores
    rotation++;
    if (rotation % 4 === 0) {
      await calculateScores();
    } else if (rotation % 3 === 0) {
      const n = await fetchNextDividends();
      if (n > 0) await calculateScores();
    } else {
      await fetchNextProfiles();
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
  const total = YAHOO_SYMBOLS.length;
  const us    = YAHOO_SYMBOLS.filter(s => !s.includes('.')).length;
  const eu    = total - us;
  console.log(`[Crawler] 🕷️ Démarrage Yahoo Finance — cycle ${CONFIG.cycleIntervalMs / 60000}min`);
  console.log(`[Crawler] 📦 ${total} symboles (${us} US + ${eu} Europe) | sans quota API`);
  setTimeout(runCrawlerCycle, 3000);
  crawlerInterval = setInterval(runCrawlerCycle, CONFIG.cycleIntervalMs);
}

function stopCrawler() {
  CONFIG.enabled = false;
  if (crawlerInterval) clearInterval(crawlerInterval);
  console.log('[Crawler] 🛑 Arrêté');
}

function getCrawlerConfig() {
  const total = YAHOO_SYMBOLS.length;
  return {
    ...CONFIG,
    totalSymbols: total,
    usSymbols:    YAHOO_SYMBOLS.filter(s => !s.includes('.')).length,
    euSymbols:    YAHOO_SYMBOLS.filter(s => s.includes('.')).length,
    dailyCallCount: 0, // Yahoo : pas de compteur
    crawlerBudget:  'illimité',
  };
}

function setCrawlerConfig(cfg) { Object.assign(CONFIG, cfg); }

module.exports = {
  startCrawler, stopCrawler, getCrawlerConfig, setCrawlerConfig,
  initSymbols, batchQuotes, fetchNextProfiles, fetchNextDividends, calculateScores,
};
