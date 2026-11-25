const express = require('express');
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_DEFAULTS, AUTH_CONSTANTS, getRandomAvatar } = require('../constants.js');
const { db, isUserDeleted } = require('../services/firebase.js');
const {
    normalizeUsername,
    hashPassword,
    verifyPassword,
    generateToken,
    resolveCleanRegistrationUserId,
    pruneExpiredAuthChallenges
} = require('../services/authService.js');
const { extractAuthUser, requireAuth } = require('../middleware/authMiddleware.js');
const {
    SESSION_ACTIVITY_THROTTLE_MS,
    generateSessionId,
    createSessionRecord,
    appendSession,
    pruneExpiredSessions
} = require('../services/sessionService.js');
const {
    isTurnstileEnabled,
    getTurnstileSiteKey,
    isIpAllowlisted,
    verifyTurnstileToken
} = require('../services/turnstileService.js');
const {
    isAvatarUnlockedForUser,
    reconcileEquippedAvatar,
    verifyAndRedeemSupporterCode
} = require('../services/avatarLockService.js');
const { sendSupporterRedeemedAdminEmail } = require('../services/supporterMailService.js');

/**
 * Identifies JWT-authenticated self-service management routes that should use
 * the generous authenticated limiter instead of the strict brute-force login limiter.
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isAuthManageRoute(req) {
    const method = (req.method || '').toUpperCase();
    const routePath = req.path || '';
    if (method === 'PATCH' && routePath === '/profile') return true;
    if (method === 'POST' && (
        routePath === '/logout' ||
        routePath === '/session/refresh' ||
        routePath === '/sessions/revoke-others' ||
        routePath === '/pairing/token' ||
        routePath === '/pairing/cancel'
    )) return true;
    if (method === 'DELETE' && routePath.startsWith('/sessions/')) return true;
    return false;
}

const router = express.Router();
// @ts-ignore
const authLimiter = rateLimit({
    ...RATE_LIMIT_DEFAULTS.auth,
    skip: (req) => process.env.NODE_ENV === 'development' || req.method === 'GET' || isAuthManageRoute(req)
});
// @ts-ignore
const authManageLimiter = rateLimit({
    ...RATE_LIMIT_DEFAULTS.authManage,
    skip: (req) => process.env.NODE_ENV === 'development' || !isAuthManageRoute(req)
});

router.use(authLimiter);
router.use(authManageLimiter);
router.use(extractAuthUser);
router.use((_req, res, next) => {
    if (typeof res.setHeader === 'function') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

router.get('/turnstile-config', (req, res) => {
    const isAllowlisted = isIpAllowlisted(req.ip);
    const enabled = isTurnstileEnabled() && !isAllowlisted;
    res.status(200).json({
        enabled,
        siteKey: enabled ? getTurnstileSiteKey() : ''
    });
});

// Periodic in-memory expired challenge purge every 60 seconds
setInterval(() => {
    pruneExpiredAuthChallenges(null).catch(() => {});
}, 60 * 1000);

// Periodic Firestore expired challenge purge every 30 minutes
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
setInterval(() => {
    pruneExpiredAuthChallenges(db).catch(err => {
        console.error('[Auth] Periodic challenge prune failed:', err);
    });
}, THIRTY_MINUTES_MS);

router.post('/register-password', async (req, res) => {
    const { username, password, currentUserId, turnstileToken } = req.body || {};
    const turnstileResult = await verifyTurnstileToken(turnstileToken, req.ip);
    if (!turnstileResult.success) {
        return res.status(400).json({
            reason: turnstileResult.reason || 'captchaFailed',
            message: turnstileResult.message || 'Security check failed. Please try again.'
        });
    }

    const cleanUsername = normalizeUsername(username);

    if (!cleanUsername) {
        return res.status(400).json({ reason: 'invalidUsername', message: 'Username must be 3-20 alphanumeric characters or underscores.' });
    }
    if (!password || typeof password !== 'string' || password.length < AUTH_CONSTANTS.MIN_PASSWORD_LENGTH || password.length > AUTH_CONSTANTS.MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ reason: 'invalidPassword', message: 'Password must be at least 6 characters.' });
    }
    try {
        const finalUserId = await resolveCleanRegistrationUserId(currentUserId, cleanUsername);
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const userRef = db.collection('userStates').doc(finalUserId);
        const passwordHash = await hashPassword(password);
        const displayUsername = String(username).trim();

        const initialAvatar = getRandomAvatar();
        const sessionId = generateSessionId();
        const sessionRecord = createSessionRecord(req, sessionId);

        await db.runTransaction(async (transaction) => {
            const accDoc = await transaction.get(accountRef);
            if (accDoc.exists) {
                const err = new Error('Username taken');
                /** @type {any} */ (err).code = 'ALREADY_EXISTS';
                throw err;
            }

            transaction.set(accountRef, {
                username: displayUsername,
                userId: finalUserId,
                passwordHash,
                avatar: initialAvatar,
                passkeys: [],
                sessions: [sessionRecord],
                createdAt: Date.now()
            });

            transaction.set(userRef, {
                ownerAccount: cleanUsername,
                authRequired: true
            }, { merge: true });
        });

        const token = generateToken({ username: displayUsername, userId: finalUserId }, sessionId);
        res.status(201).json({
            token,
            username: displayUsername,
            userId: finalUserId,
            avatar: initialAvatar,
            hasPassword: true,
            isSupporter: false
        });
    } catch (err) {
        if (/** @type {any} */ (err).code === 'ALREADY_EXISTS') {
            return res.status(409).json({ reason: 'usernameTaken', message: 'This username is already taken.' });
        }
        console.error('[Auth] Registration error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to create account.' });
    }
});

