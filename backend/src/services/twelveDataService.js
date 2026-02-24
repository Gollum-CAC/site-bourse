// Service Twelve Data — Source gratuite pour les actions européennes
// Plan gratuit : 800 appels/jour, 8 appels/minute
// Couvre Euronext Paris (.PA), Amsterdam (.AS), Frankfurt (.DE), London (.L), etc.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const TWELVE_BASE_URL = 'https://api.twelvedata.com';
const API_KEY = process.env.TWELVE_DATA_API_KEY;

// Suffixes des marchés non-US routés vers Twelve Data
const SUFFIXES_EU = [
  '.PA', '.AS', '.BR', '.LS', '.IR', '.DE', '.F', '.L',
  '.MI', '.MC', '.ST', '.CO', '.HE', '.OL', '.T', '.HK',
  '.SS', '.SZ', '.KS', '.AX',
];

// Correspondance suffixe → MIC code pour Twelve Data
const SUFFIX_TO_MIC = {
  '.PA': 'XPAR',  // Euronext Paris
  '.AS': 'XAMS',  // Euronext Amsterdam
  '.BR': 'XBRU',  // Euronext Bruxelles
  '.LS': 'XLIS',  // Euronext Lisbonne
  '.IR': 'XDUB',  // Euronext Dublin
  '.DE': 'XETR',  // Xetra Frankfurt
  '.F':  'XFRA',  // Frankfurt
  '.L':  'XLON',  // London
  '.MI': 'XMIL',  // Milan
  '.MC': 'XMAD',  // Madrid
  '.ST': 'XSTO',  // Stockholm
  '.CO': 'XCSE',  // Copenhague
  '.HE': 'XHEL',  // Helsinki
  '.OL': 'XOSL',  // Oslo
  '.T':  'XTKS',  // Tokyo
  '.HK': 'XHKG',  // Hong Kong
  '.AX': 'XASX',  // ASX Australie
};

/**
 * Vérifie si un symbole doit passer par Twelve Data (non-US)
 */
function estSymboleEU(symbol) {
  return SUFFIXES_EU.some(suffix => symbol.toUpperCase().endsWith(suffix));
}

/**
 * Extrait le ticker sans suffixe et le MIC correspondant
 * Ex: BNP.PA → { ticker: 'BNP', mic: 'XPAR' }
 */
function parseSuffix(symbol) {
  for (const [suffix, mic] of Object.entries(SUFFIX_TO_MIC)) {
    if (symbol.toUpperCase().endsWith(suffix)) {
      return {
        ticker: symbol.slice(0, -suffix.length),
        mic,
        suffix,
      };
    }
  }
  return { ticker: symbol, mic: null, suffix: null };
}

/**
 * Appel générique à l'API Twelve Data
 */
