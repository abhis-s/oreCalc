const express = require('express');
const { AUTH_CONSTANTS, getRandomAvatar } = require('../constants.js');
const { db, isUserDeleted } = require('../services/firebase.js');
const {
    normalizeUsername,
    generateToken,
    generatePasskeyRegisterOptions,
    verifyPasskeyRegister,
    generatePasskeyLoginOptions,
    verifyPasskeyLogin,
    resolveCleanRegistrationUserId,
    setEphemeralChallenge,
    consumeEphemeralChallenge
} = require('../services/authService.js');
const { requireAuth } = require('../middleware/authMiddleware.js');
const {
    generateSessionId,
    createSessionRecord,
    appendSession
} = require('../services/sessionService.js');
const { verifyTurnstileToken } = require('../services/turnstileService.js');

const router = express.Router();

router.post('/register-passkey-options', async (req, res) => {
    const { username, currentUserId, turnstileToken } = req.body || {};
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
    try {
        const accountDoc = await db.collection('accounts').doc(cleanUsername).get();
        if (accountDoc.exists) {
            return res.status(409).json({ reason: 'usernameTaken', message: 'This username is already taken.' });
        }

        const finalUserId = await resolveCleanRegistrationUserId(currentUserId, cleanUsername);
        const options = await generatePasskeyRegisterOptions(username.trim(), finalUserId, [], req);
        const challengeKey = `reg_${cleanUsername}`;
        await setEphemeralChallenge(challengeKey, {
            challenge: options.challenge,
            userId: finalUserId,
            username: username.trim(),
            expiresAt: Date.now() + AUTH_CONSTANTS.CHALLENGE_TTL_MS
        });

        res.status(200).json(options);
    } catch (err) {
        console.error('[Auth] Passkey reg options error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to generate passkey options.' });
    }
});

router.post('/register-passkey-verify', async (req, res) => {
    const { username, currentUserId, attestationResponse, deviceName, passkeyName } = req.body || {};
    const candidateName = passkeyName || deviceName || '';
    const finalPasskeyName = typeof candidateName === 'string' && candidateName.trim() ? candidateName.trim() : 'Passkey';
    const cleanUsername = normalizeUsername(username);

    if (!cleanUsername || !attestationResponse) {
        return res.status(400).json({ reason: 'invalidPayload', message: 'Missing required registration parameters.' });
    }

    const challengeKey = `reg_${cleanUsername}`;
    const stored = await consumeEphemeralChallenge(challengeKey);
    if (!stored) {
        return res.status(400).json({ reason: 'challengeExpired', message: 'Registration challenge expired. Please retry.' });
    }

    try {
        const credential = await verifyPasskeyRegister(attestationResponse, stored.challenge, req);

        const candidateUserId = stored.userId || currentUserId;
        const finalUserId = await resolveCleanRegistrationUserId(candidateUserId, cleanUsername);
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const userRef = db.collection('userStates').doc(finalUserId);
        const displayUsername = stored.username || username.trim();

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
                passwordHash: null,
                avatar: initialAvatar,
                passkeys: [{
                    ...credential,
                    deviceName: finalPasskeyName,
                    createdAt: Date.now()
                }],
                sessions: [sessionRecord],
                createdAt: Date.now()
            });

            transaction.set(userRef, {
                ownerAccount: cleanUsername,
                authRequired: true
            }, { merge: true });
        });

        const token = generateToken({ username: displayUsername, userId: finalUserId }, sessionId);
        res.status(201).json({ token, username: displayUsername, userId: finalUserId, avatar: initialAvatar, hasPassword: false });
    } catch (err) {
        if (/** @type {any} */ (err).code === 'ALREADY_EXISTS') {
            return res.status(409).json({ reason: 'usernameTaken', message: 'This username is already taken.' });
        }
        console.error('[Auth] Passkey registration verification failed:', err);
        res.status(400).json({ reason: 'passkeyFailed', message: 'Passkey verification failed.' });
    }
});

