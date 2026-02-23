-- Migration 002 : Tables quotes, profils et ratios
-- Objectif : stocker en DB tout ce qui vient de FMP pour économiser les appels API

-- ============================================
-- TABLE stock_quotes : cours en temps réel
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_quotes_updated ON stock_quotes(updated_at DESC);

-- ============================================
-- TABLE stock_profiles : données entreprise
-- ============================================
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
  image            VARCHAR(500),   -- URL du logo
  address          VARCHAR(300),
  city             VARCHAR(100),
  state            VARCHAR(100),
  is_etf           BOOLEAN DEFAULT FALSE,
  is_actively_trading BOOLEAN DEFAULT TRUE,
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_sector ON stock_profiles(sector);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON stock_profiles(country);

-- ============================================
-- TABLE stock_ratios : ratios financiers TTM
-- ============================================
CREATE TABLE IF NOT EXISTS stock_ratios (
  symbol                       VARCHAR(20) PRIMARY KEY REFERENCES stocks(symbol) ON DELETE CASCADE,
  -- Valorisation
  pe_ratio                     DECIMAL(10,4),
  pb_ratio                     DECIMAL(10,4),
  ps_ratio                     DECIMAL(10,4),
  peg_ratio                    DECIMAL(10,4),
  ev_ebitda                    DECIMAL(10,4),
  -- Dividendes
  dividend_yield               DECIMAL(8,4),
  dividend_yield_pct           DECIMAL(8,4),
  payout_ratio                 DECIMAL(8,4),
  -- Rentabilité
  roe                          DECIMAL(10,4),
  roa                          DECIMAL(10,4),
  roic                         DECIMAL(10,4),
  gross_margin                 DECIMAL(10,4),
  operating_margin             DECIMAL(10,4),
  net_margin                   DECIMAL(10,4),
  -- Santé financière
  current_ratio                DECIMAL(10,4),
  quick_ratio                  DECIMAL(10,4),
  debt_equity                  DECIMAL(10,4),
  interest_coverage            DECIMAL(10,4),
  cash_per_share               DECIMAL(10,4),
  -- Croissance
  revenue_growth               DECIMAL(10,4),
  earnings_growth              DECIMAL(10,4),
  updated_at                   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ratios_pe ON stock_ratios(pe_ratio);
CREATE INDEX IF NOT EXISTS idx_ratios_yield ON stock_ratios(dividend_yield_pct DESC);
