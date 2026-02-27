// DB Status page — Compteurs en temps réel et liste des actions crawlées
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDbStatus } from '../services/api';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'
  : '/api';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}min ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtCap(val) {
  if (!val) return '—';
  const n = Number(val);
  if (n >= 1e12) return (n / 1e12).toFixed(1) + ' T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1)  + ' B';
  if (n >= 1e6)  return (n / 1e6).toFixed(0)  + ' M';
  return n.toLocaleString('en-US');
}

function EnrichBadge({ has }) {
  return has
    ? <span style={{ color: '#22c55e', fontSize: '0.75rem' }}>✓</span>
    : <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>—</span>;
}

function ProgressBar({ value, total, color = 'var(--blue)' }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-overlay)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: 40 }}>{pct}%</span>
    </div>
  );
}

export default function DbStatus() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('');
  const [sortCol, setSortCol] = useState('market_cap');
  const [refresh, setRefresh] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError('');
    getDbStatus()
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [refresh]);

  // Auto-refresh toutes les 30s
  useEffect(() => {
    const id = setInterval(() => setRefresh(r => r + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--text-muted)' }}>
      <span style={{ fontSize: '1.4rem', animation: 'spin 1s linear infinite' }}>⟳</span>
      <span>Chargement du statut…</span>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <p style={{ color: 'var(--red-light)', marginBottom: 12 }}>⚠️ {error}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>Assurez-vous que le backend tourne sur localhost:3001</p>
      <button onClick={() => setRefresh(r => r + 1)} className="retry-button" style={{ marginTop: 20 }}>Retry</button>
    </div>
  );

  const { compteurs = {}, remplissage = {}, liste = [], crawlerState = [], crawlerConfig = {}, generatedAt } = data;
  const total       = compteurs.symbolsTotal || 87;
  const withQuote   = liste.filter(s => s.quote_updated).length;
  const withProfile = liste.filter(s => s.has_profile).length;
  const withDivs    = liste.filter(s => s.has_dividends).length;

  const filteredList = liste
    .filter(s => {
      if (!filter) return true;
      const f = filter.toLowerCase();
      return s.symbol?.toLowerCase().includes(f) || s.name?.toLowerCase().includes(f)
          || s.sector?.toLowerCase().includes(f)  || s.country?.toLowerCase().includes(f);
    })
    .sort((a, b) => {
      if (sortCol === 'market_cap') return (Number(b.market_cap) || 0) - (Number(a.market_cap) || 0);
      if (sortCol === 'symbol')     return a.symbol.localeCompare(b.symbol);
      if (sortCol === 'quote')      return (b.quote_updated ? 1 : 0) - (a.quote_updated ? 1 : 0);
      return 0;
    });

  return (
    <div style={{ paddingBottom: 60 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>🗄️ Database Status</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>
            Last update: {timeAgo(generatedAt)} · Auto-refresh every 30s
          </p>
        </div>
        <button
          onClick={() => setRefresh(r => r + 1)}
          style={{ padding: '8px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
          ⟳ Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Stocks in DB',    value: compteurs.totalStocks  || 0,  color: 'blue',   icon: '📋' },
          { label: 'Quotes',          value: compteurs.totalQuotes  || 0,  color: 'blue',   icon: '💹' },
          { label: 'Profiles',        value: compteurs.totalProfiles || 0, color: 'purple', icon: '🏢' },
          { label: 'Dividends (sym)', value: compteurs.totalDividends || 0,color: 'green',  icon: '💰' },
          { label: 'Analyzed',        value: compteurs.totalAnalyzed || 0, color: 'gold',   icon: '📊' },
          { label: 'Fresh quotes',    value: compteurs.quotesFrais  || 0,  color: 'green',  icon: '⚡' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className={`hero-stat-card ${color}`}>
            <span className="hero-stat-label">{icon} {label}</span>
            <span className="hero-stat-value" style={{ fontSize: '1.3rem' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Barres de progression */}
      <div className="detail-card" style={{ marginBottom: 20 }}>
        <h3>Enrichment progress <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>({total} symbols)</span></h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
          {[
            { label: 'Quotes',   count: withQuote,   color: 'var(--blue)' },
            { label: 'Profiles', count: withProfile, color: '#a855f7' },
            { label: 'Dividends',count: withDivs,    color: 'var(--green)' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{label}</span>
              <ProgressBar value={count} total={total} color={color} />
              <span style={{ fontSize: '0.83rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textAlign: 'right' }}>{count} / {total}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Crawler budget */}
      {crawlerConfig && (
        <div className="detail-card" style={{ marginBottom: 20 }}>
          <h3>Crawler — FMP free plan (250 calls/day)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
            {[
              { label: 'Daily budget',   value: `${crawlerConfig.dailyCallCount || 0} / ${crawlerConfig.crawlerBudget || 200}` },
              { label: 'Total symbols',  value: crawlerConfig.totalSymbols || 87 },
              { label: 'Status',         value: crawlerConfig.enabled ? '🟢 active' : '🔴 stopped' },
              { label: 'Quote refresh',  value: 'Every 6h (EOD)' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-overlay)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crawler state par tâche */}
      {crawlerState.length > 0 && (
        <div className="detail-card" style={{ marginBottom: 20 }}>
          <h3>Crawler tasks</h3>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Task', 'Status', 'Last run', 'Processed', 'Total'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crawlerState.map(t => (
                  <tr key={t.task_name} style={{ borderBottom: '1px solid rgba(30,45,69,0.5)' }}>
                    <td style={{ padding: '9px 12px', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{t.task_name}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700,
                        background: t.status === 'running' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
                        color:      t.status === 'running' ? '#60a5fa'                : '#4ade80',
                      }}>
                        {t.status === 'running' ? '🔄 running' : '✓ idle'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{timeAgo(t.last_run_at)}</td>
                    <td style={{ padding: '9px 12px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{t.symbols_processed ?? '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{t.symbols_total ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Liste des actions */}
      <div className="detail-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>Stocks ({filteredList.length}{filter ? ` / ${total}` : ''})</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="Filter by symbol, name, sector…"
              value={filter} onChange={e => setFilter(e.target.value)}
              style={{ padding: '7px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.83rem', outline: 'none', width: 240 }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'market_cap', label: 'Cap.' },
                { key: 'symbol',     label: 'A→Z' },
                { key: 'quote',      label: 'Recent' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setSortCol(key)} style={{ padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: sortCol === key ? 'var(--blue-dim)' : 'var(--bg-overlay)', color: sortCol === key ? 'var(--blue-light)' : 'var(--text-secondary)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span style={{ color: '#22c55e' }}>✓ data present</span>
          <span style={{ color: 'var(--text-dim)' }}>— missing</span>
          <span style={{ marginLeft: 'auto', color: 'var(--blue-light)' }}>💡 Click a row → stock detail</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>
                {[
                  { label: '#',       w: 36 },
                  { label: 'Symbol',  w: 90 },
                  { label: 'Name',    w: null },
                  { label: 'Sector',  w: 140 },
                  { label: 'Cap.',    w: 90 },
                  { label: 'Price',   w: 80 },
                  { label: 'Quote',   w: 50, title: 'Fresh price' },
                  { label: 'Profile', w: 50, title: 'Profile crawled' },
                  { label: 'Divid.',  w: 50, title: 'Dividends' },
                  { label: 'Yield',   w: 60, title: 'Dividend yield' },
                  { label: 'Updated', w: 80, title: 'Last price update' },
                ].map(({ label, w, title }) => (
                  <th key={label} title={title}
                    style={{ textAlign: ['#', 'Quote', 'Profile', 'Divid.'].includes(label) ? 'center' : 'left', padding: '8px 10px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, borderBottom: '1px solid var(--border)', width: w || undefined, whiteSpace: 'nowrap' }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredList.map((s, i) => (
                <tr key={s.symbol}
                  onClick={() => navigate(`/action/${s.symbol}`)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid rgba(30,45,69,0.4)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.73rem', fontFamily: 'var(--font-mono)' }}>{i + 1}</td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--blue-light)', fontSize: '0.88rem' }}>{s.symbol}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-secondary)', fontSize: '0.83rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name && s.name !== s.symbol ? s.name : <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>— not crawled yet</span>}
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    {s.sector
                      ? <span style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.sector}</span>
                      : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'right' }}>{fmtCap(s.market_cap)}</td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontSize: '0.85rem', textAlign: 'right', fontWeight: 600 }}>
                    {s.price ? `$${Number(s.price).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}><EnrichBadge has={!!s.quote_updated} /></td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}><EnrichBadge has={s.has_profile} /></td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}><EnrichBadge has={s.has_dividends} /></td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', textAlign: 'right', color: s.current_yield ? '#22c55e' : 'var(--text-dim)' }}>
                    {s.current_yield ? `${Number(s.current_yield).toFixed(2)}%` : '—'}
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{timeAgo(s.quote_updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              No stocks match "{filter}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