async function twelveFetch(endpoint) {
  if (!API_KEY) throw new Error('TWELVE_DATA_API_KEY manquante dans .env');

  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `${TWELVE_BASE_URL}/${endpoint}${sep}apikey=${API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Twelve Data HTTP ${response.status}`);

  const data = await response.json();

  // Détecter les erreurs API (code 400, 401, 429, etc.)
  if (data.status === 'error' || data.code) {
    throw new Error(`Twelve Data: ${data.message || JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Quote temps réel via Twelve Data — format compatible FMP
 */
async function getQuote(symbol) {
  try {
    const { ticker, mic } = parseSuffix(symbol);

    // Endpoint /quote de Twelve Data
    let endpoint = `quote?symbol=${ticker}`;
    if (mic) endpoint += `&mic_code=${mic}`;

    const data = await twelveFetch(endpoint);

    if (!data.close && !data.price) throw new Error('Pas de prix disponible');

    const price = parseFloat(data.close || data.price || 0);
    const open  = parseFloat(data.open || 0);
    const pct   = parseFloat(data.percent_change || 0);
    const chg   = parseFloat(data.change || 0);

    return [{
      symbol,
      name:              data.name || symbol,
      price,
      open,
      dayHigh:           parseFloat(data.high || 0) || null,
      dayLow:            parseFloat(data.low || 0) || null,
      yearHigh:          parseFloat(data.fifty_two_week?.high || 0) || null,
      yearLow:           parseFloat(data.fifty_two_week?.low || 0) || null,
      change:            chg,
      changesPercentage: pct,
      changePercentage:  pct,
      volume:            parseInt(data.volume || 0) || null,
      avgVolume:         parseInt(data.average_volume || 0) || null,
      marketCap:         null,
      currency:          data.currency || 'EUR',
      exchange:          data.exchange || null,
      _source:           'twelvedata',
    }];
  } catch (err) {
    console.warn(`[TwelveData] ❌ Quote ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Profil entreprise via Twelve Data — format compatible FMP
 */
async function getProfile(symbol) {
  try {
    const { ticker, mic } = parseSuffix(symbol);

    let endpoint = `profile?symbol=${ticker}`;
    if (mic) endpoint += `&mic_code=${mic}`;

    const data = await twelveFetch(endpoint);

    return [{
      symbol,
      companyName:       data.name || symbol,
      name:              data.name || symbol,
      exchange:          data.exchange || null,
      currency:          data.currency || 'EUR',
      country:           data.country || null,
      sector:            data.sector || null,
      industry:          data.industry || null,
      description:       data.description || null,
      website:           data.website || null,
      fullTimeEmployees: data.employees || null,
      ceo:               data.ceo || null,
      image:             data.logo || null,
      isEtf:             data.type === 'ETF',
      isActivelyTrading: true,
      _source:           'twelvedata',
    }];
  } catch (err) {
    console.warn(`[TwelveData] ❌ Profil ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Statistiques / ratios via Twelve Data — format compatible FMP
 */
async function getRatiosTTM(symbol) {
  try {
    const { ticker, mic } = parseSuffix(symbol);

    let endpoint = `statistics?symbol=${ticker}`;
    if (mic) endpoint += `&mic_code=${mic}`;

    const data = await twelveFetch(endpoint);
    const v = data.valuations_metrics || {};
    const f = data.financials || {};
    const d = f.income_statement || {};

    return [{
      peRatioTTM:               parseFloat(v.trailing_pe || 0) || null,
      priceToBookRatioTTM:      parseFloat(v.price_to_book_mrq || 0) || null,
      pegRatioTTM:              parseFloat(v.peg_ratio || 0) || null,
      dividendYieldTTM:         parseFloat(v.forward_annual_dividend_yield || 0) || null,
      dividendYielPercentageTTM: parseFloat(v.forward_annual_dividend_yield || 0) * 100 || null,
      payoutRatioTTM:           parseFloat(v.payout_ratio || 0) || null,
      returnOnEquityTTM:        parseFloat(d.return_on_equity_ttm || 0) || null,
      returnOnAssetsTTM:        parseFloat(d.return_on_assets_ttm || 0) || null,
      grossProfitMarginTTM:     parseFloat(d.gross_profit_margin || 0) || null,
      operatingProfitMarginTTM: parseFloat(d.operating_margin || 0) || null,
      netProfitMarginTTM:       parseFloat(d.net_profit_margin || 0) || null,
      revenueGrowthTTM:         parseFloat(d.revenue_growth || 0) || null,
      _source:                  'twelvedata',
    }];
  } catch (err) {
    console.warn(`[TwelveData] ❌ Ratios ${symbol}:`, err.message);
    throw err;
  }
}

/**
 * Historique des prix via Twelve Data — format compatible FMP
 */
async function getHistoricalPrice(symbol, from, to) {
  try {
    const { ticker, mic } = parseSuffix(symbol);

    let endpoint = `time_series?symbol=${ticker}&interval=1day&outputsize=5000`;
    if (mic)  endpoint += `&mic_code=${mic}`;
    if (from) endpoint += `&start_date=${from}`;
    if (to)   endpoint += `&end_date=${to}`;

    const data = await twelveFetch(endpoint);
    if (!data.values || !Array.isArray(data.values)) return { historical: [] };

    const historical = data.values.map(d => ({
      date:   d.datetime || null,
      open:   parseFloat(d.open) || null,
      high:   parseFloat(d.high) || null,
      low:    parseFloat(d.low) || null,
      close:  parseFloat(d.close) || null,
      volume: parseInt(d.volume) || null,
    })).filter(d => d.date);

    return { historical };
  } catch (err) {
    console.warn(`[TwelveData] ❌ Historique ${symbol}:`, err.message);
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
