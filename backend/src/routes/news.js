// Routes pour les actualités financières
const express = require('express');
const router = express.Router();
const newsService = require('../services/newsService');

// GET /api/news - Actualités financières
router.get('/', async (req, res) => {
  try {
    const data = await newsService.getFinanceNews();
    res.json(data);
  } catch (error) {
    console.error('Erreur news:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les actualités' });
  }
});

// GET /api/news/headlines - Gros titres business
router.get('/headlines', async (req, res) => {
  try {
    const data = await newsService.getTopHeadlines();
    res.json(data);
  } catch (error) {
    console.error('Erreur headlines:', error.message);
    res.status(500).json({ erreur: 'Impossible de récupérer les titres' });
  }
});

module.exports = router;
