// Service pour appeler l'API Financial Modeling Prep (avec cache et rate limiting)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const cache = require('./cacheService');

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const API_KEY = process.env.FMP_API_KEY;
console.log(`[FMP] API Key chargée: ${API_KEY ? API_KEY.substring(0, 6) + '...' : 'MANQUANTE !'}`);

// Rate limiter
let requestTimes = [];
const MAX_REQUESTS_PER_MINUTE = 4;

async function rateLimitedFetch(url) {
  const now = Date.now();
  requestTimes = requestTimes.filter(t => now - t < 60000);

  if (requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = 60000 - (now - requestTimes[0]) + 500;
    console.log(`[FMP] Rate limit, attente ${(waitTime / 1000).toFixed(1)}s...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
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

// Helper : appel FMP avec cache
async function fmpFetch(endpoint, cacheKey, ttl = cache.DEFAULT_TTL) {
  return cache.getOrFetch(cacheKey, async () => {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${FMP_BASE_URL}/${endpoint}${separator}apikey=${API_KEY}`;
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
      const text = await response.text();
      console.error(`[FMP] Erreur ${response.status}:`, text.substring(0, 200));
      throw new Error(`Erreur FMP: ${response.status}`);
    }
    return response.json();
  }, ttl);
}

// ==========================================
// === DONNÉES DE BASE ===
// ==========================================

async function getQuote(symbol) {
  return fmpFetch(`quote?symbol=${symbol}`, `quote:${symbol}`, 300);
}

