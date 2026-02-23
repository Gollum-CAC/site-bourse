// Service DB — Logique "DB d'abord, FMP en fallback"
// Toutes les données passent par ce service avant d'aller chercher en API
// Principe : si données fraîches en DB → retour immédiat, 0 appel FMP

const pool = require('../config/database');
const fmpService = require('./fmpService');

// === SEUILS DE FRAÎCHEUR ===
// Au-delà de ces durées, les données sont considérées périmées → re-fetch FMP
const FRESHNESS = {
  quote:   60 * 60 * 1000,          // 1 heure pour les prix
  profile: 30 * 24 * 60 * 60 * 1000, // 30 jours pour les profils
  ratios:  7  * 24 * 60 * 60 * 1000, // 7 jours pour les ratios TTM
};

function estPerime(updatedAt, ttl) {
  if (!updatedAt) return true;
  return (Date.now() - new Date(updatedAt).getTime()) > ttl;
}

// ============================================
// === QUOTES ===
// ============================================

/**
 * Récupère le quote d'une action.
 * 1. Cherche en DB (stock_quotes) — si frais (< 1h), retourne directement
 * 2. Sinon appelle FMP, stocke en DB, retourne
 */
async function getQuote(symbol) {
  try {
    // Chercher en DB
    const { rows } = await pool.query(
      'SELECT *, updated_at FROM stock_quotes WHERE symbol = $1',
      [symbol]
    );

    if (rows.length > 0 && !estPerime(rows[0].updated_at, FRESHNESS.quote)) {
      // Données fraîches en DB → retourner au format attendu par le frontend
      return [formatQuoteFromDB(rows[0], symbol)];
    }
  } catch (dbErr) {
    console.warn(`[DB] Impossible de lire quote ${symbol}:`, dbErr.message);
  }

  // Fallback FMP
  const data = await fmpService.getQuote(symbol);
  const quote = Array.isArray(data) ? data[0] : data;
  if (quote) await sauvegarderQuote(symbol, quote);
  return data;
}

/**
 * Sauvegarde un quote FMP en DB
 */
async function sauvegarderQuote(symbol, q) {
  try {
    // S'assurer que le symbole existe dans stocks
    await pool.query(`
      INSERT INTO stocks (symbol, name, price, market_cap, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (symbol) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, stocks.name),
        price = EXCLUDED.price,
        market_cap = EXCLUDED.market_cap,
        last_quote_update = NOW(),
        updated_at = NOW()
    `, [symbol, q.name || symbol, q.price || null, q.marketCap || null]);

    await pool.query(`
      INSERT INTO stock_quotes (
        symbol, price, open, day_high, day_low, year_high, year_low,
        change, change_pct, volume, avg_volume, market_cap,
        price_avg_50, price_avg_200, eps, pe, shares_outstanding, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
      ON CONFLICT (symbol) DO UPDATE SET
        price = EXCLUDED.price, open = EXCLUDED.open,
        day_high = EXCLUDED.day_high, day_low = EXCLUDED.day_low,
        year_high = EXCLUDED.year_high, year_low = EXCLUDED.year_low,
        change = EXCLUDED.change, change_pct = EXCLUDED.change_pct,
        volume = EXCLUDED.volume, avg_volume = EXCLUDED.avg_volume,
        market_cap = EXCLUDED.market_cap, price_avg_50 = EXCLUDED.price_avg_50,
        price_avg_200 = EXCLUDED.price_avg_200, eps = EXCLUDED.eps,
        pe = EXCLUDED.pe, shares_outstanding = EXCLUDED.shares_outstanding,
        updated_at = NOW()
    `, [
      symbol,
      q.price || null, q.open || null,
      q.dayHigh || null, q.dayLow || null,
      q.yearHigh || null, q.yearLow || null,
      q.change || null, q.changesPercentage ?? q.changePercentage ?? null,
      q.volume || null, q.avgVolume || null,
      q.marketCap || null, q.priceAvg50 || null,
      q.priceAvg200 || null, q.eps || null,
      q.pe || null, q.sharesOutstanding || null,
    ]);
  } catch (err) {
    console.warn(`[DB] Sauvegarde quote ${symbol} échouée:`, err.message);
  }
}

