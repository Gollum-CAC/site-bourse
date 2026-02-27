// Liste fixe des 87 symboles accessibles sur le plan GRATUIT FMP
// Source : https://site.financialmodelingprep.com/developer/docs/pricing
// Ces symboles sont les SEULS pour lesquels quote/profile/dividends fonctionnent en free tier

const FMP_FREE_SYMBOLS = [
  // Mega caps US — GAFAM + tech dominants
  'AAPL',  // Apple
  'MSFT',  // Microsoft
  'GOOGL', // Alphabet
  'AMZN',  // Amazon
  'NVDA',  // NVIDIA
  'META',  // Meta
  'TSLA',  // Tesla
  'AVGO',  // Broadcom
  'ORCL',  // Oracle
  'ADBE',  // Adobe
  'CRM',   // Salesforce
  'AMD',   // AMD
  'INTC',  // Intel
  'QCOM',  // Qualcomm
  'TXN',   // Texas Instruments
  'AMAT',  // Applied Materials
  'MU',    // Micron
  'LRCX',  // Lam Research
  'KLAC',  // KLA Corp
  'ASML',  // ASML (coté aussi Nasdaq)

  // Finance
  'BRK-B', // Berkshire Hathaway
  'JPM',   // JPMorgan
  'V',     // Visa
  'MA',    // Mastercard
  'BAC',   // Bank of America
  'WFC',   // Wells Fargo
  'GS',    // Goldman Sachs
  'MS',    // Morgan Stanley
  'C',     // Citigroup
  'AXP',   // American Express
  'BLK',   // BlackRock
  'SCHW',  // Charles Schwab
  'COF',   // Capital One
  'USB',   // US Bancorp
  'PGR',   // Progressive

  // Santé / Pharma
  'LLY',   // Eli Lilly
  'UNH',   // UnitedHealth
  'JNJ',   // Johnson & Johnson
  'ABBV',  // AbbVie
  'MRK',   // Merck
  'PFE',   // Pfizer
  'TMO',   // Thermo Fisher
  'ABT',   // Abbott
  'DHR',   // Danaher
  'BMY',   // Bristol Myers
  'AMGN',  // Amgen
  'GILD',  // Gilead
  'ISRG',  // Intuitive Surgical
  'MDT',   // Medtronic
  'SYK',   // Stryker

  // Consommation / Retail
  'WMT',   // Walmart
  'COST',  // Costco
  'HD',    // Home Depot
  'MCD',   // McDonald's
  'NKE',   // Nike
  'SBUX',  // Starbucks
  'TGT',   // Target
  'LOW',   // Lowe's
  'TJX',   // TJX Companies
  'PG',    // Procter & Gamble
  'KO',    // Coca-Cola
  'PEP',   // PepsiCo
  'PM',    // Philip Morris
  'MO',    // Altria
  'CL',    // Colgate

  // Énergie
  'XOM',   // ExxonMobil
  'CVX',   // Chevron
  'COP',   // ConocoPhillips
  'EOG',   // EOG Resources
  'SLB',   // Schlumberger
  'PSX',   // Phillips 66

  // Industriels / Transport
  'CAT',   // Caterpillar
  'RTX',   // RTX Corp
  'HON',   // Honeywell
  'UPS',   // UPS
  'FDX',   // FedEx
  'DE',    // Deere
  'GE',    // GE Aerospace
  'BA',    // Boeing
  'LMT',   // Lockheed Martin
  'NOC',   // Northrop Grumman

  // Telecom / Médias
  'NFLX',  // Netflix
  'DIS',   // Disney
  'CMCSA', // Comcast
  'T',     // AT&T
  'VZ',    // Verizon

  // Immobilier / Utilities
  'NEE',   // NextEra Energy
  'DUK',   // Duke Energy
  'SO',    // Southern Company
  'AMT',   // American Tower
  'PLD',   // Prologis
];

