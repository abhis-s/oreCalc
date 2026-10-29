const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeUsername,
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    generatePasskeyRegisterOptions,
    generatePasskeyLoginOptions,
    resolveCleanRegistrationUserId,
    setEphemeralChallenge,
    consumeEphemeralChallenge,
    pruneExpiredAuthChallenges
} = require('../services/authService.js');
const { extractAuthUser, isAuthorizedForUser } = require('../middleware/authMiddleware.js');

test('normalizeUsername handles valid and invalid usernames accurately', () => {
    assert.equal(normalizeUsername('Abhi_Ram'), 'abhi_ram');
    assert.equal(normalizeUsername('  Cool_Player99  '), 'cool_player99');
    assert.equal(normalizeUsername('abc'), 'abc');
    assert.equal(normalizeUsername('a'.repeat(20)), 'a'.repeat(20));

    // Rejections
    assert.equal(normalizeUsername('ab'), null);
    assert.equal(normalizeUsername('a'.repeat(21)), null);
    assert.equal(normalizeUsername('user-with-dash'), null);
    assert.equal(normalizeUsername('user with space'), null);
    assert.equal(normalizeUsername('user@domain'), null);
    assert.equal(normalizeUsername(''), null);
    assert.equal(normalizeUsername(null), null);
    assert.equal(normalizeUsername(undefined), null);
    assert.equal(normalizeUsername(/** @type {any} */ (12345)), null);
});

test('hashPassword and verifyPassword enforce security contracts', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hashPassword(password);

    assert.equal(typeof hash, 'string');
    assert.equal(hash.startsWith('$2'), true);

    const isMatch = await verifyPassword(password, hash);
    assert.equal(isMatch, true);

    const isMismatch = await verifyPassword('WrongPassword123!', hash);
    assert.equal(isMismatch, false);

    const isFalsy = await verifyPassword('', hash);
    assert.equal(isFalsy, false);

    // Rejection on less than 6 characters
    await assert.rejects(async () => {
        await hashPassword('12345');
    }, /Password must be between 6 and 72 characters/);

    // Acceptance on exactly 6 characters
    const minHash = await hashPassword('123456');
    assert.equal(typeof minHash, 'string');
    assert.equal(await verifyPassword('123456', minHash), true);

    // Rejection on more than 72 characters
    await assert.rejects(async () => {
        await hashPassword('a'.repeat(73));
    }, /Password must be between 6 and 72 characters/);

    // verifyPassword returns false for candidates longer than 72 characters
    const isOverlongRejected = await verifyPassword('a'.repeat(73), hash);
    assert.equal(isOverlongRejected, false);
});

test('generateToken and verifyToken manage session tokens securely', () => {
    const account = {
        username: 'Abhi_Ram',
        userId: '78f332c1-076c-40b4-a34a-6d0c1ac2c48a'
    };

    const token = generateToken(account);
    assert.equal(typeof token, 'string');

    const decoded = verifyToken(token);
    assert.equal(decoded.sub, account.username);
    assert.equal(decoded.userId, account.userId);
    assert.ok(decoded.exp > decoded.iat);

    assert.throws(() => {
        verifyToken('invalid.token.structure');
    });
});

test('session token generation enforces secret presence in production mode', () => {
    const origEnv = { ...process.env };
    try {
        delete process.env.JWT_SECRET;
        process.env.NODE_ENV = 'production';
        assert.throws(() => {
            generateToken({ username: 'Abhi_Ram', userId: '78f332c1-076c-40b4-a34a-6d0c1ac2c48a' });
        }, /JWT_SECRET environment variable is required in production/);
    } finally {
        process.env = { ...origEnv };
    }
});

test('WebAuthn option generators produce valid W3C options', async () => {
    const regOptions = await generatePasskeyRegisterOptions('Abhi_Ram', 'user_1234567890');
    assert.ok(regOptions.challenge);
    assert.equal(regOptions.rp.name, 'ClashCalc');
    assert.equal(regOptions.user.name, 'Abhi_Ram');

    const loginOptions = await generatePasskeyLoginOptions();
    assert.ok(loginOptions.challenge);
    assert.equal(loginOptions.rpId, 'localhost');
});