router.post('/login-password', async (req, res) => {
    const { username, password, turnstileToken } = req.body || {};
    const turnstileResult = await verifyTurnstileToken(turnstileToken, req.ip);
    if (!turnstileResult.success) {
        return res.status(400).json({
            reason: turnstileResult.reason || 'captchaFailed',
            message: turnstileResult.message || 'Security check failed. Please try again.'
        });
    }

    const cleanUsername = normalizeUsername(username);

    if (!cleanUsername || !password || typeof password !== 'string' || password.length > AUTH_CONSTANTS.MAX_PASSWORD_LENGTH) {
        return res.status(400).json({ reason: 'invalidCredentials', message: 'Username and password are required.' });
    }

    try {
        const doc = await db.collection('accounts').doc(cleanUsername).get();
        if (!doc.exists) {
            return res.status(401).json({ reason: 'invalidCredentials', message: 'Incorrect username or password.' });
        }

        const account = doc.data();
        if (!account?.passwordHash) {
            return res.status(401).json({
                reason: 'passkeyOnlyAccount',
                message: 'This account was created with a Passkey. Please sign in with Passkey.'
            });
        }

        const valid = await verifyPassword(password, account.passwordHash);
        if (!valid) {
            return res.status(401).json({ reason: 'invalidCredentials', message: 'Incorrect username or password.' });
        }

        if (await isUserDeleted(account.userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        const sessionId = generateSessionId();
        const sessionRecord = createSessionRecord(req, sessionId);
        const updatedSessions = appendSession(account.sessions, sessionRecord);
        await doc.ref.update({ sessions: updatedSessions });

        const token = generateToken({ username: account.username, userId: account.userId }, sessionId);
        res.status(200).json({
            token,
            username: account.username,
            userId: account.userId,
            avatar: account.avatar,
            hasPassword: true,
            isSupporter: Boolean(account.isSupporter)
        });
    } catch (err) {
        console.error('[Auth] Password login error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Sign in failed.' });
    }
});

router.use('/', require('./authPasskeyRoutes.js'));
router.use('/', require('./authPasswordRoutes.js'));
router.use('/', require('./authSessionRoutes.js'));

router.get('/account', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data();
        if (await isUserDeleted(account.userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        const now = Date.now();
        const rawSessions = Array.isArray(account.sessions) ? account.sessions : [];
        const activeSessions = pruneExpiredSessions(rawSessions, now);
        let sessionsChanged = activeSessions.length !== rawSessions.length;

        if (authUser.sid) {
            const matchIdx = activeSessions.findIndex(s => s.sessionId === authUser.sid);
            if (matchIdx === -1) {
                if (sessionsChanged) {
                    await accountRef.update({ sessions: activeSessions });
                }
                return res.status(401).json({ reason: 'sessionRevoked', message: 'This session is no longer active.' });
            }
            const currentSession = activeSessions[matchIdx];
            if (now - (Number(currentSession.lastActiveAt || currentSession.createdAt) || 0) >= SESSION_ACTIVITY_THROTTLE_MS) {
                activeSessions[matchIdx] = { ...currentSession, lastActiveAt: now };
                sessionsChanged = true;
            }
        }

        if (sessionsChanged) {
            await accountRef.update({ sessions: activeSessions });
        }

        const { avatar: reconciledAvatar } = await reconcileEquippedAvatar(account, accountRef, db);

        res.status(200).json({
            username: account.username,
            userId: account.userId,
            avatar: reconciledAvatar,
            hasPassword: Boolean(account.passwordHash),
            passkeysCount: (account.passkeys || []).length,
            isSupporter: Boolean(account.isSupporter),
            createdAt: account.createdAt
        });
    } catch (err) {
        console.error('[Auth] Get account error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to retrieve account.' });
    }
});

