// Stock Comparator page — up to 3 stocks overlaid on the same base-100 chart
// Normalized chart + side-by-side metrics table
import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { createChart, LineSeries } from 'lightweight-charts';
import { getBatchQuotes, getHistoricalPrice, getRatiosTTM, getCompanyProfile } from '../services/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

const TIMEFRAMES = [
  { label: '1M',  days: 30   },
  { label: '3M',  days: 90   },
  { label: '6M',  days: 180  },
  { label: '1Y',  days: 365  },
  { label: '3Y',  days: 1095 },
  { label: '5Y',  days: 1825 },
];

const QUICK_PICKS = [
  { label: 'GAFAM',       symbols: ['AAPL', 'MSFT', 'GOOGL'] },
  { label: 'French Lux.',  symbols: ['MC.PA', 'RMS.PA', 'OR.PA'] },
  { label: 'Energy',       symbols: ['TTE.PA', 'SHEL.L', 'XOM'] },
  { label: 'Semis',        symbols: ['NVDA', 'ASML.AS', 'AMD'] },
  { label: 'Banks',        symbols: ['BNP.PA', 'SAN.PA', 'GS'] },
];

function getCurrency(symbol) {
  if (symbol.includes('.PA') || symbol.includes('.DE') || symbol.includes('.AS')) return '€';
  if (symbol.includes('.L'))  return '£';
  if (symbol.includes('.T'))  return '¥';
  if (symbol.includes('.HK')) return 'HK$';
  return '$';
}

function fmtAmt(val) {
  if (val == null || isNaN(val)) return '—';
  const n = Number(val);
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(1) + ' T';
  if (Math.abs(n) >= 1e9)  return (n / 1e9).toFixed(1)  + ' B';
  if (Math.abs(n) >= 1e6)  return (n / 1e6).toFixed(0)  + ' M';
  return n.toLocaleString('en-US');
}
function fmt(val, dec = 2)  { if (val == null || isNaN(Number(val))) return '—'; return Number(val).toFixed(dec); }
function fmtPct(val)        { if (val == null || isNaN(Number(val))) return '—'; return (Number(val) * 100).toFixed(1) + '%'; }

