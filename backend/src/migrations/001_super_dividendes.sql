-- Migration : Création des tables pour le système de collecte Super Dividendes
-- À exécuter avec : psql -U postgres -d site_bourse -f migrations/001_super_dividendes.sql

-- Table principale : toutes les actions Euronext connues
CREATE TABLE IF NOT EXISTS stocks (
  symbol VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255),
  exchange VARCHAR(50),          -- EURONEXT, XETRA, LSE...
  country VARCHAR(5),            -- FR, NL, BE, DE, GB...
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

-- Table dividendes : historique complet par action
CREATE TABLE IF NOT EXISTS dividends (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) REFERENCES stocks(symbol) ON DELETE CASCADE,
  ex_date DATE,                  -- Date ex-dividende
  payment_date DATE,
  record_date DATE,
  declaration_date DATE,
  amount DECIMAL(10,6),          -- Montant du dividende
  currency VARCHAR(5) DEFAULT 'EUR',
  frequency VARCHAR(20),         -- annual, semi-annual, quarterly
  UNIQUE(symbol, ex_date, amount)
);

-- Table analyse dividendes : résultats calculés (cache)
CREATE TABLE IF NOT EXISTS dividend_analysis (
  symbol VARCHAR(20) PRIMARY KEY REFERENCES stocks(symbol) ON DELETE CASCADE,
  current_yield DECIMAL(6,2),          -- Rendement actuel %
  avg_yield_5y DECIMAL(6,2),           -- Rendement moyen 5 ans %
  latest_annual_div DECIMAL(10,4),     -- Dernier dividende annuel
  years_of_dividends INTEGER,          -- Nb d'années avec dividende (sur 5)
  dividend_growth DECIMAL(8,2),        -- Croissance % sur la période
  trend VARCHAR(20),                   -- croissant, stable, décroissant
  regularity INTEGER,                  -- Score 0-100
  composite_score INTEGER,             -- Score global 0-100
  dividend_history JSONB,              -- Historique annuel [{year, amount, yield}]
  calculated_at TIMESTAMP DEFAULT NOW()
);

-- Table de suivi du crawler
CREATE TABLE IF NOT EXISTS crawler_state (
  id SERIAL PRIMARY KEY,
  task_name VARCHAR(50) UNIQUE,        -- ex: 'euronext_quotes', 'euronext_dividends'
  last_symbol_processed VARCHAR(20),
  last_run_at TIMESTAMP,
  symbols_processed INTEGER DEFAULT 0,
  symbols_total INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'idle',   -- idle, running, error
  error_message TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_stocks_exchange ON stocks(exchange);
CREATE INDEX IF NOT EXISTS idx_stocks_pea ON stocks(is_pea_eligible);
CREATE INDEX IF NOT EXISTS idx_stocks_sector ON stocks(sector);
CREATE INDEX IF NOT EXISTS idx_dividends_symbol ON dividends(symbol);
CREATE INDEX IF NOT EXISTS idx_dividends_date ON dividends(ex_date DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_score ON dividend_analysis(composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_yield ON dividend_analysis(current_yield DESC);

-- Initialiser les tâches du crawler
INSERT INTO crawler_state (task_name) VALUES 
  ('collect_symbols'),
  ('update_quotes'),
  ('update_dividends'),
  ('calculate_scores')
ON CONFLICT (task_name) DO NOTHING;
