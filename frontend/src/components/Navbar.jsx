// Composant de navigation principal — sticky, responsive, indicateur page active
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const LIENS = [
  { to: '/',                 label: 'Accueil',      icone: '🏠', className: '' },
  { to: '/screener',         label: 'Screener',     icone: '🔍', className: 'screener-nav-link' },
  { to: '/super-dividendes', label: 'Super Div.',   icone: '💎', className: 'super-div-nav-link' },
  { to: '/calendrier',       label: 'Calendrier',   icone: '📅', className: 'calendrier-nav-link' },
  { to: '/cryptos',          label: 'Cryptos',      icone: '₿',  className: '' },
  { to: '/news',             label: 'Actualités',   icone: '📰', className: '' },
  { to: '/watchlist',        label: 'Watchlist',    icone: '⭐', className: 'watchlist-nav-link' },
  { to: '/db-status',        label: 'DB',           icone: '🖥️', className: 'db-status-nav-link' },
];

function Navbar() {
  const location = useLocation();
  const [menuOuvert, setMenuOuvert] = useState(false);

  // Fermer le menu si on navigue
  useEffect(() => { setMenuOuvert(false); }, [location.pathname]);

  // Bloquer le scroll body quand le menu est ouvert
  useEffect(() => {
    document.body.style.overflow = menuOuvert ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOuvert]);

  // Fermer le menu si on clique sur l'overlay
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) setMenuOuvert(false);
  }

  function estActif(to) {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  }

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-brand">Site Bourse</Link>

        {/* Liens desktop (masqués sur mobile) */}
        <div className="navbar-links">
          {LIENS.map(({ to, label, className }) => (
            <Link
              key={to}
              to={to}
              className={[className, estActif(to) ? 'active-nav' : ''].filter(Boolean).join(' ')}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Bouton hamburger mobile — 3 barres → ✕ via CSS */}
        <button
          className={`navbar-hamburger ${menuOuvert ? 'open' : ''}`}
          onClick={() => setMenuOuvert(v => !v)}
          aria-label={menuOuvert ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOuvert}
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Overlay + Drawer mobile — EN DEHORS de <nav> pour couvrir tout l'écran */}
      {menuOuvert && (
        <div className="mobile-menu-overlay" onClick={handleOverlayClick}>
          <div className="mobile-menu-drawer">
            {/* Header du drawer */}
            <div className="mobile-menu-header">
              <span className="mobile-menu-title">
                <span className="navbar-brand-dot" /> Site Bourse
              </span>
              <button
                className="mobile-menu-close"
                onClick={() => setMenuOuvert(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Liste des liens */}
            <nav className="mobile-menu-nav">
              {LIENS.map(({ to, label, icone, className }) => (
                <Link
                  key={to}
                  to={to}
                  className={[
                    'mobile-menu-link',
                    className,
                    estActif(to) ? 'mobile-menu-link-active' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className="mobile-menu-icone">{icone}</span>
                  <span className="mobile-menu-label">{label}</span>
                  {estActif(to) && <span className="mobile-menu-active-dot" />}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
