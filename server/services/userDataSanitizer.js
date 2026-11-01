const { SERVER_CONSTANTS } = require('../constants.js');
const { compareVersions } = require('../utils/validation.js');
const { db } = require('./firebase.js');
const { resolveEmailDomain } = require('./alertDiagnostics.js');

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
 * Hydrates a sanitized playerProfile from the global playersCache collection when missing.
 *
 * @param {string} cleanedTag - Normalized tag without leading hash.
 * @param {string} logPrefix - Context label for error logging.
 * @returns {Promise<Record<string, any>|null>}
 */
async function hydratePlayerProfileFromCache(cleanedTag, logPrefix) {
    try {
        const cacheDoc = await db.collection('playersCache').doc(cleanedTag.toUpperCase()).get();
        if (cacheDoc.exists) {
            const cached = cacheDoc.data();
            if (cached && cached.playerData) {
                const healed = sanitizePlayerData({ playerProfile: cached.playerData });
                if (healed && healed.playerProfile) {
                    return healed.playerProfile;
                }
            }
        }
    } catch (e) {
        console.error(`[${logPrefix}] Failed to hydrate playerProfile for ${cleanedTag}:`, e);
    }
    return null;
}

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

/**
 * Dispatches a legal/compliance notification email when a user account is deleted.
 *
 * @param {string} userId
 * @param {import('express').Request} req
 * @returns {Promise<boolean>}
 */
async function sendAccountDeletionNotice(userId, req) {
    if (!process.env.SMTP_USER || !process.env.SMTP_HOST) return false;
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

        const domain = resolveEmailDomain('', req.headers.host, req.headers.origin);
        const shortUserId = userId ? userId.substring(0, 8) : 'anon';

        const mailOptions = {
            from: `"ClashCalc System" <${process.env.EMAIL_FROM || 'noreply@clashcalc.com'}>`,
            to: process.env.RECIPIENT_EMAIL_LEGAL || 'legal@clashcalc.com',
            subject: `[${domain}] Account Deletion: User ${shortUserId}`,
            text: [
                '================================================================================',
                'ACCOUNT DELETION CONFIRMATION',
                '================================================================================',
                '',
                'DELETION DETAILS',
                '--------------------------------------------------------------------------------',
                `Environment : ${domain}`,
                `User ID     : ${userId}`,
                `Time        : ${new Date().toISOString()}`,
                '',
                'SYSTEM ACTION',
                '--------------------------------------------------------------------------------',
                'The user ID has been deleted from userStates and locked in the deletedUuids registry.',
                '',
                '================================================================================',
                'Notification managed by ClashCalc Legal & Compliance'
            ].join('\n')
        };

        await transporter.sendMail(mailOptions);
        console.log(`[DELETION] Notification email sent successfully for UserID: ${userId}`);
        return true;
    } catch (mailError) {
        console.error('[DELETION] Failed to send notification email:', mailError);
        return false;
    }
}

module.exports = {
    isLegacyOreCalcOrigin,
    isRestrictedFromOreCalc,
    sanitizePlayerData,
    hydratePlayerProfileFromCache,
    sanitizePreferences,
    requireMinAppVersion,
    sendAccountDeletionNotice
};
