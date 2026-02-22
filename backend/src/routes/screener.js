// Route Screener avancé — Filtrage multi-critères d'actions
// Stratégie hybride : PostgreSQL (données locales) + FMP API (données fraîches)
const express = require('express');
const router = express.Router();
const fmpService = require('../services/fmpService');
const pool = require('../config/database');
const cache = require('../services/cacheService');

// ==========================================
// === GET /api/screener — Screener principal ===
// ==========================================
// Paramètres supportés :
//   exchange         : EURONEXT, NASDAQ, NYSE, TSE, HKSE (vide = tous)
//   sector           : Technology, Financial Services, etc.
//   country          : FR, US, NL, DE, etc.
//   marketCapMin     : capitalisation boursière min (en €/$)
//   marketCapMax     : capitalisation boursière max
//   peMin / peMax    : P/E ratio min/max
//   dividendYieldMin : rendement dividende minimum (%)
//   priceMin / priceMax : plage de prix
//   limit            : nombre de résultats (défaut 50, max 250)
//   sortBy           : price, marketCap, dividendYield, pe, changePercent
//   sortDir          : asc | desc
//   source           : 'db' (PEA local), 'fmp' (API), 'auto' (défaut = hybride)

router.get('/', async (req, res) => {
  try {
    const {
      exchange = '',
      sector = '',
      country = '',
      marketCapMin = '',
      marketCapMax = '',
      peMin = '',
      peMax = '',
      dividendYieldMin = '',
      priceMin = '',
      priceMax = '',
      limit = '50',
      sortBy = 'marketCap',
      sortDir = 'desc',
      source = 'auto',
    } = req.query;

    const limitNum = Math.min(parseInt(limit) || 50, 250);

    // === SOURCE DB : actions PEA indexées localement ===
    const utiliserDB = (source === 'db' || source === 'auto') && (!exchange || ['EURONEXT', 'EPA', 'ENX'].includes(exchange.toUpperCase()));

    if (utiliserDB) {
      try {
        const resultDB = await screenerDepuisDB({
          exchange, sector, country,
          marketCapMin, marketCapMax,
          peMin, peMax,
          dividendYieldMin,
          priceMin, priceMax,
          sortBy, sortDir,
          limit: limitNum,
        });

        // Si on a des résultats en DB et source = 'db', on retourne directement
        if (resultDB.stocks.length > 0 || source === 'db') {
          return res.json({
            ...resultDB,
            source: 'database',
            note: `Données locales (${resultDB.total} actions PEA indexées)`,
          });
        }
      } catch (dbErr) {
        console.warn('[Screener] DB indisponible, fallback FMP:', dbErr.message);
      }
    }

    // === SOURCE FMP : appel API pour les marchés non-PEA ou si DB vide ===
    const resultFMP = await screenerDepuisFMP({
      exchange, sector, country,
      marketCapMin, marketCapMax,
      dividendYieldMin,
      priceMin, priceMax,
      sortBy, sortDir,
      limit: limitNum,
    });

    res.json({
      ...resultFMP,
      source: 'fmp',
      note: 'Données Financial Modeling Prep (temps réel)',
    });

  } catch (err) {
    console.error('[Screener] Erreur:', err.message);
    res.status(500).json({ erreur: 'Impossible d\'exécuter le screener', detail: err.message });
  }
});

