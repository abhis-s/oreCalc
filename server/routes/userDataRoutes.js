const express = require('express');
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_DEFAULTS, SERVER_CONSTANTS } = require('../constants.js');
const { isValidUserId, isValidTag, normalizeTag, compareVersions } = require('../utils/validation.js');
const { admin, db, isUserDeleted } = require('../services/firebase.js');
const { extractAuthUser, isAuthorizedForUser } = require('../middleware/authMiddleware.js');

const router = express.Router();
// @ts-ignore
const sensitiveLimiter = rateLimit(RATE_LIMIT_DEFAULTS.sensitive);

router.use(extractAuthUser);

/**
 * Strips auto-placed calendar chips from dates.
 * @param {Record<string, Record<string, string[]>>} [dates]
 * @returns {Record<string, Record<string, string[]>>}
 */
function sanitizeCalendarDates(dates) {
    if (!dates || typeof dates !== 'object') return {};
    const cleanDates = {};
    for (const monthKey in dates) {
        const monthDays = dates[monthKey];
        if (!monthDays || typeof monthDays !== 'object') continue;
        const cleanDays = {};
        for (const dayKey in monthDays) {
            const chips = monthDays[dayKey];
            if (Array.isArray(chips)) {
                const cleanChips = chips.filter(id => typeof id === 'string' && !id.endsWith('-cal-auto'));
                if (cleanChips.length > 0) cleanDays[dayKey] = cleanChips;
            }
        }
        if (Object.keys(cleanDays).length > 0) cleanDates[monthKey] = cleanDays;
    }
    return cleanDates;
}

/**
 * Detects whether an incoming request originated from the legacy OreCalc domain.
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isLegacyOreCalcOrigin(req) {
    const origin = String(req.headers.origin || '').toLowerCase();
    const referer = String(req.headers.referer || '').toLowerCase();
    const clientDomain = String(req.headers['x-client-domain'] || '').toLowerCase();

    return origin.includes('orecalc.tech') ||
        origin.includes('orecalc-beta.pages.dev') ||
        referer.includes('orecalc.tech') ||
        referer.includes('orecalc-beta.pages.dev') ||
        clientDomain.includes('orecalc.tech');
}

/**
 * Checks whether an account is restricted from being accessed on the legacy OreCalc domain.
 * @param {Record<string, any>|null|undefined} docData
 * @returns {boolean}
 */
function isRestrictedFromOreCalc(docData) {
    if (!docData) return false;
    return Boolean(
        docData.isMigratedToClashCalc ||
        docData.ownerAccount ||
        docData.authRequired
    );
}

/**
 * Sanitizes a player payload for Firestore persistence and retrieval.
 * @param {Record<string, any>} playerData
 * @returns {Record<string, any>}
 */
