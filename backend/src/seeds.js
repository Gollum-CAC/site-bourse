// Script d'initialisation des symboles — CAC40, S&P500, AEX, DAX, FTSE100, etc.
// Injecte les symboles en DB sans consommer d'appels FMP
// Le crawler enrichira ensuite les données au fil du temps

const pool = require('./config/database');

// ============================================================
// === LISTES DE SYMBOLES PAR INDICE ===
// ============================================================

const CAC40 = [
  ['AI.PA',   'Air Liquide',            'FR', 'EUR', 'Basic Materials'],
  ['AIR.PA',  'Airbus',                 'FR', 'EUR', 'Industrials'],
  ['ALO.PA',  'Alstom',                 'FR', 'EUR', 'Industrials'],
  ['MT.PA',   'ArcelorMittal',          'FR', 'EUR', 'Basic Materials'],
  ['CS.PA',   'AXA',                    'FR', 'EUR', 'Financial Services'],
  ['BNP.PA',  'BNP Paribas',            'FR', 'EUR', 'Financial Services'],
  ['EN.PA',   'Bouygues',               'FR', 'EUR', 'Industrials'],
  ['CAP.PA',  'Capgemini',              'FR', 'EUR', 'Technology'],
  ['CA.PA',   'Carrefour',              'FR', 'EUR', 'Consumer Defensive'],
  ['ACA.PA',  'Crédit Agricole',        'FR', 'EUR', 'Financial Services'],
  ['BN.PA',   'Danone',                 'FR', 'EUR', 'Consumer Defensive'],
  ['DSY.PA',  'Dassault Systèmes',      'FR', 'EUR', 'Technology'],
  ['EDEN.PA', 'Edenred',               'FR', 'EUR', 'Industrials'],
  ['EL.PA',   'EssilorLuxottica',       'FR', 'EUR', 'Healthcare'],
  ['ERF.PA',  'Eurofins Scientific',    'FR', 'EUR', 'Healthcare'],
  ['RMS.PA',  'Hermès International',   'FR', 'EUR', 'Consumer Cyclical'],
  ['KER.PA',  'Kering',                 'FR', 'EUR', 'Consumer Cyclical'],
  ['LR.PA',   'Legrand',                'FR', 'EUR', 'Industrials'],
  ['MC.PA',   'LVMH',                   'FR', 'EUR', 'Consumer Cyclical'],
  ['MLM.PA',  'Michelin',               'FR', 'EUR', 'Consumer Cyclical'],
  ['ORA.PA',  'Orange',                 'FR', 'EUR', 'Communication Services'],
  ['RI.PA',   'Pernod Ricard',          'FR', 'EUR', 'Consumer Defensive'],
  ['PUB.PA',  'Publicis Groupe',        'FR', 'EUR', 'Communication Services'],
  ['RNO.PA',  'Renault',                'FR', 'EUR', 'Consumer Cyclical'],
  ['SAF.PA',  'Safran',                 'FR', 'EUR', 'Industrials'],
  ['SGO.PA',  'Saint-Gobain',           'FR', 'EUR', 'Basic Materials'],
  ['SAN.PA',  'Sanofi',                 'FR', 'EUR', 'Healthcare'],
  ['SU.PA',   'Schneider Electric',     'FR', 'EUR', 'Industrials'],
  ['GLE.PA',  'Société Générale',       'FR', 'EUR', 'Financial Services'],
  ['STLAM.PA','Stellantis',             'FR', 'EUR', 'Consumer Cyclical'],
  ['STMPA.PA','STMicroelectronics',     'FR', 'EUR', 'Technology'],
  ['TEP.PA',  'Teleperformance',        'FR', 'EUR', 'Industrials'],
  ['HO.PA',   'Thales',                 'FR', 'EUR', 'Industrials'],
  ['TTE.PA',  'TotalEnergies',          'FR', 'EUR', 'Energy'],
  ['URW.PA',  'Unibail-Rodamco-Westfield','FR','EUR','Real Estate'],
  ['VIE.PA',  'Veolia Environnement',   'FR', 'EUR', 'Utilities'],
  ['DG.PA',   'Vinci',                  'FR', 'EUR', 'Industrials'],
  ['VIV.PA',  'Vivendi',                'FR', 'EUR', 'Communication Services'],
  ['WLN.PA',  'Worldline',              'FR', 'EUR', 'Technology'],
  ['OR.PA',   "L'Oréal",               'FR', 'EUR', 'Consumer Defensive'],
];

