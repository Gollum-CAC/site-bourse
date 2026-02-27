// Crypto list page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCryptos } from '../services/api';

function CryptosPage() {
  const [cryptos, setCryptos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadCryptos(); }, []);

  async function loadCryptos() {
    setLoading(true);
    setError('');
    try {
      const data = await getCryptos(50);
      if (Array.isArray(data)) setCryptos(data);
      else setError('Unexpected data format');
    } catch (err) {
      setError('Unable to load cryptocurrencies. Please try again.');
    }
    setLoading(false);
  }

  if (loading) return <p className="loading">Loading cryptocurrencies...</p>;
  if (error) return (
    <div className="cryptos-page">
      <h1>🪙 Cryptocurrencies</h1>
      <p className="error-message">{error}</p>
      <button onClick={loadCryptos} className="retry-button">🔄 Retry</button>
    </div>
  );

  return (
    <div className="cryptos-page">
      <h1>🪙 Cryptocurrencies</h1>
      <p className="page-subtitle">Top {cryptos.length} by market capitalization</p>

      <table className="crypto-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Price (EUR)</th>
            <th>24h Change</th>
            <th>Market Cap</th>
            <th>24h Volume</th>
          </tr>
        </thead>
        <tbody>
          {cryptos.map((crypto, index) => {
            const isPos = crypto.price_change_percentage_24h >= 0;
            return (
              <tr key={crypto.id} onClick={() => navigate(`/crypto/${crypto.id}`)} style={{ cursor: 'pointer' }}>
                <td>{index + 1}</td>
                <td className="crypto-name">
                  <img src={crypto.image} alt={crypto.name} width="24" height="24" />
                  <strong>{crypto.name}</strong>
                  <span className="crypto-symbol">{crypto.symbol?.toUpperCase()}</span>
                </td>
                <td>{crypto.current_price?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}</td>
                <td style={{ color: isPos ? '#22c55e' : '#ef4444' }}>
                  {isPos ? '▲' : '▼'} {crypto.price_change_percentage_24h?.toFixed(2)}%
                </td>
                <td>{(crypto.market_cap / 1e9)?.toFixed(2)} B €</td>
                <td>{(crypto.total_volume / 1e9)?.toFixed(2)} B €</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CryptosPage;
