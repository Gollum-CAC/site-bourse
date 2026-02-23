// Initialisation de la base de données - Crée les tables si elles n'existent pas
const pool = require('./config/database');

async function initDatabase() {
  try {
    await pool.query('SELECT NOW()');

    // === TABLES DE BASE ===
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

    // === MIGRATION 002 : Quotes, Profils, Ratios ===
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_quotes (
        symbol           VARCHAR(20) PRIMARY KEY REFERENCES stocks(symbol) ON DELETE CASCADE,
        price            DECIMAL(14,4),
        open             DECIMAL(14,4),
        day_high         DECIMAL(14,4),
        day_low          DECIMAL(14,4),
        year_high        DECIMAL(14,4),
        year_low         DECIMAL(14,4),
        change           DECIMAL(14,4),
        change_pct       DECIMAL(8,4),
        volume           BIGINT,
        avg_volume       BIGINT,
        market_cap       BIGINT,
        price_avg_50     DECIMAL(14,4),
        price_avg_200    DECIMAL(14,4),
        eps              DECIMAL(10,4),
        pe               DECIMAL(10,4),
        shares_outstanding BIGINT,
        updated_at       TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS stock_profiles (
        symbol           VARCHAR(20) PRIMARY KEY REFERENCES stocks(symbol) ON DELETE CASCADE,
        name             VARCHAR(255),
        exchange         VARCHAR(50),
        currency         VARCHAR(10),
        country          VARCHAR(5),
        sector           VARCHAR(100),
        industry         VARCHAR(150),
        description      TEXT,
        ceo              VARCHAR(150),
        website          VARCHAR(255),
        ipo_date         DATE,
        employees        INTEGER,
        image            VARCHAR(500),
        address          VARCHAR(300),
        city             VARCHAR(100),
        state            VARCHAR(100),
        is_etf           BOOLEAN DEFAULT FALSE,
        is_actively_trading BOOLEAN DEFAULT TRUE,
        updated_at       TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS stock_ratios (
        symbol                   VARCHAR(20) PRIMARY KEY REFERENCES stocks(symbol) ON DELETE CASCADE,
        pe_ratio                 DECIMAL(10,4),
        pb_ratio                 DECIMAL(10,4),
        ps_ratio                 DECIMAL(10,4),
        peg_ratio                DECIMAL(10,4),
        ev_ebitda                DECIMAL(10,4),
        dividend_yield           DECIMAL(8,4),
        dividend_yield_pct       DECIMAL(8,4),
        payout_ratio             DECIMAL(8,4),
        roe                      DECIMAL(10,4),
        roa                      DECIMAL(10,4),
        roic                     DECIMAL(10,4),
        gross_margin             DECIMAL(10,4),
        operating_margin         DECIMAL(10,4),
        net_margin               DECIMAL(10,4),
        current_ratio            DECIMAL(10,4),
        quick_ratio              DECIMAL(10,4),
        debt_equity              DECIMAL(10,4),
        interest_coverage        DECIMAL(10,4),
        cash_per_share           DECIMAL(10,4),
        revenue_growth           DECIMAL(10,4),
        earnings_growth          DECIMAL(10,4),
        updated_at               TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_quotes_updated   ON stock_quotes(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_profiles_sector  ON stock_profiles(sector);
      CREATE INDEX IF NOT EXISTS idx_profiles_country ON stock_profiles(country);
      CREATE INDEX IF NOT EXISTS idx_ratios_pe        ON stock_ratios(pe_ratio);
      CREATE INDEX IF NOT EXISTS idx_ratios_yield     ON stock_ratios(dividend_yield_pct DESC);
    `);

    // === INITIALISER LES TÂCHES CRAWLER ===
    await pool.query(`
      INSERT INTO crawler_state (task_name) VALUES
        ('collect_symbols'),
        ('update_quotes'),
        ('update_profiles'),
        ('update_ratios'),
        ('update_dividends'),
        ('calculate_scores')
      ON CONFLICT (task_name) DO NOTHING;
    `);

    console.log('✅ Base de données initialisée (tables + migration 002)');
    return true;
  } catch (err) {
    console.error('❌ Erreur initialisation DB:', err.message);
    return false;
  }
}

module.exports = { initDatabase };