const AEX = [
  ['ASML.AS', 'ASML Holding',           'NL', 'EUR', 'Technology'],
  ['INGA.AS', 'ING Groep',              'NL', 'EUR', 'Financial Services'],
  ['PHIA.AS', 'Philips',                'NL', 'EUR', 'Healthcare'],
  ['UNA.AS',  'Unilever',               'NL', 'EUR', 'Consumer Defensive'],
  ['HEIA.AS', 'Heineken',               'NL', 'EUR', 'Consumer Defensive'],
  ['ABN.AS',  'ABN AMRO',               'NL', 'EUR', 'Financial Services'],
  ['AD.AS',   'Ahold Delhaize',         'NL', 'EUR', 'Consumer Defensive'],
  ['AGN.AS',  'Aegon',                  'NL', 'EUR', 'Financial Services'],
  ['AKZA.AS', 'Akzo Nobel',             'NL', 'EUR', 'Basic Materials'],
  ['MT.AS',   'ArcelorMittal',          'NL', 'EUR', 'Basic Materials'],
  ['ASM.AS',  'ASM International',      'NL', 'EUR', 'Technology'],
  ['BESI.AS', 'BE Semiconductor',       'NL', 'EUR', 'Technology'],
  ['DSM.AS',  'dsm-firmenich',          'NL', 'EUR', 'Basic Materials'],
  ['EXOR.AS', 'Exor',                   'NL', 'EUR', 'Financial Services'],
  ['IMCD.AS', 'IMCD',                   'NL', 'EUR', 'Basic Materials'],
  ['TKWY.AS', 'Just Eat Takeaway',      'NL', 'EUR', 'Consumer Cyclical'],
  ['KPN.AS',  'KPN',                    'NL', 'EUR', 'Communication Services'],
  ['NN.AS',   'NN Group',               'NL', 'EUR', 'Financial Services'],
  ['RAND.AS', 'Randstad',               'NL', 'EUR', 'Industrials'],
  ['RDSA.AS', 'Shell',                  'NL', 'EUR', 'Energy'],
  ['WKL.AS',  'Wolters Kluwer',         'NL', 'EUR', 'Industrials'],
];

const DAX = [
  ['ADS.DE',  'Adidas',                 'DE', 'EUR', 'Consumer Cyclical'],
  ['AIR.DE',  'Airbus',                 'DE', 'EUR', 'Industrials'],
  ['ALV.DE',  'Allianz',                'DE', 'EUR', 'Financial Services'],
  ['BAS.DE',  'BASF',                   'DE', 'EUR', 'Basic Materials'],
  ['BAYN.DE', 'Bayer',                  'DE', 'EUR', 'Healthcare'],
  ['BMW.DE',  'BMW',                    'DE', 'EUR', 'Consumer Cyclical'],
  ['BNR.DE',  'Brenntag',               'DE', 'EUR', 'Basic Materials'],
  ['CON.DE',  'Continental',            'DE', 'EUR', 'Consumer Cyclical'],
  ['1COV.DE', 'Covestro',               'DE', 'EUR', 'Basic Materials'],
  ['DTG.DE',  'Daimler Truck',          'DE', 'EUR', 'Industrials'],
  ['DB1.DE',  'Deutsche Börse',         'DE', 'EUR', 'Financial Services'],
  ['DBK.DE',  'Deutsche Bank',          'DE', 'EUR', 'Financial Services'],
  ['DPW.DE',  'Deutsche Post',          'DE', 'EUR', 'Industrials'],
  ['DTE.DE',  'Deutsche Telekom',       'DE', 'EUR', 'Communication Services'],
  ['EOAN.DE', 'E.ON',                   'DE', 'EUR', 'Utilities'],
  ['FRE.DE',  'Fresenius',              'DE', 'EUR', 'Healthcare'],
  ['HNR1.DE', 'Hannover Rück',          'DE', 'EUR', 'Financial Services'],
  ['HEI.DE',  'HeidelbergCement',       'DE', 'EUR', 'Basic Materials'],
  ['HEN3.DE', 'Henkel',                 'DE', 'EUR', 'Consumer Defensive'],
  ['IFX.DE',  'Infineon',               'DE', 'EUR', 'Technology'],
  ['MBG.DE',  'Mercedes-Benz',          'DE', 'EUR', 'Consumer Cyclical'],
  ['MRK.DE',  'Merck KGaA',             'DE', 'EUR', 'Healthcare'],
  ['MTX.DE',  'MTU Aero Engines',       'DE', 'EUR', 'Industrials'],
  ['MUV2.DE', 'Munich Re',              'DE', 'EUR', 'Financial Services'],
  ['PUMA.DE', 'PUMA',                   'DE', 'EUR', 'Consumer Cyclical'],
  ['QGEN.DE', 'QIAGEN',                 'DE', 'EUR', 'Healthcare'],
  ['RWE.DE',  'RWE',                    'DE', 'EUR', 'Utilities'],
  ['SAP.DE',  'SAP',                    'DE', 'EUR', 'Technology'],
  ['SIE.DE',  'Siemens',                'DE', 'EUR', 'Industrials'],
  ['ENR.DE',  'Siemens Energy',         'DE', 'EUR', 'Utilities'],
  ['SHL.DE',  'Siemens Healthineers',   'DE', 'EUR', 'Healthcare'],
  ['SY1.DE',  'Symrise',                'DE', 'EUR', 'Basic Materials'],
  ['VOW3.DE', 'Volkswagen',             'DE', 'EUR', 'Consumer Cyclical'],
  ['VNA.DE',  'Vonovia',                'DE', 'EUR', 'Real Estate'],
  ['ZAL.DE',  'Zalando',                'DE', 'EUR', 'Consumer Cyclical'],
  ['PUM.DE',  'Porsche',                'DE', 'EUR', 'Consumer Cyclical'],
  ['P911.DE', 'Porsche AG',             'DE', 'EUR', 'Consumer Cyclical'],
  ['DHER.DE', 'Delivery Hero',          'DE', 'EUR', 'Consumer Cyclical'],
  ['SRT3.DE', 'Sartorius',              'DE', 'EUR', 'Healthcare'],
];

