// Service pour communiquer avec notre backend API
// En local : appel direct localhost:3001
// En réseau/ngrok : les requêtes /api passent par le proxy Vite
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocal ? 'http://localhost:3001/api' : '/api';

// ==========================================
// === ACTIONS — DONNÉES DE BASE ===
// ==========================================

export async function getQuote(symbol) {
  const response = await fetch(`${API_BASE}/actions/quote/${symbol}`);
  if (!response.ok) throw new Error('Erreur lors de la récupération du cours');
  return response.json();
}

export async function searchStock(query, exchange = '') {
  let url = `${API_BASE}/actions/search?q=${query}`;
  if (exchange) url += `&exchange=${exchange}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erreur lors de la recherche');
  return response.json();
}

export async function getCompanyProfile(symbol) {
  const response = await fetch(`${API_BASE}/actions/profil/${symbol}`);
  if (!response.ok) throw new Error('Erreur lors de la récupération du profil');
  return response.json();
}

export async function getHistoricalPrice(symbol, from, to) {
  let url = `${API_BASE}/actions/historique/${symbol}`;
  const params = [];
  if (from) params.push(`from=${from}`);
  if (to) params.push(`to=${to}`);
  if (params.length) url += `?${params.join('&')}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erreur lors de la récupération de l\'historique');
  return response.json();
}

export async function getStockScreener(exchange = '', limit = 20) {
  const response = await fetch(`${API_BASE}/actions/screener?exchange=${exchange}&limit=${limit}`);
  if (!response.ok) throw new Error('Erreur screener');
  return response.json();
}

// ==========================================
// === ACTIONS — RATIOS ===
// ==========================================

export async function getKeyMetrics(symbol) {
  const response = await fetch(`${API_BASE}/actions/ratios/${symbol}`);
  if (!response.ok) throw new Error('Erreur ratios');
  return response.json();
}

export async function getRatiosTTM(symbol) {
  const response = await fetch(`${API_BASE}/actions/ratios-ttm/${symbol}`);
  if (!response.ok) throw new Error('Erreur ratios TTM');
  return response.json();
}

// ==========================================
// === ACTIONS — ÉTATS FINANCIERS ===
// ==========================================

export async function getIncomeStatement(symbol, period = 'annual') {
  const response = await fetch(`${API_BASE}/actions/income/${symbol}?period=${period}`);
  if (!response.ok) throw new Error('Erreur compte de résultat');
  return response.json();
}

export async function getBalanceSheet(symbol, period = 'annual') {
  const response = await fetch(`${API_BASE}/actions/bilan/${symbol}?period=${period}`);
  if (!response.ok) throw new Error('Erreur bilan');
  return response.json();
}

export async function getCashFlow(symbol, period = 'annual') {
  const response = await fetch(`${API_BASE}/actions/cashflow/${symbol}?period=${period}`);
  if (!response.ok) throw new Error('Erreur cash flow');
  return response.json();
}

// ==========================================
// === ACTIONS — DIVIDENDES & CALENDRIER ===
// ==========================================

export async function getDividends(symbol) {
  const response = await fetch(`${API_BASE}/actions/dividendes/${symbol}`);
  if (!response.ok) throw new Error('Erreur dividendes');
  return response.json();
}

export async function getDividendCalendar(from, to) {
  let url = `${API_BASE}/actions/calendrier-dividendes?`;
  if (from) url += `from=${from}&`;
  if (to) url += `to=${to}&`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erreur calendrier dividendes');
  return response.json();
}

// ==========================================
// === ACTIONS — RÉSULTATS / EARNINGS ===
// ==========================================

// Historique des résultats (EPS réel vs estimé)
export async function getEarnings(symbol) {
  const response = await fetch(`${API_BASE}/actions/earnings/${symbol}`);
  if (!response.ok) throw new Error('Erreur earnings');
  return response.json();
}

// Calendrier des résultats à venir
export async function getEarningsCalendar(from, to) {
  let url = `${API_BASE}/actions/calendrier-earnings?`;
  if (from) url += `from=${from}&`;
  if (to) url += `to=${to}&`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erreur calendrier earnings');
  return response.json();
}

