// Routes actions — Plan GRATUIT FMP
// Endpoints disponibles : quote, profile, historical, dividends, dividend-calendar, search
// Supprimés (plan payant) : ratios-ttm, income, bilan, cashflow, earnings, analystes, insider, institutionnels

const express = require('express');
const router = express.Router();
const fmpService = require('../services/fmpService');
const dbService = require('../services/dbService');
const { FMP_FREE_SYMBOLS } = require('../fmpSymbols');

const sym = (req) => req.params.symbol.toUpperCase();

// ==========================================
// === COURS ===
// ==========================================

// GET /api/actions/quote/:symbol — DB d'abord, FMP en fallback
router.get('/quote/:symbol', async (req, res) => {
  try {
    res.json(await dbService.getQuote(sym(req)));
  } catch (e) {
    res.status(500).json({ erreur: 'Impossible de récupérer le cours' });
  }
});

// GET /api/actions/quotes?symbols=AAPL,MSFT — Batch quotes
router.get('/quotes', async (req, res) => {
  try {
    const symbols = (req.query.symbols || '')
      .split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 87);
    if (symbols.length === 0) return res.json([]);
    res.json(await dbService.getBatchQuotes(symbols));
  } catch (e) {
    res.status(500).json({ erreur: 'Impossible de récupérer les cours' });
  }
});

// GET /api/actions/search?q=apple
router.get('/search', async (req, res) => {
  try {
    if (!req.query.q) return res.json([]);
    res.json(await fmpService.searchStock(req.query.q));
  } catch (e) {
    res.status(500).json({ erreur: 'Impossible de rechercher' });
  }
});

// GET /api/actions/symbols — Liste des symboles disponibles (plan gratuit)
router.get('/symbols', (req, res) => {
  res.json({ symbols: FMP_FREE_SYMBOLS, count: FMP_FREE_SYMBOLS.length });
});

// ==========================================
// === PROFIL ===
// ==========================================

// GET /api/actions/profil/:symbol
router.get('/profil/:symbol', async (req, res) => {
  try {
    res.json(await dbService.getProfile(sym(req)));
  } catch (e) {
    res.status(500).json({ erreur: 'Impossible de récupérer le profil' });
  }
});

// ==========================================
// === HISTORIQUE DES PRIX (EOD) ===
// ==========================================

// GET /api/actions/historique/:symbol?from=2024-01-01&to=2025-01-01
router.get('/historique/:symbol', async (req, res) => {
  try {
    res.json(await fmpService.getHistoricalPrice(sym(req), req.query.from, req.query.to));
  } catch (e) {
    res.status(500).json({ erreur: "Impossible de récupérer l'historique" });
  }
});

// ==========================================
// === DIVIDENDES ===
// ==========================================

// GET /api/actions/dividendes/:symbol — Historique dividendes (DB d'abord)
router.get('/dividendes/:symbol', async (req, res) => {
  try {
    const symbol = sym(req);
    const { rows } = await require('../config/database').query(
      'SELECT * FROM dividends WHERE symbol = $1 ORDER BY ex_date DESC',
      [symbol]
    );
    if (rows.length > 0) return res.json({ historical: rows, _fromDB: true });
    // Fallback API si pas en DB
    res.json(await fmpService.getDividends(symbol));
  } catch (e) {
    res.status(500).json({ erreur: 'Impossible de récupérer les dividendes' });
  }
});

// GET /api/actions/calendrier-dividendes?from=2025-01-01&to=2025-12-31
// Ce endpoint est disponible sur le plan gratuit FMP (données globales)
router.get('/calendrier-dividendes', async (req, res) => {
  try {
    res.json(await fmpService.getDividendCalendar(req.query.from, req.query.to));
  } catch (e) {
    res.status(500).json({ erreur: 'Impossible de récupérer le calendrier des dividendes' });
  }
});

module.exports = router;
