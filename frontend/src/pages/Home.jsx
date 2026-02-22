// Page d'accueil - Tableau de bord principal
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { getQuote, getCryptos, getNews } from '../services/api';

// Marchés avec listes d'actions par défaut triées par capitalisation
const STOCK_MARKETS = [
  { label: '🇺🇸 US', key: 'us', symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'] },
  { label: '🇫🇷 Paris', key: 'paris', symbols: ['MC.PA', 'OR.PA', 'RMS.PA', 'TTE.PA', 'AI.PA'] },
  { label: '🇳🇱 Amsterdam', key: 'amsterdam', symbols: ['ASML.AS', 'INGA.AS', 'PHIA.AS', 'UNA.AS', 'HEIA.AS'] },
  { label: '🇩🇪 Francfort', key: 'francfort', symbols: ['SAP.DE', 'SIE.DE', 'ALV.DE', 'DTE.DE', 'MBG.DE'] },
  { label: '🇬🇧 Londres', key: 'london', symbols: ['SHEL.L', 'AZN.L', 'HSBA.L', 'ULVR.L', 'BP.L'] },
];

function Home() {
  const [activeMarket, setActiveMarket] = useState('us');
  const [stocks, setStocks] = useState([]);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [cryptos, setCryptos] = useState([]);
  const [news, setNews] = useState(null);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    loadCryptos();
    loadNews();
  }, []);

  useEffect(() => {
    loadStocksForMarket(activeMarket);
  }, [activeMarket]);

  // Auto-refresh toutes les 60s
  useEffect(() => {
    const interval = setInterval(() => {
      loadStocksForMarket(activeMarket);
      loadCryptos();
    }, 60000);
    return () => clearInterval(interval);
  }, [activeMarket]);

  async function loadStocksForMarket(marketKey) {
    setStocksLoading(true);
    setStocks([]);
    const market = STOCK_MARKETS.find(m => m.key === marketKey);
    if (!market) { setStocksLoading(false); return; }
    try {
      // Charger les quotes par petits lots pour éviter le rate limit FMP
      const allData = [];
      const batchSize = 2;
      for (let i = 0; i < market.symbols.length; i += batchSize) {
        const batch = market.symbols.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(symbol => getQuote(symbol))
        );
        results.forEach(r => {
          if (r.status === 'fulfilled' && r.value?.[0]) {
            allData.push(r.value[0]);
          }
        });
        // Mettre à jour progressivement
        setStocks([...allData].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)));
        // Petit délai entre les lots
        if (i + batchSize < market.symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (err) {
      console.error('Erreur chargement actions:', err);
    }
    setStocksLoading(false);
  }

  async function loadCryptos() {
    try { setCryptos(await getCryptos(5)); } catch (err) { console.error(err); }
  }

  async function loadNews() {
    try { setNews(await getNews()); } catch (err) { console.error(err); }
  }

  // Formater la capitalisation
  function fmtCap(val) {
    if (!val) return 'N/A';
    if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + ' Mds';
    if (val >= 1e6) return (val / 1e6).toFixed(0) + ' M';
    return val.toLocaleString('fr-FR');
  }

  // Devise selon le marché
  function getCurrency(marketKey) {
    if (marketKey === 'us') return '$';
    if (marketKey === 'london') return '£';
    return '€';
  }

  const cur = getCurrency(activeMarket);

  return (
    <div className="home-page">
      <SearchBar />

      {error && <p className="error-message">{error}</p>}

      {/* Section Actions par marché */}
      <section className="stocks-section">
        <div className="section-header">
          <h2>📊 Cours des actions</h2>
        </div>

        <div className="stock-market-tabs">
          {STOCK_MARKETS.map(m => (
            <button
              key={m.key}
              className={activeMarket === m.key ? 'market-tab-active' : ''}
              onClick={() => setActiveMarket(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {stocksLoading && stocks.length === 0 ? (
          <p className="loading">Chargement des actions...</p>
        ) : stocks.length === 0 && !stocksLoading ? (
          <p className="no-data">Aucune donnée disponible. Vérifiez que le backend tourne sur localhost:3001.</p>
        ) : (
          <table className="stock-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nom</th>
                <th>Prix ({cur})</th>
                <th>Variation</th>
                <th>Cap. boursière</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock, index) => {
                const isPositive = stock.change >= 0;
                return (
                  <tr key={stock.symbol} onClick={() => navigate(`/action/${stock.symbol}`)} style={{ cursor: 'pointer' }}>
                    <td>{index + 1}</td>
                    <td className="stock-table-name">
                      <strong>{stock.symbol}</strong>
                      <span className="stock-table-fullname">{stock.name}</span>
                    </td>
                    <td>{stock.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {cur}</td>
                    <td style={{ color: isPositive ? '#22c55e' : '#ef4444' }}>
                      {isPositive ? '▲' : '▼'} {(stock.changesPercentage ?? stock.changePercentage ?? 0).toFixed(2)}%
                    </td>
                    <td>{fmtCap(stock.marketCap)} {cur}</td>
                    <td>{stock.volume?.toLocaleString('fr-FR')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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
