// Routes pour les actions et données financières
const express = require('express');
const router = express.Router();
const fmpService = require('../services/fmpService');
const dbService = require('../services/dbService'); // DB-first pour quotes/profils/ratios

// Helper pour symbole en majuscules
const sym = (req) => req.params.symbol.toUpperCase();

// ==========================================
// === DONNÉES DE BASE ===
// ==========================================

// GET /api/actions/quote/:symbol — DB d'abord, FMP en fallback
router.get('/quote/:symbol', async (req, res) => {
  try {
    res.json(await dbService.getQuote(sym(req)));
  } catch (e) {
    console.error('Erreur quote:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le cours' });
  }
});

// GET /api/actions/quotes?symbols=AAPL,MSFT,GOOGL — Batch quotes (1 appel FMP max)
router.get('/quotes', async (req, res) => {
  try {
    const symbols = (req.query.symbols || '')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 20); // max 20 symboles par appel
    if (symbols.length === 0) return res.json([]);
    res.json(await dbService.getBatchQuotes(symbols));
  } catch (e) {
    console.error('Erreur batch quotes:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les cours' });
  }
});

// GET /api/actions/search?q=apple&exchange=EURONEXT
router.get('/search', async (req, res) => {
  try {
    res.json(await fmpService.searchStock(req.query.q, req.query.exchange || ''));
  } catch (e) {
    console.error('Erreur recherche:', e.message);
    res.status(500).json({ erreur: 'Impossible de rechercher' });
  }
});

// GET /api/actions/profil/:symbol — DB d'abord, FMP en fallback
router.get('/profil/:symbol', async (req, res) => {
  try {
    res.json(await dbService.getProfile(sym(req)));
  } catch (e) {
    console.error('Erreur profil:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le profil' });
  }
});

// GET /api/actions/historique/:symbol?from=&to=
router.get('/historique/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getHistoricalPrice(sym(req), req.query.from, req.query.to));
  } catch (e) {
    console.error('Erreur historique:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer l\'historique' });
  }
});

// GET /api/actions/screener?exchange=euronext&limit=20
router.get('/screener', async (req, res) => {
  try {
    res.json(await fmpService.getStockScreener(req.query.exchange || '', Number(req.query.limit) || 20));
  } catch (e) {
    console.error('Erreur screener:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer la liste' });
  }
});

// ==========================================
// === RATIOS & MÉTRIQUES ===
// ==========================================

// GET /api/actions/ratios/:symbol
router.get('/ratios/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getKeyMetrics(sym(req)));
  } catch (e) {
    console.error('Erreur ratios:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les ratios' });
  }
});

// GET /api/actions/ratios-ttm/:symbol — DB d'abord, FMP en fallback
router.get('/ratios-ttm/:symbol', async (req, res) => {
  try {
    res.json(await dbService.getRatiosTTM(sym(req)));
  } catch (e) {
    console.error('Erreur ratios TTM:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les ratios TTM' });
  }
});

// ==========================================
// === ÉTATS FINANCIERS ===
// ==========================================

// GET /api/actions/income/:symbol?period=annual
router.get('/income/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getIncomeStatement(sym(req), req.query.period || 'annual'));
  } catch (e) {
    console.error('Erreur income:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le compte de résultat' });
  }
});

// GET /api/actions/bilan/:symbol?period=annual
router.get('/bilan/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getBalanceSheet(sym(req), req.query.period || 'annual'));
  } catch (e) {
    console.error('Erreur bilan:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le bilan' });
  }
});

// GET /api/actions/cashflow/:symbol?period=annual
router.get('/cashflow/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getCashFlow(sym(req), req.query.period || 'annual'));
  } catch (e) {
    console.error('Erreur cashflow:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le flux de trésorerie' });
  }
});

// ==========================================
// === DIVIDENDES & CALENDRIER ===
// ==========================================

// GET /api/actions/dividendes/:symbol — Historique dividendes
router.get('/dividendes/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getDividends(sym(req)));
  } catch (e) {
    console.error('Erreur dividendes:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les dividendes' });
  }
});

