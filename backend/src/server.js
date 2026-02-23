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

// Route pour injecter/rafraîchir les symboles manuellement
app.post('/api/seeds/injecter', async (req, res) => {
  try {
    const { injecterSymboles } = require('./seeds');
    const result = await injecterSymboles();
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ erreur: e.message });
  }
});

// Route statut DB détaillée — liste des actions chargées
app.get('/api/db-status', async (req, res) => {
  try {
    const pool = require('./config/database');

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
  const { getQuotaInfo } = require('./services/fmpService');
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
  res.json({
    status: 'ok',
    message: 'Site Bourse API fonctionne !',
    cache: cacheStats,
    crawler: crawlerStats,
    db: dbStats,
    quota: getQuotaInfo(),
  });
});

// Route quota FMP — renvoie l'état du quota journalier
app.get('/api/quota', (req, res) => {
  const { getQuotaInfo } = require('./services/fmpService');
  res.json(getQuotaInfo());
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

  // Injecter les symboles connus (CAC40, S&P500, DAX, FTSE100, etc.)
  if (dbReady) {
    const { injecterSymboles } = require('./seeds');
    await injecterSymboles();
  }

  // Démarrer le crawler si la DB est prête
  if (dbReady) {
    const crawlerRef = require('./services/crawlerRef');
    const crawlerModule = require('./crawler');
    crawlerRef.setCrawlerRef(crawlerModule); // lien pour que fmpService puisse stopper le crawler
    const { startCrawler } = crawlerModule;
    startCrawler({
      dailyBudget: 750,           // Plan FMP Standard : 750 req/min, ~10 000+/jour
      reservedForUser: 150,       // 150 réservés pour la navigation
      crawlerBudget: 600,         // 600 appels/jour pour enrichir rapidement
      pauseBetweenRequests: 1000, // 1s entre appels (plan Standard supporte 750/min)
      batchSize: 10,              // 10 actions par cycle
      cycleInterval: 300000,      // Cycle toutes les 5 min
      dividendRefreshDays: 30,
    });
  }
});