const FTSE100 = [
  ['AAL.L',   'Anglo American',         'GB', 'GBP', 'Basic Materials'],
  ['ABF.L',   'Associated British Foods','GB','GBP', 'Consumer Defensive'],
  ['ADM.L',   'Admiral Group',          'GB', 'GBP', 'Financial Services'],
  ['AHT.L',   'Ashtead Group',          'GB', 'GBP', 'Industrials'],
  ['AV.L',    'Aviva',                  'GB', 'GBP', 'Financial Services'],
  ['AZN.L',   'AstraZeneca',            'GB', 'GBP', 'Healthcare'],
  ['BA.L',    'BAE Systems',            'GB', 'GBP', 'Industrials'],
  ['BARC.L',  'Barclays',               'GB', 'GBP', 'Financial Services'],
  ['BATS.L',  'British American Tobacco','GB','GBP', 'Consumer Defensive'],
  ['BHP.L',   'BHP Group',              'GB', 'GBP', 'Basic Materials'],
  ['BP.L',    'BP',                     'GB', 'GBP', 'Energy'],
  ['BT.A.L',  'BT Group',               'GB', 'GBP', 'Communication Services'],
  ['CCH.L',   'Coca-Cola HBC',          'GB', 'GBP', 'Consumer Defensive'],
  ['CPG.L',   'Compass Group',          'GB', 'GBP', 'Consumer Cyclical'],
  ['CRH.L',   'CRH',                    'GB', 'GBP', 'Basic Materials'],
  ['DGE.L',   'Diageo',                 'GB', 'GBP', 'Consumer Defensive'],
  ['EDV.L',   'Endeavour Mining',       'GB', 'GBP', 'Basic Materials'],
  ['EXPN.L',  'Experian',               'GB', 'GBP', 'Industrials'],
  ['FERG.L',  'Ferguson',               'GB', 'GBP', 'Industrials'],
  ['FLTR.L',  'Flutter Entertainment',  'GB', 'GBP', 'Consumer Cyclical'],
  ['GSK.L',   'GSK',                    'GB', 'GBP', 'Healthcare'],
  ['HIK.L',   'Hikma Pharmaceuticals',  'GB', 'GBP', 'Healthcare'],
  ['HSBA.L',  'HSBC Holdings',          'GB', 'GBP', 'Financial Services'],
  ['IAG.L',   'IAG',                    'GB', 'GBP', 'Industrials'],
  ['IHG.L',   'InterContinental Hotels','GB', 'GBP', 'Consumer Cyclical'],
  ['IMB.L',   'Imperial Brands',        'GB', 'GBP', 'Consumer Defensive'],
  ['INF.L',   'Informa',                'GB', 'GBP', 'Communication Services'],
  ['ITRK.L',  'Intertek Group',         'GB', 'GBP', 'Industrials'],
  ['JD.L',    'JD Sports Fashion',      'GB', 'GBP', 'Consumer Cyclical'],
  ['KGF.L',   'Kingfisher',             'GB', 'GBP', 'Consumer Cyclical'],
  ['LAND.L',  'Land Securities',        'GB', 'GBP', 'Real Estate'],
  ['LGEN.L',  'Legal & General',        'GB', 'GBP', 'Financial Services'],
  ['LLOY.L',  'Lloyds Banking Group',   'GB', 'GBP', 'Financial Services'],
  ['MKS.L',   'Marks & Spencer',        'GB', 'GBP', 'Consumer Cyclical'],
  ['MNG.L',   'M&G',                    'GB', 'GBP', 'Financial Services'],
  ['MNDI.L',  'Mondi',                  'GB', 'GBP', 'Basic Materials'],
  ['NWG.L',   'NatWest Group',          'GB', 'GBP', 'Financial Services'],
  ['NG.L',    'National Grid',          'GB', 'GBP', 'Utilities'],
  ['NXT.L',   'Next',                   'GB', 'GBP', 'Consumer Cyclical'],
  ['OCDO.L',  'Ocado Group',            'GB', 'GBP', 'Consumer Defensive'],
  ['PSON.L',  'Pearson',                'GB', 'GBP', 'Communication Services'],
  ['PSN.L',   'Persimmon',              'GB', 'GBP', 'Consumer Cyclical'],
  ['PHNX.L',  'Phoenix Group',          'GB', 'GBP', 'Financial Services'],
  ['PRU.L',   'Prudential',             'GB', 'GBP', 'Financial Services'],
  ['RB.L',    'Reckitt Benckiser',      'GB', 'GBP', 'Consumer Defensive'],
  ['REL.L',   'Relx',                   'GB', 'GBP', 'Industrials'],
  ['RIO.L',   'Rio Tinto',              'GB', 'GBP', 'Basic Materials'],
  ['RKT.L',   'Reckitt',                'GB', 'GBP', 'Consumer Defensive'],
  ['RR.L',    'Rolls-Royce',            'GB', 'GBP', 'Industrials'],
  ['RS1.L',   'RS Group',               'GB', 'GBP', 'Industrials'],
  ['SBRY.L',  'Sainsbury',              'GB', 'GBP', 'Consumer Defensive'],
  ['SGE.L',   'Sage Group',             'GB', 'GBP', 'Technology'],
  ['SHEL.L',  'Shell',                  'GB', 'GBP', 'Energy'],
  ['SKG.L',   'Smurfit Kappa',          'GB', 'GBP', 'Basic Materials'],
  ['SMT.L',   'Scottish Mortgage IT',   'GB', 'GBP', 'Financial Services'],
  ['SN.L',    'Smith & Nephew',         'GB', 'GBP', 'Healthcare'],
  ['SPX.L',   'Spirax-Sarco',           'GB', 'GBP', 'Industrials'],
  ['SSE.L',   'SSE',                    'GB', 'GBP', 'Utilities'],
  ['STAN.L',  'Standard Chartered',     'GB', 'GBP', 'Financial Services'],
  ['SVT.L',   'Severn Trent',           'GB', 'GBP', 'Utilities'],
  ['TSCO.L',  'Tesco',                  'GB', 'GBP', 'Consumer Defensive'],
  ['TW.L',    'Taylor Wimpey',          'GB', 'GBP', 'Consumer Cyclical'],
  ['ULVR.L',  'Unilever',               'GB', 'GBP', 'Consumer Defensive'],
  ['UU.L',    'United Utilities',       'GB', 'GBP', 'Utilities'],
  ['VOD.L',   'Vodafone',               'GB', 'GBP', 'Communication Services'],
  ['WEIR.L',  'Weir Group',             'GB', 'GBP', 'Industrials'],
  ['WPP.L',   'WPP',                    'GB', 'GBP', 'Communication Services'],
  ['WTB.L',   'Whitbread',              'GB', 'GBP', 'Consumer Cyclical'],
];

