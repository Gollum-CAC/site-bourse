// Page d'accueil — Ticker tape, hero stats, tableaux marchés + cryptos + news
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { getBatchQuotes, getCryptos, getNews } from '../services/api';

const STOCK_MARKETS = [
  { label: '🇺🇸 US',          key: 'us',        symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'] },
  { label: '🇫🇷 Paris',        key: 'paris',     symbols: ['MC.PA', 'OR.PA', 'RMS.PA', 'TTE.PA', 'AI.PA'] },
  { label: '🇳🇱 Amsterdam',    key: 'amsterdam', symbols: ['ASML.AS', 'INGA.AS', 'PHIA.AS', 'UNA.AS', 'HEIA.AS'] },
  { label: '🇩🇪 Francfort',    key: 'francfort', symbols: ['SAP.DE', 'SIE.DE', 'ALV.DE', 'DTE.DE', 'MBG.DE'] },
  { label: '🇬🇧 Londres',      key: 'london',    symbols: ['SHEL.L', 'AZN.L', 'HSBA.L', 'ULVR.L', 'BP.L'] },
  { label: '🇯🇵 Tokyo',        key: 'tokyo',     symbols: ['7203.T', '6758.T', '9984.T', '6861.T', '8306.T'] },
  { label: '🇭🇰 Hong Kong',    key: 'hk',        symbols: ['0700.HK', '9988.HK', '1299.HK', '0005.HK', '2318.HK'] },
];

// Symboles du ticker tape en haut de page
const TICKER_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'MC.PA', 'ASML.AS', 'TTE.PA'];

