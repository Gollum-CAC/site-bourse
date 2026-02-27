// Service yahoo-finance2 — remplace fmpService pour quotes/profils/dividendes
// Pas de clé API, pas de limite de symboles, accès US + Europe
// FMP reste uniquement pour getDividendCalendar (calendrier global)

const yahooFinance = require('yahoo-finance2').default;

// ============================================================
// === CONFIGURATION YAHOO ===
// ============================================================

// Supprimer les logs de validation Yahoo (trop verbeux)
yahooFinance.setGlobalConfig({
  validation: { logErrors: false, logOptionsErrors: false },
});

// ============================================================
// === QUOTE — prix en temps réel ===
// ============================================================

async function getQuote(symbol) {
  try {
    const quote = await yahooFinance.quote(symbol);
    if (!quote) return null;
    return normalizeQuote(quote);
  } catch (err) {
    throw new Error(`Yahoo quote ${symbol}: ${err.message}`);
  }
}

// Batch quotes : Yahoo supporte plusieurs symboles en 1 appel
async function getBatchQuotes(symbols) {
  if (!symbols || symbols.length === 0) return [];
  try {
    // yahooFinance.quote accepte un tableau
    const results = await yahooFinance.quote(symbols);
    const list = Array.isArray(results) ? results : [results];
    return list.filter(q => q && q.regularMarketPrice).map(normalizeQuote);
  } catch (err) {
    // Fallback : appels individuels si le batch échoue
    const out = [];
    for (const sym of symbols) {
      try {
        const q = await yahooFinance.quote(sym);
        if (q && q.regularMarketPrice) out.push(normalizeQuote(q));
      } catch {}
    }
    return out;
  }
}

// Normalise un objet Yahoo en format commun
function normalizeQuote(q) {
  return {
    symbol:             q.symbol,
    name:               q.longName || q.shortName || q.symbol,
    price:              q.regularMarketPrice || 0,
    open:               q.regularMarketOpen || null,
    dayHigh:            q.regularMarketDayHigh || null,
    dayLow:             q.regularMarketDayLow || null,
    previousClose:      q.regularMarketPreviousClose || null,
    yearHigh:           q.fiftyTwoWeekHigh || null,
    yearLow:            q.fiftyTwoWeekLow || null,
    change:             q.regularMarketChange || 0,
    changesPercentage:  q.regularMarketChangePercent || 0,
    volume:             q.regularMarketVolume || null,
    avgVolume:          q.averageDailyVolume3Month || null,
    marketCap:          q.marketCap || null,
    priceAvg50:         q.fiftyDayAverage || null,
    priceAvg200:        q.twoHundredDayAverage || null,
    eps:                q.epsTrailingTwelveMonths || null,
    pe:                 q.trailingPE || null,
    sharesOutstanding:  q.sharesOutstanding || null,
    currency:           q.currency || 'USD',
    exchange:           q.fullExchangeName || q.exchange || null,
    // Dividendes (disponibles dans quote)
    dividendRate:       q.trailingAnnualDividendRate || null,
    dividendYield:      q.trailingAnnualDividendYield
                          ? Math.round(q.trailingAnnualDividendYield * 10000) / 100
                          : null,
    exDividendDate:     q.exDividendDate || null,
    payoutRatio:        q.payoutRatio || null,
  };
}

// ============================================================
// === PROFIL ENTREPRISE ===
// ============================================================

async function getCompanyProfile(symbol) {
  try {
    const result = await yahooFinance.quoteSummary(symbol, {
      modules: ['assetProfile', 'summaryDetail', 'defaultKeyStatistics'],
    });

    const p  = result?.assetProfile || {};
    const sd = result?.summaryDetail || {};
    const ks = result?.defaultKeyStatistics || {};

    return {
      symbol,
      companyName:        p.longBusinessSummary ? symbol : (p.country ? symbol : symbol),
      name:               symbol,
      description:        p.longBusinessSummary || null,
      sector:             p.sector || null,
      industry:           p.industry || null,
      country:            p.country || null,
      website:            p.website || null,
      ceo:                p.companyOfficers?.[0]?.name || null,
      employees:          p.fullTimeEmployees || null,
      address:            p.address1 || null,
      city:               p.city || null,
      state:              p.state || null,
      exchange:           null,
      currency:           null,
      ipoDate:            null,
      isEtf:              false,
      isActivelyTrading:  true,
      // Stats supplémentaires
      beta:               sd.beta || ks.beta || null,
      dividendRate:       sd.dividendRate || null,
      dividendYield:      sd.dividendYield
                            ? Math.round(sd.dividendYield * 10000) / 100
                            : null,
      exDividendDate:     sd.exDividendDate || null,
      payoutRatio:        sd.payoutRatio || null,
      forwardPE:          sd.forwardPE || null,
      priceToBook:        ks.priceToBook || null,
      returnOnEquity:     ks.returnOnEquity || null,
      profitMargins:      ks.profitMargins || null,
    };
  } catch (err) {
    throw new Error(`Yahoo profile ${symbol}: ${err.message}`);
  }
}

// ============================================================
// === DIVIDENDES HISTORIQUES ===
// ============================================================

async function getDividends(symbol) {
  try {
    const result = await yahooFinance.historical(symbol, {
      period1: '2015-01-01',
      events:  'dividends',
    });
    // Yahoo retourne un tableau d'objets { date, dividends }
    return (result || []).map(d => ({
      date:        d.date instanceof Date
                     ? d.date.toISOString().split('T')[0]
                     : String(d.date),
      dividend:    d.dividends || 0,
      adjDividend: d.dividends || 0,
    })).filter(d => d.dividend > 0);
  } catch (err) {
    throw new Error(`Yahoo dividends ${symbol}: ${err.message}`);
  }
}

// ============================================================
// === HISTORIQUE DES PRIX ===
// ============================================================

async function getHistoricalPrice(symbol, from, to) {
  try {
    const opts = { period1: from || '2020-01-01' };
    if (to) opts.period2 = to;
    const result = await yahooFinance.historical(symbol, opts);
    return (result || []).map(d => ({
      date:   d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date),
      open:   d.open,
      high:   d.high,
      low:    d.low,
      close:  d.close,
      volume: d.volume,
    }));
  } catch (err) {
    throw new Error(`Yahoo historical ${symbol}: ${err.message}`);
  }
}

// ============================================================
// === SEARCH ===
// ============================================================

async function searchStock(query) {
  try {
    const result = await yahooFinance.search(query, { quotesCount: 15 });
    return (result?.quotes || []).map(q => ({
      symbol:       q.symbol,
      name:         q.longname || q.shortname || q.symbol,
      exchange:     q.exchange || null,
      type:         q.quoteType || 'EQUITY',
    }));
  } catch (err) {
    throw new Error(`Yahoo search "${query}": ${err.message}`);
  }
}

module.exports = {
  getQuote,
  getBatchQuotes,
  getCompanyProfile,
  getDividends,
  getHistoricalPrice,
  searchStock,
  normalizeQuote,
};
