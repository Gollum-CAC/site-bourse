// Page Comparateur d'actions — jusqu'à 3 actions en overlay
// Graphique normalisé base 100, tableau de métriques côte à côte
import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { createChart, LineSeries } from 'lightweight-charts';
import { getBatchQuotes, getHistoricalPrice, getRatiosTTM, getCompanyProfile } from '../services/api';

const COULEURS = ['#3b82f6', '#10b981', '#f59e0b'];

const TIMEFRAMES = [
  { label: '1M',  days: 30   },
  { label: '3M',  days: 90   },
  { label: '6M',  days: 180  },
  { label: '1A',  days: 365  },
  { label: '3A',  days: 1095 },
  { label: '5A',  days: 1825 },
];

const SUGGESTIONS_RAPIDES = [
  { label: 'GAFAM',      symbols: ['AAPL', 'MSFT', 'GOOGL'] },
  { label: 'Luxe FR',    symbols: ['MC.PA', 'RMS.PA', 'OR.PA'] },
  { label: 'Énergie',    symbols: ['TTE.PA', 'SHEL.L', 'XOM'] },
  { label: 'Semi-cond.', symbols: ['NVDA', 'ASML.AS', 'AMD'] },
  { label: 'Banques',    symbols: ['BNP.PA', 'SAN.PA', 'GS'] },
];

function getCurrency(symbol) {
  if (symbol.includes('.PA') || symbol.includes('.DE') || symbol.includes('.AS')) return '€';
  if (symbol.includes('.L')) return '£';
  if (symbol.includes('.T')) return '¥';
  if (symbol.includes('.HK')) return 'HK$';
  return '$';
}

function fmtAmt(val) {
  if (val == null || isNaN(val)) return '—';
  const n = Number(val);
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + ' T';
  if (Math.abs(n) >= 1e9)  return (n / 1e9).toFixed(1)  + ' Mds';
  if (Math.abs(n) >= 1e6)  return (n / 1e6).toFixed(0)  + ' M';
  return n.toLocaleString('fr-FR');
}
function fmt(val, dec = 2) { if (val == null || isNaN(Number(val))) return '—'; return Number(val).toFixed(dec); }
function fmtPct(val) { if (val == null || isNaN(Number(val))) return '—'; return (Number(val) * 100).toFixed(1) + '%'; }

