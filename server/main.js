const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cors = require('cors');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

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
    // Add the '#' back and URL-encode it for the official API
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

app.get('/api/version', (req, res) => {
    res.json({ currentAppVersion: '1.2.0' });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
});