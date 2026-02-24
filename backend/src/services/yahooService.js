// Service Yahoo Finance — Fallback gratuit pour les actions européennes
// Utilise la lib yahoo-finance2 (scraping officieux, sans clé API)
// Activé automatiquement pour les symboles avec suffixe EU (.PA, .AS, .BR, etc.)

const yahooFinance = require('yahoo-finance2').default;

// Suffixes des marchés européens (et autres non-US) gérés par Yahoo
const SUFFIXES_EU = [
  '.PA',  // Euronext Paris (FR)
  '.AS',  // Euronext Amsterdam (NL)
  '.BR',  // Euronext Bruxelles (BE)
  '.LS',  // Euronext Lisbonne (PT)
  '.IR',  // Euronext Dublin (IE)
  '.DE',  // Xetra Frankfurt (DE)
  '.F',   // Frankfurt (DE)
  '.L',   // London Stock Exchange (UK)
  '.MI',  // Borsa Milano (IT)
  '.MC',  // Bolsa Madrid (ES)
  '.ST',  // Nasdaq Stockholm (SE)
  '.CO',  // Nasdaq Copenhague (DK)
  '.HE',  // Nasdaq Helsinki (FI)
  '.OL',  // Oslo Bors (NO)
  '.T',   // Tokyo (JP)
  '.HK',  // Hong Kong (HK)
  '.SS',  // Shanghai (CN)
  '.SZ',  // Shenzhen (CN)
  '.KS',  // Korea (KR)
  '.AX',  // ASX Australie (AU)
];

/**
 * Vérifie si un symbole doit passer par Yahoo (non-US)
 */
function estSymboleEU(symbol) {
  return SUFFIXES_EU.some(suffix => symbol.toUpperCase().endsWith(suffix));
}

/**
 * Récupère le quote d'une action via Yahoo Finance
 * Retourne un objet au même format que FMP pour compatibilité
 */
async function getQuote(symbol) {
  try {
    const result = await yahooFinance.quote(symbol, {}, { validateResult: false });

    if (!result || !result.regularMarketPrice) {
      throw new Error(`Pas de données Yahoo pour ${symbol}`);
    }

    // Normaliser au format FMP pour compatibilité avec le reste du code
    return [{
      symbol:             result.symbol || symbol,
      name:               result.longName || result.shortName || symbol,
      price:              result.regularMarketPrice || null,
      open:               result.regularMarketOpen || null,
      dayHigh:            result.regularMarketDayHigh || null,
      dayLow:             result.regularMarketDayLow || null,
      yearHigh:           result.fiftyTwoWeekHigh || null,
      yearLow:            result.fiftyTwoWeekLow || null,
      change:             result.regularMarketChange || null,
      changesPercentage:  result.regularMarketChangePercent || null,
      changePercentage:   result.regularMarketChangePercent || null,
      volume:             result.regularMarketVolume || null,
      avgVolume:          result.averageDailyVolume3Month || null,
      marketCap:          result.marketCap || null,
      priceAvg50:         result.fiftyDayAverage || null,
      priceAvg200:        result.twoHundredDayAverage || null,
      eps:                result.epsTrailingTwelveMonths || null,
      pe:                 result.trailingPE || null,
      sharesOutstanding:  result.sharesOutstanding || null,
      currency:           result.currency || 'EUR',
      exchange:           result.exchange || null,
      _source:            'yahoo',
    }];
  } catch (err) {
    console.warn(`[Yahoo] ❌ Quote ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Récupère le profil d'une entreprise via Yahoo Finance
 * Retourne un objet au même format que FMP
 */
async function getProfile(symbol) {
  try {
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: ['assetProfile', 'summaryProfile', 'price'],
    }, { validateResult: false });

    const profile = result?.assetProfile || result?.summaryProfile || {};
    const price   = result?.price || {};

    return [{
      symbol,
      companyName:        price.longName || price.shortName || symbol,
      name:               price.longName || price.shortName || symbol,
      exchange:           price.exchange || null,
      currency:           price.currency || 'EUR',
      country:            profile.country || null,
      sector:             profile.sector || null,
      industry:           profile.industry || null,
      description:        profile.longBusinessSummary || null,
      ceo:                null,
      website:            profile.website || null,
      ipoDate:            null,
      fullTimeEmployees:  profile.fullTimeEmployees || null,
      image:              null,
      address:            profile.address1 || null,
      city:               profile.city || null,
      state:              profile.state || null,
      isEtf:              false,
      isActivelyTrading:  true,
      _source:            'yahoo',
    }];
  } catch (err) {
    console.warn(`[Yahoo] ❌ Profil ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Récupère les ratios TTM via Yahoo Finance
 * Retourne un objet au même format que FMP
 */
async function getRatiosTTM(symbol) {
  try {
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: ['defaultKeyStatistics', 'financialData', 'summaryDetail'],
    }, { validateResult: false });

    const ks = result?.defaultKeyStatistics || {};
    const fd = result?.financialData || {};
    const sd = result?.summaryDetail || {};

    return [{
      peRatioTTM:              sd.trailingPE || null,
      priceToBookRatioTTM:     ks.priceToBook || null,
      priceToSalesRatioTTM:    null,
      pegRatioTTM:             ks.pegRatio || null,
      enterpriseValueOverEBITDATTM: ks.enterpriseToEbitda || null,
      dividendYieldTTM:        sd.dividendYield || null,
      dividendYielPercentageTTM: sd.dividendYield ? sd.dividendYield * 100 : null,
      payoutRatioTTM:          sd.payoutRatio || null,
      returnOnEquityTTM:       fd.returnOnEquity || null,
      returnOnAssetsTTM:       fd.returnOnAssets || null,
      returnOnCapitalEmployedTTM: null,
      grossProfitMarginTTM:    fd.grossMargins || null,
      operatingProfitMarginTTM: fd.operatingMargins || null,
      netProfitMarginTTM:      fd.profitMargins || null,
      currentRatioTTM:         fd.currentRatio || null,
      quickRatioTTM:           fd.quickRatio || null,
      debtEquityRatioTTM:      fd.debtToEquity ? fd.debtToEquity / 100 : null,
      interestCoverageTTM:     null,
      cashPerShareTTM:         null,
      revenueGrowthTTM:        fd.revenueGrowth || null,
      netIncomeGrowthTTM:      fd.earningsGrowth || null,
      _source:                 'yahoo',
    }];
  } catch (err) {
    console.warn(`[Yahoo] ❌ Ratios ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Récupère l'historique des prix via Yahoo Finance
 * Compatible avec le format FMP historicalPrice
 */
async function getHistoricalPrice(symbol, from, to) {
  try {
    const queryOpts = {};
    if (from) queryOpts.period1 = from;
    if (to)   queryOpts.period2 = to;

    const result = await yahooFinance.historical(symbol, queryOpts, { validateResult: false });

    if (!Array.isArray(result)) return { historical: [] };

    // Normaliser au format FMP
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
