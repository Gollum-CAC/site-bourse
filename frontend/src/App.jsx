// Application principale avec navigation
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import './App.css';

function App() {
  return (
    <Router>
      {/* Navbar sticky pleine largeur (hors du container max-width) */}
      <Navbar />

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
