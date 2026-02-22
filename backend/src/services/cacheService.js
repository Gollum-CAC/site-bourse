// Service de cache en mémoire pour limiter les appels API
// Cache les réponses pendant une durée configurable

const cache = new Map();

// Durées de cache par défaut (en secondes)
const DEFAULT_TTL = 300; // 5 minutes pour les quotes
const LONG_TTL = 900;    // 15 minutes pour les profils, ratios, etc.

/**
 * Récupérer une valeur du cache
 */
function get(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

/**
 * Stocker une valeur dans le cache
 */
function set(key, data, ttlSeconds = DEFAULT_TTL) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + (ttlSeconds * 1000),
    createdAt: Date.now(),
  });
}

/**
 * Wrapper : récupérer du cache ou exécuter la fonction
 */
async function getOrFetch(key, fetchFn, ttlSeconds = DEFAULT_TTL) {
  const cached = get(key);
  if (cached !== null) {
    return cached;
  }
  const data = await fetchFn();
  set(key, data, ttlSeconds);
  return data;
}

/**
 * Vider le cache
 */
function clear() {
  cache.clear();
}

/**
 * Stats du cache
 */
function stats() {
  let valid = 0, expired = 0;
  const now = Date.now();
  for (const [key, item] of cache) {
    if (now > item.expiresAt) expired++;
    else valid++;
  }
  return { total: cache.size, valid, expired };
}

module.exports = { get, set, getOrFetch, clear, stats, DEFAULT_TTL, LONG_TTL };
