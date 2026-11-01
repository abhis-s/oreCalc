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
    generateSessionId,
    createSessionRecord,
    appendSession
} = require('../services/sessionService.js');
const {
    isTurnstileEnabled,
    getTurnstileSiteKey,
    isIpAllowlisted,
    verifyTurnstileToken
} = require('../services/turnstileService.js');

const router = express.Router();
// @ts-ignore
const authLimiter = rateLimit({
    ...RATE_LIMIT_DEFAULTS.auth,
    skip: (req) => process.env.NODE_ENV === 'development' || req.method === 'GET'
});

router.use(authLimiter);
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
        res.status(201).json({ token, username: displayUsername, userId: finalUserId, avatar: initialAvatar, hasPassword: true });
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
            hasPassword: true
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

        res.status(200).json({
            username: account.username,
            userId: account.userId,
            avatar: account.avatar,
            hasPassword: Boolean(account.passwordHash),
            passkeysCount: (account.passkeys || []).length,
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

        await accountRef.update({ avatar });
        res.status(200).json({ message: 'Profile updated.', avatar });
    } catch (err) {
        console.error('[Auth] Update profile error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to update profile.' });
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
