// Liste des symboles couverts — US (S&P500 sélection) + Europe (CAC40, DAX, AEX, FTSE)
// Source : yahoo-finance2 — pas de limite de symboles, pas de clé API
// Format Yahoo : US = 'AAPL', Europe = 'MC.PA' (Euronext), 'ADS.DE' (Xetra), 'ASML.AS' (AEX)

const YAHOO_SYMBOLS = [
  // =========================================================
  // USA — S&P500 sélection (~80 mega/large caps)
  // =========================================================

  // Tech
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA',
  'AVGO', 'ORCL', 'ADBE', 'CRM', 'AMD', 'INTC', 'QCOM',
  'TXN', 'AMAT', 'MU', 'LRCX', 'KLAC', 'NOW', 'SNOW', 'PLTR',

  // Finance
  'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'C',
  'AXP', 'BLK', 'SCHW', 'COF', 'BRK-B', 'PGR', 'MET',

  // Santé
  'LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'PFE', 'TMO',
  'ABT', 'DHR', 'BMY', 'AMGN', 'GILD', 'ISRG', 'MDT', 'SYK',

  // Consommation
  'WMT', 'COST', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT', 'LOW',
  'PG', 'KO', 'PEP', 'PM', 'MO', 'CL', 'KHC',

  // Énergie
  'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'PSX', 'VLO',

  // Industriels
  'CAT', 'RTX', 'HON', 'UPS', 'FDX', 'DE', 'GE', 'BA', 'LMT', 'NOC',

  // Telecom / Médias
  'NFLX', 'DIS', 'CMCSA', 'T', 'VZ',

  // Utilities / Immo
  'NEE', 'DUK', 'SO', 'AMT', 'PLD', 'O',

  // =========================================================
  // FRANCE — CAC40
  // =========================================================
  'MC.PA',    // LVMH
  'TTE.PA',   // TotalEnergies
  'SAN.PA',   // Sanofi
  'AIR.PA',   // Airbus
  'OR.PA',    // L'Oréal
  'BNP.PA',   // BNP Paribas
  'KER.PA',   // Kering
  'DG.PA',    // Vinci
  'SU.PA',    // Schneider Electric
  'AI.PA',    // Air Liquide
  'RI.PA',    // Pernod Ricard
  'SAF.PA',   // Safran
  'ACA.PA',   // Crédit Agricole
  'GLE.PA',   // Société Générale
  'CAP.PA',   // Capgemini
  'VIE.PA',   // Veolia
  'EL.PA',    // EssilorLuxottica
  'STM.PA',   // STMicroelectronics
  'HO.PA',    // Thales
  'DSY.PA',   // Dassault Systèmes
  'ERF.PA',   // Eurofins Scientific
  'LR.PA',    // Legrand
  'ATO.PA',   // Atos (surveiller)
  'TEP.PA',   // Teleperformance
  'RMS.PA',   // Hermès
  'CS.PA',    // AXA
  'BVI.PA',   // Bureau Veritas
  'ML.PA',    // Michelin
  'PUB.PA',   // Publicis

  // =========================================================
  // ALLEMAGNE — DAX sélection
  // =========================================================
  'SAP.DE',   // SAP
  'SIE.DE',   // Siemens
  'ASML.AS',  // ASML (coté AEX Amsterdam)
  'ALV.DE',   // Allianz
  'BMW.DE',   // BMW
  'MBG.DE',   // Mercedes-Benz
  'DTE.DE',   // Deutsche Telekom
  'VOW3.DE',  // Volkswagen
  'BAS.DE',   // BASF
  'BAYN.DE',  // Bayer
  'MRK.DE',   // Merck KGaA
  'ADS.DE',   // Adidas
  'DBK.DE',   // Deutsche Bank
  'MUV2.DE',  // Munich Re
  'RWE.DE',   // RWE
  'HEN3.DE',  // Henkel
  'LIN.DE',   // Linde

  // =========================================================
  // PAYS-BAS — AEX sélection
  // =========================================================
  'INGA.AS',  // ING Group
  'PHIA.AS',  // Philips
  'UNA.AS',   // Unilever
  'HEIA.AS',  // Heineken
  'NN.AS',    // NN Group
  'ABN.AS',   // ABN AMRO
  'WKL.AS',   // Wolters Kluwer

  // =========================================================
  // ROYAUME-UNI — FTSE100 sélection
  // =========================================================
  'SHEL.L',   // Shell
  'AZN.L',    // AstraZeneca
  'HSBA.L',   // HSBC
  'BP.L',     // BP
  'GSK.L',    // GSK
  'ULVR.L',   // Unilever UK
  'RIO.L',    // Rio Tinto
  'BATS.L',   // British American Tobacco
  'VOD.L',    // Vodafone
  'LLOY.L',   // Lloyds Banking

  // =========================================================
  // SUISSE
  // =========================================================
  'NESN.SW',  // Nestlé
  'NOVN.SW',  // Novartis
  'ROG.SW',   // Roche
  'ABBN.SW',  // ABB
  'ZURN.SW',  // Zurich Insurance
];

