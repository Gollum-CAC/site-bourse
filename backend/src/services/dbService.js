// Service DB — Logique "DB d'abord, FMP en fallback"
// Supprimé : getRatiosTTM / sauvegarderRatios (ratios-ttm = plan payant FMP)

const pool = require('../config/database');
const fmpService = require('./fmpService');

const FRESHNESS = {
  quote:   6  * 60 * 60 * 1000,      // 6h (données EOD plan gratuit)
  profile: 30 * 24 * 60 * 60 * 1000, // 30 jours
};

function estPerime(updatedAt, ttl) {
  if (!updatedAt) return true;
  return (Date.now() - new Date(updatedAt).getTime()) > ttl;
}

// ============================================================
// === QUOTES ===
// ============================================================

async function getQuote(symbol) {
  try {
    const { rows } = await pool.query(`
      SELECT q.*, s.name AS stock_name
      FROM stock_quotes q
      LEFT JOIN stocks s ON s.symbol = q.symbol
      WHERE q.symbol = $1
    `, [symbol]);

    if (rows.length > 0 && !estPerime(rows[0].updated_at, FRESHNESS.quote)) {
      return [formatQuoteFromDB(rows[0], symbol)];
    }
  } catch (dbErr) {
    console.warn('[DB] Quote ' + symbol + ':', dbErr.message);
  }

  const data = await fmpService.getQuote(symbol);
  const quote = Array.isArray(data) ? data[0] : data;
  if (quote) await sauvegarderQuote(symbol, quote);
  return data;
}

async function getBatchQuotes(symbols) {
  if (!symbols || symbols.length === 0) return [];
  const resultats = {};
  const aRafraichir = [];

  try {
    const ph = symbols.map((_, i) => '$' + (i + 1)).join(',');
    const { rows } = await pool.query(
      `SELECT q.*, s.name AS stock_name FROM stock_quotes q
       LEFT JOIN stocks s ON s.symbol = q.symbol
       WHERE q.symbol IN (${ph})`, symbols
    );
    const dbMap = {};
    rows.forEach(r => { dbMap[r.symbol] = r; });

    for (const sym of symbols) {
      const row = dbMap[sym];
      if (row && !estPerime(row.updated_at, FRESHNESS.quote)) {
        resultats[sym] = formatQuoteFromDB(row, sym);
      } else {
        aRafraichir.push(sym);
      }
    }
  } catch {
    aRafraichir.push(...symbols);
  }

  // Fallback API — appels individuels (plan gratuit, pas de batch multi-symboles)
  // Limite à 3 symboles max pour ne pas consommer trop de quota utilisateur
  const aFetch = aRafraichir.slice(0, 3);
  for (const sym of aFetch) {
    try {
      const data = await fmpService.getQuote(sym);
      const quote = Array.isArray(data) ? data[0] : data;
      if (quote && quote.price) {
        await sauvegarderQuote(sym, quote);
        resultats[sym] = quote;
      }
    } catch (err) {
      if (err.code !== 'QUOTA_DEPASSE')
        console.warn('[DB] Quote fallback ' + sym + ':', err.message);
    }
  }

  return symbols.map(sym => resultats[sym]).filter(Boolean);
}

// Arrondit une valeur en entier (market_cap, volume, shares — stockés en BIGINT)
function toBigInt(v) {
  if (v == null || isNaN(Number(v))) return null;
  return Math.round(Number(v));
}

async function sauvegarderQuote(symbol, q) {
  try {
    const marketCap = toBigInt(q.marketCap);
    await pool.query(`
      INSERT INTO stocks (symbol, price, market_cap, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (symbol) DO UPDATE SET
        price = EXCLUDED.price,
        market_cap = EXCLUDED.market_cap,
        last_quote_update = NOW(),
        updated_at = NOW()
    `, [symbol, q.price || null, marketCap]);

    await pool.query(`
      INSERT INTO stock_quotes (
        symbol, price, open, day_high, day_low, year_high, year_low,
        change, change_pct, volume, avg_volume, market_cap,
        price_avg_50, price_avg_200, eps, pe, shares_outstanding, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
      ON CONFLICT (symbol) DO UPDATE SET
        price=$2, open=$3, day_high=$4, day_low=$5,
        year_high=$6, year_low=$7, change=$8, change_pct=$9,
        volume=$10, avg_volume=$11, market_cap=$12,
        price_avg_50=$13, price_avg_200=$14, eps=$15, pe=$16,
        shares_outstanding=$17, updated_at=NOW()
    `, [
      symbol,
      q.price   || null,
      q.open    || null,
      q.dayHigh || null,
      q.dayLow  || null,
      q.yearHigh || null,
      q.yearLow  || null,
      q.change  || null,
      q.changesPercentage ?? q.changePercentage ?? null,
      toBigInt(q.volume),
      toBigInt(q.avgVolume),
      marketCap,
      q.priceAvg50  || null,
      q.priceAvg200 || null,
      q.eps || null,
      q.pe  || null,
      toBigInt(q.sharesOutstanding),
    ]);
  } catch (err) {
    console.warn('[DB] sauvegarderQuote ' + symbol + ':', err.message);
  }
}

