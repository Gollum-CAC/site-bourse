// Main navigation bar — sticky, responsive, active page indicator
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const LINKS = [
  { to: '/',                 label: 'Home',        icone: '🏠', className: '' },
  { to: '/screener',         label: 'Screener',    icone: '🔍', className: 'screener-nav-link' },
  { to: '/comparateur',      label: 'Compare',     icone: '⚖️', className: '' },
  { to: '/super-dividendes', label: 'Super Div.',  icone: '💎', className: 'super-div-nav-link' },
  { to: '/calendrier',       label: 'Calendar',    icone: '📅', className: 'calendrier-nav-link' },
  { to: '/cryptos',          label: 'Crypto',      icone: '₿',  className: '' },
  { to: '/news',             label: 'News',        icone: '📰', className: '' },
  { to: '/watchlist',        label: 'Watchlist',   icone: '⭐', className: 'watchlist-nav-link' },
  { to: '/db-status',        label: 'DB',          icone: '🖥️', className: 'db-status-nav-link' },
];

function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) setMenuOpen(false);
  }

  function isActive(to) {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  }

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="navbar-brand">Market Hub</Link>

        <div className="navbar-links">
          {LINKS.map(({ to, label, className }) => (
            <Link
              key={to}
              to={to}
              className={[className, isActive(to) ? 'active-nav' : ''].filter(Boolean).join(' ')}
            >
              {label}
            </Link>
          ))}
        </div>

        <button
          className={`navbar-hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>
      </nav>

      {menuOpen && (
        <div className="mobile-menu-overlay" onClick={handleOverlayClick}>
          <div className="mobile-menu-drawer">
            <div className="mobile-menu-header">
              <span className="mobile-menu-title">
                <span className="navbar-brand-dot" /> Market Hub
              </span>
              <button
                className="mobile-menu-close"
                onClick={() => setMenuOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <nav className="mobile-menu-nav">
              {LINKS.map(({ to, label, icone, className }) => (
                <Link
                  key={to}
                  to={to}
                  className={[
                    'mobile-menu-link',
                    className,
                    isActive(to) ? 'mobile-menu-link-active' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className="mobile-menu-icone">{icone}</span>
                  <span className="mobile-menu-label">{label}</span>
                  {isActive(to) && <span className="mobile-menu-active-dot" />}
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
