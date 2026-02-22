// Service pour appeler NewsAPI (actualités financières)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const NEWSAPI_BASE_URL = 'https://newsapi.org/v2';
const API_KEY = process.env.NEWSAPI_API_KEY;

// Récupérer les actualités financières
async function getFinanceNews(query = 'bourse OR finance OR stock market', pageSize = 20) {
  const response = await fetch(
    `${NEWSAPI_BASE_URL}/everything?q=${encodeURIComponent(query)}&language=fr&sortBy=publishedAt&pageSize=${pageSize}&apiKey=${API_KEY}`
  );
  if (!response.ok) throw new Error(`Erreur NewsAPI: ${response.status}`);
  return response.json();
}

// Récupérer les gros titres business
async function getTopHeadlines(country = 'fr') {
  const response = await fetch(
    `${NEWSAPI_BASE_URL}/top-headlines?country=${country}&category=business&pageSize=10&apiKey=${API_KEY}`
  );
  if (!response.ok) throw new Error(`Erreur NewsAPI: ${response.status}`);
  return response.json();
}

module.exports = { getFinanceNews, getTopHeadlines };
