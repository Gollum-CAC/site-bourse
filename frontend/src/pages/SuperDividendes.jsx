// Super Dividends — Actions US à rendement élevé (plan FMP gratuit)
// Données calculées localement depuis la DB (0 appel API supplémentaire)
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSuperDividendes } from '../services/api';

function SuperDividendes() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [sortBy, setSortBy]     = useState('score');
  const [filterSector, setFilterSector] = useState('');
  const [minYield, setMinYield] = useState(2);
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, [minYield]);

  async function loadData() {
    setLoading(true); setError('');
    try {
      const result = await getSuperDividendes(`?minYield=${minYield}&sort=${sortBy}`);
      setData(result);
    } catch {
      setError('Unable to load data. The crawler may still be filling the database — please retry in a few minutes.');
    }
    setLoading(false);
  }

  function getSortedStocks() {
    if (!data?.stocks) return [];
    let stocks = [...data.stocks];
    if (filterSector) stocks = stocks.filter(s => s.sector === filterSector);
    switch (sortBy) {
      case 'yield':      return stocks.sort((a,b) => b.currentYield - a.currentYield);
      case 'growth':     return stocks.sort((a,b) => b.growth - a.growth);
      case 'regularity': return stocks.sort((a,b) => b.regularity - a.regularity);
      case 'avgYield':   return stocks.sort((a,b) => b.avgYield - a.avgYield);
      default:           return stocks.sort((a,b) => b.score - a.score);
    }
  }

  function getSectors() {
    if (!data?.stocks) return [];
    return [...new Set(data.stocks.map(s => s.sector).filter(s => s && s !== 'N/A'))].sort();
  }

  function scoreColor(s) {
    if (s >= 70) return '#22c55e';
    if (s >= 50) return '#eab308';
    if (s >= 30) return '#f97316';
    return '#ef4444';
  }

  const sortedStocks = getSortedStocks();

  return (
    <div className="super-div-page">
      <div className="super-div-header">
        <div>
          <h1>💰 Dividend Stocks</h1>
          <p className="page-subtitle">
            US stocks ranked by dividend composite score — data from local DB (FMP free plan).
          </p>
        </div>
        <Link to="/" className="back-link">← Back</Link>
      </div>

      <div className="score-explanation">
        <h3>📊 Score formula</h3>
        <div className="score-criteria">
          <div className="criterion"><span className="criterion-pct">40%</span><span>Current yield</span></div>
          <div className="criterion"><span className="criterion-pct">30%</span><span>Regularity (consecutive years)</span></div>
          <div className="criterion"><span className="criterion-pct">20%</span><span>Dividend growth</span></div>
          <div className="criterion"><span className="criterion-pct">10%</span><span>5-year average yield</span></div>
        </div>
      </div>

      <div className="super-div-controls" style={{ marginBottom: 16 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Min yield:</span>
          {[1, 2, 3, 5].map(v => (
            <button key={v} onClick={() => setMinYield(v)}
              style={{ padding:'4px 12px', borderRadius:6, border:'1px solid var(--border)', cursor:'pointer',
                background: minYield === v ? 'var(--blue-light)' : 'var(--surface)', color: minYield === v ? '#fff' : 'var(--text-primary)' }}>
              ≥ {v}%
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="loading">⏳ Loading data...</p>}
      {error && (
        <div className="error-block">
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={loadData}>🔄 Retry</button>
        </div>
      )}

      {data && !loading && (
        <>
          <div className="super-div-controls">
            <div className="sort-buttons">
              <span>Sort:</span>
              {[
                { key: 'score',      label: '⭐ Score' },
                { key: 'yield',      label: '💰 Yield' },
                { key: 'growth',     label: '📈 Growth' },
                { key: 'regularity', label: '🔄 Regularity' },
                { key: 'avgYield',   label: '📊 Avg. Yield' },
              ].map(s => (
                <button key={s.key} className={sortBy === s.key ? 'sort-active' : ''} onClick={() => setSortBy(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="filter-sector">
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)}>
                <option value="">All sectors</option>
                {getSectors().map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {sortedStocks.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
              <p>No dividend data yet — crawler is collecting data in the background.</p>
              <p style={{ marginTop:8, fontSize:'0.8rem' }}>Day 1: quotes + profiles · Day 2: dividends · Day 3+: scores calculated</p>
              <button onClick={loadData} style={{ marginTop:16, padding:'8px 20px', background:'var(--blue-light)', color:'#fff', border:'none', borderRadius:8, cursor:'pointer' }}>
                🔄 Refresh
              </button>
            </div>
          ) : (
            <>
              <p className="results-count">{sortedStocks.length} stock{sortedStocks.length > 1 ? 's' : ''} · yield ≥ {minYield}%</p>
              <div className="super-div-table-wrapper">
                <table className="super-div-table">
                  <thead>
                    <tr><th>#</th><th>Stock</th><th>Sector</th><th>Price</th><th>Yield</th><th>Avg. Yield</th><th>Div/yr</th><th>Years</th><th>Growth</th><th>Score</th></tr>
                  </thead>
                  <tbody>
                    {sortedStocks.map((s, i) => (
                      <tr key={s.symbol} onClick={() => navigate(`/action/${s.symbol}`)} style={{ cursor:'pointer' }}>
                        <td>{i+1}</td>
                        <td className="stock-table-name">
                          <strong>{s.symbol}</strong>
                          <span className="stock-table-fullname">{s.name}</span>
                        </td>
                        <td className="sector-cell">{s.sector}</td>
                        <td>${s.price?.toFixed(2) || '—'}</td>
                        <td className="yield-cell" style={{ color: s.currentYield >= 5 ? '#4ade80' : s.currentYield >= 3 ? '#22c55e' : '#eab308' }}>
                          {s.currentYield}%
                        </td>
                        <td>{s.avgYield}%</td>
                        <td>${s.latestAnnualDiv}</td>
                        <td>
                          <span className="regularity-badge" style={{
                            background: s.regularity >= 80 ? 'rgba(34,197,94,.2)' : s.regularity >= 60 ? 'rgba(234,179,8,.2)' : 'rgba(239,68,68,.2)',
                            color:      s.regularity >= 80 ? '#22c55e'            : s.regularity >= 60 ? '#eab308'           : '#ef4444',
                          }}>
                            {s.yearsOfDividends}/5 yrs
                          </span>
                        </td>
                        <td>
                          <span style={{ color: s.growth > 0 ? '#22c55e' : s.growth < 0 ? '#ef4444' : '#8b949e' }}>
                            {s.growth > 0 ? '+' : ''}{s.growth}%
                          </span>
                        </td>
                        <td>
                          <span className="score-badge" style={{ background: scoreColor(s.score) }}>{s.score}/100</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="super-div-info">
            {data.crawler?.length > 0 && (
              <p>🕷️ Crawler status: {data.crawler.map(c => `${c.task_name} (${c.status})`).join(' · ')}</p>
            )}
            <p>⚠️ Past dividends do not guarantee future returns. DYOR.</p>
          </div>
        </>
      )}
    </div>
  );
}

export default SuperDividendes;
