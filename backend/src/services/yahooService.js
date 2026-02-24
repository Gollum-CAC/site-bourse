// Service Yahoo Finance — Fallback gratuit pour les actions européennes
// Utilise yahoo-finance2 v2 (ESM) via import() dynamique depuis CommonJS

// Suffixes des marchés non-US gérés par Yahoo Finance
const SUFFIXES_EU = [
  '.PA', '.AS', '.BR', '.LS', '.IR', '.DE', '.F', '.L',
  '.MI', '.MC', '.ST', '.CO', '.HE', '.OL', '.T', '.HK',
  '.SS', '.SZ', '.KS', '.AX',
];

// Cache du module Yahoo (chargé une seule fois au démarrage)
let _yf = null;
async function getYF() {
  if (!_yf) {
    const mod = await import('yahoo-finance2');
    _yf = mod.default;
  }
  return _yf;
}

/**
 * Vérifie si un symbole doit passer par Yahoo (non-US)
 */
function estSymboleEU(symbol) {
  return SUFFIXES_EU.some(suffix => symbol.toUpperCase().endsWith(suffix));
}

/**
 * Quote via Yahoo Finance — format compatible FMP
 */
async function getQuote(symbol) {
  try {
    const yf = await getYF();
    const result = await yf.quoteSummary(symbol, {
      modules: ['price', 'summaryDetail'],
    });

    const p = result?.price || {};
    const s = result?.summaryDetail || {};

    if (!p.regularMarketPrice) throw new Error('Pas de prix disponible');

    return [{
      symbol:            p.symbol || symbol,
      name:              p.longName || p.shortName || symbol,
      price:             p.regularMarketPrice || null,
      open:              p.regularMarketOpen || null,
      dayHigh:           p.regularMarketDayHigh || null,
      dayLow:            p.regularMarketDayLow || null,
      yearHigh:          s.fiftyTwoWeekHigh || null,
      yearLow:           s.fiftyTwoWeekLow || null,
      change:            p.regularMarketChange || null,
      changesPercentage: p.regularMarketChangePercent || null,
      changePercentage:  p.regularMarketChangePercent || null,
      volume:            p.regularMarketVolume || null,
      avgVolume:         p.averageDailyVolume3Month || null,
      marketCap:         p.marketCap || null,
      eps:               p.epsTrailingTwelveMonths || null,
      pe:                p.trailingPE || null,
      currency:          p.currency || 'EUR',
      _source:           'yahoo',
    }];
  } catch (err) {
    console.warn(`[Yahoo] ❌ Quote ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Profil entreprise via Yahoo Finance — format compatible FMP
 */
async function getProfile(symbol) {
  try {
    const yf = await getYF();
    const result = await yf.quoteSummary(symbol, {
      modules: ['assetProfile', 'price'],
    });

    const profile = result?.assetProfile || {};
    const price   = result?.price || {};

    return [{
      symbol,
      companyName:       price.longName || price.shortName || symbol,
      name:              price.longName || price.shortName || symbol,
      exchange:          price.exchange || null,
      currency:          price.currency || 'EUR',
      country:           profile.country || null,
      sector:            profile.sector || null,
      industry:          profile.industry || null,
      description:       profile.longBusinessSummary || null,
      website:           profile.website || null,
      fullTimeEmployees: profile.fullTimeEmployees || null,
      city:              profile.city || null,
      isEtf:             false,
      isActivelyTrading: true,
      _source:           'yahoo',
    }];
  } catch (err) {
    console.warn(`[Yahoo] ❌ Profil ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Ratios TTM via Yahoo Finance — format compatible FMP
 */
async function getRatiosTTM(symbol) {
  try {
    const yf = await getYF();
    const result = await yf.quoteSummary(symbol, {
      modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail'],
    });

    const ks = result?.defaultKeyStatistics || {};
    const fd = result?.financialData || {};
    const sd = result?.summaryDetail || {};

    return [{
      peRatioTTM:               sd.trailingPE || null,
      priceToBookRatioTTM:      ks.priceToBook || null,
      pegRatioTTM:              ks.pegRatio || null,
      dividendYieldTTM:         sd.dividendYield || null,
      dividendYielPercentageTTM: sd.dividendYield ? sd.dividendYield * 100 : null,
      payoutRatioTTM:           sd.payoutRatio || null,
      returnOnEquityTTM:        fd.returnOnEquity || null,
      returnOnAssetsTTM:        fd.returnOnAssets || null,
      grossProfitMarginTTM:     fd.grossMargins || null,
      operatingProfitMarginTTM: fd.operatingMargins || null,
      netProfitMarginTTM:       fd.profitMargins || null,
      currentRatioTTM:          fd.currentRatio || null,
      quickRatioTTM:            fd.quickRatio || null,
      debtEquityRatioTTM:       fd.debtToEquity ? fd.debtToEquity / 100 : null,
      revenueGrowthTTM:         fd.revenueGrowth || null,
      netIncomeGrowthTTM:       fd.earningsGrowth || null,
      _source:                  'yahoo',
    }];
  } catch (err) {
    console.warn(`[Yahoo] ❌ Ratios ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Historique des prix via Yahoo Finance — format compatible FMP
 */
async function getHistoricalPrice(symbol, from, to) {
  try {
    const yf = await getYF();
    const opts = {};
    if (from) opts.period1 = from;
    if (to)   opts.period2 = to;

    const result = await yf.historical(symbol, opts);
    if (!Array.isArray(result)) return { historical: [] };

    const historical = result.map(d => ({
      date:   d.date ? d.date.toISOString().split('T')[0] : null,
      open:   d.open || null,
      high:   d.high || null,
      low:    d.low || null,
      close:  d.close || null,
      volume: d.volume || null,
    })).filter(d => d.date);

    return { historical };
  } catch (err) {
    console.warn(`[Yahoo] ❌ Historique ${symbol}:`, err.message);
    throw err;
  }
}

module.exports = {
  estSymboleEU,
  getQuote,
  getProfile,
  getRatiosTTM,
  getHistoricalPrice,
  SUFFIXES_EU,
};
