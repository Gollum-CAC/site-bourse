// Page d'accueil - Tableau de bord principal
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import StockCard from '../components/StockCard';
import { getQuote, getCryptos, getNews } from '../services/api';

function Home() {
  const [stocks, setStocks] = useState([]);
  const [cryptos, setCryptos] = useState([]);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];

  useEffect(() => {
    loadDefaultStocks();
    loadCryptos();
    loadNews();
  }, []);

  async function loadDefaultStocks() {
    try {
      const results = await Promise.all(
        defaultSymbols.map(symbol => getQuote(symbol))
      );
      setStocks(results.map(r => r[0]).filter(Boolean));
    } catch (err) {
      console.error('Erreur chargement actions:', err);
    }
  }

  async function loadCryptos() {
    try {
      const data = await getCryptos(5);
      setCryptos(data);
    } catch (err) {
      console.error('Erreur chargement cryptos:', err);
    }
  }

  async function loadNews() {
    try {
      const data = await getNews();
      setNews(data);
    } catch (err) {
      console.error('Erreur chargement news:', err);
    }
  }

  async function handleSearch(symbol) {
    setLoading(true);
    setError('');
    try {
      const data = await getQuote(symbol);
      if (data && data.length > 0) {
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
    <div className="home-page">
      <SearchBar onSearch={handleSearch} />

      {error && <p className="error-message">{error}</p>}
      {loading && <p className="loading">Recherche en cours...</p>}

      {/* Section Actions */}
      <section className="stocks-section">
        <h2>📊 Cours des actions</h2>
        <div className="stocks-grid">
          {stocks.map(stock => (
            <Link to={`/action/${stock.symbol}`} key={stock.symbol} className="stock-link">
              <StockCard stock={stock} />
            </Link>
          ))}
        </div>
      </section>

      {/* Aperçu Cryptos */}
      <section className="crypto-section">
        <div className="section-header">
          <h2>🪙 Cryptomonnaies</h2>
          <Link to="/cryptos" className="see-all">Voir tout →</Link>
        </div>
        <table className="crypto-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nom</th>
              <th>Prix (EUR)</th>
              <th>Variation 24h</th>
              <th>Cap. marché</th>
            </tr>
          </thead>
          <tbody>
            {cryptos.map((crypto, index) => {
              const isPositive = crypto.price_change_percentage_24h >= 0;
              return (
                <tr key={crypto.id} onClick={() => navigate(`/crypto/${crypto.id}`)} style={{ cursor: 'pointer' }}>
                  <td>{index + 1}</td>
                  <td className="crypto-name">
                    <img src={crypto.image} alt={crypto.name} width="24" height="24" />
                    <strong>{crypto.name}</strong>
                    <span className="crypto-symbol">{crypto.symbol?.toUpperCase()}</span>
                  </td>
                  <td>{crypto.current_price?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                  <td style={{ color: isPositive ? '#22c55e' : '#ef4444' }}>
                    {isPositive ? '▲' : '▼'} {crypto.price_change_percentage_24h?.toFixed(2)}%
                  </td>
                  <td>{(crypto.market_cap / 1e9)?.toFixed(2)} Mds €</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Aperçu News */}
      {news?.articles && (
        <section className="news-section">
          <div className="section-header">
            <h2>📰 Actualités</h2>
            <Link to="/news" className="see-all">Voir tout →</Link>
          </div>
          <div className="news-grid">
            {news.articles.slice(0, 4).map((article, index) => (
              <a key={index} href={article.url} target="_blank" rel="noopener noreferrer" className="news-card">
                {article.urlToImage && <img src={article.urlToImage} alt={article.title} className="news-image" />}
                <div className="news-content">
                  <h4>{article.title}</h4>
                  <p className="news-source">{article.source?.name} • {new Date(article.publishedAt).toLocaleDateString('fr-FR')}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default Home;
