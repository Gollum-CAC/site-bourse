// Screener — Plan FMP GRATUIT
// Lit uniquement la DB locale (87 symboles US)
// Supprimés : exchange Euronext/Tokyo/HK, filtre P/E (pas en DB), source FMP API
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api';

const SECTORS = [
  'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Consumer Defensive', 'Industrials', 'Energy', 'Communication Services',
  'Utilities', 'Real Estate', 'Basic Materials',
];

const MARKET_CAPS = [
  { value: '',      label: 'All sizes' },
  { value: 'mega',  label: '> $500B (Mega Cap)',   min: '500000000000',  max: '' },
  { value: 'large', label: '$50B – $500B (Large)', min: '50000000000',   max: '500000000000' },
  { value: 'mid',   label: '$10B – $50B (Mid)',    min: '10000000000',   max: '50000000000' },
  { value: 'small', label: '< $10B (Small)',       min: '',              max: '10000000000' },
];

const SORTS = [
  { value: 'marketCap',     label: 'Market Cap' },
  { value: 'dividendYield', label: 'Dividend Yield' },
  { value: 'price',         label: 'Price' },
  { value: 'score',         label: 'Composite Score' },
];

function ScreenerPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    sector: '', capBoursiere: '', marketCapMin: '', marketCapMax: '',
    dividendYieldMin: '', priceMin: '', priceMax: '',
    sortBy: 'marketCap', sortDir: 'desc', limit: '87',
  });

  const [results, setResults]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [note, setNote]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [presets, setPresets]     = useState([]);
  const [activePreset, setActivePreset] = useState('');
  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    loadPresets();
    setWatchlist(JSON.parse(localStorage.getItem('watchlist') || '[]'));
  }, []);

  async function loadPresets() {
    try {
      const res  = await fetch(`${API_BASE}/screener/presets`);
      const data = await res.json();
      setPresets(data.presets || []);
    } catch {}
  }

  function applyPreset(preset) {
    setActivePreset(preset.id);
    setFilters(prev => ({
      ...prev,
      sector: '', capBoursiere: '', marketCapMin: '', marketCapMax: '',
      dividendYieldMin: '', priceMin: '', priceMax: '',
      sortBy: 'marketCap', sortDir: 'desc', limit: '87',
      ...preset.params,
    }));
  }

  const runScreener = useCallback(async () => {
    setLoading(true); setError(''); setResults([]);

    const params = new URLSearchParams();
    if (filters.sector)           params.set('sector', filters.sector);
    if (filters.dividendYieldMin) params.set('dividendYieldMin', filters.dividendYieldMin);
    if (filters.priceMin)         params.set('priceMin', filters.priceMin);
    if (filters.priceMax)         params.set('priceMax', filters.priceMax);
    params.set('sortBy', filters.sortBy);
    params.set('sortDir', filters.sortDir);
    params.set('limit', filters.limit);

    const cap    = MARKET_CAPS.find(c => c.value === filters.capBoursiere);
    const capMin = cap?.min || filters.marketCapMin;
    const capMax = cap?.max || filters.marketCapMax;
    if (capMin) params.set('marketCapMin', capMin);
    if (capMax) params.set('marketCapMax', capMax);

    try {
      const res  = await fetch(`${API_BASE}/screener?${params}`);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setResults(data.stocks || []);
      setTotal(data.total || 0);
      setNote(data.note || '');
    } catch {
      setError('Unable to fetch results. Make sure the backend is running.');
    }
    setLoading(false);
  }, [filters]);

  function setFilter(key, value) { setActivePreset(''); setFilters(prev => ({ ...prev, [key]: value })); }

  function resetFilters() {
    setActivePreset('');
    setFilters({ sector: '', capBoursiere: '', marketCapMin: '', marketCapMax: '', dividendYieldMin: '', priceMin: '', priceMax: '', sortBy: 'marketCap', sortDir: 'desc', limit: '87' });
    setResults([]); setTotal(0); setError('');
  }

  function fmtCap(v) {
    if (!v) return 'N/A'; const n = Number(v);
    if (n >= 1e12) return (n/1e12).toFixed(1)+' T';
    if (n >= 1e9)  return (n/1e9).toFixed(1)+' B';
    if (n >= 1e6)  return (n/1e6).toFixed(0)+' M';
    return n.toLocaleString('en-US');
  }

  return (
    <div className="screener-page">
      <div className="screener-header">
        <div>
          <h1>🔍 Stock Screener</h1>
          <p className="page-subtitle">Filter US stocks from local database — 87 symbols available</p>
        </div>
      </div>

      <div className="screener-presets">
        <span className="screener-presets-label">Quick picks:</span>
        <div className="screener-presets-list">
          {presets.map(p => (
            <button key={p.id} className={`screener-preset-btn ${activePreset === p.id ? 'active' : ''}`} onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="screener-layout">
        <div className="screener-filtres-panel">
          <div className="screener-filtres-header">
            <h3>⚙️ Filters</h3>
            <button className="screener-reset-btn" onClick={resetFilters}>↺ Reset</button>
          </div>

          <div className="filtre-groupe">
            <label className="filtre-label">🏭 Sector</label>
            <select className="filtre-select" value={filters.sector} onChange={e => setFilter('sector', e.target.value)}>
              <option value="">All sectors</option>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="filtre-groupe">
            <label className="filtre-label">💼 Market Capitalization</label>
            <select className="filtre-select" value={filters.capBoursiere} onChange={e => setFilter('capBoursiere', e.target.value)}>
              {MARKET_CAPS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="filtre-groupe">
            <label className="filtre-label">💰 Min. Dividend Yield (%)</label>
            <div className="filtre-range-custom">
              <input type="number" className="filtre-input" placeholder="e.g. 3" min="0" max="30" step="0.5"
                value={filters.dividendYieldMin} onChange={e => setFilter('dividendYieldMin', e.target.value)} />
              <span className="filtre-hint">%</span>
            </div>
            <div className="filtre-shortcuts">
              {[1, 2, 3, 5].map(v => (
                <button key={v} className={`filtre-shortcut ${filters.dividendYieldMin === String(v) ? 'active' : ''}`}
                  onClick={() => setFilter('dividendYieldMin', filters.dividendYieldMin === String(v) ? '' : String(v))}>
                  ≥ {v}%
                </button>
              ))}
            </div>
          </div>

          <div className="filtre-groupe">
            <label className="filtre-label">🏷️ Stock Price ($)</label>
            <div className="filtre-range-custom">
              <input type="number" className="filtre-input" placeholder="Min" value={filters.priceMin} onChange={e => setFilter('priceMin', e.target.value)} />
              <span className="filtre-range-sep">–</span>
              <input type="number" className="filtre-input" placeholder="Max" value={filters.priceMax} onChange={e => setFilter('priceMax', e.target.value)} />
            </div>
          </div>

          <div className="filtre-groupe">
            <label className="filtre-label">↕️ Sort by</label>
            <div className="filtre-tri">
              <select className="filtre-select" value={filters.sortBy} onChange={e => setFilter('sortBy', e.target.value)}>
                {SORTS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button className={`filtre-dir-btn ${filters.sortDir === 'desc' ? 'active' : ''}`}
                onClick={() => setFilter('sortDir', filters.sortDir === 'desc' ? 'asc' : 'desc')}>
                {filters.sortDir === 'desc' ? '↓' : '↑'}
              </button>
            </div>
          </div>

          <button className="screener-search-btn" onClick={runScreener} disabled={loading}>
            {loading ? '⏳ Searching...' : '🔍 Run Screener'}
          </button>
        </div>

        <div className="screener-resultats">
          {(results.length > 0 || error || loading) && (
            <div className="screener-status-bar">
              {loading && <span className="screener-loading-txt">⏳ Loading...</span>}
              {!loading && results.length > 0 && (
                <>
                  <span className="screener-count"><strong>{results.length}</strong>{total > results.length ? ` / ${total}` : ''} stocks</span>
                  <span className="screener-source-badge green">🗄️ Local DB</span>
                  {note && <span className="screener-note">{note}</span>}
                </>
              )}
              {error && <span className="screener-erreur">⚠️ {error}</span>}
            </div>
          )}

          {results.length === 0 && !loading && !error && (
            <div className="screener-vide">
              <div className="screener-vide-icone">🔍</div>
              <h3>Set your filters and run the screener</h3>
              <p>Data is sourced from the local database (87 US stocks — FMP free plan).</p>
              <div className="screener-vide-tips">
                <div className="screener-tip">💡 Use quick picks above for fast results</div>
                <div className="screener-tip">💡 <strong>Dividend Yield ≥ 3%</strong> to find income stocks</div>
                <div className="screener-tip">💡 <strong>Sector = Technology</strong> for US tech giants</div>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="screener-table-wrapper">
              <table className="screener-table">
                <thead>
                  <tr>
                    <th>#</th><th>Stock</th><th className="col-secteur">Sector</th>
                    <th className="th-right">Price</th><th className="th-right">Change</th>
                    <th className="th-right">Market Cap</th><th className="th-right">P/E</th>
                    <th className="th-right">Yield</th><th className="th-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((s, i) => {
                    const isPos = s.changePercent >= 0;
                    const inWl  = watchlist.includes(s.symbol);
                    return (
                      <tr key={s.symbol} onClick={() => navigate(`/action/${s.symbol}`)} className={`screener-row ${inWl ? 'screener-row-wl' : ''}`}>
                        <td className="screener-td-num">{i+1}</td>
                        <td className="screener-td-nom">
                          <div className="screener-symbole-block">
                            <div className="screener-symbole-top">
                              <strong>{s.symbol}</strong>
                              {inWl && <span className="screener-wl-badge">⭐</span>}
                              <span className="screener-pays">🇺🇸</span>
                            </div>
                            <span className="screener-nom-complet">{s.name}</span>
                          </div>
                        </td>
                        <td className="screener-td-secteur col-secteur">
                          <span className="screener-secteur-tag">{s.sector !== 'N/A' ? s.sector : '—'}</span>
                        </td>
                        <td className="td-right">{s.price > 0 ? `$${s.price.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}` : 'N/A'}</td>
                        <td className="td-right">
                          {s.changePercent != null ? (
                            <span style={{ color: isPos ? '#22c55e' : '#ef4444' }}>{isPos?'▲':'▼'} {Math.abs(s.changePercent).toFixed(2)}%</span>
                          ) : <span className="nd">—</span>}
                        </td>
                        <td className="td-right">{s.marketCap > 0 ? `$${fmtCap(s.marketCap)}` : '—'}</td>
                        <td className="td-right">
                          {s.pe != null ? <span className={`screener-pe ${s.pe < 15 ? 'green' : s.pe > 30 ? 'red' : ''}`}>{s.pe.toFixed(1)}</span> : <span className="nd">—</span>}
                        </td>
                        <td className="td-right">
                          {s.dividendYield != null && s.dividendYield > 0 ? (
                            <span className={`screener-yield ${s.dividendYield >= 5 ? 'high' : s.dividendYield >= 3 ? 'mid' : ''}`}>{s.dividendYield.toFixed(2)}%</span>
                          ) : <span className="nd">—</span>}
                        </td>
                        <td className="td-right">
                          {s.score != null ? <span className={`screener-score ${s.score >= 70 ? 'green' : s.score >= 50 ? 'yellow' : 'red'}`}>{s.score}</span> : <span className="nd">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScreenerPage;
