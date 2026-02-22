// Page liste complète des cryptomonnaies
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCryptos } from '../services/api';

function CryptosPage() {
  const [cryptos, setCryptos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadCryptos();
  }, []);

  async function loadCryptos() {
    setLoading(true);
    setError('');
    try {
      // On charge par lots pour éviter les limites de l'API
      const data = await getCryptos(50);
      console.log('Données cryptos reçues:', data);
      if (Array.isArray(data)) {
        setCryptos(data);
      } else {
        setError('Format de données inattendu');
        console.error('Données reçues:', data);
      }
    } catch (err) {
      console.error('Erreur chargement cryptos:', err);
      setError('Impossible de charger les cryptomonnaies. Réessayez dans quelques instants.');
    }
    setLoading(false);
  }

  if (loading) return <p className="loading">Chargement des cryptomonnaies...</p>;
  if (error) return (
    <div className="cryptos-page">
      <h1>🪙 Cryptomonnaies</h1>
      <p className="error-message">{error}</p>
      <button onClick={loadCryptos} className="retry-button">🔄 Réessayer</button>
    </div>
  );

  return (
    <div className="cryptos-page">
      <h1>🪙 Cryptomonnaies</h1>
      <p className="page-subtitle">Top {cryptos.length} par capitalisation boursière</p>

      <table className="crypto-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Nom</th>
            <th>Prix (EUR)</th>
            <th>Variation 24h</th>
            <th>Cap. marché</th>
            <th>Volume 24h</th>
          </tr>
        </thead>
        <tbody>
          {cryptos.map((crypto, index) => {
            const is24hPositive = crypto.price_change_percentage_24h >= 0;
            return (
              <tr key={crypto.id} onClick={() => navigate(`/crypto/${crypto.id}`)} style={{ cursor: 'pointer' }}>
                <td>{index + 1}</td>
                <td className="crypto-name">
                  <img src={crypto.image} alt={crypto.name} width="24" height="24" />
                  <strong>{crypto.name}</strong>
                  <span className="crypto-symbol">{crypto.symbol?.toUpperCase()}</span>
                </td>
                <td>{crypto.current_price?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                <td style={{ color: is24hPositive ? '#22c55e' : '#ef4444' }}>
                  {is24hPositive ? '▲' : '▼'} {crypto.price_change_percentage_24h?.toFixed(2)}%
                </td>
                <td>{(crypto.market_cap / 1e9)?.toFixed(2)} Mds €</td>
                <td>{(crypto.total_volume / 1e9)?.toFixed(2)} Mds €</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CryptosPage;