router.patch('/profile', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    const { avatar } = req.body || {};

    if (!avatar || !AUTH_CONSTANTS.VALID_AVATARS.includes(avatar)) {
        return res.status(400).json({
            reason: 'invalidAvatar',
            message: `Avatar must be one of: ${AUTH_CONSTANTS.VALID_AVATARS.join(', ')}`
        });
    }

    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const accountData = doc.data() || {};
        if (AUTH_CONSTANTS.BONUS_AVATARS.includes(avatar)) {
            const isEligible = await isAvatarUnlockedForUser(accountData, avatar, db);
            if (!isEligible) {
                return res.status(403).json({
                    reason: 'avatarLocked',
                    message: 'This avatar requires completing its milestone before equipping.'
                });
            }
        }

        await accountRef.update({ avatar });
        res.status(200).json({ message: 'Profile updated.', avatar });
    } catch (err) {
        console.error('[Auth] Update profile error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to update profile.' });
    }
});

// @ts-ignore
const supporterRedeemLimiter = rateLimit({
    ...RATE_LIMIT_DEFAULTS.sensitive,
    skip: () => process.env.NODE_ENV === 'development'
});

router.post('/redeem-supporter', requireAuth, supporterRedeemLimiter, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    const { code } = req.body || {};

    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const accountData = doc.data() || {};
        const result = await verifyAndRedeemSupporterCode(accountData, code, db);
        if (!result.success) {
            return res.status(400).json({ reason: result.reason, message: result.message });
        }

        if (result.newlyActivated) {
            sendSupporterRedeemedAdminEmail({
                username: accountData.username || authUser.username,
                userId: accountData.userId || authUser.userId,
                source: result.source,
                note: result.note,
                bmcEventId: result.bmcEventId,
                codeHash: result.codeHash
            }).catch(() => {});
        }

        res.status(200).json({ message: result.message, isSupporter: true });
    } catch (err) {
        console.error('[Auth] Redeem supporter error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to redeem supporter code.' });
    }
});

router.delete('/account', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const accountData = doc.data();
        const userId = accountData?.userId;
        if (userId) {
            const userRef = db.collection('userStates').doc(userId);
            const playersSnapshot = await userRef.collection('players').get();
            const deleteBatch = db.batch();
            playersSnapshot.forEach(pDoc => deleteBatch.delete(pDoc.ref));
            deleteBatch.delete(userRef);
            await deleteBatch.commit();

            await db.collection('deletedUuids').doc(userId).set({
                deletedAt: new Date().toISOString(),
                reason: 'user_requested_account_deletion'
            });
        }

        await accountRef.delete();
        res.status(200).json({ message: 'Account deleted successfully.' });
    } catch (err) {
        console.error('[Auth] Delete account error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to delete account.' });
    }
});

module.exports = router;