// Métadonnées statiques minimales (complétées par Yahoo au premier crawl)
const SYMBOLS_META = {
  // US Tech
  'AAPL':  { name: 'Apple Inc.',              sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'MSFT':  { name: 'Microsoft Corporation',   sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'NVDA':  { name: 'NVIDIA Corporation',      sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'GOOGL': { name: 'Alphabet Inc.',           sector: 'Communication Services', country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'META':  { name: 'Meta Platforms Inc.',     sector: 'Communication Services', country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'AMZN':  { name: 'Amazon.com Inc.',         sector: 'Consumer Cyclical',      country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'TSLA':  { name: 'Tesla Inc.',              sector: 'Consumer Cyclical',      country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'AVGO':  { name: 'Broadcom Inc.',           sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'ORCL':  { name: 'Oracle Corporation',      sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NYSE'   },
  'ADBE':  { name: 'Adobe Inc.',              sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'CRM':   { name: 'Salesforce Inc.',         sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NYSE'   },
  'AMD':   { name: 'Advanced Micro Devices',  sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'INTC':  { name: 'Intel Corporation',       sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  'QCOM':  { name: 'Qualcomm Inc.',           sector: 'Technology',             country: 'US', currency: 'USD', exchange: 'NASDAQ' },
  // Finance US
  'JPM':   { name: 'JPMorgan Chase',          sector: 'Financial Services',     country: 'US', currency: 'USD', exchange: 'NYSE'   },
  'V':     { name: 'Visa Inc.',               sector: 'Financial Services',     country: 'US', currency: 'USD', exchange: 'NYSE'   },
  'MA':    { name: 'Mastercard Inc.',         sector: 'Financial Services',     country: 'US', currency: 'USD', exchange: 'NYSE'   },
  'BAC':   { name: 'Bank of America',         sector: 'Financial Services',     country: 'US', currency: 'USD', exchange: 'NYSE'   },
  'WFC':   { name: 'Wells Fargo',             sector: 'Financial Services',     country: 'US', currency: 'USD', exchange: 'NYSE'   },
  'GS':    { name: 'Goldman Sachs',           sector: 'Financial Services',     country: 'US', currency: 'USD', exchange: 'NYSE'   },
  'MS':    { name: 'Morgan Stanley',          sector: 'Financial Services',     country: 'US', currency: 'USD', exchange: 'NYSE'   },
  'C':     { name: 'Citigroup Inc.',          sector: 'Financial Services',     country: 'US', currency: 'USD', exchange: 'NYSE'   },
  // CAC40
  'MC.PA':  { name: 'LVMH',                  sector: 'Consumer Cyclical',      country: 'FR', currency: 'EUR', exchange: 'EPA'    },
  'TTE.PA': { name: 'TotalEnergies',          sector: 'Energy',                 country: 'FR', currency: 'EUR', exchange: 'EPA'    },
  'SAN.PA': { name: 'Sanofi',                 sector: 'Healthcare',             country: 'FR', currency: 'EUR', exchange: 'EPA'    },
  'AIR.PA': { name: 'Airbus',                 sector: 'Industrials',            country: 'FR', currency: 'EUR', exchange: 'EPA'    },
  'OR.PA':  { name: "L'Oréal",               sector: 'Consumer Defensive',     country: 'FR', currency: 'EUR', exchange: 'EPA'    },
  'BNP.PA': { name: 'BNP Paribas',           sector: 'Financial Services',     country: 'FR', currency: 'EUR', exchange: 'EPA'    },
  // DAX
  'SAP.DE':  { name: 'SAP SE',               sector: 'Technology',             country: 'DE', currency: 'EUR', exchange: 'XETRA'  },
  'SIE.DE':  { name: 'Siemens AG',           sector: 'Industrials',            country: 'DE', currency: 'EUR', exchange: 'XETRA'  },
  'ALV.DE':  { name: 'Allianz SE',           sector: 'Financial Services',     country: 'DE', currency: 'EUR', exchange: 'XETRA'  },
  'BMW.DE':  { name: 'BMW AG',               sector: 'Consumer Cyclical',      country: 'DE', currency: 'EUR', exchange: 'XETRA'  },
  // AEX
  'ASML.AS': { name: 'ASML Holding',         sector: 'Technology',             country: 'NL', currency: 'EUR', exchange: 'AEX'    },
  'INGA.AS': { name: 'ING Group',            sector: 'Financial Services',     country: 'NL', currency: 'EUR', exchange: 'AEX'    },
  // FTSE
  'SHEL.L':  { name: 'Shell plc',            sector: 'Energy',                 country: 'GB', currency: 'GBp', exchange: 'LSE'    },
  'AZN.L':   { name: 'AstraZeneca',          sector: 'Healthcare',             country: 'GB', currency: 'GBp', exchange: 'LSE'    },
  // Swiss
  'NESN.SW': { name: 'Nestlé SA',            sector: 'Consumer Defensive',     country: 'CH', currency: 'CHF', exchange: 'SIX'    },
  'NOVN.SW': { name: 'Novartis AG',          sector: 'Healthcare',             country: 'CH', currency: 'CHF', exchange: 'SIX'    },
  'ROG.SW':  { name: 'Roche Holding',        sector: 'Healthcare',             country: 'CH', currency: 'CHF', exchange: 'SIX'    },
};

// Groupes par région pour l'UI
const SYMBOL_GROUPS = {
  'US Tech':      ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AVGO','ORCL','ADBE','CRM','AMD','INTC','QCOM','TXN','AMAT','MU','NOW','SNOW','PLTR'],
  'US Finance':   ['JPM','V','MA','BAC','WFC','GS','MS','C','AXP','BLK','SCHW','BRK-B'],
  'US Santé':     ['LLY','UNH','JNJ','ABBV','MRK','PFE','TMO','ABT','AMGN','GILD','ISRG'],
  'US Conso':     ['WMT','COST','HD','MCD','NKE','SBUX','PG','KO','PEP','PM'],
  'US Énergie':   ['XOM','CVX','COP','EOG','SLB'],
  'CAC40':        ['MC.PA','TTE.PA','SAN.PA','AIR.PA','OR.PA','BNP.PA','KER.PA','DG.PA','SU.PA','AI.PA','RI.PA','SAF.PA','ACA.PA','GLE.PA','CAP.PA','RMS.PA','CS.PA','ML.PA','PUB.PA'],
  'DAX':          ['SAP.DE','SIE.DE','ALV.DE','BMW.DE','MBG.DE','DTE.DE','VOW3.DE','BAS.DE','BAYN.DE','ADS.DE','DBK.DE','MUV2.DE','LIN.DE'],
  'AEX':          ['ASML.AS','INGA.AS','PHIA.AS','HEIA.AS','UNA.AS'],
  'FTSE100':      ['SHEL.L','AZN.L','HSBA.L','BP.L','GSK.L','RIO.L','BATS.L','VOD.L','LLOY.L'],
  'Swiss':        ['NESN.SW','NOVN.SW','ROG.SW','ABBN.SW','ZURN.SW'],
};

module.exports = { YAHOO_SYMBOLS, SYMBOLS_META, SYMBOL_GROUPS };