// ==========================================
// === GET /api/screener/secteurs — Liste des secteurs disponibles ===
// ==========================================
router.get('/secteurs', async (req, res) => {
  // Secteurs FMP standards
  const secteursFMP = [
    'Basic Materials', 'Communication Services', 'Consumer Cyclical',
    'Consumer Defensive', 'Energy', 'Financial Services', 'Healthcare',
    'Industrials', 'Real Estate', 'Technology', 'Utilities',
  ];

  // Enrichir avec les secteurs présents en DB si disponible
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT sector FROM stocks 
      WHERE sector IS NOT NULL AND sector != '' 
      ORDER BY sector
    `);
    const secteursDB = rows.map(r => r.sector);
    const tous = [...new Set([...secteursDB, ...secteursFMP])].sort();
    res.json({ secteurs: tous, source: 'hybride' });
  } catch {
    res.json({ secteurs: secteursFMP, source: 'fmp' });
  }
});

// ==========================================
// === GET /api/screener/presets — Présélections prêtes à l'emploi ===
// ==========================================
router.get('/presets', (req, res) => {
  res.json({
    presets: [
      {
        id: 'super_div_pea',
        label: '💎 Super Dividendes PEA',
        description: 'Actions Euronext avec rendement ≥ 7%',
        params: { exchange: 'EURONEXT', dividendYieldMin: '7', sortBy: 'dividendYield', sortDir: 'desc' },
      },
      {
        id: 'value_europe',
        label: '📊 Value Europe',
        description: 'P/E < 15 + cap > 1 Mds € (Euronext)',
        params: { exchange: 'EURONEXT', peMax: '15', marketCapMin: '1000000000', sortBy: 'pe', sortDir: 'asc' },
      },
      {
        id: 'large_cap_us',
        label: '🇺🇸 Large Caps US',
        description: 'Top capitalisations NASDAQ + NYSE',
        params: { exchange: 'NASDAQ', marketCapMin: '10000000000', sortBy: 'marketCap', sortDir: 'desc' },
      },
      {
        id: 'tech_growth',
        label: '🚀 Tech Growth',
        description: 'Secteur technologie, toutes places',
        params: { sector: 'Technology', marketCapMin: '1000000000', sortBy: 'marketCap', sortDir: 'desc' },
      },
      {
        id: 'small_cap_fr',
        label: '🇫🇷 Small Caps France',
        description: 'Petites caps françaises < 500 M€',
        params: { exchange: 'EURONEXT', country: 'FR', marketCapMax: '500000000', sortBy: 'marketCap', sortDir: 'desc' },
      },
      {
        id: 'rendement_europe',
        label: '💰 Rendement Europe',
        description: 'Dividendes ≥ 4% sur Euronext',
        params: { exchange: 'EURONEXT', dividendYieldMin: '4', sortBy: 'dividendYield', sortDir: 'desc' },
      },
    ],
  });
});

// ==========================================
// === FONCTION : Screener depuis PostgreSQL ===
// ==========================================
async function screenerDepuisDB({ exchange, sector, country, marketCapMin, marketCapMax, peMin, peMax, dividendYieldMin, priceMin, priceMax, sortBy, sortDir, limit }) {
  // Colonnes de tri disponibles en DB
  const triAutorisé = {
    marketCap: 's.market_cap',
    price: 's.price',
    dividendYield: 'da.current_yield',
    pe: 'da.composite_score', // On n'a pas le P/E en DB, on trie par score
    changePercent: 's.market_cap', // fallback
    score: 'da.composite_score',
  };
  const colTri = triAutorisé[sortBy] || 's.market_cap';
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

  let conditions = ['s.price > 0', 's.is_pea_eligible = TRUE'];
  const params = [];
  let idx = 1;

  if (country) { conditions.push(`s.country = $${idx}`); params.push(country.toUpperCase()); idx++; }
  if (sector) { conditions.push(`s.sector ILIKE $${idx}`); params.push(`%${sector}%`); idx++; }
  if (marketCapMin) { conditions.push(`s.market_cap >= $${idx}`); params.push(parseInt(marketCapMin)); idx++; }
  if (marketCapMax) { conditions.push(`s.market_cap <= $${idx}`); params.push(parseInt(marketCapMax)); idx++; }
  if (priceMin) { conditions.push(`s.price >= $${idx}`); params.push(parseFloat(priceMin)); idx++; }
  if (priceMax) { conditions.push(`s.price <= $${idx}`); params.push(parseFloat(priceMax)); idx++; }

  // Filtre dividende : jointure avec dividend_analysis si besoin
  const avecAnalyse = !!(dividendYieldMin || sortBy === 'dividendYield' || sortBy === 'score');
  const joinAnalyse = avecAnalyse
    ? 'LEFT JOIN dividend_analysis da ON da.symbol = s.symbol'
    : '';

  if (dividendYieldMin) {
    conditions.push(`da.current_yield >= $${idx}`);
    params.push(parseFloat(dividendYieldMin));
    idx++;
  }

  const where = conditions.join(' AND ');
  params.push(limit);

  const sql = `
    SELECT 
      s.symbol, s.name, s.exchange, s.country, s.sector, s.industry,
      s.price, s.market_cap, s.currency,
      da.current_yield, da.composite_score, da.trend, da.latest_annual_div,
      da.years_of_dividends
    FROM stocks s
    ${joinAnalyse}
    WHERE ${where}
    ORDER BY ${colTri} ${dir} NULLS LAST
    LIMIT $${idx}
  `;

  const { rows } = await pool.query(sql, params);

  // Compter le total
  const sqlCount = `
    SELECT COUNT(*) as total FROM stocks s
    ${joinAnalyse}
    WHERE ${where}
  `;
  const { rows: countRows } = await pool.query(sqlCount, params.slice(0, -1));

  return {
    stocks: rows.map(r => ({
      symbol: r.symbol,
      name: r.name,
      exchange: r.exchange,
      country: r.country,
      sector: r.sector || 'N/A',
      industry: r.industry || 'N/A',
      price: parseFloat(r.price) || 0,
      currency: r.currency || 'EUR',
      marketCap: parseInt(r.market_cap) || 0,
      dividendYield: r.current_yield ? parseFloat(r.current_yield) : null,
      score: r.composite_score || null,
      trend: r.trend || null,
      latestAnnualDiv: r.latest_annual_div ? parseFloat(r.latest_annual_div) : null,
      yearsOfDividends: r.years_of_dividends || null,
      // Champs FMP non disponibles en DB
      pe: null,
      change: null,
      changePercent: null,
      volume: null,
    })),
    total: parseInt(countRows[0]?.total) || 0,
    limit,
  };
}

// ==========================================
// === FONCTION : Screener depuis FMP ===
// ==========================================
async function screenerDepuisFMP({ exchange, sector, country, marketCapMin, marketCapMax, dividendYieldMin, priceMin, priceMax, sortBy, sortDir, limit }) {
  // Construire les paramètres FMP
  let endpoint = `stock-screener?limit=${limit}&isActivelyTrading=true`;

  if (exchange) endpoint += `&exchange=${exchange}`;
  if (sector) endpoint += `&sector=${encodeURIComponent(sector)}`;
  if (country) endpoint += `&country=${country}`;
  if (marketCapMin) endpoint += `&marketCapMoreThan=${marketCapMin}`;
  if (marketCapMax) endpoint += `&marketCapLowerThan=${marketCapMax}`;
  if (dividendYieldMin) endpoint += `&dividendMoreThan=${parseFloat(dividendYieldMin) / 100}`;
  if (priceMin) endpoint += `&priceMoreThan=${priceMin}`;
  if (priceMax) endpoint += `&priceLowerThan=${priceMax}`;

  // Clé de cache unique selon les paramètres
  const cacheKey = `screener-adv:${endpoint}`;
  const data = await cache.getOrFetch(cacheKey, async () => {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `https://financialmodelingprep.com/stable/${endpoint}${sep}apikey=${process.env.FMP_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FMP screener: ${response.status}`);
    return response.json();
  }, 900); // Cache 15 min

  let stocks = Array.isArray(data) ? data : [];

  // Tri côté serveur (FMP ne trie pas toujours)
  const triMap = {
    marketCap: 'marketCap',
    price: 'price',
    dividendYield: 'lastAnnualDividend',
    pe: 'pe',
    changePercent: 'changesPercentage',
  };
  const champTri = triMap[sortBy] || 'marketCap';
  stocks.sort((a, b) => {
    const va = a[champTri] || 0;
    const vb = b[champTri] || 0;
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  return {
    stocks: stocks.map(s => ({
      symbol: s.symbol,
      name: s.companyName || s.name,
      exchange: s.exchangeShortName || s.exchange,
      country: s.country || '',
      sector: s.sector || 'N/A',
      industry: s.industry || 'N/A',
      price: s.price || 0,
      currency: s.currency || 'USD',
      marketCap: s.marketCap || 0,
      dividendYield: s.lastAnnualDividend && s.price ? Math.round((s.lastAnnualDividend / s.price) * 10000) / 100 : null,
      pe: s.pe || null,
      change: s.change || null,
      changePercent: s.changesPercentage || null,
      volume: s.volume || null,
      score: null,
      trend: null,
    })),
    total: stocks.length,
    limit,
  };
}

module.exports = router;
