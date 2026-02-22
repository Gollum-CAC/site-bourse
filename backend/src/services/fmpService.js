// Service pour appeler l'API Financial Modeling Prep (avec cache et rate limiting)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const cache = require('./cacheService');

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const API_KEY = process.env.FMP_API_KEY;
console.log(`[FMP] API Key chargée: ${API_KEY ? API_KEY.substring(0, 6) + '...' : 'MANQUANTE !'}`);

// Rate limiter : max 5 requêtes par minute (plan gratuit FMP)
let requestQueue = [];
let requestTimes = [];
const MAX_REQUESTS_PER_MINUTE = 4; // un peu sous la limite pour être safe

async function rateLimitedFetch(url) {
  // Nettoyer les timestamps > 60s
  const now = Date.now();
  requestTimes = requestTimes.filter(t => now - t < 60000);

  // Si on a atteint la limite, attendre
  if (requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
    const oldestRequest = requestTimes[0];
    const waitTime = 60000 - (now - oldestRequest) + 500; // +500ms de marge
    console.log(`[FMP] Rate limit atteint, attente ${(waitTime / 1000).toFixed(1)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    // Re-nettoyer après l'attente
    requestTimes = requestTimes.filter(t => Date.now() - t < 60000);
  }

  requestTimes.push(Date.now());
  const response = await fetch(url);
  
  if (response.status === 429) {
    console.log('[FMP] 429 reçu, attente 60s...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    requestTimes = [];
    requestTimes.push(Date.now());
    return fetch(url);
  }
  
  return response;
}

// Fonction helper pour les appels FMP avec cache
async function fmpFetch(endpoint, cacheKey, ttl = cache.DEFAULT_TTL) {
  return cache.getOrFetch(cacheKey, async () => {
    const url = `${FMP_BASE_URL}/${endpoint}&apikey=${API_KEY}`;
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[FMP] Erreur ${response.status}:`, text.substring(0, 200));
      throw new Error(`Erreur FMP: ${response.status}`);
    }
    return response.json();
  }, ttl);
}

// === ENDPOINTS ===

async function getQuote(symbol) {
  return fmpFetch(`quote?symbol=${symbol}`, `quote:${symbol}`, 300); // 5 min cache
}

async function searchStock(query, exchange = '') {
  let endpoint = `search?query=${query}&limit=15`;
  if (exchange) endpoint += `&exchange=${exchange}`;
  return fmpFetch(endpoint, `search:${query}:${exchange}`, 600); // 10 min cache
}

async function getDividends(symbol) {
  return fmpFetch(`dividends?symbol=${symbol}`, `dividends:${symbol}`, cache.LONG_TTL);
}

async function getCompanyProfile(symbol) {
  return fmpFetch(`profile?symbol=${symbol}`, `profile:${symbol}`, cache.LONG_TTL);
}

async function getHistoricalPrice(symbol, from, to) {
  let endpoint = `historical-price-eod/full?symbol=${symbol}`;
  if (from) endpoint += `&from=${from}`;
  if (to) endpoint += `&to=${to}`;
  return fmpFetch(endpoint, `history:${symbol}:${from}:${to}`, cache.LONG_TTL);
}

async function getKeyMetrics(symbol) {
  return fmpFetch(`key-metrics?symbol=${symbol}&period=annual&limit=5`, `metrics:${symbol}`, cache.LONG_TTL);
}

async function getRatiosTTM(symbol) {
  return fmpFetch(`ratios-ttm?symbol=${symbol}`, `ratiosTTM:${symbol}`, cache.LONG_TTL);
}

async function getIncomeStatement(symbol, period = 'annual', limit = 5) {
  return fmpFetch(`income-statement?symbol=${symbol}&period=${period}&limit=${limit}`, `income:${symbol}:${period}`, cache.LONG_TTL);
}

async function getBalanceSheet(symbol, period = 'annual', limit = 5) {
  return fmpFetch(`balance-sheet-statement?symbol=${symbol}&period=${period}&limit=${limit}`, `balance:${symbol}:${period}`, cache.LONG_TTL);
}

async function getCashFlow(symbol, period = 'annual', limit = 5) {
  return fmpFetch(`cash-flow-statement?symbol=${symbol}&period=${period}&limit=${limit}`, `cashflow:${symbol}:${period}`, cache.LONG_TTL);
}

async function getStockScreener(exchange = '', limit = 20) {
  let endpoint = `stock-screener?limit=${limit}&isActivelyTrading=true`;
  if (exchange) endpoint += `&exchange=${exchange}`;
  return fmpFetch(endpoint, `screener:${exchange}:${limit}`, cache.LONG_TTL);
}

module.exports = {
  getQuote, searchStock, getDividends, getCompanyProfile,
  getHistoricalPrice, getKeyMetrics, getRatiosTTM,
  getIncomeStatement, getBalanceSheet, getCashFlow,
  getStockScreener
};
