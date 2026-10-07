const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { safeJsonParse } = require('../utils/jsonUtils.js');

/** @type {Map<string, any>} */
const mockUserStore = new Map();
/** @type {Set<string>} */
const mockDeletedUuids = new Set();

const createMockDocRef = (collectionName, docId) => ({
    id: docId,
    get: async () => {
        if (collectionName === 'deletedUuids') {
            return { exists: mockDeletedUuids.has(docId) };
        }
        const data = mockUserStore.get(docId) || null;
        return {
            exists: data !== null,
            id: docId,
            data: () => (data ? safeJsonParse(JSON.stringify(data), null) : null)
        };
    },
    set: async (update, options = {}) => {
        const existing = mockUserStore.get(docId) || {};
        const merged = options.merge ? { ...existing, ...update } : update;
        mockUserStore.set(docId, safeJsonParse(JSON.stringify(merged), {}));
    },
    collection: () => ({
        get: async () => ({
            empty: true,
            forEach: () => {}
        }),
        doc: () => ({
            set: async () => {},
            get: async () => ({ exists: false, data: () => null })
        })
    })
});

const mockDb = {
    collection: (name) => ({
        doc: (id) => createMockDocRef(name, id),
        get: async () => ({
            empty: true,
            forEach: () => {}
        })
    }),
    batch: () => ({
        set: (docRef, data, options) => docRef.set(data, options),
        delete: () => {},
        commit: async () => {}
    })
};

/** @type {any} */ (require.cache)[require.resolve('../services/firebase.js')] = /** @type {any} */ ({
    exports: {
        admin: {
            firestore: {
                FieldValue: {
                    serverTimestamp: () => new Date().toISOString(),
                    delete: () => undefined
                }
            }
        },
        db: mockDb,
        isUserDeleted: async (id) => mockDeletedUuids.has(id)
    }
});

const userDataRouter = require('../routes/userDataRoutes.js');

/**
 * Dispatches a mock request to the router.
 * @param {Record<string, any>} req
 * @returns {Promise<{ status: number, body: any }>}
 */
function invokeRouter(req) {
    return new Promise((resolve) => {
        const mockRes = {
            statusCode: 200,
            headers: {},
            setHeader(name, val) {
                this.headers[name] = val;
            },
            getHeader(name) {
                return this.headers[name];
            },
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                resolve({ status: this.statusCode, body: payload });
            }
        };

        /** @type {any} */ (userDataRouter).handle(req, mockRes, () => {
            resolve({ status: mockRes.statusCode, body: null });
        });
    });
}

