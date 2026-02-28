// Super Dividendes — US + Europe, rendements réels depuis Yahoo Finance
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSuperDividendes } from '../services/api';

// Formatte le prix avec la bonne devise
function formatPrice(price, currency) {
  if (!price) return '—';
  const cur = currency || 'USD';
  const symbol = { USD: '$', EUR: '€', GBp: 'p', CHF: 'Fr' }[cur] || cur;
  const suffix = cur === 'GBp' ? 'p' : '';
  return cur === 'GBp'
    ? `${price?.toFixed(0)}${suffix}`
    : `${symbol}${price?.toFixed(2)}`;
}

function formatMarketCap(mc) {
  if (!mc) return '—';
  if (mc >= 1e12) return `${(mc/1e12).toFixed(1)}T`;
  if (mc >= 1e9)  return `${(mc/1e9).toFixed(1)}B`;
  if (mc >= 1e6)  return `${(mc/1e6).toFixed(1)}M`;
  return mc;
}

// Mini sparkline SVG pour l'historique dividendes
function DivSparkline({ history }) {
  if (!history || history.length < 2) return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>;
  const vals = history.map(h => h.dividend).reverse();
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 60, H = 24;
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  const trend = vals[vals.length - 1] >= vals[0];
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={points} fill="none"
        stroke={trend ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
    </svg>
  );
}