function sanitizePlayerData(playerData) {
    if (!playerData || typeof playerData !== 'object') return playerData;
    const clean = { ...playerData };
    if (clean.playerProfile && typeof clean.playerProfile === 'object') {
        const p = clean.playerProfile;
        const cleanTag = (p.tag || '').toUpperCase().replace(/^#+/, '');
        let spells = null;
        if (p.spells && typeof p.spells === 'object' && !Array.isArray(p.spells)) {
            spells = {
                lightning: Number(p.spells.lightning) || 1,
                earthquake: Number(p.spells.earthquake) || 1
            };
        } else if (Array.isArray(p.spells)) {
            let zapLvl = 1;
            let eqLvl = 1;
            for (const sp of p.spells) {
                if (!sp || !sp.name) continue;
                const spClean = sp.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                if (spClean === 'lightning_spell' || spClean === 'lightning') zapLvl = Number(sp.level) || 1;
                else if (spClean === 'earthquake_spell' || spClean === 'earthquake') eqLvl = Number(sp.level) || 1;
            }
            spells = { lightning: zapLvl, earthquake: eqLvl };
        }

        const homeHeroes = Array.isArray(p.heroes)
            ? p.heroes.filter(h => h && (h.village === 'home' || !h.village))
            : [];
        const ownedHeroes = p.ownedHeroes && typeof p.ownedHeroes === 'object'
            ? p.ownedHeroes
            : Object.fromEntries(homeHeroes.map(h => [h.name, {
                level: h.level,
                maxLevel: h.maxLevel,
                equipment: h.equipment?.map(eq => ({ name: eq.name, level: eq.level })) || []
            }]));

        const homeEquipment = Array.isArray(p.heroEquipment)
            ? p.heroEquipment.filter(e => e && (e.village === 'home' || !e.village))
            : [];
        const ownedEquipment = p.ownedEquipment && typeof p.ownedEquipment === 'object'
            ? p.ownedEquipment
            : Object.fromEntries(homeEquipment.map(e => [e.name, e.level]));

        const labTroops = p.labTroops && typeof p.labTroops === 'object'
            ? p.labTroops
            : Object.fromEntries(
                (Array.isArray(p.troops) ? p.troops.filter(t => t && t.village === 'home') : [])
                    .filter(t => t.name === 'Barbarian' || t.name === 'Archer')
                    .map(t => [t.name.toLowerCase(), t.level])
            );

        const clan = p.clan ? {
            tag: p.clan.tag || '',
            name: p.clan.name || '',
            badgeUrls: {
                small: p.clan.badgeUrls?.small || '',
                medium: p.clan.badgeUrls?.medium || '',
                large: p.clan.badgeUrls?.large || ''
            }
        } : null;

        const leagueTier = p.leagueTier ? {
            id: p.leagueTier.id,
            name: p.leagueTier.name,
            iconUrls: {
                small: p.leagueTier.iconUrls?.small || '',
                large: p.leagueTier.iconUrls?.large || ''
            }
        } : (p.league ? {
            id: p.league.id,
            name: p.league.name,
            iconUrls: {
                small: p.league.iconUrls?.small || '',
                large: p.league.iconUrls?.large || ''
            }
        } : null);

        clean.playerProfile = {
            tag: cleanTag,
            name: p.name || cleanTag,
            townHallLevel: Number(p.townHallLevel) || 1,
            clanBadgeUrl: p.clanBadgeUrl || p.clan?.badgeUrls?.small || '',
            clan,
            role: p.role || null,
            leagueTier,
            trophies: Number(p.trophies) || 0,
            warStars: Number(p.warStars) || 0,
            ownedHeroes,
            ownedEquipment,
            labTroops: labTroops || {},
            spells: spells || { lightning: 1, earthquake: 1 }
        };
        if (p.clanWarStats) clean.playerProfile.clanWarStats = p.clanWarStats;
        if (p.cwlSeasons) clean.playerProfile.cwlSeasons = p.cwlSeasons;
        if (p.lastCwlFetchTime) clean.playerProfile.lastCwlFetchTime = p.lastCwlFetchTime;
    }
    if (clean.planner?.calendar?.dates) {
        clean.planner = {
            ...clean.planner,
            calendar: {
                ...clean.planner.calendar,
                dates: sanitizeCalendarDates(clean.planner.calendar.dates)
            }
        };
    }
    return clean;
}

/**
 * Enforces that the client request meets the minimum supported application version.
 * Checks x-app-version header first, falling back to body payload version.
 * Rejects outdated versions with HTTP 426 Upgrade Required.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireMinAppVersion(req, res, next) {
    const clientVersion = String(
        req.headers['x-app-version'] ||
        req.body?.data?.appVersion ||
        req.body?.appVersion ||
        '1.0.0'
    );
    if (compareVersions(clientVersion, SERVER_CONSTANTS.MIN_SUPPORTED_APP_VERSION) < 0) {
        return res.status(426).json({
            reason: 'updateRequired',
            message: `Application version ${SERVER_CONSTANTS.MIN_SUPPORTED_APP_VERSION} or higher is required. Please update or reload the app.`
        });
    }
    next();
}

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

        const { FieldValue } = await import('firebase-admin/firestore');
        const batch = db.batch();

        const allPlayers = data.allPlayersData || {};
        const uiSettings = (data.uiSettings && typeof data.uiSettings === 'object') ? { ...data.uiSettings } : {};
        delete uiSettings.saveError;

        const globalData = {
            appVersion: data.appVersion || SERVER_CONSTANTS.MIN_SUPPORTED_APP_VERSION,
            savedPlayerTags: (Array.isArray(data.savedPlayerTags) ? data.savedPlayerTags : [])
                .map(t => normalizeTag(t))
                .filter(t => isValidTag(t)),
            uiSettings,
            timestamp: data.timestamp || new Date().toISOString(),
            isMigrated: true,
            isMigratedToClashCalc: true,
            migratedAt: existingData?.migratedAt || new Date().toISOString(),
            allPlayersData: FieldValue.delete(),
            // Future Auth Schema Hooks
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

        for (const [tag, playerData] of Object.entries(allPlayers)) {
            if (isValidTag(tag) && playerData && typeof playerData === 'object') {
                const cleanedDocTag = tag.startsWith('#') ? tag.substring(1) : tag;
                incomingCleanTags.add(cleanedDocTag);
                const playerDocRef = playersCollection.doc(cleanedDocTag);
                const sanitizedPlayer = sanitizePlayerData(playerData);
                // Atomic overwrite without merge: true to purge obsolete fields (achievements/troops bloat)
                batch.set(playerDocRef, sanitizedPlayer);
            }
        }

        // Prune subcollection documents no longer present in incoming payload
        if (!existingPlayersSnapshot.empty) {
            existingPlayersSnapshot.forEach(docSnap => {
                if (!incomingCleanTags.has(docSnap.id)) {
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
 * Sanitizes and whitelists user preferences.
 *
 * @param {Record<string, any>} prefs
 * @returns {Record<string, any>}
 */
function sanitizePreferences(prefs) {
    if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return {};
    const sanitized = {};

    if (typeof prefs.theme === 'string' && ['dark', 'light'].includes(prefs.theme)) {
        sanitized.theme = prefs.theme;
    }
    if (typeof prefs.accentColor === 'string') {
        const allowedColors = ['blue', 'gold', 'purple', 'green', 'red', 'random'];
        if (allowedColors.includes(prefs.accentColor)) {
            sanitized.accentColor = prefs.accentColor;
        }
    }
    if (typeof prefs.language === 'string') {
        const allowedLangs = ['en', 'de', 'tr', 'zh'];
        if (allowedLangs.includes(prefs.language)) {
            sanitized.language = prefs.language;
        }
    }
    if (prefs.currency && typeof prefs.currency === 'object') {
        sanitized.currency = {
            code: typeof prefs.currency.code === 'string' ? prefs.currency.code.slice(0, 5).toUpperCase() : 'USD',
            ...(prefs.currency.globalPricing && typeof prefs.currency.globalPricing === 'object' ? { globalPricing: prefs.currency.globalPricing } : {})
        };
    } else if (typeof prefs.currency === 'string') {
        sanitized.currency = { code: prefs.currency.slice(0, 5).toUpperCase() };
    }
    if (typeof prefs.cardLayout === 'string' && ['cozy', 'compact0', 'compact1', 'quilt'].includes(prefs.cardLayout)) {
        sanitized.cardLayout = prefs.cardLayout;
    }
    if (typeof prefs.summaryTimeframe === 'string' && ['monthly', 'weekly'].includes(prefs.summaryTimeframe)) {
        sanitized.summaryTimeframe = prefs.summaryTimeframe;
    }
    if (typeof prefs.leagueModifier === 'string' && ['standard', 'esports'].includes(prefs.leagueModifier)) {
        sanitized.leagueModifier = prefs.leagueModifier;
    }
    const booleanFields = [
        'enableLevelInput',
        'hideMaxedEquipment',
        'hideLockedEquipment',
        'hideProfileStats',
        'cloudSync'
    ];
    for (const field of booleanFields) {
        if (typeof prefs[field] === 'boolean') {
            sanitized[field] = prefs[field];
        }
    }
    if (Array.isArray(prefs.settingsCardOrder)) {
        sanitized.settingsCardOrder = prefs.settingsCardOrder.filter(item => typeof item === 'string').slice(0, 20);
    }
    if (prefs.uiTimestamps && typeof prefs.uiTimestamps === 'object' && !Array.isArray(prefs.uiTimestamps)) {
        sanitized.uiTimestamps = {};
        for (const [key, val] of Object.entries(prefs.uiTimestamps)) {
            if (typeof val === 'number' || typeof val === 'string') {
                sanitized.uiTimestamps[key] = val;
            }
        }
    }
    if (typeof prefs.stateResetEpoch === 'number') {
        sanitized.stateResetEpoch = prefs.stateResetEpoch;
    }
    return sanitized;
}

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
            updateData.appVersion = req.headers['x-app-version'] || SERVER_CONSTANTS.MIN_SUPPORTED_APP_VERSION;
            updateData.savedPlayerTags = [];
            updateData.isMigrated = true;
            if (/** @type {any} */ (req).authUser) {
                updateData.ownerAccount = (/** @type {any} */ (req).authUser).username;
                updateData.authRequired = true;
            }
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

        const batch = db.batch();
        // Atomic overwrite without merge: true to prevent trapping deleted or obsolete properties
        batch.set(playerDocRef, sanitizePlayerData(playerData));
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
            playersSnapshot.forEach(playerDoc => {
                allPlayersData[playerDoc.id] = sanitizePlayerData(playerDoc.data());
            });
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

router.post('/mark-migrated', async (req, res) => {
    const { userId } = req.body;

    if (!isValidUserId(userId)) {
        return res.status(400).json({ reason: 'invalidUserId', message: 'Invalid user ID format.' });
    }

    try {
        if (await isUserDeleted(userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        const userRef = db.collection('userStates').doc(userId);
        const doc = await userRef.get();
        const nowIso = new Date().toISOString();

        if (doc.exists) {
            await userRef.set({
                isMigratedToClashCalc: true,
                migratedAt: doc.data()?.migratedAt || nowIso
            }, { merge: true });
        } else {
            await userRef.set({
                appVersion: SERVER_CONSTANTS.MIN_SUPPORTED_APP_VERSION,
                savedPlayerTags: [],
                isMigrated: true,
                isMigratedToClashCalc: true,
                migratedAt: nowIso,
                timestamp: nowIso
            }, { merge: true });
        }

        res.status(200).json({ message: 'Account marked as migrated to ClashCalc.' });
    } catch (error) {
        console.error('Error marking user migrated:', error);
        res.status(500).json({ reason: 'internalError', message: 'Internal Server Error', error: error.message });
    }
});

module.exports = router;
