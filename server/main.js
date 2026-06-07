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

app.listen(port, '0.0.0.0', () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
});
