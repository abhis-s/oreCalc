const https = require('https');
const { db } = require('./firebase.js');
const { getCachedData, setCachedData, getRemainingTTL } = require('./cacheService.js');
const { checkCircuitBreaker, tripCircuitBreaker } = require('./circuitBreaker.js');
const { isValidTag } = require('../utils/validation.js');

const httpsAgent = /** @type {any} */ (new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    keepAliveMsecs: 30000,
    timeout: 60000
}));

/**
 * Formats and sends standardized error JSON responses for upstream Supercell API failures.
 *
 * @param {import('express').Response} res - Express response object.
 * @param {any} response - Node-fetch response object.
 * @param {string} [defaultEntityName='Resource'] - Resource name for 404 messages.
 */
async function sendStandardizedUpstreamError(res, response, defaultEntityName = 'Resource') {
    const status = response.status;
    if (status === 429) {
        const retryAfter = response.headers.get('retry-after') || '60';
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
            reason: 'rateLimit',
            message: 'Too many requests.'
        });
    }

    if (status === 503) {
        return res.status(503).json({
            reason: 'inMaintenance',
            message: 'Clash of Clans API is currently in maintenance.'
        });
    }

    let parsedBody = null;
    try {
        parsedBody = await response.json();
    } catch {
    }

    if (parsedBody && typeof parsedBody === 'object') {
        if (status === 404 && !parsedBody.reason) {
            parsedBody.reason = 'notFound';
        }
        return res.status(status).json(parsedBody);
    }

    if (status === 404) {
        return res.status(404).json({
            reason: 'notFound',
            message: `${defaultEntityName} not found.`
        });
    }

    return res.status(status).json({
        reason: 'upstreamError',
        message: `Upstream service error (HTTP ${status})`
    });
}

/**
 * Internal in-memory handler for fetching clan war logs with caching, circuit breaking,
 * and private war log handling without network loopback.
 *
 * @param {string} clanTag - Clan hashtag.
 * @param {{ userId?: string|null, clientETag?: string|null }} [options={}] - Options.
 * @returns {Promise<{ status: number, body?: any, headers?: Record<string, string> }>}
 */