const SP500_TECH = [
  ['AAPL',  'Apple',                    'US', 'USD', 'Technology'],
  ['MSFT',  'Microsoft',                'US', 'USD', 'Technology'],
  ['NVDA',  'NVIDIA',                   'US', 'USD', 'Technology'],
  ['GOOGL', 'Alphabet Class A',         'US', 'USD', 'Communication Services'],
  ['GOOG',  'Alphabet Class C',         'US', 'USD', 'Communication Services'],
  ['META',  'Meta Platforms',           'US', 'USD', 'Communication Services'],
  ['AMZN',  'Amazon',                   'US', 'USD', 'Consumer Cyclical'],
  ['TSLA',  'Tesla',                    'US', 'USD', 'Consumer Cyclical'],
  ['AVGO',  'Broadcom',                 'US', 'USD', 'Technology'],
  ['ORCL',  'Oracle',                   'US', 'USD', 'Technology'],
  ['CRM',   'Salesforce',               'US', 'USD', 'Technology'],
  ['AMD',   'Advanced Micro Devices',   'US', 'USD', 'Technology'],
  ['INTC',  'Intel',                    'US', 'USD', 'Technology'],
  ['QCOM',  'Qualcomm',                 'US', 'USD', 'Technology'],
  ['TXN',   'Texas Instruments',        'US', 'USD', 'Technology'],
  ['NOW',   'ServiceNow',               'US', 'USD', 'Technology'],
  ['INTU',  'Intuit',                   'US', 'USD', 'Technology'],
  ['IBM',   'IBM',                      'US', 'USD', 'Technology'],
  ['AMAT',  'Applied Materials',        'US', 'USD', 'Technology'],
  ['LRCX',  'Lam Research',             'US', 'USD', 'Technology'],
  ['KLAC',  'KLA Corporation',          'US', 'USD', 'Technology'],
  ['ADI',   'Analog Devices',           'US', 'USD', 'Technology'],
  ['MU',    'Micron Technology',        'US', 'USD', 'Technology'],
  ['PANW',  'Palo Alto Networks',       'US', 'USD', 'Technology'],
  ['SNPS',  'Synopsys',                 'US', 'USD', 'Technology'],
  ['CDNS',  'Cadence Design Systems',   'US', 'USD', 'Technology'],
  ['FTNT',  'Fortinet',                 'US', 'USD', 'Technology'],
  ['ADBE',  'Adobe',                    'US', 'USD', 'Technology'],
  ['CSCO',  'Cisco Systems',            'US', 'USD', 'Technology'],
  ['ACN',   'Accenture',                'US', 'USD', 'Technology'],
];

