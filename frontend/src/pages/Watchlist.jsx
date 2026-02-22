// Page Watchlist - Actions favorites
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getQuote } from '../services/api';
import StockCard from '../components/StockCard';

function Watchlist() {
  const [symbols, setSymbols] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
    setSymbols(watchlist);
    if (watchlist.length > 0) {
      loadStocks(watchlist);
    } else {
      setLoading(false);
    }
  }, []);

  // Rafraîchissement automatique toutes les 30 secondes
  useEffect(() => {
    if (symbols.length === 0) return;
    const interval = setInterval(() => {
      loadStocks(symbols);
    }, 30000);
    return () => clearInterval(interval);
  }, [symbols]);

  async function loadStocks(syms) {
    try {
      const results = await Promise.all(
        syms.map(symbol => getQuote(symbol))
      );
      setStocks(results.map(r => r[0]).filter(Boolean));
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Erreur chargement watchlist:', err);
    }
    setLoading(false);
  }

  function removeFromWatchlist(symbol) {
    const updated = symbols.filter(s => s !== symbol);
    localStorage.setItem('watchlist', JSON.stringify(updated));
    setSymbols(updated);
    setStocks(prev => prev.filter(s => s.symbol !== symbol));
  }

  if (loading) return <p className="loading">Chargement de votre watchlist...</p>;

  return (
    <div className="watchlist-page">
      <div className="section-header">
        <h1>⭐ Ma Watchlist</h1>
        {lastUpdate && (
          <span className="last-update">
            Mis à jour : {lastUpdate.toLocaleTimeString('fr-FR')} (auto-refresh 30s)
          </span>
        )}
      </div>

      {symbols.length === 0 ? (
        <div className="empty-watchlist">
          <p>Votre watchlist est vide.</p>
          <p>Ajoutez des actions en cliquant sur ☆ depuis la page de détail d'une action.</p>
          <Link to="/" className="see-all">→ Retour à l'accueil</Link>
        </div>
      ) : (
        <div className="stocks-grid">
          {stocks.map(stock => (
            <div key={stock.symbol} className="watchlist-item">
              <Link to={`/action/${stock.symbol}`} className="stock-link">
                <StockCard stock={stock} />
              </Link>
              <button
                className="remove-watchlist-btn"
                onClick={() => removeFromWatchlist(stock.symbol)}
                title="Retirer de la watchlist"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Watchlist;
