// Routes pour la section Super Dividendes PEA
// Lit les données depuis PostgreSQL (alimenté par le crawler)
const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/dividendes/super — Top dividendes PEA depuis la base
router.get('/super', async (req, res) => {
  try {
    const minYield = parseFloat(req.query.minYield) || 7;
    const sortBy = req.query.sort || 'score'; // score, yield, growth, regularity
    const sector = req.query.sector || '';
    const limit = parseInt(req.query.limit) || 50;

    // Colonnes de tri autorisées
    const sortColumns = {
      score: 'da.composite_score DESC',
      yield: 'da.current_yield DESC',
      growth: 'da.dividend_growth DESC',
      regularity: 'da.regularity DESC',
      avgYield: 'da.avg_yield_5y DESC',
    };
    const orderBy = sortColumns[sortBy] || sortColumns.score;

    let query = `
      SELECT 
        s.symbol, s.name, s.sector, s.industry, s.price, s.market_cap, s.country,
        da.current_yield, da.avg_yield_5y, da.latest_annual_div,
        da.years_of_dividends, da.dividend_growth, da.trend,
        da.regularity, da.composite_score, da.dividend_history,
        da.calculated_at
      FROM dividend_analysis da
      JOIN stocks s ON s.symbol = da.symbol
      WHERE da.current_yield >= $1
        AND s.is_pea_eligible = TRUE
    `;
    const params = [minYield];
    let paramIdx = 2;

    if (sector) {
      query += ` AND s.sector = $${paramIdx}`;
      params.push(sector);
      paramIdx++;
    }

    query += ` ORDER BY ${orderBy} LIMIT $${paramIdx}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);

    // Récupérer les secteurs disponibles
    const { rows: sectorRows } = await pool.query(`
      SELECT DISTINCT s.sector FROM dividend_analysis da
      JOIN stocks s ON s.symbol = da.symbol
      WHERE da.current_yield >= $1 AND s.sector IS NOT NULL
      ORDER BY s.sector
    `, [minYield]);

    // Stats du crawler
    const { rows: crawlerRows } = await pool.query('SELECT * FROM crawler_state ORDER BY task_name');
    const { rows: countRows } = await pool.query('SELECT COUNT(*) as total FROM stocks WHERE is_pea_eligible = TRUE');

    res.json({
      stocks: rows.map(r => ({
        symbol: r.symbol,
        name: r.name,
        sector: r.sector || 'N/A',
        industry: r.industry,
        country: r.country,
        price: parseFloat(r.price),
        currency: '€',
        marketCap: parseInt(r.market_cap) || 0,
        currentYield: parseFloat(r.current_yield),
        avgYield: parseFloat(r.avg_yield_5y),
        latestAnnualDiv: parseFloat(r.latest_annual_div),
        yearsOfDividends: r.years_of_dividends,
        growth: parseFloat(r.dividend_growth),
        trend: r.trend,
        regularity: r.regularity,
        score: r.composite_score,
        history: r.dividend_history || [],
        calculatedAt: r.calculated_at,
      })),
      count: rows.length,
      sectors: sectorRows.map(r => r.sector),
      totalStocksInDb: parseInt(countRows[0].total),
      crawler: crawlerRows,
      minYield,
    });
  } catch (err) {
    console.error('Erreur super dividendes:', err.message);
    
    // Si la table n'existe pas encore, renvoyer un message utile
    if (err.message.includes('does not exist')) {
      return res.json({
        stocks: [],
        count: 0,
        sectors: [],
        totalStocksInDb: 0,
        message: 'Base de données en cours d\'initialisation. Le crawler collecte les données...',
      });
    }
    
    res.status(500).json({ erreur: 'Impossible de récupérer les super dividendes' });
  }
});

// GET /api/dividendes/stats — Stats du crawler et de la base
router.get('/stats', async (req, res) => {
  try {
    const { rows: crawlerRows } = await pool.query('SELECT * FROM crawler_state ORDER BY task_name');
    const { rows: stockCount } = await pool.query('SELECT COUNT(*) as total FROM stocks WHERE is_pea_eligible = TRUE');
    const { rows: divCount } = await pool.query('SELECT COUNT(*) as total FROM dividends');
    const { rows: analysisCount } = await pool.query('SELECT COUNT(*) as total FROM dividend_analysis');
    const { rows: topYield } = await pool.query('SELECT COUNT(*) as total FROM dividend_analysis WHERE current_yield >= 7');

    res.json({
      stocks: parseInt(stockCount[0].total),
      dividends: parseInt(divCount[0].total),
      analyzed: parseInt(analysisCount[0].total),
      superDividends: parseInt(topYield[0].total),
      crawler: crawlerRows,
    });
  } catch (err) {
    // Tables pas encore créées
    res.json({ stocks: 0, dividends: 0, analyzed: 0, superDividends: 0, crawler: [], message: 'DB non initialisée' });
  }
});

module.exports = router;
