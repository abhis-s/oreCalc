const express = require('express');
const { isValidTag, isValidUserId } = require('../utils/validation.js');
const { admin, db } = require('../services/firebase.js');
const { getCachedData, setCachedData, getRemainingTTL } = require('../services/cacheService.js');
const { checkCircuitBreaker, tripCircuitBreaker } = require('../services/circuitBreaker.js');
const { httpsAgent, sendStandardizedUpstreamError } = require('../services/clashApiService.js');

const router = express.Router();

router.get('/players/:playerTag', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const playerTag = req.params.playerTag;

    if (!isValidTag(playerTag)) {
        return res.status(400).json({ reason: 'invalidTag', message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = playerTag.startsWith('#') ? playerTag.substring(1) : playerTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const token = req.headers['x-verify-token'];
    const rawUserId = req.headers['x-user-id'];
    const userId = isValidUserId(rawUserId) ? rawUserId : null;

    console.log(`[GET] Fetching data for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    try {
        const protectedDoc = await db.collection('excludedTags').doc(cleanedTag).get();

        if (protectedDoc.exists) {
            const protectedData = protectedDoc.data();
            const verifiedUuids = protectedData.verifiedUuids || [];

            // Check if this user is already authorized via UUID
            const isAuthorized = userId && verifiedUuids.includes(userId);

            if (isAuthorized) {
                console.log(`[GET] Tag ${cleanedTag} access authorized via UUID: ${userId}`);
            } else {
                console.log(`[GET] Tag ${cleanedTag} is protected. Authorization check failed.`);

                if (!token) {
                    return res.status(403).json({
                        reason: 'protectedTag',
                        message: 'This account is protected and requires verification to be added.'
                    });
                }

                const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
                const verifyUrl = `${baseUrl}/players/${encodedTag}/verifytoken`;

                const verifyResponse = await fetch(verifyUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token })
                });

                const verifyData = /** @type {any} */ (await verifyResponse.json());

                if (!verifyResponse.ok || verifyData.status !== 'ok') {
                    return res.status(403).json({
                        reason: 'invalidToken',
                        message: 'Verification failed. Invalid token.'
                    });
                }

                console.log(`[GET] Verification successful for protected tag ${cleanedTag}.`);

                if (userId) {
                    await db.collection('excludedTags').doc(cleanedTag).update({
                        verifiedUuids: admin.firestore.FieldValue.arrayUnion(userId),
                        lastVerifiedAt: new Date().toISOString()
                    });
                    console.log(`[GET] Added UUID ${userId} to verified list for ${cleanedTag}`);
                }
            }
        }

        const cacheKey = `player_${cleanedTag.toUpperCase()}`;

        if (checkCircuitBreaker()) {
            console.log(`[Circuit Breaker] Breaker is tripped. Serving cached fallback immediately for player ${cleanedTag}`);
            const stale = getCachedData(cacheKey, true);
            if (stale) {
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }
            try {
                const doc = await db.collection('playersCache').doc(cleanedTag.toUpperCase()).get();
                if (doc.exists) {
                    const snap = doc.data();
                    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                    return res.json(snap.playerData);
                }
            } catch (dbError) {
                console.error(`[Circuit Breaker] Firestore fallback failed for player ${cleanedTag}:`, dbError);
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
                console.log(`[Cache] ETag match. Serving 304 for player ${cleanedTag}`);
                res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
                res.setHeader('ETag', `"${cached.etag}"`);
                return res.status(304).end();
            }

            console.log(`[Cache] Serving cached player data for ${cleanedTag}`);
            res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
            res.setHeader('ETag', `"${cached.etag}"`);
            return res.json(cached.data);
        }

        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/players/${encodedTag}`;

        console.log(`[GET] Proceeding to fetch player data from: ${url}`);

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
                console.warn(`[Cache] Clash API ${reason}. Serving STALE player data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }

            try {
                const doc = await db.collection('playersCache').doc(cleanedTag.toUpperCase()).get();
                if (doc.exists) {
                    const snap = doc.data();
                    console.warn(`[Firestore Cache] Clash API ${reason}. Serving Firestore snapshot for player ${cleanedTag}`);
                    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                    return res.json(snap.playerData);
                }
            } catch (dbError) {
                console.error(`[Firestore Cache] Failed to load snapshot for player ${cleanedTag}:`, dbError);
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
            setCachedData(cacheKey, data, 60);
            const cachedItem = getCachedData(cacheKey);

            db.collection('playersCache').doc(cleanedTag.toUpperCase()).set({
                tag: cleanedTag.toUpperCase(),
                playerData: data,
                cachedAt: new Date().toISOString()
            }).catch(err => console.error(`[Firestore Cache] Error saving player snapshot for ${cleanedTag}:`, err));

            res.setHeader('Cache-Control', 'public, max-age=60');
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
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE player data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }

            try {
                const doc = await db.collection('playersCache').doc(cleanedTag.toUpperCase()).get();
                if (doc.exists) {
                    const snap = doc.data();
                    console.warn(`[Firestore Cache] Clash API error status ${response.status}. Serving Firestore snapshot for player ${cleanedTag}`);
                    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                    return res.json(snap.playerData);
                }
            } catch (dbError) {
                console.error(`[Firestore Cache] Failed to load snapshot for player ${cleanedTag}:`, dbError);
            }

            return await sendStandardizedUpstreamError(res, response, 'Player');
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/players/${cleanedTag}:`, error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error' });
    }
});

module.exports = router;
