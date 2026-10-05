const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeUsername,
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    generatePasskeyRegisterOptions,
    generatePasskeyLoginOptions
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
