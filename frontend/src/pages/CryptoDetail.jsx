// Crypto detail page
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCryptoDetail } from '../services/api';

function CryptoDetail() {
  const { id }            = useParams();
  const [crypto, setCrypto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => { loadCrypto(); }, [id]);

  async function loadCrypto() {
    setLoading(true);
    setError('');
    try {
      setCrypto(await getCryptoDetail(id));
    } catch {
      setError('Unable to load data for this cryptocurrency.');
    }
    setLoading(false);
  }

  if (loading) return <p className="loading">Loading {id}...</p>;
  if (error)   return (
    <div>
      <Link to="/cryptos" className="back-link">← Back to cryptos</Link>
      <p className="error-message">{error}</p>
    </div>
  );
  if (!crypto) return null;

  const price    = crypto.market_data?.current_price?.eur;
  const change24h  = crypto.market_data?.price_change_percentage_24h;
  const change7d   = crypto.market_data?.price_change_percentage_7d;
  const change30d  = crypto.market_data?.price_change_percentage_30d;
  const change1y   = crypto.market_data?.price_change_percentage_1y;
  const isPos24h   = change24h >= 0;

  return (
    <div className="crypto-detail-page">
      <Link to="/cryptos" className="back-link">← Back to cryptos</Link>

      <div className="detail-header">
        <div className="crypto-detail-title">
          {crypto.image?.large && <img src={crypto.image.large} alt={crypto.name} width="48" height="48" />}
          <div>
            <h1>{crypto.name} <span className="detail-name">{crypto.symbol?.toUpperCase()}</span></h1>
            <p className="detail-sector">Rank #{crypto.market_cap_rank}</p>
          </div>
        </div>
        <div className="detail-price-block">
          <span className="detail-price">{price?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}</span>
          <span className="detail-change" style={{ color: isPos24h ? '#22c55e' : '#ef4444' }}>
            {isPos24h ? '▲' : '▼'} {change24h?.toFixed(2)}% (24h)
          </span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-card">
          <h3>📊 Market Data</h3>
          <div className="detail-rows">
            {[
              ['Market Cap',         `${(crypto.market_data?.market_cap?.eur / 1e9)?.toFixed(2)} B €`],
              ['24h Volume',         `${(crypto.market_data?.total_volume?.eur / 1e9)?.toFixed(2)} B €`],
              ['24h High',           crypto.market_data?.high_24h?.eur?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })],
              ['24h Low',            crypto.market_data?.low_24h?.eur?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })],
              ['All-Time High',      crypto.market_data?.ath?.eur?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })],
              ['ATH Date',           crypto.market_data?.ath_date?.eur ? new Date(crypto.market_data.ath_date.eur).toLocaleDateString('en-US') : 'N/A'],
              ['Circulating Supply', crypto.market_data?.circulating_supply?.toLocaleString('en-US', { maximumFractionDigits: 0 })],
              ['Max Supply',         crypto.market_data?.max_supply?.toLocaleString('en-US', { maximumFractionDigits: 0 }) || '∞'],
            ].map(([label, value]) => (
              <div key={label} className="detail-row"><span>{label}</span><span>{value}</span></div>
            ))}
          </div>
        </div>

        <div className="detail-card">
          <h3>📈 Price Changes</h3>
          <div className="detail-rows">
            {[
              ['24 hours',    change24h],
              ['7 days',      change7d],
              ['30 days',     change30d],
              ['1 year',      change1y],
            ].map(([label, val]) => (
              <div key={label} className="detail-row">
                <span>{label}</span>
                <span style={{ color: val >= 0 ? '#22c55e' : '#ef4444' }}>
                  {val >= 0 ? '▲' : '▼'} {val?.toFixed(2)}%
                </span>
              </div>
            ))}
            <div className="detail-row">
              <span>From ATH</span>
              <span style={{ color: '#ef4444' }}>▼ {crypto.market_data?.ath_change_percentage?.eur?.toFixed(2)}%</span>
            </div>
          </div>

          {(crypto.description?.en) && (
            <>
              <h3 style={{ marginTop: '24px' }}>📝 Description</h3>
              <p className="company-description" dangerouslySetInnerHTML={{ __html: (crypto.description.en).slice(0, 400) + '...' }} />
            </>
          )}
        </div>
      </div>

      {(crypto.links?.homepage?.[0] || crypto.links?.blockchain_site?.[0]) && (
        <div className="detail-card" style={{ marginBottom: '30px' }}>
          <h3>🔗 Useful Links</h3>
          <div className="crypto-links">
            {crypto.links?.homepage?.[0] && (
              <a href={crypto.links.homepage[0]} target="_blank" rel="noopener noreferrer" className="crypto-ext-link">🌐 Official Website</a>
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
