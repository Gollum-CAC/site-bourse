// Service API — Plan FMP GRATUIT
// Endpoints disponibles : quote, batch quotes, search, profile, historical, dividends, dividend-calendar
// Supprimés : ratios-ttm, income, bilan, cashflow, earnings, analystes, insider, institutionnels, news FMP

const hostname = window.location.hostname;
const isLocal  = hostname === 'localhost' || hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:3001/api' : '/api';

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// === QUOTES ===
export const getQuote          = (symbol)  => apiFetch(`${API_BASE}/actions/quote/${symbol}`);
export const getBatchQuotes    = (symbols) => apiFetch(`${API_BASE}/actions/quotes?symbols=${symbols.join(',')}`);
export const getSymbols        = ()        => apiFetch(`${API_BASE}/actions/symbols`);

// === RECHERCHE ===
export const searchStock       = (query)   => apiFetch(`${API_BASE}/actions/search?q=${encodeURIComponent(query)}`);

// === PROFIL ===
export const getCompanyProfile = (symbol)  => apiFetch(`${API_BASE}/actions/profil/${symbol}`);

// === HISTORIQUE (EOD, 5 ans) ===
export function getHistoricalPrice(symbol, from, to) {
  let url = `${API_BASE}/actions/historique/${symbol}`;
  const p = [];
  if (from) p.push(`from=${from}`);
  if (to)   p.push(`to=${to}`);
  if (p.length) url += `?${p.join('&')}`;
  return apiFetch(url);
}

// === DIVIDENDES ===
export const getDividends = (symbol) => apiFetch(`${API_BASE}/actions/dividendes/${symbol}`);

export function getDividendCalendar(from, to) {
  let url = `${API_BASE}/actions/calendrier-dividendes?`;
  if (from) url += `from=${from}&`;
  if (to)   url += `to=${to}`;
  return apiFetch(url);
}

// === SUPER DIVIDENDES (DB locale) ===
export const getSuperDividendes = (params = '') => apiFetch(`${API_BASE}/dividendes/super${params}`);

// === SCREENER (DB locale) ===
export const getScreener = (params) => apiFetch(`${API_BASE}/screener?${params}`);

// === CRYPTOS (CoinGecko — inchangé) ===
export const getCryptos      = (limit = 20) => apiFetch(`${API_BASE}/cryptos?limit=${limit}`);
export const getCryptoDetail = (id)         => apiFetch(`${API_BASE}/cryptos/${id}`);

// === ACTUALITÉS (NewsAPI — inchangé) ===
export const getNews      = () => apiFetch(`${API_BASE}/news`);
export const getHeadlines = () => apiFetch(`${API_BASE}/news/headlines`);

// === INFRA ===
export const getDbStatus = () => apiFetch(`${API_BASE}/db-status`);
export const getQuotaFMP = () => fetch(`${API_BASE}/quota`).then(r => r.json()).catch(() => ({ depasse: false }));
