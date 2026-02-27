// Service yahoo-finance2 v3 — compatible Node.js 24
// L'API v3 expose une fonction default via require()

const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ============================================================
// === QUOTE ===
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

async function getBatchQuotes(symbols) {
  if (!symbols || symbols.length === 0) return [];
  const out = [];
  // Yahoo v3 ne supporte pas les tableaux en batch — appels individuels
  // Mais rapides : pas de quota, on peut en faire ~100 en parallèle par petits groupes
  const CHUNK = 10; // 10 appels en parallèle
  for (let i = 0; i < symbols.length; i += CHUNK) {
    const chunk = symbols.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map(sym => yahooFinance.quote(sym))
    );
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value?.regularMarketPrice) {
        out.push(normalizeQuote(res.value));
      }
    }
    // Petite pause entre chunks pour ne pas surcharger Yahoo
    if (i + CHUNK < symbols.length) await new Promise(r => setTimeout(r, 500));
  }
  return out;
}

function normalizeQuote(q) {
  return {
    symbol:            q.symbol,
    name:              q.longName || q.shortName || q.symbol,
    price:             q.regularMarketPrice || 0,
    open:              q.regularMarketOpen || null,
    dayHigh:           q.regularMarketDayHigh || null,
    dayLow:            q.regularMarketDayLow || null,
    previousClose:     q.regularMarketPreviousClose || null,
    yearHigh:          q.fiftyTwoWeekHigh || null,
    yearLow:           q.fiftyTwoWeekLow || null,
    change:            q.regularMarketChange || 0,
    changesPercentage: q.regularMarketChangePercent || 0,
    volume:            q.regularMarketVolume || null,
    avgVolume:         q.averageDailyVolume3Month || null,
    marketCap:         q.marketCap || null,
    priceAvg50:        q.fiftyDayAverage || null,
    priceAvg200:       q.twoHundredDayAverage || null,
    eps:               q.epsTrailingTwelveMonths || null,
    pe:                q.trailingPE || null,
    sharesOutstanding: q.sharesOutstanding || null,
    currency:          q.currency || 'USD',
    exchange:          q.fullExchangeName || q.exchange || null,
    dividendRate:      q.trailingAnnualDividendRate || null,
    dividendYield:     q.trailingAnnualDividendYield
                         ? Math.round(q.trailingAnnualDividendYield * 10000) / 100
                         : null,
    exDividendDate:    q.exDividendDate || null,
  };
}

// ============================================================
// === PROFIL ===
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
      name:              symbol,
      companyName:       symbol,
      description:       p.longBusinessSummary || null,
      sector:            p.sector || null,
      industry:          p.industry || null,
      country:           p.country || null,
      website:           p.website || null,
      ceo:               p.companyOfficers?.[0]?.name || null,
      employees:         p.fullTimeEmployees || null,
      address:           p.address1 || null,
      city:              p.city || null,
      state:             p.state || null,
      isEtf:             false,
      isActivelyTrading: true,
      beta:              sd.beta || ks.beta || null,
      dividendYield:     sd.dividendYield
                           ? Math.round(sd.dividendYield * 10000) / 100
                           : null,
      exDividendDate:    sd.exDividendDate || null,
      payoutRatio:       sd.payoutRatio || null,
      forwardPE:         sd.forwardPE || null,
      priceToBook:       ks.priceToBook || null,
    };
  } catch (err) {
    throw new Error(`Yahoo profile ${symbol}: ${err.message}`);
  }
}

// ============================================================
// === DIVIDENDES ===
// ============================================================

async function getDividends(symbol) {
  try {
    const result = await yahooFinance.historical(symbol, {
      period1: '2015-01-01',
      events:  'dividends',
    });
    return (result || []).map(d => ({
      date:     d.date instanceof Date
                  ? d.date.toISOString().split('T')[0]
                  : String(d.date),
      dividend: d.dividends || d.amount || 0,
    })).filter(d => d.dividend > 0);
  } catch (err) {
    throw new Error(`Yahoo dividends ${symbol}: ${err.message}`);
  }
}

// ============================================================
// === HISTORIQUE PRIX ===
// ============================================================

async function getHistoricalPrice(symbol, from, to) {
  try {
    const opts = { period1: from || '2020-01-01' };
    if (to) opts.period2 = to;
    const result = await yahooFinance.historical(symbol, opts);
    return (result || []).map(d => ({
      date:   d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date),
      open:   d.open, high: d.high, low: d.low,
      close:  d.close, volume: d.volume,
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
      symbol:   q.symbol,
      name:     q.longname || q.shortname || q.symbol,
      exchange: q.exchange || null,
      type:     q.quoteType || 'EQUITY',
    }));
  } catch (err) {
    throw new Error(`Yahoo search "${query}": ${err.message}`);
  }
}

module.exports = {
  getQuote, getBatchQuotes, normalizeQuote,
  getCompanyProfile, getDividends,
  getHistoricalPrice, searchStock,
};
