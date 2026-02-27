// Search bar with autocomplete
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchStock } from '../services/api';

function SearchBar({ onSearch, marketFilter = '' }) {
  const [query, setQuery]                     = useState('');
  const [suggestions, setSuggestions]         = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading]                 = useState(false);
  const navigate   = useNavigate();
  const timeoutRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleInputChange(value) {
    setQuery(value);
    clearTimeout(timeoutRef.current);

    if (value.trim().length >= 2) {
      setLoading(true);
      timeoutRef.current = setTimeout(async () => {
        try {
          const results = await searchStock(value, marketFilter);
          setSuggestions(Array.isArray(results) ? results.slice(0, 8) : []);
          setShowSuggestions(true);
        } catch {}
        setLoading(false);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
    }
  }

  function handleSelect(symbol) {
    setShowSuggestions(false);
    setQuery('');
    navigate(`/action/${symbol}`);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setShowSuggestions(false);
    if (onSearch) {
      onSearch(query.trim().toUpperCase());
    } else {
      navigate(`/action/${query.trim().toUpperCase()}`);
    }
    setQuery('');
  }

  function getExchangeFlag(ex = '') {
    const u = ex.toUpperCase();
    if (u.includes('PARIS') || u.includes('EURONEXT')) return '🇫🇷';
    if (u.includes('XETRA') || u.includes('FRANKFURT')) return '🇩🇪';
    if (u.includes('LONDON') || u.includes('LSE')) return '🇬🇧';
    if (u.includes('AMSTERDAM')) return '🇳🇱';
    if (u.includes('NASDAQ') || u.includes('NYSE')) return '🇺🇸';
    if (u.includes('TSE') || u.includes('TOKYO')) return '🇯🇵';
    if (u.includes('HKSE') || u.includes('HONG KONG')) return '🇭🇰';
    return '🌐';
  }

  return (
    <div className="search-wrapper" ref={wrapperRef}>
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="search-input-row">
          <input
            type="text"
            placeholder="Search a stock — e.g. LVMH, AAPL, MC.PA, Apple…"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            autoComplete="off"
          />
          <button type="submit" disabled={!query.trim()}>
            {loading ? '…' : '🔍'}
          </button>
        </div>
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <div className="search-suggestions">
          {suggestions.map((s, i) => (
            <div key={i} className="suggestion-item" onClick={() => handleSelect(s.symbol)}>
              <div className="suggestion-main">
                <span className="suggestion-symbol">{s.symbol}</span>
                <span className="suggestion-name">{s.name}</span>
              </div>
              <span className="suggestion-exchange">
                {getExchangeFlag(s.exchangeShortName || s.stockExchange)}&nbsp;
                {s.exchangeShortName || s.stockExchange || ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
