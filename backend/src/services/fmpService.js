// Service pour appeler l'API Financial Modeling Prep (endpoints stables)
require('dotenv').config({ path: '../../.env' });

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';
const API_KEY = process.env.FMP_API_KEY;

// Récupérer le cours d'une action (ex: AAPL, MC.PA)
async function getQuote(symbol) {
  const response = await fetch(`${FMP_BASE_URL}/quote?symbol=${symbol}&apikey=${API_KEY}`);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Rechercher une action par nom ou symbole, avec filtre exchange optionnel
async function searchStock(query, exchange = '') {
  let url = `${FMP_BASE_URL}/search?query=${query}&limit=15&apikey=${API_KEY}`;
  if (exchange) url += `&exchange=${exchange}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Récupérer l'historique des dividendes
async function getDividends(symbol) {
  const response = await fetch(`${FMP_BASE_URL}/dividends?symbol=${symbol}&apikey=${API_KEY}`);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Récupérer le profil d'une entreprise
async function getCompanyProfile(symbol) {
  const response = await fetch(`${FMP_BASE_URL}/profile?symbol=${symbol}&apikey=${API_KEY}`);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Récupérer l'historique des prix (cours journaliers)
async function getHistoricalPrice(symbol, from, to) {
  let url = `${FMP_BASE_URL}/historical-price-eod/full?symbol=${symbol}&apikey=${API_KEY}`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Récupérer les ratios financiers clés (annuels)
async function getKeyMetrics(symbol) {
  const response = await fetch(`${FMP_BASE_URL}/key-metrics?symbol=${symbol}&period=annual&limit=5&apikey=${API_KEY}`);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Récupérer les ratios financiers TTM
async function getRatiosTTM(symbol) {
  const response = await fetch(`${FMP_BASE_URL}/ratios-ttm?symbol=${symbol}&apikey=${API_KEY}`);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Récupérer le compte de résultat (income statement)
async function getIncomeStatement(symbol, period = 'annual', limit = 5) {
  const response = await fetch(`${FMP_BASE_URL}/income-statement?symbol=${symbol}&period=${period}&limit=${limit}&apikey=${API_KEY}`);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Récupérer le bilan comptable (balance sheet)
async function getBalanceSheet(symbol, period = 'annual', limit = 5) {
  const response = await fetch(`${FMP_BASE_URL}/balance-sheet-statement?symbol=${symbol}&period=${period}&limit=${limit}&apikey=${API_KEY}`);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Récupérer le flux de trésorerie (cash flow)
async function getCashFlow(symbol, period = 'annual', limit = 5) {
  const response = await fetch(`${FMP_BASE_URL}/cash-flow-statement?symbol=${symbol}&period=${period}&limit=${limit}&apikey=${API_KEY}`);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

// Screener : liste d'actions par exchange, triées par capitalisation
async function getStockScreener(exchange = '', limit = 20) {
  let url = `${FMP_BASE_URL}/stock-screener?limit=${limit}&apikey=${API_KEY}`;
  if (exchange) url += `&exchange=${exchange}`;
  url += '&isActivelyTrading=true';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erreur FMP: ${response.status}`);
  return response.json();
}

module.exports = {
  getQuote, searchStock, getDividends, getCompanyProfile,
  getHistoricalPrice, getKeyMetrics, getRatiosTTM,
  getIncomeStatement, getBalanceSheet, getCashFlow,
  getStockScreener
};
