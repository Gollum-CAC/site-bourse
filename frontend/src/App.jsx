// Application principale avec navigation
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import StockDetail from './pages/StockDetail';
import CryptosPage from './pages/CryptosPage';
import CryptoDetail from './pages/CryptoDetail';
import NewsPage from './pages/NewsPage';
import Watchlist from './pages/Watchlist';
import SuperDividendes from './pages/SuperDividendes';
import CalendrierFinancier from './pages/CalendrierFinancier';
import ScreenerPage from './pages/ScreenerPage';
import DbStatus from './pages/DbStatus';
import Comparateur from './pages/Comparateur';
import { getQuotaFMP } from './services/api';
import './App.css';

// Bandeau rouge déplaçable si quota FMP dépassé
function BandeauQuota({ depasse, resetTime }) {
  const [masque, setMasque] = useState(false);
  if (!depasse || masque) return null;

  const heure = resetTime
    ? new Date(resetTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : 'minuit';

  return (
    <div className="quota-bandeau">
      <span className="quota-icone">⚠️</span>
      <span className="quota-texte">
        <strong>Quota FMP dépassé</strong> — Les données affichées proviennent du cache local.
        Nouvel appel API disponible demain à {heure}.
      </span>
      <button className="quota-fermer" onClick={() => setMasque(true)} title="Fermer">×</button>
    </div>
  );
}

function App() {
  const [quota, setQuota] = useState({ depasse: false, resetTime: null });

  useEffect(() => {
    // Vérifier le quota au chargement + toutes les 5 min
    async function checkQuota() {
      try { setQuota(await getQuotaFMP()); } catch {}
    }
    checkQuota();
    const id = setInterval(checkQuota, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Router>
      {/* Navbar sticky pleine largeur (hors du container max-width) */}
      <Navbar />

      {/* Bandeau quota FMP */}
      <BandeauQuota depasse={quota.depasse} resetTime={quota.resetTime} />

      {/* Contenu centré */}
      <div className="app">
        <main className="app-main">
          <Routes>
            <Route path="/"                  element={<Home />} />
            <Route path="/action/:symbol"    element={<StockDetail />} />
            <Route path="/cryptos"           element={<CryptosPage />} />
            <Route path="/crypto/:id"        element={<CryptoDetail />} />
            <Route path="/news"              element={<NewsPage />} />
            <Route path="/watchlist"         element={<Watchlist />} />
            <Route path="/super-dividendes"  element={<SuperDividendes />} />
            <Route path="/calendrier"        element={<CalendrierFinancier />} />
            <Route path="/screener"          element={<ScreenerPage />} />
            <Route path="/db-status"         element={<DbStatus />} />
            <Route path="/comparateur"       element={<Comparateur />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <p>
            Site Bourse MVP · Données&nbsp;
            <a href="https://financialmodelingprep.com" target="_blank" rel="noopener noreferrer">FMP</a>,&nbsp;
            <a href="https://www.coingecko.com"         target="_blank" rel="noopener noreferrer">CoinGecko</a>&nbsp;&amp;&nbsp;
            <a href="https://newsapi.org"               target="_blank" rel="noopener noreferrer">NewsAPI</a>
          </p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