test('extractAuthUser middleware attaches authUser when bearer token is present', () => {
    const account = { username: 'testuser', userId: 'uid_1234567890' };
    const token = generateToken(account);

    const reqValid = /** @type {any} */ ({ headers: { authorization: `Bearer ${token}` } });
    let nextCalled = false;
    extractAuthUser(reqValid, /** @type {any} */ ({}), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(reqValid.authUser?.username, 'testuser');
    assert.equal(reqValid.authUser?.userId, 'uid_1234567890');

    const reqInvalid = /** @type {any} */ ({ headers: { authorization: 'Bearer bad.token.here' } });
    extractAuthUser(reqInvalid, /** @type {any} */ ({}), () => {});
    assert.equal(reqInvalid.authUser, null);

    const reqNone = /** @type {any} */ ({ headers: {} });
    extractAuthUser(reqNone, /** @type {any} */ ({}), () => {});
    assert.equal(reqNone.authUser, null);
});

test('isAuthorizedForUser enforces ownership rules based on authRequired flag', async () => {
    const targetUserId = 'target_uid_12345';

    // When authRequired is false, anonymous writes are allowed
    const anonAllowed = await isAuthorizedForUser(targetUserId, null, { authRequired: false });
    assert.equal(anonAllowed, true);

    // When authRequired is true, anonymous writes are blocked
    const anonBlocked = await isAuthorizedForUser(targetUserId, null, { authRequired: true });
    assert.equal(anonBlocked, false);

    // When authRequired is true, mismatched user is blocked
    const wrongUser = { username: 'intruder', userId: 'different_uid_99999' };
    const mismatchBlocked = await isAuthorizedForUser(targetUserId, wrongUser, { authRequired: true });
    assert.equal(mismatchBlocked, false);

    // When authRequired is true and matching user, write is allowed
    const ownerUser = { username: 'owner', userId: targetUserId };
    const ownerAllowed = await isAuthorizedForUser(targetUserId, ownerUser, { authRequired: true });
    assert.equal(ownerAllowed, true);
});

test('AUTH_CONSTANTS exposes valid avatar specifications', () => {
    const { AUTH_CONSTANTS, getRandomAvatar } = require('../constants.js');
    assert.ok(Array.isArray(AUTH_CONSTANTS.VALID_AVATARS));
    assert.deepEqual(AUTH_CONSTANTS.VALID_AVATARS, [
        'archer', 'builder', 'giant', 'goblin', 'golem', 'hogRider', 'hog', 'skeleton'
    ]);
    const randomAvatar = getRandomAvatar();
    assert.ok(AUTH_CONSTANTS.VALID_AVATARS.includes(randomAvatar));
});

test('password update flow verifies current password and validates new password constraints', async () => {
    const initialPassword = 'InitialSecretPass123!';
    const initialHash = await hashPassword(initialPassword);

    // Verifying current password
    assert.equal(await verifyPassword(initialPassword, initialHash), true);
    assert.equal(await verifyPassword('WrongCurrentPass123!', initialHash), false);

    // New password candidate hashing and verification
    const newPassword = 'NewlyUpdatedPass456!';
    const newHash = await hashPassword(newPassword);
    assert.equal(await verifyPassword(newPassword, newHash), true);
    assert.notEqual(initialHash, newHash);
});

test('sessionService accurately parses user agent platforms and browsers', () => {
    const { parseUserAgent } = require('../services/sessionService.js');

    assert.deepEqual(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'), {
        platform: 'macOS',
        browser: 'Chrome'
    });

    assert.deepEqual(parseUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'), {
        platform: 'iOS',
        browser: 'Safari'
    });

    assert.deepEqual(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'), {
        platform: 'Windows',
        browser: 'Edge'
    });

    assert.deepEqual(parseUserAgent('Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0'), {
        platform: 'Android',
        browser: 'Firefox'
    });

    assert.deepEqual(parseUserAgent(''), {
        platform: 'Unknown',
        browser: 'Browser'
    });
});

