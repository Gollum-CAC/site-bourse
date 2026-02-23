// Page détail d'une action — Design Bloomberg, logo, KPI chips, onglets pill
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getQuote, getCompanyProfile, getDividends, getHistoricalPrice, getKeyMetrics, getRatiosTTM, getIncomeStatement, getBalanceSheet, getCashFlow } from '../services/api';
import PriceChart from '../components/PriceChart';

const PERIODS = [
  { label: '1S', days: 7   },
  { label: '1M', days: 30  },
  { label: '3M', days: 90  },
  { label: '6M', days: 180 },
  { label: '1A', days: 365 },
  { label: '5A', days: 1825 },
];

function StockDetail() {
  const { symbol } = useParams();
  const [quote, setQuote]               = useState(null);
  const [profile, setProfile]           = useState(null);
  const [dividends, setDividends]       = useState([]);
  const [chartData, setChartData]       = useState([]);
  const [ratios, setRatios]             = useState(null);
  const [ratiosTTM, setRatiosTTM]       = useState(null);
  const [incomeStatement, setIncomeStatement] = useState([]);
  const [balanceSheet, setBalanceSheet] = useState([]);
  const [cashFlow, setCashFlow]         = useState([]);
  const [financialPeriod, setFinancialPeriod] = useState('annual');
  const [loading, setLoading]           = useState(true);
  const [selectedPeriod, setSelectedPeriod]   = useState(PERIODS[2]);
  const [isInWatchlist, setIsInWatchlist]     = useState(false);
  const [activeTab, setActiveTab]       = useState('graphique');

  useEffect(() => { loadData(); checkWatchlist(); }, [symbol]);
  useEffect(() => { loadChartData(); }, [symbol, selectedPeriod]);
  useEffect(() => { if (activeTab === 'financials') loadFinancials(); }, [activeTab, financialPeriod, symbol]);

  function checkWatchlist() {
    const wl = JSON.parse(localStorage.getItem('watchlist') || '[]');
    setIsInWatchlist(wl.includes(symbol.toUpperCase()));
  }

  function toggleWatchlist() {
    const wl = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const sym = symbol.toUpperCase();
    const updated = wl.includes(sym) ? wl.filter(s => s !== sym) : [...wl, sym];
    localStorage.setItem('watchlist', JSON.stringify(updated));
    setIsInWatchlist(!wl.includes(sym));
  }

  async function loadData() {
    setLoading(true);
    const [q, p, d, r, rt] = await Promise.allSettled([
      getQuote(symbol), getCompanyProfile(symbol), getDividends(symbol),
      getKeyMetrics(symbol), getRatiosTTM(symbol),
    ]);
    setQuote(q.status === 'fulfilled' ? q.value?.[0] : null);
    setProfile(p.status === 'fulfilled' ? p.value?.[0] : null);
    if (d.status === 'fulfilled') {
      const dv = d.value;
      setDividends(Array.isArray(dv) ? dv.slice(0, 20) : dv?.historical?.slice(0, 20) || []);
    }
    if (r.status === 'fulfilled' && Array.isArray(r.value)) setRatios(r.value);
    if (rt.status === 'fulfilled') { const v = rt.value; setRatiosTTM(Array.isArray(v) ? v[0] : v); }
    setLoading(false);
  }

  async function loadChartData() {
    try {
      const to = new Date().toISOString().split('T')[0];
      const f  = new Date(); f.setDate(f.getDate() - selectedPeriod.days);
      const data = await getHistoricalPrice(symbol, f.toISOString().split('T')[0], to);
      setChartData(Array.isArray(data) ? data : data?.historical || []);
    } catch { setChartData([]); }
  }

  async function loadFinancials() {
    const [i, b, c] = await Promise.allSettled([
      getIncomeStatement(symbol, financialPeriod),
      getBalanceSheet(symbol, financialPeriod),
      getCashFlow(symbol, financialPeriod),
    ]);
    if (i.status === 'fulfilled') setIncomeStatement(Array.isArray(i.value) ? i.value : []);
    if (b.status === 'fulfilled') setBalanceSheet(Array.isArray(b.value) ? b.value : []);
    if (c.status === 'fulfilled') setCashFlow(Array.isArray(c.value) ? c.value : []);
  }

  function fmt(val, dec = 2)  { if (val == null || isNaN(val)) return '—'; return Number(val).toFixed(dec); }
  function fmtPct(val)        { if (val == null || isNaN(val)) return '—'; return (Number(val) * 100).toFixed(2) + '%'; }
  function fmtAmt(val) {
    if (val == null || isNaN(val)) return '—';
    const n = Number(val);
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + ' T';
    if (Math.abs(n) >= 1e9)  return (n / 1e9).toFixed(2)  + ' Mds';
    if (Math.abs(n) >= 1e6)  return (n / 1e6).toFixed(1)  + ' M';
    return n.toLocaleString('fr-FR');
  }

  // Devise selon suffixe ou profil
  const cur = profile?.currency === 'EUR'
    || symbol.includes('.PA') || symbol.includes('.DE')
    || symbol.includes('.AS') || symbol.includes('.BR')
    ? '€'
    : symbol.includes('.T')  ? '¥'
    : symbol.includes('.HK') ? 'HK$'
    : symbol.includes('.L')  ? '£'
    : '$';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--text-muted)' }}>
      <span style={{ fontSize: '1.4rem' }}>⏳</span>
      <span>Chargement de {symbol}…</span>
    </div>
  );

  if (!quote) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--red-light)' }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
      <p>Impossible de charger les données pour <strong>{symbol}</strong></p>
      <Link to="/" style={{ color: 'var(--blue-light)', marginTop: 16, display: 'inline-block' }}>← Retour à l'accueil</Link>
    </div>
  );

  const isPositive = (quote.change ?? 0) >= 0;
  const pct        = quote.changePercentage ?? quote.changesPercentage ?? 0;

  // KPI chips
  const kpis = [
    { label: 'Ouverture',  value: quote.open     ? `${Number(quote.open).toFixed(2)} ${cur}`     : '—' },
    { label: '+Haut 52s',  value: quote.yearHigh ? `${Number(quote.yearHigh).toFixed(2)} ${cur}` : '—' },
    { label: '+Bas 52s',   value: quote.yearLow  ? `${Number(quote.yearLow).toFixed(2)} ${cur}`  : '—' },
    { label: 'Moy. 50j',   value: quote.priceAvg50  ? `${Number(quote.priceAvg50).toFixed(2)} ${cur}`  : '—' },
    { label: 'Moy. 200j',  value: quote.priceAvg200 ? `${Number(quote.priceAvg200).toFixed(2)} ${cur}` : '—' },
    { label: 'P/E',        value: ratiosTTM?.peRatioTTM ? Number(ratiosTTM.peRatioTTM).toFixed(1) : (quote.pe ? Number(quote.pe).toFixed(1) : '—') },
    { label: 'Cap.',       value: `${fmtAmt(quote.marketCap)} ${cur}` },
    { label: 'Volume',     value: quote.volume ? `${(quote.volume / 1e6).toFixed(1)} M` : '—' },
  ];

  const TABS = [
    { key: 'graphique',    label: 'Graphique' },
    { key: 'fondamentaux', label: 'Ratios' },
    { key: 'financials',   label: 'Financiers' },
    { key: 'dividendes',   label: 'Dividendes' },
    { key: 'profil',       label: 'Profil' },
  ];

  return (
    <div className="stock-detail-page">

      {/* ── Barre de navigation ── */}
      <div className="detail-top-bar">
        <Link to="/" className="back-link">← Accueil</Link>
        <button className={`watchlist-btn ${isInWatchlist ? 'active' : ''}`} onClick={toggleWatchlist}>
          {isInWatchlist ? '★ Watchlist' : '☆ Ajouter'}
        </button>
      </div>

      {/* ── En-tête enrichi ── */}
      <div className="detail-header">
        {/* Logo + titre */}
        <div className="detail-header-left">
          {profile?.image
            ? <img src={profile.image} alt={symbol} className="detail-logo"
                   onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            : null
          }
          <div className="detail-logo-placeholder" style={{ display: profile?.image ? 'none' : 'flex' }}>
            {symbol?.slice(0, 2)}
          </div>
          <div>
            <h1>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{symbol}</span>
              <span className="detail-name"> — {quote.name}</span>
            </h1>
            {profile && (
              <span className="detail-sector">
                {[profile.sector, profile.exchange, profile.country].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        </div>

        {/* Prix + variation */}
        <div className="detail-price-block">
          <span className="detail-price">
            {Number(quote.price).toFixed(2)}
            <small style={{ fontSize: '1rem', color: 'var(--text-muted)', marginLeft: 6 }}>{cur}</small>
          </span>
          <div className={`detail-change ${isPositive ? 'pos' : 'neg'}`}>
            {isPositive ? '▲' : '▼'} {Math.abs(quote.change || 0).toFixed(2)} {cur}
            <span className={`detail-change-badge ${isPositive ? 'pos' : 'neg'}`}>
              {isPositive ? '+' : ''}{Number(pct).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* KPI chips — s'étale sur toute la largeur */}
        <div className="detail-kpi-row">
          {kpis.map((k, i) => (
            <div key={i} className="kpi-chip">
              <span className="kpi-chip-label">{k.label}</span>
              <span className="kpi-chip-value">{k.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Onglets ── */}
      <div className="detail-tabs">
        {TABS.map(t => (
          <button key={t.key} className={activeTab === t.key ? 'tab-active' : ''} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════
          ONGLET GRAPHIQUE
      ════════════════════════════════ */}
      {activeTab === 'graphique' && (
        <div className="detail-card">
          <div className="chart-header">
            <h3 style={{ textTransform: 'none', fontSize: '1rem', color: 'var(--text-primary)' }}>
              Historique des prix — {quote.name}
            </h3>
            <div className="period-buttons">
              {PERIODS.map(p => (
                <button key={p.label}
                  className={selectedPeriod.label === p.label ? 'period-active' : ''}
                  onClick={() => setSelectedPeriod(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <PriceChart data={chartData} period={selectedPeriod} />
          <div className="market-data-grid">
            {[
              ['Ouverture',    `${fmt(quote.open)} ${cur}`],
              ['Haut (jour)',  `${fmt(quote.dayHigh)} ${cur}`],
              ['Bas (jour)',   `${fmt(quote.dayLow)} ${cur}`],
              ['Haut (52s)',   `${fmt(quote.yearHigh)} ${cur}`],
              ['Bas (52s)',    `${fmt(quote.yearLow)} ${cur}`],
              ['Volume',       quote.volume?.toLocaleString('fr-FR') || '—'],
              ['Cap. bours.',  `${fmtAmt(quote.marketCap)} ${cur}`],
              ['Moy. 50j',    `${fmt(quote.priceAvg50)} ${cur}`],
              ['Moy. 200j',   `${fmt(quote.priceAvg200)} ${cur}`],
            ].map(([label, value]) => (
              <div key={label} className="market-data-item">
                <span>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          ONGLET RATIOS
      ════════════════════════════════ */}
      {activeTab === 'fondamentaux' && (
        <div className="detail-grid">
          <div className="detail-card">
            <h3>Ratios de valorisation (TTM)</h3>
            <div className="detail-rows">
              {[
                ['P/E (Price/Earnings)',   fmt(ratiosTTM?.peRatioTTM)],
                ['P/B (Price/Book)',       fmt(ratiosTTM?.priceToBookRatioTTM)],
                ['P/S (Price/Sales)',      fmt(ratiosTTM?.priceToSalesRatioTTM)],
                ['PEG Ratio',             fmt(ratiosTTM?.pegRatioTTM)],
                ['EV/EBITDA',             fmt(ratiosTTM?.enterpriseValueOverEBITDATTM)],
                ['Rendement dividende',   `${fmt(ratiosTTM?.dividendYielPercentageTTM)}%`],
                ['Payout Ratio',          `${fmt(ratiosTTM?.payoutRatioTTM)}`],
              ].map(([label, value]) => (
                <div key={label} className="detail-row">
                  <span>{label}</span><span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-card">
            <h3>Rentabilité (TTM)</h3>
            <div className="detail-rows">
              {[
                ['ROE (Return on Equity)', fmtPct(ratiosTTM?.returnOnEquityTTM)],
                ['ROA (Return on Assets)', fmtPct(ratiosTTM?.returnOnAssetsTTM)],
                ['ROIC',                  fmtPct(ratiosTTM?.returnOnCapitalEmployedTTM)],
                ['Marge brute',           fmtPct(ratiosTTM?.grossProfitMarginTTM)],
                ['Marge opérationnelle',  fmtPct(ratiosTTM?.operatingProfitMarginTTM)],
                ['Marge nette',           fmtPct(ratiosTTM?.netProfitMarginTTM)],
              ].map(([label, value]) => (
                <div key={label} className="detail-row">
                  <span>{label}</span><span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-card">
            <h3>Santé financière (TTM)</h3>
            <div className="detail-rows">
              {[
                ['Dette / Equity',        fmt(ratiosTTM?.debtEquityRatioTTM)],
                ['Current Ratio',         fmt(ratiosTTM?.currentRatioTTM)],
                ['Quick Ratio',           fmt(ratiosTTM?.quickRatioTTM)],
                ['Couverture intérêts',   fmt(ratiosTTM?.interestCoverageTTM)],
                ['Cash par action',       `${fmt(ratiosTTM?.cashPerShareTTM)} ${cur}`],
                ['Croissance revenus',    fmtPct(ratiosTTM?.revenueGrowthTTM)],
                ['Croissance bénéfice',   fmtPct(ratiosTTM?.netIncomeGrowthTTM)],
              ].map(([label, value]) => (
                <div key={label} className="detail-row">
                  <span>{label}</span><span>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {ratios?.length > 0 && (
            <div className="detail-card">
              <h3>Évolution historique</h3>
              <table className="ratios-history-table">
                <thead>
                  <tr><th>Année</th><th>P/E</th><th>ROE</th><th>Marge nette</th><th>Dette/Eq.</th></tr>
                </thead>
                <tbody>
                  {ratios.slice(0, 6).map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.date?.split('-')[0] || r.calendarYear || '—'}</td>
                      <td>{fmt(r.peRatio)}</td>
                      <td>{fmtPct(r.roeTTM || r.roe)}</td>
                      <td>{fmtPct(r.netIncomePerRevenueTTM || r.netIncomePerRevenue)}</td>
                      <td>{fmt(r.debtToEquityTTM || r.debtToEquity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          ONGLET ÉTATS FINANCIERS
      ════════════════════════════════ */}
      {activeTab === 'financials' && (
        <div>
          <div className="financial-period-toggle">
            <button className={financialPeriod === 'annual'  ? 'period-active' : ''} onClick={() => setFinancialPeriod('annual')}>Annuel</button>
            <button className={financialPeriod === 'quarter' ? 'period-active' : ''} onClick={() => setFinancialPeriod('quarter')}>Trimestriel</button>
          </div>

          {incomeStatement.length > 0 && (
            <div className="detail-card financial-table-card">
              <h3>Compte de résultat</h3>
              <div className="financial-table-wrapper">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Poste</th>
                      {incomeStatement.map((s, i) => (
                        <th key={i}>{s.date?.split('-')[0] || s.calendarYear}{financialPeriod === 'quarter' ? ` Q${s.period?.replace('Q', '')}` : ''}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Chiffre d'affaires",         s => fmtAmt(s.revenue)],
                      ["Coût des ventes",             s => fmtAmt(s.costOfRevenue)],
                    ].map(([label, fn]) => (
                      <tr key={label}><td>{label}</td>{incomeStatement.map((s,i) => <td key={i}>{fn(s)} {cur}</td>)}</tr>
                    ))}
                    <tr className="financial-subtotal">
                      <td>Marge brute</td>{incomeStatement.map((s,i) => <td key={i}>{fmtAmt(s.grossProfit)} {cur}</td>)}
                    </tr>
                    {[
                      ["Frais R&D",                  s => fmtAmt(s.researchAndDevelopmentExpenses)],
                      ["Frais admin. & commerciaux", s => fmtAmt(s.sellingGeneralAndAdministrativeExpenses)],
                    ].map(([label, fn]) => (
                      <tr key={label}><td>{label}</td>{incomeStatement.map((s,i) => <td key={i}>{fn(s)} {cur}</td>)}</tr>
                    ))}
                    <tr className="financial-subtotal">
                      <td>Résultat opérationnel</td>{incomeStatement.map((s,i) => <td key={i}>{fmtAmt(s.operatingIncome)} {cur}</td>)}
                    </tr>
                    <tr><td>EBITDA</td>{incomeStatement.map((s,i) => <td key={i}>{fmtAmt(s.ebitda)} {cur}</td>)}</tr>
                    <tr><td>Charges d'intérêts</td>{incomeStatement.map((s,i) => <td key={i}>{fmtAmt(s.interestExpense)} {cur}</td>)}</tr>
                    <tr className="financial-total">
                      <td>Résultat net</td>{incomeStatement.map((s,i) => <td key={i}>{fmtAmt(s.netIncome)} {cur}</td>)}
                    </tr>
                    <tr><td>BPA (EPS)</td>{incomeStatement.map((s,i) => <td key={i}>{fmt(s.eps)} {cur}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {balanceSheet.length > 0 && (
            <div className="detail-card financial-table-card">
              <h3>Bilan comptable</h3>
              <div className="financial-table-wrapper">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Poste</th>
                      {balanceSheet.map((s, i) => (
                        <th key={i}>{s.date?.split('-')[0] || s.calendarYear}{financialPeriod === 'quarter' ? ` Q${s.period?.replace('Q', '')}` : ''}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Trésorerie",              s => fmtAmt(s.cashAndCashEquivalents)],
                      ["Placements court terme",  s => fmtAmt(s.shortTermInvestments)],
                      ["Créances clients",        s => fmtAmt(s.netReceivables)],
                      ["Stocks",                  s => fmtAmt(s.inventory)],
                    ].map(([label, fn]) => (
                      <tr key={label}><td>{label}</td>{balanceSheet.map((s,i) => <td key={i}>{fn(s)} {cur}</td>)}</tr>
                    ))}
                    <tr className="financial-subtotal">
                      <td>Total actifs courants</td>{balanceSheet.map((s,i) => <td key={i}>{fmtAmt(s.totalCurrentAssets)} {cur}</td>)}
                    </tr>
                    {[
                      ["Immobilisations",  s => fmtAmt(s.propertyPlantEquipmentNet)],
                      ["Goodwill",         s => fmtAmt(s.goodwill)],
                    ].map(([label, fn]) => (
                      <tr key={label}><td>{label}</td>{balanceSheet.map((s,i) => <td key={i}>{fn(s)} {cur}</td>)}</tr>
                    ))}
                    <tr className="financial-total">
                      <td>Total actifs</td>{balanceSheet.map((s,i) => <td key={i}>{fmtAmt(s.totalAssets)} {cur}</td>)}
                    </tr>
                    {[
                      ["Dette court terme", s => fmtAmt(s.shortTermDebt)],
                      ["Dette long terme",  s => fmtAmt(s.longTermDebt)],
                    ].map(([label, fn]) => (
                      <tr key={label}><td>{label}</td>{balanceSheet.map((s,i) => <td key={i}>{fn(s)} {cur}</td>)}</tr>
                    ))}
                    <tr className="financial-subtotal">
                      <td>Total passifs</td>{balanceSheet.map((s,i) => <td key={i}>{fmtAmt(s.totalLiabilities)} {cur}</td>)}
                    </tr>
                    <tr className="financial-total">
                      <td>Capitaux propres</td>{balanceSheet.map((s,i) => <td key={i}>{fmtAmt(s.totalStockholdersEquity)} {cur}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {cashFlow.length > 0 && (
            <div className="detail-card financial-table-card">
              <h3>Flux de trésorerie</h3>
              <div className="financial-table-wrapper">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Poste</th>
                      {cashFlow.map((s, i) => (
                        <th key={i}>{s.date?.split('-')[0] || s.calendarYear}{financialPeriod === 'quarter' ? ` Q${s.period?.replace('Q', '')}` : ''}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Résultat net",      s => fmtAmt(s.netIncome)],
                      ["Amortissements",    s => fmtAmt(s.depreciationAndAmortization)],
                    ].map(([label, fn]) => (
                      <tr key={label}><td>{label}</td>{cashFlow.map((s,i) => <td key={i}>{fn(s)} {cur}</td>)}</tr>
                    ))}
                    <tr className="financial-subtotal">
                      <td>Flux opérationnel</td>{cashFlow.map((s,i) => <td key={i}>{fmtAmt(s.operatingCashFlow)} {cur}</td>)}
                    </tr>
                    {[
                      ["CAPEX",         s => fmtAmt(s.capitalExpenditure)],
                      ["Acquisitions",  s => fmtAmt(s.acquisitionsNet)],
                    ].map(([label, fn]) => (
                      <tr key={label}><td>{label}</td>{cashFlow.map((s,i) => <td key={i}>{fn(s)} {cur}</td>)}</tr>
                    ))}
                    <tr className="financial-total">
                      <td>Free Cash Flow</td>{cashFlow.map((s,i) => <td key={i}>{fmtAmt(s.freeCashFlow)} {cur}</td>)}
                    </tr>
                    {[
                      ["Rachat d'actions", s => fmtAmt(s.commonStockRepurchased)],
                      ["Dividendes versés",s => fmtAmt(s.dividendsPaid)],
                    ].map(([label, fn]) => (
                      <tr key={label}><td>{label}</td>{cashFlow.map((s,i) => <td key={i}>{fn(s)} {cur}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {incomeStatement.length === 0 && balanceSheet.length === 0 && cashFlow.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              Aucune donnée financière disponible pour {symbol}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          ONGLET DIVIDENDES
      ════════════════════════════════ */}
      {activeTab === 'dividendes' && (
        <div className="detail-card">
          <h3>Historique des dividendes</h3>
          {dividends.length > 0 ? (
            <table className="dividends-table">
              <thead>
                <tr><th>Date ex-dividende</th><th>Montant</th><th>Date de paiement</th></tr>
              </thead>
              <tbody>
                {dividends.map((d, i) => (
                  <tr key={i}>
                    <td>{d.date || d.recordDate || '—'}</td>
                    <td className="dividend-amount">{fmt(d.dividend || d.adjDividend, 4)} {cur}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{d.paymentDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: 'var(--text-muted)', padding: '20px 0', textAlign: 'center' }}>
              Aucun dividende trouvé pour {symbol}
            </p>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          ONGLET PROFIL
      ════════════════════════════════ */}
      {activeTab === 'profil' && profile && (
        <div className="detail-grid">
          <div className="detail-card">
            <h3>Informations entreprise</h3>
            <div className="detail-rows">
              {[
                ['PDG',       profile.ceo],
                ['Secteur',   profile.sector],
                ['Industrie', profile.industry],
                ['Employés',  profile.fullTimeEmployees?.toLocaleString('fr-FR')],
                ['Pays',      profile.country],
                ['IPO',       profile.ipoDate],
              ].map(([label, value]) => (
                <div key={label} className="detail-row">
                  <span>{label}</span>
                  <span style={{ fontFamily: label === 'Employés' ? 'var(--font-mono)' : 'inherit' }}>
                    {value || '—'}
                  </span>
                </div>
              ))}
              <div className="detail-row">
                <span>Site web</span>
                {profile.website
                  ? <a href={profile.website} target="_blank" rel="noopener noreferrer" className="profile-link">↗ Visiter</a>
                  : <span>—</span>
                }
              </div>
            </div>
          </div>
          <div className="detail-card">
            <h3>Description</h3>
            <p className="company-description-full">
              {profile.description || 'Aucune description disponible.'}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

export default StockDetail;