// Résultats confirmés
export async function getEarningsConfirmed(from, to) {
  let url = `${API_BASE}/actions/earnings-confirmes?`;
  if (from) url += `from=${from}&`;
  if (to) url += `to=${to}&`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Erreur earnings confirmés');
  return response.json();
}

// ==========================================
// === ACTIONS — CONSENSUS ANALYSTES ===
// ==========================================

// Estimations analystes (revenus + EPS attendus)
export async function getAnalystConsensus(symbol) {
  const response = await fetch(`${API_BASE}/actions/consensus/${symbol}`);
  if (!response.ok) throw new Error('Erreur consensus');
  return response.json();
}

// Objectifs de prix individuels
export async function getPriceTarget(symbol) {
  const response = await fetch(`${API_BASE}/actions/objectif-prix/${symbol}`);
  if (!response.ok) throw new Error('Erreur objectif prix');
  return response.json();
}

// Consensus résumé (buy/hold/sell + prix moyen/haut/bas)
export async function getPriceTargetConsensus(symbol) {
  const response = await fetch(`${API_BASE}/actions/objectif-consensus/${symbol}`);
  if (!response.ok) throw new Error('Erreur consensus objectif');
  return response.json();
}

// Notes analystes (upgrades/downgrades)
export async function getAnalystGrades(symbol) {
  const response = await fetch(`${API_BASE}/actions/grades/${symbol}`);
  if (!response.ok) throw new Error('Erreur grades');
  return response.json();
}

// ==========================================
// === ACTIONS — INSIDER TRADING ===
// ==========================================

// Transactions des dirigeants
export async function getInsiderTrading(symbol) {
  const response = await fetch(`${API_BASE}/actions/insider/${symbol}`);
  if (!response.ok) throw new Error('Erreur insider');
  return response.json();
}

// Détenteurs institutionnels
export async function getInstitutionalHolders(symbol) {
  const response = await fetch(`${API_BASE}/actions/institutionnels/${symbol}`);
  if (!response.ok) throw new Error('Erreur institutionnels');
  return response.json();
}

// ==========================================
// === ACTIONS — ACTUALITÉS SPÉCIFIQUES ===
// ==========================================

// Actus liées à une action
export async function getStockNews(symbol, limit = 20) {
  const response = await fetch(`${API_BASE}/actions/news/${symbol}?limit=${limit}`);
  if (!response.ok) throw new Error('Erreur stock news');
  return response.json();
}

// Actus financières générales (via FMP)
export async function getFmpNews(limit = 30) {
  const response = await fetch(`${API_BASE}/actions/news-generales?limit=${limit}`);
  if (!response.ok) throw new Error('Erreur FMP news');
  return response.json();
}

// Communiqués de presse d'une entreprise
export async function getPressReleases(symbol, limit = 10) {
  const response = await fetch(`${API_BASE}/actions/communiques/${symbol}?limit=${limit}`);
  if (!response.ok) throw new Error('Erreur communiqués');
  return response.json();
}

// ==========================================
// === SUPER DIVIDENDES ===
// ==========================================

export async function getSuperDividendes() {
  const response = await fetch(`${API_BASE}/dividendes/super`);
  if (!response.ok) throw new Error('Erreur super dividendes');
  return response.json();
}

// ==========================================
// === CRYPTOMONNAIES ===
// ==========================================

export async function getCryptos(limit = 20) {
  const response = await fetch(`${API_BASE}/cryptos?limit=${limit}`);
  if (!response.ok) throw new Error('Erreur cryptos');
  return response.json();
}

export async function getCryptoDetail(id) {
  const response = await fetch(`${API_BASE}/cryptos/${id}`);
  if (!response.ok) throw new Error('Erreur détail crypto');
  return response.json();
}

// ==========================================
// === ACTUALITÉS (NewsAPI) ===
// ==========================================

export async function getNews() {
  const response = await fetch(`${API_BASE}/news`);
  if (!response.ok) throw new Error('Erreur actualités');
  return response.json();
}

export async function getHeadlines() {
  const response = await fetch(`${API_BASE}/news/headlines`);
  if (!response.ok) throw new Error('Erreur titres');
  return response.json();
}
