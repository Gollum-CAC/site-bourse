// Initialisation de la base de données - Crée les tables si elles n'existent pas
const pool = require('./config/database');

async function initDatabase() {
  try {
    // Vérifier la connexion
    await pool.query('SELECT NOW()');

    // Créer les tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stocks (
        symbol VARCHAR(20) PRIMARY KEY,
        name VARCHAR(255),
        exchange VARCHAR(50),
        country VARCHAR(5),
        sector VARCHAR(100),
        industry VARCHAR(100),
        market_cap BIGINT,
        price DECIMAL(12,4),
        currency VARCHAR(5) DEFAULT 'EUR',
        is_pea_eligible BOOLEAN DEFAULT FALSE,
        last_quote_update TIMESTAMP,
        last_dividend_update TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dividends (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(20) REFERENCES stocks(symbol) ON DELETE CASCADE,
        ex_date DATE,
        payment_date DATE,
        record_date DATE,
        declaration_date DATE,
        amount DECIMAL(10,6),
        currency VARCHAR(5) DEFAULT 'EUR',
        frequency VARCHAR(20),
        UNIQUE(symbol, ex_date, amount)
      );

      CREATE TABLE IF NOT EXISTS dividend_analysis (
        symbol VARCHAR(20) PRIMARY KEY REFERENCES stocks(symbol) ON DELETE CASCADE,
        current_yield DECIMAL(6,2),
        avg_yield_5y DECIMAL(6,2),
        latest_annual_div DECIMAL(10,4),
        years_of_dividends INTEGER,
        dividend_growth DECIMAL(8,2),
        trend VARCHAR(20),
        regularity INTEGER,
        composite_score INTEGER,
        dividend_history JSONB,
        calculated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS crawler_state (
        id SERIAL PRIMARY KEY,
        task_name VARCHAR(50) UNIQUE,
        last_symbol_processed VARCHAR(20),
        last_run_at TIMESTAMP,
        symbols_processed INTEGER DEFAULT 0,
        symbols_total INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'idle',
        error_message TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_stocks_exchange ON stocks(exchange);
      CREATE INDEX IF NOT EXISTS idx_stocks_pea ON stocks(is_pea_eligible);
      CREATE INDEX IF NOT EXISTS idx_dividends_symbol ON dividends(symbol);
      CREATE INDEX IF NOT EXISTS idx_analysis_score ON dividend_analysis(composite_score DESC);
      CREATE INDEX IF NOT EXISTS idx_analysis_yield ON dividend_analysis(current_yield DESC);
    `);

    // Initialiser les tâches crawler
    await pool.query(`
      INSERT INTO crawler_state (task_name) VALUES 
        ('collect_symbols'), ('update_quotes'), ('update_dividends'), ('calculate_scores')
      ON CONFLICT (task_name) DO NOTHING;
    `);

    console.log('✅ Tables de base de données initialisées');
    return true;
  } catch (err) {
    console.error('❌ Erreur initialisation DB:', err.message);
    return false;
  }
}

module.exports = { initDatabase };
