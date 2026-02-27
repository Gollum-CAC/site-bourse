// Liste RÉELLE des symboles accessibles sur le plan GRATUIT FMP
// Testés le 27/02/2026 avec curl — seuls ces 29 symboles répondent en 200
// Les autres retournent 402 "Premium Query Parameter"

const FMP_FREE_SYMBOLS = [
  // Tech
  'AAPL',  // Apple
  'MSFT',  // Microsoft
  'NVDA',  // NVIDIA
  'GOOGL', // Alphabet
  'META',  // Meta
  'AMZN',  // Amazon
  'TSLA',  // Tesla
  'ADBE',  // Adobe
  'AMD',   // AMD
  'INTC',  // Intel

  // Finance
  'JPM',   // JPMorgan
  'V',     // Visa
  'BAC',   // Bank of America
  'WFC',   // Wells Fargo
  'GS',    // Goldman Sachs
  'C',     // Citigroup

  // Santé
  'UNH',   // UnitedHealth
  'JNJ',   // Johnson & Johnson
  'ABBV',  // AbbVie
  'PFE',   // Pfizer

  // Consommation
  'WMT',   // Walmart
  'COST',  // Costco
  'NKE',   // Nike
  'KO',    // Coca-Cola
  'PEP',   // PepsiCo

  // Énergie
  'XOM',   // ExxonMobil
  'CVX',   // Chevron

  // Médias / Telecom
  'NFLX',  // Netflix
  'DIS',   // Disney
];

// Métadonnées fixes pour initialiser la DB sans appels API
const FMP_SYMBOLS_META = {
  'AAPL':  { name: 'Apple Inc.',              sector: 'Technology',             country: 'US', currency: 'USD' },
  'MSFT':  { name: 'Microsoft Corporation',   sector: 'Technology',             country: 'US', currency: 'USD' },
  'NVDA':  { name: 'NVIDIA Corporation',      sector: 'Technology',             country: 'US', currency: 'USD' },
  'GOOGL': { name: 'Alphabet Inc.',           sector: 'Communication Services', country: 'US', currency: 'USD' },
  'META':  { name: 'Meta Platforms Inc.',     sector: 'Communication Services', country: 'US', currency: 'USD' },
  'AMZN':  { name: 'Amazon.com Inc.',         sector: 'Consumer Cyclical',      country: 'US', currency: 'USD' },
  'TSLA':  { name: 'Tesla Inc.',              sector: 'Consumer Cyclical',      country: 'US', currency: 'USD' },
  'ADBE':  { name: 'Adobe Inc.',              sector: 'Technology',             country: 'US', currency: 'USD' },
  'AMD':   { name: 'Advanced Micro Devices',  sector: 'Technology',             country: 'US', currency: 'USD' },
  'INTC':  { name: 'Intel Corporation',       sector: 'Technology',             country: 'US', currency: 'USD' },
  'JPM':   { name: 'JPMorgan Chase',          sector: 'Financial Services',     country: 'US', currency: 'USD' },
  'V':     { name: 'Visa Inc.',               sector: 'Financial Services',     country: 'US', currency: 'USD' },
  'BAC':   { name: 'Bank of America',         sector: 'Financial Services',     country: 'US', currency: 'USD' },
  'WFC':   { name: 'Wells Fargo',             sector: 'Financial Services',     country: 'US', currency: 'USD' },
  'GS':    { name: 'Goldman Sachs',           sector: 'Financial Services',     country: 'US', currency: 'USD' },
  'C':     { name: 'Citigroup Inc.',          sector: 'Financial Services',     country: 'US', currency: 'USD' },
  'UNH':   { name: 'UnitedHealth Group',      sector: 'Healthcare',             country: 'US', currency: 'USD' },
  'JNJ':   { name: 'Johnson & Johnson',       sector: 'Healthcare',             country: 'US', currency: 'USD' },
  'ABBV':  { name: 'AbbVie Inc.',             sector: 'Healthcare',             country: 'US', currency: 'USD' },
  'PFE':   { name: 'Pfizer Inc.',             sector: 'Healthcare',             country: 'US', currency: 'USD' },
  'WMT':   { name: 'Walmart Inc.',            sector: 'Consumer Defensive',     country: 'US', currency: 'USD' },
  'COST':  { name: 'Costco Wholesale',        sector: 'Consumer Defensive',     country: 'US', currency: 'USD' },
  'NKE':   { name: 'Nike Inc.',               sector: 'Consumer Cyclical',      country: 'US', currency: 'USD' },
  'KO':    { name: 'The Coca-Cola Company',   sector: 'Consumer Defensive',     country: 'US', currency: 'USD' },
  'PEP':   { name: 'PepsiCo Inc.',            sector: 'Consumer Defensive',     country: 'US', currency: 'USD' },
  'XOM':   { name: 'Exxon Mobil Corporation', sector: 'Energy',                 country: 'US', currency: 'USD' },
  'CVX':   { name: 'Chevron Corporation',     sector: 'Energy',                 country: 'US', currency: 'USD' },
  'NFLX':  { name: 'Netflix Inc.',            sector: 'Communication Services', country: 'US', currency: 'USD' },
  'DIS':   { name: 'The Walt Disney Company', sector: 'Communication Services', country: 'US', currency: 'USD' },
};

module.exports = { FMP_FREE_SYMBOLS, FMP_SYMBOLS_META };
