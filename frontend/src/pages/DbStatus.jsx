// Page DB Status — Compteurs en temps réel + liste des actions crawlées
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDbStatus } from '../services/api';

// Formatte une date en "il y a X"
function tempsEcoule(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function fmtCap(val) {
  if (!val) return '—';
  const n = Number(val);
  if (n >= 1e12) return (n / 1e12).toFixed(1) + ' T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1)  + ' Mds';
  if (n >= 1e6)  return (n / 1e6).toFixed(0)  + ' M';
  return n.toLocaleString('fr-FR');
}

// Badge enrichissement d'une action
function BadgeEnrich({ has }) {
  return has
    ? <span style={{ color: 'var(--green)', fontSize: '0.75rem' }}>✓</span>
    : <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>—</span>;
}

// Barre de progression
function ProgressBar({ value, total, color = 'var(--blue)' }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        flex: 1, height: 6, background: 'var(--bg-overlay)',
        borderRadius: 3, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color, borderRadius: 3,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: 40 }}>
        {pct}%
      </span>
    </div>
  );
}

export default function DbStatus() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [erreur, setErreur]     = useState('');
  const [filtre, setFiltre]     = useState('');
  const [colonneSort, setSort]  = useState('market_cap');
  const [refresh, setRefresh]   = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setErreur('');
    getDbStatus()
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setErreur(e.message); setLoading(false); });
  }, [refresh]);

  // Rafraîchissement auto toutes les 30s
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

  if (erreur) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <p style={{ color: 'var(--red-light)', marginBottom: 12 }}>⚠️ {erreur}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        Vérifiez que le backend tourne sur localhost:3001
      </p>
      <button onClick={() => setRefresh(r => r + 1)} className="retry-button" style={{ marginTop: 20 }}>
        Réessayer
      </button>
    </div>
  );

  const { compteurs, liste = [], crawlerState = [], generatedAt } = data;
  const total = compteurs.totalStocks;

  // Filtrage + tri de la liste
  const listeFiltree = liste
    .filter(s => {
      if (!filtre) return true;
      const f = filtre.toLowerCase();
      return s.symbol?.toLowerCase().includes(f)
          || s.name?.toLowerCase().includes(f)
          || s.sector?.toLowerCase().includes(f)
          || s.country?.toLowerCase().includes(f);
    })
    .sort((a, b) => {
      if (colonneSort === 'market_cap') return (Number(b.market_cap) || 0) - (Number(a.market_cap) || 0);
      if (colonneSort === 'symbol')     return a.symbol.localeCompare(b.symbol);
      if (colonneSort === 'quote')      return (b.quote_updated ? 1 : 0) - (a.quote_updated ? 1 : 0);
      return 0;
    });

  // Calcul enrichissement
  const avecQuote    = liste.filter(s => s.quote_updated).length;
  const avecProfile  = liste.filter(s => s.has_profile).length;
  const avecRatios   = liste.filter(s => s.has_ratios).length;
  const avecDivs     = liste.filter(s => s.has_dividends).length;
  const avecNom      = liste.filter(s => s.name && s.name !== s.symbol).length;

  // Prochaine tâche crawler
  const prochainesTaches = crawlerState
    .filter(t => t.prochaine_execution)
    .sort((a, b) => new Date(a.prochaine_execution) - new Date(b.prochaine_execution));

  return (
    <div style={{ paddingBottom: 60 }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: 4 }}>
            🗄️ Statut de la base de données
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>
            Dernière mise à jour : {tempsEcoule(generatedAt)} · Actualisation auto toutes les 30s
          </p>
        </div>
        <button
          onClick={() => setRefresh(r => r + 1)}
          style={{
            padding: '8px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--blue)'; e.target.style.color = 'var(--blue-light)'; }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-secondary)'; }}
        >
          ⟳ Actualiser
        </button>
      </div>

      {/* ── Compteurs principaux ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Actions en DB',       value: total,                     color: 'blue',   icon: '📋' },
          { label: 'Noms complets',        value: `${avecNom} / ${total}`,   color: 'green',  icon: '🏢' },
          { label: 'Quotes (prix)',        value: `${avecQuote} / ${total}`, color: 'blue',   icon: '💹' },
          { label: 'Profils crawlés',      value: `${avecProfile} / ${total}`, color: 'purple', icon: '📊' },
          { label: 'Ratios TTM',           value: `${avecRatios} / ${total}`, color: 'gold',   icon: '📐' },
          { label: 'Dividendes',           value: `${avecDivs} / ${total}`,  color: 'green',  icon: '💰' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className={`hero-stat-card ${color}`}>
            <span className="hero-stat-label">{icon} {label}</span>
            <span className="hero-stat-value" style={{ fontSize: '1.3rem' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Barres de progression enrichissement ── */}
      <div className="detail-card" style={{ marginBottom: 20 }}>
        <h3>Progression de l'enrichissement</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Noms complets',   count: avecNom,     color: 'var(--green)' },
            { label: 'Prix (quotes)',   count: avecQuote,   color: 'var(--blue)' },
            { label: 'Profils',         count: avecProfile, color: 'var(--purple)' },
            { label: 'Ratios TTM',      count: avecRatios,  color: 'var(--gold)' },
            { label: 'Dividendes',      count: avecDivs,    color: 'var(--green)' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 60px', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{label}</span>
              <ProgressBar value={count} total={total} color={color} />
              <span style={{ fontSize: '0.83rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textAlign: 'right' }}>
                {count} / {total}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── État du crawler ── */}
      {crawlerState.length > 0 && (
        <div className="detail-card" style={{ marginBottom: 20 }}>
          <h3>État du crawler</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Tâche', 'Statut', 'Dernier run', 'Prochain run', 'Appels utilisés'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '8px 12px', fontSize: '0.72rem',
                      color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                      borderBottom: '1px solid var(--border)', fontWeight: 700,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {crawlerState.map(t => {
                  const isPending = t.prochaine_execution && new Date(t.prochaine_execution) > new Date();
                  const isRunning = t.statut === 'running';
                  return (
                    <tr key={t.tache} style={{ borderBottom: '1px solid rgba(30,45,69,0.5)' }}>
                      <td style={{ padding: '9px 12px', fontSize: '0.85rem', fontWeight: 600 }}>
                        {t.tache}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700,
                          background: isRunning ? 'var(--blue-dim)' : isPending ? 'var(--gold-dim)' : 'var(--green-dim)',
                          color: isRunning ? 'var(--blue-light)' : isPending ? 'var(--gold-light)' : 'var(--green-light)',
                        }}>
                          {isRunning ? '🔄 en cours' : isPending ? '⏳ en attente' : '✓ terminé'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {tempsEcoule(t.derniere_execution)}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {t.prochaine_execution
                          ? new Date(t.prochaine_execution).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          : '—'
                        }
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {t.appels_jour ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Liste des actions ── */}
      <div className="detail-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={{ margin: 0 }}>
            Liste des actions ({listeFiltree.length}{filtre ? ` / ${total}` : ''})
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filtre texte */}
            <input
              type="text"
              placeholder="Filtrer par symbole, nom, secteur…"
              value={filtre}
              onChange={e => setFiltre(e.target.value)}
              style={{
                padding: '7px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '0.83rem',
                outline: 'none', width: 240,
              }}
            />
            {/* Tri */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'market_cap', label: 'Cap.' },
                { key: 'symbol',     label: 'A→Z' },
                { key: 'quote',      label: 'Prix récent' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  style={{
                    padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    background: colonneSort === key ? 'var(--blue-dim)' : 'var(--bg-overlay)',
                    color: colonneSort === key ? 'var(--blue-light)' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Légende */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span>Colonnes enrichissement :</span>
          <span style={{ color: 'var(--green)' }}>✓ présent</span>
          <span style={{ color: 'var(--text-dim)' }}>— absent</span>
          <span style={{ marginLeft: 'auto', color: 'var(--blue-light)' }}>
            💡 Cliquer sur une ligne → page détail
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                {[
                  { label: '#',        w: 36 },
                  { label: 'Symbole',  w: 90 },
                  { label: 'Nom',      w: null },
                  { label: 'Secteur',  w: 130 },
                  { label: 'Pays',     w: 60 },
                  { label: 'Cap.',     w: 90 },
                  { label: 'Prix',     w: 90 },
                  { label: 'Quot.',    w: 50, title: 'Quote fraîche' },
                  { label: 'Profil',   w: 50, title: 'Profil crawlé' },
                  { label: 'Ratios',   w: 50, title: 'Ratios TTM' },
                  { label: 'Divid.',   w: 50, title: 'Dividendes' },
                  { label: 'MàJ',      w: 90, title: 'Dernière mise à jour prix' },
                ].map(({ label, w, title }) => (
                  <th key={label} title={title} style={{
                    textAlign: label === '#' || label === 'Quot.' || label === 'Profil' || label === 'Ratios' || label === 'Divid.' ? 'center' : 'left',
                    padding: '8px 10px', fontSize: '0.7rem', color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700,
                    borderBottom: '1px solid var(--border)', width: w || undefined,
                    whiteSpace: 'nowrap', cursor: title ? 'help' : 'default',
                  }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listeFiltree.map((s, i) => (
                <tr
                  key={s.symbol}
                  onClick={() => navigate(`/action/${s.symbol}`)}
                  style={{
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(30,45,69,0.4)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.73rem', fontFamily: 'var(--font-mono)' }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--blue-light)', fontSize: '0.88rem' }}>
                    {s.symbol}
                  </td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-secondary)', fontSize: '0.83rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name && s.name !== s.symbol ? s.name : <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>— non crawlé</span>}
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    {s.sector ? (
                      <span style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {s.sector}
                      </span>
                    ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                  </td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-muted)', fontSize: '0.83rem', textAlign: 'center' }}>
                    {s.country || '—'}
                  </td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'right' }}>
                    {fmtCap(s.market_cap)}
                  </td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontSize: '0.85rem', textAlign: 'right', fontWeight: 600 }}>
                    {s.price ? Number(s.price).toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}><BadgeEnrich has={!!s.quote_updated} /></td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}><BadgeEnrich has={s.has_profile} /></td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}><BadgeEnrich has={s.has_ratios} /></td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}><BadgeEnrich has={s.has_dividends} /></td>
                  <td style={{ padding: '9px 10px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {tempsEcoule(s.quote_updated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {listeFiltree.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              Aucune action ne correspond à « {filtre} »
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
