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

app.use(cors());
app.use(express.json());

app.get('/proxy/players/:playerTag', async (req, res) => {
    const fetch = (await import('node-fetch')).default;
    const playerTag = req.params.playerTag;
    const encodedTag = encodeURIComponent(`#${playerTag}`);
    const url = `https://api.clashofclans.com/v1/players/${encodedTag}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.CLASH_OF_CLANS_API_TOKEN}`
            }
        });

        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).send(data);
        } else {
            const text = await response.text();
            res.status(response.status).send(text);
        }
    } catch (error) {
        console.error('Error fetching player data:', error);
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