const SP500_FINANCE = [
  ['BRK.B', 'Berkshire Hathaway B',    'US', 'USD', 'Financial Services'],
  ['JPM',   'JPMorgan Chase',           'US', 'USD', 'Financial Services'],
  ['V',     'Visa',                     'US', 'USD', 'Financial Services'],
  ['MA',    'Mastercard',               'US', 'USD', 'Financial Services'],
  ['BAC',   'Bank of America',          'US', 'USD', 'Financial Services'],
  ['WFC',   'Wells Fargo',              'US', 'USD', 'Financial Services'],
  ['GS',    'Goldman Sachs',            'US', 'USD', 'Financial Services'],
  ['MS',    'Morgan Stanley',           'US', 'USD', 'Financial Services'],
  ['BLK',   'BlackRock',                'US', 'USD', 'Financial Services'],
  ['SPGI',  'S&P Global',               'US', 'USD', 'Financial Services'],
  ['AXP',   'American Express',         'US', 'USD', 'Financial Services'],
  ['C',     'Citigroup',                'US', 'USD', 'Financial Services'],
  ['USB',   'US Bancorp',               'US', 'USD', 'Financial Services'],
  ['PGR',   'Progressive',              'US', 'USD', 'Financial Services'],
  ['CB',    'Chubb',                    'US', 'USD', 'Financial Services'],
  ['MMC',   'Marsh & McLennan',         'US', 'USD', 'Financial Services'],
  ['CME',   'CME Group',                'US', 'USD', 'Financial Services'],
  ['ICE',   'Intercontinental Exchange','US', 'USD', 'Financial Services'],
  ['AON',   'Aon',                      'US', 'USD', 'Financial Services'],
  ['TFC',   'Truist Financial',         'US', 'USD', 'Financial Services'],
];

