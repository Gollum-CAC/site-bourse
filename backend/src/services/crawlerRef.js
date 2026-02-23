// Référence partagée vers le crawler — évite la dépendance circulaire
// fmpService.js → crawler.js → fmpService.js
// On passe par ce module intermédiaire pour que fmpService
// puisse stopper le crawler sans l'importer directement.

let _crawlerRef = null;

function setCrawlerRef(crawler) {
  _crawlerRef = crawler;
}

function setCrawlerConfig(config) {
  if (_crawlerRef) _crawlerRef.setCrawlerConfig(config);
}

function stopCrawler() {
  if (_crawlerRef) _crawlerRef.stopCrawler();
}

module.exports = { setCrawlerRef, setCrawlerConfig, stopCrawler };
