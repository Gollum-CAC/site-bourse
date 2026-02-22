// Routes pour la section Super Dividendes PEA
const express = require('express');
const router = express.Router();
const fmpService = require('../services/fmpService');
const cache = require('../services/cacheService');

// Liste des meilleures actions à dividendes PEA (Euronext)
// On les code en dur car le screener FMP a des limites sur le plan gratuit
// Ces symboles sont les top dividendes Euronext historiquement fiables
const PEA_DIVIDEND_STOCKS = [
  // France - Banques / Assurances (gros payeurs)
  'ACA.PA',   // Crédit Agricole ~8-10%
  'GLE.PA',   // Société Générale ~7-9%
  'BNP.PA',   // BNP Paribas ~7-8%
  'CNP.PA',   // CNP Assurances ~7-9%
  'COFA.PA',  // Coface ~9-12%
  'CS.PA',    // AXA ~6-8%
  'SCR.PA',   // SCOR ~7-9%
  // France - Foncières (SIIC, hauts rendements)
  'URW.PA',   // Unibail-Rodamco ~8-12%
  'ICAD.PA',  // Icade ~8-12%
  'ALTA.PA',  // Altarea ~8-12%
  'LI.PA',    // Klepierre ~7-10%
  'COVH.PA',  // Covivio Hotels ~7-9%
  'CARM.PA',  // Carmila ~7-9%
  'ARG.PA',   // Argan ~5-7%
  'MER.PA',   // Mercialys ~8-12%
  // France - Médias / Petites caps à gros dividende
  'MMT.PA',   // Métropole TV (M6) ~8-12%
  'TF1.PA',   // TF1 ~7-10%
  'ABCA.PA',  // ABC Arbitrage ~8-10%
  'CBOT.PA',  // CBO Territoria ~6-8%
  // France - Industrie / Énergie / Autre
  'TTE.PA',   // TotalEnergies ~5-7%
  'EN.PA',    // Bouygues ~5-7%
  'RNO.PA',   // Renault ~5-8%
  'CA.PA',    // Carrefour ~5-7%
  'FDJ.PA',   // FDJ ~5-7%
  'SAMS.PA',  // Samse ~6-8%
  'NERG.PA',  // Energéa ~7-10%
  'BAIN.PA',  // Bassac ~6-8%
  // Pays-Bas
  'INGA.AS',  // ING Group ~7-10%
  'ABN.AS',   // ABN AMRO ~8-12%
  'AGN.AS',   // Aegon ~7-10%
  'NN.AS',    // NN Group ~7-9%
  // Belgique
  'KBC.BR',   // KBC Group ~7-9%
  'COFB.BR',  // Cofinimmo ~8-10%
  'ACKB.BR',  // Ackermans & van Haaren ~4-6%
];

