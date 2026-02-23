// Serveur principal Express
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Import des routes
const actionsRoutes = require('./routes/actions');
const cryptosRoutes = require('./routes/cryptos');
const newsRoutes = require('./routes/news');
const superDividendesRoutes = require('./routes/superDividendes');
const screenerRoutes = require('./routes/screener');

// Enregistrement des routes
app.use('/api/actions', actionsRoutes);
app.use('/api/cryptos', cryptosRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/dividendes', superDividendesRoutes);
app.use('/api/screener', screenerRoutes);

// Route statut DB détaillée — liste des actions chargées
app.get('/api/db-status', async (req, res) => {
  try {
    const pool = require('./db');

    // Compteurs globaux
    const [stocksRes, quotesRes, quotesFraisRes, profilesRes, ratiosRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM stocks'),
      pool.query('SELECT COUNT(*) FROM stock_quotes'),
      pool.query(`SELECT COUNT(*) FROM stock_quotes WHERE updated_at > NOW() - INTERVAL '1 hour'`),
      pool.query('SELECT COUNT(*) FROM stock_profiles'),
      pool.query('SELECT COUNT(*) FROM stock_ratios'),
    ]);

    const totalStocks    = parseInt(stocksRes.rows[0].count);
    const totalQuotes    = parseInt(quotesRes.rows[0].count);
    const quotesFrais    = parseInt(quotesFraisRes.rows[0].count);
    const totalProfiles  = parseInt(profilesRes.rows[0].count);
    const totalRatios    = parseInt(ratiosRes.rows[0].count);

    // Liste des actions avec leur état d'enrichissement
    const { rows: liste } = await pool.query(`
      SELECT
        s.symbol,
        s.name,
        s.market_cap,
        s.updated_at AS stock_updated,
        q.price,
        q.change_pct,
        q.updated_at AS quote_updated,
        CASE WHEN p.symbol IS NOT NULL THEN true ELSE false END AS has_profile,
        p.sector,
        p.country,
        CASE WHEN r.symbol IS NOT NULL THEN true ELSE false END AS has_ratios,
        CASE WHEN d.symbol IS NOT NULL THEN true ELSE false END AS has_dividends
      FROM stocks s
      LEFT JOIN stock_quotes  q ON q.symbol = s.symbol
      LEFT JOIN stock_profiles p ON p.symbol = s.symbol
      LEFT JOIN stock_ratios  r ON r.symbol = s.symbol
      LEFT JOIN (
        SELECT DISTINCT symbol FROM dividends
      ) d ON d.symbol = s.symbol
      ORDER BY s.market_cap DESC NULLS LAST, s.symbol ASC
      LIMIT 500
    `);

    // État du crawler
    let crawlerState = [];
    try {
      const cs = await pool.query('SELECT * FROM crawler_state ORDER BY tache');
      crawlerState = cs.rows;
    } catch {}

    res.json({
      compteurs: { totalStocks, totalQuotes, quotesFrais, totalProfiles, totalRatios },
      liste,
      crawlerState,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[db-status]', e.message);
    res.status(500).json({ erreur: e.message });
  }
});

// Route de test / santé
app.get('/api/health', async (req, res) => {
  const cacheStats = require('./services/cacheService').stats();
  let crawlerStats = null;
  let dbStats = null;
  try {
    const { getCrawlerConfig } = require('./crawler');
    crawlerStats = getCrawlerConfig();
  } catch (e) {}
  try {
    const { getStatsDB } = require('./services/dbService');
    dbStats = await getStatsDB();
  } catch (e) {}
  res.json({ status: 'ok', message: 'Site Bourse API fonctionne !', cache: cacheStats, crawler: crawlerStats, db: dbStats });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📊 API Actions : http://localhost:${PORT}/api/actions`);
  console.log(`🪙 API Cryptos : http://localhost:${PORT}/api/cryptos`);
  console.log(`📰 API News   : http://localhost:${PORT}/api/news`);
  console.log(`💎 Super Div  : http://localhost:${PORT}/api/dividendes/super`);

  // Initialiser la base de données
  const { initDatabase } = require('./initDb');
  const dbReady = await initDatabase();

  // Démarrer le crawler si la DB est prête
  if (dbReady) {
    const { startCrawler } = require('./crawler');
    startCrawler({
      dailyBudget: 250,           // Limite réelle plan FMP gratuit
      reservedForUser: 200,       // 200 pour la navigation utilisateur
      crawlerBudget: 50,          // 50 appels/jour pour le crawler
      pauseBetweenRequests: 5000, // 5s entre chaque appel
      batchSize: 5,               // 5 actions par cycle
      cycleInterval: 1800000,     // Cycle toutes les 30 min
      dividendRefreshDays: 30,    // Refresh mensuel
    });
  }
});
