const express = require('express');
const { isValidTag, isValidUserId } = require('../utils/validation.js');
const { getCachedData, setCachedData, getRemainingTTL } = require('../services/cacheService.js');
const { checkCircuitBreaker, tripCircuitBreaker } = require('../services/circuitBreaker.js');
const { httpsAgent, sendStandardizedUpstreamError } = require('../services/clashApiService.js');
const { registerGroupWarsBackground } = require('../services/warScraperService.js');

const router = express.Router();

router.get('/clans/:clanTag/currentwar/leaguegroup', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const clanTag = req.params.clanTag;

    if (!isValidTag(clanTag)) {
        return res.status(400).json({ reason: 'invalidTag', message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const rawUserId = req.headers['x-user-id'];
    const userId = isValidUserId(rawUserId) ? rawUserId : null;

    console.log(`[GET] Fetching CWL league group for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    const cacheKey = `leaguegroup_${cleanedTag.toUpperCase()}`;

    if (checkCircuitBreaker()) {
        console.log(`[Circuit Breaker] Breaker is tripped. Serving cached fallback immediately for CWL league group ${cleanedTag}`);
        const stale = getCachedData(cacheKey, true);
        if (stale) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
            return res.json(stale.data);
        }
        return res.status(503).json({
            reason: 'inMaintenance',
            message: 'Clash of Clans API is currently in maintenance. No cached snapshot found.'
        });
    }

    const cached = getCachedData(cacheKey);

    if (cached) {
        const clientETag = req.headers['if-none-match'];
        if (clientETag && clientETag === `"${cached.etag}"`) {
            console.log(`[Cache] ETag match. Serving 304 for CWL league group ${cleanedTag}`);
            res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
            res.setHeader('ETag', `"${cached.etag}"`);
            return res.status(304).end();
        }

        console.log(`[Cache] Serving cached CWL league group for ${cleanedTag}`);
        res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
        res.setHeader('ETag', `"${cached.etag}"`);
        return res.json(cached.data);
    }

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clans/${encodedTag}/currentwar/leaguegroup`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let response;
        try {
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
            const isTimeout = fetchError.name === 'AbortError';
            const reason = isTimeout ? 'timeout' : 'fetch failed';

            if (stale) {
                console.warn(`[Cache] Clash API ${reason}. Serving STALE CWL league group for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }
            return res.status(503).json({
                reason: 'inMaintenance',
                message: 'Clash of Clans API is currently in maintenance.'
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            registerGroupWarsBackground(data).catch(err => {
                console.error("[Scraper] Error registering group wars in background:", err);
            });
            setCachedData(cacheKey, data, 600);
            const cachedItem = getCachedData(cacheKey);

            res.setHeader('Cache-Control', 'public, max-age=600');
            if (cachedItem && cachedItem.etag) {
                res.setHeader('ETag', `"${cachedItem.etag}"`);
            }
            res.status(response.status).json(data);
        } else {
            if (response.status === 503) {
                tripCircuitBreaker(503);
            }
            const stale = getCachedData(cacheKey, true);
            if (stale) {
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE CWL league group for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }
            return await sendStandardizedUpstreamError(res, response, 'CWL League Group');
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/clans/${cleanedTag}/currentwar/leaguegroup:`, error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error' });
    }
});

router.get('/clanwarleagues/wars/:warTag', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const warTag = req.params.warTag;

    if (!isValidTag(warTag)) {
        return res.status(400).json({ reason: 'invalidTag', message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = warTag.startsWith('#') ? warTag.substring(1) : warTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const rawUserId = req.headers['x-user-id'];
    const userId = isValidUserId(rawUserId) ? rawUserId : null;

    console.log(`[GET] Fetching CWL war data for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    const cacheKey = `wartag_${cleanedTag.toUpperCase()}`;

    if (checkCircuitBreaker()) {
        console.log(`[Circuit Breaker] Breaker is tripped. Serving cached fallback immediately for CWL war data ${cleanedTag}`);
        const stale = getCachedData(cacheKey, true);
        if (stale) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
            return res.json(stale.data);
        }
        return res.status(503).json({
            reason: 'inMaintenance',
            message: 'Clash of Clans API is currently in maintenance. No cached snapshot found.'
        });
    }

    const cached = getCachedData(cacheKey);

    if (cached) {
        const clientETag = req.headers['if-none-match'];
        if (clientETag && clientETag === `"${cached.etag}"`) {
            console.log(`[Cache] ETag match. Serving 304 for CWL war data ${cleanedTag}`);
            res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
            res.setHeader('ETag', `"${cached.etag}"`);
            return res.status(304).end();
        }

        console.log(`[Cache] Serving cached CWL war data for ${cleanedTag}`);
        res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
        res.setHeader('ETag', `"${cached.etag}"`);
        return res.json(cached.data);
    }

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clanwarleagues/wars/${encodedTag}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let response;
        try {
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
            const isTimeout = fetchError.name === 'AbortError';
            const reason = isTimeout ? 'timeout' : 'fetch failed';

            if (stale) {
                console.warn(`[Cache] Clash API ${reason}. Serving STALE CWL war data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }
            return res.status(503).json({
                reason: 'inMaintenance',
                message: 'Clash of Clans API is currently in maintenance.'
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            setCachedData(cacheKey, data, 600);
            const cachedItem = getCachedData(cacheKey);

            res.setHeader('Cache-Control', 'public, max-age=600');
            if (cachedItem && cachedItem.etag) {
                res.setHeader('ETag', `"${cachedItem.etag}"`);
            }
            res.status(response.status).json(data);
        } else {
            if (response.status === 503) {
                tripCircuitBreaker(503);
            }
            const stale = getCachedData(cacheKey, true);
            if (stale) {
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE CWL war data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }
            return await sendStandardizedUpstreamError(res, response, 'CWL War');
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/clanwarleagues/wars/${cleanedTag}:`, error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error' });
    }
});

module.exports = router;
