const express = require('express');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');
const helmet = require('helmet');
const compression = require('compression');
const crypto = require('crypto');
const https = require('https');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

if (!process.env.FIRESTORE_SA_KEY) {
    console.error("Error: FIRESTORE_SA_KEY environment variable is not set.");
    process.exit(1);
}

let serviceAccount;
try {
    console.log("Attempting to parse FIRESTORE_SA_KEY. Length:", process.env.FIRESTORE_SA_KEY.length);
    serviceAccount = JSON.parse(process.env.FIRESTORE_SA_KEY);
} catch (parseError) {
    console.error("Error parsing FIRESTORE_SA_KEY JSON:", parseError.message);
    console.error("Please ensure the secret content is valid JSON.");
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function isUserDeleted(userId) {
    if (!userId) return false;
    const doc = await db.collection('deletedUuids').doc(userId).get();
    return doc.exists;
}

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

// Enable security headers with Helmet
app.use(helmet());
app.use(compression());

// General Rate Limiter (500 requests per 15 minutes)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(generalLimiter);

// Stricter Rate Limiter for sensitive/destructive operations (5 requests per hour)
const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many destructive operations from this IP, please try again after an hour.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Rate Limiter for Clash of Clans API proxy requests (250 requests per 15 minutes)
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 250,
    message: 'Too many player fetch requests from this IP, please try again after 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Configure restricted CORS origin
const allowedOrigins = [
    'https://orecalc.tech',
    'https://www.orecalc.tech',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8081',
    'http://127.0.0.1:8081'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-verify-token', 'x-user-id'],
    exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset']
}));

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 64,
    keepAliveMsecs: 30000,
    timeout: 60000
});

const memoryCache = new Map();

function generateETag(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('md5').update(str).digest('hex');
}

function getCachedData(key, allowExpired = false) {
    const item = memoryCache.get(key);
    if (!item) return null;
    const isExpired = Date.now() > item.expiresAt;
    if (isExpired && !allowExpired) {
        memoryCache.delete(key);
        return null;
    }
    return { data: item.data, etag: item.etag, isExpired };
}

function getRemainingTTL(key) {
    const item = memoryCache.get(key);
    if (!item) return 0;
    const remaining = Math.round((item.expiresAt - Date.now()) / 1000);
    return Math.max(0, remaining);
}

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

const clashApiStatus = {
    isOffline: false,
    trippedAt: 0,
    tripDurationMs: 5 * 60 * 1000 // 5 minutes
};

function checkCircuitBreaker() {
    if (clashApiStatus.isOffline) {
        const elapsed = Date.now() - clashApiStatus.trippedAt;
        if (elapsed > clashApiStatus.tripDurationMs) {
            clashApiStatus.isOffline = false;
            console.log("[Circuit Breaker] Resetting Clash API breaker. Retrying live fetches.");
            return false;
        }
        return true;
    }
    return false;
}

function tripCircuitBreaker(statusCode = 503) {
    clashApiStatus.isOffline = true;
    clashApiStatus.trippedAt = Date.now();
    console.warn(`[Circuit Breaker] Tripped due to HTTP ${statusCode}. Offline mode active for 5 minutes.`);
}

function isValidTag(tag) {
    if (!tag) return false;
    const cleaned = tag.startsWith('#') ? tag.substring(1) : tag;
    const cocTagRegex = /^[0289CGJLPQRUVY]{3,14}$/i;
    return cocTagRegex.test(cleaned);
}

app.use(express.json());

