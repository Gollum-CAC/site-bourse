// Page détail d'une action - Profil, graphique, dividendes, ratios
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getQuote, getCompanyProfile, getDividends, getHistoricalPrice, getKeyMetrics, getRatiosTTM } from '../services/api';
import PriceChart from '../components/PriceChart';

// Périodes pour le graphique
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
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(PERIODS[2]); // 3M par défaut
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [activeTab, setActiveTab] = useState('graphique');

  useEffect(() => {
    loadData();
    checkWatchlist();
  }, [symbol]);

  useEffect(() => {
    loadChartData();
  }, [symbol, selectedPeriod]);

  // Vérifier si l'action est dans la watchlist
  function checkWatchlist() {
    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    setIsInWatchlist(watchlist.includes(symbol.toUpperCase()));
  }

  // Ajouter/retirer de la watchlist
  function toggleWatchlist() {
    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    const sym = symbol.toUpperCase();
    if (watchlist.includes(sym)) {
      const updated = watchlist.filter(s => s !== sym);
      localStorage.setItem('watchlist', JSON.stringify(updated));
      setIsInWatchlist(false);
    } else {
      watchlist.push(sym);
      localStorage.setItem('watchlist', JSON.stringify(watchlist));
      setIsInWatchlist(true);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [quoteData, profileData, dividendsData, ratiosData, ratiosTTMData] = await Promise.allSettled([
        getQuote(symbol),
        getCompanyProfile(symbol),
        getDividends(symbol),
        getKeyMetrics(symbol),
        getRatiosTTM(symbol),
      ]);
      setQuote(quoteData.status === 'fulfilled' ? quoteData.value?.[0] : null);
      setProfile(profileData.status === 'fulfilled' ? profileData.value?.[0] : null);
      
      if (dividendsData.status === 'fulfilled') {
        const divData = dividendsData.value;
        if (Array.isArray(divData)) setDividends(divData.slice(0, 20));
        else if (divData?.historical) setDividends(divData.historical.slice(0, 20));
      }

      if (ratiosData.status === 'fulfilled' && Array.isArray(ratiosData.value)) {
        setRatios(ratiosData.value);
      }
      if (ratiosTTMData.status === 'fulfilled') {
        const ttm = ratiosTTMData.value;
        setRatiosTTM(Array.isArray(ttm) ? ttm[0] : ttm);
      }
    } catch (err) {
      console.error('Erreur chargement détails:', err);
    }
    setLoading(false);
  }

  async function loadChartData() {
    try {
      const to = new Date().toISOString().split('T')[0];
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - selectedPeriod.days);
      const from = fromDate.toISOString().split('T')[0];
      const data = await getHistoricalPrice(symbol, from, to);
      if (Array.isArray(data)) {
        setChartData(data);
      } else if (data?.historical) {
        setChartData(data.historical);
      } else {
        setChartData([]);
      }
    } catch (err) {
      console.error('Erreur chargement historique:', err);
      setChartData([]);
    }
  }

  // Formater un nombre avec gestion des valeurs null
  function fmt(val, decimals = 2) {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return Number(val).toFixed(decimals);
  }

  function fmtPct(val) {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return (Number(val) * 100).toFixed(2) + '%';
  }

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

      {/* En-tête avec cours */}
      <div className="detail-header">
        <div>
          <h1>{quote.symbol} <span className="detail-name">{quote.name}</span></h1>
          {profile && <p className="detail-sector">{profile.sector} • {profile.exchange}</p>}
        </div>
        <div className="detail-price-block">
          <span className="detail-price">{quote.price?.toFixed(2)} $</span>
          <span className="detail-change" style={{ color: changeColor }}>
            {isPositive ? '▲' : '▼'} {quote.change?.toFixed(2)} ({quote.changePercentage?.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Onglets */}
      <div className="detail-tabs">
        <button className={activeTab === 'graphique' ? 'tab-active' : ''} onClick={() => setActiveTab('graphique')}>📈 Graphique</button>
        <button className={activeTab === 'fondamentaux' ? 'tab-active' : ''} onClick={() => setActiveTab('fondamentaux')}>📊 Fondamentaux</button>
        <button className={activeTab === 'dividendes' ? 'tab-active' : ''} onClick={() => setActiveTab('dividendes')}>💰 Dividendes</button>
        <button className={activeTab === 'profil' ? 'tab-active' : ''} onClick={() => setActiveTab('profil')}>🏢 Profil</button>
      </div>

      {/* Onglet Graphique */}
      {activeTab === 'graphique' && (
        <div className="detail-card">
          <div className="chart-header">
            <h3>Historique des prix</h3>
            <div className="period-buttons">
              {PERIODS.map(p => (
                <button
                  key={p.label}
                  className={selectedPeriod.label === p.label ? 'period-active' : ''}
                  onClick={() => setSelectedPeriod(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <PriceChart data={chartData} period={selectedPeriod} />

          {/* Données marché sous le graphique */}
          <div className="market-data-grid">
            <div className="market-data-item"><span>Ouverture</span><span>{fmt(quote.open)} $</span></div>
            <div className="market-data-item"><span>Plus haut (jour)</span><span>{fmt(quote.dayHigh)} $</span></div>
            <div className="market-data-item"><span>Plus bas (jour)</span><span>{fmt(quote.dayLow)} $</span></div>
            <div className="market-data-item"><span>Plus haut (52s)</span><span>{fmt(quote.yearHigh)} $</span></div>
            <div className="market-data-item"><span>Plus bas (52s)</span><span>{fmt(quote.yearLow)} $</span></div>
            <div className="market-data-item"><span>Volume</span><span>{quote.volume?.toLocaleString('fr-FR')}</span></div>
            <div className="market-data-item"><span>Cap. boursière</span><span>{fmt(quote.marketCap / 1e9)} Mds $</span></div>
            <div className="market-data-item"><span>Moy. 50j</span><span>{fmt(quote.priceAvg50)} $</span></div>
            <div className="market-data-item"><span>Moy. 200j</span><span>{fmt(quote.priceAvg200)} $</span></div>
          </div>
        </div>
      )}

      {/* Onglet Fondamentaux */}
      {activeTab === 'fondamentaux' && (
        <div className="detail-grid">
          {/* Ratios TTM */}
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

          {/* Rentabilité */}
          <div className="detail-card">
            <h3>💹 Rentabilité (TTM)</h3>
            <div className="detail-rows">
              <div className="detail-row"><span>ROE (Return on Equity)</span><span>{fmtPct(ratiosTTM?.returnOnEquityTTM)}</span></div>
              <div className="detail-row"><span>ROA (Return on Assets)</span><span>{fmtPct(ratiosTTM?.returnOnAssetsTTM)}</span></div>
              <div className="detail-row"><span>Marge nette</span><span>{fmtPct(ratiosTTM?.netProfitMarginTTM)}</span></div>
              <div className="detail-row"><span>Marge opérationnelle</span><span>{fmtPct(ratiosTTM?.operatingProfitMarginTTM)}</span></div>
              <div className="detail-row"><span>Marge brute</span><span>{fmtPct(ratiosTTM?.grossProfitMarginTTM)}</span></div>
              <div className="detail-row"><span>Flux trésorerie / action</span><span>{fmt(ratiosTTM?.freeCashFlowPerShareTTM)} $</span></div>
            </div>
          </div>

          {/* Santé financière */}
          <div className="detail-card">
            <h3>🏦 Santé financière (TTM)</h3>
            <div className="detail-rows">
              <div className="detail-row"><span>Dette/Equity</span><span>{fmt(ratiosTTM?.debtEquityRatioTTM)}</span></div>
              <div className="detail-row"><span>Current Ratio</span><span>{fmt(ratiosTTM?.currentRatioTTM)}</span></div>
              <div className="detail-row"><span>Quick Ratio</span><span>{fmt(ratiosTTM?.quickRatioTTM)}</span></div>
              <div className="detail-row"><span>Couverture des intérêts</span><span>{fmt(ratiosTTM?.interestCoverageTTM)}</span></div>
              <div className="detail-row"><span>Cash par action</span><span>{fmt(ratiosTTM?.cashPerShareTTM)} $</span></div>
            </div>
          </div>

          {/* Historique des ratios */}
          {ratios && ratios.length > 0 && (
            <div className="detail-card">
              <h3>📅 Évolution annuelle</h3>
              <table className="ratios-history-table">
                <thead>
                  <tr>
                    <th>Année</th>
                    <th>P/E</th>
                    <th>ROE</th>
                    <th>Marge nette</th>
                    <th>Dette/Equity</th>
                  </tr>
                </thead>
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

      {/* Onglet Dividendes */}
      {activeTab === 'dividendes' && (
        <div className="detail-card">
          <h3>💰 Historique des dividendes</h3>
          {dividends.length > 0 ? (
            <table className="dividends-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Dividende</th>
                  <th>Date de paiement</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map((div, index) => (
                  <tr key={index}>
                    <td>{div.date || div.recordDate || 'N/A'}</td>
                    <td className="dividend-amount">{fmt(div.dividend || div.adjDividend, 4)} $</td>
                    <td>{div.paymentDate || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-data">Aucun dividende trouvé pour {symbol}</p>
          )}
        </div>
      )}

      {/* Onglet Profil */}
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
              <div className="detail-row"><span>Adresse</span><span>{profile.address || 'N/A'}</span></div>
              <div className="detail-row"><span>IPO</span><span>{profile.ipoDate || 'N/A'}</span></div>
              <div className="detail-row">
                <span>Site web</span>
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="profile-link">
                  {profile.website ? 'Visiter' : 'N/A'}
                </a>
              </div>
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
