// Comparateur — Plan FMP GRATUIT
// Métriques disponibles : Price, Market Cap, Volume, 52w High/Low, P/E (quote), Dividend (DB)
// Supprimés : ratios-ttm (plan payant) — P/B, P/S, PEG, EV/EBITDA, ROE, ROA, marges, debt/equity
// Quick picks restreints aux 87 symboles accessibles
import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { createChart, LineSeries } from 'lightweight-charts';
import { getBatchQuotes, getHistoricalPrice, getCompanyProfile } from '../services/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

const TIMEFRAMES = [
  { label: '1M',  days: 30   },
  { label: '3M',  days: 90   },
  { label: '6M',  days: 180  },
  { label: '1Y',  days: 365  },
  { label: '5Y',  days: 1825 },
];

// Quick picks limités aux 87 symboles gratuits FMP
const QUICK_PICKS = [
  { label: 'GAFAM',    symbols: ['AAPL', 'MSFT', 'GOOGL'] },
  { label: 'AI/Semis', symbols: ['NVDA', 'AMD', 'INTC']   },
  { label: 'Finance',  symbols: ['JPM', 'GS', 'V']         },
  { label: 'Energy',   symbols: ['XOM', 'CVX', 'COP']      },
  { label: 'Pharma',   symbols: ['LLY', 'JNJ', 'PFE']      },
];

function fmt(v, d = 2) { if (v == null || isNaN(Number(v))) return '—'; return Number(v).toFixed(d); }
function fmtAmt(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (Math.abs(n) >= 1e12) return (n/1e12).toFixed(1)+' T';
  if (Math.abs(n) >= 1e9)  return (n/1e9).toFixed(1)+' B';
  if (Math.abs(n) >= 1e6)  return (n/1e6).toFixed(0)+' M';
  return n.toLocaleString('en-US');
}

function ComparisonChart({ series }) {
  const ref = useRef(null);

  function normalize(data) {
    if (!data?.length) return [];
    const first = data[0].close || 0;
    if (!first) return [];
    return data.map(d => ({ time: d.date || d.time, value: ((d.close) / first) * 100 }))
               .filter(d => d.time && !isNaN(d.value));
  }

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { color: '#0d1117' }, textColor: '#4b6080', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
      grid: { vertLines: { color: '#1e2d45' }, horzLines: { color: '#1e2d45' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#1e2d45' },
      timeScale: { borderColor: '#1e2d45', timeVisible: true },
      handleScroll: { mouseWheel: true }, handleScale: { mouseWheel: true },
    });

    series.forEach((s, i) => {
      const norm = normalize(s.data);
      if (!norm.length) return;
      const line = chart.addSeries(LineSeries, { color: COLORS[i], lineWidth: 2, title: s.symbol, priceLineVisible: false, lastValueVisible: true });
      line.setData(norm);
    });

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => { if (ref.current) chart.applyOptions({ width: ref.current.clientWidth }); });
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [series]);

  if (!series.length || series.every(s => !s.data?.length)) {
    return <div className="lwc-empty"><span>📈</span><span>Add stocks to compare</span></div>;
  }
  return <div ref={ref} className="lwc-container" style={{ height: 360 }} />;
}