// GET /api/actions/calendrier-dividendes?from=2025-01-01&to=2025-12-31
router.get('/calendrier-dividendes', async (req, res) => {
  try {
    res.json(await fmpService.getDividendCalendar(req.query.from, req.query.to));
  } catch (e) {
    console.error('Erreur calendrier dividendes:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le calendrier des dividendes' });
  }
});

// ==========================================
// === RÉSULTATS / EARNINGS ===
// ==========================================

// GET /api/actions/earnings/:symbol — Historique résultats (EPS réel vs estimé)
router.get('/earnings/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getEarnings(sym(req)));
  } catch (e) {
    console.error('Erreur earnings:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les résultats' });
  }
});

// GET /api/actions/calendrier-earnings?from=2025-01-01&to=2025-12-31
router.get('/calendrier-earnings', async (req, res) => {
  try {
    res.json(await fmpService.getEarningsCalendar(req.query.from, req.query.to));
  } catch (e) {
    console.error('Erreur calendrier earnings:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le calendrier des résultats' });
  }
});

// GET /api/actions/earnings-confirmes?from=2025-01-01&to=2025-03-31
router.get('/earnings-confirmes', async (req, res) => {
  try {
    res.json(await fmpService.getEarningsConfirmed(req.query.from, req.query.to));
  } catch (e) {
    console.error('Erreur earnings confirmés:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les résultats confirmés' });
  }
});

// ==========================================
// === CONSENSUS ANALYSTES ===
// ==========================================

// GET /api/actions/consensus/:symbol — Estimations analystes (revenus, EPS)
router.get('/consensus/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getAnalystConsensus(sym(req)));
  } catch (e) {
    console.error('Erreur consensus:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le consensus' });
  }
});

// GET /api/actions/objectif-prix/:symbol — Objectifs de prix des analystes
router.get('/objectif-prix/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getPriceTarget(sym(req)));
  } catch (e) {
    console.error('Erreur objectif prix:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les objectifs de prix' });
  }
});

// GET /api/actions/objectif-consensus/:symbol — Consensus résumé (buy/hold/sell)
router.get('/objectif-consensus/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getPriceTargetConsensus(sym(req)));
  } catch (e) {
    console.error('Erreur objectif consensus:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le consensus objectif' });
  }
});

// GET /api/actions/grades/:symbol — Notes des analystes (upgrade/downgrade)
router.get('/grades/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getAnalystGrades(sym(req)));
  } catch (e) {
    console.error('Erreur grades:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les notes analystes' });
  }
});

// ==========================================
// === INSIDER TRADING ===
// ==========================================

// GET /api/actions/insider/:symbol — Transactions des dirigeants
router.get('/insider/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getInsiderTrading(sym(req)));
  } catch (e) {
    console.error('Erreur insider:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les transactions insider' });
  }
});

// GET /api/actions/institutionnels/:symbol — Détenteurs institutionnels
router.get('/institutionnels/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getInstitutionalHolders(sym(req)));
  } catch (e) {
    console.error('Erreur institutionnels:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les détenteurs institutionnels' });
  }
});

// ==========================================
// === ACTUALITÉS ===
// ==========================================

// GET /api/actions/news/:symbol — Actualités spécifiques à une action
router.get('/news/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getStockNews(sym(req), Number(req.query.limit) || 20));
  } catch (e) {
    console.error('Erreur stock news:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les actualités' });
  }
});

// GET /api/actions/news-generales — Actualités financières FMP
router.get('/news-generales', async (req, res) => {
  try {
    res.json(await fmpService.getGeneralNews(Number(req.query.limit) || 30));
  } catch (e) {
    console.error('Erreur general news:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les actualités générales' });
  }
});

// GET /api/actions/communiques/:symbol — Communiqués de presse
router.get('/communiques/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getPressReleases(sym(req), Number(req.query.limit) || 10));
  } catch (e) {
    console.error('Erreur press releases:', e.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les communiqués' });
  }
});

module.exports = router;
