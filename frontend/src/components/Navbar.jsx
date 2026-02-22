// Composant de navigation principal
import { Link } from 'react-router-dom';

function Navbar() {
  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">📈 Site Bourse</Link>
      <div className="navbar-links">
        <Link to="/">Accueil</Link>
        <Link to="/cryptos">Cryptos</Link>
        <Link to="/news">Actualités</Link>
        <Link to="/watchlist" className="watchlist-nav-link">⭐ Watchlist</Link>
      </div>
    </nav>
  );
}

export default Navbar;
