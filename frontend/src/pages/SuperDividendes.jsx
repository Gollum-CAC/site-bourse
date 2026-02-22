// Page Super Dividendes PEA - Actions à haut rendement éligibles PEA
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSuperDividendes } from '../services/api';

function SuperDividendes() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [filterSector, setFilterSector] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const result = await getSuperDividendes();
      setData(result);
    } catch (err) {
      setError('Impossible de charger les données. Le calcul peut prendre du temps avec le plan gratuit FMP — réessayez dans quelques minutes.');
      console.error(err);
    }
    setLoading(false);
  }

  // Trier les stocks
  function getSortedStocks() {
    if (!data?.stocks) return [];
    let stocks = [...data.stocks];
    
    if (filterSector) {
      stocks = stocks.filter(s => s.sector === filterSector);
    }

    switch (sortBy) {
      case 'yield': return stocks.sort((a, b) => b.currentYield - a.currentYield);
      case 'growth': return stocks.sort((a, b) => b.growth - a.growth);
      case 'regularity': return stocks.sort((a, b) => b.regularity - a.regularity);
      case 'avgYield': return stocks.sort((a, b) => b.avgYield - a.avgYield);
      default: return stocks.sort((a, b) => b.score - a.score);
    }
  }

  // Secteurs uniques pour le filtre
  function getSectors() {
    if (!data?.stocks) return [];
    const sectors = [...new Set(data.stocks.map(s => s.sector).filter(s => s && s !== 'N/A'))];
    return sectors.sort();
  }

  // Couleur du score
  function getScoreColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 50) return '#eab308';
    if (score >= 30) return '#f97316';
    return '#ef4444';
  }

  // Icône de tendance
  function getTrendIcon(trend) {
    if (trend === 'croissant') return '📈';
    if (trend === 'décroissant') return '📉';
    return '➡️';
  }

  const sortedStocks = getSortedStocks();

  return (
    <div className="super-div-page">
      <div className="super-div-header">
        <div>
          <h1>💎 Super Dividendes PEA</h1>
          <p className="page-subtitle">
            Actions Euronext à haut rendement éligibles PEA, triées par score composite 
            (rendement + régularité + croissance)
          </p>
        </div>
        <Link to="/" className="back-link">← Retour</Link>
      </div>

      {/* Explication du score */}
      <div className="score-explanation">
        <h3>📊 Comment lire le score ?</h3>
        <div className="score-criteria">
          <div className="criterion">
            <span className="criterion-pct">40%</span>
            <span>Rendement actuel</span>
          </div>
          <div className="criterion">
            <span className="criterion-pct">30%</span>
            <span>Régularité (années consécutives)</span>
          </div>
          <div className="criterion">
            <span className="criterion-pct">20%</span>
            <span>Croissance du dividende</span>
          </div>
          <div className="criterion">
            <span className="criterion-pct">10%</span>
            <span>Rendement moyen historique</span>
          </div>
        </div>
      </div>

      {loading && <p className="loading">⏳ Analyse des dividendes en cours... (peut prendre 1-2 minutes avec le plan gratuit)</p>}
      {error && (
        <div className="error-block">
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={loadData}>🔄 Réessayer</button>
        </div>
      )}

      {data && (
        <>
          {/* Filtres et tri */}
          <div className="super-div-controls">
            <div className="sort-buttons">
              <span>Trier par :</span>
              {[
                { key: 'score', label: '⭐ Score' },
                { key: 'yield', label: '💰 Rendement' },
                { key: 'growth', label: '📈 Croissance' },
                { key: 'regularity', label: '🔄 Régularité' },
                { key: 'avgYield', label: '📊 Rdt moyen' },
              ].map(s => (
                <button
                  key={s.key}
                  className={sortBy === s.key ? 'sort-active' : ''}
                  onClick={() => setSortBy(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="filter-sector">
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)}>
                <option value="">Tous les secteurs</option>
                {getSectors().map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <p className="results-count">
            {sortedStocks.length} action{sortedStocks.length > 1 ? 's' : ''} trouvée{sortedStocks.length > 1 ? 's' : ''}
            {data.updatedAt && <span className="last-update"> • Mis à jour : {new Date(data.updatedAt).toLocaleString('fr-FR')}</span>}
          </p>

          {/* Tableau principal */}
          <div className="super-div-table-wrapper">
            <table className="super-div-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Action</th>
                  <th>Secteur</th>
                  <th>Prix</th>
                  <th>Rdt actuel</th>
                  <th>Rdt moyen</th>
                  <th>Div/an</th>
                  <th>Années</th>
                  <th>Tendance</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {sortedStocks.map((stock, index) => (
                  <tr key={stock.symbol} onClick={() => navigate(`/action/${stock.symbol}`)} style={{ cursor: 'pointer' }}>
                    <td>{index + 1}</td>
                    <td className="stock-table-name">
                      <strong>{stock.symbol}</strong>
                      <span className="stock-table-fullname">{stock.name}</span>
                    </td>
                    <td className="sector-cell">{stock.sector}</td>
                    <td>{stock.price?.toFixed(2)} €</td>
                    <td className="yield-cell" style={{ color: stock.currentYield >= 5 ? '#22c55e' : stock.currentYield >= 3 ? '#eab308' : '#e1e4e8' }}>
                      {stock.currentYield}%
                    </td>
                    <td>{stock.avgYield}%</td>
                    <td>{stock.latestAnnualDiv} €</td>
                    <td>
                      <span className="regularity-badge" style={{ 
                        background: stock.regularity >= 80 ? 'rgba(34,197,94,0.2)' : stock.regularity >= 60 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)',
                        color: stock.regularity >= 80 ? '#22c55e' : stock.regularity >= 60 ? '#eab308' : '#ef4444'
                      }}>
                        {stock.yearsOfDividends}/5 ans
                      </span>
                    </td>
                    <td>
                      {getTrendIcon(stock.trend)} 
                      <span style={{ color: stock.growth > 0 ? '#22c55e' : stock.growth < 0 ? '#ef4444' : '#8b949e', marginLeft: '4px' }}>
                        {stock.growth > 0 ? '+' : ''}{stock.growth}%
                      </span>
                    </td>
                    <td>
                      <span className="score-badge" style={{ background: getScoreColor(stock.score) }}>
                        {stock.score}/100
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Détail au clic - historique dividendes mini */}
          {sortedStocks.length > 0 && (
            <div className="super-div-info">
              <p>💡 Cliquez sur une action pour voir son profil complet, graphique et états financiers.</p>
              <p>⚠️ Les rendements passés ne préjugent pas des rendements futurs. Faites vos propres recherches.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SuperDividendes;