const SP500_HEALTH = [
  ['LLY',   'Eli Lilly',                'US', 'USD', 'Healthcare'],
  ['UNH',   'UnitedHealth Group',       'US', 'USD', 'Healthcare'],
  ['JNJ',   'Johnson & Johnson',        'US', 'USD', 'Healthcare'],
  ['ABBV',  'AbbVie',                   'US', 'USD', 'Healthcare'],
  ['MRK',   'Merck & Co.',              'US', 'USD', 'Healthcare'],
  ['TMO',   'Thermo Fisher Scientific', 'US', 'USD', 'Healthcare'],
  ['ABT',   'Abbott Laboratories',      'US', 'USD', 'Healthcare'],
  ['DHR',   'Danaher',                  'US', 'USD', 'Healthcare'],
  ['PFE',   'Pfizer',                   'US', 'USD', 'Healthcare'],
  ['AMGN',  'Amgen',                    'US', 'USD', 'Healthcare'],
  ['BSX',   'Boston Scientific',        'US', 'USD', 'Healthcare'],
  ['ISRG',  'Intuitive Surgical',       'US', 'USD', 'Healthcare'],
  ['SYK',   'Stryker',                  'US', 'USD', 'Healthcare'],
  ['REGN',  'Regeneron Pharmaceuticals','US', 'USD', 'Healthcare'],
  ['VRTX',  'Vertex Pharmaceuticals',   'US', 'USD', 'Healthcare'],
  ['ZTS',   'Zoetis',                   'US', 'USD', 'Healthcare'],
  ['MCK',   'McKesson',                 'US', 'USD', 'Healthcare'],
  ['ELV',   'Elevance Health',          'US', 'USD', 'Healthcare'],
  ['CI',    'Cigna Group',              'US', 'USD', 'Healthcare'],
  ['HCA',   'HCA Healthcare',           'US', 'USD', 'Healthcare'],
  ['MDT',   'Medtronic',                'US', 'USD', 'Healthcare'],
  ['CVS',   'CVS Health',               'US', 'USD', 'Healthcare'],
  ['BMY',   'Bristol-Myers Squibb',     'US', 'USD', 'Healthcare'],
  ['GILD',  'Gilead Sciences',          'US', 'USD', 'Healthcare'],
  ['BDX',   'Becton Dickinson',         'US', 'USD', 'Healthcare'],
];

const SP500_CONSUMER = [
  ['AMZN',  'Amazon',                   'US', 'USD', 'Consumer Cyclical'],
  ['TSLA',  'Tesla',                    'US', 'USD', 'Consumer Cyclical'],
  ['HD',    'Home Depot',               'US', 'USD', 'Consumer Cyclical'],
  ['MCD',   "McDonald's",               'US', 'USD', 'Consumer Cyclical'],
  ['NKE',   'Nike',                     'US', 'USD', 'Consumer Cyclical'],
  ['SBUX',  'Starbucks',                'US', 'USD', 'Consumer Cyclical'],
  ['TJX',   'TJX Companies',            'US', 'USD', 'Consumer Cyclical'],
  ['LOW',   "Lowe's",                   'US', 'USD', 'Consumer Cyclical'],
  ['BKNG',  'Booking Holdings',         'US', 'USD', 'Consumer Cyclical'],
  ['MAR',   'Marriott International',   'US', 'USD', 'Consumer Cyclical'],
  ['GM',    'General Motors',           'US', 'USD', 'Consumer Cyclical'],
  ['F',     'Ford Motor',               'US', 'USD', 'Consumer Cyclical'],
  ['PG',    'Procter & Gamble',         'US', 'USD', 'Consumer Defensive'],
  ['KO',    'Coca-Cola',                'US', 'USD', 'Consumer Defensive'],
  ['PEP',   'PepsiCo',                  'US', 'USD', 'Consumer Defensive'],
  ['COST',  'Costco Wholesale',         'US', 'USD', 'Consumer Defensive'],
  ['WMT',   'Walmart',                  'US', 'USD', 'Consumer Defensive'],
  ['PM',    'Philip Morris',            'US', 'USD', 'Consumer Defensive'],
  ['MO',    'Altria Group',             'US', 'USD', 'Consumer Defensive'],
  ['CL',    'Colgate-Palmolive',        'US', 'USD', 'Consumer Defensive'],
  ['MDLZ',  'Mondelez International',   'US', 'USD', 'Consumer Defensive'],
  ['GIS',   'General Mills',            'US', 'USD', 'Consumer Defensive'],
  ['KHC',   'Kraft Heinz',              'US', 'USD', 'Consumer Defensive'],
  ['KMB',   'Kimberly-Clark',           'US', 'USD', 'Consumer Defensive'],
  ['SYY',   'Sysco',                    'US', 'USD', 'Consumer Defensive'],
];

