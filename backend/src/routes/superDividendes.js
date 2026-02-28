// Super Dividendes — Actions US à fort rendement (plan FMP gratuit)
// Données issues de la DB locale, alimentée par le crawler

const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET /api/dividendes/super
router.get('/super', async (req, res) => {
  try {
    const minYield = parseFloat(req.query.minYield) || 2; // Seuil plus bas car actions US
    const sortBy   = req.query.sort || 'score';
    const sector   = req.query.sector || '';
    const limit    = parseInt(req.query.limit) || 50;

    const sortColumns = {
      score:      'da.composite_score DESC',
      yield:      'da.current_yield DESC',
      growth:     'da.dividend_growth DESC',
      regularity: 'da.regularity DESC',
      avgYield:   'da.avg_yield_5y DESC',
    };
    const orderBy = sortColumns[sortBy] || sortColumns.score;

    let query = `
      SELECT
        s.symbol, s.name, s.sector, s.industry,
        COALESCE(p.country, s.country) as country,
        COALESCE(p.sector, s.sector) as sector_detail,
        s.currency,
        q.price, q.market_cap,
        da.current_yield, da.avg_yield_5y, da.latest_annual_div,
        da.years_of_dividends, da.dividend_growth, da.trend,
        da.regularity, da.composite_score, da.dividend_history, da.calculated_at
      FROM dividend_analysis da
      JOIN stocks s ON s.symbol = da.symbol
      LEFT JOIN stock_quotes q ON q.symbol = da.symbol
      LEFT JOIN stock_profiles p ON p.symbol = da.symbol
      WHERE da.current_yield >= $1
    `;
    const params = [minYield];
    let idx = 2;

    if (sector) {
      query += ` AND s.sector = $${idx}`;
      params.push(sector);
      idx++;
    }

    query += ` ORDER BY ${orderBy} LIMIT $${idx}`;
    params.push(limit);

    const { rows } = await pool.query(query, params);

    // Secteurs disponibles
    const { rows: sectorRows } = await pool.query(`
      SELECT DISTINCT s.sector FROM dividend_analysis da
      JOIN stocks s ON s.symbol = da.symbol
      WHERE da.current_yield >= $1 AND s.sector IS NOT NULL
      ORDER BY s.sector
    `, [minYield]);

    // Stats crawler
    const { rows: crawlerRows } = await pool.query('SELECT * FROM crawler_state ORDER BY task_name').catch(() => ({ rows: [] }));

    res.json({
      stocks: rows.map(r => ({
        symbol: r.symbol,
        name: r.name,
        sector: r.sector || 'N/A',
        industry: r.industry,
        country: r.country || 'US',
        currency: r.currency || 'USD',
        price: parseFloat(r.price) || 0,
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
      minYield,
      crawler: crawlerRows,
    });
  } catch (err) {
    console.error('Erreur super dividendes:', err.message);
    if (err.message.includes('does not exist')) {
      return res.json({ stocks: [], count: 0, sectors: [], message: 'Base de données en cours d\'initialisation...' });
    }
    res.status(500).json({ erreur: 'Impossible de récupérer les super dividendes' });
  }
});

// GET /api/dividendes/stats
router.get('/stats', async (req, res) => {
  try {
    const [s, d, a, cr] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM stocks'),
      pool.query('SELECT COUNT(*) as total FROM dividends'),
      pool.query('SELECT COUNT(*) as total FROM dividend_analysis'),
      pool.query('SELECT * FROM crawler_state ORDER BY task_name'),
    ]);
    res.json({
      stocks: parseInt(s.rows[0].total),
      dividends: parseInt(d.rows[0].total),
      analyzed: parseInt(a.rows[0].total),
      crawler: cr.rows,
    });
  } catch (err) {
    res.json({ stocks: 0, dividends: 0, analyzed: 0, crawler: [], message: 'DB non initialisée' });
  }
});

module.exports = router;
