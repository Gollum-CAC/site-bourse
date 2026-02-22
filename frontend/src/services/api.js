// Service pour communiquer avec notre backend API
const API_BASE = 'http://localhost:3001/api';

// --- ACTIONS / BOURSE ---

// Récupérer le cours d'une action
export async function getQuote(symbol) {
  const response = await fetch(`${API_BASE}/actions/quote/${symbol}`);
  if (!response.ok) throw new Error('Erreur lors de la récupération du cours');
  return response.json();
}

// Rechercher une action
export async function searchStock(query) {
  const response = await fetch(`${API_BASE}/actions/search?q=${query}`);
  if (!response.ok) throw new Error('Erreur lors de la recherche');
  return response.json();
}

// Récupérer les dividendes
export async function getDividends(symbol) {
  const response = await fetch(`${API_BASE}/actions/dividendes/${symbol}`);
  if (!response.ok) throw new Error('Erreur lors de la récupération des dividendes');
  return response.json();
}

// Récupérer le profil d'une entreprise
export async function getCompanyProfile(symbol) {
  const response = await fetch(`${API_BASE}/actions/profil/${symbol}`);
  if (!response.ok) throw new Error('Erreur lors de la récupération du profil');
  return response.json();
}

// --- CRYPTOMONNAIES ---

// Récupérer les principales cryptos
export async function getCryptos(limit = 20) {
  const response = await fetch(`${API_BASE}/cryptos?limit=${limit}`);
  if (!response.ok) throw new Error('Erreur lors de la récupération des cryptos');
  return response.json();
}

// --- ACTUALITÉS ---

// Récupérer les actualités financières
export async function getNews() {
  const response = await fetch(`${API_BASE}/news`);
  if (!response.ok) throw new Error('Erreur lors de la récupération des actualités');
  return response.json();
}

// Récupérer les gros titres
export async function getHeadlines() {
  const response = await fetch(`${API_BASE}/news/headlines`);
  if (!response.ok) throw new Error('Erreur lors de la récupération des titres');
  return response.json();
}
