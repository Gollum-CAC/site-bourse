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

// GET /api/actions/search?q=apple - Recherche d'actions
router.get('/search', async (req, res) => {
  try {
    const data = await fmpService.searchStock(req.query.q);
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

module.exports = router;
