const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
    isAvatarUnlockedForUser,
    reconcileEquippedAvatar,
    verifyAndRedeemSupporterCode
} = require('../services/avatarLockService.js');
const { mintSupporterCode } = require('../services/supporterCodeService.js');

test('avatarLockService - isAvatarUnlockedForUser correctly evaluates milestones', async () => {
    // Non-bonus avatars always unlocked
    const unlockedClassic = await isAvatarUnlockedForUser({ username: 'testuser' }, 'archer', null);
    assert.equal(unlockedClassic, true);

    const unlockedStandardEmote = await isAvatarUnlockedForUser({ username: 'testuser' }, 'barbarian_laugh', null);
    assert.equal(unlockedStandardEmote, true);

    // BK: Requires connected village in userStates/{userId}/players with TH >= 15 (at least one suffices)
    const createSubcollectionDb = (playerDocs) => ({
        collection: (collectionName) => {
            assert.equal(collectionName, 'userStates');
            return {
                doc: () => ({
                    collection: (subName) => {
                        assert.equal(subName, 'players');
                        return {
                            get: async () => ({
                                empty: playerDocs.length === 0,
                                docs: playerDocs.map((data) => ({ data: () => data }))
                            })
                        };
                    }
                })
            };
        }
    });

    const mockDbEmpty = createSubcollectionDb([]);
    const bkNoVillages = await isAvatarUnlockedForUser({ username: 'testuser', userId: 'user123' }, 'bk_ranked_bonus', mockDbEmpty);
    assert.equal(bkNoVillages, false);

    const mockDbLowTH = createSubcollectionDb([
        { playerProfile: { townHallLevel: 10 } },
        { playerProfile: { townHallLevel: 14 } }
    ]);
    const bkLocked = await isAvatarUnlockedForUser({ username: 'testuser', userId: 'user123' }, 'bk_ranked_bonus', mockDbLowTH);
    assert.equal(bkLocked, false);

    const mockDbMultiProfileUnlocked = createSubcollectionDb([
        { playerProfile: { townHallLevel: 10 } },
        { playerProfile: { townHallLevel: 16 } },
        { playerProfile: { townHallLevel: 12 } }
    ]);
    const bkUnlocked = await isAvatarUnlockedForUser({ username: 'testuser', userId: 'user123' }, 'bk_ranked_bonus', mockDbMultiProfileUnlocked);
    assert.equal(bkUnlocked, true);

    // AQ: Requires >= 1 passkey
    const aqLocked = await isAvatarUnlockedForUser({ username: 'testuser', passkeys: [] }, 'aq_ranked_bonus', null);
    assert.equal(aqLocked, false);

    const aqUnlocked = await isAvatarUnlockedForUser({ username: 'testuser', passkeys: [{ credentialID: 'c1' }] }, 'aq_ranked_bonus', null);
    assert.equal(aqUnlocked, true);

    // DD: Requires isSupporter === true
    const ddLocked = await isAvatarUnlockedForUser({ username: 'testuser', isSupporter: false }, 'dd_ranked_bonus', null);
    assert.equal(ddLocked, false);

    const ddUnlocked = await isAvatarUnlockedForUser({ username: 'testuser', isSupporter: true }, 'dd_ranked_bonus', null);
    assert.equal(ddUnlocked, true);
});

function createMockTransactionalDb(initialAccounts = {}) {
    const collections = new Map();
    collections.set('accounts', new Map(Object.entries(initialAccounts)));
    collections.set('supporterCodes', new Map());

    const getCol = (name) => {
        if (!collections.has(name)) collections.set(name, new Map());
        return collections.get(name);
    };

    const makeRef = (col, id) => ({
        _col: col,
        _id: id,
        async get() {
            const exists = getCol(col).has(id);
            return { exists, data: () => (exists ? { ...getCol(col).get(id) } : undefined) };
        },
        async set(data) {
            getCol(col).set(id, { ...data });
        },
        async update(patch) {
            getCol(col).set(id, { ...(getCol(col).get(id) || {}), ...patch });
        }
    });

    return {
        collections,
        collection: (col) => ({ doc: (id) => makeRef(col, id) }),
        runTransaction: async (fn) => fn({
            get: (ref) => ref.get(),
            set: (ref, data) => getCol(ref._col).set(ref._id, { ...data }),
            update: (ref, patch) => getCol(ref._col).set(ref._id, { ...(getCol(ref._col).get(ref._id) || {}), ...patch })
        })
    };
}

