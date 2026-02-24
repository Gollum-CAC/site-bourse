// Service pour appeler l'API Financial Modeling Prep (avec cache et rate limiting)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const cache = require('./cacheService');

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const API_KEY = process.env.FMP_API_KEY;
console.log(`[FMP] API Key chargée: ${API_KEY ? API_KEY.substring(0, 6) + '...' : 'MANQUANTE !'}`);

// ============================================================
// === GESTION DU QUOTA JOURNALIER FMP ===
// Quand FMP renvoie 401/403 avec 'Limit Reach' ou 'Too many requests',
// on bloque tous les appels jusqu'à minuit (reset quotidien FMP)
// ============================================================
let quotaDepasse = false;
let quotaResetTime = null; // timestamp minuit prochain

function signalQuotaDepasse() {
  if (quotaDepasse) return;
  quotaDepasse = true;
  // Reset à minuit (00:05 pour laisser le temps à FMP de réinitialiser)
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  demain.setHours(0, 5, 0, 0);
  quotaResetTime = demain.getTime();
  console.warn(`[FMP] ⚠️ QUOTA JOURNALIER DÉPASSÉ — appels bloqués jusqu'à ${demain.toLocaleTimeString('fr-FR')} demain`);
  // Signaler au crawler de s'arrêter
  try {
    const { setCrawlerConfig } = require('./crawlerRef');
    setCrawlerConfig({ enabled: false });
  } catch {}
}

function verifierQuota() {
  if (!quotaDepasse) return false;
  if (Date.now() >= quotaResetTime) {
    quotaDepasse = false;
    quotaResetTime = null;
    console.log('[FMP] ✅ Quota réinitialisé (nouveau jour FMP)');
    return false;
  }
  return true;
}

// Export pour que le reste du code puisse vérifier
function isQuotaDepasse() { return verifierQuota(); }
function getQuotaInfo() {
  return {
    depasse: verifierQuota(),
    resetTime: quotaResetTime ? new Date(quotaResetTime).toISOString() : null,
  };
}

// Rate limiter (req/minute)
let requestTimes = [];
const MAX_REQUESTS_PER_MINUTE = 750;

async function rateLimitedFetch(url) {
  // Bloquer si quota journalier dépassé
  if (verifierQuota()) {
    const err = new Error('QUOTA_DEPASSE');
    err.code = 'QUOTA_DEPASSE';
    throw err;
  }

  const now = Date.now();
  requestTimes = requestTimes.filter(t => now - t < 60000);

  if (requestTimes.length >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = 60000 - (now - requestTimes[0]) + 500;
    console.log(`[FMP] Rate limit/min, attente ${(waitTime / 1000).toFixed(1)}s...`);
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

// Helper : appel FMP avec cache + détection quota
async function fmpFetch(endpoint, cacheKey, ttl = cache.DEFAULT_TTL) {
  return cache.getOrFetch(cacheKey, async () => {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${FMP_BASE_URL}/${endpoint}${separator}apikey=${API_KEY}`;

    let response;
    try {
      response = await rateLimitedFetch(url);
    } catch (err) {
      if (err.code === 'QUOTA_DEPASSE') throw err;
      throw err;
    }

    // Détecter le quota dépassé via le statut HTTP ou le contenu
    if (response.status === 401 || response.status === 403 || response.status === 402) {
      const text = await response.text();
      const isQuota = text.includes('Limit Reach') || text.includes('limit reach')
        || text.includes('Too many') || text.includes('quota') || text.includes('exceeded');
      if (isQuota) {
        signalQuotaDepasse();
        const err = new Error('QUOTA_DEPASSE');
        err.code = 'QUOTA_DEPASSE';
        throw err;
      }
      console.error(`[FMP] Erreur ${response.status}:`, text.substring(0, 200));
      throw new Error(`Erreur FMP: ${response.status}`);
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`[FMP] Erreur ${response.status}:`, text.substring(0, 200));
      throw new Error(`Erreur FMP: ${response.status}`);
    }

    const data = await response.json();

    // Certaines APIs FMP renvoient 200 mais avec message d'erreur de quota
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const msg = data['Error Message'] || data.message || '';
      if (typeof msg === 'string' && (msg.includes('Limit Reach') || msg.includes('limit reach'))) {
        signalQuotaDepasse();
        const err = new Error('QUOTA_DEPASSE');
        err.code = 'QUOTA_DEPASSE';
        throw err;
      }
    }

    return data;
  }, ttl);
}

// ==========================================
// === DONNÉES DE BASE ===
// ==========================================

// Routing automatique FMP / Yahoo selon le suffixe du symbole
const yahoo = require('./yahooService');

// Quote simple — Yahoo pour EU, FMP pour US
async function getQuote(symbol) {
  if (yahoo.estSymboleEU(symbol)) {
    console.log(`[Router] 🇪🇺 ${symbol} → Yahoo Finance`);
    return yahoo.getQuote(symbol);
  }
  return fmpFetch(`quote?symbol=${symbol}`, `quote:${symbol}`, 300);
}

// Batch quotes — dispatche chaque symbole vers la bonne source
async function getBatchQuotes(symbols) {
  if (!symbols || symbols.length === 0) return [];
  const usSymbols = symbols.filter(s => !yahoo.estSymboleEU(s));
  const euSymbols = symbols.filter(s => yahoo.estSymboleEU(s));
  const results = [];
  // FMP pour US (1 appel)
  if (usSymbols.length > 0) {
    const list = usSymbols.join(',');
    try {
      const data = await fmpFetch(`quote?symbol=${list}`, `batchQuote:${list}`, 300);
      if (Array.isArray(data)) results.push(...data);
    } catch (e) { console.warn('[FMP] Batch US échoué:', e.message); }
  }
  // Yahoo pour EU (appels individuels, gratuit)
  for (const sym of euSymbols) {
    try {
      const data = await yahoo.getQuote(sym);
      if (Array.isArray(data)) results.push(...data);
    } catch (e) { console.warn(`[Yahoo] Quote ${sym} échouée:`, e.message); }
  }
  return results;
}

async function searchStock(query, exchange = '') {
  let endpoint = `search?query=${query}&limit=15`;
  if (exchange) endpoint += `&exchange=${exchange}`;
  return fmpFetch(endpoint, `search:${query}:${exchange}`, 600);
}

async function getCompanyProfile(symbol) {
  if (yahoo.estSymboleEU(symbol)) return yahoo.getProfile(symbol);
  return fmpFetch(`profile?symbol=${symbol}`, `profile:${symbol}`, cache.LONG_TTL);
}

async function getHistoricalPrice(symbol, from, to) {
  if (yahoo.estSymboleEU(symbol)) return yahoo.getHistoricalPrice(symbol, from, to);
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
  if (yahoo.estSymboleEU(symbol)) return yahoo.getRatiosTTM(symbol);
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
  // Quota
  isQuotaDepasse, getQuotaInfo, signalQuotaDepasse,
  // Base
  getQuote, getBatchQuotes, searchStock, getCompanyProfile, getHistoricalPrice, getStockScreener,
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