router.post('/login-passkey-options', async (req, res) => {
    const { username } = req.body || {};
    let account = null;

    try {
        if (username) {
            const cleanUsername = normalizeUsername(username);
            if (cleanUsername) {
                const doc = await db.collection('accounts').doc(cleanUsername).get();
                if (doc.exists) {
                    account = doc.data();
                }
            }
        }

        const options = await generatePasskeyLoginOptions(account?.passkeys, req);
        const challengeId = `login_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await setEphemeralChallenge(challengeId, {
            challenge: options.challenge,
            username: account?.username?.toLowerCase(),
            expiresAt: Date.now() + AUTH_CONSTANTS.CHALLENGE_TTL_MS
        });

        res.status(200).json({ options, challengeId });
    } catch (err) {
        console.error('[Auth] Login passkey options error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to generate login options.' });
    }
});

router.post('/login-passkey-verify', async (req, res) => {
    const { challengeId, assertionResponse, username } = req.body || {};
    if (!challengeId || !assertionResponse) {
        return res.status(400).json({ reason: 'invalidPayload', message: 'Challenge ID and assertion response required.' });
    }

    const stored = await consumeEphemeralChallenge(challengeId);
    if (!stored) {
        return res.status(400).json({ reason: 'challengeExpired', message: 'Sign-in challenge expired. Please retry.' });
    }

    try {
        let accountDoc = null;
        const targetUsername = normalizeUsername(username) || stored.username;

        if (targetUsername) {
            const doc = await db.collection('accounts').doc(targetUsername).get();
            if (doc.exists) accountDoc = doc;
        }

        if (!accountDoc) {
            const credentialId = assertionResponse.id;
            const snapshot = await db.collection('accounts').get();
            for (const doc of snapshot.docs) {
                const acc = doc.data();
                if (Array.isArray(acc.passkeys) && acc.passkeys.some(pk => pk.credentialID === credentialId)) {
                    accountDoc = doc;
                    break;
                }
            }
        }

        if (!accountDoc || !accountDoc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found for this passkey.' });
        }

        const account = accountDoc.data();
        const passkeys = account.passkeys || [];
        const passkeyIndex = passkeys.findIndex(pk => pk.credentialID === assertionResponse.id);

        if (passkeyIndex === -1) {
            return res.status(401).json({ reason: 'passkeyNotFound', message: 'Passkey is not associated with this account.' });
        }

        const storedPasskey = passkeys[passkeyIndex];
        const newCounter = await verifyPasskeyLogin(assertionResponse, stored.challenge, storedPasskey, req);

        if (await isUserDeleted(account.userId)) {
            return res.status(410).json({ reason: 'deletedUser', message: 'This user account has been permanently deleted.' });
        }

        const sessionId = generateSessionId();
        const sessionRecord = createSessionRecord(req, sessionId);
        const updatedSessions = appendSession(account.sessions, sessionRecord);

        passkeys[passkeyIndex].counter = newCounter;
        await accountDoc.ref.update({
            passkeys,
            sessions: updatedSessions
        });

        const token = generateToken({ username: account.username, userId: account.userId }, sessionId);
        res.status(200).json({
            token,
            username: account.username,
            userId: account.userId,
            avatar: account.avatar,
            hasPassword: Boolean(account.passwordHash)
        });
    } catch (err) {
        console.error('[Auth] Passkey login verification failed:', err);
        res.status(401).json({ reason: 'passkeyFailed', message: 'Passkey verification failed.' });
    }
});

router.post('/passkey/add-options', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    try {
        const cleanUsername = authUser.username.toLowerCase();
        const doc = await db.collection('accounts').doc(cleanUsername).get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data();
        const options = await generatePasskeyRegisterOptions(account.username, account.userId, account.passkeys || [], req);
        const challengeKey = `add_${cleanUsername}`;
        await setEphemeralChallenge(challengeKey, {
            challenge: options.challenge,
            userId: account.userId,
            username: account.username,
            expiresAt: Date.now() + AUTH_CONSTANTS.CHALLENGE_TTL_MS
        });

        res.status(200).json(options);
    } catch (err) {
        console.error('[Auth] Add passkey options error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to generate passkey registration options.' });
    }
});

router.post('/passkey/add-verify', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    const { attestationResponse, deviceName, passkeyName } = req.body || {};
    const cleanUsername = authUser.username.toLowerCase();

    const challengeKey = `add_${cleanUsername}`;
    const stored = await consumeEphemeralChallenge(challengeKey);
    if (!stored) {
        return res.status(400).json({ reason: 'challengeExpired', message: 'Passkey challenge expired.' });
    }

    try {
        const credential = await verifyPasskeyRegister(attestationResponse, stored.challenge, req);

        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const passkeys = doc.data()?.passkeys || [];
        const candidateName = passkeyName || deviceName || '';
        const finalPasskeyName = typeof candidateName === 'string' && candidateName.trim() ? candidateName.trim() : 'Passkey';

        if (passkeys.some(pk => (pk.deviceName || '').trim().toLowerCase() === finalPasskeyName.toLowerCase())) {
            return res.status(409).json({ reason: 'duplicateDeviceName', message: 'A passkey with this name already exists.' });
        }

        passkeys.push({
            ...credential,
            deviceName: finalPasskeyName,
            createdAt: Date.now()
        });

        await accountRef.update({ passkeys });
        res.status(200).json({ message: 'Passkey registered successfully.' });
    } catch (err) {
        console.error('[Auth] Add passkey verify error:', err);
        res.status(400).json({ reason: 'passkeyFailed', message: 'Failed to verify new passkey.' });
    }
});

router.get('/passkeys', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    try {
        const cleanUsername = authUser.username.toLowerCase();
        const doc = await db.collection('accounts').doc(cleanUsername).get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const passkeys = (doc.data()?.passkeys || []).map(pk => ({
            credentialID: pk.credentialID,
            deviceName: pk.deviceName || 'Passkey Device',
            createdAt: pk.createdAt || Date.now()
        }));

        res.status(200).json({ passkeys });
    } catch (err) {
        console.error('[Auth] Fetch passkeys error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to fetch passkeys.' });
    }
});

router.delete('/passkeys/:credentialId', requireAuth, async (req, res) => {
    const authUser = /** @type {any} */ (req).authUser;
    const credentialId = req.params.credentialId;
    const cleanUsername = authUser.username.toLowerCase();

    try {
        const accountRef = db.collection('accounts').doc(cleanUsername);
        const doc = await accountRef.get();
        if (!doc.exists) {
            return res.status(404).json({ reason: 'accountNotFound', message: 'Account not found.' });
        }

        const account = doc.data();
        const passkeys = account?.passkeys || [];
        const filtered = passkeys.filter(pk => pk.credentialID !== credentialId);

        if (filtered.length === passkeys.length) {
            return res.status(404).json({ reason: 'passkeyNotFound', message: 'Passkey not found.' });
        }

        if (filtered.length === 0 && !account?.passwordHash) {
            return res.status(400).json({
                reason: 'lastCredentialRequired',
                message: 'Cannot delete the only sign-in method for this account.'
            });
        }

        await accountRef.update({ passkeys: filtered });
        res.status(200).json({ message: 'Passkey deleted successfully.' });
    } catch (err) {
        console.error('[Auth] Delete passkey error:', err);
        res.status(500).json({ reason: 'internalError', message: 'Failed to delete passkey.' });
    }
});

module.exports = router;