// Métadonnées fixes pour initialiser la DB rapidement sans appels API
// Ces données évitent des appels profile inutiles au démarrage
const FMP_SYMBOLS_META = {
  'AAPL':  { name: 'Apple Inc.',             sector: 'Technology',         country: 'US', currency: 'USD' },
  'MSFT':  { name: 'Microsoft Corporation',  sector: 'Technology',         country: 'US', currency: 'USD' },
  'GOOGL': { name: 'Alphabet Inc.',          sector: 'Communication Services', country: 'US', currency: 'USD' },
  'AMZN':  { name: 'Amazon.com Inc.',        sector: 'Consumer Cyclical',  country: 'US', currency: 'USD' },
  'NVDA':  { name: 'NVIDIA Corporation',     sector: 'Technology',         country: 'US', currency: 'USD' },
  'META':  { name: 'Meta Platforms Inc.',    sector: 'Communication Services', country: 'US', currency: 'USD' },
  'TSLA':  { name: 'Tesla Inc.',             sector: 'Consumer Cyclical',  country: 'US', currency: 'USD' },
  'AVGO':  { name: 'Broadcom Inc.',          sector: 'Technology',         country: 'US', currency: 'USD' },
  'ORCL':  { name: 'Oracle Corporation',     sector: 'Technology',         country: 'US', currency: 'USD' },
  'ADBE':  { name: 'Adobe Inc.',             sector: 'Technology',         country: 'US', currency: 'USD' },
  'CRM':   { name: 'Salesforce Inc.',        sector: 'Technology',         country: 'US', currency: 'USD' },
  'AMD':   { name: 'Advanced Micro Devices', sector: 'Technology',         country: 'US', currency: 'USD' },
  'INTC':  { name: 'Intel Corporation',      sector: 'Technology',         country: 'US', currency: 'USD' },
  'QCOM':  { name: 'Qualcomm Inc.',          sector: 'Technology',         country: 'US', currency: 'USD' },
  'TXN':   { name: 'Texas Instruments',      sector: 'Technology',         country: 'US', currency: 'USD' },
  'AMAT':  { name: 'Applied Materials',      sector: 'Technology',         country: 'US', currency: 'USD' },
  'MU':    { name: 'Micron Technology',      sector: 'Technology',         country: 'US', currency: 'USD' },
  'LRCX':  { name: 'Lam Research',           sector: 'Technology',         country: 'US', currency: 'USD' },
  'KLAC':  { name: 'KLA Corporation',        sector: 'Technology',         country: 'US', currency: 'USD' },
  'ASML':  { name: 'ASML Holding',           sector: 'Technology',         country: 'NL', currency: 'USD' },
  'BRK-B': { name: 'Berkshire Hathaway',     sector: 'Financial Services', country: 'US', currency: 'USD' },
  'JPM':   { name: 'JPMorgan Chase',         sector: 'Financial Services', country: 'US', currency: 'USD' },
  'V':     { name: 'Visa Inc.',              sector: 'Financial Services', country: 'US', currency: 'USD' },
  'MA':    { name: 'Mastercard Inc.',        sector: 'Financial Services', country: 'US', currency: 'USD' },
  'BAC':   { name: 'Bank of America',        sector: 'Financial Services', country: 'US', currency: 'USD' },
  'WFC':   { name: 'Wells Fargo',            sector: 'Financial Services', country: 'US', currency: 'USD' },
  'GS':    { name: 'Goldman Sachs',          sector: 'Financial Services', country: 'US', currency: 'USD' },
  'MS':    { name: 'Morgan Stanley',         sector: 'Financial Services', country: 'US', currency: 'USD' },
  'C':     { name: 'Citigroup Inc.',         sector: 'Financial Services', country: 'US', currency: 'USD' },
  'AXP':   { name: 'American Express',       sector: 'Financial Services', country: 'US', currency: 'USD' },
  'BLK':   { name: 'BlackRock Inc.',         sector: 'Financial Services', country: 'US', currency: 'USD' },
  'SCHW':  { name: 'Charles Schwab',         sector: 'Financial Services', country: 'US', currency: 'USD' },
  'COF':   { name: 'Capital One Financial',  sector: 'Financial Services', country: 'US', currency: 'USD' },
  'USB':   { name: 'US Bancorp',             sector: 'Financial Services', country: 'US', currency: 'USD' },
  'PGR':   { name: 'Progressive Corporation',sector: 'Financial Services', country: 'US', currency: 'USD' },
  'LLY':   { name: 'Eli Lilly and Company',  sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'UNH':   { name: 'UnitedHealth Group',     sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'JNJ':   { name: 'Johnson & Johnson',      sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'ABBV':  { name: 'AbbVie Inc.',            sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'MRK':   { name: 'Merck & Co.',            sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'PFE':   { name: 'Pfizer Inc.',            sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'TMO':   { name: 'Thermo Fisher Scientific',sector: 'Healthcare',        country: 'US', currency: 'USD' },
  'ABT':   { name: 'Abbott Laboratories',    sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'DHR':   { name: 'Danaher Corporation',    sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'BMY':   { name: 'Bristol-Myers Squibb',   sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'AMGN':  { name: 'Amgen Inc.',             sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'GILD':  { name: 'Gilead Sciences',        sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'ISRG':  { name: 'Intuitive Surgical',     sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'MDT':   { name: 'Medtronic plc',          sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'SYK':   { name: 'Stryker Corporation',    sector: 'Healthcare',         country: 'US', currency: 'USD' },
  'WMT':   { name: 'Walmart Inc.',           sector: 'Consumer Defensive', country: 'US', currency: 'USD' },
  'COST':  { name: 'Costco Wholesale',       sector: 'Consumer Defensive', country: 'US', currency: 'USD' },
  'HD':    { name: 'The Home Depot',         sector: 'Consumer Cyclical',  country: 'US', currency: 'USD' },
  'MCD':   { name: "McDonald's Corporation", sector: 'Consumer Cyclical',  country: 'US', currency: 'USD' },
  'NKE':   { name: 'Nike Inc.',              sector: 'Consumer Cyclical',  country: 'US', currency: 'USD' },
  'SBUX':  { name: 'Starbucks Corporation',  sector: 'Consumer Cyclical',  country: 'US', currency: 'USD' },
  'TGT':   { name: 'Target Corporation',     sector: 'Consumer Defensive', country: 'US', currency: 'USD' },
  'LOW':   { name: "Lowe's Companies",       sector: 'Consumer Cyclical',  country: 'US', currency: 'USD' },
  'TJX':   { name: 'TJX Companies',          sector: 'Consumer Cyclical',  country: 'US', currency: 'USD' },
  'PG':    { name: 'Procter & Gamble',       sector: 'Consumer Defensive', country: 'US', currency: 'USD' },
  'KO':    { name: 'The Coca-Cola Company',  sector: 'Consumer Defensive', country: 'US', currency: 'USD' },
  'PEP':   { name: 'PepsiCo Inc.',           sector: 'Consumer Defensive', country: 'US', currency: 'USD' },
  'PM':    { name: 'Philip Morris Intl.',    sector: 'Consumer Defensive', country: 'US', currency: 'USD' },
  'MO':    { name: 'Altria Group',           sector: 'Consumer Defensive', country: 'US', currency: 'USD' },
  'CL':    { name: 'Colgate-Palmolive',      sector: 'Consumer Defensive', country: 'US', currency: 'USD' },
  'XOM':   { name: 'Exxon Mobil Corporation',sector: 'Energy',            country: 'US', currency: 'USD' },
  'CVX':   { name: 'Chevron Corporation',    sector: 'Energy',             country: 'US', currency: 'USD' },
  'COP':   { name: 'ConocoPhillips',         sector: 'Energy',             country: 'US', currency: 'USD' },
  'EOG':   { name: 'EOG Resources',          sector: 'Energy',             country: 'US', currency: 'USD' },
  'SLB':   { name: 'SLB (Schlumberger)',     sector: 'Energy',             country: 'US', currency: 'USD' },
  'PSX':   { name: 'Phillips 66',            sector: 'Energy',             country: 'US', currency: 'USD' },
  'CAT':   { name: 'Caterpillar Inc.',       sector: 'Industrials',        country: 'US', currency: 'USD' },
  'RTX':   { name: 'RTX Corporation',        sector: 'Industrials',        country: 'US', currency: 'USD' },
  'HON':   { name: 'Honeywell International',sector: 'Industrials',        country: 'US', currency: 'USD' },
  'UPS':   { name: 'United Parcel Service',  sector: 'Industrials',        country: 'US', currency: 'USD' },
  'FDX':   { name: 'FedEx Corporation',      sector: 'Industrials',        country: 'US', currency: 'USD' },
  'DE':    { name: 'Deere & Company',        sector: 'Industrials',        country: 'US', currency: 'USD' },
  'GE':    { name: 'GE Aerospace',           sector: 'Industrials',        country: 'US', currency: 'USD' },
  'BA':    { name: 'Boeing Company',         sector: 'Industrials',        country: 'US', currency: 'USD' },
  'LMT':   { name: 'Lockheed Martin',        sector: 'Industrials',        country: 'US', currency: 'USD' },
  'NOC':   { name: 'Northrop Grumman',       sector: 'Industrials',        country: 'US', currency: 'USD' },
  'NFLX':  { name: 'Netflix Inc.',           sector: 'Communication Services', country: 'US', currency: 'USD' },
  'DIS':   { name: 'The Walt Disney Company',sector: 'Communication Services', country: 'US', currency: 'USD' },
  'CMCSA': { name: 'Comcast Corporation',    sector: 'Communication Services', country: 'US', currency: 'USD' },
  'T':     { name: 'AT&T Inc.',              sector: 'Communication Services', country: 'US', currency: 'USD' },
  'VZ':    { name: 'Verizon Communications', sector: 'Communication Services', country: 'US', currency: 'USD' },
  'NEE':   { name: 'NextEra Energy',         sector: 'Utilities',          country: 'US', currency: 'USD' },
  'DUK':   { name: 'Duke Energy',            sector: 'Utilities',          country: 'US', currency: 'USD' },
  'SO':    { name: 'Southern Company',       sector: 'Utilities',          country: 'US', currency: 'USD' },
  'AMT':   { name: 'American Tower',         sector: 'Real Estate',        country: 'US', currency: 'USD' },
  'PLD':   { name: 'Prologis Inc.',          sector: 'Real Estate',        country: 'US', currency: 'USD' },
};

module.exports = { FMP_FREE_SYMBOLS, FMP_SYMBOLS_META };
