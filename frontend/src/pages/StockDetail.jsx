// Stock Detail — Plan FMP GRATUIT
// Onglets disponibles : Chart, Dividends, Profile
// Supprimés : Ratios (TTM), Financials (income/bilan/cashflow)
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getQuote, getCompanyProfile, getDividends, getHistoricalPrice } from '../services/api';
import PriceChart from '../components/PriceChart';

const TF_DAYS = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 1825 };

function StockDetail() {
  const { symbol } = useParams();
  const navigate   = useNavigate();
  const [quote, setQuote]         = useState(null);
  const [profile, setProfile]     = useState(null);
  const [dividends, setDividends] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [timeframe, setTimeframe] = useState('3M');
  const [inWatchlist, setInWatchlist] = useState(false);
  const [activeTab, setActiveTab] = useState('chart');

  useEffect(() => { loadData(); checkWatchlist(); }, [symbol]);
  useEffect(() => { loadChartData(); }, [symbol, timeframe]);

  function checkWatchlist() {
    const wl = JSON.parse(localStorage.getItem('watchlist') || '[]');
    setInWatchlist(wl.includes(symbol.toUpperCase()));
  }

  function toggleWatchlist() {
    const wl  = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const sym = symbol.toUpperCase();
    const updated = wl.includes(sym) ? wl.filter(s => s !== sym) : [...wl, sym];
    localStorage.setItem('watchlist', JSON.stringify(updated));
    setInWatchlist(updated.includes(sym));
  }

  async function loadData() {
    setLoading(true);
    const [q, p, d] = await Promise.allSettled([
      getQuote(symbol), getCompanyProfile(symbol), getDividends(symbol),
    ]);
    setQuote(q.status === 'fulfilled' ? (q.value?.[0] ?? null) : null);
    setProfile(p.status === 'fulfilled' ? (p.value?.[0] ?? null) : null);
    if (d.status === 'fulfilled') {
      const dv = d.value;
      setDividends(Array.isArray(dv) ? dv.slice(0, 20) : dv?.historical?.slice(0, 20) || []);
    }
    setLoading(false);
  }

  async function loadChartData() {
    try {
      const to   = new Date().toISOString().split('T')[0];
      const from = new Date();
      from.setDate(from.getDate() - (TF_DAYS[timeframe] || 90));
      const data = await getHistoricalPrice(symbol, from.toISOString().split('T')[0], to);
      setChartData(Array.isArray(data) ? data : data?.historical || []);
    } catch { setChartData([]); }
  }

  function fmt(v, d = 2) { if (v == null || isNaN(v)) return '—'; return Number(v).toFixed(d); }
  function fmtAmt(v) {
    if (v == null || isNaN(v)) return '—';
    const n = Number(v);
    if (Math.abs(n) >= 1e12) return (n/1e12).toFixed(2)+' T';
    if (Math.abs(n) >= 1e9)  return (n/1e9).toFixed(2)+' B';
    if (Math.abs(n) >= 1e6)  return (n/1e6).toFixed(1)+' M';
    return n.toLocaleString('en-US');
  }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:300, gap:12, color:'var(--text-muted)' }}>
      <span style={{ fontSize:'1.4rem' }}>⏳</span>
      <span>Loading {symbol}…</span>
    </div>
  );

  if (!quote) return (
    <div style={{ textAlign:'center', padding:60, color:'var(--red-light)' }}>
      <div style={{ fontSize:'2rem', marginBottom:12 }}>⚠️</div>
      <p>Unable to load data for <strong>{symbol}</strong></p>
      <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:8 }}>
        This symbol may not be available on the free FMP plan (87 US symbols supported).
      </p>
      <Link to="/" style={{ color:'var(--blue-light)', marginTop:16, display:'inline-block' }}>← Back to home</Link>
    </div>
  );

  const isPositive = (quote.change ?? 0) >= 0;
  const pct        = quote.changesPercentage ?? quote.changePercentage ?? 0;

  const kpis = [
    { label: 'Open',     value: quote.open      ? `$${Number(quote.open).toFixed(2)}`      : '—' },
    { label: '52w High', value: quote.yearHigh  ? `$${Number(quote.yearHigh).toFixed(2)}`  : '—' },
    { label: '52w Low',  value: quote.yearLow   ? `$${Number(quote.yearLow).toFixed(2)}`   : '—' },
    { label: '50d Avg',  value: quote.priceAvg50  ? `$${Number(quote.priceAvg50).toFixed(2)}`  : '—' },
    { label: '200d Avg', value: quote.priceAvg200 ? `$${Number(quote.priceAvg200).toFixed(2)}` : '—' },
    { label: 'P/E',      value: quote.pe ? Number(quote.pe).toFixed(1) : '—' },
    { label: 'Mkt Cap',  value: `$${fmtAmt(quote.marketCap)}` },
    { label: 'Volume',   value: quote.volume ? `${(quote.volume/1e6).toFixed(1)} M` : '—' },
  ];

  const TABS = [
    { key: 'chart',     label: '📈 Chart' },
    { key: 'dividends', label: '💰 Dividends' },
    { key: 'profile',   label: '🏢 Profile' },
  ];

  return (
    <div className="stock-detail-page">

      <div className="detail-top-bar">
        <Link to="/" className="back-link">← <span className="back-link-text">Home</span></Link>
        <div style={{ display:'flex', gap:8 }}>
          <button className="compare-btn" onClick={() => navigate(`/comparateur?symbols=${symbol}`)} title="Compare">
            ⚖️ <span className="back-link-text">Compare</span>
          </button>
          <button className={`watchlist-btn ${inWatchlist ? 'active' : ''}`} onClick={toggleWatchlist}>
            {inWatchlist ? '★ Watchlist' : '☆ Add'}
          </button>
        </div>
      </div>

      <div className="detail-header">
        <div className="detail-header-left">
          {profile?.image ? (
            <img src={profile.image} alt={symbol} className="detail-logo"
                 onError={e => { e.target.style.display='none'; }} />
          ) : (
            <div className="detail-logo-placeholder">{symbol?.slice(0,2)}</div>
          )}
          <div>
            <h1>
              <span style={{ fontFamily:'var(--font-mono)' }}>{symbol}</span>
              <span className="detail-name"> — {quote.name}</span>
            </h1>
            {profile && (
              <span className="detail-sector">
                {[profile.sector, profile.exchange || 'NASDAQ', profile.country].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        </div>

        <div className="detail-price-block">
          <span className="detail-price">
            {Number(quote.price).toFixed(2)}
            <small style={{ fontSize:'1rem', color:'var(--text-muted)', marginLeft:6 }}>$</small>
          </span>
          <div className={`detail-change ${isPositive ? 'pos' : 'neg'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(quote.change || 0).toFixed(2)} $
            <span className={`detail-change-badge ${isPositive ? 'pos' : 'neg'}`}>
              {isPositive ? '+' : ''}{Number(pct).toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="detail-kpi-row">
          {kpis.map((k, i) => (
            <div key={i} className="kpi-chip">
              <span className="kpi-chip-label">{k.label}</span>
              <span className="kpi-chip-value">{k.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="detail-tabs">
        {TABS.map(t => (
          <button key={t.key} className={activeTab === t.key ? 'tab-active' : ''} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* CHART */}
      {activeTab === 'chart' && (
        <div className="detail-card">
          <PriceChart data={chartData} symbol={symbol} currency="$" onTimeframeChange={setTimeframe} />
          <div className="market-data-grid" style={{ marginTop:20 }}>
            {[
              ['Open',      `$${fmt(quote.open)}`],
              ['Day High',  `$${fmt(quote.dayHigh)}`],
              ['Day Low',   `$${fmt(quote.dayLow)}`],
              ['52w High',  `$${fmt(quote.yearHigh)}`],
              ['52w Low',   `$${fmt(quote.yearLow)}`],
              ['Volume',    quote.volume?.toLocaleString('en-US') || '—'],
              ['Market Cap',`$${fmtAmt(quote.marketCap)}`],
              ['EPS',       `$${fmt(quote.eps)}`],
              ['P/E',       fmt(quote.pe)],
            ].map(([label, value]) => (
              <div key={label} className="market-data-item"><span>{label}</span><span>{value}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* DIVIDENDS */}
      {activeTab === 'dividends' && (
        <div className="detail-card">
          <h3>Dividend History</h3>
          {dividends.length > 0 ? (
            <table className="dividends-table">
              <thead>
                <tr><th>Ex-Dividend Date</th><th>Amount</th><th>Payment Date</th></tr>
              </thead>
              <tbody>
                {dividends.map((d, i) => (
                  <tr key={i}>
                    <td>{d.date || d.ex_date || '—'}</td>
                    <td className="dividend-amount">${fmt(d.dividend || d.adjDividend || d.amount, 4)}</td>
                    <td style={{ color:'var(--text-secondary)' }}>{d.paymentDate || d.payment_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color:'var(--text-muted)', padding:'20px 0', textAlign:'center' }}>
              No dividend history found for {symbol}.
            </p>
          )}
        </div>
      )}

      {/* PROFILE */}
      {activeTab === 'profile' && profile && (
        <div className="detail-grid">
          <div className="detail-card">
            <h3>Company Information</h3>
            <div className="detail-rows">
              {[
                ['CEO',       profile.ceo],
                ['Sector',    profile.sector],
                ['Industry',  profile.industry],
                ['Employees', profile.fullTimeEmployees?.toLocaleString('en-US')],
                ['Country',   profile.country],
                ['IPO Date',  profile.ipoDate],
              ].map(([label, value]) => (
                <div key={label} className="detail-row">
                  <span>{label}</span>
                  <span>{value || '—'}</span>
                </div>
              ))}
              <div className="detail-row">
                <span>Website</span>
                {profile.website
                  ? <a href={profile.website} target="_blank" rel="noopener noreferrer" className="profile-link">↗ Visit</a>
                  : <span>—</span>}
              </div>
            </div>
          </div>
          <div className="detail-card">
            <h3>Description</h3>
            <p className="company-description-full">{profile.description || 'No description available.'}</p>
          </div>
        </div>
      )}

      {activeTab === 'profile' && !profile && (
        <div className="detail-card" style={{ textAlign:'center', color:'var(--text-muted)' }}>
          Profile not yet loaded — crawler will fetch it shortly.
        </div>
      )}

    </div>
  );
}

export default StockDetail;
