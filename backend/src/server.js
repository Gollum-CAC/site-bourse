// Serveur principal Express — Plan GRATUIT FMP
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes actives
const actionsRoutes        = require('./routes/actions');
const cryptosRoutes        = require('./routes/cryptos');
const newsRoutes           = require('./routes/news');
const superDividendesRoutes = require('./routes/superDividendes');
const screenerRoutes       = require('./routes/screener');

app.use('/api/actions',    actionsRoutes);
app.use('/api/cryptos',    cryptosRoutes);
app.use('/api/news',       newsRoutes);
app.use('/api/dividendes', superDividendesRoutes);
app.use('/api/screener',   screenerRoutes);

// Statut DB
app.get('/api/db-status', async (req, res) => {
  try {
    const pool = require('./config/database');

    const [stocksRes, quotesRes, profilesRes, divsRes, analysisRes, quotesOkRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM stocks'),
      pool.query('SELECT COUNT(*) FROM stock_quotes'),
      pool.query('SELECT COUNT(*) FROM stock_profiles'),
      pool.query('SELECT COUNT(DISTINCT symbol) FROM dividends'),
      pool.query('SELECT COUNT(*) FROM dividend_analysis'),
      pool.query(`SELECT COUNT(*) FROM stock_quotes WHERE updated_at > NOW() - INTERVAL '6 hours'`),
    ]);

    const { rows: liste } = await pool.query(`
      SELECT
        s.symbol, s.name, s.sector, s.country,
        q.price, q.change_pct, q.market_cap, q.updated_at AS quote_updated,
        CASE WHEN p.symbol IS NOT NULL THEN true ELSE false END AS has_profile,
        CASE WHEN d.cnt > 0 THEN true ELSE false END AS has_dividends,
        da.current_yield, da.composite_score
      FROM stocks s
      LEFT JOIN stock_quotes q ON q.symbol = s.symbol
      LEFT JOIN stock_profiles p ON p.symbol = s.symbol
      LEFT JOIN (SELECT symbol, COUNT(*) as cnt FROM dividends GROUP BY symbol) d ON d.symbol = s.symbol
      LEFT JOIN dividend_analysis da ON da.symbol = s.symbol
      ORDER BY q.market_cap DESC NULLS LAST
    `);

    const { rows: crawlerRows } = await pool.query('SELECT * FROM crawler_state ORDER BY task_name').catch(() => ({ rows: [] }));

    const { FMP_FREE_SYMBOLS } = require('./fmpSymbols');
    const { getCrawlerConfig } = require('./crawler');

    res.json({
      compteurs: {
        totalStocks:    parseInt(stocksRes.rows[0].count),
        totalQuotes:    parseInt(quotesRes.rows[0].count),
        totalProfiles:  parseInt(profilesRes.rows[0].count),
        totalDividends: parseInt(divsRes.rows[0].count),
        totalAnalyzed:  parseInt(analysisRes.rows[0].count),
        quotesFrais:    parseInt(quotesOkRes.rows[0].count),
        symbolsTotal:   FMP_FREE_SYMBOLS.length,
      },
      remplissage: {
        quotes:   `${parseInt(quotesRes.rows[0].count)}/${FMP_FREE_SYMBOLS.length}`,
        profiles: `${parseInt(profilesRes.rows[0].count)}/${FMP_FREE_SYMBOLS.length}`,
        dividends: `${parseInt(divsRes.rows[0].count)}/${FMP_FREE_SYMBOLS.length}`,
      },
      liste,
      crawlerState: crawlerRows,
      crawlerConfig: getCrawlerConfig(),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ erreur: e.message });
  }
});

// Santé / Health
app.get('/api/health', async (req, res) => {
  const { getQuotaInfo } = require('./services/fmpService');
  let crawlerStats = null;
  let dbStats = null;
  try { crawlerStats = require('./crawler').getCrawlerConfig(); } catch {}
  try { dbStats = await require('./services/dbService').getStatsDB(); } catch {}
  res.json({
    status: 'ok',
    crawler: crawlerStats,
    db: dbStats,
    quota: getQuotaInfo(),
  });
});

// Quota FMP
app.get('/api/quota', (req, res) => {
  res.json(require('./services/fmpService').getQuotaInfo());
});

// Démarrage
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Serveur sur http://localhost:${PORT}`);
  console.log(`📦 Plan FMP GRATUIT — 250 appels/jour, 87 symboles US`);

  const { initDatabase } = require('./initDb');
  const dbReady = await initDatabase();

  if (dbReady) {
    const crawlerRef = require('./services/crawlerRef');
    const crawlerModule = require('./crawler');
    crawlerRef.setCrawlerRef(crawlerModule);

    crawlerModule.startCrawler({
      crawlerBudget:     200,      // 200 appels/jour pour le crawler
      pauseMs:           4000,     // 4s entre appels (prudent)
      profileRefreshDays: 30,
      dividendRefreshDays: 30,
      quoteRefreshHours:  6,       // EOD = refresh toutes les 6h
      cycleIntervalMs:   3600000,  // Cycle horaire
    });
  }
});
