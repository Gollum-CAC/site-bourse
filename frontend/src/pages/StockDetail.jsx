// Page détail d'une action - Profil entreprise + Dividendes
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getQuote, getCompanyProfile, getDividends } from '../services/api';

function StockDetail() {
  const { symbol } = useParams();
  const [quote, setQuote] = useState(null);
  const [profile, setProfile] = useState(null);
  const [dividends, setDividends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [symbol]);

  async function loadData() {
    setLoading(true);
    try {
      const [quoteData, profileData, dividendsData] = await Promise.all([
        getQuote(symbol),
        getCompanyProfile(symbol),
        getDividends(symbol),
      ]);
      setQuote(quoteData?.[0] || null);
      setProfile(profileData?.[0] || null);
      // Les dividendes peuvent être dans différents formats selon l'API
      if (Array.isArray(dividendsData)) {
        setDividends(dividendsData.slice(0, 20));
      } else if (dividendsData?.historical) {
        setDividends(dividendsData.historical.slice(0, 20));
      }
    } catch (err) {
      console.error('Erreur chargement détails:', err);
    }
    setLoading(false);
  }

  if (loading) return <p className="loading">Chargement des données de {symbol}...</p>;
  if (!quote) return <p className="error-message">Impossible de charger les données pour {symbol}</p>;

  const isPositive = quote.change >= 0;
  const changeColor = isPositive ? '#22c55e' : '#ef4444';

  return (
    <div className="stock-detail-page">
      <Link to="/" className="back-link">← Retour à l'accueil</Link>

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

      {/* Grille d'infos */}
      <div className="detail-grid">
        {/* Infos marché */}
        <div className="detail-card">
          <h3>📊 Données du marché</h3>
          <div className="detail-rows">
            <div className="detail-row"><span>Ouverture</span><span>{quote.open?.toFixed(2)} $</span></div>
            <div className="detail-row"><span>Plus haut (jour)</span><span>{quote.dayHigh?.toFixed(2)} $</span></div>
            <div className="detail-row"><span>Plus bas (jour)</span><span>{quote.dayLow?.toFixed(2)} $</span></div>
            <div className="detail-row"><span>Plus haut (52 sem.)</span><span>{quote.yearHigh?.toFixed(2)} $</span></div>
            <div className="detail-row"><span>Plus bas (52 sem.)</span><span>{quote.yearLow?.toFixed(2)} $</span></div>
            <div className="detail-row"><span>Volume</span><span>{quote.volume?.toLocaleString('fr-FR')}</span></div>
            <div className="detail-row"><span>Cap. boursière</span><span>{(quote.marketCap / 1e9)?.toFixed(2)} Mds $</span></div>
            <div className="detail-row"><span>Moy. 50 jours</span><span>{quote.priceAvg50?.toFixed(2)} $</span></div>
            <div className="detail-row"><span>Moy. 200 jours</span><span>{quote.priceAvg200?.toFixed(2)} $</span></div>
          </div>
        </div>

        {/* Profil entreprise */}
        {profile && (
          <div className="detail-card">
            <h3>🏢 Profil de l'entreprise</h3>
            <div className="detail-rows">
              <div className="detail-row"><span>PDG</span><span>{profile.ceo || 'N/A'}</span></div>
              <div className="detail-row"><span>Secteur</span><span>{profile.sector || 'N/A'}</span></div>
              <div className="detail-row"><span>Industrie</span><span>{profile.industry || 'N/A'}</span></div>
              <div className="detail-row"><span>Employés</span><span>{profile.fullTimeEmployees?.toLocaleString('fr-FR') || 'N/A'}</span></div>
              <div className="detail-row"><span>Pays</span><span>{profile.country || 'N/A'}</span></div>
              <div className="detail-row"><span>Site web</span>
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="profile-link">
                  {profile.website ? 'Visiter' : 'N/A'}
                </a>
              </div>
            </div>
            {profile.description && (
              <p className="company-description">{profile.description.slice(0, 300)}...</p>
            )}
          </div>
        )}
      </div>

      {/* Historique des dividendes */}
      {dividends.length > 0 && (
        <div className="detail-card dividends-section">
          <h3>💰 Historique des dividendes</h3>
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
                  <td className="dividend-amount">{div.dividend?.toFixed(4) || div.adjDividend?.toFixed(4) || 'N/A'} $</td>
                  <td>{div.paymentDate || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StockDetail;