const SP500_ENERGY_INDUSTRIAL = [
  ['XOM',   'ExxonMobil',               'US', 'USD', 'Energy'],
  ['CVX',   'Chevron',                  'US', 'USD', 'Energy'],
  ['COP',   'ConocoPhillips',           'US', 'USD', 'Energy'],
  ['EOG',   'EOG Resources',            'US', 'USD', 'Energy'],
  ['SLB',   'SLB (Schlumberger)',       'US', 'USD', 'Energy'],
  ['MPC',   'Marathon Petroleum',       'US', 'USD', 'Energy'],
  ['PSX',   'Phillips 66',              'US', 'USD', 'Energy'],
  ['VLO',   'Valero Energy',            'US', 'USD', 'Energy'],
  ['GE',    'GE Aerospace',             'US', 'USD', 'Industrials'],
  ['CAT',   'Caterpillar',              'US', 'USD', 'Industrials'],
  ['UPS',   'United Parcel Service',    'US', 'USD', 'Industrials'],
  ['HON',   'Honeywell',                'US', 'USD', 'Industrials'],
  ['BA',    'Boeing',                   'US', 'USD', 'Industrials'],
  ['LMT',   'Lockheed Martin',          'US', 'USD', 'Industrials'],
  ['RTX',   'RTX Corporation',          'US', 'USD', 'Industrials'],
  ['NOC',   'Northrop Grumman',         'US', 'USD', 'Industrials'],
  ['GD',    'General Dynamics',         'US', 'USD', 'Industrials'],
  ['DE',    'Deere & Company',          'US', 'USD', 'Industrials'],
  ['MMM',   '3M',                       'US', 'USD', 'Industrials'],
  ['EMR',   'Emerson Electric',         'US', 'USD', 'Industrials'],
  ['ETN',   'Eaton',                    'US', 'USD', 'Industrials'],
  ['ITW',   'Illinois Tool Works',      'US', 'USD', 'Industrials'],
  ['FDX',   'FedEx',                    'US', 'USD', 'Industrials'],
  ['WM',    'Waste Management',         'US', 'USD', 'Industrials'],
  ['NSC',   'Norfolk Southern',         'US', 'USD', 'Industrials'],
];

const SP500_OTHER = [
  ['AMTM',  'Amentum Holdings',         'US', 'USD', 'Industrials'],
  ['NEE',   'NextEra Energy',           'US', 'USD', 'Utilities'],
  ['DUK',   'Duke Energy',              'US', 'USD', 'Utilities'],
  ['SO',    'Southern Company',         'US', 'USD', 'Utilities'],
  ['D',     'Dominion Energy',          'US', 'USD', 'Utilities'],
  ['AEP',   'American Electric Power',  'US', 'USD', 'Utilities'],
  ['SRE',   'Sempra',                   'US', 'USD', 'Utilities'],
  ['AMT',   'American Tower',           'US', 'USD', 'Real Estate'],
  ['PLD',   'Prologis',                 'US', 'USD', 'Real Estate'],
  ['CCI',   'Crown Castle',             'US', 'USD', 'Real Estate'],
  ['EQIX',  'Equinix',                  'US', 'USD', 'Real Estate'],
  ['SPG',   'Simon Property Group',     'US', 'USD', 'Real Estate'],
  ['WELL',  'Welltower',                'US', 'USD', 'Real Estate'],
  ['DLR',   'Digital Realty Trust',     'US', 'USD', 'Real Estate'],
  ['T',     'AT&T',                     'US', 'USD', 'Communication Services'],
  ['VZ',    'Verizon',                  'US', 'USD', 'Communication Services'],
  ['TMUS',  'T-Mobile US',              'US', 'USD', 'Communication Services'],
  ['NFLX',  'Netflix',                  'US', 'USD', 'Communication Services'],
  ['DIS',   'Walt Disney',              'US', 'USD', 'Communication Services'],
  ['CMCSA', 'Comcast',                  'US', 'USD', 'Communication Services'],
  ['LIN',   'Linde',                    'US', 'USD', 'Basic Materials'],
  ['APD',   'Air Products',             'US', 'USD', 'Basic Materials'],
  ['SHW',   'Sherwin-Williams',         'US', 'USD', 'Basic Materials'],
  ['ECL',   'Ecolab',                   'US', 'USD', 'Basic Materials'],
  ['NEM',   'Newmont',                  'US', 'USD', 'Basic Materials'],
];