function Comparateur() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [symbols, setSymbols] = useState(() => {
    const s = searchParams.get('symbols');
    return s ? s.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 3) : [];
  });
  const [inputVal, setInputVal]   = useState('');
  const [timeframe, setTimeframe] = useState('3M');
  const [stockData, setStockData] = useState({});
  const [loading, setLoading]     = useState({});

  useEffect(() => {
    if (symbols.length > 0) setSearchParams({ symbols: symbols.join(',') });
    else setSearchParams({});
  }, [symbols]);

  useEffect(() => { symbols.forEach(sym => loadStock(sym)); }, [symbols, timeframe]);

  async function loadStock(sym) {
    if (stockData[sym]?.history?.[timeframe]) return;
    setLoading(prev => ({ ...prev, [sym]: true }));
    try {
      const to   = new Date().toISOString().split('T')[0];
      const from = new Date();
      const tf   = TIMEFRAMES.find(t => t.label === timeframe) || TIMEFRAMES[1];
      from.setDate(from.getDate() - tf.days);

      const [quotesRes, histRes, profileRes] = await Promise.allSettled([
        getBatchQuotes([sym]),
        getHistoricalPrice(sym, from.toISOString().split('T')[0], to),
        getCompanyProfile(sym),
      ]);

      const quote   = quotesRes.status === 'fulfilled' ? quotesRes.value?.[0] : null;
      const history = histRes.status === 'fulfilled'
        ? (Array.isArray(histRes.value) ? histRes.value : histRes.value?.historical || []).reverse()
        : [];
      const profile = profileRes.status === 'fulfilled' ? profileRes.value?.[0] : null;

      setStockData(prev => ({
        ...prev,
        [sym]: { quote, profile, history: { ...(prev[sym]?.history || {}), [timeframe]: history } },
      }));
    } catch {}
    setLoading(prev => ({ ...prev, [sym]: false }));
  }

  function addSymbol(sym) {
    const s = sym.trim().toUpperCase();
    if (!s || symbols.includes(s) || symbols.length >= 3) return;
    setSymbols(prev => [...prev, s]);
    setInputVal('');
  }

  function removeSymbol(sym) {
    setSymbols(prev => prev.filter(s => s !== sym));
    setStockData(prev => { const n = { ...prev }; delete n[sym]; return n; });
  }

  function calcChange(sym) {
    const data = stockData[sym]?.history?.[timeframe];
    if (!data || data.length < 2) return null;
    const start = data[0].close, end = data[data.length - 1].close;
    if (!start) return null;
    return ((end - start) / start) * 100;
  }

  const chartSeries = symbols.map(sym => ({ symbol: sym, data: stockData[sym]?.history?.[timeframe] || [] }));

  return (
    <div className="comp-page">
      <div className="comp-header">
        <div>
          <h1>Stock Comparator</h1>
          <p className="page-subtitle">Compare up to 3 stocks — base-100 normalized chart</p>
        </div>
        <Link to="/" className="back-link">← Home</Link>
      </div>

      <div className="comp-suggestions">
        <span className="comp-suggestions-label">Quick picks:</span>
        {QUICK_PICKS.map(sg => (
          <button key={sg.label}
            className={`comp-suggestion-btn ${JSON.stringify(symbols) === JSON.stringify(sg.symbols) ? 'active' : ''}`}
            onClick={() => { setSymbols(sg.symbols); setStockData({}); }}>
            {sg.label}
          </button>
        ))}
      </div>

      <div className="comp-selection">
        {symbols.map((sym, i) => {
          const d = stockData[sym];
          const change = calcChange(sym);
          const isPos  = change != null && change >= 0;
          return (
            <div key={sym} className="comp-slot" style={{ '--slot-color': COLORS[i] }}>
              <div className="comp-slot-header">
                {d?.profile?.image && <img src={d.profile.image} alt={sym} className="comp-slot-logo" onError={e => e.target.style.display='none'} />}
                <div className="comp-slot-info">
                  <span className="comp-slot-symbol" style={{ color: COLORS[i] }}>{sym}</span>
                  <span className="comp-slot-name">{d?.quote?.name || '...'}</span>
                </div>
                <button className="comp-slot-remove" onClick={() => removeSymbol(sym)}>×</button>
              </div>
              {loading[sym] ? (
                <div className="comp-slot-loading">⏳ Loading...</div>
              ) : d?.quote ? (
                <div className="comp-slot-prix">
                  <span className="comp-slot-valeur">${Number(d.quote.price).toFixed(2)}</span>
                  {change != null && (
                    <span className={`comp-slot-variation ${isPos ? 'pos' : 'neg'}`}>
                      {isPos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}

        {symbols.length < 3 && (
          <div className="comp-slot comp-slot-add">
            <form onSubmit={e => { e.preventDefault(); addSymbol(inputVal); }}>
              <input type="text" value={inputVal} onChange={e => setInputVal(e.target.value.toUpperCase())}
                placeholder={symbols.length === 0 ? 'e.g. AAPL' : 'Add...'} className="comp-add-input"
                maxLength={12} autoFocus={symbols.length === 0} />
              <button type="submit" className="comp-add-btn" disabled={!inputVal.trim()}>+ Add</button>
            </form>
            <p className="comp-add-hint">
              {symbols.length === 0 ? 'Enter a US ticker (AAPL, MSFT, NVDA…)' : `${3 - symbols.length} slot${3 - symbols.length > 1 ? 's' : ''} remaining`}
            </p>
          </div>
        )}
      </div>

      {symbols.length > 0 && (
        <div className="detail-card" style={{ marginBottom: 16 }}>
          <div className="comp-chart-header">
            <div className="comp-legende">
              {symbols.map((sym, i) => {
                const change = calcChange(sym);
                const isPos  = change != null && change >= 0;
                return (
                  <div key={sym} className="comp-legende-item">
                    <span className="comp-legende-dot" style={{ background: COLORS[i] }} />
                    <span className="comp-legende-sym" style={{ color: COLORS[i] }}>{sym}</span>
                    {change != null && (
                      <span className={`comp-legende-var ${isPos ? 'pos' : 'neg'}`}>{isPos?'+':''}{change.toFixed(2)}%</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="lwc-timeframes">
              {TIMEFRAMES.map(tf => (
                <button key={tf.label} className={`lwc-tf-btn ${timeframe === tf.label ? 'active' : ''}`} onClick={() => setTimeframe(tf.label)}>{tf.label}</button>
              ))}
            </div>
          </div>
          <div style={{ fontSize:'0.72rem', color:'var(--text-dim)', marginBottom:8, textAlign:'right' }}>Base 100 — relative performance</div>
          <ComparisonChart series={chartSeries} />
        </div>
      )}

      {symbols.some(sym => stockData[sym]?.quote) && (
        <div className="detail-card">
          <h3 style={{ marginBottom:16 }}>Metrics Comparison</h3>
          <div className="comp-table-wrapper">
            <table className="comp-table">
              <thead>
                <tr>
                  <th className="comp-th-label">Metric</th>
                  {symbols.map((sym, i) => <th key={sym} style={{ color: COLORS[i] }}>{sym}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="comp-tr-section"><td colSpan={symbols.length+1}>Price &amp; Market</td></tr>
                {[
                  ['Price',      sym => stockData[sym]?.quote?.price ? `$${Number(stockData[sym].quote.price).toFixed(2)}` : '—'],
                  ['Market Cap', sym => `$${fmtAmt(stockData[sym]?.quote?.marketCap)}`],
                  ['Volume',     sym => { const v = stockData[sym]?.quote?.volume; return v ? `${(v/1e6).toFixed(1)} M` : '—'; }],
                  ['52w High',   sym => stockData[sym]?.quote?.yearHigh ? `$${Number(stockData[sym].quote.yearHigh).toFixed(2)}` : '—'],
                  ['52w Low',    sym => stockData[sym]?.quote?.yearLow  ? `$${Number(stockData[sym].quote.yearLow).toFixed(2)}`  : '—'],
                ].map(([label, fn]) => (
                  <tr key={label}><td className="comp-td-label">{label}</td>{symbols.map(sym => <td key={sym}>{fn(sym)}</td>)}</tr>
                ))}

                <tr className="comp-tr-section"><td colSpan={symbols.length+1}>Valuation (from quote)</td></tr>
                {[
                  ['P/E',        sym => fmt(stockData[sym]?.quote?.pe)],
                  ['EPS',        sym => `$${fmt(stockData[sym]?.quote?.eps)}`],
                ].map(([label, fn]) => (
                  <tr key={label}><td className="comp-td-label">{label}</td>
                    {symbols.map(sym => {
                      const val  = fn(sym);
                      const vals = symbols.map(s => parseFloat(fn(s))).filter(v => !isNaN(v));
                      const best = vals.length > 1 && parseFloat(val) === Math.min(...vals) && val !== '—';
                      return <td key={sym} className={best ? 'comp-best' : ''}>{val}</td>;
                    })}
                  </tr>
                ))}

                <tr className="comp-tr-section"><td colSpan={symbols.length+1}>Company</td></tr>
                {[
                  ['Sector',  sym => stockData[sym]?.profile?.sector  || '—'],
                  ['Country', sym => stockData[sym]?.profile?.country || '—'],
                ].map(([label, fn]) => (
                  <tr key={label}><td className="comp-td-label">{label}</td>{symbols.map(sym => <td key={sym}>{fn(sym)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize:'0.72rem', color:'var(--text-dim)', marginTop:12 }}>
            ℹ️ Additional ratios (P/B, ROE, margins…) require a paid FMP plan.
          </p>
        </div>
      )}

      {symbols.length === 0 && (
        <div className="comp-empty">
          <div className="comp-empty-icon">📊</div>
          <h2>Compare stocks in seconds</h2>
          <p>Add 2 or 3 US ticker symbols to compare their performance.</p>
        </div>
      )}
    </div>
  );
}

export default Comparateur;
