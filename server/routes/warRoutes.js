const express = require('express');
const { db } = require('../services/firebase.js');
const { isValidTag } = require('../utils/validation.js');
const { getClanWarLogInternal } = require('../services/clashApiService.js');

const router = express.Router();

router.get('/clans/:clanTag/warlog', async (req, res) => {
    const clanTag = req.params.clanTag;
    if (!isValidTag(clanTag)) {
        return res.status(400).json({ reason: 'invalidTag', message: 'Invalid Clash of Clans tag format.' });
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const cleanClanTag = `#${cleanedTag.toUpperCase()}`;

    try {
        // Fetch public war log directly via internal in-memory helper (no loopback network socket)
        let publicLog = [];
        const result = await getClanWarLogInternal(cleanedTag, { userId: 'internal-scraper' });
        if (result.status === 200 && result.body && Array.isArray(result.body.items)) {
            publicLog = result.body.items;
        }

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

        const mergedMap = new Map();

        publicLog.forEach(entry => {
            if (entry && entry.opponent && entry.opponent.tag) {
                const key = `${entry.endTime}_${entry.opponent.tag.toUpperCase()}`;
                mergedMap.set(key, { ...entry, source: 'public' });
            }
        });

        customEntries.forEach(entry => {
            if (entry && entry.opponent && entry.opponent.tag) {
                const key = `${entry.endTime}_${entry.opponent.tag.toUpperCase()}`;
                mergedMap.set(key, entry);
            }
        });

        const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
            return (b.endTime || '').localeCompare(a.endTime || '');
        });

        res.json(mergedList);
    } catch (error) {
        console.error(`Error generating unified war log for clan ${cleanClanTag}:`, error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error' });
    }
});

router.get('/cwl/wars', async (req, res) => {
    const clanTag = req.query.clanTag;
    if (!clanTag || typeof clanTag !== 'string' || !isValidTag(clanTag)) {
        return res.status(400).json({ reason: 'invalidTag', message: 'Valid clanTag query parameter is required.' });
    }

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const cleanClanTag = `#${cleanedTag.toUpperCase()}`;

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
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error' });
    }
});

module.exports = router;
