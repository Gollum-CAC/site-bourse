// Composant de navigation principal — sticky, responsive, indicateur page active
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const LIENS = [
  { to: '/',                label: 'Accueil',    className: '' },
  { to: '/screener',        label: '🔍 Screener',  className: 'screener-nav-link' },
  { to: '/super-dividendes',label: '💎 Super Div.',className: 'super-div-nav-link' },
  { to: '/calendrier',      label: '📅 Calendrier',className: 'calendrier-nav-link' },
  { to: '/cryptos',         label: 'Cryptos',    className: '' },
  { to: '/news',            label: 'Actualités', className: '' },
  { to: '/watchlist',       label: '⭐ Watchlist', className: 'watchlist-nav-link' },
  { to: '/db-status',       label: '🖥️ DB',          className: 'db-status-nav-link' },
];

function Navbar() {
  const location = useLocation();
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Fermer le menu si on navigue
  useEffect(() => { setMenuOuvert(false); }, [location.pathname]);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    if (!menuOuvert) return;
    const fermer = (e) => {
      if (!e.target.closest('.navbar')) setMenuOuvert(false);
    };
    document.addEventListener('click', fermer);
    return () => document.removeEventListener('click', fermer);
  }, [menuOuvert]);

  function estActif(to) {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">Site Bourse</Link>

      {/* Liens desktop */}
      <div className={`navbar-links ${menuOuvert ? 'open' : ''}`}>
        {LIENS.map(({ to, label, className }) => (
          <Link
            key={to}
            to={to}
            className={[
              className,
              estActif(to) ? 'active-nav' : '',
            ].filter(Boolean).join(' ')}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Bouton hamburger mobile */}
      <button
        className="navbar-hamburger"
        onClick={() => setMenuOuvert(v => !v)}
        aria-label="Menu"
        aria-expanded={menuOuvert}
      >
        <span style={{ transform: menuOuvert ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
        <span style={{ opacity: menuOuvert ? 0 : 1 }} />
        <span style={{ transform: menuOuvert ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
      </button>
    </nav>
  );
}

export default Navbar;
