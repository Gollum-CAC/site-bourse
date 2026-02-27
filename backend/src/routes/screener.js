// Screener — Plan GRATUIT FMP
// Fonctionne uniquement sur les données locales (87 symboles en DB)
// Le screener FMP temps réel n'est pas disponible sur le plan gratuit

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { FMP_FREE_SYMBOLS } = require('../fmpSymbols');

// GET /api/screener
router.get('/', async (req, res) => {
  try {
    const {
      sector = '',
      country = '',
      marketCapMin = '',
      marketCapMax = '',
      dividendYieldMin = '',
      priceMin = '',
      priceMax = '',
      limit = '50',
      sortBy = 'marketCap',
      sortDir = 'desc',
    } = req.query;

    const limitNum = Math.min(parseInt(limit) || 50, 87);

    const sortColumns = {
      marketCap: 's.market_cap',
      price: 'q.price',
      dividendYield: 'da.current_yield',
      score: 'da.composite_score',
    };
    const colTri = sortColumns[sortBy] || 's.market_cap';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    let conditions = ['s.symbol = ANY($1::text[])', 'q.price > 0'];
    const params = [FMP_FREE_SYMBOLS];
    let idx = 2;

    if (country) { conditions.push(`s.country = $${idx}`); params.push(country.toUpperCase()); idx++; }
    if (sector)  { conditions.push(`s.sector ILIKE $${idx}`); params.push(`%${sector}%`); idx++; }
    if (marketCapMin) { conditions.push(`q.market_cap >= $${idx}`); params.push(parseInt(marketCapMin)); idx++; }
    if (marketCapMax) { conditions.push(`q.market_cap <= $${idx}`); params.push(parseInt(marketCapMax)); idx++; }
    if (priceMin) { conditions.push(`q.price >= $${idx}`); params.push(parseFloat(priceMin)); idx++; }
    if (priceMax) { conditions.push(`q.price <= $${idx}`); params.push(parseFloat(priceMax)); idx++; }
    if (dividendYieldMin) { conditions.push(`da.current_yield >= $${idx}`); params.push(parseFloat(dividendYieldMin)); idx++; }

    params.push(limitNum);
    const sql = `
      SELECT s.symbol, s.name, s.sector, s.country, s.currency,
             q.price, q.change_pct, q.market_cap, q.pe, q.volume,
             da.current_yield, da.composite_score, da.trend, da.years_of_dividends
      FROM stocks s
      LEFT JOIN stock_quotes q ON q.symbol = s.symbol
      LEFT JOIN dividend_analysis da ON da.symbol = s.symbol
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${colTri} ${dir} NULLS LAST
      LIMIT $${idx}
    `;

    const { rows } = await pool.query(sql, params);

    // Compte total
    const sqlCount = sql.replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY[\s\S]+$/, '');
    const { rows: countRows } = await pool.query(sqlCount, params.slice(0, -1));

    res.json({
      stocks: rows.map(r => ({
        symbol: r.symbol,
        name: r.name,
        sector: r.sector || 'N/A',
        country: r.country || 'US',
        currency: r.currency || 'USD',
        price: parseFloat(r.price) || 0,
        changePercent: parseFloat(r.change_pct) || 0,
        marketCap: parseInt(r.market_cap) || 0,
        pe: parseFloat(r.pe) || null,
        volume: parseInt(r.volume) || null,
        dividendYield: r.current_yield ? parseFloat(r.current_yield) : null,
        score: r.composite_score || null,
        trend: r.trend || null,
        yearsOfDividends: r.years_of_dividends || null,
      })),
      total: parseInt(countRows[0]?.total) || 0,
      source: 'database',
      note: `Données locales — ${FMP_FREE_SYMBOLS.length} symboles (plan FMP gratuit)`,
    });
  } catch (err) {
    console.error('[Screener]', err.message);
    res.status(500).json({ erreur: 'Erreur screener', detail: err.message });
  }
});

// GET /api/screener/secteurs
router.get('/secteurs', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT sector FROM stocks
      WHERE sector IS NOT NULL AND symbol = ANY($1::text[])
      ORDER BY sector
    `, [FMP_FREE_SYMBOLS]);
    res.json({ secteurs: rows.map(r => r.sector) });
  } catch {
    res.json({ secteurs: [] });
  }
});

// GET /api/screener/presets
router.get('/presets', (req, res) => {
  res.json({
    presets: [
      { id: 'top_dividendes', label: '💰 Top Dividendes', params: { dividendYieldMin: '3', sortBy: 'dividendYield', sortDir: 'desc' } },
      { id: 'large_caps',     label: '🏆 Large Caps',     params: { marketCapMin: '100000000000', sortBy: 'marketCap', sortDir: 'desc' } },
      { id: 'tech',           label: '🚀 Technologie',    params: { sector: 'Technology', sortBy: 'marketCap', sortDir: 'desc' } },
      { id: 'sante',          label: '🏥 Santé',          params: { sector: 'Healthcare', sortBy: 'marketCap', sortDir: 'desc' } },
      { id: 'energie',        label: '⚡ Énergie',         params: { sector: 'Energy', sortBy: 'dividendYield', sortDir: 'desc' } },
    ],
  });
});

module.exports = router;
