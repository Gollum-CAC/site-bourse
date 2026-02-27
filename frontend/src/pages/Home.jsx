// Home page — Ticker tape, cours, cryptos, news
// Marchés : uniquement les 87 symboles FMP gratuits (US + quelques EU cotés Nasdaq)
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { getBatchQuotes, getCryptos, getNews } from '../services/api';

const STOCK_MARKETS = [
  { label: '💻 Tech',       key: 'tech',     symbols: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META'] },
  { label: '💊 Healthcare', key: 'health',   symbols: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK'] },
  { label: '💰 Finance',    key: 'finance',  symbols: ['JPM', 'V', 'MA', 'BAC', 'GS'] },
  { label: '⚡ Energy',     key: 'energy',   symbols: ['XOM', 'CVX', 'COP', 'SLB', 'PSX'] },
  { label: '🛒 Consumer',   key: 'consumer', symbols: ['WMT', 'PG', 'KO', 'PEP', 'MCD'] },
  { label: '✈️ Industrials',key: 'indus',    symbols: ['CAT', 'HON', 'GE', 'UPS', 'BA'] },
];

const TICKER_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'V', 'XOM'];

function Home() {
  const [activeMarket, setActiveMarket]   = useState('tech');
  const [stocks, setStocks]               = useState([]);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksError, setStocksError]     = useState('');
  const [cryptos, setCryptos]             = useState([]);
  const [news, setNews]                   = useState(null);
  const [tickerData, setTickerData]       = useState([]);
  const navigate = useNavigate();

  useEffect(() => { loadCryptos(); loadNews(); loadTicker(); }, []);
  useEffect(() => { loadStocksForMarket(activeMarket); }, [activeMarket]);
  useEffect(() => {
    const id = setInterval(() => { loadStocksForMarket(activeMarket); loadCryptos(); }, 60000);
    return () => clearInterval(id);
  }, [activeMarket]);

  async function loadTicker() {
    try { setTickerData(await getBatchQuotes(TICKER_SYMBOLS)); } catch {}
  }

  async function loadStocksForMarket(key) {
    setStocksLoading(true); setStocks([]); setStocksError('');
    const market = STOCK_MARKETS.find(m => m.key === key);
    if (!market) { setStocksLoading(false); return; }
    const timer = setTimeout(() => {
      setStocksLoading(false);
      setStocksError('Backend not responding — make sure the server is running on port 3001.');
    }, 12000);
    try {
      const data = await getBatchQuotes(market.symbols);
      setStocks(Array.isArray(data) ? data.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)) : []);
      clearTimeout(timer);
    } catch (err) { clearTimeout(timer); setStocksError(`Error: ${err.message}`); }
    setStocksLoading(false);
  }

  async function loadCryptos() { try { setCryptos(await getCryptos(5)); } catch {} }
  async function loadNews()    { try { setNews(await getNews()); } catch {} }

  function fmtCap(v) {
    if (!v) return '—';
    if (v >= 1e12) return (v / 1e12).toFixed(2) + ' T';
    if (v >= 1e9)  return (v / 1e9).toFixed(1)  + ' B';
    if (v >= 1e6)  return (v / 1e6).toFixed(0)  + ' M';
    return v.toLocaleString('en-US');
  }

  function calcStats() {
    if (!stocks.length) return null;
    const changes = stocks.map(s => s.changesPercentage ?? 0);
    return { avg: changes.reduce((a,b) => a+b,0)/changes.length, up: changes.filter(v=>v>=0).length, down: changes.filter(v=>v<0).length };
  }

  const stats = calcStats();

  return (
    <div className="home-page">

      {/* TICKER TAPE */}
      {tickerData.length > 0 && (
        <div className="ticker-tape" style={{ margin: '0 -24px 24px', padding: '6px 0' }}>
          <div className="ticker-inner">
            {[...tickerData, ...tickerData].map((s, i) => {
              const pct = s.changesPercentage ?? 0;
              const pos = pct >= 0;
              return (
                <div key={i} className="ticker-item" onClick={() => navigate(`/action/${s.symbol}`)} style={{ cursor: 'pointer' }}>
                  <span className="ticker-symbol">{s.symbol}</span>
                  <span className="ticker-price">{s.price?.toFixed(2)}</span>
                  <span className={`ticker-change ${pos ? 'pos' : 'neg'}`}>{pos ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <SearchBar />

      {/* STOCKS */}
      <section className="stocks-section" style={{ marginBottom: 32 }}>
        <div className="section-header">
          <h2>Stock Quotes <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 400 }}>US markets · EOD</span></h2>
          {stats && (
            <div style={{ display: 'flex', gap: 8, fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--green-light)', fontWeight: 700 }}>▲ {stats.up}</span>
              <span style={{ color: 'var(--text-muted)' }}>/</span>
              <span style={{ color: 'var(--red-light)', fontWeight: 700 }}>▼ {stats.down}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>Avg. {stats.avg >= 0 ? '+' : ''}{stats.avg.toFixed(2)}%</span>
            </div>
          )}
        </div>

        <div className="stock-market-tabs">
          {STOCK_MARKETS.map(m => (
            <button key={m.key} className={activeMarket === m.key ? 'market-tab-active' : ''} onClick={() => setActiveMarket(m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        {stocksError ? (
          <div className="erreur-backend">
            <span>⚠️ {stocksError}</span>
            <button onClick={() => loadStocksForMarket(activeMarket)} className="retry-btn">Retry</button>
          </div>
        ) : stocksLoading && stocks.length === 0 ? (
          <p className="loading">⏳ Loading...</p>
        ) : stocks.length === 0 && !stocksLoading ? (
          <p className="no-data">No data available — crawler is filling the database.</p>
        ) : (
          <table className="stock-table">
            <thead>
              <tr><th>#</th><th>Name</th><th>Price ($)</th><th>Change</th><th>Market Cap</th><th>Volume</th></tr>
            </thead>
            <tbody>
              {stocks.map((s, i) => {
                const pct = s.changesPercentage ?? 0;
                const pos = pct >= 0;
                return (
                  <tr key={s.symbol} onClick={() => navigate(`/action/${s.symbol}`)}>
                    <td>{i + 1}</td>
                    <td>
                      <div className="stock-table-name">
                        <strong>{s.symbol}</strong>
                        {s.name && s.name !== s.symbol && <span className="stock-table-fullname">{s.name}</span>}
                      </div>
                    </td>
                    <td className="price-mono" style={{ textAlign: 'right' }}>
                      {s.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={pos ? 'change-positive' : 'change-negative'} style={{ textAlign: 'right' }}>
                      {pos ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{fmtCap(s.marketCap)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{s.volume?.toLocaleString('en-US') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* CRYPTOS */}
      <section className="crypto-section">
        <div className="section-header">
          <h2>Cryptocurrencies</h2>
          <Link to="/cryptos" className="see-all">See all →</Link>
        </div>
        <table className="crypto-table">
          <thead>
            <tr><th style={{ textAlign: 'right', width: 36 }}>#</th><th>Name</th><th>Price (EUR)</th><th>24h Change</th><th>Market Cap</th></tr>
          </thead>
          <tbody>
            {cryptos.map((c, i) => {
              const pos = c.price_change_percentage_24h >= 0;
              return (
                <tr key={c.id} onClick={() => navigate(`/crypto/${c.id}`)}>
                  <td style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 700 }}>{i+1}</td>
                  <td>
                    <div className="crypto-name">
                      <img src={c.image} alt={c.name} width="26" height="26" />
                      <strong>{c.name}</strong>
                      <span className="crypto-symbol">{c.symbol?.toUpperCase()}</span>
                    </div>
                  </td>
                  <td className="price-mono">{c.current_price?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}</td>
                  <td className={pos ? 'change-positive' : 'change-negative'}>{pos ? '▲' : '▼'} {Math.abs(c.price_change_percentage_24h)?.toFixed(2)}%</td>
                  <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{(c.market_cap / 1e9)?.toFixed(2)} B €</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* NEWS */}
      {news?.articles && (
        <section className="news-section">
          <div className="section-header">
            <h2>News</h2>
            <Link to="/news" className="see-all">See all →</Link>
          </div>
          <div className="news-grid">
            {news.articles.slice(0, 4).map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="news-card">
                {a.urlToImage && <img src={a.urlToImage} alt="" className="news-image" loading="lazy" />}
                <div className="news-content">
                  <h4>{a.title}</h4>
                  <p className="news-source">{a.source?.name} · {new Date(a.publishedAt).toLocaleDateString('en-US')}</p>
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
