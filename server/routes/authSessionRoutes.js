const express = require('express');
const { db, isUserDeleted } = require('../services/firebase.js');
const { generateToken } = require('../services/authService.js');
const { requireAuth } = require('../middleware/authMiddleware.js');
const {
    SESSION_ACTIVITY_THROTTLE_MS,
    parseUserAgent,
    generateSessionId,
    createSessionRecord,
    pruneExpiredSessions,
    resolveClaimSession,
    validateAndRefreshSession,
    removeSession,
    formatSessionsForClient
} = require('../services/sessionService.js');
const {
    createPairingToken,
    reservePairingToken,
    completePairingClaim,
    releasePairingToken,
    getPairingTokenStatus,
    cancelPairingToken
} = require('../services/pairingService.js');

const router = express.Router();

router.get('/sessions', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data() || {};
        const now = Date.now();
        const rawSessions = Array.isArray(account.sessions) ? account.sessions : [];
        const activeSessions = pruneExpiredSessions(rawSessions, now);
        let sessionsChanged = activeSessions.length !== rawSessions.length;
        let currentSid = authUser.sid;

        if (currentSid) {
            const matchIdx = activeSessions.findIndex(s => s.sessionId === currentSid);
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
        } else if (activeSessions.length > 0) {
            const ua = req.headers ? req.headers['user-agent'] : '';
            const { platform, browser } = parseUserAgent(typeof ua === 'string' ? ua : '');
            const match = activeSessions.find(s => s.platform === platform && s.browser === browser);
            currentSid = match ? match.sessionId : activeSessions[0].sessionId;
        }

        if (sessionsChanged) {
            await accountRef.update({ sessions: activeSessions });
        }

        const sessions = formatSessionsForClient(activeSessions, currentSid);
        res.status(200).json({ sessions });
    } catch (err) {
        console.error('[Auth] Fetch sessions error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to fetch sessions.' });
    }
});

router.post('/session/refresh', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(401).json({ reason: 'sessionRevoked', message: 'This session is no longer active.' });
        }

        const account = doc.data() || {};
        if (await isUserDeleted(account.userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        const candidateSession = createSessionRecord(req, generateSessionId());
        const validation = validateAndRefreshSession(account.sessions, candidateSession, authUser);

        if (!validation.valid) {
            if (validation.changed) {
                await accountRef.update({ sessions: validation.sessions });
            }
            return res.status(401).json({ reason: validation.reason || 'sessionRevoked', message: 'This session is no longer active.' });
        }

        if (validation.changed) {
            await accountRef.update({ sessions: validation.sessions });
        }

        if (validation.shouldRenewToken) {
            const token = generateToken({ username: account.username, userId: account.userId }, validation.sessionId);
            return res.status(200).json({
                valid: true,
                renewed: true,
                token,
                username: account.username,
                userId: account.userId,
                avatar: account.avatar,
                hasPassword: Boolean(account.passwordHash),
                isSupporter: Boolean(account.isSupporter)
            });
        }

        return res.status(200).json({ valid: true, renewed: false });
    } catch (err) {
        console.error('[Auth] Refresh session error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to validate session.' });
    }
});

router.post('/logout', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (doc.exists) {
            const account = doc.data() || {};
            const rawSessions = Array.isArray(account.sessions) ? account.sessions : [];
            const ua = req.headers ? req.headers['user-agent'] : '';
            const fallbackMeta = parseUserAgent(typeof ua === 'string' ? ua : '');
            const updatedSessions = removeSession(rawSessions, authUser.sid, fallbackMeta);
            if (updatedSessions.length !== rawSessions.length) {
                await accountRef.update({ sessions: updatedSessions });
            }
        }
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('[Auth] Logout session revocation error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to sign out session.' });
    }
});

router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    const targetSid = req.params.sessionId;

    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data() || {};
        const existingSessions = Array.isArray(account.sessions) ? account.sessions : [];
        const filtered = existingSessions.filter(s => s.sessionId !== targetSid);

        if (filtered.length === existingSessions.length) {
            return res.status(404).json({ reason: 'sessionNotFound', message: 'Session not found.' });
        }

        await accountRef.update({ sessions: filtered });
        const isCurrent = Boolean(authUser.sid && authUser.sid === targetSid);
        res.status(200).json({ success: true, message: 'Session revoked.', isCurrent });
    } catch (err) {
        console.error('[Auth] Revoke session error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to revoke session.' });
    }
});

router.post('/sessions/revoke-others', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;

    try {
        const cleanUsername = authUser.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data() || {};
        const existingSessions = Array.isArray(account.sessions) ? account.sessions : [];
        const kept = existingSessions.filter(s => s.sessionId === authUser.sid);

        await accountRef.update({ sessions: kept });
        res.status(200).json({ success: true, message: 'All other sessions revoked.', remainingCount: kept.length });
    } catch (err) {
        console.error('[Auth] Revoke other sessions error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to revoke other sessions.' });
    }
});

router.post('/pairing/token', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    try {
        const pairing = createPairingToken(authUser.username, authUser.userId);
        res.status(200).json(pairing);
    } catch (err) {
        console.error('[Auth] Create pairing token error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to generate pairing token.' });
    }
});

router.get('/pairing/status', requireAuth, async (req, res) => {
    const token = req.query.token;
    if (!token || typeof token !== 'string') {
        return res.status(400).json({ status: 'invalid' });
    }
    const result = getPairingTokenStatus(token);
    res.status(200).json(result);
});

router.post('/pairing/cancel', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    const { pairingToken } = req.body || {};
    if (!pairingToken || typeof pairingToken !== 'string') {
        return res.status(400).json({ reason: 'invalidPayload', message: 'Pairing token is required.' });
    }
    const cancelled = cancelPairingToken(pairingToken, authUser.username);
    res.status(200).json({ success: true, cancelled });
});

router.post('/pairing/claim', async (req, res) => {
    const { pairingToken } = req.body || {};
    if (!pairingToken || typeof pairingToken !== 'string') {
        return res.status(400).json({ reason: 'invalidPayload', message: 'Pairing token is required.' });
    }

    const challenge = reservePairingToken(pairingToken);
    if (!challenge) {
        return res.status(400).json({ reason: 'pairingExpired', message: 'Pairing code expired.' });
    }

    try {
        const cleanUsername = challenge.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            cancelPairingToken(pairingToken);
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data() || {};
        const candidateSession = createSessionRecord(req, generateSessionId());
        const callerAuth = /** @type {any} */ (req).authUser || null;
        const { sessions: updatedSessions, sessionId, alreadyLinked } = resolveClaimSession(
            account.sessions,
            candidateSession,
            callerAuth,
            { username: account.username, userId: account.userId }
        );

        await accountRef.update({ sessions: updatedSessions });

        const resolvedRecord = updatedSessions.find(s => s.sessionId === sessionId) || candidateSession;
        const deviceName = `${resolvedRecord.browser} on ${resolvedRecord.platform}`;
        completePairingClaim(pairingToken, { deviceName, sessionId, alreadyLinked });

        const token = generateToken({ username: account.username, userId: account.userId }, sessionId);
        res.status(200).json({
            token,
            username: account.username,
            userId: account.userId,
            avatar: account.avatar,
            hasPassword: Boolean(account.passwordHash),
            isSupporter: Boolean(account.isSupporter),
            alreadyLinked
        });
    } catch (err) {
        releasePairingToken(pairingToken);
        console.error('[Auth] Claim pairing error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to pair device.' });
    }
});

module.exports = router;