async function searchStock(query, exchange = '') {
  let endpoint = `search?query=${query}&limit=15`;
  if (exchange) endpoint += `&exchange=${exchange}`;
  return fmpFetch(endpoint, `search:${query}:${exchange}`, 600);
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

async function getStockScreener(exchange = '', limit = 20) {
  let endpoint = `stock-screener?limit=${limit}&isActivelyTrading=true`;
  if (exchange) endpoint += `&exchange=${exchange}`;
  return fmpFetch(endpoint, `screener:${exchange}:${limit}`, cache.LONG_TTL);
}

// ==========================================
// === RATIOS & MÉTRIQUES ===
// ==========================================

async function getKeyMetrics(symbol) {
  return fmpFetch(`key-metrics?symbol=${symbol}&period=annual&limit=5`, `metrics:${symbol}`, cache.LONG_TTL);
}

async function getRatiosTTM(symbol) {
  return fmpFetch(`ratios-ttm?symbol=${symbol}`, `ratiosTTM:${symbol}`, cache.LONG_TTL);
}

// ==========================================
// === ÉTATS FINANCIERS ===
// ==========================================

async function getIncomeStatement(symbol, period = 'annual', limit = 5) {
  return fmpFetch(`income-statement?symbol=${symbol}&period=${period}&limit=${limit}`, `income:${symbol}:${period}`, cache.LONG_TTL);
}

async function getBalanceSheet(symbol, period = 'annual', limit = 5) {
  return fmpFetch(`balance-sheet-statement?symbol=${symbol}&period=${period}&limit=${limit}`, `balance:${symbol}:${period}`, cache.LONG_TTL);
}

async function getCashFlow(symbol, period = 'annual', limit = 5) {
  return fmpFetch(`cash-flow-statement?symbol=${symbol}&period=${period}&limit=${limit}`, `cashflow:${symbol}:${period}`, cache.LONG_TTL);
}

// ==========================================
// === DIVIDENDES & CALENDRIER ===
// ==========================================

// Historique complet des dividendes d'une action
async function getDividends(symbol) {
  return fmpFetch(`dividends?symbol=${symbol}`, `dividends:${symbol}`, cache.LONG_TTL);
}

// Calendrier dividendes : prochaines dates ex-dividende (toutes les actions)
async function getDividendCalendar(from, to) {
  let endpoint = `dividends-calendar?`;
  if (from) endpoint += `from=${from}&`;
  if (to) endpoint += `to=${to}&`;
  return fmpFetch(endpoint, `divCalendar:${from}:${to}`, cache.LONG_TTL);
}

// ==========================================
// === RÉSULTATS / EARNINGS ===
// ==========================================

// Historique des résultats (EPS réel vs estimé, surprise)
async function getEarnings(symbol) {
  return fmpFetch(`earnings?symbol=${symbol}`, `earnings:${symbol}`, cache.LONG_TTL);
}

// Calendrier des résultats à venir (toutes les actions)
async function getEarningsCalendar(from, to) {
  let endpoint = `earnings-calendar?`;
  if (from) endpoint += `from=${from}&`;
  if (to) endpoint += `to=${to}&`;
  return fmpFetch(endpoint, `earningsCalendar:${from}:${to}`, cache.LONG_TTL);
}

// Résultats confirmés d'un trimestre (revenus + EPS réel vs estimé)
async function getEarningsConfirmed(from, to) {
  let endpoint = `earnings-confirmed?`;
  if (from) endpoint += `from=${from}&`;
  if (to) endpoint += `to=${to}&`;
  return fmpFetch(endpoint, `earningsConfirmed:${from}:${to}`, cache.LONG_TTL);
}

// ==========================================
// === CONSENSUS ANALYSTES ===
// ==========================================

// Consensus : recommandation buy/sell/hold + objectif de prix
async function getAnalystConsensus(symbol) {
  return fmpFetch(`analyst-estimates?symbol=${symbol}`, `consensus:${symbol}`, cache.LONG_TTL);
}

// Objectif de prix par les analystes
async function getPriceTarget(symbol) {
  return fmpFetch(`price-target?symbol=${symbol}`, `priceTarget:${symbol}`, cache.LONG_TTL);
}

// Consensus résumé (buy/hold/sell count)
async function getPriceTargetConsensus(symbol) {
  return fmpFetch(`price-target-consensus?symbol=${symbol}`, `priceTargetConsensus:${symbol}`, cache.LONG_TTL);
}

// Notation des analystes
async function getAnalystGrades(symbol) {
  return fmpFetch(`grades-consensus?symbol=${symbol}`, `grades:${symbol}`, cache.LONG_TTL);
}

// ==========================================
// === INSIDER TRADING ===
// ==========================================

// Transactions des insiders (dirigeants, gros actionnaires)
async function getInsiderTrading(symbol) {
  return fmpFetch(`insider-trading?symbol=${symbol}&limit=50`, `insider:${symbol}`, cache.LONG_TTL);
}

// Achats/ventes institutionnels (fonds, banques)
async function getInstitutionalHolders(symbol) {
  return fmpFetch(`institutional-holder?symbol=${symbol}`, `institutional:${symbol}`, cache.LONG_TTL);
}

// ==========================================
// === ACTUALITÉS ===
// ==========================================

// Actualités spécifiques à une action
async function getStockNews(symbol, limit = 20) {
  return fmpFetch(`stock-news?symbol=${symbol}&limit=${limit}`, `stockNews:${symbol}`, 600); // 10 min cache
}

// Actualités générales du marché
async function getGeneralNews(limit = 30) {
  return fmpFetch(`fmp-articles?limit=${limit}`, `generalNews`, 600);
}

// Communiqués de presse d'une entreprise
async function getPressReleases(symbol, limit = 10) {
  return fmpFetch(`press-releases?symbol=${symbol}&limit=${limit}`, `pressReleases:${symbol}`, cache.LONG_TTL);
}

// ==========================================
// === EXPORT ===
// ==========================================

module.exports = {
  // Base
  getQuote, searchStock, getCompanyProfile, getHistoricalPrice, getStockScreener,
  // Ratios
  getKeyMetrics, getRatiosTTM,
  // États financiers
  getIncomeStatement, getBalanceSheet, getCashFlow,
  // Dividendes
  getDividends, getDividendCalendar,
  // Résultats / Earnings
  getEarnings, getEarningsCalendar, getEarningsConfirmed,
  // Consensus analystes
  getAnalystConsensus, getPriceTarget, getPriceTargetConsensus, getAnalystGrades,
  // Insider trading
  getInsiderTrading, getInstitutionalHolders,
  // Actualités
  getStockNews, getGeneralNews, getPressReleases,
};
