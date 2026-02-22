// Routes pour les actions et données financières
const express = require('express');
const router = express.Router();
const fmpService = require('../services/fmpService');

// GET /api/actions/quote/:symbol - Cours d'une action
router.get('/quote/:symbol', async (req, res) => {
  try {
    const data = await fmpService.getQuote(req.params.symbol.toUpperCase());
    res.json(data);
  } catch (error) {
    console.error('Erreur quote:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le cours' });
  }
});

// GET /api/actions/search?q=apple&exchange=EURONEXT - Recherche d'actions
router.get('/search', async (req, res) => {
  try {
    const data = await fmpService.searchStock(req.query.q, req.query.exchange || '');
    res.json(data);
  } catch (error) {
    console.error('Erreur recherche:', error.message);
    res.status(500).json({ erreur: 'Impossible de rechercher' });
  }
});

// GET /api/actions/dividendes/:symbol - Historique des dividendes
router.get('/dividendes/:symbol', async (req, res) => {
  try {
    const data = await fmpService.getDividends(req.params.symbol.toUpperCase());
    res.json(data);
  } catch (error) {
    console.error('Erreur dividendes:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les dividendes' });
  }
});

// GET /api/actions/profil/:symbol - Profil d'une entreprise
router.get('/profil/:symbol', async (req, res) => {
  try {
    const data = await fmpService.getCompanyProfile(req.params.symbol.toUpperCase());
    res.json(data);
  } catch (error) {
    console.error('Erreur profil:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le profil' });
  }
});

// GET /api/actions/historique/:symbol - Historique des prix
router.get('/historique/:symbol', async (req, res) => {
  try {
    const { from, to } = req.query;
    const data = await fmpService.getHistoricalPrice(req.params.symbol.toUpperCase(), from, to);
    res.json(data);
  } catch (error) {
    console.error('Erreur historique:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer l\'historique' });
  }
});

// GET /api/actions/ratios/:symbol - Ratios financiers clés
router.get('/ratios/:symbol', async (req, res) => {
  try {
    const data = await fmpService.getKeyMetrics(req.params.symbol.toUpperCase());
    res.json(data);
  } catch (error) {
    console.error('Erreur ratios:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les ratios' });
  }
});

// GET /api/actions/ratios-ttm/:symbol - Ratios financiers TTM
router.get('/ratios-ttm/:symbol', async (req, res) => {
  try {
    const data = await fmpService.getRatiosTTM(req.params.symbol.toUpperCase());
    res.json(data);
  } catch (error) {
    console.error('Erreur ratios TTM:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les ratios TTM' });
  }
});

// GET /api/actions/income/:symbol - Compte de résultat
router.get('/income/:symbol', async (req, res) => {
  try {
    const period = req.query.period || 'annual';
    const data = await fmpService.getIncomeStatement(req.params.symbol.toUpperCase(), period);
    res.json(data);
  } catch (error) {
    console.error('Erreur income statement:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le compte de résultat' });
  }
});

// GET /api/actions/bilan/:symbol - Bilan comptable
router.get('/bilan/:symbol', async (req, res) => {
  try {
    const period = req.query.period || 'annual';
    const data = await fmpService.getBalanceSheet(req.params.symbol.toUpperCase(), period);
    res.json(data);
  } catch (error) {
    console.error('Erreur balance sheet:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le bilan' });
  }
});

// GET /api/actions/cashflow/:symbol - Flux de trésorerie
router.get('/cashflow/:symbol', async (req, res) => {
  try {
    const period = req.query.period || 'annual';
    const data = await fmpService.getCashFlow(req.params.symbol.toUpperCase(), period);
    res.json(data);
  } catch (error) {
    console.error('Erreur cash flow:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer le flux de trésorerie' });
  }
});

module.exports = router;
