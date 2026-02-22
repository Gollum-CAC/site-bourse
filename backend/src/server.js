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

// Enregistrement des routes
app.use('/api/actions', actionsRoutes);
app.use('/api/cryptos', cryptosRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/dividendes', superDividendesRoutes);

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
app.listen(PORT, async () => {
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
      dailyBudget: 250,           // Limite plan gratuit FMP
      reservedForUser: 50,        // 50 appels pour la navigation
      dividendBudget: 200,        // 200 actions/jour pour dividendes
      pauseBetweenRequests: 5000, // 5s entre chaque appel
      batchSize: 5,               // 5 actions par cycle
      cycleInterval: 300000,      // Cycle toutes les 5 min
    });
  }
});
