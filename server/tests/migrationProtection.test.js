const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { safeJsonParse } = require('../utils/jsonUtils.js');
const { generateToken } = require('../services/authService.js');

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
 * @param {Record<string, any>} res
 * @param {Function} next
 */
function dispatchRoute(req, res, next) {
    /** @type {any} */ (userDataRouter).handle(req, res, next);
}

describe('Cross-Domain Migration Protection & Stamping Suite', () => {
    let app;

    beforeEach(() => {
        mockUserStore.clear();
        mockDeletedUuids.clear();

        app = express();
        app.use(express.json());
        app.use('/api/user-data', userDataRouter);
    });

    test('POST /api/user-data/mark-migrated marks existing user doc as migrated', async () => {
        const testUserId = 'valid-user-id-12345';
        mockUserStore.set(testUserId, {
            appVersion: '3.0.0',
            savedPlayerTags: ['#8PJYGUJC'],
            uiSettings: {}
        });

        // Simulated in-memory express call
        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/mark-migrated',
                headers: { 'content-type': 'application/json' },
                body: { userId: testUserId }
            };
            const mockRes = {
                statusCode: 200,
                headers: {},
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 200);
        assert.equal(result.body.message, 'Account marked as migrated to ClashCalc.');

        const savedDoc = mockUserStore.get(testUserId);
        assert.equal(savedDoc.isMigratedToClashCalc, true);
        assert.ok(typeof savedDoc.migratedAt === 'string');
    });

    test('POST /api/user-data/mark-migrated does not create stub doc when user does not exist', async () => {
        const testUserId = 'brand-new-uuid-99999';

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/mark-migrated',
                headers: { 'content-type': 'application/json' },
                body: { userId: testUserId }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 200);
        assert.equal(result.body.migrated, false);
        assert.equal(mockUserStore.has(testUserId), false, 'Must not create phantom document in database');
    });

    test('POST /api/user-data/mark-migrated rejects invalid user IDs with HTTP 400', async () => {
        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/mark-migrated',
                headers: { 'content-type': 'application/json' },
                body: { userId: 'short' }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 400);
        assert.equal(result.body.reason, 'invalidUserId');
    });

    test('POST /api/user-data/save automatically includes isMigratedToClashCalc: true', async () => {
        const testUserId = 'save-target-uuid-1234';

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/save',
                headers: {
                    'content-type': 'application/json',
                    'origin': 'https://clashcalc.com',
                    'x-app-version': '3.0.0'
                },
                body: {
                    userId: testUserId,
                    data: {
                        appVersion: '3.0.0',
                        savedPlayerTags: ['8PJYGUJC'],
                        uiSettings: { theme: 'dark' }
                    }
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 200);

        const savedDoc = mockUserStore.get(testUserId);
        assert.equal(savedDoc.isMigratedToClashCalc, true);
        assert.ok(typeof savedDoc.migratedAt === 'string');
    });

    test('GET /api/user-data/load/:userId rejects legacy orecalc.tech origin for migrated account with HTTP 423', async () => {
        const testUserId = 'migrated-user-uuid-1111';
        mockUserStore.set(testUserId, {
            appVersion: '3.0.0',
            savedPlayerTags: ['8PJYGUJC'],
            isMigratedToClashCalc: true,
            uiSettings: {}
        });

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'GET',
                url: `/load/${testUserId}`,
                params: { userId: testUserId },
                headers: {
                    'origin': 'https://orecalc.tech',
                    'x-app-version': '3.0.0'
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 423);
        assert.equal(result.body.reason, 'accountMigratedToClashCalc');
        assert.equal(result.body.isMigratedToClashCalc, true);
    });

    test('GET /api/user-data/load/:userId rejects legacy orecalc.tech origin for account with ownerAccount with HTTP 423', async () => {
        const testUserId = 'account-holder-uuid-2222';
        mockUserStore.set(testUserId, {
            appVersion: '3.0.0',
            savedPlayerTags: ['8PJYGUJC'],
            ownerAccount: 'chief_pat',
            authRequired: true,
            uiSettings: {}
        });

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'GET',
                url: `/load/${testUserId}`,
                params: { userId: testUserId },
                headers: {
                    'origin': 'https://www.orecalc.tech',
                    'x-app-version': '3.0.0'
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 423);
        assert.equal(result.body.reason, 'accountMigratedToClashCalc');
    });

    test('GET /api/user-data/load/:userId allows clashcalc.com origin to load migrated account with HTTP 200', async () => {
        const testUserId = 'clashcalc-user-uuid-3333';
        mockUserStore.set(testUserId, {
            appVersion: '3.0.0',
            savedPlayerTags: ['8PJYGUJC'],
            isMigratedToClashCalc: true,
            uiSettings: { theme: 'light' }
        });

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'GET',
                url: `/load/${testUserId}`,
                params: { userId: testUserId },
                headers: {
                    'origin': 'https://clashcalc.com',
                    'x-app-version': '3.0.0'
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 200);
        assert.equal(result.body.isMigratedToClashCalc, true);
        assert.equal(result.body.uiSettings.theme, 'light');
    });

    test('POST /api/user-data/save rejects legacy orecalc.tech origin modifying migrated account with HTTP 423', async () => {
        const testUserId = 'locked-user-uuid-4444';
        mockUserStore.set(testUserId, {
            appVersion: '3.0.0',
            savedPlayerTags: ['8PJYGUJC'],
            isMigratedToClashCalc: true,
            uiSettings: {}
        });

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/save',
                headers: {
                    'content-type': 'application/json',
                    'origin': 'https://beta.orecalc.tech',
                    'x-app-version': '3.0.0'
                },
                body: {
                    userId: testUserId,
                    data: {
                        appVersion: '3.0.0',
                        savedPlayerTags: ['8PJYGUJC'],
                        uiSettings: { theme: 'dark' }
                    }
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 423);
        assert.equal(result.body.reason, 'accountMigratedToClashCalc');
    });

    test('DELETE /api/user-data/delete/:userId rejects legacy orecalc.tech origin for migrated account with HTTP 423', async () => {
        const testUserId = 'locked-delete-uuid-5555';
        mockUserStore.set(testUserId, {
            appVersion: '3.0.0',
            savedPlayerTags: ['8PJYGUJC'],
            isMigratedToClashCalc: true,
            uiSettings: {}
        });

        const responsePromise = new Promise((resolve, reject) => {
            const req = {
                method: 'DELETE',
                url: `/delete/${testUserId}`,
                params: { userId: testUserId },
                ip: '127.0.0.1',
                headers: {
                    'origin': 'https://www.orecalc.tech'
                }
            };
            const mockRes = {
                statusCode: 200,
                setHeader() {},
                getHeader() { return undefined; },
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, (err) => {
                if (err) reject(err);
            });
        });

        const result = await responsePromise;
        assert.equal(result.status, 423);
        assert.equal(result.body.reason, 'accountMigratedToClashCalc');
        assert.equal(result.body.isMigratedToClashCalc, true);
    });

    test('POST /api/user-data/save rejects unauthenticated requests with empty player tags on new doc with HTTP 400', async () => {
        const testUserId = 'empty-tags-uuid-0001';

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/save',
                headers: {
                    'content-type': 'application/json',
                    'x-app-version': '3.0.0'
                },
                body: {
                    userId: testUserId,
                    data: {
                        appVersion: '3.0.0',
                        savedPlayerTags: [],
                        uiSettings: { theme: 'dark' }
                    }
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 400);
        assert.equal(result.body.reason, 'noPlayerTags');
        assert.equal(mockUserStore.has(testUserId), false, 'Must not create document in database');
    });

    test('POST /api/user-data/save rejects unauthenticated requests with only DEFAULT0 on new doc with HTTP 400', async () => {
        const testUserId = 'default0-only-uuid-0002';

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/save',
                headers: {
                    'content-type': 'application/json',
                    'x-app-version': '3.0.0'
                },
                body: {
                    userId: testUserId,
                    data: {
                        appVersion: '3.0.0',
                        savedPlayerTags: ['DEFAULT0'],
                        uiSettings: { theme: 'dark' }
                    }
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 400);
        assert.equal(result.body.reason, 'noPlayerTags');
        assert.equal(mockUserStore.has(testUserId), false, 'Must not create document in database');
    });

    test('POST /api/user-data/save allows unauthenticated requests with valid player tags', async () => {
        const testUserId = 'valid-real-tag-uuid-0003';

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/save',
                headers: {
                    'content-type': 'application/json',
                    'x-app-version': '3.0.0'
                },
                body: {
                    userId: testUserId,
                    data: {
                        appVersion: '3.0.0',
                        savedPlayerTags: ['#8PJYGUJC'],
                        uiSettings: { theme: 'dark' }
                    }
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 200);
        assert.equal(mockUserStore.has(testUserId), true);
        const doc = mockUserStore.get(testUserId);
        assert.deepEqual(doc.savedPlayerTags, ['8PJYGUJC']);
    });

    test('POST /api/user-data/save allows authenticated requests even with empty player tags', async () => {
        const testUserId = 'authed-empty-uuid-0004';
        const token = generateToken({ username: 'TestUser', userId: testUserId });

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/save',
                headers: {
                    'content-type': 'application/json',
                    'authorization': `Bearer ${token}`,
                    'x-app-version': '3.0.0'
                },
                body: {
                    userId: testUserId,
                    data: {
                        appVersion: '3.0.0',
                        savedPlayerTags: [],
                        uiSettings: { theme: 'light' }
                    }
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 200);
        assert.equal(mockUserStore.has(testUserId), true);
    });

    test('POST /api/user-data/preferences rejects unauthenticated requests for non-existent doc with HTTP 404', async () => {
        const testUserId = 'anon-prefs-uuid-0005';

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/preferences',
                headers: {
                    'content-type': 'application/json',
                    'x-app-version': '3.0.0'
                },
                body: {
                    userId: testUserId,
                    preferences: { theme: 'dark' }
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 404);
        assert.equal(result.body.reason, 'notFound');
        assert.equal(mockUserStore.has(testUserId), false);
    });

    test('POST /api/user-data/preferences allows authenticated requests for new doc with HTTP 200', async () => {
        const testUserId = 'authed-prefs-uuid-0006';
        const token = generateToken({ username: 'PrefUser', userId: testUserId });

        const responsePromise = new Promise((resolve) => {
            const req = {
                method: 'POST',
                url: '/preferences',
                headers: {
                    'content-type': 'application/json',
                    'authorization': `Bearer ${token}`,
                    'x-app-version': '3.0.0'
                },
                body: {
                    userId: testUserId,
                    preferences: { theme: 'dark' }
                }
            };
            const mockRes = {
                statusCode: 200,
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    resolve({ status: this.statusCode, body: payload });
                }
            };
            dispatchRoute(req, mockRes, () => {});
        });

        const result = await responsePromise;
        assert.equal(result.status, 200);
        assert.equal(mockUserStore.has(testUserId), true);
        const doc = mockUserStore.get(testUserId);
        assert.equal(doc.ownerAccount, 'PrefUser');
        assert.equal(doc.authRequired, true);
    });
});
