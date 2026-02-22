// Application principale Site Bourse
import { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import StockCard from './components/StockCard';
import CryptoTable from './components/CryptoTable';
import NewsList from './components/NewsList';
import { getQuote, getCryptos, getNews } from './services/api';
import './App.css';

function App() {
  // États pour les données
  const [stocks, setStocks] = useState([]);
  const [cryptos, setCryptos] = useState([]);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Actions par défaut à afficher au chargement
  const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

  // Charger les données au démarrage
  useEffect(() => {
    loadDefaultStocks();
    loadCryptos();
    loadNews();
  }, []);

  // Charger les actions par défaut
  async function loadDefaultStocks() {
    try {
      const results = await Promise.all(
        defaultSymbols.map(symbol => getQuote(symbol))
      );
      // Chaque appel retourne un tableau, on prend le premier élément
      setStocks(results.map(r => r[0]).filter(Boolean));
    } catch (err) {
      console.error('Erreur chargement actions:', err);
    }
  }

  // Charger les cryptos
  async function loadCryptos() {
    try {
      const data = await getCryptos(10);
      setCryptos(data);
    } catch (err) {
      console.error('Erreur chargement cryptos:', err);
    }
  }

  // Charger les actualités
  async function loadNews() {
    try {
      const data = await getNews();
      setNews(data);
    } catch (err) {
      console.error('Erreur chargement news:', err);
    }
  }

  // Rechercher une action
  async function handleSearch(symbol) {
    setLoading(true);
    setError('');
    try {
      const data = await getQuote(symbol);
      if (data && data.length > 0) {
        // Ajouter en haut de la liste sans doublon
        setStocks(prev => {
          const filtered = prev.filter(s => s.symbol !== data[0].symbol);
          return [data[0], ...filtered];
        });
      } else {
        setError(`Aucun résultat pour "${symbol}"`);
      }
    } catch (err) {
      setError(`Erreur lors de la recherche de "${symbol}"`);
    }
    setLoading(false);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>📈 Site Bourse</h1>
        <p>Cours boursiers • Cryptomonnaies • Actualités financières</p>
      </header>

      <main className="app-main">
        {/* Barre de recherche */}
        <SearchBar onSearch={handleSearch} />

        {error && <p className="error-message">{error}</p>}
        {loading && <p className="loading">Recherche en cours...</p>}

        {/* Section Actions */}
        <section className="stocks-section">
          <h2>📊 Cours des actions</h2>
          <div className="stocks-grid">
            {stocks.map(stock => (
              <StockCard key={stock.symbol} stock={stock} />
            ))}
          </div>
        </section>

        {/* Section Cryptos */}
        <CryptoTable cryptos={cryptos} />

        {/* Section Actualités */}
        <NewsList news={news} />
      </main>

      <footer className="app-footer">
        <p>
          Site Bourse MVP — Données fournies par
          <a href="https://financialmodelingprep.com" target="_blank" rel="noopener noreferrer"> FMP</a>,
          <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer"> CoinGecko</a> et
          <a href="https://newsapi.org" target="_blank" rel="noopener noreferrer"> NewsAPI</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
