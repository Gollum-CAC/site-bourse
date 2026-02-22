// Page détail d'une action - Profil, graphique, dividendes, ratios, états financiers
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getQuote, getCompanyProfile, getDividends, getHistoricalPrice, getKeyMetrics, getRatiosTTM, getIncomeStatement, getBalanceSheet, getCashFlow } from '../services/api';
import PriceChart from '../components/PriceChart';

const PERIODS = [
  { label: '1S', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1A', days: 365 },
  { label: '5A', days: 1825 },
];

function StockDetail() {
  const { symbol } = useParams();
  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);
  const [dividends, setDividends] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [ratios, setRatios] = useState(null);
  const [ratiosTTM, setRatiosTTM] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState([]);
  const [balanceSheet, setBalanceSheet] = useState([]);
  const [cashFlow, setCashFlow] = useState([]);
  const [financialPeriod, setFinancialPeriod] = useState('annual');
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[2]);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [activeTab, setActiveTab] = useState('graphique');

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
    if (wl.includes(sym)) {
      localStorage.setItem('watchlist', JSON.stringify(wl.filter(s => s !== sym)));
      setIsInWatchlist(false);
    } else {
      wl.push(sym);
      localStorage.setItem('watchlist', JSON.stringify(wl));
      setIsInWatchlist(true);
    }
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
      const f = new Date(); f.setDate(f.getDate() - selectedPeriod.days);
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

  function fmt(val, dec = 2) { if (val == null || isNaN(val)) return 'N/A'; return Number(val).toFixed(dec); }
  function fmtPct(val) { if (val == null || isNaN(val)) return 'N/A'; return (Number(val) * 100).toFixed(2) + '%'; }
  function fmtAmt(val) {
    if (val == null || isNaN(val)) return 'N/A';
    const n = Number(val);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + ' Mds';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + ' M';
    return n.toLocaleString('fr-FR');
  }

  const cur = profile?.currency === 'EUR' || symbol.includes('.PA') || symbol.includes('.DE') || symbol.includes('.AS') ? '€' : '$';

  if (loading) return <p className="loading">Chargement des données de {symbol}...</p>;
  if (!quote) return <p className="error-message">Impossible de charger les données pour {symbol}</p>;

  const isPositive = quote.change >= 0;
  const changeColor = isPositive ? '#22c55e' : '#ef4444';

  return (
    <div className="stock-detail-page">
      <div className="detail-top-bar">
        <Link to="/" className="back-link">← Retour</Link>
        <button className={`watchlist-btn ${isInWatchlist ? 'active' : ''}`} onClick={toggleWatchlist}>
          {isInWatchlist ? '★ Dans ma watchlist' : '☆ Ajouter à la watchlist'}
        </button>
      </div>

      <div className="detail-header">
        <div>
          <h1>{quote.symbol} <span className="detail-name">{quote.name}</span></h1>
          {profile && <p className="detail-sector">{profile.sector} • {profile.exchange}</p>}
        </div>
        <div className="detail-price-block">
          <span className="detail-price">{quote.price?.toFixed(2)} {cur}</span>
          <span className="detail-change" style={{ color: changeColor }}>
            {isPositive ? '▲' : '▼'} {quote.change?.toFixed(2)} ({quote.changePercentage?.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={activeTab === 'graphique' ? 'tab-active' : ''} onClick={() => setActiveTab('graphique')}>📈 Graphique</button>
        <button className={activeTab === 'fondamentaux' ? 'tab-active' : ''} onClick={() => setActiveTab('fondamentaux')}>📊 Ratios</button>
        <button className={activeTab === 'financials' ? 'tab-active' : ''} onClick={() => setActiveTab('financials')}>📋 États financiers</button>
        <button className={activeTab === 'dividendes' ? 'tab-active' : ''} onClick={() => setActiveTab('dividendes')}>💰 Dividendes</button>
        <button className={activeTab === 'profil' ? 'tab-active' : ''} onClick={() => setActiveTab('profil')}>🏢 Profil</button>
      </div>

      {/* Graphique */}
      {activeTab === 'graphique' && (
        <div className="detail-card">
          <div className="chart-header">
            <h3>Historique des prix</h3>
            <div className="period-buttons">
              {PERIODS.map(p => (
                <button key={p.label} className={selectedPeriod.label === p.label ? 'period-active' : ''} onClick={() => setSelectedPeriod(p)}>{p.label}</button>
              ))}
            </div>
          </div>
          <PriceChart data={chartData} period={selectedPeriod} />
          <div className="market-data-grid">
            <div className="market-data-item"><span>Ouverture</span><span>{fmt(quote.open)} {cur}</span></div>
            <div className="market-data-item"><span>Plus haut (jour)</span><span>{fmt(quote.dayHigh)} {cur}</span></div>
            <div className="market-data-item"><span>Plus bas (jour)</span><span>{fmt(quote.dayLow)} {cur}</span></div>
            <div className="market-data-item"><span>Plus haut (52s)</span><span>{fmt(quote.yearHigh)} {cur}</span></div>
            <div className="market-data-item"><span>Plus bas (52s)</span><span>{fmt(quote.yearLow)} {cur}</span></div>
            <div className="market-data-item"><span>Volume</span><span>{quote.volume?.toLocaleString('fr-FR')}</span></div>
            <div className="market-data-item"><span>Cap. boursière</span><span>{fmtAmt(quote.marketCap)} {cur}</span></div>
            <div className="market-data-item"><span>Moy. 50j</span><span>{fmt(quote.priceAvg50)} {cur}</span></div>
            <div className="market-data-item"><span>Moy. 200j</span><span>{fmt(quote.priceAvg200)} {cur}</span></div>
          </div>
        </div>
      )}

      {/* Ratios / Fondamentaux */}
      {activeTab === 'fondamentaux' && (
        <div className="detail-grid">
          <div className="detail-card">
            <h3>📊 Ratios clés (TTM)</h3>
            <div className="detail-rows">
              <div className="detail-row"><span>P/E (Price/Earnings)</span><span>{fmt(ratiosTTM?.peRatioTTM)}</span></div>
              <div className="detail-row"><span>P/B (Price/Book)</span><span>{fmt(ratiosTTM?.priceToBookRatioTTM)}</span></div>
              <div className="detail-row"><span>P/S (Price/Sales)</span><span>{fmt(ratiosTTM?.priceToSalesRatioTTM)}</span></div>
              <div className="detail-row"><span>PEG Ratio</span><span>{fmt(ratiosTTM?.pegRatioTTM)}</span></div>
              <div className="detail-row"><span>EV/EBITDA</span><span>{fmt(ratiosTTM?.enterpriseValueOverEBITDATTM)}</span></div>
              <div className="detail-row"><span>Rendement dividende</span><span>{fmt(ratiosTTM?.dividendYielPercentageTTM)}%</span></div>
            </div>
          </div>
          <div className="detail-card">
            <h3>💹 Rentabilité (TTM)</h3>
            <div className="detail-rows">
              <div className="detail-row"><span>ROE</span><span>{fmtPct(ratiosTTM?.returnOnEquityTTM)}</span></div>
              <div className="detail-row"><span>ROA</span><span>{fmtPct(ratiosTTM?.returnOnAssetsTTM)}</span></div>
              <div className="detail-row"><span>Marge nette</span><span>{fmtPct(ratiosTTM?.netProfitMarginTTM)}</span></div>
              <div className="detail-row"><span>Marge opérationnelle</span><span>{fmtPct(ratiosTTM?.operatingProfitMarginTTM)}</span></div>
              <div className="detail-row"><span>Marge brute</span><span>{fmtPct(ratiosTTM?.grossProfitMarginTTM)}</span></div>
            </div>
          </div>
          <div className="detail-card">
            <h3>🏦 Santé financière (TTM)</h3>
            <div className="detail-rows">
              <div className="detail-row"><span>Dette/Equity</span><span>{fmt(ratiosTTM?.debtEquityRatioTTM)}</span></div>
              <div className="detail-row"><span>Current Ratio</span><span>{fmt(ratiosTTM?.currentRatioTTM)}</span></div>
              <div className="detail-row"><span>Quick Ratio</span><span>{fmt(ratiosTTM?.quickRatioTTM)}</span></div>
              <div className="detail-row"><span>Couverture intérêts</span><span>{fmt(ratiosTTM?.interestCoverageTTM)}</span></div>
              <div className="detail-row"><span>Cash par action</span><span>{fmt(ratiosTTM?.cashPerShareTTM)} {cur}</span></div>
            </div>
          </div>
          {ratios?.length > 0 && (
            <div className="detail-card">
              <h3>📅 Évolution annuelle</h3>
              <table className="ratios-history-table">
                <thead><tr><th>Année</th><th>P/E</th><th>ROE</th><th>Marge nette</th><th>Dette/Eq.</th></tr></thead>
                <tbody>
                  {ratios.map((r, i) => (
                    <tr key={i}>
                      <td>{r.date?.split('-')[0] || r.calendarYear || 'N/A'}</td>
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

      {/* États financiers */}
      {activeTab === 'financials' && (
        <div>
          <div className="financial-period-toggle">
            <button className={financialPeriod === 'annual' ? 'period-active' : ''} onClick={() => setFinancialPeriod('annual')}>Annuel</button>
            <button className={financialPeriod === 'quarter' ? 'period-active' : ''} onClick={() => setFinancialPeriod('quarter')}>Trimestriel</button>
          </div>

          {/* Compte de résultat */}
          {incomeStatement.length > 0 && (
            <div className="detail-card financial-table-card">
              <h3>📋 Compte de résultat</h3>
              <div className="financial-table-wrapper">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Poste</th>
                      {incomeStatement.map((s, i) => <th key={i}>{s.date?.split('-')[0] || s.calendarYear}{financialPeriod === 'quarter' ? ` Q${s.period?.replace('Q','')}` : ''}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Chiffre d'affaires</td>{incomeStatement.map((s, i) => <td key={i}>{fmtAmt(s.revenue)} {cur}</td>)}</tr>
                    <tr><td>Coût des ventes</td>{incomeStatement.map((s, i) => <td key={i}>{fmtAmt(s.costOfRevenue)} {cur}</td>)}</tr>
                    <tr className="financial-subtotal"><td>Marge brute</td>{incomeStatement.map((s, i) => <td key={i}>{fmtAmt(s.grossProfit)} {cur}</td>)}</tr>
                    <tr><td>Frais R&D</td>{incomeStatement.map((s, i) => <td key={i}>{fmtAmt(s.researchAndDevelopmentExpenses)} {cur}</td>)}</tr>
                    <tr><td>Frais admin. & commerciaux</td>{incomeStatement.map((s, i) => <td key={i}>{fmtAmt(s.sellingGeneralAndAdministrativeExpenses)} {cur}</td>)}</tr>
                    <tr className="financial-subtotal"><td>Résultat opérationnel</td>{incomeStatement.map((s, i) => <td key={i}>{fmtAmt(s.operatingIncome)} {cur}</td>)}</tr>
                    <tr><td>EBITDA</td>{incomeStatement.map((s, i) => <td key={i}>{fmtAmt(s.ebitda)} {cur}</td>)}</tr>
                    <tr><td>Charges d'intérêts</td>{incomeStatement.map((s, i) => <td key={i}>{fmtAmt(s.interestExpense)} {cur}</td>)}</tr>
                    <tr className="financial-total"><td>Résultat net</td>{incomeStatement.map((s, i) => <td key={i}>{fmtAmt(s.netIncome)} {cur}</td>)}</tr>
                    <tr><td>BPA (EPS)</td>{incomeStatement.map((s, i) => <td key={i}>{fmt(s.eps)} {cur}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Bilan */}
          {balanceSheet.length > 0 && (
            <div className="detail-card financial-table-card">
              <h3>🏦 Bilan comptable</h3>
              <div className="financial-table-wrapper">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Poste</th>
                      {balanceSheet.map((s, i) => <th key={i}>{s.date?.split('-')[0] || s.calendarYear}{financialPeriod === 'quarter' ? ` Q${s.period?.replace('Q','')}` : ''}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Trésorerie</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.cashAndCashEquivalents)} {cur}</td>)}</tr>
                    <tr><td>Placements court terme</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.shortTermInvestments)} {cur}</td>)}</tr>
                    <tr><td>Créances clients</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.netReceivables)} {cur}</td>)}</tr>
                    <tr><td>Stocks</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.inventory)} {cur}</td>)}</tr>
                    <tr className="financial-subtotal"><td>Total actifs courants</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.totalCurrentAssets)} {cur}</td>)}</tr>
                    <tr><td>Immobilisations</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.propertyPlantEquipmentNet)} {cur}</td>)}</tr>
                    <tr><td>Goodwill</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.goodwill)} {cur}</td>)}</tr>
                    <tr className="financial-total"><td>Total actifs</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.totalAssets)} {cur}</td>)}</tr>
                    <tr><td>Dette court terme</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.shortTermDebt)} {cur}</td>)}</tr>
                    <tr><td>Dette long terme</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.longTermDebt)} {cur}</td>)}</tr>
                    <tr className="financial-subtotal"><td>Total passifs</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.totalLiabilities)} {cur}</td>)}</tr>
                    <tr className="financial-total"><td>Capitaux propres</td>{balanceSheet.map((s, i) => <td key={i}>{fmtAmt(s.totalStockholdersEquity)} {cur}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cash Flow */}
          {cashFlow.length > 0 && (
            <div className="detail-card financial-table-card">
              <h3>💸 Flux de trésorerie</h3>
              <div className="financial-table-wrapper">
                <table className="financial-table">
                  <thead>
                    <tr>
                      <th>Poste</th>
                      {cashFlow.map((s, i) => <th key={i}>{s.date?.split('-')[0] || s.calendarYear}{financialPeriod === 'quarter' ? ` Q${s.period?.replace('Q','')}` : ''}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Résultat net</td>{cashFlow.map((s, i) => <td key={i}>{fmtAmt(s.netIncome)} {cur}</td>)}</tr>
                    <tr><td>Amortissements</td>{cashFlow.map((s, i) => <td key={i}>{fmtAmt(s.depreciationAndAmortization)} {cur}</td>)}</tr>
                    <tr className="financial-subtotal"><td>Flux opérationnel</td>{cashFlow.map((s, i) => <td key={i}>{fmtAmt(s.operatingCashFlow)} {cur}</td>)}</tr>
                    <tr><td>Investissements (CAPEX)</td>{cashFlow.map((s, i) => <td key={i}>{fmtAmt(s.capitalExpenditure)} {cur}</td>)}</tr>
                    <tr><td>Acquisitions</td>{cashFlow.map((s, i) => <td key={i}>{fmtAmt(s.acquisitionsNet)} {cur}</td>)}</tr>
                    <tr className="financial-total"><td>Free Cash Flow</td>{cashFlow.map((s, i) => <td key={i}>{fmtAmt(s.freeCashFlow)} {cur}</td>)}</tr>
                    <tr><td>Rachat d'actions</td>{cashFlow.map((s, i) => <td key={i}>{fmtAmt(s.commonStockRepurchased)} {cur}</td>)}</tr>
                    <tr><td>Dividendes versés</td>{cashFlow.map((s, i) => <td key={i}>{fmtAmt(s.dividendsPaid)} {cur}</td>)}</tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {incomeStatement.length === 0 && balanceSheet.length === 0 && cashFlow.length === 0 && (
            <p className="no-data">Aucune donnée financière disponible pour {symbol}</p>
          )}
        </div>
      )}

      {/* Dividendes */}
      {activeTab === 'dividendes' && (
        <div className="detail-card">
          <h3>💰 Historique des dividendes</h3>
          {dividends.length > 0 ? (
            <table className="dividends-table">
              <thead><tr><th>Date</th><th>Dividende</th><th>Date de paiement</th></tr></thead>
              <tbody>
                {dividends.map((d, i) => (
                  <tr key={i}>
                    <td>{d.date || d.recordDate || 'N/A'}</td>
                    <td className="dividend-amount">{fmt(d.dividend || d.adjDividend, 4)} {cur}</td>
                    <td>{d.paymentDate || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="no-data">Aucun dividende trouvé pour {symbol}</p>}
        </div>
      )}

      {/* Profil */}
      {activeTab === 'profil' && profile && (
        <div className="detail-grid">
          <div className="detail-card">
            <h3>🏢 Informations</h3>
            <div className="detail-rows">
              <div className="detail-row"><span>PDG</span><span>{profile.ceo || 'N/A'}</span></div>
              <div className="detail-row"><span>Secteur</span><span>{profile.sector || 'N/A'}</span></div>
              <div className="detail-row"><span>Industrie</span><span>{profile.industry || 'N/A'}</span></div>
              <div className="detail-row"><span>Employés</span><span>{profile.fullTimeEmployees?.toLocaleString('fr-FR') || 'N/A'}</span></div>
              <div className="detail-row"><span>Pays</span><span>{profile.country || 'N/A'}</span></div>
              <div className="detail-row"><span>IPO</span><span>{profile.ipoDate || 'N/A'}</span></div>
              <div className="detail-row"><span>Site web</span><a href={profile.website} target="_blank" rel="noopener noreferrer" className="profile-link">{profile.website ? 'Visiter' : 'N/A'}</a></div>
            </div>
          </div>
          <div className="detail-card">
            <h3>📝 Description</h3>
            <p className="company-description-full">{profile.description || 'Aucune description disponible.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockDetail;
