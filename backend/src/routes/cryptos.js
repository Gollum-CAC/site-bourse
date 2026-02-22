// Routes pour les cryptomonnaies
const express = require('express');
const router = express.Router();
const coingeckoService = require('../services/coingeckoService');

// GET /api/cryptos - Liste des principales cryptos
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const data = await coingeckoService.getTopCryptos(limit);
    res.json(data);
  } catch (error) {
    console.error('Erreur cryptos:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les cryptos' });
  }
});

// GET /api/cryptos/:id - Détails d'une crypto (ex: bitcoin)
router.get('/:id', async (req, res) => {
  try {
    const data = await coingeckoService.getCryptoDetails(req.params.id);
    res.json(data);
  } catch (error) {
    console.error('Erreur crypto détail:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les détails' });
  }
});

module.exports = router;