function formatQuoteFromDB(row, symbol) {
  return {
    symbol, name: row.stock_name || symbol,
    price: parseFloat(row.price) || 0,
    open: parseFloat(row.open) || null,
    dayHigh: parseFloat(row.day_high) || null,
    dayLow: parseFloat(row.day_low) || null,
    yearHigh: parseFloat(row.year_high) || null,
    yearLow: parseFloat(row.year_low) || null,
    change: parseFloat(row.change) || 0,
    changesPercentage: parseFloat(row.change_pct) || 0,
    volume: parseInt(row.volume) || null,
    avgVolume: parseInt(row.avg_volume) || null,
    marketCap: parseInt(row.market_cap) || null,
    priceAvg50: parseFloat(row.price_avg_50) || null,
    priceAvg200: parseFloat(row.price_avg_200) || null,
    eps: parseFloat(row.eps) || null,
    pe: parseFloat(row.pe) || null,
    sharesOutstanding: parseInt(row.shares_outstanding) || null,
    _fromDB: true, _updatedAt: row.updated_at,
  };
}

// ============================================================
// === PROFILS ===
// ============================================================

async function getProfile(symbol) {
  try {
    const { rows } = await pool.query('SELECT * FROM stock_profiles WHERE symbol = $1', [symbol]);
    if (rows.length > 0 && !estPerime(rows[0].updated_at, FRESHNESS.profile)) {
      return [formatProfileFromDB(rows[0])];
    }
  } catch {}
  const data = await fmpService.getCompanyProfile(symbol);
  const profile = Array.isArray(data) ? data[0] : data;
  if (profile) await sauvegarderProfile(symbol, profile);
  return data;
}

async function sauvegarderProfile(symbol, p) {
  try {
    await pool.query(`
      UPDATE stocks SET
        name = COALESCE($2, name), sector = COALESCE($3, sector),
        industry = COALESCE($4, industry), country = COALESCE($5, country),
        currency = COALESCE($6, currency), updated_at = NOW()
      WHERE symbol = $1
    `, [symbol, p.companyName || p.name, p.sector, p.industry, p.country, p.currency]);

    await pool.query(`
      INSERT INTO stock_profiles (
        symbol, name, exchange, currency, country, sector, industry,
        description, ceo, website, ipo_date, employees, image,
        address, city, state, is_etf, is_actively_trading, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
      ON CONFLICT (symbol) DO UPDATE SET
        name=$2, exchange=$3, currency=$4, country=$5,
        sector=$6, industry=$7, description=$8, ceo=$9,
        website=$10, ipo_date=$11, employees=$12, image=$13,
        address=$14, city=$15, state=$16,
        is_etf=$17, is_actively_trading=$18, updated_at=NOW()
    `, [
      symbol, p.companyName || p.name || symbol,
      p.exchange || null, p.currency || 'USD', p.country || 'US',
      p.sector || null, p.industry || null, p.description || null,
      p.ceo || null, p.website || null, p.ipoDate || null,
      p.fullTimeEmployees || null, p.image || null,
      p.address || null, p.city || null, p.state || null,
      p.isEtf || false, p.isActivelyTrading !== false,
    ]);
  } catch (err) {
    console.warn('[DB] sauvegarderProfile ' + symbol + ':', err.message);
  }
}

function formatProfileFromDB(row) {
  return {
    symbol: row.symbol, companyName: row.name, name: row.name,
    exchange: row.exchange, currency: row.currency, country: row.country,
    sector: row.sector, industry: row.industry, description: row.description,
    ceo: row.ceo, website: row.website, ipoDate: row.ipo_date,
    fullTimeEmployees: row.employees, image: row.image,
    address: row.address, city: row.city, state: row.state,
    isEtf: row.is_etf, isActivelyTrading: row.is_actively_trading,
    _fromDB: true, _updatedAt: row.updated_at,
  };
}

// ============================================================
// === STATS ===
// ============================================================
async function getStatsDB() {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM stocks)                           AS total_stocks,
        (SELECT COUNT(*) FROM stock_quotes)                     AS total_quotes,
        (SELECT COUNT(*) FROM stock_profiles)                   AS total_profiles,
        (SELECT COUNT(*) FROM dividends)                        AS total_dividends,
        (SELECT COUNT(*) FROM dividend_analysis)                AS total_analyzed,
        (SELECT COUNT(*) FROM stock_quotes WHERE updated_at > NOW() - INTERVAL '6 hours') AS quotes_frais
    `);
    return rows[0];
  } catch { return {}; }
}

module.exports = {
  getQuote, getBatchQuotes, sauvegarderQuote,
  getProfile, sauvegarderProfile,
  getStatsDB, FRESHNESS,
};
