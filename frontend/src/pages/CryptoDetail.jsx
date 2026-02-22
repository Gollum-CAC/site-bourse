// Page détail d'une cryptomonnaie
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCryptoDetail } from '../services/api';

function CryptoDetail() {
  const { id } = useParams();
  const [crypto, setCrypto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCrypto();
  }, [id]);

  async function loadCrypto() {
    setLoading(true);
    setError('');
    try {
      const data = await getCryptoDetail(id);
      setCrypto(data);
    } catch (err) {
      console.error('Erreur chargement crypto:', err);
      setError('Impossible de charger les données de cette cryptomonnaie.');
    }
    setLoading(false);
  }

  if (loading) return <p className="loading">Chargement de {id}...</p>;
  if (error) return (
    <div>
      <Link to="/cryptos" className="back-link">← Retour aux cryptos</Link>
      <p className="error-message">{error}</p>
    </div>
  );
  if (!crypto) return null;

  const price = crypto.market_data?.current_price?.eur;
  const change24h = crypto.market_data?.price_change_percentage_24h;
  const change7d = crypto.market_data?.price_change_percentage_7d;
  const change30d = crypto.market_data?.price_change_percentage_30d;
  const change1y = crypto.market_data?.price_change_percentage_1y;
  const isPositive24h = change24h >= 0;

  return (
    <div className="crypto-detail-page">
      <Link to="/cryptos" className="back-link">← Retour aux cryptos</Link>

      {/* En-tête */}
      <div className="detail-header">
        <div className="crypto-detail-title">
          {crypto.image?.large && <img src={crypto.image.large} alt={crypto.name} width="48" height="48" />}
          <div>
            <h1>{crypto.name} <span className="detail-name">{crypto.symbol?.toUpperCase()}</span></h1>
            <p className="detail-sector">Rang #{crypto.market_cap_rank}</p>
          </div>
        </div>
        <div className="detail-price-block">
          <span className="detail-price">{price?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          <span className="detail-change" style={{ color: isPositive24h ? '#22c55e' : '#ef4444' }}>
            {isPositive24h ? '▲' : '▼'} {change24h?.toFixed(2)}% (24h)
          </span>
        </div>
      </div>

      {/* Grille d'infos */}
      <div className="detail-grid">
        {/* Données de marché */}
        <div className="detail-card">
          <h3>📊 Données du marché</h3>
          <div className="detail-rows">
            <div className="detail-row">
              <span>Cap. boursière</span>
              <span>{(crypto.market_data?.market_cap?.eur / 1e9)?.toFixed(2)} Mds €</span>
            </div>
            <div className="detail-row">
              <span>Volume 24h</span>
              <span>{(crypto.market_data?.total_volume?.eur / 1e9)?.toFixed(2)} Mds €</span>
            </div>
            <div className="detail-row">
              <span>Plus haut 24h</span>
              <span>{crypto.market_data?.high_24h?.eur?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
            </div>
            <div className="detail-row">
              <span>Plus bas 24h</span>
              <span>{crypto.market_data?.low_24h?.eur?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
            </div>
            <div className="detail-row">
              <span>ATH (record)</span>
              <span>{crypto.market_data?.ath?.eur?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
            </div>
            <div className="detail-row">
              <span>Date ATH</span>
              <span>{crypto.market_data?.ath_date?.eur ? new Date(crypto.market_data.ath_date.eur).toLocaleDateString('fr-FR') : 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span>Supply en circulation</span>
              <span>{crypto.market_data?.circulating_supply?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="detail-row">
              <span>Supply max</span>
              <span>{crypto.market_data?.max_supply?.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) || '∞'}</span>
            </div>
          </div>
        </div>

        {/* Variations */}
        <div className="detail-card">
          <h3>📈 Variations</h3>
          <div className="detail-rows">
            <div className="detail-row">
              <span>24 heures</span>
              <span style={{ color: change24h >= 0 ? '#22c55e' : '#ef4444' }}>
                {change24h >= 0 ? '▲' : '▼'} {change24h?.toFixed(2)}%
              </span>
            </div>
            <div className="detail-row">
              <span>7 jours</span>
              <span style={{ color: change7d >= 0 ? '#22c55e' : '#ef4444' }}>
                {change7d >= 0 ? '▲' : '▼'} {change7d?.toFixed(2)}%
              </span>
            </div>
            <div className="detail-row">
              <span>30 jours</span>
              <span style={{ color: change30d >= 0 ? '#22c55e' : '#ef4444' }}>
                {change30d >= 0 ? '▲' : '▼'} {change30d?.toFixed(2)}%
              </span>
            </div>
            <div className="detail-row">
              <span>1 an</span>
              <span style={{ color: change1y >= 0 ? '#22c55e' : '#ef4444' }}>
                {change1y >= 0 ? '▲' : '▼'} {change1y?.toFixed(2)}%
              </span>
            </div>
            <div className="detail-row">
              <span>Depuis ATH</span>
              <span style={{ color: '#ef4444' }}>
                ▼ {crypto.market_data?.ath_change_percentage?.eur?.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Description */}
          {crypto.description?.fr && (
            <>
              <h3 style={{ marginTop: '24px' }}>📝 Description</h3>
              <p className="company-description" dangerouslySetInnerHTML={{ __html: crypto.description.fr.slice(0, 400) + '...' }} />
            </>
          )}
          {!crypto.description?.fr && crypto.description?.en && (
            <>
              <h3 style={{ marginTop: '24px' }}>📝 Description</h3>
              <p className="company-description" dangerouslySetInnerHTML={{ __html: crypto.description.en.slice(0, 400) + '...' }} />
            </>
          )}
        </div>
      </div>

      {/* Liens */}
      {(crypto.links?.homepage?.[0] || crypto.links?.blockchain_site?.[0]) && (
        <div className="detail-card" style={{ marginBottom: '30px' }}>
          <h3>🔗 Liens utiles</h3>
          <div className="crypto-links">
            {crypto.links?.homepage?.[0] && (
              <a href={crypto.links.homepage[0]} target="_blank" rel="noopener noreferrer" className="crypto-ext-link">🌐 Site officiel</a>
            )}
            {crypto.links?.blockchain_site?.[0] && (
              <a href={crypto.links.blockchain_site[0]} target="_blank" rel="noopener noreferrer" className="crypto-ext-link">🔗 Blockchain Explorer</a>
            )}
            {crypto.links?.subreddit_url && (
              <a href={crypto.links.subreddit_url} target="_blank" rel="noopener noreferrer" className="crypto-ext-link">💬 Reddit</a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CryptoDetail;