test('session tokens embed sid and extractAuthUser decodes session ID', () => {
    const account = { username: 'test_session_user', userId: 'uid_session_123' };
    const sessionId = 'sess_test_12345';
    const token = generateToken(account, sessionId);

    const decoded = verifyToken(token);
    assert.equal(decoded.sub, 'test_session_user');
    assert.equal(decoded.userId, 'uid_session_123');
    assert.equal(decoded.sid, sessionId);

    const reqValid = /** @type {any} */ ({ headers: { authorization: `Bearer ${token}` } });
    extractAuthUser(reqValid, /** @type {any} */ ({}), () => {});
    assert.equal(reqValid.authUser?.sid, sessionId);
});

test('sessionService manages sessions array and client formatting', () => {
    const { appendSession, formatSessionsForClient, MAX_SESSIONS } = require('../services/sessionService.js');

    let sessions = [];
    for (let i = 0; i < 25; i++) {
        sessions = appendSession(sessions, {
            sessionId: `sess_${i}`,
            platform: 'macOS',
            browser: 'Chrome',
            createdAt: 1000 + i,
            lastActiveAt: 1000 + i
        });
    }

    assert.equal(sessions.length, MAX_SESSIONS);
    assert.equal(sessions[0].sessionId, 'sess_24');

    const formatted = formatSessionsForClient(sessions, 'sess_10');
    assert.equal(formatted[0].sessionId, 'sess_10');
    assert.equal(formatted[0].isCurrent, true);
    assert.equal(formatted[1].isCurrent, false);
});

test('pairing challenges generate and consume single-use tokens', () => {
    const { createPairingToken, consumePairingToken, getPairingTokenStatus } = require('../services/sessionService.js');

    const { pairingToken, expiresIn } = createPairingToken('pair_user', 'uid_pair_999');
    assert.ok(pairingToken.startsWith('ptk_'));
    assert.equal(expiresIn, 90);

    // Initial status is pending
    const statusBefore = getPairingTokenStatus(pairingToken);
    assert.equal(statusBefore.status, 'pending');

    const claimed = consumePairingToken(pairingToken, { deviceName: 'Safari on iOS', sessionId: 'sess_123' });
    assert.ok(claimed);
    assert.equal(claimed.username, 'pair_user');
    assert.equal(claimed.userId, 'uid_pair_999');

    // Status after claim is claimed with device info
    const statusAfter = getPairingTokenStatus(pairingToken);
    assert.equal(statusAfter.status, 'claimed');
    assert.equal(statusAfter.deviceName, 'Safari on iOS');
    assert.equal(statusAfter.sessionId, 'sess_123');

    // Second claim must fail (single-use token)
    const claimedAgain = consumePairingToken(pairingToken);
    assert.equal(claimedAgain, null);

    // Invalid token must fail
    assert.equal(consumePairingToken('ptk_invalid'), null);
    assert.equal(getPairingTokenStatus('ptk_invalid').status, 'notFound');
});

test('cancelPairingToken invalidates challenge immediately and guards against mismatched issuers', () => {
    const { createPairingToken, cancelPairingToken, getPairingTokenStatus, consumePairingToken } = require('../services/sessionService.js');

    const { pairingToken } = createPairingToken('pair_owner', 'uid_pair_777');
    assert.equal(getPairingTokenStatus(pairingToken).status, 'pending');

    // Canceling invalid token returns false
    assert.equal(cancelPairingToken('ptk_nonexistent'), false);

    // Canceling with mismatched username fails
    const failMismatched = cancelPairingToken(pairingToken, 'imposter_user');
    assert.equal(failMismatched, false);
    assert.equal(getPairingTokenStatus(pairingToken).status, 'pending');

    // Canceling with matching username succeeds
    const successCancel = cancelPairingToken(pairingToken, 'pair_owner');
    assert.equal(successCancel, true);

    // Status is now notFound and cannot be claimed
    assert.equal(getPairingTokenStatus(pairingToken).status, 'notFound');
    assert.equal(consumePairingToken(pairingToken), null);
});

