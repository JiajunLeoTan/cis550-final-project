const cache = new Map();

async function cached(key, ttlMs, loader) {
  const now = Date.now();
  const hit = cache.get(key);

  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const value = await loader();
  cache.set(key, {
    value,
    expiresAt: now + ttlMs
  });
  return value;
}

function clearCache() {
  cache.clear();
}

module.exports = {
  cached,
  clearCache
};