// GET /api/dividendes/super - Top dividendes PEA avec analyse
router.get('/super', async (req, res) => {
  try {
    // Vérifier le cache global (cette requête est lourde)
    const cached = cache.get('super-dividendes');
    if (cached) {
      return res.json(cached);
    }

    console.log('[SuperDiv] Début du calcul des super dividendes PEA...');
    const results = [];

    // Charger par petits lots pour respecter le rate limit
    const batchSize = 2;
    for (let i = 0; i < PEA_DIVIDEND_STOCKS.length; i += batchSize) {
      const batch = PEA_DIVIDEND_STOCKS.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(symbol => analyzeStock(symbol))
      );

      batchResults.forEach(r => {
        if (r.status === 'fulfilled' && r.value) {
          results.push(r.value);
        }
      });

      // Pause entre les lots
      if (i + batchSize < PEA_DIVIDEND_STOCKS.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Trier par score composite décroissant
    results.sort((a, b) => b.score - a.score);

    const response = {
      updatedAt: new Date().toISOString(),
      count: results.length,
      stocks: results,
    };

    // Cacher 30 minutes (cette donnée change peu)
    cache.set('super-dividendes', response, 1800);
    console.log(`[SuperDiv] ${results.length} actions analysées`);

    res.json(response);
  } catch (error) {
    console.error('Erreur super dividendes:', error.message);
    res.status(500).json({ erreur: 'Impossible de calculer les super dividendes' });
  }
});

// Analyser une action : quote + dividendes historiques
async function analyzeStock(symbol) {
  try {
    const [quoteData, dividendsData, profileData] = await Promise.allSettled([
      fmpService.getQuote(symbol),
      fmpService.getDividends(symbol),
      fmpService.getCompanyProfile(symbol),
    ]);

    const quote = quoteData.status === 'fulfilled' ? quoteData.value?.[0] : null;
    const profile = profileData.status === 'fulfilled' ? profileData.value?.[0] : null;
    
    if (!quote || !quote.price) return null;

    // Extraire les dividendes
    let dividends = [];
    if (dividendsData.status === 'fulfilled') {
      const dv = dividendsData.value;
      if (Array.isArray(dv)) dividends = dv;
      else if (dv?.historical) dividends = dv.historical;
    }

    // Calculer les dividendes annuels (somme par année)
    const annualDividends = {};
    dividends.forEach(d => {
      const year = (d.date || d.paymentDate || '').substring(0, 4);
      const amount = d.dividend || d.adjDividend || 0;
      if (year && amount > 0) {
        annualDividends[year] = (annualDividends[year] || 0) + amount;
      }
    });

    // Obtenir les 5 dernières années
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 6; y--) {
      if (annualDividends[y]) {
        years.push({ year: y, amount: annualDividends[y] });
      }
    }

    if (years.length === 0) return null;

    // Rendement actuel
    const latestAnnualDiv = years[0]?.amount || 0;
    const currentYield = (latestAnnualDiv / quote.price) * 100;

    if (currentYield < 7) return null; // Seuil minimum 7% : uniquement les gros rendements

    // Rendement moyen sur les années disponibles
    const avgDiv = years.reduce((sum, y) => sum + y.amount, 0) / years.length;
    const avgYield = (avgDiv / quote.price) * 100;

    // Régularité : combien d'années ont un dividende (sur 5 ans max)
    const yearsWithDiv = Math.min(years.length, 5);
    const regularity = yearsWithDiv / 5; // 1.0 = dividende chaque année

    // Croissance : tendance des dividendes
    let growth = 0;
    if (years.length >= 2) {
      const oldest = years[years.length - 1].amount;
      const newest = years[0].amount;
      if (oldest > 0) {
        growth = ((newest - oldest) / oldest) * 100;
      }
    }

    // Score composite (sur 100)
    // 40% rendement + 30% régularité + 20% croissance + 10% rendement moyen
    const yieldScore = Math.min(currentYield / 15 * 40, 40);        // Max 40 pts (15%+ = max)
    const regularityScore = regularity * 30;                         // Max 30 pts
    const growthScore = Math.min(Math.max(growth + 20, 0) / 40 * 20, 20); // Max 20 pts
    const avgScore = Math.min(avgYield / 12 * 10, 10);              // Max 10 pts (12%+ = max)
    const score = Math.round(yieldScore + regularityScore + growthScore + avgScore);

    // Déterminer la tendance
    let trend = 'stable';
    if (growth > 10) trend = 'croissant';
    else if (growth < -10) trend = 'décroissant';

    return {
      symbol,
      name: quote.name || profile?.companyName || symbol,
      sector: profile?.sector || 'N/A',
      price: quote.price,
      currency: symbol.includes('.AS') || symbol.includes('.BR') ? '€' : '€', // Tout Euronext = EUR
      currentYield: Math.round(currentYield * 100) / 100,
      avgYield: Math.round(avgYield * 100) / 100,
      latestAnnualDiv: Math.round(latestAnnualDiv * 1000) / 1000,
      yearsOfDividends: yearsWithDiv,
      growth: Math.round(growth * 10) / 10,
      trend,
      regularity: Math.round(regularity * 100),
      score,
      history: years.slice(0, 5).map(y => ({
        year: y.year,
        dividend: Math.round(y.amount * 1000) / 1000,
        yield: Math.round((y.amount / quote.price) * 10000) / 100,
      })),
      marketCap: quote.marketCap,
      change: quote.change,
      changePercentage: quote.changesPercentage || quote.changePercentage,
    };
  } catch (err) {
    console.error(`[SuperDiv] Erreur pour ${symbol}:`, err.message);
    return null;
  }
}

module.exports = router;