// ─── Graphique multi-courbes normalisé base 100 ───
function ComparaisonChart({ series }) {
  const containerRef = useRef(null);

  function normaliser(data) {
    if (!data || data.length === 0) return [];
    const premier = data[0].close || data[0].value || 0;
    if (premier === 0) return [];
    return data
      .map(d => ({ time: d.date || d.time, value: ((d.close || d.value) / premier) * 100 }))
      .filter(d => d.time && !isNaN(d.value));
  }

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0d1117' }, textColor: '#4b6080', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
      grid: { vertLines: { color: '#1e2d45' }, horzLines: { color: '#1e2d45' } },
      crosshair: { mode: 1, vertLine: { color: '#3b82f6', width: 1, style: 2 }, horzLine: { color: '#3b82f6', width: 1, style: 2 } },
      rightPriceScale: { borderColor: '#1e2d45', textColor: '#4b6080' },
      timeScale: { borderColor: '#1e2d45', textColor: '#4b6080', timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    // Ligne de base à 100
    const baseLine = chart.addSeries(LineSeries, { color: 'rgba(255,255,255,0.1)', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });

    let baseSet = false;
    series.forEach((s, i) => {
      if (!s.data || s.data.length === 0) return;
      const norm = normaliser(s.data);
      if (norm.length === 0) return;
      if (!baseSet) {
        baseLine.setData([{ time: norm[0].time, value: 100 }, { time: norm[norm.length - 1].time, value: 100 }]);
        baseSet = true;
      }
      const line = chart.addSeries(LineSeries, {
        color: COULEURS[i], lineWidth: 2,
        lastValueVisible: true, priceLineVisible: false,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: COULEURS[i], crosshairMarkerBackgroundColor: COULEURS[i],
        title: s.symbol,
      });
      line.setData(norm);
    });

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(containerRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [series]);

  const isEmpty = series.length === 0 || series.every(s => !s.data?.length);
  if (isEmpty) {
    return (
      <div className="lwc-empty">
        <span>📈</span>
        <span>Ajoutez des actions pour comparer</span>
      </div>
    );
  }
  return <div ref={containerRef} className="lwc-container" style={{ height: 360 }} />;
}

// ─── Page principale ───
function Comparateur() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [symboles, setSymboles] = useState(() => {
    const s = searchParams.get('symbols');
    return s ? s.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 3) : [];
  });
  const [inputVal, setInputVal]       = useState('');
  const [timeframe, setTimeframe]     = useState('3M');
  const [donneesActions, setDonneesActions] = useState({});
  const [loading, setLoading]         = useState({});
  const [erreurs, setErreurs]         = useState({});

  // Sync URL
  useEffect(() => {
    if (symboles.length > 0) setSearchParams({ symbols: symboles.join(',') });
    else setSearchParams({});
  }, [symboles]);

  useEffect(() => {
    symboles.forEach(sym => chargerAction(sym));
  }, [symboles, timeframe]);

  async function chargerAction(sym) {
    // Vérifier si l'historique pour ce timeframe est déjà en cache
    if (donneesActions[sym]?.history?.[timeframe]) return;

    setLoading(prev => ({ ...prev, [sym]: true }));
    setErreurs(prev => ({ ...prev, [sym]: null }));

    try {
      const to   = new Date().toISOString().split('T')[0];
      const from = new Date();
      const tf   = TIMEFRAMES.find(t => t.label === timeframe) || TIMEFRAMES[1];
      from.setDate(from.getDate() - tf.days);
      const fromStr = from.toISOString().split('T')[0];

      const [quotesRes, histRes, ratiosRes, profileRes] = await Promise.allSettled([
        getBatchQuotes([sym]),
        getHistoricalPrice(sym, fromStr, to),
        getRatiosTTM(sym),
        getCompanyProfile(sym),
      ]);

      const quote   = quotesRes.status === 'fulfilled' ? quotesRes.value?.[0] : null;
      const history = histRes.status === 'fulfilled'
        ? (Array.isArray(histRes.value) ? histRes.value : histRes.value?.historical || []).reverse()
        : [];
      const ratios  = ratiosRes.status === 'fulfilled'
        ? (Array.isArray(ratiosRes.value) ? ratiosRes.value[0] : ratiosRes.value) : null;
      const profile = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;

      setDonneesActions(prev => ({
        ...prev,
        [sym]: {
          quote, profile, ratios,
          history: { ...(prev[sym]?.history || {}), [timeframe]: history },
        },
      }));
    } catch (err) {
      setErreurs(prev => ({ ...prev, [sym]: err.message }));
    }
    setLoading(prev => ({ ...prev, [sym]: false }));
  }

  function ajouterSymbole(sym) {
    const s = sym.trim().toUpperCase();
    if (!s || symboles.includes(s) || symboles.length >= 3) return;
    setSymboles(prev => [...prev, s]);
    setInputVal('');
  }

  function retirerSymbole(sym) {
    setSymboles(prev => prev.filter(s => s !== sym));
    setDonneesActions(prev => { const n = { ...prev }; delete n[sym]; return n; });
  }

  function appliquerSuggestion(syms) {
    setSymboles(syms);
    setDonneesActions({});
  }

  const seriesGraphique = symboles.map(sym => ({
    symbol: sym,
    data: donneesActions[sym]?.history?.[timeframe] || [],
  }));

  function calcVariation(sym) {
    const data = donneesActions[sym]?.history?.[timeframe];
    if (!data || data.length < 2) return null;
    const debut = data[0].close;
    const fin   = data[data.length - 1].close;
    if (!debut) return null;
    return ((fin - debut) / debut) * 100;
  }

  return (
    <div className="comp-page">

      {/* ── En-tête ── */}
      <div className="comp-header">
        <div>
          <h1>Comparateur d'actions</h1>
          <p className="page-subtitle">Comparez jusqu'à 3 actions sur la même base 100</p>
        </div>
        <Link to="/" className="back-link">← Accueil</Link>
      </div>

      {/* ── Suggestions rapides ── */}
      <div className="comp-suggestions">
        <span className="comp-suggestions-label">Suggestions :</span>
        {SUGGESTIONS_RAPIDES.map(sg => (
          <button
            key={sg.label}
            className={`comp-suggestion-btn ${JSON.stringify(symboles) === JSON.stringify(sg.symbols) ? 'active' : ''}`}
            onClick={() => appliquerSuggestion(sg.symbols)}
          >{sg.label}</button>
        ))}
      </div>

      {/* ── Slots sélection ── */}
      <div className="comp-selection">
        {symboles.map((sym, i) => {
          const d = donneesActions[sym];
          const variation = calcVariation(sym);
          const isPos = variation != null && variation >= 0;
          return (
            <div key={sym} className="comp-slot" style={{ '--slot-color': COULEURS[i] }}>
              <div className="comp-slot-header">
                {d?.profile?.image && (
                  <img src={d.profile.image} alt={sym} className="comp-slot-logo"
                       onError={e => e.target.style.display = 'none'} />
                )}
                <div className="comp-slot-info">
                  <span className="comp-slot-symbol" style={{ color: COULEURS[i] }}>{sym}</span>
                  <span className="comp-slot-name">{d?.quote?.name || d?.profile?.companyName || '...'}</span>
                </div>
                <button className="comp-slot-remove" onClick={() => retirerSymbole(sym)}>×</button>
              </div>
              {loading[sym] ? (
                <div className="comp-slot-loading">⏳ Chargement...</div>
              ) : d?.quote ? (
                <div className="comp-slot-prix">
                  <span className="comp-slot-valeur">{Number(d.quote.price).toFixed(2)} {getCurrency(sym)}</span>
                  {variation != null && (
                    <span className={`comp-slot-variation ${isPos ? 'pos' : 'neg'}`}>
                      {isPos ? '▲' : '▼'} {Math.abs(variation).toFixed(2)}%
                    </span>
                  )}
                </div>
              ) : erreurs[sym] ? (
                <div className="comp-slot-erreur">⚠️ Erreur chargement</div>
              ) : null}
            </div>
          );
        })}

        {/* Slot ajout */}
        {symboles.length < 3 && (
          <div className="comp-slot comp-slot-add">
            <form onSubmit={e => { e.preventDefault(); ajouterSymbole(inputVal); }}>
              <input
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value.toUpperCase())}
                placeholder={symboles.length === 0 ? 'Ex: AAPL' : 'Ajouter...'}
                className="comp-add-input"
                maxLength={12}
                autoFocus={symboles.length === 0}
              />
              <button type="submit" className="comp-add-btn" disabled={!inputVal.trim()}>
                + Ajouter
              </button>
            </form>
            <p className="comp-add-hint">
              {symboles.length === 0
                ? 'Entrez un symbole boursier (ex : MC.PA, NVDA…)'
                : `${3 - symboles.length} emplacement${3 - symboles.length > 1 ? 's' : ''} disponible${3 - symboles.length > 1 ? 's' : ''}`}
            </p>
          </div>
        )}
      </div>

      {/* ── Graphique ── */}
      {symboles.length > 0 && (
        <div className="detail-card" style={{ marginBottom: 16 }}>
          <div className="comp-chart-header">
            <div className="comp-legende">
              {symboles.map((sym, i) => {
                const variation = calcVariation(sym);
                const isPos = variation != null && variation >= 0;
                return (
                  <div key={sym} className="comp-legende-item">
                    <span className="comp-legende-dot" style={{ background: COULEURS[i] }} />
                    <span className="comp-legende-sym" style={{ color: COULEURS[i] }}>{sym}</span>
                    {variation != null && (
                      <span className={`comp-legende-var ${isPos ? 'pos' : 'neg'}`}>
                        {isPos ? '+' : ''}{variation.toFixed(2)}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="lwc-timeframes">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.label}
                  className={`lwc-tf-btn ${timeframe === tf.label ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf.label)}
                >{tf.label}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: 8, textAlign: 'right' }}>
            Base 100 — performance relative depuis le début de la période
          </div>
          <ComparaisonChart series={seriesGraphique} />
        </div>
      )}

      {/* ── Tableau métriques ── */}
      {symboles.some(sym => donneesActions[sym]?.quote) && (
        <div className="detail-card">
          <h3 style={{ marginBottom: 16 }}>Comparaison des métriques</h3>
          <div className="comp-table-wrapper">
            <table className="comp-table">
              <thead>
                <tr>
                  <th className="comp-th-label">Métrique</th>
                  {symboles.map((sym, i) => (
                    <th key={sym} style={{ color: COULEURS[i] }}>{sym}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Prix & Marché */}
                <tr className="comp-tr-section"><td colSpan={symboles.length + 1}>Prix &amp; Marché</td></tr>
                {[
                  ['Prix',           sym => { const q = donneesActions[sym]?.quote; return q ? `${Number(q.price).toFixed(2)} ${getCurrency(sym)}` : '—'; }],
                  ['Capitalisation', sym => fmtAmt(donneesActions[sym]?.quote?.marketCap)],
                  ['Volume',         sym => { const v = donneesActions[sym]?.quote?.volume; return v ? `${(v/1e6).toFixed(1)} M` : '—'; }],
                  ['Haut 52s',       sym => { const q = donneesActions[sym]?.quote; return q?.yearHigh ? `${Number(q.yearHigh).toFixed(2)} ${getCurrency(sym)}` : '—'; }],
                  ['Bas 52s',        sym => { const q = donneesActions[sym]?.quote; return q?.yearLow  ? `${Number(q.yearLow ).toFixed(2)} ${getCurrency(sym)}` : '—'; }],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symboles.map(sym => <td key={sym}>{fn(sym)}</td>)}
                  </tr>
                ))}

                {/* Valorisation */}
                <tr className="comp-tr-section"><td colSpan={symboles.length + 1}>Valorisation</td></tr>
                {[
                  ['P/E (TTM)',   sym => fmt(donneesActions[sym]?.ratios?.peRatioTTM)],
                  ['P/B (TTM)',   sym => fmt(donneesActions[sym]?.ratios?.priceToBookRatioTTM)],
                  ['P/S (TTM)',   sym => fmt(donneesActions[sym]?.ratios?.priceToSalesRatioTTM)],
                  ['EV/EBITDA',  sym => fmt(donneesActions[sym]?.ratios?.enterpriseValueOverEBITDATTM)],
                  ['PEG Ratio',  sym => fmt(donneesActions[sym]?.ratios?.pegRatioTTM)],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symboles.map(sym => {
                      const val = fn(sym);
                      const vals = symboles.map(s => parseFloat(fn(s))).filter(v => !isNaN(v));
                      const isBest = vals.length > 1 && parseFloat(val) === Math.min(...vals) && val !== '—';
                      return <td key={sym} className={isBest ? 'comp-best' : ''}>{val}</td>;
                    })}
                  </tr>
                ))}

                {/* Rentabilité */}
                <tr className="comp-tr-section"><td colSpan={symboles.length + 1}>Rentabilité</td></tr>
                {[
                  ['ROE',           sym => fmtPct(donneesActions[sym]?.ratios?.returnOnEquityTTM)],
                  ['ROA',           sym => fmtPct(donneesActions[sym]?.ratios?.returnOnAssetsTTM)],
                  ['Marge brute',   sym => fmtPct(donneesActions[sym]?.ratios?.grossProfitMarginTTM)],
                  ['Marge nette',   sym => fmtPct(donneesActions[sym]?.ratios?.netProfitMarginTTM)],
                  ['Marge opérat.', sym => fmtPct(donneesActions[sym]?.ratios?.operatingProfitMarginTTM)],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symboles.map(sym => {
                      const val = fn(sym);
                      const vals = symboles.map(s => parseFloat(fn(s))).filter(v => !isNaN(v));
                      const isBest = vals.length > 1 && parseFloat(val) === Math.max(...vals) && val !== '—';
                      return <td key={sym} className={isBest ? 'comp-best' : ''}>{val}</td>;
                    })}
                  </tr>
                ))}

                {/* Dividende */}
                <tr className="comp-tr-section"><td colSpan={symboles.length + 1}>Dividende</td></tr>
                {[
                  ['Rendement',    sym => { const r = donneesActions[sym]?.ratios?.dividendYielPercentageTTM; return r != null ? fmt(r, 2) + '%' : '—'; }],
                  ['Payout ratio', sym => { const r = donneesActions[sym]?.ratios?.payoutRatioTTM; return r != null ? fmt(r * 100, 1) + '%' : '—'; }],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symboles.map(sym => <td key={sym}>{fn(sym)}</td>)}
                  </tr>
                ))}

                {/* Santé */}
                <tr className="comp-tr-section"><td colSpan={symboles.length + 1}>Santé financière</td></tr>
                {[
                  ['Dette/Equity',  sym => fmt(donneesActions[sym]?.ratios?.debtEquityRatioTTM)],
                  ['Current ratio', sym => fmt(donneesActions[sym]?.ratios?.currentRatioTTM)],
                  ['Secteur',       sym => donneesActions[sym]?.profile?.sector || '—'],
                  ['Pays',          sym => donneesActions[sym]?.profile?.country || '—'],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symboles.map(sym => <td key={sym}>{fn(sym)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 12 }}>
            ✦ La meilleure valeur de chaque rangée est surlignée en vert.
          </p>
        </div>
      )}

      {/* État vide */}
      {symboles.length === 0 && (
        <div className="comp-empty">
          <div className="comp-empty-icon">📊</div>
          <h2>Comparez des actions en quelques secondes</h2>
          <p>Ajoutez 2 ou 3 symboles boursiers pour voir leur performance relative et leurs métriques côte à côte.</p>
          <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Exemples : AAPL · MSFT · MC.PA · ASML.AS · TTE.PA
          </p>
        </div>
      )}
    </div>
  );
}

export default Comparateur;
