const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');
const helmet = require('helmet');

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

// General Rate Limiter (100 requests per 15 minutes)
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
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

// Rate Limiter for Clash of Clans API proxy requests (30 requests per 15 minutes)
const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
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
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-verify-token', 'x-user-id'],
    exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset']
}));

app.use(express.json());

app.get('/proxy/players/:playerTag', proxyLimiter, async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const playerTag = req.params.playerTag;
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
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/players/${encodedTag}`;

        console.log(`[GET] Proceeding to fetch player data from: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
            }
        });

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
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
    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const userId = req.headers['x-user-id'];

    console.log(`[GET] Fetching clan data for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clans/${encodedTag}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
            }
        });

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
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
    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const userId = req.headers['x-user-id'];

    console.log(`[GET] Fetching war log for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clans/${encodedTag}/warlog`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
            }
        });

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
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
    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const userId = req.headers['x-user-id'];

    console.log(`[GET] Fetching CWL league group for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clans/${encodedTag}/currentwar/leaguegroup`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
            }
        });

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            registerGroupWarsBackground(data).catch(err => {
                console.error("[Scraper] Error registering group wars in background:", err);
            });
            res.status(response.status).json(data);
        } else {
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
    const cleanedTag = warTag.startsWith('#') ? warTag.substring(1) : warTag;
    const encodedTag = encodeURIComponent(`#${cleanedTag}`);
    const userId = req.headers['x-user-id'];

    console.log(`[GET] Fetching CWL war data for tag: ${cleanedTag}, UserID: ${userId || 'none'}`);

    try {
        const baseUrl = process.env.COC_API_BASE_URL || 'https://cocproxy.royaleapi.dev/v1';
        const url = `${baseUrl}/clanwarleagues/wars/${encodedTag}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
            }
        });

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
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
        res.status(200).json(doc.data());
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
                    from: process.env.EMAIL_FROM || 'noreply@clashcalc.com',
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
                    from: process.env.EMAIL_FROM || 'noreply@clashcalc.com',
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
                    from: process.env.EMAIL_FROM || 'noreply@clashcalc.com',
                    to: process.env.RECIPIENT_EMAIL_SUPPORT || 'support@clashcalc.com',
                    subject: `[OreCalc] Bug Report - ${docRef.id} (${userId || 'unknown'})`,
                    text: `Hello,\n\nA new bug report has been submitted.\n\nDetails:\n- Report ID: ${docRef.id}\n- User ID: ${userId || 'unknown'}\n- Contact Email: ${email || 'none'}\n- Date: ${reportData.reportedAt}\n\nDescription:\n${description}\n\n${attachData ? 'User data is attached to this email.' : 'No user data was attached.'}\n\nRegards,\nOreCalc Support System`,
                    attachments
                };

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
    res.json({ currentAppVersion: '2.0.0' });
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
        }
    });
    if (!response.ok) {
        throw new Error(`CoC API status ${response.status}`);
    }
    return await response.json();
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
                }
            }
        } catch (err) {
            console.error(`[Scraper] Failed to register/update war ${tag}:`, err.message);
        }
    }
}

function startCwlBackgroundScraper() {
    console.log("[Scraper] Starting CWL background scraper (1-hour interval)");
    
    setInterval(async () => {
        try {
            const now = new Date();
            console.log(`[Scraper] Running periodic CWL war fetch and prune checks at ${now.toISOString()}`);
            
            // 1. Prune wars older than 3 months (90 days)
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            
            const oldWarsSnapshot = await db.collection('cwlWars')
                .where('endTimestamp', '<', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
                .get();
                
            for (const oldDoc of oldWarsSnapshot.docs) {
                await oldDoc.ref.delete();
                console.log(`[Scraper] Pruned old war document: ${oldDoc.id}`);
            }
            
            // 2. Fetch/update in-progress wars whose scheduled endTime has passed
            const snapshot = await db.collection('cwlWars')
                .where('state', '!=', 'warEnded')
                .get();
                
            if (snapshot.empty) {
                return;
            }
            
            for (const doc of snapshot.docs) {
                const war = doc.data();
                const endTime = parseCocDate(war.endTime);
                if (!endTime) continue;
                
                // Fetch if the scheduled endTime has passed (+ 5-minute buffer)
                if (now.getTime() >= endTime.getTime() + 5 * 60 * 1000) {
                    console.log(`[Scraper] War ${war.warTag} endTime passed. Fetching final stats...`);
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
                            console.log(`[Scraper] Updated war ${war.warTag} state to: ${freshWarData.state}`);
                        }
                    } catch (err) {
                        console.error(`[Scraper] Failed to update war ${war.warTag}:`, err.message);
                    }
                }
            }
        } catch (err) {
            console.error("[Scraper] Error in CWL background scraper interval:", err);
        }
    }, 60 * 60 * 1000); // 1 hour
}

// Start scraper background job
startCwlBackgroundScraper();

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

app.listen(port, '0.0.0.0', () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
});
