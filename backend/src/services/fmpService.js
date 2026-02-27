// Service Financial Modeling Prep — Plan GRATUIT (250 appels/jour)
// Symboles accessibles : 87 actions (AAPL, TSLA, AMZN + 84 autres US)
// Endpoints disponibles : quote, profile, historical-price-eod, dividends, dividends-calendar, search
// Endpoints NON disponibles (plan payant) : ratios-ttm, income-statement, balance-sheet,
//   cash-flow, earnings, analyst-estimates, insider-trading, institutional-holder, screener complet

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const cache = require('./cacheService');

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const API_KEY = process.env.FMP_API_KEY;
console.log(`[FMP] Clé chargée: ${API_KEY ? API_KEY.substring(0, 6) + '...' : 'MANQUANTE !'}`);

// ============================================================
// === GESTION DU QUOTA JOURNALIER (250 appels/jour) ===
// ============================================================
let quotaDepasse = false;
let quotaResetTime = null;

function signalQuotaDepasse() {
  if (quotaDepasse) return;
  quotaDepasse = true;
  const demain = new Date();
  demain.setDate(demain.getDate() + 1);
  demain.setHours(0, 5, 0, 0);
  quotaResetTime = demain.getTime();
  console.warn(`[FMP] ⚠️ QUOTA DÉPASSÉ — bloqué jusqu'à ${demain.toLocaleTimeString('fr-FR')} demain`);
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
    console.log('[FMP] ✅ Quota réinitialisé (nouveau jour)');
    return false;
  }
  return true;
}

function isQuotaDepasse() { return verifierQuota(); }
function getQuotaInfo() {
  return {
    depasse: verifierQuota(),
    resetTime: quotaResetTime ? new Date(quotaResetTime).toISOString() : null,
  };
}

// ============================================================
// === RATE LIMITER — conservateur pour le plan gratuit ===
// 250/jour = ~10/heure. On laisse 5s entre chaque appel côté crawler.
// Les appels user utilisent le cache, pas de rate limiting strict ici.
// ============================================================
async function rateLimitedFetch(url) {
  if (verifierQuota()) {
    const err = new Error('QUOTA_DEPASSE');
    err.code = 'QUOTA_DEPASSE';
    throw err;
  }
  const response = await fetch(url);

  // Détection 429 (rate limit par minute)
  if (response.status === 429) {
    console.log('[FMP] 429 — attente 60s...');
    await new Promise(r => setTimeout(r, 60000));
    return fetch(url);
  }
  return response;
}

// Helper central : appel FMP + cache + détection quota
async function fmpFetch(endpoint, cacheKey, ttl = cache.DEFAULT_TTL) {
  return cache.getOrFetch(cacheKey, async () => {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${FMP_BASE_URL}/${endpoint}${sep}apikey=${API_KEY}`;

    const response = await rateLimitedFetch(url);

    // Détection quota dépassé
    if ([401, 402, 403].includes(response.status)) {
      const text = await response.text();
      const isQuota = /limit reach|too many|quota|exceeded/i.test(text);
      if (isQuota) {
        signalQuotaDepasse();
        const err = new Error('QUOTA_DEPASSE');
        err.code = 'QUOTA_DEPASSE';
        throw err;
      }
      throw new Error(`FMP ${response.status}: ${text.substring(0, 100)}`);
    }

    if (!response.ok) {
      throw new Error(`FMP ${response.status}`);
    }

    const data = await response.json();

    // Certaines erreurs arrivent en 200 avec un message
    if (data && !Array.isArray(data) && typeof data === 'object') {
      const msg = data['Error Message'] || data.message || '';
      if (/limit reach|limit_reach/i.test(msg)) {
        signalQuotaDepasse();
        const err = new Error('QUOTA_DEPASSE');
        err.code = 'QUOTA_DEPASSE';
        throw err;
      }
    }

    return data;
  }, ttl);
}

// ============================================================
// === ENDPOINTS DISPONIBLES SUR LE PLAN GRATUIT ===
// ============================================================

// --- Quote (cours) — 1 appel pour jusqu'à N symboles en batch ---
async function getQuote(symbol) {
  return fmpFetch(`quote?symbol=${symbol}`, `quote:${symbol}`, 300); // cache 5 min
}

async function getBatchQuotes(symbols) {
  if (!symbols || symbols.length === 0) return [];
  // FMP accepte une liste séparée par des virgules — 1 seul appel !
  const list = symbols.join(',');
  const data = await fmpFetch(`quote?symbol=${list}`, `batchQuote:${list}`, 300);
  return Array.isArray(data) ? data : [];
}

// --- Search ---
async function searchStock(query) {
  return fmpFetch(`search?query=${encodeURIComponent(query)}&limit=15`, `search:${query}`, 600);
}

// --- Profil entreprise ---
async function getCompanyProfile(symbol) {
  return fmpFetch(`profile?symbol=${symbol}`, `profile:${symbol}`, cache.LONG_TTL);
}

// --- Historique des prix (EOD, 5 ans max sur plan gratuit) ---
async function getHistoricalPrice(symbol, from, to) {
  let endpoint = `historical-price-eod/full?symbol=${symbol}`;
  if (from) endpoint += `&from=${from}`;
  if (to)   endpoint += `&to=${to}`;
  return fmpFetch(endpoint, `history:${symbol}:${from}:${to}`, cache.LONG_TTL);
}

// --- Dividendes historiques d'une action ---
async function getDividends(symbol) {
  return fmpFetch(`dividends?symbol=${symbol}`, `dividends:${symbol}`, cache.LONG_TTL);
}

// --- Calendrier dividendes global (disponible sur plan gratuit !) ---
async function getDividendCalendar(from, to) {
  let endpoint = `dividends-calendar?`;
  if (from) endpoint += `from=${from}&`;
  if (to)   endpoint += `to=${to}`;
  return fmpFetch(endpoint, `divCalendar:${from}:${to}`, cache.LONG_TTL);
}

// ============================================================
// === EXPORT ===
// ============================================================
module.exports = {
  // Quota
  isQuotaDepasse, getQuotaInfo, signalQuotaDepasse,
  // Endpoints gratuits
  getQuote, getBatchQuotes,
  searchStock,
  getCompanyProfile,
  getHistoricalPrice,
  getDividends,
  getDividendCalendar,
};