app.get('/proxy/players/:playerTag', proxyLimiter, async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const playerTag = req.params.playerTag;

    if (!isValidTag(playerTag)) {
        return res.status(400).json({ message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = playerTag.startsWith('#') ? playerTag.substring(1) : playerTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const token = req.headers['x-verify-token'];
    const userId = req.headers['x-user-id'];

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

                // If not authorized by UUID, we MUST have a token
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

                const verifyData = await verifyResponse.json();

                if (!verifyResponse.ok || verifyData.status !== 'ok') {
                    return res.status(403).json({
                        reason: 'invalidToken',
                        message: 'Verification failed. Invalid token.'
                    });
                }

                console.log(`[GET] Verification successful for protected tag ${cleanedTag}.`);

                // SUCCESS: If we have a userId, add it to the verified list so they don't have to verify again
                if (userId) {
                    await db.collection('excludedTags').doc(cleanedTag).update({
                        verifiedUuids: admin.firestore.FieldValue.arrayUnion(userId),
                        lastVerifiedAt: new Date().toISOString()
                    });
                    console.log(`[GET] Added UUID ${userId} to verified list for ${cleanedTag}`);
                }
            }
        }

        // If not protected OR token was valid, proceed to fetch data
        const cacheKey = `player_${cleanedTag.toUpperCase()}`;

        // Check circuit breaker first
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
            tripCircuitBreaker(503); // Trip the breaker
            const stale = getCachedData(cacheKey, true);
            const isTimeout = fetchError.name === 'AbortError';
            const reason = isTimeout ? 'timeout' : 'fetch failed';

            if (stale) {
                console.warn(`[Cache] Clash API ${reason}. Serving STALE player data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }

            // Fallback to Firestore cache snapshot
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

            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            setCachedData(cacheKey, data, 60); // Cache for 60 seconds
            const cachedItem = getCachedData(cacheKey);

            // Write to Firestore snapshot cache in the background (asynchronously)
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
                tripCircuitBreaker(503); // Trip the breaker on 503 maintenance
            }
            const stale = getCachedData(cacheKey, true);
            if (stale) {
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE player data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }

            // Fallback to Firestore cache snapshot
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

            const text = await response.text();
            res.status(response.status).send(text);
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/players/${cleanedTag}:`, error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/proxy/clans/:clanTag', proxyLimiter, async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const clanTag = req.params.clanTag;

    if (!isValidTag(clanTag)) {
        return res.status(400).json({ message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const userId = req.headers['x-user-id'];

    console.log(`[GET] Fetching clan data for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    const cacheKey = `clan_${cleanedTag.toUpperCase()}`;

    // Check circuit breaker first
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
            tripCircuitBreaker(503); // Trip the breaker
            const stale = getCachedData(cacheKey, true);
            const isTimeout = fetchError.name === 'AbortError';
            const reason = isTimeout ? 'timeout' : 'fetch failed';

            if (stale) {
                console.warn(`[Cache] Clash API ${reason}. Serving STALE clan data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }

            // Fallback to Firestore cache snapshot
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

            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            setCachedData(cacheKey, data, 600); // Cache for 10 minutes (600s)
            const cachedItem = getCachedData(cacheKey);

            // Write to Firestore snapshot cache in the background (asynchronously)
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
                tripCircuitBreaker(503); // Trip the breaker on 503 maintenance
            }
            const stale = getCachedData(cacheKey, true);
            if (stale) {
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE clan data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }

            // Fallback to Firestore cache snapshot
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

            const text = await response.text();
            res.status(response.status).send(text);
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/clans/${cleanedTag}:`, error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/proxy/clans/:clanTag/warlog', proxyLimiter, async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const clanTag = req.params.clanTag;

    if (!isValidTag(clanTag)) {
        return res.status(400).json({ message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const userId = req.headers['x-user-id'];

    console.log(`[GET] Fetching war log for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    const cacheKey = `warlog_${cleanedTag.toUpperCase()}`;

    // Check circuit breaker first
    if (checkCircuitBreaker()) {
        console.log(`[Circuit Breaker] Breaker is tripped. Serving cached fallback immediately for war log ${cleanedTag}`);
        const stale = getCachedData(cacheKey, true);
        if (stale) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
            return res.json(stale.data);
        }
        return res.status(503).json({
            message: 'Clash of Clans API is currently in maintenance. No cached snapshot found.'
        });
    }

    const cached = getCachedData(cacheKey);
    
    if (cached) {
        if (cached.isPrivateWarLog) {
            if (cached.data) {
                console.log(`[Cache] Private log hit. Serving cached fallback for war log ${cleanedTag}`);
                res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
                if (cached.etag) res.setHeader('ETag', `"${cached.etag}"`);
                return res.json(cached.data);
            } else {
                console.log(`[Cache] Private log hit (no fallback). Serving cached 403 for war log ${cleanedTag}`);
                res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
                return res.status(403).json({ message: 'Clan war log is private' });
            }
        }

        const clientETag = req.headers['if-none-match'];
        if (clientETag && clientETag === `"${cached.etag}"`) {
            console.log(`[Cache] ETag match. Serving 304 for war log ${cleanedTag}`);
            res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
            res.setHeader('ETag', `"${cached.etag}"`);
            return res.status(304).end();
        }

        console.log(`[Cache] Serving cached war log for ${cleanedTag}`);
        res.setHeader('Cache-Control', `public, max-age=${getRemainingTTL(cacheKey)}`);
        res.setHeader('ETag', `"${cached.etag}"`);
        return res.json(cached.data);
    }

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clans/${encodedTag}/warlog`;

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
            tripCircuitBreaker(503); // Trip the breaker
            const stale = getCachedData(cacheKey, true);
            const isTimeout = fetchError.name === 'AbortError';
            const reason = isTimeout ? 'timeout' : 'fetch failed';

            if (stale) {
                console.warn(`[Cache] Clash API ${reason}. Serving STALE war log for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                const actualStaleData = stale.isPrivateWarLog ? stale.data : stale.data || stale;
                return res.json(actualStaleData);
            }
            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            setCachedData(cacheKey, data, 600); // Cache for 10 minutes (600s)
            const cachedItem = getCachedData(cacheKey);

            res.setHeader('Cache-Control', 'public, max-age=600');
            if (cachedItem && cachedItem.etag) {
                res.setHeader('ETag', `"${cachedItem.etag}"`);
            }
            res.status(response.status).json(data);
        } else {
            if (response.status === 403) {
                // Get the old stale cache before we overwrite it
                const stale = getCachedData(cacheKey, true);
                const oldData = stale ? (stale.isPrivateWarLog ? stale.data : stale.data || stale) : null;

                // Mark clan's war log as private in firestore metadata
                db.collection('clanMetadata').doc(cleanedTag.toUpperCase()).set({
                    tag: cleanedTag.toUpperCase(),
                    isPrivateWarLog: true,
                    updatedAt: new Date().toISOString()
                }, { merge: true }).catch(err => console.error("Error setting private war log metadata: ", err));

                // Cache the 403 state with oldData in memory for 10 minutes (600s)
                const cacheValue = {
                    isPrivateWarLog: true,
                    data: oldData
                };
                setCachedData(cacheKey, cacheValue, 600);

                if (oldData) {
                    console.warn(`[Cache] Clash API returned status 403. Serving STALE war log for ${cleanedTag}`);
                    res.setHeader('Cache-Control', 'public, max-age=600');
                    return res.json(oldData);
                } else {
                    console.warn(`[Cache] Clash API returned status 403. No fallback found for war log ${cleanedTag}`);
                    return res.status(403).json({ message: 'Clan war log is private' });
                }
            }

            if (response.status === 503) {
                tripCircuitBreaker(503); // Trip breaker
            }
            const stale = getCachedData(cacheKey, true);
            if (stale) {
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE war log for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                const actualStaleData = stale.isPrivateWarLog ? stale.data : stale.data || stale;
                return res.json(actualStaleData);
            }
            const text = await response.text();
            res.status(response.status).send(text);
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/clans/${cleanedTag}/warlog:`, error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/proxy/clans/:clanTag/currentwar/leaguegroup', proxyLimiter, async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const clanTag = req.params.clanTag;

    if (!isValidTag(clanTag)) {
        return res.status(400).json({ message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const userId = req.headers['x-user-id'];

    console.log(`[GET] Fetching CWL league group for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    const cacheKey = `leaguegroup_${cleanedTag.toUpperCase()}`;

    // Check circuit breaker first
    if (checkCircuitBreaker()) {
        console.log(`[Circuit Breaker] Breaker is tripped. Serving cached fallback immediately for CWL league group ${cleanedTag}`);
        const stale = getCachedData(cacheKey, true);
        if (stale) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
            return res.json(stale.data);
        }
        return res.status(503).json({
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
            tripCircuitBreaker(503); // Trip the breaker
            const stale = getCachedData(cacheKey, true);
            const isTimeout = fetchError.name === 'AbortError';
            const reason = isTimeout ? 'timeout' : 'fetch failed';

            if (stale) {
                console.warn(`[Cache] Clash API ${reason}. Serving STALE CWL league group for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }
            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            registerGroupWarsBackground(data).catch(err => {
                console.error("[Scraper] Error registering group wars in background:", err);
            });
            setCachedData(cacheKey, data, 600); // Cache for 10 minutes (600s)
            const cachedItem = getCachedData(cacheKey);

            res.setHeader('Cache-Control', 'public, max-age=600');
            if (cachedItem && cachedItem.etag) {
                res.setHeader('ETag', `"${cachedItem.etag}"`);
            }
            res.status(response.status).json(data);
        } else {
            if (response.status === 503) {
                tripCircuitBreaker(503); // Trip breaker
            }
            const stale = getCachedData(cacheKey, true);
            if (stale) {
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE CWL league group for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }
            const text = await response.text();
            res.status(response.status).send(text);
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/clans/${cleanedTag}/currentwar/leaguegroup:`, error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/proxy/clanwarleagues/wars/:warTag', proxyLimiter, async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const warTag = req.params.warTag;

    if (!isValidTag(warTag)) {
        return res.status(400).json({ message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = warTag.startsWith('#') ? warTag.substring(1) : warTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const userId = req.headers['x-user-id'];

    console.log(`[GET] Fetching CWL war data for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    const cacheKey = `wartag_${cleanedTag.toUpperCase()}`;

    // Check circuit breaker first
    if (checkCircuitBreaker()) {
        console.log(`[Circuit Breaker] Breaker is tripped. Serving cached fallback immediately for CWL war data ${cleanedTag}`);
        const stale = getCachedData(cacheKey, true);
        if (stale) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
            if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
            return res.json(stale.data);
        }
        return res.status(503).json({
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
            tripCircuitBreaker(503); // Trip the breaker
            const stale = getCachedData(cacheKey, true);
            const isTimeout = fetchError.name === 'AbortError';
            const reason = isTimeout ? 'timeout' : 'fetch failed';

            if (stale) {
                console.warn(`[Cache] Clash API ${reason}. Serving STALE CWL war data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }
            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            setCachedData(cacheKey, data, 600); // Cache for 10 minutes (600s)
            const cachedItem = getCachedData(cacheKey);

            res.setHeader('Cache-Control', 'public, max-age=600');
            if (cachedItem && cachedItem.etag) {
                res.setHeader('ETag', `"${cachedItem.etag}"`);
            }
            res.status(response.status).json(data);
        } else {
            if (response.status === 503) {
                tripCircuitBreaker(503); // Trip breaker
            }
            const stale = getCachedData(cacheKey, true);
            if (stale) {
                console.warn(`[Cache] Clash API returned status ${response.status}. Serving STALE CWL war data for ${cleanedTag}`);
                res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                if (stale.etag) res.setHeader('ETag', `"${stale.etag}"`);
                return res.json(stale.data);
            }
            const text = await response.text();
            res.status(response.status).send(text);
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/clanwarleagues/wars/${cleanedTag}:`, error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


app.post('/api/user-data/save', async (req, res) => {
    const { userId, data } = req.body;

    if (!userId || !data) {
        return res.status(400).json({ message: 'userId and data are required.' });
    }

    try {
        if (await isUserDeleted(userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        // Prevent older clients from overwriting newer version data in Firestore
        const doc = await db.collection('userStates').doc(userId).get();
        if (doc.exists) {
            const existingData = doc.data();
            const existingVersion = existingData.appVersion || '1.0.0';
            if (existingVersion.startsWith('2')) {
                const clientVersion = req.headers['x-app-version'] || '';
                if (!clientVersion.startsWith('2')) {
                    return res.status(426).json({ 
                        reason: 'versionMismatch', 
                        message: 'A newer version of the application is required to save to this account. Please reload or update the application.' 
                    });
                }
            }
        }

        await db.collection('userStates').doc(userId).set(data);
        res.status(200).json({ message: 'Data saved successfully.' });
    } catch (error) {
        console.error('Error saving user data:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

app.get('/api/user-data/load/:userId', async (req, res) => {
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ message: 'userId is required.' });
    }

    try {
        if (await isUserDeleted(userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }
        const doc = await db.collection('userStates').doc(userId).get();
        if (!doc.exists) {
            return res.status(404).json({ message: 'User data not found.' });
        }

        const data = doc.data();
        const clientVersion = req.headers['x-app-version'] || '';

        // Backward compatibility shim: if client is older than v2, convert currency object to string to prevent crashes on startup
        if (!clientVersion.startsWith('2')) {
            if (data.uiSettings && typeof data.uiSettings.currency === 'object' && data.uiSettings.currency !== null) {
                data.uiSettings.currency = data.uiSettings.currency.code || 'USD';
            }
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Error loading user data:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

// Stricter rate limits applied to player deletion
app.delete('/api/user-data/delete/:userId', sensitiveLimiter, async (req, res) => {
    const userId = req.params.userId;

    if (!userId) {
        return res.status(400).json({ message: 'userId is required.' });
    }

    try {
        // 1. Delete user data
        await db.collection('userStates').doc(userId).delete();

        // 2. Lock user ID in deletedUuids collection
        await db.collection('deletedUuids').doc(userId).set({
            deletedAt: new Date().toISOString()
        });

        // 3. Send email notification if SMTP is configured
        let emailSent = false;
        if (process.env.SMTP_USER && process.env.SMTP_HOST) {
            try {
                const nodemailer = require('nodemailer');
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '587', 10),
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });

                const mailOptions = {
                    from: `"ClashCalc System" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
                    to: process.env.RECIPIENT_EMAIL_LEGAL || 'legal@clashcalc.com',
                    subject: `[ClashCalc] Account Deletion Request - ${userId}`,
                    text: `Hello,\n\nA user has requested permanent deletion of their account.\n\nDetails:\n- User ID: ${userId}\n- Time: ${new Date().toISOString()}\n\nThe user ID has been deleted from userStates and locked in the deletedUuids database.\n\nRegards,\nClashCalc System`
                };

                await transporter.sendMail(mailOptions);
                emailSent = true;
                console.log(`[DELETION] Notification email sent successfully for UserID: ${userId}`);
            } catch (mailError) {
                console.error(`[DELETION] Failed to send notification email:`, mailError);
            }
        }

        res.status(200).json({ message: 'Data deleted and user ID locked successfully.', emailSent });
    } catch (error) {
        console.error('Error deleting user data:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

// Stricter rate limits applied to global erasure
app.post('/api/user-data/erase-tag', sensitiveLimiter, async (req, res) => {
    return res.status(403).json({
        reason: 'featureDisabled',
        message: 'This feature has been deactivated.'
    });

    const fetch = (await import('node-fetch')).default;
    const { playerTag, token } = req.body;
    const userId = req.headers['x-user-id']; // Optional, but good to have

    if (!playerTag || !token) {
        return res.status(400).json({ message: 'playerTag and token are required.' });
    }

    const cleanedTag = playerTag.startsWith('#') ? playerTag.substring(1) : playerTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);

    try {
        // MANDATORY: Verify token before allowing global erasure and protection
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const verifyUrl = `${baseUrl}/players/${encodedTag}/verifytoken`;

        console.log(`[ERASE REQUEST] Verifying token for ${cleanedTag} before queueing request...`);

        const verifyResponse = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const verifyData = await verifyResponse.json();

        if (!verifyResponse.ok || verifyData.status !== 'ok') {
            console.error(`[ERASE REQUEST] Verification failed for ${cleanedTag}. HTTP: ${verifyResponse.status}`);
            return res.status(403).json({
                reason: 'invalidToken',
                message: 'Global protection failed. Invalid player token provided.'
            });
        }

        console.log(`[ERASE REQUEST] Verification successful. Creating erasure request for tag ${cleanedTag}.`);

        const requestData = {
            playerTag: cleanedTag,
            token: token,
            userId: userId || 'unknown',
            requestedAt: new Date().toISOString(),
            status: 'pending'
        };

        // Save to Firestore deletionRequests collection
        await db.collection('deletionRequests').add(requestData);

        // Instantly lock down the tag (add to excludedTags)
        const protectionData = {
            erasedAt: new Date().toISOString(),
            status: 'protected',
            verifiedAt: new Date().toISOString()
        };

        if (userId) {
            protectionData.verifiedUuids = admin.firestore.FieldValue.arrayUnion(userId);
        }

        await db.collection('excludedTags').doc(cleanedTag).set(protectionData, { merge: true });

        // Delete the requester's own cloud data and block their UUID permanently
        if (userId) {
            await db.collection('userStates').doc(userId).delete();
            await db.collection('deletedUuids').doc(userId).set({
                deletedAt: new Date().toISOString()
            });
            console.log(`[ERASE REQUEST] Deleted user data and marked UUID ${userId} as deleted.`);
        }

        // Dispatches email notification if SMTP variables are set in environment
        let emailSent = false;
        if (process.env.SMTP_USER && process.env.SMTP_HOST) {
            try {
                const nodemailer = require('nodemailer');
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '587', 10),
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });

                const mailOptions = {
                    from: `"ClashCalc System" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
                    to: process.env.RECIPIENT_EMAIL_LEGAL || 'legal@clashcalc.com',
                    subject: `[ClashCalc] Exclusion from Service Request - #${cleanedTag}`,
                    text: `Hello,\n\nA new exclusion from service request has been submitted.\n\nDetails:\n- Player Tag: #${cleanedTag}\n- Verification Token: ${token}\n- User ID: ${userId || 'unknown'}\n- Time: ${requestData.requestedAt}\n\nPlease verify and process this request manually in Firestore or CoC systems.\n\nRegards,\nClashCalc System`
                };

                await transporter.sendMail(mailOptions);
                emailSent = true;
                console.log(`[ERASE REQUEST] Notification email sent successfully.`);
            } catch (mailError) {
                console.error(`[ERASE REQUEST] Failed to send notification email:`, mailError);
            }
        } else {
            console.log(`[ERASE REQUEST] SMTP not configured. Skipping email dispatch.`);
        }

        res.status(200).json({
            message: `Exclusion from service request successfully queued. Our administrators will process it within 30 days.`,
            emailSent
        });
    } catch (error) {
        console.error('Error handling tag erasure request:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

app.post('/api/support/bug-report', sensitiveLimiter, async (req, res) => {
    const { email, description, attachData, userId } = req.body;

    if (!description || description.trim().length < 20) {
        return res.status(400).json({ message: 'Description must be at least 20 characters long.' });
    }

    try {
        const reportData = {
            description: description.substring(0, 1000),
            email: email ? email.substring(0, 100) : '',
            userId: userId || 'unknown',
            reportedAt: new Date().toISOString(),
            status: 'new'
        };

        if (attachData) {
            reportData.attachedState = attachData;
        }

        const docRef = await db.collection('bugReports').add(reportData);
        console.log(`[BUG REPORT] Saved report ${docRef.id} for UserID: ${userId || 'unknown'}`);

        let emailSent = false;
        if (process.env.SMTP_USER && process.env.SMTP_HOST) {
            try {
                const nodemailer = require('nodemailer');
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST,
                    port: parseInt(process.env.SMTP_PORT || '587', 10),
                    secure: process.env.SMTP_SECURE === 'true',
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });

                const attachments = [];
                if (attachData) {
                    attachments.push({
                        filename: `user-data-${userId || 'unknown'}.json`,
                        content: JSON.stringify(attachData, null, 2),
                        contentType: 'application/json'
                    });
                }

                const mailOptions = {
                    from: `"ClashCalc System" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
                    to: process.env.RECIPIENT_EMAIL_SUPPORT || 'support@clashcalc.com',
                    subject: `[OreCalc] Bug Report - ${docRef.id} (${userId || 'unknown'})`,
                    text: `Hello,\n\nA new bug report has been submitted.\n\nDetails:\n- Report ID: ${docRef.id}\n- User ID: ${userId || 'unknown'}\n- Contact Email: ${email || 'none'}\n- Date: ${reportData.reportedAt}\n\nDescription:\n${description}\n\n${attachData ? 'User data is attached to this email.' : 'No user data was attached.'}\n\nRegards,\nOreCalc Support System`,
                    attachments
                };

                if (email) {
                    mailOptions.replyTo = email;
                }

                await transporter.sendMail(mailOptions);
                emailSent = true;
                console.log(`[BUG REPORT] Support email notification sent successfully.`);
            } catch (mailError) {
                console.error(`[BUG REPORT] Failed to send support email:`, mailError);
            }
        }

        res.status(200).json({
            message: 'Bug report submitted successfully.',
            reportId: docRef.id,
            emailSent
        });
    } catch (error) {
        console.error('Error handling bug report submission:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

app.get('/api/version', (req, res) => {
    if (req.query.v === '2') {
        res.json({ currentAppVersion: '2.0.0' });
    } else {
        res.json({ currentAppVersion: '1.3.0' });
    }
});

app.get('/api/check-ip', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    try {
        const response = await fetch('https://icanhazip.com');
        const ip = await response.text();
        res.status(200).send(ip.trim());
    } catch (error) {
        console.error('Error checking egress IP:', error);
        res.status(500).json({ message: 'Failed to check egress IP', error: error.message });
    }
});

// Schedule automatic periodic pruning of inactive user sync data (runs every 7 days)
const { pruneInactiveUsers } = require('./scripts/prune-inactive-users.js');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
setTimeout(() => {
    pruneInactiveUsers().catch(err => console.error('[SCHEDULED PRUNE] Initial run failed:', err));
    
    setInterval(() => {
        pruneInactiveUsers().catch(err => console.error('[SCHEDULED PRUNE] Run failed:', err));
    }, SEVEN_DAYS_MS);
}, 60 * 1000); // 1 minute startup delay

function parseCocDate(cocDateStr) {
    if (!cocDateStr || cocDateStr.length < 15) return null;
    const year = cocDateStr.substring(0, 4);
    const month = cocDateStr.substring(4, 6);
    const day = cocDateStr.substring(6, 8);
    const hours = cocDateStr.substring(9, 11);
    const minutes = cocDateStr.substring(11, 13);
    const seconds = cocDateStr.substring(13, 15);
    
    let msPart = ".000Z";
    if (cocDateStr.includes('.')) {
        msPart = cocDateStr.substring(cocDateStr.indexOf('.'));
    }
    
    return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}${msPart}`);
}

async function fetchWarFromApi(warTag) {
    const fetch = (await import('node-fetch')).default;
    const cleanedTag = warTag.startsWith('#') ? warTag.substring(1) : warTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
    const url = `${baseUrl}/clanwarleagues/wars/${encodedTag}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
        },
        agent: httpsAgent
    });
    if (!response.ok) {
        throw new Error(`CoC API status ${response.status}`);
    }
    return await response.json();
}

async function fetchClassicWarFromApi(clanTag) {
    const fetch = (await import('node-fetch')).default;
    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
    const url = `${baseUrl}/clans/${encodedTag}/currentwar`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
        },
        agent: httpsAgent
    });
    if (!response.ok) {
        throw new Error(`CoC API status ${response.status}`);
    }
    return await response.json();
}

async function recordWarResult(warData) {
    if (!warData || !warData.clan || !warData.opponent) return;
    const clanTag = warData.clan.tag.toUpperCase();
    const opponentTag = warData.opponent.tag.toUpperCase();
    const endTime = warData.endTime;
    const teamSize = warData.teamSize || 15;

    const clanStars = warData.clan.stars || 0;
    const clanDestruction = warData.clan.destructionPercentage || 0;
    const oppStars = warData.opponent.stars || 0;
    const oppDestruction = warData.opponent.destructionPercentage || 0;

    let clanResult = 'tie';
    let oppResult = 'tie';

    if (clanStars > oppStars) {
        clanResult = 'win';
        oppResult = 'lose';
    } else if (clanStars < oppStars) {
        clanResult = 'lose';
        oppResult = 'win';
    } else {
        if (clanDestruction > oppDestruction) {
            clanResult = 'win';
            oppResult = 'lose';
        } else if (clanDestruction < oppDestruction) {
            clanResult = 'lose';
            oppResult = 'win';
        }
    }

    const logId = `${clanTag.substring(1)}_${opponentTag.substring(1)}_${endTime}`;
    
    // Save for our clan
    await db.collection('clanWarLogs').doc(`${clanTag.substring(1)}_${logId}`).set({
        clanTag,
        opponentTag,
        result: clanResult,
        endTime,
        teamSize,
        stars: clanStars,
        destructionPercentage: clanDestruction,
        opponent: {
            tag: opponentTag,
            name: warData.opponent.name || '',
            stars: oppStars,
            destructionPercentage: oppDestruction
        },
        recordedAt: new Date().toISOString()
    }).catch(err => console.error("[Scraper] Error saving war log entry for clan: ", err));

    // Save for opponent clan
    await db.collection('clanWarLogs').doc(`${opponentTag.substring(1)}_${logId}`).set({
        clanTag: opponentTag,
        opponentTag: clanTag,
        result: oppResult,
        endTime,
        teamSize,
        stars: oppStars,
        destructionPercentage: oppDestruction,
        opponent: {
            tag: clanTag,
            name: warData.clan.name || '',
            stars: clanStars,
            destructionPercentage: clanDestruction
        },
        recordedAt: new Date().toISOString()
    }).catch(err => console.error("[Scraper] Error saving war log entry for opponent: ", err));
}

async function registerGroupWarsBackground(groupData) {
    if (!groupData || !groupData.rounds || !groupData.season) return;
    
    const warTags = [];
    for (const round of groupData.rounds) {
        if (round.warTags) {
            for (const tag of round.warTags) {
                if (tag && tag !== '#NoWar') {
                    warTags.push(tag);
                }
            }
        }
    }
    
    if (warTags.length === 0) return;
    
    const season = groupData.season;
    
    for (const tag of warTags) {
        try {
            const docRef = db.collection('cwlWars').doc(tag);
            const doc = await docRef.get();
            
            if (!doc.exists) {
                console.log(`[Scraper] Initial register for war tag ${tag}`);
                const war = await fetchWarFromApi(tag);
                
                if (war) {
                    const clanTag = war.clan?.tag || '';
                    const opponentTag = war.opponent?.tag || '';
                    const parsedEndTime = parseCocDate(war.endTime);
                    
                    await docRef.set({
                        warTag: tag,
                        season: season,
                        clanTag: clanTag,
                        opponentTag: opponentTag,
                        state: war.state || 'preparation',
                        startTime: war.startTime || '',
                        endTime: war.endTime || '',
                        endTimestamp: parsedEndTime ? admin.firestore.Timestamp.fromDate(parsedEndTime) : null,
                        lastFetchTime: new Date().toISOString(),
                        warData: war
                    });

                    // If already completed on initial register, log it
                    if ((war.state || 'warEnded') === 'warEnded') {
                        await recordWarResult(war);
                    }
                }
            }
        } catch (err) {
            console.error(`[Scraper] Failed to register/update war ${tag}:`, err.message);
        }
    }
}

function startCwlBackgroundScraper() {
    console.log("[Scraper] Starting background scraper (1-hour interval)");
    
    setInterval(async () => {
        try {
            const now = new Date();
            console.log(`[Scraper] Running periodic war fetch checks at ${now.toISOString()}`);
            
            // 1. Prune old CWL wars (90 days)
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            
            const oldWarsSnapshot = await db.collection('cwlWars')
                .where('endTimestamp', '<', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
                .get();
                
            for (const oldDoc of oldWarsSnapshot.docs) {
                await oldDoc.ref.delete();
                console.log(`[Scraper] Pruned old war document: ${oldDoc.id}`);
            }
            
            // 2. Fetch/update in-progress CWL wars whose scheduled endTime has passed
            const snapshot = await db.collection('cwlWars')
                .where('state', '!=', 'warEnded')
                .get();
                
            for (const doc of snapshot.docs) {
                const war = doc.data();
                const endTime = parseCocDate(war.endTime);
                if (!endTime) continue;
                
                // Only check after war has ended
                if (now.getTime() >= endTime.getTime() + 5 * 60 * 1000) {
                    console.log(`[Scraper] CWL War ${war.warTag} endTime passed. Fetching final stats...`);
                    try {
                        const freshWarData = await fetchWarFromApi(war.warTag);
                        if (freshWarData) {
                            const parsedEndTime = parseCocDate(freshWarData.endTime);
                            await doc.ref.update({
                                state: freshWarData.state || 'warEnded',
                                endTimestamp: parsedEndTime ? admin.firestore.Timestamp.fromDate(parsedEndTime) : null,
                                warData: freshWarData,
                                lastFetchTime: new Date().toISOString()
                            });
                            console.log(`[Scraper] Updated CWL war ${war.warTag} state to: ${freshWarData.state}`);
                            if ((freshWarData.state || 'warEnded') === 'warEnded') {
                                await recordWarResult(freshWarData);
                            }
                        }
                    } catch (err) {
                        console.error(`[Scraper] Failed to update CWL war ${war.warTag}:`, err.message);
                    }
                }
            }

            // 3. Fetch/update in-progress Classic Wars
            const classicSnapshot = await db.collection('classicWars')
                .where('state', '!=', 'warEnded')
                .get();

            for (const doc of classicSnapshot.docs) {
                const war = doc.data();
                const clanTag = war.clanTag; // clean tag has '#' prefix
                const cleanedClanTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
                
                const metaDoc = await db.collection('clanMetadata').doc(cleanedClanTag.toUpperCase()).get();
                const isPrivate = metaDoc.exists && metaDoc.data().isPrivateWarLog === true;
                
                const nowTime = now.getTime();
                const endTime = parseCocDate(war.endTime);
                if (!endTime) continue;

                // Respect the 4-hour check interval for private war log clans, 1-hour for public
                const lastFetch = war.lastFetchTime ? new Date(war.lastFetchTime) : new Date(0);
                
                // Only check after war has ended
                if (nowTime >= endTime.getTime() + 5 * 60 * 1000) {
                    const cooldown = isPrivate ? 4 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000;
                    if (nowTime - lastFetch.getTime() >= cooldown) {
                        console.log(`[Scraper] Updating classic war ${doc.id} for clan ${clanTag} (Private: ${isPrivate})`);
                        try {
                            const freshWarData = await fetchClassicWarFromApi(clanTag);
                            
                            if (freshWarData) {
                                if (freshWarData.state === 'warEnded' || freshWarData.state === 'notInWar') {
                                    await recordWarResult(freshWarData);
                                    await doc.ref.update({
                                        state: 'warEnded',
                                        lastFetchTime: new Date().toISOString()
                                    });
                                    console.log(`[Scraper] Classic war ${doc.id} ended. Outcome recorded.`);
                                } else {
                                    await doc.ref.update({
                                        state: freshWarData.state,
                                        lastFetchTime: new Date().toISOString()
                                    });
                                }
                            }
                        } catch (err) {
                            if (err.message.includes('403') || err.message.includes('Forbidden')) {
                                // Mark as private log in metadata
                                await db.collection('clanMetadata').doc(cleanedClanTag.toUpperCase()).set({
                                    tag: cleanedClanTag.toUpperCase(),
                                    isPrivateWarLog: true,
                                    updatedAt: new Date().toISOString()
                                }, { merge: true });
                                
                                await doc.ref.update({
                                    lastFetchTime: new Date().toISOString()
                                });
                                console.warn(`[Scraper] Classic war ${doc.id} returned 403. Set metadata to Private.`);
                            } else {
                                console.error(`[Scraper] Failed to update classic war ${doc.id}:`, err.message);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error("[Scraper] Error in background scraper interval:", err);
        }
    }, 60 * 60 * 1000); // 1 hour
}

// Start background job
startCwlBackgroundScraper();

app.get('/proxy/clans/:clanTag/currentwar', proxyLimiter, async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const clanTag = req.params.clanTag;

    if (!isValidTag(clanTag)) {
        return res.status(400).json({ message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const userId = req.headers['x-user-id'];

    console.log(`[GET] Fetching current war for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    const cacheKey = `currentwar_${cleanedTag.toUpperCase()}`;
    
    // Check circuit breaker first
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
                return res.status(403).json({ message: 'Clan war log is private' });
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

            // Fallback to Firestore cache snapshot
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

            throw fetchError;
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            
            // Set memory cache for 10 minutes (600s)
            setCachedData(cacheKey, data, 600);
            const cachedItem = getCachedData(cacheKey);

            // Write to Firestore snapshot cache in the background
            db.collection('classicWarsCache').doc(cleanedTag.toUpperCase()).set({
                tag: cleanedTag.toUpperCase(),
                warData: data,
                cachedAt: new Date().toISOString()
            }).catch(err => console.error(`[Firestore Cache] Error saving current war snapshot for ${cleanedTag}:`, err));

            // Register war in classicWars collection for background scraper tracking
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
                // Mark clan's war log as private in firestore metadata
                db.collection('clanMetadata').doc(cleanedTag.toUpperCase()).set({
                    tag: cleanedTag.toUpperCase(),
                    isPrivateWarLog: true,
                    updatedAt: new Date().toISOString()
                }, { merge: true }).catch(err => console.error("Error setting private war log metadata: ", err));

                // Try to get Firestore fallback snapshot
                let fallbackData = null;
                try {
                    const doc = await db.collection('classicWarsCache').doc(cleanedTag.toUpperCase()).get();
                    if (doc.exists) {
                        fallbackData = doc.data().warData;
                    }
                } catch (dbError) {
                    console.error(`[Firestore Cache] Failed to load snapshot for current war ${cleanedTag}:`, dbError);
                }

                // Cache 403 state with fallbackData in memory for 10 minutes (600s)
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
                    return res.status(403).json({ message: 'Clan war log is private' });
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

            // Fallback to Firestore cache snapshot
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

            const text = await response.text();
            res.status(response.status).send(text);
        }
    } catch (error) {
        console.error(`[GET] Error in proxy/clans/${cleanedTag}/currentwar:`, error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET /api/clans/:clanTag/warlog
app.get('/api/clans/:clanTag/warlog', async (req, res) => {
    const clanTag = req.params.clanTag;
    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const cleanClanTag = `#${cleanedTag.toUpperCase()}`;

    try {
        // 1. Fetch public war log from proxy endpoint (which caches for 10 mins)
        let publicLog = [];
        try {
            const baseUrl = `http://localhost:${port}`;
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`${baseUrl}/proxy/clans/${cleanedTag}/warlog`, {
                headers: {
                    'x-user-id': 'internal-scraper'
                }
            });
            if (response.ok) {
                const data = await response.json();
                publicLog = data.items || [];
            }
        } catch (err) {
            console.warn(`[Unified Warlog] Could not fetch public log for ${cleanClanTag}:`, err.message);
        }

        // 2. Fetch recorded custom war logs from Firestore cwlWars and clanWarLogs collections
        const customLogSnapshot = await db.collection('clanWarLogs')
            .where('clanTag', '==', cleanClanTag)
            .get();

        const customEntries = [];
        customLogSnapshot.forEach(doc => {
            const data = doc.data();
            customEntries.push({
                result: data.result,
                endTime: data.endTime,
                teamSize: data.teamSize,
                clan: {
                    tag: data.clanTag,
                    stars: data.stars,
                    destructionPercentage: data.destructionPercentage
                },
                opponent: {
                    tag: data.opponent.tag,
                    name: data.opponent.name,
                    stars: data.opponent.stars,
                    destructionPercentage: data.opponent.destructionPercentage
                },
                source: 'recorded'
            });
        });

        // 3. Merge and deduplicate by endTime + opponent tag
        const mergedMap = new Map();

        // Insert public log entries first
        publicLog.forEach(entry => {
            const key = `${entry.endTime}_${entry.opponent.tag.toUpperCase()}`;
            mergedMap.set(key, { ...entry, source: 'public' });
        });

        // Insert custom entries
        customEntries.forEach(entry => {
            const key = `${entry.endTime}_${entry.opponent.tag.toUpperCase()}`;
            mergedMap.set(key, entry);
        });

        // Convert to array and sort by endTime descending
        const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
            return b.endTime.localeCompare(a.endTime);
        });

        res.json(mergedList);
    } catch (error) {
        console.error(`Error generating unified war log for clan ${cleanClanTag}:`, error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// GET /api/cwl/wars?clanTag={clanTag}
app.get('/api/cwl/wars', async (req, res) => {
    const clanTag = req.query.clanTag;
    if (!clanTag) {
        return res.status(400).json({ message: 'clanTag query parameter is required' });
    }
    
    const cleanClanTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`;
    
    try {
        const query1 = await db.collection('cwlWars')
            .where('clanTag', '==', cleanClanTag)
            .get();
            
        const query2 = await db.collection('cwlWars')
            .where('opponentTag', '==', cleanClanTag)
            .get();
            
        const warsMap = new Map();
        
        query1.forEach(doc => {
            warsMap.set(doc.id, doc.data());
        });
        
        query2.forEach(doc => {
            warsMap.set(doc.id, doc.data());
        });
        
        const warsList = Array.from(warsMap.values());
        res.json(warsList);
    } catch (error) {
        console.error(`Error fetching cached CWL wars for clan ${cleanClanTag}:`, error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// --- BILLING COSTS CACHE & ENDPOINT ---
const { BigQuery } = require('@google-cloud/bigquery');

let cachedBillingData = null;
let isFetchingBillingData = false;

function getMockBillingData(monthStr) {
    return {
        lastUpdated: new Date().toISOString(),
        isMock: true,
        billingMonth: monthStr,
        totalCostTillDate: 0,
        breakdown: [
            {
                month: "2026-05",
                totalCost: 37.00,
                services: [
                    { name: "Compute Engine", cost: 9.50 },
                    { name: "Networking", cost: 27.50 }
                ]
            }
        ]
    };
}

async function fetchBillingCostsFromBigQuery() {
    const projectId = process.env.GCP_BILLING_PROJECT_ID || 'orecalc';
    const datasetId = process.env.GCP_BILLING_DATASET_ID || 'orecalc_billing_bq';
    const tableId = process.env.GCP_BILLING_TABLE_ID || 'unified_billing_data';

    const bigquery = new BigQuery({ projectId: projectId });
    const query = `
        SELECT 
          service_name,
          sku_name,
          ROUND(SUM(amount), 2) as total_cost,
          FORMAT_TIMESTAMP('%Y-%m', activity_date) as billing_month
        FROM \`${projectId}.${datasetId}.${tableId}\`
        GROUP BY 1, 2, 4
        ORDER BY billing_month DESC, total_cost DESC
    `;

    console.log(`[Billing Cache] Fetching billing costs from BigQuery...`);
    const [rows] = await bigquery.query({ query });

    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    let totalCostTillDate = 0;
    const monthlyGroups = {};

    rows.forEach(row => {
        const cost = parseFloat(row.total_cost || 0);
        const month = row.billing_month;
        if (!month) return;

        if (month < currentMonthStr) {
            totalCostTillDate += cost;
        }

        if (!monthlyGroups[month]) {
            monthlyGroups[month] = {
                month: month,
                services: {}
            };
        }

        const serviceName = row.service_name || 'Other Services';
        if (!monthlyGroups[month].services[serviceName]) {
            monthlyGroups[month].services[serviceName] = 0;
        }
        monthlyGroups[month].services[serviceName] += cost;
    });

    let extrasConfig = { extras: [], footers: [] };
    const extrasPath = path.join(__dirname, 'billing-extras.json');
    if (fs.existsSync(extrasPath)) {
        try {
            extrasConfig = JSON.parse(fs.readFileSync(extrasPath, 'utf8'));
        } catch (err) {
            console.error('[Billing Cache] Error parsing billing-extras.json:', err);
        }
    }

    if (extrasConfig.extras && extrasConfig.extras.length > 0) {
        extrasConfig.extras.forEach(extra => {
            const cost = parseFloat(extra.cost || 0);
            const month = extra.month;
            if (!month) return;

            if (month < currentMonthStr) {
                totalCostTillDate += cost;
            }

            if (!monthlyGroups[month]) {
                monthlyGroups[month] = {
                    month: month,
                    services: {}
                };
            }
        });
    }

    const sortedMonths = Object.keys(monthlyGroups).sort((a, b) => b.localeCompare(a));
    const historyMonths = sortedMonths.filter(m => m < currentMonthStr).slice(0, 6);

    const breakdown = historyMonths.map(month => {
        const group = monthlyGroups[month];
        const servicesArray = Object.keys(group.services).map(name => ({
            name: name,
            cost: parseFloat(group.services[name].toFixed(2))
        }));

        let negligibleSum = 0;
        const filteredServices = [];
        servicesArray.forEach(s => {
            if (s.cost < 0.01) {
                negligibleSum += s.cost;
            } else {
                filteredServices.push(s);
            }
        });

        if (negligibleSum > 0) {
            filteredServices.push({
                name: 'Others',
                cost: parseFloat(negligibleSum.toFixed(2))
            });
        }

        filteredServices.sort((a, b) => b.cost - a.cost);

        const monthExtras = (extrasConfig.extras || [])
            .filter(e => e.month === month)
            .map(e => ({
                name: e.name,
                cost: parseFloat((e.cost || 0).toFixed(2)),
                highlight: true
            }));

        const finalServices = [...monthExtras, ...filteredServices];
        const totalCost = parseFloat(finalServices.reduce((sum, s) => sum + s.cost, 0).toFixed(2));
        const footerMatch = (extrasConfig.footers || []).find(f => f.month === month);

        const result = {
            month: month,
            totalCost: totalCost,
            services: finalServices
        };

        if (footerMatch && footerMatch.text) {
            result.footer = footerMatch.text;
        }

        return result;
    });

    const data = {
        lastUpdated: new Date().toISOString(),
        totalCostTillDate: parseFloat(totalCostTillDate.toFixed(2)),
        breakdown: breakdown
    };

    return data;
}

async function getOrUpdateBillingCache() {
    const currentDate = new Date();
    const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

    if (cachedBillingData && cachedBillingData.billingMonth === currentMonthStr) {
        return cachedBillingData;
    }

    try {
        const docRef = db.collection('metadata').doc('billingCosts');
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            const data = docSnap.data();
            if (data.billingMonth === currentMonthStr) {
                cachedBillingData = data;
                return cachedBillingData;
            }

            if (!isFetchingBillingData) {
                triggerBackgroundBillingFetch(currentMonthStr);
            }
            cachedBillingData = data;
            return cachedBillingData;
        }
    } catch (err) {
        console.error('[Billing Cache] Failed to read from Firestore:', err);
    }

    if (!isFetchingBillingData) {
        try {
            isFetchingBillingData = true;
            const data = await fetchBillingCostsFromBigQuery();
            data.billingMonth = currentMonthStr;
            await db.collection('metadata').doc('billingCosts').set(data);
            cachedBillingData = data;
        } catch (err) {
            console.error('[Billing Cache] Synchronous BigQuery fetch failed:', err);
            cachedBillingData = getMockBillingData(currentMonthStr);
        } finally {
            isFetchingBillingData = false;
        }
    }

    return cachedBillingData;
}

function triggerBackgroundBillingFetch(targetMonthStr) {
    isFetchingBillingData = true;
    console.log(`[Billing Cache] Outdated cache detected. Triggering background BigQuery fetch for ${targetMonthStr}...`);
    fetchBillingCostsFromBigQuery().then(async (data) => {
        data.billingMonth = targetMonthStr;
        await db.collection('metadata').doc('billingCosts').set(data);
        cachedBillingData = data;
        console.log(`[Billing Cache] Background cache update successful for ${targetMonthStr}.`);
    }).catch(err => {
        console.error(`[Billing Cache] Background cache update failed:`, err);
    }).finally(() => {
        isFetchingBillingData = false;
    });
}

app.get('/api/billing/costs', async (req, res) => {
    try {
        const data = await getOrUpdateBillingCache();
        res.json(data);
    } catch (err) {
        console.error('Failed to serve billing costs:', err);
        res.status(500).json({ error: 'Failed to retrieve billing costs' });
    }
});

// Warm up the billing costs cache on startup
getOrUpdateBillingCache().then(() => {
    console.log('[Billing Cache] Startup cache warm-up complete.');
}).catch(err => {
    console.error('[Billing Cache] Failed to warm up cache on startup:', err);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
});
