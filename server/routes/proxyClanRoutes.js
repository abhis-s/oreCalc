const express = require('express');
const { isValidTag, isValidUserId } = require('../utils/validation.js');
const { db } = require('../services/firebase.js');
const { getCachedData, setCachedData, getRemainingTTL } = require('../services/cacheService.js');
const { checkCircuitBreaker, tripCircuitBreaker } = require('../services/circuitBreaker.js');
const { httpsAgent, sendStandardizedUpstreamError, getClanWarLogInternal } = require('../services/clashApiService.js');

const router = express.Router();

router.get('/clans/:clanTag', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const clanTag = req.params.clanTag;

    if (!isValidTag(clanTag)) {
        return res.status(400).json({ reason: 'invalidTag', message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const rawUserId = req.headers['x-user-id'];
    const userId = isValidUserId(rawUserId) ? rawUserId : null;

    console.log(`[GET] Fetching clan data for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    const cacheKey = `clan_${cleanedTag.toUpperCase()}`;

    if (checkCircuitBreaker()) {
        console.log(`[Circuit Breaker] Breaker is tripped. Serving cached fallback immediately for clan ${cleanedTag}`);
        const stale = getCachedData(cacheKey, true);
        if (stale) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
            return res.json(stale.data);
        }
        try {
            const doc = await db.collection('clansCache').doc(cleanedTag.toUpperCase()).get();
            if (doc.exists) {
                const snap = doc.data();
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                return res.json(snap.clanData);
            }
        } catch (dbError) {
            console.error(`[Circuit Breaker] Firestore fallback failed for clan ${cleanedTag}:`, dbError);
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
            console.log(`[Cache] ETag match. Serving 304 for clan ${cleanedTag}`);
            res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
            res.setHeader('ETag', `"${cached.etag}"`);
            return res.status(304).end();
        }

        console.log(`[Cache] Serving cached clan data for ${cleanedTag}`);
        res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
        res.setHeader('ETag', `"${cached.etag}"`);
        return res.json(cached.data);
    }

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clans/${encodedTag}`;

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
                console.warn(`[Cache] Clash API ${reason}. Serving STALE clan data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }

            try {
                const doc = await db.collection('clansCache').doc(cleanedTag.toUpperCase()).get();
                if (doc.exists) {
                    const snap = doc.data();
                    console.warn(`[Firestore Cache] Clash API ${reason}. Serving Firestore snapshot for clan ${cleanedTag}`);
                    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                    return res.json(snap.clanData);
                }
            } catch (dbError) {
                console.error(`[Firestore Cache] Failed to load snapshot for clan ${cleanedTag}:`, dbError);
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

            db.collection('clansCache').doc(cleanedTag.toUpperCase()).set({
                tag: cleanedTag.toUpperCase(),
                clanData: data,
                cachedAt: new Date().toISOString()
            }).catch(err => console.error(`[Firestore Cache] Error saving clan snapshot for ${cleanedTag}:`, err));

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
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE clan data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }

            try {
                const doc = await db.collection('clansCache').doc(cleanedTag.toUpperCase()).get();
                if (doc.exists) {
                    const snap = doc.data();
                    console.warn(`[Firestore Cache] Clash API error status ${response.status}. Serving Firestore snapshot for clan ${cleanedTag}`);
                    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                    return res.json(snap.clanData);
                }
            } catch (dbError) {
                console.error(`[Firestore Cache] Failed to load snapshot for clan ${cleanedTag}:`, dbError);
            }

            return await sendStandardizedUpstreamError(res, response, 'Clan');
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/clans/${cleanedTag}:`, error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error' });
    }
});

router.get('/clans/:clanTag/warlog', async (req, res) => {
    const clanTag = req.params.clanTag;
    if (!isValidTag(clanTag)) {
        return res.status(400).json({ reason: 'invalidTag', message: 'Invalid Clash of Clans tag format.' });
    }

    const rawUserId = typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : null;
    const userId = isValidUserId(rawUserId) ? rawUserId : null;
    const clientETag = typeof req.headers['if-none-match'] === 'string' ? req.headers['if-none-match'] : null;

    const result = await getClanWarLogInternal(clanTag, { userId, clientETag });

    if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
            res.setHeader(key, value);
        }
    }

    if (result.status === 304) {
        return res.status(304).end();
    }

    return res.status(result.status).json(result.body);
});

router.get('/clans/:clanTag/currentwar', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const clanTag = req.params.clanTag;

    if (!isValidTag(clanTag)) {
        return res.status(400).json({ reason: 'invalidTag', message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const rawUserId = req.headers['x-user-id'];
    const userId = isValidUserId(rawUserId) ? rawUserId : null;

    console.log(`[GET] Fetching current war for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    const cacheKey = `currentwar_${cleanedTag.toUpperCase()}`;

    if (checkCircuitBreaker()) {
        console.log(`[Circuit Breaker] Breaker is tripped. Serving cached fallback immediately for current war ${cleanedTag}`);
        const stale = getCachedData(cacheKey, true);
        if (stale) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
            return res.json(stale.data);
        }
        try {
            const doc = await db.collection('classicWarsCache').doc(cleanedTag.toUpperCase()).get();
            if (doc.exists) {
                const snap = doc.data();
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                return res.json(snap.warData);
            }
        } catch (dbError) {
            console.error(`[Circuit Breaker] Firestore fallback failed for current war ${cleanedTag}:`, dbError);
        }
        return res.status(503).json({
            reason: 'inMaintenance',
            message: 'Clash of Clans API is currently in maintenance. No cached snapshot found.'
        });
    }

    const cached = getCachedData(cacheKey);
    if (cached) {
        if (cached.isPrivateWarLog) {
            if (cached.data) {
                console.log(`[Cache] Private log hit. Serving cached fallback for current war ${cleanedTag}`);
                res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
                if (cached.etag) res.setHeader('ETag', `"${cached.etag}"`);
                return res.json(cached.data);
            } else {
                console.log(`[Cache] Private log hit (no fallback). Serving cached 403 for current war ${cleanedTag}`);
                res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
                return res.status(403).json({ reason: 'privateWarLog', message: 'Clan war log is private' });
            }
        }

        const clientETag = req.headers['if-none-match'];
        if (clientETag && clientETag === `"${cached.etag}"`) {
            console.log(`[Cache] ETag match. Serving 304 for current war ${cleanedTag}`);
            res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
            res.setHeader('ETag', `"${cached.etag}"`);
            return res.status(304).end();
        }

        console.log(`[Cache] Serving cached current war for ${cleanedTag}`);
        res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
        res.setHeader('ETag', `"${cached.etag}"`);
        return res.json(cached.data);
    }

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clans/${encodedTag}/currentwar`;

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
                console.warn(`[Cache] Clash API ${reason}. Serving STALE current war data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                const actualStaleData = stale.isPrivateWarLog ? stale.data : stale.data || stale;
                return res.json(actualStaleData);
            }

            try {
                const doc = await db.collection('classicWarsCache').doc(cleanedTag.toUpperCase()).get();
                if (doc.exists) {
                    const snap = doc.data();
                    console.warn(`[Firestore Cache] Clash API ${reason}. Serving Firestore snapshot for current war ${cleanedTag}`);
                    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                    return res.json(snap.warData);
                }
            } catch (dbError) {
                console.error(`[Firestore Cache] Failed to load snapshot for current war ${cleanedTag}:`, dbError);
            }

            return res.status(503).json({
                reason: 'inMaintenance',
                message: 'Clash of Clans API is currently in maintenance.'
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = /** @type {any} */ (await response.json());

            setCachedData(cacheKey, data, 600);
            const cachedItem = getCachedData(cacheKey);

            db.collection('classicWarsCache').doc(cleanedTag.toUpperCase()).set({
                tag: cleanedTag.toUpperCase(),
                warData: data,
                cachedAt: new Date().toISOString()
            }).catch(err => console.error(`[Firestore Cache] Error saving current war snapshot for ${cleanedTag}:`, err));

            if (data.state && data.state !== 'notInWar' && data.opponent) {
                const oppTag = data.opponent.tag;
                const warId = `${cleanedTag.toUpperCase()}_${oppTag.substring(1).toUpperCase()}_${data.endTime}`;
                db.collection('classicWars').doc(warId).set({
                    warId,
                    clanTag: `#${cleanedTag.toUpperCase()}`,
                    opponentTag: oppTag,
                    endTime: data.endTime,
                    state: data.state,
                    lastFetchTime: new Date().toISOString(),
                    isPrivate: false
                }).catch(err => console.error(`[Scraper] Error registering classic war for ${cleanedTag}:`, err));
            }

            res.setHeader('Cache-Control', 'public, max-age=600');
            if (cachedItem && cachedItem.etag) {
                res.setHeader('ETag', `"${cachedItem.etag}"`);
            }
            res.status(response.status).json(data);
        } else {
            if (response.status === 403) {
                db.collection('clanMetadata').doc(cleanedTag.toUpperCase()).set({
                    tag: cleanedTag.toUpperCase(),
                    isPrivateWarLog: true,
                    updatedAt: new Date().toISOString()
                }, { merge: true }).catch(err => console.error("Error setting private war log metadata: ", err));

                let fallbackData = null;
                try {
                    const doc = await db.collection('classicWarsCache').doc(cleanedTag.toUpperCase()).get();
                    if (doc.exists) {
                        fallbackData = doc.data().warData;
                    }
                } catch (dbError) {
                    console.error(`[Firestore Cache] Failed to load snapshot for current war ${cleanedTag}:`, dbError);
                }

                const cacheValue = {
                    isPrivateWarLog: true,
                    data: fallbackData
                };
                setCachedData(cacheKey, cacheValue, 600);

                if (fallbackData) {
                    console.warn(`[Cache] Clash API returned status 403. Serving Firestore fallback for current war ${cleanedTag}`);
                    res.setHeader('Cache-Control', 'public, max-age=600');
                    return res.json(fallbackData);
                } else {
                    console.warn(`[Cache] Clash API returned status 403. No fallback found for current war ${cleanedTag}`);
                    return res.status(403).json({ reason: 'privateWarLog', message: 'Clan war log is private' });
                }
            }

            if (response.status === 503) {
                tripCircuitBreaker(503);
            }

            const stale = getCachedData(cacheKey, true);
            if (stale) {
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE current war data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                const actualStaleData = stale.isPrivateWarLog ? stale.data : stale.data || stale;
                return res.json(actualStaleData);
            }

            try {
                const doc = await db.collection('classicWarsCache').doc(cleanedTag.toUpperCase()).get();
                if (doc.exists) {
                    const snap = doc.data();
                    console.warn(`[Firestore Cache] Clash API error status ${response.status}. Serving Firestore snapshot for current war ${cleanedTag}`);
                    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                    const actualStaleData = snap.warData;
                    return res.json(actualStaleData);
                }
            } catch (dbError) {
                console.error(`[Firestore Cache] Failed to load snapshot for current war ${cleanedTag}:`, dbError);
            }

            return await sendStandardizedUpstreamError(res, response, 'Current War');
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/clans/${cleanedTag}/currentwar:`, error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error' });
    }
});

module.exports = router;