const NIKKEI_TOP = [
  ['7203.T', 'Toyota Motor',            'JP', 'JPY', 'Consumer Cyclical'],
  ['6758.T', 'Sony Group',              'JP', 'JPY', 'Technology'],
  ['9984.T', 'SoftBank Group',          'JP', 'JPY', 'Communication Services'],
  ['6861.T', 'Keyence',                 'JP', 'JPY', 'Technology'],
  ['8306.T', 'Mitsubishi UFJ',          'JP', 'JPY', 'Financial Services'],
  ['9432.T', 'NTT',                     'JP', 'JPY', 'Communication Services'],
  ['6501.T', 'Hitachi',                 'JP', 'JPY', 'Industrials'],
  ['6367.T', 'Daikin Industries',       'JP', 'JPY', 'Industrials'],
  ['7974.T', 'Nintendo',                'JP', 'JPY', 'Communication Services'],
  ['4063.T', 'Shin-Etsu Chemical',      'JP', 'JPY', 'Basic Materials'],
  ['8035.T', 'Tokyo Electron',          'JP', 'JPY', 'Technology'],
  ['9983.T', 'Fast Retailing',          'JP', 'JPY', 'Consumer Cyclical'],
  ['6098.T', 'Recruit Holdings',        'JP', 'JPY', 'Industrials'],
  ['4502.T', 'Takeda Pharmaceutical',   'JP', 'JPY', 'Healthcare'],
  ['6902.T', 'DENSO',                   'JP', 'JPY', 'Consumer Cyclical'],
];

const HANG_SENG_TOP = [
  ['0700.HK', 'Tencent Holdings',       'HK', 'HKD', 'Communication Services'],
  ['9988.HK', 'Alibaba Group',          'HK', 'HKD', 'Consumer Cyclical'],
  ['1299.HK', 'AIA Group',              'HK', 'HKD', 'Financial Services'],
  ['0005.HK', 'HSBC Holdings',          'HK', 'HKD', 'Financial Services'],
  ['2318.HK', 'Ping An Insurance',      'HK', 'HKD', 'Financial Services'],
  ['0939.HK', 'CCB',                    'HK', 'HKD', 'Financial Services'],
  ['1398.HK', 'ICBC',                   'HK', 'HKD', 'Financial Services'],
  ['3988.HK', 'Bank of China',          'HK', 'HKD', 'Financial Services'],
  ['0941.HK', 'China Mobile',           'HK', 'HKD', 'Communication Services'],
  ['2020.HK', 'ANTA Sports',            'HK', 'HKD', 'Consumer Cyclical'],
  ['9618.HK', 'JD.com',                 'HK', 'HKD', 'Consumer Cyclical'],
  ['3690.HK', 'Meituan',                'HK', 'HKD', 'Consumer Cyclical'],
  ['0388.HK', 'HKEX',                   'HK', 'HKD', 'Financial Services'],
  ['1177.HK', 'Sino Biopharmaceutical', 'HK', 'HKD', 'Healthcare'],
  ['2382.HK', 'Sunny Optical',          'HK', 'HKD', 'Technology'],
];

// ============================================================
// === FONCTION D'INJECTION ===
// ============================================================

// Toutes les listes regroupées
const TOUTES_LES_ACTIONS = [
  ...CAC40,
  ...AEX,
  ...DAX,
  ...FTSE100,
  ...SP500_TECH,
  ...SP500_FINANCE,
  ...SP500_HEALTH,
  ...SP500_CONSUMER,
  ...SP500_ENERGY_INDUSTRIAL,
  ...SP500_OTHER,
  ...NIKKEI_TOP,
  ...HANG_SENG_TOP,
];

async function injecterSymboles() {
  console.log(`[Seeds] 🌱 Injection de ${TOUTES_LES_ACTIONS.length} symboles...`);

  // Dédoublonner (certains symboles apparaissent dans plusieurs listes)
  const vus = new Set();
  const uniques = TOUTES_LES_ACTIONS.filter(([symbol]) => {
    if (vus.has(symbol)) return false;
    vus.add(symbol);
    return true;
  });

  let inseres = 0;
  let ignores = 0;

  for (const [symbol, name, country, currency, sector] of uniques) {
    try {
      const result = await pool.query(`
        INSERT INTO stocks (symbol, name, country, currency, sector, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (symbol) DO UPDATE SET
          name     = COALESCE(EXCLUDED.name, stocks.name),
          country  = COALESCE(EXCLUDED.country, stocks.country),
          currency = COALESCE(EXCLUDED.currency, stocks.currency),
          sector   = COALESCE(EXCLUDED.sector, stocks.sector),
          updated_at = NOW()
        RETURNING (xmax = 0) AS inserted
      `, [symbol, name, country, currency, sector]);

      if (result.rows[0]?.inserted) inseres++;
      else ignores++;
    } catch (err) {
      console.warn(`[Seeds] ⚠️  ${symbol}: ${err.message}`);
    }
  }

  console.log(`[Seeds] ✅ ${inseres} nouveaux symboles insérés, ${ignores} mis à jour`);
  return { inseres, ignores, total: uniques.length };
}

module.exports = { injecterSymboles, TOUTES_LES_ACTIONS };
