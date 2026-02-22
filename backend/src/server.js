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

// Route de test / santé
app.get('/api/health', async (req, res) => {
  const cacheStats = require('./services/cacheService').stats();
  let crawlerStats = null;
  try {
    const { getCrawlerConfig } = require('./crawler');
    crawlerStats = getCrawlerConfig();
  } catch (e) {}
  res.json({ status: 'ok', message: 'Site Bourse API fonctionne !', cache: cacheStats, crawler: crawlerStats });
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
      dailyBudget: 1000,          // Limite plan FMP
      reservedForUser: 700,       // 700 pour navigation + futures features
      dividendBudget: 300,        // 300 dividendes/jour max
      pauseBetweenRequests: 3000, // 3s entre chaque appel
      batchSize: 10,              // 10 actions par cycle
      cycleInterval: 600000,      // Cycle toutes les 10 min
      dividendRefreshDays: 30,    // Refresh mensuel
    });
  }
});