function formatQuoteFromDB(row, symbol) {
  return {
    symbol,
    name: row.name || symbol,
    price: parseFloat(row.price) || 0,
    open: parseFloat(row.open) || null,
    dayHigh: parseFloat(row.day_high) || null,
    dayLow: parseFloat(row.day_low) || null,
    yearHigh: parseFloat(row.year_high) || null,
    yearLow: parseFloat(row.year_low) || null,
    change: parseFloat(row.change) || 0,
    changesPercentage: parseFloat(row.change_pct) || 0,
    changePercentage: parseFloat(row.change_pct) || 0,
    volume: parseInt(row.volume) || null,
    avgVolume: parseInt(row.avg_volume) || null,
    marketCap: parseInt(row.market_cap) || null,
    priceAvg50: parseFloat(row.price_avg_50) || null,
    priceAvg200: parseFloat(row.price_avg_200) || null,
    eps: parseFloat(row.eps) || null,
    pe: parseFloat(row.pe) || null,
    sharesOutstanding: parseInt(row.shares_outstanding) || null,
    _fromDB: true,
    _updatedAt: row.updated_at,
  };
}

// ============================================
// === PROFILS ===
// ============================================

/**
 * Récupère le profil d'une entreprise.
 * 1. Cherche en DB (stock_profiles) — si présent (< 30 jours), retourne
 * 2. Sinon appelle FMP, stocke, retourne
 */
async function getProfile(symbol) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stock_profiles WHERE symbol = $1',
      [symbol]
    );

    if (rows.length > 0 && !estPerime(rows[0].updated_at, FRESHNESS.profile)) {
      return [formatProfileFromDB(rows[0])];
    }
  } catch (dbErr) {
    console.warn(`[DB] Impossible de lire profil ${symbol}:`, dbErr.message);
  }

  // Fallback FMP
  const data = await fmpService.getCompanyProfile(symbol);
  const profile = Array.isArray(data) ? data[0] : data;
  if (profile) await sauvegarderProfile(symbol, profile);
  return data;
}

async function sauvegarderProfile(symbol, p) {
  try {
    // Mettre à jour stocks aussi avec les données du profil
    await pool.query(`
      UPDATE stocks SET
        name = COALESCE($2, name),
        sector = COALESCE($3, sector),
        industry = COALESCE($4, industry),
        country = COALESCE($5, country),
        currency = COALESCE($6, currency),
        updated_at = NOW()
      WHERE symbol = $1
    `, [symbol, p.companyName || p.name, p.sector, p.industry, p.country, p.currency]);

    await pool.query(`
      INSERT INTO stock_profiles (
        symbol, name, exchange, currency, country, sector, industry,
        description, ceo, website, ipo_date, employees, image,
        address, city, state, is_etf, is_actively_trading, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
      ON CONFLICT (symbol) DO UPDATE SET
        name = EXCLUDED.name, exchange = EXCLUDED.exchange,
        currency = EXCLUDED.currency, country = EXCLUDED.country,
        sector = EXCLUDED.sector, industry = EXCLUDED.industry,
        description = EXCLUDED.description, ceo = EXCLUDED.ceo,
        website = EXCLUDED.website, ipo_date = EXCLUDED.ipo_date,
        employees = EXCLUDED.employees, image = EXCLUDED.image,
        address = EXCLUDED.address, city = EXCLUDED.city,
        state = EXCLUDED.state, is_etf = EXCLUDED.is_etf,
        is_actively_trading = EXCLUDED.is_actively_trading,
        updated_at = NOW()
    `, [
      symbol,
      p.companyName || p.name || symbol,
      p.exchange || null,
      p.currency || null,
      p.country || null,
      p.sector || null,
      p.industry || null,
      p.description || null,
      p.ceo || null,
      p.website || null,
      p.ipoDate || null,
      p.fullTimeEmployees || p.employees || null,
      p.image || null,
      p.address || null,
      p.city || null,
      p.state || null,
      p.isEtf || false,
      p.isActivelyTrading !== false,
    ]);
  } catch (err) {
    console.warn(`[DB] Sauvegarde profil ${symbol} échouée:`, err.message);
  }
}

