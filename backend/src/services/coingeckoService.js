// Service pour appeler l'API CoinGecko (cryptomonnaies)
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const API_KEY = process.env.COINGECKO_API_KEY;

// En-têtes communs avec la clé API
const headers = {
  'accept': 'application/json',
  'x-cg-demo-api-key': API_KEY,
};

// Récupérer les cours des principales cryptos
async function getTopCryptos(limit = 20) {
  const response = await fetch(
    `${COINGECKO_BASE_URL}/coins/markets?vs_currency=eur&order=market_cap_desc&per_page=${limit}&page=1`,
    { headers }
  );
  if (!response.ok) throw new Error(`Erreur CoinGecko: ${response.status}`);
  return response.json();
}

// Récupérer les détails d'une crypto par son id (ex: bitcoin, ethereum)
async function getCryptoDetails(id) {
  const response = await fetch(
    `${COINGECKO_BASE_URL}/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`,
    { headers }
  );
  if (!response.ok) throw new Error(`Erreur CoinGecko: ${response.status}`);
  return response.json();
}

module.exports = { getTopCryptos, getCryptoDetails };