test('resolveCleanRegistrationUserId allocates fresh UUID for invalid, missing, or deleted IDs', async () => {
    const { isValidUserId } = require('../utils/validation.js');

    // Invalid format allocates fresh UUID
    const res1 = await resolveCleanRegistrationUserId('invalid!id#', 'newuser');
    assert.ok(isValidUserId(res1));
    assert.notEqual(res1, 'invalid!id#');

    // Null or undefined allocates fresh UUID
    const res2 = await resolveCleanRegistrationUserId(null, 'newuser');
    assert.ok(isValidUserId(res2));

    // Empty string allocates fresh UUID
    const res3 = await resolveCleanRegistrationUserId('', 'newuser');
    assert.ok(isValidUserId(res3));
});

test('authChallenges ephemeral storage and single-use consumption contract', async () => {
    await setEphemeralChallenge('test_challenge_valid', {
        challenge: 'nonce_123',
        username: 'alice',
        expiresAt: Date.now() + 60000
    }, null);

    const consumed = await consumeEphemeralChallenge('test_challenge_valid', null);
    assert.ok(consumed);
    assert.equal(consumed.challenge, 'nonce_123');
    assert.equal(consumed.username, 'alice');

    const consumedAgain = await consumeEphemeralChallenge('test_challenge_valid', null);
    assert.equal(consumedAgain, null);

    await setEphemeralChallenge('test_challenge_expired', {
        challenge: 'nonce_expired',
        username: 'bob',
        expiresAt: Date.now() - 5000
    }, null);

    const expiredResult = await consumeEphemeralChallenge('test_challenge_expired', null);
    assert.equal(expiredResult, null);
});

test('pruneExpiredAuthChallenges purges expired challenges from memory and Firestore', async () => {
    await setEphemeralChallenge('inmem_expired_1', { challenge: 'c1', expiresAt: Date.now() - 10000 }, null);
    await setEphemeralChallenge('inmem_expired_2', { challenge: 'c2', expiresAt: Date.now() - 5000 }, null);
    await setEphemeralChallenge('inmem_active_1', { challenge: 'c3', expiresAt: Date.now() + 60000 }, null);

    /** @type {string[]} */
    const deletedDocIds = [];
    let batchCommitted = false;
    const mockFirestore = {
        collection: (colName) => {
            assert.equal(colName, 'authChallenges');
            return {
                where: (field, op, val) => {
                    assert.equal(field, 'expiresAt');
                    assert.equal(op, '<=');
                    assert.ok(typeof val === 'number');
                    return {
                        limit: (lim) => {
                            assert.equal(lim, 500);
                            return {
                                get: async () => ({
                                    empty: false,
                                    size: 2,
                                    docs: [
                                        { id: 'fs_expired_1', ref: { id: 'fs_expired_1' } },
                                        { id: 'fs_expired_2', ref: { id: 'fs_expired_2' } }
                                    ]
                                })
                            };
                        }
                    };
                }
            };
        },
        batch: () => ({
            delete: (docRef) => {
                deletedDocIds.push(docRef.id);
            },
            commit: async () => {
                batchCommitted = true;
            }
        })
    };

    const result = await pruneExpiredAuthChallenges(mockFirestore);

    assert.ok(result.inMemoryPurged >= 2);
    assert.equal(result.firestorePurged, 2);
    assert.deepEqual(deletedDocIds, ['fs_expired_1', 'fs_expired_2']);
    assert.equal(batchCommitted, true);

    // Active challenge remains accessible
    const activeChallenge = await consumeEphemeralChallenge('inmem_active_1', null);
    assert.ok(activeChallenge);
    assert.equal(activeChallenge.challenge, 'c3');

    // Handles null / erroring Firestore gracefully without throwing
    const mockErrorFirestore = {
        collection: () => {
            throw new Error('Firestore connection timeout');
        }
    };
    const errorResult = await pruneExpiredAuthChallenges(mockErrorFirestore);
    assert.equal(errorResult.firestorePurged, 0);
});