function formatProfileFromDB(row) {
  return {
    symbol: row.symbol,
    companyName: row.name,
    name: row.name,
    exchange: row.exchange,
    currency: row.currency,
    country: row.country,
    sector: row.sector,
    industry: row.industry,
    description: row.description,
    ceo: row.ceo,
    website: row.website,
    ipoDate: row.ipo_date,
    fullTimeEmployees: row.employees,
    image: row.image,
    address: row.address,
    city: row.city,
    state: row.state,
    isEtf: row.is_etf,
    isActivelyTrading: row.is_actively_trading,
    _fromDB: true,
    _updatedAt: row.updated_at,
  };
}

// ============================================
// === RATIOS TTM ===
// ============================================

/**
 * Récupère les ratios TTM d'une action.
 * 1. Cherche en DB (stock_ratios) — si présent (< 7 jours), retourne
 * 2. Sinon appelle FMP, stocke, retourne
 */
async function getRatiosTTM(symbol) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM stock_ratios WHERE symbol = $1',
      [symbol]
    );

    if (rows.length > 0 && !estPerime(rows[0].updated_at, FRESHNESS.ratios)) {
      return [formatRatiosFromDB(rows[0])];
    }
  } catch (dbErr) {
    console.warn(`[DB] Impossible de lire ratios ${symbol}:`, dbErr.message);
  }

  // Fallback FMP
  const data = await fmpService.getRatiosTTM(symbol);
  const ratios = Array.isArray(data) ? data[0] : data;
  if (ratios) await sauvegarderRatios(symbol, ratios);
  return data;
}

async function sauvegarderRatios(symbol, r) {
  try {
    await pool.query(`
      INSERT INTO stock_ratios (
        symbol,
        pe_ratio, pb_ratio, ps_ratio, peg_ratio, ev_ebitda,
        dividend_yield, dividend_yield_pct, payout_ratio,
        roe, roa, roic,
        gross_margin, operating_margin, net_margin,
        current_ratio, quick_ratio, debt_equity, interest_coverage, cash_per_share,
        revenue_growth, earnings_growth,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW())
      ON CONFLICT (symbol) DO UPDATE SET
        pe_ratio = EXCLUDED.pe_ratio, pb_ratio = EXCLUDED.pb_ratio,
        ps_ratio = EXCLUDED.ps_ratio, peg_ratio = EXCLUDED.peg_ratio,
        ev_ebitda = EXCLUDED.ev_ebitda,
        dividend_yield = EXCLUDED.dividend_yield,
        dividend_yield_pct = EXCLUDED.dividend_yield_pct,
        payout_ratio = EXCLUDED.payout_ratio,
        roe = EXCLUDED.roe, roa = EXCLUDED.roa, roic = EXCLUDED.roic,
        gross_margin = EXCLUDED.gross_margin,
        operating_margin = EXCLUDED.operating_margin,
        net_margin = EXCLUDED.net_margin,
        current_ratio = EXCLUDED.current_ratio, quick_ratio = EXCLUDED.quick_ratio,
        debt_equity = EXCLUDED.debt_equity,
        interest_coverage = EXCLUDED.interest_coverage,
        cash_per_share = EXCLUDED.cash_per_share,
        revenue_growth = EXCLUDED.revenue_growth,
        earnings_growth = EXCLUDED.earnings_growth,
        updated_at = NOW()
    `, [
      symbol,
      r.peRatioTTM || null, r.priceToBookRatioTTM || null,
      r.priceToSalesRatioTTM || null, r.pegRatioTTM || null,
      r.enterpriseValueOverEBITDATTM || null,
      r.dividendYieldTTM || null, r.dividendYielPercentageTTM || null,
      r.payoutRatioTTM || null,
      r.returnOnEquityTTM || null, r.returnOnAssetsTTM || null,
      r.returnOnCapitalEmployedTTM || null,
      r.grossProfitMarginTTM || null, r.operatingProfitMarginTTM || null,
      r.netProfitMarginTTM || null,
      r.currentRatioTTM || null, r.quickRatioTTM || null,
      r.debtEquityRatioTTM || null, r.interestCoverageTTM || null,
      r.cashPerShareTTM || null,
      r.revenueGrowthTTM || null, r.netIncomeGrowthTTM || null,
    ]);
  } catch (err) {
    console.warn(`[DB] Sauvegarde ratios ${symbol} échouée:`, err.message);
  }
}