function Home() {
  const [activeMarket, setActiveMarket]         = useState('us');
  const [stocks, setStocks]                     = useState([]);
  const [stocksLoading, setStocksLoading]       = useState(false);
  const [stocksErreur, setStocksErreur]         = useState('');
  const [cryptos, setCryptos]                   = useState([]);
  const [news, setNews]                         = useState(null);
  const [tickerData, setTickerData]             = useState([]);
  const navigate = useNavigate();

  // Chargement initial
  useEffect(() => {
    loadCryptos();
    loadNews();
    loadTicker();
  }, []);

  // Rechargement marché actif
  useEffect(() => { loadStocksForMarket(activeMarket); }, [activeMarket]);

  // Rafraîchissement toutes les 60s
  useEffect(() => {
    const id = setInterval(() => {
      loadStocksForMarket(activeMarket);
      loadCryptos();
    }, 60000);
    return () => clearInterval(id);
  }, [activeMarket]);

  async function loadTicker() {
    try {
      // 1 seul appel FMP pour tous les symboles du ticker
      const data = await getBatchQuotes(TICKER_SYMBOLS);
      setTickerData(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function loadStocksForMarket(marketKey) {
    setStocksLoading(true);
    setStocks([]);
    setStocksErreur('');
    const market = STOCK_MARKETS.find(m => m.key === marketKey);
    if (!market) { setStocksLoading(false); return; }

    // Timeout 12s
    const timeout = setTimeout(() => {
      setStocksLoading(false);
      setStocksErreur('Le backend ne répond pas. Vérifiez que le serveur tourne sur localhost:3001.');
    }, 12000);

    try {
      // 1 seul appel batch pour tout le marché (5 symboles → 1 requête FMP)
      const data = await getBatchQuotes(market.symbols);
      const sorted = (Array.isArray(data) ? data : [])
        .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
      setStocks(sorted);
      clearTimeout(timeout);
    } catch (err) {
      clearTimeout(timeout);
      console.error(err);
      setStocksErreur(`Erreur réseau : ${err.message}`);
    }
    setStocksLoading(false);
  }

  async function loadCryptos() {
    try { setCryptos(await getCryptos(5)); } catch {}
  }

  async function loadNews() {
    try { setNews(await getNews()); } catch {}
  }

  function fmtCap(val) {
    if (!val) return '—';
    if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T';
    if (val >= 1e9)  return (val / 1e9).toFixed(1)  + ' Mds';
    if (val >= 1e6)  return (val / 1e6).toFixed(0)  + ' M';
    return val.toLocaleString('fr-FR');
  }

  function getCurrency(marketKey) {
    if (marketKey === 'us')     return '$';
    if (marketKey === 'london') return '£';
    if (marketKey === 'tokyo')  return '¥';
    if (marketKey === 'hk')     return 'HK$';
    return '€';
  }

  // Stats globales calculées depuis les stocks chargés
  function calcStats() {
    if (stocks.length === 0) return null;
    const variations = stocks.map(s => s.changesPercentage ?? s.changePercentage ?? 0);
    const moyVar = variations.reduce((a, b) => a + b, 0) / variations.length;
    const hausses = variations.filter(v => v >= 0).length;
    return { moyVar, hausses, baisses: variations.length - hausses, total: variations.length };
  }

  const cur = getCurrency(activeMarket);
  const stats = calcStats();

  return (
    <div className="home-page">

      {/* === TICKER TAPE === */}
      {tickerData.length > 0 && (
        <div className="ticker-tape" style={{ margin: '0 -24px 24px', padding: '6px 0' }}>
          <div className="ticker-inner">
            {/* On double la liste pour l'animation sans fin */}
            {[...tickerData, ...tickerData].map((s, i) => {
              const pct = s.changesPercentage ?? s.changePercentage ?? 0;
              const isPos = pct >= 0;
              // Label : vrai nom si dispo, sinon symbole seul
              const label = (s.name && s.name !== s.symbol) ? s.name : s.symbol;
              return (
                <div key={i} className="ticker-item" onClick={() => navigate(`/action/${s.symbol}`)} style={{ cursor: 'pointer' }}>
                  <span className="ticker-symbol">{label}</span>
                  <span className="ticker-price">{s.price?.toFixed(2)}</span>
                  <span className={`ticker-change ${isPos ? 'pos' : 'neg'}`}>
                    {isPos ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === BARRE DE RECHERCHE === */}
      <SearchBar />

      {/* === SECTION ACTIONS === */}
      <section className="stocks-section" style={{ marginBottom: 32 }}>
        <div className="section-header">
          <h2>Cours des actions</h2>
          {stats && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--green-light)', fontWeight: 700 }}>▲ {stats.hausses}</span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ color: 'var(--red-light)', fontWeight: 700 }}>▼ {stats.baisses}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                Moy. {stats.moyVar >= 0 ? '+' : ''}{stats.moyVar.toFixed(2)}%
              </span>
            </div>
          )}
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

        {stocksErreur ? (
          <div className="erreur-backend">
            <span>⚠️ {stocksErreur}</span>
            <button onClick={() => loadStocksForMarket(activeMarket)} className="retry-btn">Réessayer</button>
          </div>
        ) : stocksLoading && stocks.length === 0 ? (
          <p className="loading">⏳ Chargement...</p>
        ) : stocks.length === 0 && !stocksLoading ? (
          <p className="no-data">Aucune donnée disponible.</p>
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
                const pct = stock.changesPercentage ?? stock.changePercentage ?? 0;
                const isPos = pct >= 0;
                return (
                  <tr key={stock.symbol} onClick={() => navigate(`/action/${stock.symbol}`)}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="stock-table-name">
                        <strong>{stock.symbol}</strong>
                        {/* Masquer le nom si identique au symbole (donnée FMP non encore enrichie) */}
                        {stock.name && stock.name !== stock.symbol && (
                          <span className="stock-table-fullname">{stock.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="price-mono" style={{ textAlign: 'right' }}>
                      {stock.price?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={isPos ? 'change-positive' : 'change-negative'} style={{ textAlign: 'right' }}>
                      {isPos ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {fmtCap(stock.marketCap)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {stock.volume?.toLocaleString('fr-FR') || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* === SECTION CRYPTOS === */}
      <section className="crypto-section">
        <div className="section-header">
          <h2>Cryptomonnaies</h2>
          <Link to="/cryptos" className="see-all">Voir tout →</Link>
        </div>
        <table className="crypto-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'right', width: 36 }}>#</th>
              <th>Nom</th>
              <th>Prix (EUR)</th>
              <th>Variation 24h</th>
              <th>Cap. marché</th>
            </tr>
          </thead>
          <tbody>
            {cryptos.map((crypto, index) => {
              const isPos = crypto.price_change_percentage_24h >= 0;
              return (
                <tr key={crypto.id} onClick={() => navigate(`/crypto/${crypto.id}`)}>
                  <td style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700 }}>
                    {index + 1}
                  </td>
                  <td>
                    <div className="crypto-name">
                      <img src={crypto.image} alt={crypto.name} width="26" height="26" />
                      <strong>{crypto.name}</strong>
                      <span className="crypto-symbol">{crypto.symbol?.toUpperCase()}</span>
                    </div>
                  </td>
                  <td className="price-mono">
                    {crypto.current_price?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td className={isPos ? 'change-positive' : 'change-negative'}>
                    {isPos ? '▲' : '▼'} {Math.abs(crypto.price_change_percentage_24h)?.toFixed(2)}%
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {(crypto.market_cap / 1e9)?.toFixed(2)} Mds €
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* === SECTION ACTUALITÉS === */}
      {news?.articles && (
        <section className="news-section">
          <div className="section-header">
            <h2>Actualités</h2>
            <Link to="/news" className="see-all">Voir tout →</Link>
          </div>
          <div className="news-grid">
            {news.articles.slice(0, 4).map((article, index) => (
              <a key={index} href={article.url} target="_blank" rel="noopener noreferrer" className="news-card">
                {article.urlToImage && (
                  <img src={article.urlToImage} alt="" className="news-image" loading="lazy" />
                )}
                <div className="news-content">
                  <h4>{article.title}</h4>
                  <p className="news-source">
                    {article.source?.name} · {new Date(article.publishedAt).toLocaleDateString('fr-FR')}
                  </p>
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
