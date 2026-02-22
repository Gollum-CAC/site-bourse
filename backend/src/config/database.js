// Configuration de la connexion à PostgreSQL
const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Vérification de la connexion au démarrage
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Connecté à PostgreSQL'))
  .catch(err => console.error('❌ Erreur connexion PostgreSQL:', err.message));

module.exports = pool;