function TrendBadge({ trend, growth }) {
  const cfg = {
    growing:  { icon: '↑', color: '#22c55e', bg: 'rgba(34,197,94,.15)'  },
    stable:   { icon: '→', color: '#eab308', bg: 'rgba(234,179,8,.15)'  },
    declining:{ icon: '↓', color: '#ef4444', bg: 'rgba(239,68,68,.15)' },
  }[trend] || { icon: '—', color: '#8b949e', bg: 'rgba(139,148,158,.1)' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px',
      borderRadius:12, fontSize:'0.75rem', fontWeight:600,
      background: cfg.bg, color: cfg.color }}>
      {cfg.icon} {growth > 0 ? '+' : ''}{growth?.toFixed(1)}%
    </span>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : score >= 30 ? '#f97316' : '#ef4444';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:`2.5px solid ${color}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'0.75rem', fontWeight:700, color }}>
        {score}
      </div>
    </div>
  );
}

const REGIONS = [
  { key: 'all',    label: '🌍 Tout' },
  { key: 'US',     label: '🇺🇸 US' },
  { key: 'FR',     label: '🇫🇷 France' },
  { key: 'DE',     label: '🇩🇪 Allemagne' },
  { key: 'NL',     label: '🇳🇱 Pays-Bas' },
  { key: 'GB',     label: '🇬🇧 Royaume-Uni' },
  { key: 'CH',     label: '🇨🇭 Suisse' },
];

const SORTS = [
  { key: 'score',      label: '⭐ Score' },
  { key: 'yield',      label: '💰 Rendement' },
  { key: 'growth',     label: '📈 Croissance' },
  { key: 'regularity', label: '🔄 Régularité' },
  { key: 'avgYield',   label: '📊 Moy. 5 ans' },
];

export default function SuperDividendes() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [sortBy, setSortBy]     = useState('score');
  const [region, setRegion]     = useState('all');
  const [sector, setSector]     = useState('');
  const [minYield, setMinYield] = useState(2);
  const [expanded, setExpanded] = useState(null);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const result = await getSuperDividendes(`?minYield=${minYield}&sort=${sortBy}`);
      setData(result);
    } catch {
      setError('Impossible de charger les données.');
    }
    setLoading(false);
  }, [minYield, sortBy]);

  useEffect(() => { loadData(); }, [loadData]);

  function getFiltered() {
    if (!data?.stocks) return [];
    let stocks = [...data.stocks];

    // Filtre région
    if (region !== 'all') {
      stocks = stocks.filter(s => {
        const c = s.country || '';
        if (region === 'US') return c === 'United States' || c === 'US';
        if (region === 'FR') return c === 'France' || c === 'FR';
        if (region === 'DE') return c === 'Germany' || c === 'DE';
        if (region === 'NL') return c === 'Netherlands' || c === 'NL';
        if (region === 'GB') return c === 'United Kingdom' || c === 'GB';
        if (region === 'CH') return c === 'Switzerland' || c === 'CH';
        return true;
      });
    }

    // Filtre secteur
    if (sector) stocks = stocks.filter(s => s.sector === sector);

    // Tri
    switch (sortBy) {
      case 'yield':      stocks.sort((a,b) => b.currentYield - a.currentYield); break;
      case 'growth':     stocks.sort((a,b) => b.growth - a.growth); break;
      case 'regularity': stocks.sort((a,b) => b.regularity - a.regularity); break;
      case 'avgYield':   stocks.sort((a,b) => b.avgYield - a.avgYield); break;
      default:           stocks.sort((a,b) => b.score - a.score);
    }
    return stocks;
  }

  function getSectors() {
    if (!data?.stocks) return [];
    return [...new Set(data.stocks.map(s => s.sector).filter(Boolean))].sort();
  }

  // Stats résumées
  function getStats(stocks) {
    if (!stocks.length) return null;
    const avgYield = stocks.reduce((s,a) => s + a.currentYield, 0) / stocks.length;
    const best     = stocks.reduce((a,b) => a.currentYield > b.currentYield ? a : b);
    const growing  = stocks.filter(s => s.trend === 'growing').length;
    return { avgYield, best, growing, total: stocks.length };
  }

  const filtered = getFiltered();
  const stats    = getStats(filtered);

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>

      {/* En-tête */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:'1.8rem', fontWeight:700, margin:0 }}>💰 Super Dividendes</h1>
          <p style={{ color:'var(--text-muted)', marginTop:4 }}>
            Actions US &amp; Europe classées par score dividende — données Yahoo Finance
          </p>
        </div>
        <button onClick={() => navigate('/')}
          style={{ padding:'8px 16px', borderRadius:8, border:'1px solid var(--border)',
            background:'var(--surface)', color:'var(--text-primary)', cursor:'pointer' }}>
          ← Retour
        </button>
      </div>

      {/* Formule du score */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
        padding:'12px 16px', marginBottom:20, display:'flex', gap:24, flexWrap:'wrap' }}>
        <span style={{ color:'var(--text-muted)', fontSize:'0.8rem', fontWeight:600 }}>SCORE =</span>
        {[['40%','Rendement actuel'],['30%','Régularité'],['20%','Croissance div.'],['10%','Moy. 5 ans']].map(([pct, label]) => (
          <div key={pct} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontWeight:700, color:'var(--blue-light)', fontSize:'0.85rem' }}>{pct}</span>
            <span style={{ color:'var(--text-muted)', fontSize:'0.8rem' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:20 }}>

        {/* Régions */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {REGIONS.map(r => (
            <button key={r.key} onClick={() => setRegion(r.key)}
              style={{ padding:'5px 12px', borderRadius:20, border:'1px solid var(--border)', cursor:'pointer', fontSize:'0.82rem',
                background: region === r.key ? 'var(--blue-light)' : 'var(--surface)',
                color: region === r.key ? '#fff' : 'var(--text-primary)', fontWeight: region === r.key ? 600 : 400 }}>
              {r.label}
            </button>
          ))}
        </div>

        {/* Ligne 2 : rendement min + secteur + tri */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ color:'var(--text-muted)', fontSize:'0.82rem' }}>Rendement ≥</span>
            {[1,2,3,5,7].map(v => (
              <button key={v} onClick={() => setMinYield(v)}
                style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', cursor:'pointer', fontSize:'0.8rem',
                  background: minYield === v ? 'var(--blue-light)' : 'var(--surface)',
                  color: minYield === v ? '#fff' : 'var(--text-primary)' }}>
                {v}%
              </button>
            ))}
          </div>

          <select value={sector} onChange={e => setSector(e.target.value)}
            style={{ padding:'5px 10px', borderRadius:8, border:'1px solid var(--border)',
              background:'var(--surface)', color:'var(--text-primary)', fontSize:'0.82rem' }}>
            <option value="">Tous secteurs</option>
            {getSectors().map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
            {SORTS.map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key)}
                style={{ padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', cursor:'pointer', fontSize:'0.8rem',
                  background: sortBy === s.key ? 'rgba(99,102,241,.2)' : 'var(--surface)',
                  color: sortBy === s.key ? '#818cf8' : 'var(--text-muted)' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>⏳ Chargement...</p>}
      {error   && (
        <div style={{ textAlign:'center', padding:40 }}>
          <p style={{ color:'#ef4444' }}>{error}</p>
          <button onClick={loadData} style={{ marginTop:12, padding:'8px 20px', borderRadius:8,
            background:'var(--blue-light)', color:'#fff', border:'none', cursor:'pointer' }}>
            🔄 Réessayer
          </button>
        </div>
      )}

      {/* Stats résumées */}
      {stats && !loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
          {[
            { label:'Actions', value: stats.total, icon:'📋' },
            { label:'Rendement moyen', value: `${stats.avgYield?.toFixed(2)}%`, icon:'💰' },
            { label:'Meilleur rendement', value: `${stats.best?.currentYield?.toFixed(2)}% (${stats.best?.symbol})`, icon:'🏆' },
            { label:'Dividende croissant', value: `${stats.growing} actions`, icon:'📈' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--surface)', border:'1px solid var(--border)',
              borderRadius:10, padding:'12px 16px' }}>
              <div style={{ fontSize:'1.2rem', marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontWeight:700, fontSize:'1rem' }}>{s.value}</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tableau */}
      {!loading && filtered.length > 0 && (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', color:'var(--text-muted)', fontSize:'0.82rem' }}>
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''} · rendement ≥ {minYield}%
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)', fontSize:'0.75rem',
                  color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  <th style={th}>#</th>
                  <th style={{ ...th, textAlign:'left' }}>Action</th>
                  <th style={th}>Pays</th>
                  <th style={th}>Prix</th>
                  <th style={th}>Rendement</th>
                  <th style={th}>Moy. 5 ans</th>
                  <th style={th}>Div./an</th>
                  <th style={th}>Régularité</th>
                  <th style={th}>Tendance</th>
                  <th style={th}>Historique</th>
                  <th style={th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const isOpen = expanded === s.symbol;
                  return (
                    <>
                      <tr key={s.symbol}
                        onClick={() => navigate(`/action/${s.symbol}`)}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background .15s' }}>
                        <td style={{ ...td, color:'var(--text-muted)', fontSize:'0.8rem' }}>{i+1}</td>
                        <td style={{ ...td, textAlign:'left' }}>
                          <div style={{ display:'flex', flexDirection:'column' }}>
                            <strong style={{ color:'var(--blue-light)', fontSize:'0.9rem' }}>{s.symbol}</strong>
                            <span style={{ color:'var(--text-muted)', fontSize:'0.75rem', maxWidth:180,
                              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {s.name}
                            </span>
                          </div>
                        </td>
                        <td style={td}>
                          <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
                            {flagEmoji(s.country)} {s.country?.slice(0,2) || '—'}
                          </span>
                        </td>
                        <td style={td}>{formatPrice(s.price, s.currency)}</td>
                        <td style={{ ...td, fontWeight:700,
                          color: s.currentYield >= 7 ? '#4ade80' : s.currentYield >= 4 ? '#22c55e' : s.currentYield >= 2 ? '#eab308' : 'var(--text-primary)' }}>
                          {s.currentYield?.toFixed(2)}%
                        </td>
                        <td style={{ ...td, color:'var(--text-muted)' }}>{s.avgYield?.toFixed(2)}%</td>
                        <td style={td}>{s.latestAnnualDiv?.toFixed(3)}</td>
                        <td style={td}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', overflow:'hidden' }}>
                              <div style={{ height:'100%', borderRadius:2, width:`${s.regularity}%`,
                                background: s.regularity >= 80 ? '#22c55e' : s.regularity >= 60 ? '#eab308' : '#ef4444' }}/>
                            </div>
                            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{s.yearsOfDividends}/5</span>
                          </div>
                        </td>
                        <td style={td}><TrendBadge trend={s.trend} growth={s.growth} /></td>
                        <td style={td} onClick={e => { e.stopPropagation(); setExpanded(isOpen ? null : s.symbol); }}>
                          <DivSparkline history={s.history} />
                        </td>
                        <td style={td}><ScoreBadge score={s.score} /></td>
                      </tr>

                      {/* Ligne expandée : historique détaillé */}
                      {isOpen && (
                        <tr key={`${s.symbol}-exp`}>
                          <td colSpan={11} style={{ padding:'12px 24px', background:'rgba(99,102,241,.05)',
                            borderBottom:'1px solid var(--border)' }}>
                            <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'center' }}>
                              <span style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-muted)' }}>
                                Historique dividendes :
                              </span>
                              {(s.history || []).slice().reverse().map(h => (
                                <div key={h.year} style={{ textAlign:'center' }}>
                                  <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{h.year}</div>
                                  <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{h.dividend?.toFixed(3)}</div>
                                  <div style={{ fontSize:'0.7rem', color:'#22c55e' }}>{h.yield?.toFixed(2)}%</div>
                                </div>
                              ))}
                              <button onClick={() => navigate(`/action/${s.symbol}`)}
                                style={{ marginLeft:'auto', padding:'6px 14px', borderRadius:8,
                                  background:'var(--blue-light)', color:'#fff', border:'none', cursor:'pointer', fontSize:'0.8rem' }}>
                                Voir la fiche →
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && data && (
        <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>
          <p style={{ fontSize:'2rem' }}>🔍</p>
          <p>Aucune action ne correspond aux filtres sélectionnés.</p>
        </div>
      )}

      <p style={{ marginTop:20, color:'var(--text-muted)', fontSize:'0.75rem', textAlign:'center' }}>
        ⚠️ Les dividendes passés ne garantissent pas les dividendes futurs. Faites vos propres recherches.
      </p>
    </div>
  );
}

// Styles de cellules
const th = { padding:'10px 12px', textAlign:'center', fontWeight:600 };
const td = { padding:'12px', textAlign:'center', verticalAlign:'middle' };

// Drapeau emoji selon pays
function flagEmoji(country) {
  const map = {
    'United States': '🇺🇸', 'US': '🇺🇸',
    'France': '🇫🇷', 'FR': '🇫🇷',
    'Germany': '🇩🇪', 'DE': '🇩🇪',
    'Netherlands': '🇳🇱', 'NL': '🇳🇱',
    'United Kingdom': '🇬🇧', 'GB': '🇬🇧',
    'Switzerland': '🇨🇭', 'CH': '🇨🇭',
  };
  return map[country] || '🌍';
}
