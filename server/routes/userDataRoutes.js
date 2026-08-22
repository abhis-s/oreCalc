const express = require('express');
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_DEFAULTS } = require('../constants.js');
const { isValidUserId, isValidTag } = require('../utils/validation.js');
const { admin, db, isUserDeleted } = require('../services/firebase.js');

const router = express.Router();
// @ts-ignore
const sensitiveLimiter = rateLimit(RATE_LIMIT_DEFAULTS.sensitive);

router.post('/save', async (req, res) => {
    const { userId, data } = req.body;

    if (!isValidUserId(userId)) {
        return res.status(400).json({ reason: 'invalidUserId', message: 'Invalid user ID format.' });
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({ reason: 'invalidPayload', message: 'Valid user data object is required.' });
    }

    try {
        // Check size against Firestore's 1MB (1,048,576 bytes) document limit
        const dataSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
        if (dataSize > 1040000) {
            return res.status(413).json({ reason: 'payloadTooLarge', message: 'User state data exceeds the maximum 1MB storage limit.' });
        }

        if (await isUserDeleted(userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        const userRef = db.collection('userStates').doc(userId);

        // Prevent older clients from overwriting newer version data in Firestore
        const doc = await userRef.get();
        if (doc.exists) {
            const existingData = doc.data();
            const existingVersion = existingData.appVersion || '1.0.0';
            if (existingVersion.startsWith('2')) {
                const clientVersion = String(req.headers['x-app-version'] || '');
                if (!clientVersion.startsWith('2')) {
                    return res.status(426).json({
                        reason: 'versionMismatch',
                        message: 'A newer version of the application is required to save to this account. Please reload or update the application.'
                    });
                }
            }
        }

        const { FieldValue } = await import('firebase-admin/firestore');
        const batch = db.batch();

        const allPlayers = data.allPlayersData || {};
        const globalData = {
            appVersion: data.appVersion || '2.0.0',
            savedPlayerTags: Array.isArray(data.savedPlayerTags) ? data.savedPlayerTags : [],
            uiSettings: (data.uiSettings && typeof data.uiSettings === 'object') ? data.uiSettings : {},
            timestamp: data.timestamp || new Date().toISOString(),
            isMigrated: true,
            allPlayersData: FieldValue.delete()
        };

        batch.set(userRef, globalData, { merge: true });

        const playersCollection = userRef.collection('players');
        for (const [tag, playerData] of Object.entries(allPlayers)) {
            if (isValidTag(tag) && playerData && typeof playerData === 'object') {
                const cleanedDocTag = tag.startsWith('#') ? tag.substring(1) : tag;
                const playerDocRef = playersCollection.doc(cleanedDocTag);
                batch.set(playerDocRef, playerData, { merge: true });
            }
        }

        await batch.commit();
        res.status(200).json({ message: 'Data saved successfully.' });
    } catch (error) {
        console.error('Error saving user data:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

router.post('/save-player', async (req, res) => {
    const { userId, tag, playerData } = req.body;

    if (!isValidUserId(userId)) {
        return res.status(400).json({ reason: 'invalidUserId', message: 'Invalid user ID format.' });
    }

    if (!isValidTag(tag)) {
        return res.status(400).json({ reason: 'invalidTag', message: 'Invalid player tag format.' });
    }

    if (!playerData || typeof playerData !== 'object' || Array.isArray(playerData)) {
        return res.status(400).json({ reason: 'invalidPayload', message: 'Valid playerData object is required.' });
    }

    const payloadSize = Buffer.byteLength(JSON.stringify(playerData), 'utf8');
    if (payloadSize > 1040000) {
        return res.status(413).json({ reason: 'payloadTooLarge', message: 'Player data exceeds the maximum 1MB storage limit.' });
    }

    try {
        if (await isUserDeleted(userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        const cleanedTag = tag.startsWith('#') ? tag.substring(1) : tag;
        const userRef = db.collection('userStates').doc(userId);
        const playerDocRef = userRef.collection('players').doc(cleanedTag);

        const batch = db.batch();
        batch.set(playerDocRef, playerData, { merge: true });
        batch.set(userRef, {
            timestamp: new Date().toISOString(),
            isMigrated: true
        }, { merge: true });

        await batch.commit();
        res.status(200).json({ message: 'Player data saved successfully.' });
    } catch (error) {
        console.error('Error saving single player data:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

router.get('/load/:userId', async (req, res) => {
    const userId = req.params.userId;

    if (!isValidUserId(userId)) {
        return res.status(400).json({ reason: 'invalidUserId', message: 'Invalid user ID format.' });
    }

    try {
        if (await isUserDeleted(userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        const userRef = db.collection('userStates').doc(userId);
        const doc = await userRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'notFound', message: 'User data not found.' });
        }

        const mainData = doc.data();

        const playersSnapshot = await userRef.collection('players').get();
        const allPlayersData = mainData.allPlayersData || {};

        if (!playersSnapshot.empty) {
            playersSnapshot.forEach(playerDoc => {
                allPlayersData[playerDoc.id] = playerDoc.data();
            });
        }

        const assembledData = /** @type {any} */ ({
            ...mainData,
            allPlayersData
        });

        const clientVersion = String(req.headers['x-app-version'] || '');

        // Backward compatibility shim: if client is older than v2, convert currency object to string to prevent crashes on startup
        if (!clientVersion.startsWith('2')) {
            const uiSettings = /** @type {any} */ (assembledData.uiSettings);
            if (uiSettings && typeof uiSettings.currency === 'object' && uiSettings.currency !== null) {
                uiSettings.currency = uiSettings.currency.code || 'USD';
            }
        }

        res.status(200).json(assembledData);
    } catch (error) {
        console.error('Error loading user data:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

router.delete('/delete/:userId', sensitiveLimiter, async (req, res) => {
    const userId = req.params.userId;

    if (!isValidUserId(userId)) {
        return res.status(400).json({ reason: 'invalidUserId', message: 'Invalid user ID format.' });
    }

    try {
        const userRef = db.collection('userStates').doc(userId);
        const playersSnapshot = await userRef.collection('players').get();
        const deleteBatch = db.batch();
        playersSnapshot.forEach(pDoc => deleteBatch.delete(pDoc.ref));
        deleteBatch.delete(userRef);
        await deleteBatch.commit();

        const nowIso = new Date().toISOString();
        await db.collection('deletedUuids').doc(userId).set({
            deletedAt: nowIso,
            serverTimestamp: admin.firestore.FieldValue.serverTimestamp(),
            reason: 'user_requested'
        });

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
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

router.post('/erase-tag', sensitiveLimiter, (req, res) => {
    res.status(403).json({
        reason: 'featureDisabled',
        message: 'This feature has been deactivated.'
    });
});

module.exports = router;
