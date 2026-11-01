const express = require('express');
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_DEFAULTS, SERVER_CONSTANTS } = require('../constants.js');
const { isValidUserId, isValidTag, normalizeTag, compareVersions } = require('../utils/validation.js');
const { db, FieldValue, isUserDeleted } = require('../services/firebase.js');
const { extractAuthUser, isAuthorizedForUser } = require('../middleware/authMiddleware.js');
const {
    isLegacyOreCalcOrigin,
    isRestrictedFromOreCalc,
    sanitizePlayerData,
    hydratePlayerProfileFromCache,
    sanitizePreferences,
    requireMinAppVersion,
    sendAccountDeletionNotice
} = require('../services/userDataSanitizer.js');

const router = express.Router();
// @ts-ignore
const sensitiveLimiter = rateLimit(RATE_LIMIT_DEFAULTS.sensitive);

router.use(extractAuthUser);
router.use((_req, res, next) => {
    if (typeof res.setHeader === 'function') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

router.post('/save', requireMinAppVersion, async (req, res) => {
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

        if (/** @type {any} */ (req).authUser && /** @type {any} */ (req).authUser.userId !== userId) {
            return res.status(403).json({
                reason: 'unauthorizedAccess',
                message: 'Authenticated users can only access their own user ID.'
            });
        }

        const userRef = db.collection('userStates').doc(userId);

        // Prevent older clients from overwriting newer version data in Firestore
        const doc = await userRef.get();
        let existingData = null;
        if (doc.exists) {
            existingData = doc.data();
            if (isLegacyOreCalcOrigin(req) && isRestrictedFromOreCalc(existingData)) {
                return res.status(423).json({
                    reason: 'accountMigratedToClashCalc',
                    message: 'This account has been migrated to ClashCalc and cannot be modified from OreCalc.',
                    isMigratedToClashCalc: true
                });
            }
            if (!(await isAuthorizedForUser(userId, /** @type {any} */ (req).authUser, existingData))) {
                return res.status(403).json({
                    reason: 'unauthorizedAccess',
                    message: 'Authentication required to modify this account.'
                });
            }
            const existingVersion = existingData.appVersion || '1.0.0';
            const clientVersion = String(req.headers['x-app-version'] || data.appVersion || '1.0.0');
            if (compareVersions(clientVersion, existingVersion) < 0) {
                return res.status(426).json({
                    reason: 'downgradeProhibited',
                    message: 'A newer version of data exists on this account. Update required.'
                });
            }
        }

        const batch = db.batch();

        const allPlayers = data.allPlayersData || {};
        const uiSettings = (data.uiSettings && typeof data.uiSettings === 'object') ? { ...data.uiSettings } : {};
        delete uiSettings.saveError;

        const validTags = (Array.isArray(data.savedPlayerTags) ? data.savedPlayerTags : [])
            .map(t => normalizeTag(t))
            .filter(t => isValidTag(t));

        if (!doc.exists && !(/** @type {any} */ (req).authUser) && validTags.length === 0) {
            return res.status(400).json({
                reason: 'noPlayerTags',
                message: 'Cannot initialize unauthenticated cloud state without valid player tags.'
            });
        }

        const globalData = {
            appVersion: data.appVersion || SERVER_CONSTANTS.MIN_SUPPORTED_APP_VERSION,
            savedPlayerTags: validTags,
            uiSettings,
            timestamp: data.timestamp || new Date().toISOString(),
            isMigrated: true,
            isMigratedToClashCalc: true,
            migratedAt: existingData?.migratedAt || new Date().toISOString(),
            allPlayersData: FieldValue.delete(),
            ownerAccount: existingData?.ownerAccount ?? null,
            authRequired: existingData?.authRequired ?? false
        };

        if (typeof data.stateResetEpoch === 'number') {
            globalData.stateResetEpoch = data.stateResetEpoch;
        } else if (typeof uiSettings.stateResetEpoch === 'number') {
            globalData.stateResetEpoch = uiSettings.stateResetEpoch;
        } else if (typeof existingData?.stateResetEpoch === 'number') {
            globalData.stateResetEpoch = existingData.stateResetEpoch;
        }

        batch.set(userRef, globalData, { merge: true });

        const playersCollection = userRef.collection('players');
        const existingPlayersSnapshot = await playersCollection.get();
        const incomingCleanTags = new Set();
        const incomingSavedTags = new Set(Array.isArray(globalData.savedPlayerTags) ? globalData.savedPlayerTags.map(t => normalizeTag(t)) : []);

        for (const [tag, playerData] of Object.entries(allPlayers)) {
            if (isValidTag(tag) && playerData && typeof playerData === 'object') {
                const cleanedDocTag = tag.startsWith('#') ? tag.substring(1) : tag;
                incomingCleanTags.add(cleanedDocTag);
                const playerDocRef = playersCollection.doc(cleanedDocTag);
                const sanitizedPlayer = sanitizePlayerData(playerData);

                // Save protection: do not clobber existing valid playerProfile with null/missing
                if (!sanitizedPlayer.playerProfile || !sanitizedPlayer.playerProfile.townHallLevel) {
                    const existingDoc = existingPlayersSnapshot.docs.find(d => d.id === cleanedDocTag);
                    if (existingDoc && existingDoc.data()?.playerProfile) {
                        sanitizedPlayer.playerProfile = existingDoc.data().playerProfile;
                    } else {
                        const hydrated = await hydratePlayerProfileFromCache(cleanedDocTag, 'UserData Save');
                        if (hydrated) {
                            sanitizedPlayer.playerProfile = hydrated;
                        }
                    }
                }

                // Atomic overwrite without merge: true to purge obsolete fields (achievements/troops bloat)
                batch.set(playerDocRef, sanitizedPlayer);
            }
        }

        // Prune subcollection documents no longer present in incoming payload or savedPlayerTags
        if (!existingPlayersSnapshot.empty) {
            existingPlayersSnapshot.forEach(docSnap => {
                if (!incomingCleanTags.has(docSnap.id) && !incomingSavedTags.has(docSnap.id)) {
                    batch.delete(docSnap.ref);
                }
            });
        }

        await batch.commit();
        res.status(200).json({ message: 'Data saved successfully.' });
    } catch (error) {
        console.error('Error saving user data:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

/**
 * Handles lightweight decoupled user preferences update.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function handleUpdatePreferences(req, res) {
    const { userId, preferences } = req.body;

    if (!isValidUserId(userId)) {
        return res.status(400).json({ reason: 'invalidUserId', message: 'Invalid user ID format.' });
    }

    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
        return res.status(400).json({ reason: 'invalidPayload', message: 'Valid preferences object is required.' });
    }

    const payloadSize = Buffer.byteLength(JSON.stringify(preferences), 'utf8');
    if (payloadSize > 65536) {
        return res.status(413).json({ reason: 'payloadTooLarge', message: 'Preferences data exceeds storage limit.' });
    }

    try {
        if (await isUserDeleted(userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        if (/** @type {any} */ (req).authUser && /** @type {any} */ (req).authUser.userId !== userId) {
            return res.status(403).json({
                reason: 'unauthorizedAccess',
                message: 'Authenticated users can only access their own user ID.'
            });
        }

        const userRef = db.collection('userStates').doc(userId);
        const doc = await userRef.get();
        let existingData = null;
        if (doc.exists) {
            existingData = doc.data();
            if (isLegacyOreCalcOrigin(req) && isRestrictedFromOreCalc(existingData)) {
                return res.status(423).json({
                    reason: 'accountMigratedToClashCalc',
                    message: 'This account has been migrated to ClashCalc and cannot be modified from OreCalc.',
                    isMigratedToClashCalc: true
                });
            }
            if (!(await isAuthorizedForUser(userId, /** @type {any} */ (req).authUser, existingData))) {
                return res.status(403).json({
                    reason: 'unauthorizedAccess',
                    message: 'Authentication required to modify this account.'
                });
            }
        }

        const sanitized = sanitizePreferences(preferences);
        const updateData = {
            uiSettings: sanitized,
            timestamp: new Date().toISOString(),
            isMigratedToClashCalc: true,
            migratedAt: existingData?.migratedAt || new Date().toISOString()
        };

        if (!doc.exists) {
            if (!(/** @type {any} */ (req).authUser)) {
                return res.status(404).json({
                    reason: 'notFound',
                    message: 'Cannot save preferences for non-existent unauthenticated user.'
                });
            }
            updateData.appVersion = req.headers['x-app-version'] || SERVER_CONSTANTS.MIN_SUPPORTED_APP_VERSION;
            updateData.savedPlayerTags = [];
            updateData.isMigrated = true;
            updateData.ownerAccount = (/** @type {any} */ (req).authUser).username;
            updateData.authRequired = true;
        }

        await userRef.set(updateData, { merge: true });
        res.status(200).json({ message: 'Preferences updated successfully.' });
    } catch (error) {
        console.error('Error updating user preferences:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
}

router.patch('/preferences', requireMinAppVersion, handleUpdatePreferences);
router.post('/preferences', requireMinAppVersion, handleUpdatePreferences);

router.post('/save-player', requireMinAppVersion, async (req, res) => {
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

        if (/** @type {any} */ (req).authUser && /** @type {any} */ (req).authUser.userId !== userId) {
            return res.status(403).json({
                reason: 'unauthorizedAccess',
                message: 'Authenticated users can only access their own user ID.'
            });
        }

        const cleanedTag = tag.startsWith('#') ? tag.substring(1) : tag;
        const userRef = db.collection('userStates').doc(userId);
        const userDoc = await userRef.get();
        const existingUserData = userDoc.exists ? userDoc.data() : null;
        if (isLegacyOreCalcOrigin(req) && isRestrictedFromOreCalc(existingUserData)) {
            return res.status(423).json({
                reason: 'accountMigratedToClashCalc',
                message: 'This account has been migrated to ClashCalc and cannot be modified from OreCalc.',
                isMigratedToClashCalc: true
            });
        }
        if (userDoc.exists && !(await isAuthorizedForUser(userId, /** @type {any} */ (req).authUser, userDoc.data()))) {
            return res.status(403).json({
                reason: 'unauthorizedAccess',
                message: 'Authentication required to modify this account.'
            });
        }
        const playerDocRef = userRef.collection('players').doc(cleanedTag);
        const sanitizedPlayer = sanitizePlayerData(playerData);

        // Save protection: do not clobber existing valid playerProfile with null/missing
        if (!sanitizedPlayer.playerProfile || !sanitizedPlayer.playerProfile.townHallLevel) {
            const existingDoc = await playerDocRef.get();
            if (existingDoc.exists && existingDoc.data()?.playerProfile) {
                sanitizedPlayer.playerProfile = existingDoc.data().playerProfile;
            } else {
                const hydrated = await hydratePlayerProfileFromCache(cleanedTag, 'UserData SaveSingle');
                if (hydrated) {
                    sanitizedPlayer.playerProfile = hydrated;
                }
            }
        }

        const batch = db.batch();
        // Atomic overwrite without merge: true to prevent trapping deleted or obsolete properties
        batch.set(playerDocRef, sanitizedPlayer);
        batch.set(userRef, {
            timestamp: new Date().toISOString(),
            isMigrated: true,
            isMigratedToClashCalc: true,
            migratedAt: existingUserData?.migratedAt || new Date().toISOString()
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

        if (/** @type {any} */ (req).authUser && /** @type {any} */ (req).authUser.userId !== userId) {
            return res.status(403).json({
                reason: 'unauthorizedAccess',
                message: 'Authenticated users can only access their own user ID.'
            });
        }

        const userRef = db.collection('userStates').doc(userId);
        const doc = await userRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'notFound', message: 'User data not found.' });
        }

        const mainData = doc.data();
        if (isLegacyOreCalcOrigin(req) && isRestrictedFromOreCalc(mainData)) {
            return res.status(423).json({
                reason: 'accountMigratedToClashCalc',
                message: 'This account has been migrated to ClashCalc and cannot be accessed from OreCalc.',
                isMigratedToClashCalc: true
            });
        }
        if (mainData?.authRequired && !(await isAuthorizedForUser(userId, /** @type {any} */ (req).authUser, mainData))) {
            return res.status(403).json({
                reason: 'unauthorizedAccess',
                message: 'Authentication required to access this account.'
            });
        }

        const playersSnapshot = await userRef.collection('players').get();
        const allPlayersData = mainData.allPlayersData || {};

        if (!playersSnapshot.empty) {
            for (const playerDoc of playersSnapshot.docs) {
                const pData = sanitizePlayerData(playerDoc.data());
                // Auto-healing: If playerProfile is missing or null, attempt hydration from playersCache
                if (!pData.playerProfile || !pData.playerProfile.townHallLevel) {
                    const hydrated = await hydratePlayerProfileFromCache(playerDoc.id, 'UserData Load');
                    if (hydrated) {
                        pData.playerProfile = hydrated;
                        playerDoc.ref.set({ playerProfile: hydrated }, { merge: true }).catch(() => {});
                    }
                }
                allPlayersData[playerDoc.id] = pData;
            }
        }

        // Restore any missing player subcollection documents that are present in savedPlayerTags
        if (Array.isArray(mainData.savedPlayerTags)) {
            for (const rawTag of mainData.savedPlayerTags) {
                const cleanTag = normalizeTag(rawTag);
                if (cleanTag && cleanTag !== 'DEFAULT0' && !allPlayersData[cleanTag]) {
                    const hydrated = await hydratePlayerProfileFromCache(cleanTag, 'UserData Load');
                    if (hydrated) {
                        const restoredDoc = {
                            playerProfile: hydrated,
                            currency: { code: 'USD', globalPricing: {} }
                        };
                        allPlayersData[cleanTag] = restoredDoc;
                        userRef.collection('players').doc(cleanTag).set(restoredDoc, { merge: true }).catch(() => {});
                    }
                }
            }
        }

        const assembledData = /** @type {any} */ ({
            ...mainData,
            allPlayersData
        });

        if (assembledData.uiSettings) {
            delete assembledData.uiSettings.saveError;
        }

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

    if (/** @type {any} */ (req).authUser && /** @type {any} */ (req).authUser.userId !== userId) {
        return res.status(403).json({
            reason: 'unauthorizedAccess',
            message: 'Authenticated users can only access their own user ID.'
        });
    }

    try {
        const userRef = db.collection('userStates').doc(userId);
        const userDoc = await userRef.get();
        if (userDoc.exists && isLegacyOreCalcOrigin(req) && isRestrictedFromOreCalc(userDoc.data())) {
            return res.status(423).json({
                reason: 'accountMigratedToClashCalc',
                message: 'This account has been migrated to ClashCalc and cannot be deleted from OreCalc.',
                isMigratedToClashCalc: true
            });
        }
        const playersSnapshot = await userRef.collection('players').get();
        const deleteBatch = db.batch();
        playersSnapshot.forEach(pDoc => deleteBatch.delete(pDoc.ref));
        deleteBatch.delete(userRef);
        await deleteBatch.commit();

        const nowIso = new Date().toISOString();
        await db.collection('deletedUuids').doc(userId).set({
            deletedAt: nowIso,
            serverTimestamp: FieldValue.serverTimestamp(),
            reason: 'user_requested'
        });

        const emailSent = await sendAccountDeletionNotice(userId, req);

        res.status(200).json({ message: 'Data deleted and user ID locked successfully.', emailSent });
    } catch (error) {
        console.error('Error deleting user data:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

router.post('/mark-migrated', async (req, res) => {
    const { userId } = req.body;

    if (!isValidUserId(userId)) {
        return res.status(400).json({ reason: 'invalidUserId', message: 'Invalid user ID format.' });
    }

    try {
        if (await isUserDeleted(userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        if (/** @type {any} */ (req).authUser && /** @type {any} */ (req).authUser.userId !== userId) {
            return res.status(403).json({
                reason: 'unauthorizedAccess',
                message: 'Authenticated users can only access their own user ID.'
            });
        }

        const userRef = db.collection('userStates').doc(userId);
        const doc = await userRef.get();
        const nowIso = new Date().toISOString();

        if (doc.exists) {
            await userRef.set({
                isMigratedToClashCalc: true,
                migratedAt: doc.data()?.migratedAt || nowIso
            }, { merge: true });
            res.status(200).json({ message: 'Account marked as migrated to ClashCalc.' });
        } else {
            res.status(200).json({ message: 'User does not exist in cloud. No migration needed.', migrated: false });
        }
    } catch (error) {
        console.error('Error marking user migrated:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

module.exports = router;