describe('OreCalc Server Migration Guard & Protection Suite', () => {
    beforeEach(() => {
        mockUserStore.clear();
        mockDeletedUuids.clear();
    });

    test('GET /load/:userId allows standard guest accounts', async () => {
        const userId = '11111111-2222-4333-8444-555555555555';
        mockUserStore.set(userId, {
            appVersion: '2.2.0',
            savedPlayerTags: ['2PP0V2RGY'],
            allPlayersData: {}
        });

        const res = await invokeRouter({
            method: 'GET',
            url: `/load/${userId}`,
            params: { userId },
            headers: { 'x-app-version': '2.2.0' }
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.appVersion, '2.2.0');
    });

    test('GET /load/:userId returns HTTP 423 when isMigratedToClashCalc is true', async () => {
        const userId = '22222222-3333-4444-8555-666666666666';
        mockUserStore.set(userId, {
            appVersion: '2.2.0',
            isMigratedToClashCalc: true,
            migratedAt: new Date().toISOString()
        });

        const res = await invokeRouter({
            method: 'GET',
            url: `/load/${userId}`,
            params: { userId },
            headers: {}
        });

        assert.equal(res.status, 423);
        assert.equal(res.body.reason, 'accountMigratedToClashCalc');
        assert.equal(res.body.isMigratedToClashCalc, true);
    });

    test('GET /load/:userId returns HTTP 423 when ownerAccount is present', async () => {
        const userId = '33333333-4444-4555-8666-777777777777';
        mockUserStore.set(userId, {
            appVersion: '2.2.0',
            ownerAccount: 'auth_usr_9988'
        });

        const res = await invokeRouter({
            method: 'GET',
            url: `/load/${userId}`,
            params: { userId },
            headers: {}
        });

        assert.equal(res.status, 423);
        assert.equal(res.body.reason, 'accountMigratedToClashCalc');
    });

    test('GET /load/:userId returns HTTP 423 when authRequired is true', async () => {
        const userId = '44444444-5555-4666-8777-888888888888';
        mockUserStore.set(userId, {
            appVersion: '2.2.0',
            authRequired: true
        });

        const res = await invokeRouter({
            method: 'GET',
            url: `/load/${userId}`,
            params: { userId },
            headers: {}
        });

        assert.equal(res.status, 423);
        assert.equal(res.body.reason, 'accountMigratedToClashCalc');
    });

    test('POST /save allows standard guest accounts', async () => {
        const userId = '55555555-6666-4777-8888-999999999999';
        const res = await invokeRouter({
            method: 'POST',
            url: '/save',
            headers: { 'content-type': 'application/json' },
            body: {
                userId,
                data: {
                    appVersion: '2.2.0',
                    savedPlayerTags: ['2PP0V2RGY'],
                    allPlayersData: {}
                }
            }
        });

        assert.equal(res.status, 200);
    });

    test('POST /save blocks saving to accounts with isMigratedToClashCalc: true with HTTP 423', async () => {
        const userId = '66666666-7777-4888-8999-000000000000';
        mockUserStore.set(userId, {
            appVersion: '2.2.0',
            isMigratedToClashCalc: true
        });

        const res = await invokeRouter({
            method: 'POST',
            url: '/save',
            headers: { 'content-type': 'application/json' },
            body: {
                userId,
                data: { appVersion: '2.2.0', savedPlayerTags: [] }
            }
        });

        assert.equal(res.status, 423);
        assert.equal(res.body.reason, 'accountMigratedToClashCalc');
    });

    test('POST /save blocks saving to accounts with ownerAccount with HTTP 423', async () => {
        const userId = '77777777-8888-4999-8000-111111111111';
        mockUserStore.set(userId, {
            appVersion: '2.2.0',
            ownerAccount: 'some_owner_id'
        });

        const res = await invokeRouter({
            method: 'POST',
            url: '/save',
            headers: { 'content-type': 'application/json' },
            body: {
                userId,
                data: { appVersion: '2.2.0', savedPlayerTags: [] }
            }
        });

        assert.equal(res.status, 423);
        assert.equal(res.body.reason, 'accountMigratedToClashCalc');
    });

    test('POST /save-player blocks modifying migrated user with HTTP 423', async () => {
        const userId = '88888888-9999-4000-8111-222222222222';
        mockUserStore.set(userId, {
            appVersion: '2.2.0',
            isMigratedToClashCalc: true
        });

        const res = await invokeRouter({
            method: 'POST',
            url: '/save-player',
            headers: { 'content-type': 'application/json' },
            body: {
                userId,
                tag: '#2PP0V2RGY',
                playerData: { name: 'Chief' }
            }
        });

        assert.equal(res.status, 423);
        assert.equal(res.body.reason, 'accountMigratedToClashCalc');
    });

    test('DELETE /delete/:userId blocks deleting migrated account with HTTP 423', async () => {
        const userId = '99999999-0000-4111-8222-333333333333';
        mockUserStore.set(userId, {
            appVersion: '2.2.0',
            isMigratedToClashCalc: true
        });

        const res = await invokeRouter({
            method: 'DELETE',
            url: `/delete/${userId}`,
            params: { userId },
            headers: {}
        });

        assert.equal(res.status, 423);
        assert.equal(res.body.reason, 'accountMigratedToClashCalc');
    });

    test('POST /mark-migrated stamps isMigratedToClashCalc on existing document', async () => {
        const userId = 'aaaa1111-bb22-4c33-8d44-eeee55556666';
        mockUserStore.set(userId, {
            appVersion: '2.2.0',
            savedPlayerTags: ['2PP0V2RGY']
        });

        const res = await invokeRouter({
            method: 'POST',
            url: '/mark-migrated',
            headers: { 'content-type': 'application/json' },
            body: { userId }
        });

        assert.equal(res.status, 200);
        const stored = mockUserStore.get(userId);
        assert.equal(stored.isMigratedToClashCalc, true);
        assert.ok(stored.migratedAt);
    });

    test('POST /mark-migrated initializes placeholder document if none exists', async () => {
        const userId = 'bbbb2222-cc33-4d44-8e55-ffff66667777';

        const res = await invokeRouter({
            method: 'POST',
            url: '/mark-migrated',
            headers: { 'content-type': 'application/json' },
            body: { userId }
        });

        assert.equal(res.status, 200);
        const stored = mockUserStore.get(userId);
        assert.equal(stored.isMigratedToClashCalc, true);
        assert.equal(stored.isMigrated, true);
    });

    test('POST /mark-migrated returns 400 for invalid userId format', async () => {
        const res = await invokeRouter({
            method: 'POST',
            url: '/mark-migrated',
            headers: { 'content-type': 'application/json' },
            body: { userId: 'bad!id' }
        });

        assert.equal(res.status, 400);
        assert.equal(res.body.reason, 'invalidUserId');
    });
});