async function getClanWarLogInternal(clanTag, { userId = null, clientETag = null } = {}) {
    if (!isValidTag(clanTag)) {
        return {
            status: 400,
            body: { reason: 'invalidTag', message: 'Invalid Clash of Clans tag format.' }
        };
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const cacheKey = `warlog_${cleanedTag.toUpperCase()}`;

    if (checkCircuitBreaker()) {
        const stale = getCachedData(cacheKey, true);
        if (stale) {
            const actualStaleData = stale.isPrivateWarLog ? stale.data : (stale.data || stale);
            if (actualStaleData) {
                return {
                    status: 200,
                    body: actualStaleData,
                    headers: {
                        'Cache-Control': 'public, max-age=0, must-revalidate',
                        ...(stale.etag ? { 'ETag': `"${stale.etag}"` } : {})
                    }
                };
            }
        }
        return {
            status: 503,
            body: { reason: 'inMaintenance', message: 'Clash of Clans API is currently in maintenance. No cached snapshot found.' }
        };
    }

    const cached = getCachedData(cacheKey);
    if (cached) {
        if (cached.isPrivateWarLog) {
            if (cached.data) {
                return {
                    status: 200,
                    body: cached.data,
                    headers: {
                        'Cache-Control': `public, max-age=${getRemainingTTL(cacheKey)}`,
                        ...(cached.etag ? { 'ETag': `"${cached.etag}"` } : {})
                    }
                };
            } else {
                return {
                    status: 403,
                    body: { reason: 'privateWarLog', message: 'Clan war log is private' },
                    headers: {
                        'Cache-Control': `public, max-age=${getRemainingTTL(cacheKey)}`
                    }
                };
            }
        }

        if (clientETag && clientETag === `"${cached.etag}"`) {
            return {
                status: 304,
                headers: {
                    'Cache-Control': `public, max-age=${getRemainingTTL(cacheKey)}`,
                    'ETag': `"${cached.etag}"`
                }
            };
        }

        return {
            status: 200,
            body: cached.data,
            headers: {
                'Cache-Control': `public, max-age=${getRemainingTTL(cacheKey)}`,
                'ETag': `"${cached.etag}"`
            }
        };
    }

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clans/${encodedTag}/warlog`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let response;
        try {
            const fetch = (await import('node-fetch')).default;
            response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
                },
                agent: httpsAgent,
                signal: controller.signal
            });
        } catch (fetchError) {
            tripCircuitBreaker(503);
            const stale = getCachedData(cacheKey, true);
            if (stale) {
                const actualStaleData = stale.isPrivateWarLog ? stale.data : (stale.data || stale);
                if (actualStaleData) {
                    return {
                        status: 200,
                        body: actualStaleData,
                        headers: {
                            'Cache-Control': 'public, max-age=0, must-revalidate',
                            ...(stale.etag ? { 'ETag': `"${stale.etag}"` } : {})
                        }
                    };
                }
            }
            return {
                status: 503,
                body: { reason: 'inMaintenance', message: 'Clash of Clans API is currently in maintenance.' }
            };
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            setCachedData(cacheKey, data, 600);
            const cachedItem = getCachedData(cacheKey);

            return {
                status: 200,
                body: data,
                headers: {
                    'Cache-Control': 'public, max-age=600',
                    ...(cachedItem?.etag ? { 'ETag': `"${cachedItem.etag}"` } : {})
                }
            };
        } else {
            if (response.status === 403) {
                const stale = getCachedData(cacheKey, true);
                const oldData = stale ? (stale.isPrivateWarLog ? stale.data : (stale.data || stale)) : null;

                db.collection('clanMetadata').doc(cleanedTag.toUpperCase()).set({
                    tag: cleanedTag.toUpperCase(),
                    isPrivateWarLog: true,
                    updatedAt: new Date().toISOString()
                }, { merge: true }).catch(err => console.error("Error setting private war log metadata: ", err));

                setCachedData(cacheKey, { isPrivateWarLog: true, data: oldData }, 600);

                if (oldData) {
                    return {
                        status: 200,
                        body: oldData,
                        headers: { 'Cache-Control': 'public, max-age=600' }
                    };
                } else {
                    return {
                        status: 403,
                        body: { reason: 'privateWarLog', message: 'Clan war log is private' },
                        headers: { 'Cache-Control': 'public, max-age=600' }
                    };
                }
            }

            if (response.status === 503) {
                tripCircuitBreaker(503);
            }

            const stale = getCachedData(cacheKey, true);
            if (stale) {
                const actualStaleData = stale.isPrivateWarLog ? stale.data : (stale.data || stale);
                if (actualStaleData) {
                    return {
                        status: 200,
                        body: actualStaleData,
                        headers: {
                            'Cache-Control': 'public, max-age=0, must-revalidate',
                            ...(stale.etag ? { 'ETag': `"${stale.etag}"` } : {})
                        }
                    };
                }
            }

            if (response.status === 429) {
                return {
                    status: 429,
                    body: { reason: 'rateLimit', message: 'Too many requests.' },
                    headers: { 'Retry-After': response.headers.get('retry-after') || '60' }
                };
            }

            if (response.status === 503) {
                return {
                    status: 503,
                    body: { reason: 'inMaintenance', message: 'Clash of Clans API is currently in maintenance.' }
                };
            }

            let parsedError = null;
            try {
                parsedError = /** @type {any} */ (await response.json());
            } catch {
            }

            if (parsedError && typeof parsedError === 'object') {
                if (response.status === 404 && !parsedError.reason) {
                    parsedError.reason = 'notFound';
                }
                return { status: response.status, body: parsedError };
            }

            if (response.status === 404) {
                return {
                    status: 404,
                    body: { reason: 'notFound', message: 'Clan not found.' }
                };
            }

            return {
                status: response.status,
                body: { reason: 'upstreamError', message: `Upstream error HTTP ${response.status}` }
            };
        }
    } catch (error) {
        console.error(`[GET] Error in getClanWarLogInternal for ${cleanedTag}:`, error);
        return {
            status: 500,
            body: { reason: 'internalError', message: 'Internal Server Error' }
        };
    }
}

module.exports = {
    httpsAgent,
    sendStandardizedUpstreamError,
    getClanWarLogInternal
};
