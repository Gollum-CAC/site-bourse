// Composant barre de recherche avec suggestions et filtre marché
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchStock } from '../services/api';

const MARKETS = [
  { label: 'Tous', value: '' },
  { label: '🇺🇸 US', value: 'NASDAQ,NYSE' },
  { label: '🇫🇷 Paris', value: 'EURONEXT' },
  { label: '🇳🇱 Amsterdam', value: 'EURONEXT' },
  { label: '🇩🇪 Francfort', value: 'XETRA' },
  { label: '🇬🇧 Londres', value: 'LSE' },
];

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const wrapperRef = useRef(null);

  // Fermer les suggestions quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autocomplétion avec debounce
  function handleInputChange(value) {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (value.trim().length >= 2) {
      timeoutRef.current = setTimeout(async () => {
        try {
          const results = await searchStock(value, market);
          setSuggestions(Array.isArray(results) ? results.slice(0, 8) : []);
          setShowSuggestions(true);
        } catch (err) {
          console.error('Erreur autocomplétion:', err);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }

  function handleSelect(symbol) {
    setShowSuggestions(false);
    setQuery('');
    navigate(`/action/${symbol}`);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      if (onSearch) {
        onSearch(query.trim().toUpperCase());
      } else {
        navigate(`/action/${query.trim().toUpperCase()}`);
      }
      setQuery('');
    }
  }

  // Déterminer le drapeau/exchange pour l'affichage
  function getExchangeFlag(exchangeName) {
    if (!exchangeName) return '';
    const ex = exchangeName.toUpperCase();
    if (ex.includes('PARIS') || ex.includes('EURONEXT')) return '🇫🇷';
    if (ex.includes('XETRA') || ex.includes('FRANKFURT')) return '🇩🇪';
    if (ex.includes('LONDON') || ex.includes('LSE')) return '🇬🇧';
    if (ex.includes('AMSTERDAM')) return '🇳🇱';
    if (ex.includes('BRUSSELS')) return '🇧🇪';
    if (ex.includes('MILAN') || ex.includes('BORSA')) return '🇮🇹';
    if (ex.includes('NASDAQ') || ex.includes('NYSE') || ex.includes('AMEX')) return '🇺🇸';
    if (ex.includes('TSX') || ex.includes('TORONTO')) return '🇨🇦';
    return '🌐';
  }

  return (
    <div className="search-wrapper" ref={wrapperRef}>
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="market-filter">
          {MARKETS.map((m, i) => (
            <button
              key={m.label}
              type="button"
              className={market === m.value ? 'market-active' : ''}
              onClick={() => setMarket(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="search-input-row">
          <input
            type="text"
            placeholder="Rechercher une action (ex: LVMH, Apple, MC.PA, AAPL...)"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          />
          <button type="submit">🔍</button>
        </div>
      </form>

      {/* Suggestions d'autocomplétion */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggestions">
          {suggestions.map((s, i) => (
            <div key={i} className="suggestion-item" onClick={() => handleSelect(s.symbol)}>
              <div className="suggestion-main">
                <span className="suggestion-symbol">{s.symbol}</span>
                <span className="suggestion-name">{s.name}</span>
              </div>
              <span className="suggestion-exchange">
                {getExchangeFlag(s.exchangeShortName || s.stockExchange)} {s.exchangeShortName || s.stockExchange || ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