// ─── Multi-line normalized base-100 chart ───
function ComparisonChart({ series }) {
  const containerRef = useRef(null);

  function normalize(data) {
    if (!data || data.length === 0) return [];
    const first = data[0].close || data[0].value || 0;
    if (first === 0) return [];
    return data
      .map(d => ({ time: d.date || d.time, value: ((d.close || d.value) / first) * 100 }))
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

    // Base-100 reference line
    const baseLine = chart.addSeries(LineSeries, { color: 'rgba(255,255,255,0.1)', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });

    let baseSet = false;
    series.forEach((s, i) => {
      if (!s.data || s.data.length === 0) return;
      const norm = normalize(s.data);
      if (norm.length === 0) return;
      if (!baseSet) {
        baseLine.setData([{ time: norm[0].time, value: 100 }, { time: norm[norm.length - 1].time, value: 100 }]);
        baseSet = true;
      }
      const line = chart.addSeries(LineSeries, {
        color: COLORS[i], lineWidth: 2,
        lastValueVisible: true, priceLineVisible: false,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: COLORS[i], crosshairMarkerBackgroundColor: COLORS[i],
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
        <span>Add stocks to compare</span>
      </div>
    );
  }
  return <div ref={containerRef} className="lwc-container" style={{ height: 360 }} />;
}

// ─── Main page ───
function Comparateur() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [symbols, setSymbols] = useState(() => {
    const s = searchParams.get('symbols');
    return s ? s.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 3) : [];
  });
  const [inputVal, setInputVal]       = useState('');
  const [timeframe, setTimeframe]     = useState('3M');
  const [stockData, setStockData]     = useState({});
  const [loading, setLoading]         = useState({});
  const [errors, setErrors]           = useState({});

  // Sync URL
  useEffect(() => {
    if (symbols.length > 0) setSearchParams({ symbols: symbols.join(',') });
    else setSearchParams({});
  }, [symbols]);

  useEffect(() => {
    symbols.forEach(sym => loadStock(sym));
  }, [symbols, timeframe]);

  async function loadStock(sym) {
    // Skip if history for this timeframe is already cached
    if (stockData[sym]?.history?.[timeframe]) return;

    setLoading(prev => ({ ...prev, [sym]: true }));
    setErrors(prev => ({ ...prev, [sym]: null }));

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

      setStockData(prev => ({
        ...prev,
        [sym]: {
          quote, profile, ratios,
          history: { ...(prev[sym]?.history || {}), [timeframe]: history },
        },
      }));
    } catch (err) {
      setErrors(prev => ({ ...prev, [sym]: err.message }));
    }
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

  function applyQuickPick(syms) {
    setSymbols(syms);
    setStockData({});
  }

  const chartSeries = symbols.map(sym => ({
    symbol: sym,
    data: stockData[sym]?.history?.[timeframe] || [],
  }));

  function calcChange(sym) {
    const data = stockData[sym]?.history?.[timeframe];
    if (!data || data.length < 2) return null;
    const start = data[0].close;
    const end   = data[data.length - 1].close;
    if (!start) return null;
    return ((end - start) / start) * 100;
  }

  return (
    <div className="comp-page">

      {/* ── Header ── */}
      <div className="comp-header">
        <div>
          <h1>Stock Comparator</h1>
          <p className="page-subtitle">Compare up to 3 stocks on the same base-100 chart</p>
        </div>
        <Link to="/" className="back-link">← Home</Link>
      </div>

      {/* ── Quick picks ── */}
      <div className="comp-suggestions">
        <span className="comp-suggestions-label">Quick picks:</span>
        {QUICK_PICKS.map(sg => (
          <button
            key={sg.label}
            className={`comp-suggestion-btn ${JSON.stringify(symbols) === JSON.stringify(sg.symbols) ? 'active' : ''}`}
            onClick={() => applyQuickPick(sg.symbols)}
          >{sg.label}</button>
        ))}
      </div>

      {/* ── Symbol slots ── */}
      <div className="comp-selection">
        {symbols.map((sym, i) => {
          const d = stockData[sym];
          const change = calcChange(sym);
          const isPos  = change != null && change >= 0;
          return (
            <div key={sym} className="comp-slot" style={{ '--slot-color': COLORS[i] }}>
              <div className="comp-slot-header">
                {d?.profile?.image && (
                  <img src={d.profile.image} alt={sym} className="comp-slot-logo"
                       onError={e => e.target.style.display = 'none'} />
                )}
                <div className="comp-slot-info">
                  <span className="comp-slot-symbol" style={{ color: COLORS[i] }}>{sym}</span>
                  <span className="comp-slot-name">{d?.quote?.name || d?.profile?.companyName || '...'}</span>
                </div>
                <button className="comp-slot-remove" onClick={() => removeSymbol(sym)}>×</button>
              </div>
              {loading[sym] ? (
                <div className="comp-slot-loading">⏳ Loading...</div>
              ) : d?.quote ? (
                <div className="comp-slot-prix">
                  <span className="comp-slot-valeur">{Number(d.quote.price).toFixed(2)} {getCurrency(sym)}</span>
                  {change != null && (
                    <span className={`comp-slot-variation ${isPos ? 'pos' : 'neg'}`}>
                      {isPos ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                    </span>
                  )}
                </div>
              ) : errors[sym] ? (
                <div className="comp-slot-erreur">⚠️ Failed to load</div>
              ) : null}
            </div>
          );
        })}

        {/* Add slot */}
        {symbols.length < 3 && (
          <div className="comp-slot comp-slot-add">
            <form onSubmit={e => { e.preventDefault(); addSymbol(inputVal); }}>
              <input
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value.toUpperCase())}
                placeholder={symbols.length === 0 ? 'e.g. AAPL' : 'Add...'}
                className="comp-add-input"
                maxLength={12}
                autoFocus={symbols.length === 0}
              />
              <button type="submit" className="comp-add-btn" disabled={!inputVal.trim()}>
                + Add
              </button>
            </form>
            <p className="comp-add-hint">
              {symbols.length === 0
                ? 'Enter a ticker symbol (e.g. MC.PA, NVDA…)'
                : `${3 - symbols.length} slot${3 - symbols.length > 1 ? 's' : ''} remaining`}
            </p>
          </div>
        )}
      </div>

      {/* ── Chart ── */}
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
                      <span className={`comp-legende-var ${isPos ? 'pos' : 'neg'}`}>
                        {isPos ? '+' : ''}{change.toFixed(2)}%
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
            Base 100 — relative performance since start of period
          </div>
          <ComparisonChart series={chartSeries} />
        </div>
      )}

      {/* ── Metrics table ── */}
      {symbols.some(sym => stockData[sym]?.quote) && (
        <div className="detail-card">
          <h3 style={{ marginBottom: 16 }}>Metrics Comparison</h3>
          <div className="comp-table-wrapper">
            <table className="comp-table">
              <thead>
                <tr>
                  <th className="comp-th-label">Metric</th>
                  {symbols.map((sym, i) => (
                    <th key={sym} style={{ color: COLORS[i] }}>{sym}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Price & Market */}
                <tr className="comp-tr-section"><td colSpan={symbols.length + 1}>Price &amp; Market</td></tr>
                {[
                  ['Price',       sym => { const q = stockData[sym]?.quote; return q ? `${Number(q.price).toFixed(2)} ${getCurrency(sym)}` : '—'; }],
                  ['Market Cap',  sym => fmtAmt(stockData[sym]?.quote?.marketCap)],
                  ['Volume',      sym => { const v = stockData[sym]?.quote?.volume; return v ? `${(v/1e6).toFixed(1)} M` : '—'; }],
                  ['52w High',    sym => { const q = stockData[sym]?.quote; return q?.yearHigh ? `${Number(q.yearHigh).toFixed(2)} ${getCurrency(sym)}` : '—'; }],
                  ['52w Low',     sym => { const q = stockData[sym]?.quote; return q?.yearLow  ? `${Number(q.yearLow).toFixed(2)} ${getCurrency(sym)}` : '—'; }],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symbols.map(sym => <td key={sym}>{fn(sym)}</td>)}
                  </tr>
                ))}

                {/* Valuation */}
                <tr className="comp-tr-section"><td colSpan={symbols.length + 1}>Valuation</td></tr>
                {[
                  ['P/E (TTM)',   sym => fmt(stockData[sym]?.ratios?.peRatioTTM)],
                  ['P/B (TTM)',   sym => fmt(stockData[sym]?.ratios?.priceToBookRatioTTM)],
                  ['P/S (TTM)',   sym => fmt(stockData[sym]?.ratios?.priceToSalesRatioTTM)],
                  ['EV/EBITDA',  sym => fmt(stockData[sym]?.ratios?.enterpriseValueOverEBITDATTM)],
                  ['PEG Ratio',  sym => fmt(stockData[sym]?.ratios?.pegRatioTTM)],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symbols.map(sym => {
                      const val  = fn(sym);
                      const vals = symbols.map(s => parseFloat(fn(s))).filter(v => !isNaN(v));
                      const isBest = vals.length > 1 && parseFloat(val) === Math.min(...vals) && val !== '—';
                      return <td key={sym} className={isBest ? 'comp-best' : ''}>{val}</td>;
                    })}
                  </tr>
                ))}

                {/* Profitability */}
                <tr className="comp-tr-section"><td colSpan={symbols.length + 1}>Profitability</td></tr>
                {[
                  ['ROE',            sym => fmtPct(stockData[sym]?.ratios?.returnOnEquityTTM)],
                  ['ROA',            sym => fmtPct(stockData[sym]?.ratios?.returnOnAssetsTTM)],
                  ['Gross Margin',   sym => fmtPct(stockData[sym]?.ratios?.grossProfitMarginTTM)],
                  ['Net Margin',     sym => fmtPct(stockData[sym]?.ratios?.netProfitMarginTTM)],
                  ['Oper. Margin',   sym => fmtPct(stockData[sym]?.ratios?.operatingProfitMarginTTM)],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symbols.map(sym => {
                      const val  = fn(sym);
                      const vals = symbols.map(s => parseFloat(fn(s))).filter(v => !isNaN(v));
                      const isBest = vals.length > 1 && parseFloat(val) === Math.max(...vals) && val !== '—';
                      return <td key={sym} className={isBest ? 'comp-best' : ''}>{val}</td>;
                    })}
                  </tr>
                ))}

                {/* Dividend */}
                <tr className="comp-tr-section"><td colSpan={symbols.length + 1}>Dividend</td></tr>
                {[
                  ['Yield',         sym => { const r = stockData[sym]?.ratios?.dividendYielPercentageTTM; return r != null ? fmt(r, 2) + '%' : '—'; }],
                  ['Payout Ratio',  sym => { const r = stockData[sym]?.ratios?.payoutRatioTTM; return r != null ? fmt(r * 100, 1) + '%' : '—'; }],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symbols.map(sym => <td key={sym}>{fn(sym)}</td>)}
                  </tr>
                ))}

                {/* Financial health */}
                <tr className="comp-tr-section"><td colSpan={symbols.length + 1}>Financial Health</td></tr>
                {[
                  ['Debt / Equity',  sym => fmt(stockData[sym]?.ratios?.debtEquityRatioTTM)],
                  ['Current Ratio',  sym => fmt(stockData[sym]?.ratios?.currentRatioTTM)],
                  ['Sector',         sym => stockData[sym]?.profile?.sector  || '—'],
                  ['Country',        sym => stockData[sym]?.profile?.country || '—'],
                ].map(([label, fn]) => (
                  <tr key={label}>
                    <td className="comp-td-label">{label}</td>
                    {symbols.map(sym => <td key={sym}>{fn(sym)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 12 }}>
            ✦ Best value in each row is highlighted in green.
          </p>
        </div>
      )}

      {/* Empty state */}
      {symbols.length === 0 && (
        <div className="comp-empty">
          <div className="comp-empty-icon">📊</div>
          <h2>Compare stocks in seconds</h2>
          <p>Add 2 or 3 ticker symbols to see their relative performance and metrics side by side.</p>
          <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Examples: AAPL · MSFT · MC.PA · ASML.AS · TTE.PA
          </p>
        </div>
      )}
    </div>
  );
}

export default Comparateur;
