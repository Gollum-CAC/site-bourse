// Composant barre de recherche d'actions
import { useState } from 'react';

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim().toUpperCase());
      setQuery('');
    }
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Rechercher une action (ex: AAPL, MSFT, TSLA...)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button type="submit">🔍 Rechercher</button>
    </form>
  );
}

export default SearchBar;