test('avatarLockService - verifyAndRedeemSupporterCode validates and applies minted Firestore codes', async () => {
    const mockDb = createMockTransactionalDb({
        testuser: { username: 'TestUser', isSupporter: false }
    });

    // Invalid code rejection
    const invalidRes = await verifyAndRedeemSupporterCode({ username: 'testuser' }, 'WRONG-CODE', mockDb, { NODE_ENV: 'production' });
    assert.equal(invalidRes.success, false);
    assert.equal(invalidRes.reason, 'invalidSupporterCode');
    assert.equal(mockDb.collections.get('accounts').get('testuser').isSupporter, false);

    // Mint and redeem a real single-use Firestore code
    const { code } = await mintSupporterCode({ db: mockDb, source: 'manual', note: 'unit-test' });
    const validRes = await verifyAndRedeemSupporterCode({ username: 'TestUser' }, code, mockDb, { NODE_ENV: 'production' });
    assert.equal(validRes.success, true);
    assert.equal(mockDb.collections.get('accounts').get('testuser').isSupporter, true);
    assert.ok(mockDb.collections.get('accounts').get('testuser').supporterSince > 0);

    // Invalid code must still be rejected even when account is already a verified supporter
    const invalidWhenSupporter = await verifyAndRedeemSupporterCode({ username: 'TestUser', isSupporter: true }, 'WRONG-CODE', mockDb, { NODE_ENV: 'production' });
    assert.equal(invalidWhenSupporter.success, false);
    assert.equal(invalidWhenSupporter.reason, 'invalidSupporterCode');
});

test('avatarLockService - reconcileEquippedAvatar revokes bonus avatar when milestone is lost', async () => {
    const { AUTH_CONSTANTS } = require('../constants.js');

    let persistedUpdate = null;
    const mockAccountRef = {
        update: async (data) => {
            persistedUpdate = data;
        }
    };
    const emptyPlayersDb = {
        collection: () => ({
            doc: () => ({
                collection: () => ({
                    get: async () => ({ empty: true, docs: [] })
                })
            })
        })
    };

    // Classic avatar is untouched
    const classicRes = await reconcileEquippedAvatar({ username: 'u1', avatar: 'archer', passkeys: [] }, mockAccountRef, emptyPlayersDb);
    assert.equal(classicRes.revoked, false);
    assert.equal(classicRes.avatar, 'archer');
    assert.equal(persistedUpdate, null);

    // AQ bonus with 0 passkeys is revoked and persisted to a classic fallback
    const revokedAq = await reconcileEquippedAvatar({ username: 'u1', avatar: 'aq_ranked_bonus', passkeys: [] }, mockAccountRef, emptyPlayersDb);
    assert.equal(revokedAq.revoked, true);
    assert.ok(AUTH_CONSTANTS.VALID_CLASSIC_AVATARS.includes(revokedAq.avatar));
    assert.equal(persistedUpdate?.avatar, revokedAq.avatar);

    // BK bonus with no TH15+ village is revoked
    persistedUpdate = null;
    const revokedBk = await reconcileEquippedAvatar({ username: 'u1', userId: 'uid-1', avatar: 'bk_ranked_bonus' }, mockAccountRef, emptyPlayersDb);
    assert.equal(revokedBk.revoked, true);
    assert.ok(AUTH_CONSTANTS.VALID_CLASSIC_AVATARS.includes(revokedBk.avatar));
    assert.equal(persistedUpdate?.avatar, revokedBk.avatar);

    // AQ bonus with active passkey remains equipped
    persistedUpdate = null;
    const keptAq = await reconcileEquippedAvatar({ username: 'u1', avatar: 'aq_ranked_bonus', passkeys: [{ credentialID: 'pk1' }] }, mockAccountRef, emptyPlayersDb);
    assert.equal(keptAq.revoked, false);
    assert.equal(keptAq.avatar, 'aq_ranked_bonus');
    assert.equal(persistedUpdate, null);
});