function formatRatiosFromDB(row) {
  return {
    peRatioTTM: parseFloat(row.pe_ratio) || null,
    priceToBookRatioTTM: parseFloat(row.pb_ratio) || null,
    priceToSalesRatioTTM: parseFloat(row.ps_ratio) || null,
    pegRatioTTM: parseFloat(row.peg_ratio) || null,
    enterpriseValueOverEBITDATTM: parseFloat(row.ev_ebitda) || null,
    dividendYieldTTM: parseFloat(row.dividend_yield) || null,
    dividendYielPercentageTTM: parseFloat(row.dividend_yield_pct) || null,
    payoutRatioTTM: parseFloat(row.payout_ratio) || null,
    returnOnEquityTTM: parseFloat(row.roe) || null,
    returnOnAssetsTTM: parseFloat(row.roa) || null,
    returnOnCapitalEmployedTTM: parseFloat(row.roic) || null,
    grossProfitMarginTTM: parseFloat(row.gross_margin) || null,
    operatingProfitMarginTTM: parseFloat(row.operating_margin) || null,
    netProfitMarginTTM: parseFloat(row.net_margin) || null,
    currentRatioTTM: parseFloat(row.current_ratio) || null,
    quickRatioTTM: parseFloat(row.quick_ratio) || null,
    debtEquityRatioTTM: parseFloat(row.debt_equity) || null,
    interestCoverageTTM: parseFloat(row.interest_coverage) || null,
    cashPerShareTTM: parseFloat(row.cash_per_share) || null,
    revenueGrowthTTM: parseFloat(row.revenue_growth) || null,
    netIncomeGrowthTTM: parseFloat(row.earnings_growth) || null,
    _fromDB: true,
    _updatedAt: row.updated_at,
  };
}

// ============================================
// === STATS ===
// ============================================

async function getStatsDB() {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM stocks)                                       AS total_stocks,
        (SELECT COUNT(*) FROM stock_quotes)                                 AS total_quotes,
        (SELECT COUNT(*) FROM stock_profiles)                               AS total_profiles,
        (SELECT COUNT(*) FROM stock_ratios)                                 AS total_ratios,
        (SELECT COUNT(*) FROM stock_quotes
          WHERE updated_at > NOW() - INTERVAL '1 hour')                    AS quotes_frais,
        (SELECT COUNT(*) FROM stock_profiles
          WHERE updated_at > NOW() - INTERVAL '30 days')                   AS profiles_frais,
        (SELECT COUNT(*) FROM stock_ratios
          WHERE updated_at > NOW() - INTERVAL '7 days')                    AS ratios_frais
    `);
    return rows[0];
  } catch { return {}; }
}

module.exports = {
  getQuote, sauvegarderQuote,
  getProfile, sauvegarderProfile,
  getRatiosTTM, sauvegarderRatios,
  getStatsDB,
  FRESHNESS,
};
