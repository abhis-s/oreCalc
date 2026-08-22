const express = require('express');
const { getOrUpdateBillingCache } = require('../services/billingService.js');

const router = express.Router();

router.get('/costs', async (req, res) => {
    try {
        const data = await getOrUpdateBillingCache();
        res.json(data);
    } catch (err) {
        console.error('Failed to serve billing costs:', err);
        res.status(500).json({ error: 'Failed to retrieve billing costs' });
    }
});

module.exports = router;
