const crypto = require('crypto');

const memoryCache = new Map();

/**
 * Generates an MD5 ETag hash for caching HTTP payloads.
 *
 * @param {any} data - The data to hash.
 * @returns {string} The MD5 hex digest.
 */
function generateETag(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Retrieves cached data by key with optional expired snapshot recovery.
 *
 * @param {string} key - Cache identifier.
 * @param {boolean} [allowExpired=false] - Whether to return stale data if expired.
 * @returns {{ data: any, etag: string, isExpired: boolean, isPrivateWarLog?: boolean } | null}
 */
function getCachedData(key, allowExpired = false) {
    const item = memoryCache.get(key);
    if (!item) return null;
    const isExpired = Date.now() > item.expiresAt;
    if (isExpired && !allowExpired) {
        memoryCache.delete(key);
        return null;
    }
    const isPrivate = Boolean(item.data && typeof item.data === 'object' && item.data.isPrivateWarLog);
    return {
        data: item.data,
        etag: item.etag,
        isExpired,
        isPrivateWarLog: isPrivate
    };
}

/**
 * Calculates the remaining TTL in seconds for a cached key.
 *
 * @param {string} key - Cache identifier.
 * @returns {number} Remaining seconds.
 */
function getRemainingTTL(key) {
    const item = memoryCache.get(key);
    if (!item) return 0;
    const remaining = Math.round((item.expiresAt - Date.now()) / 1000);
    return Math.max(0, remaining);
}

/**
 * Stores data in memory cache with an expiration duration.
 *
 * @param {string} key - Cache identifier.
 * @param {any} data - Payload to cache.
 * @param {number} ttlSeconds - Duration in seconds.
 */
function setCachedData(key, data, ttlSeconds) {
    if (memoryCache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of memoryCache.entries()) {
            if (now > v.expiresAt || memoryCache.size > 500) {
                memoryCache.delete(k);
            }
        }
    }
    const etag = generateETag(data);
    memoryCache.set(key, {
        data,
        etag,
        expiresAt: Date.now() + (ttlSeconds * 1000)
    });
}

module.exports = {
    generateETag,
    getCachedData,
    getRemainingTTL,
    setCachedData,
    memoryCache
};
