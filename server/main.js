const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');

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

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message: 'Too many requests from this IP, please try again after 15 minutes.',
	standardHeaders: true,
	legacyHeaders: false,
});

app.use(limiter);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-verify-token', 'x-user-id']
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

app.delete('/api/user-data/delete/:userId', async (req, res) => {
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

app.post('/api/user-data/erase-tag', async (req, res) => {
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
        
        console.log(`[ERASE] Verifying token for ${cleanedTag} before erasure...`);

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
            console.error(`[ERASE] Verification failed for ${cleanedTag}. HTTP: ${verifyResponse.status}`);
            return res.status(403).json({ 
                reason: 'invalidToken',
                message: 'Global protection failed. Invalid player token provided.' 
            });
        }

        console.log(`[ERASE] Verification successful. Proceeding to erase tag ${cleanedTag} from all users.`);

        const snapshot = await db.collection('userStates').get();
        const batch = db.batch();
        let affectedCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            let changed = false;

            if (data.savedPlayerTags && data.savedPlayerTags.includes(cleanedTag)) {
                data.savedPlayerTags = data.savedPlayerTags.filter(tag => tag !== cleanedTag);
                if (data.savedPlayerTags.length === 0) {
                    data.savedPlayerTags = ['DEFAULT0'];
                }
                changed = true;
            }

            if (data.allPlayersData && data.allPlayersData[cleanedTag]) {
                delete data.allPlayersData[cleanedTag];
                changed = true;
            }

            if (changed) {
                batch.update(doc.ref, data);
                affectedCount++;
            }
        });

        if (affectedCount > 0) {
            await batch.commit();
        }

        // Save the tag to excludedTags to prevent normal addition in the future.
        const protectionData = {
            erasedAt: new Date().toISOString(),
            status: 'protected',
            verifiedAt: new Date().toISOString()
        };

        // If a userId was provided, add them to the authorized list immediately
        if (userId) {
            protectionData.verifiedUuids = admin.firestore.FieldValue.arrayUnion(userId);
        }

        await db.collection('excludedTags').doc(cleanedTag).set(protectionData, { merge: true });

        res.status(200).json({ message: `Tag erased from ${affectedCount} users and added to exclusion list.` });
    } catch (error) {
        console.error('Error erasing tag:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

app.get('/api/version', (req, res) => {
    res.json({ currentAppVersion: '1.3.0' });
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
