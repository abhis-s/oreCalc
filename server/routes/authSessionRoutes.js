const express = require('express');
const { db } = require('../services/firebase.js');
const { generateToken } = require('../services/authService.js');
const { requireAuth } = require('../middleware/authMiddleware.js');
const {
    parseUserAgent,
    generateSessionId,
    createSessionRecord,
    appendSession,
    formatSessionsForClient,
    createPairingToken,
    consumePairingToken,
    getPairingTokenStatus,
    cancelPairingToken
} = require('../services/sessionService.js');

const router = express.Router();

router.get('/sessions', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    try {
        const cleanUsername = authUser.username.toLowerCase();
        const doc = await db.collection('accounts').doc(cleanUsername).get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data() || {};
        const existingSessions = Array.isArray(account.sessions) ? account.sessions : [];
        let currentSid = authUser.sid;

        if (!currentSid && existingSessions.length > 0) {
            const ua = req.headers ? req.headers['user-agent'] : '';
            const { platform, browser } = parseUserAgent(typeof ua === 'string' ? ua : '');
            const match = existingSessions.find(s => s.platform === platform && s.browser === browser);
            if (match) {
                currentSid = match.sessionId;
            } else {
                currentSid = existingSessions[0].sessionId;
            }
        }

        const sessions = formatSessionsForClient(existingSessions, currentSid);
        res.status(200).json({ sessions });
    } catch (err) {
        console.error('[Auth] Fetch sessions error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to fetch sessions.' });
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

    const sessionId = generateSessionId();
    const sessionRecord = createSessionRecord(req, sessionId);
    const deviceName = `${sessionRecord.browser} on ${sessionRecord.platform}`;
    const challenge = consumePairingToken(pairingToken, { deviceName, sessionId });
    if (!challenge) {
        return res.status(400).json({ reason: 'pairingExpired', message: 'Pairing code expired.' });
    }

    try {
        const cleanUsername = challenge.username.toLowerCase();
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data() || {};
        const updatedSessions = appendSession(account.sessions, sessionRecord);

        await accountRef.update({ sessions: updatedSessions });
        const token = generateToken({ username: account.username, userId: account.userId }, sessionId);

        res.status(200).json({
            token,
            username: account.username,
            userId: account.userId,
            avatar: account.avatar,
            hasPassword: Boolean(account.passwordHash)
        });
    } catch (err) {
        console.error('[Auth] Claim pairing error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to pair device.' });
    }
});

module.exports = router;
