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

// Configure restricted CORS origin
const allowedOrigins = [
    'https://orecalc.tech',
    'https://www.orecalc.tech',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
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

app.get('/proxy/players/:playerTag', async (req, res) => {
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
        await db.collection('userStates').doc(userId).delete();
        res.status(200).json({ message: 'Data deleted successfully.' });
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
                    to: process.env.EMAIL_TO || 'privacy@clashcalc.com',
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

app.listen(port, '0.0.0.0', () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
});
