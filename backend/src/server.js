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

// Enregistrement des routes
app.use('/api/actions', actionsRoutes);
app.use('/api/cryptos', cryptosRoutes);
app.use('/api/news', newsRoutes);

// Route de test
app.get('/api/health', (req, res) => {
  const cacheStats = require('./services/cacheService').stats();
  res.json({ status: 'ok', message: 'Site Bourse API fonctionne !', cache: cacheStats });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📊 API Actions : http://localhost:${PORT}/api/actions`);
  console.log(`🪙 API Cryptos : http://localhost:${PORT}/api/cryptos`);
  console.log(`📰 API News   : http://localhost:${PORT}/api/news`);
});
