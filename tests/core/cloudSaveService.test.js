import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.has(key) ? store.get(key) : null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; },
        key: (i) => Array.from(store.keys())[i] || null
    };
}

if (typeof globalThis.sessionStorage === 'undefined') {
    const sessionStore = new Map();
    globalThis.sessionStorage = {
        getItem: (key) => sessionStore.has(key) ? sessionStore.get(key) : null,
        setItem: (key, val) => sessionStore.set(key, String(val)),
        removeItem: (key) => sessionStore.delete(key),
        clear: () => sessionStore.clear(),
        get length() { return sessionStore.size; },
        key: (i) => Array.from(sessionStore.keys())[i] || null
    };
}

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        __ENV__: { APP_VERSION: '2.2.0' },
        location: { hostname: 'localhost', reload: () => {} }
    };
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        dispatchEvent: () => true,
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

const { state } = await import('../../js/core/state.js');
const { triggerCloudSave, initializeAppData } = await import('../../js/services/cloudSaveService.js');
const { handleStateUpdate } = await import('../../js/core/stateManager.js');

describe('cloudSaveService - Defensive State & Guest Profile Invariants', () => {
    beforeEach(() => {
        globalThis.localStorage.clear();
        globalThis.sessionStorage.clear();
        globalThis.localStorage.setItem('clashCalc_userId', 'test-uuid-1234');
        delete state.savedPlayerTags;
        delete state.allPlayersData;
        state.uiSettings = { cloudSync: true };
    });

    test('triggerCloudSave returns false without throwing when savedPlayerTags is undefined', async () => {
        state.savedPlayerTags = undefined;
        state.allPlayersData = undefined;

        let result;
        await assert.doesNotReject(async () => {
            result = await triggerCloudSave({ silent: true });
        });

        assert.equal(result, false);
    });

    test('triggerCloudSave returns false without throwing when allPlayersData is missing', async () => {
        state.savedPlayerTags = ['8PJYGUJC'];
        state.allPlayersData = undefined;

        let result;
        await assert.doesNotReject(async () => {
            result = await triggerCloudSave({ silent: true });
        });

        assert.equal(result, false);
    });

    test('triggerCloudSave returns false when savedPlayerTags is empty array', async () => {
        state.savedPlayerTags = [];
        state.allPlayersData = {};

        const result = await triggerCloudSave({ silent: true });
        assert.equal(result, false);
    });

    test('triggerCloudSave returns false when operating solely on a guest profile (DEFAULT0)', async () => {
        state.savedPlayerTags = ['DEFAULT0'];
        state.allPlayersData = {
            DEFAULT0: {
                playerProfile: { tag: 'DEFAULT0', name: 'Guest' }
            }
        };

        const result = await triggerCloudSave({ silent: true });
        assert.equal(result, false);
    });

    test('triggerCloudSave skips execution when cloudSync is disabled in uiSettings', async () => {
        state.savedPlayerTags = ['8PJYGUJC'];
        state.allPlayersData = {
            '8PJYGUJC': { playerProfile: { tag: '8PJYGUJC', name: 'Chief' } }
        };
        state.uiSettings = { cloudSync: false };

        const result = await triggerCloudSave({ silent: true });
        assert.equal(result, false);
    });

    test('initializeAppData does not crash when local storage has only guest profile', async () => {
        globalThis.localStorage.setItem('clashCalc_playerTags', JSON.stringify(['DEFAULT0']));

        let result;
        await assert.doesNotReject(async () => {
            result = await initializeAppData();
        });

        assert.equal(result, null);
    });

    test('handleStateUpdate does not schedule cloud save when player state is uninitialized', () => {
        state.savedPlayerTags = undefined;
        state.allPlayersData = undefined;
        state.uiSettings = { cloudSync: true, theme: 'dark' };

        assert.doesNotThrow(() => {
            handleStateUpdate(() => {
                state.uiSettings.theme = 'light';
            });
        });
        assert.equal(state.uiSettings.theme, 'light');
    });

    test('triggerCloudSave strips saveError and auto-placed calendar chips and sanitizes profiles before upload', async () => {
        let sentPayload = null;
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (url, options) => {
            sentPayload = JSON.parse(options.body);
            return {
                ok: true,
                status: 200,
                json: async () => ({ message: 'Data saved successfully.' })
            };
        };

        try {
            state.savedPlayerTags = ['REAL1'];
            state.allPlayersData = {
                REAL1: {
                    playerProfile: {
                        tag: '#REAL1',
                        name: 'Cloud Chief',
                        townHallLevel: 16,
                        achievements: [{ name: 'Bloat' }],
                        troops: [{ name: 'Giant', level: 10 }],
                        spells: [{ name: 'Lightning Spell', level: 11 }, { name: 'Earthquake Spell', level: 6 }]
                    },
                    planner: {
                        calendar: {
                            dates: {
                                '2026-03': {
                                    '2026-03-20': ['manual-event', 'event-boost-cal-auto']
                                }
                            }
                        }
                    }
                }
            };
            state.uiSettings = {
                cloudSync: true,
                theme: 'dark',
                saveError: true
            };

            const result = await triggerCloudSave({ silent: true });
            assert.equal(result, true);
            assert.ok(sentPayload);
            assert.equal(sentPayload.data.uiSettings.saveError, undefined, 'saveError must be stripped from cloud upload');
            const p = sentPayload.data.allPlayersData.REAL1;
            assert.equal(p.playerProfile.achievements, undefined, 'achievements must be stripped before cloud upload');
            assert.equal(p.playerProfile.troops, undefined, 'troops must be stripped before cloud upload');
            assert.deepEqual(p.playerProfile.spells, { lightning: 11, earthquake: 6 }, 'spells must be normalized before cloud upload');
            assert.deepEqual(p.planner.calendar.dates, {
                '2026-03': { '2026-03-20': ['manual-event'] }
            }, '-cal-auto chips must be stripped before cloud upload');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('initializeAppData automatically adopts pruned cloud state when cloudResetEpoch > localResetEpoch', async () => {
        const originalFetch = globalThis.fetch;
        const cloudEpoch = 1720000000000;
        const localEpoch = 1710000000000;

        // Local state has older reset epoch but newer timestamp
        const localSettings = {
            theme: 'light',
            cloudSync: true,
            stateResetEpoch: localEpoch,
            appVersion: '2.2.0',
            timestamp: new Date('2026-06-01T00:00:00Z').toISOString()
        };
        localStorage.setItem('clashCalc_appSettings', JSON.stringify(localSettings));
        localStorage.setItem('clashCalc_playerTags', JSON.stringify(['TAG_LOCAL']));
        localStorage.setItem('clashCalc_player_TAG_LOCAL', JSON.stringify({
            heroes: { BK: { level: 90 } },
            playerProfile: { tag: '#TAG_LOCAL', name: 'Local Chief' }
        }));

        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            json: async () => ({
                appVersion: '2.2.0',
                stateResetEpoch: cloudEpoch,
                timestamp: new Date('2026-01-01T00:00:00Z').toISOString(),
                savedPlayerTags: ['TAG_LOCAL'],
                uiSettings: { theme: 'dark', currency: { code: 'USD' } },
                allPlayersData: {
                    TAG_LOCAL: {
                        playerProfile: { tag: '#TAG_LOCAL', name: 'Cloud Chief' }
                    }
                }
            })
        });

        try {
            const adoptedState = await initializeAppData();
            assert.ok(adoptedState, 'Must return cloudData when server state was reset');
            assert.equal(adoptedState.uiSettings.stateResetEpoch, cloudEpoch);
            assert.equal(adoptedState.allPlayersData.TAG_LOCAL.playerProfile.name, 'Cloud Chief');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('initializeAppData automatically decouples unauthenticated client holding protected account userId', async () => {
        globalThis.localStorage.setItem('clashCalc_userId', 'protected-account-id');
        globalThis.localStorage.setItem('clashCalc_playerTags', JSON.stringify(['REALTAG']));
        globalThis.localStorage.setItem('clashCalc_player_REALTAG', JSON.stringify({ name: 'Secret' }));
        globalThis.localStorage.setItem('clashCalc_appSettings', JSON.stringify({ theme: 'light', language: 'de' }));

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
            if (String(url).includes('/api/user-data/load/')) {
                return {
                    ok: false,
                    status: 403,
                    json: async () => ({ reason: 'unauthorizedAccess', message: 'Authentication required to access this account.' })
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        };

        try {
            const result = await initializeAppData();
            assert.equal(result, null, 'Should return null without error modal');

            const newUid = globalThis.localStorage.getItem('clashCalc_userId');
            assert.ok(newUid);
            assert.notEqual(newUid, 'protected-account-id');

            // Unauthorized account data must be purged and reset to default guest state
            assert.equal(globalThis.localStorage.getItem('clashCalc_player_REALTAG'), null);
            assert.equal(globalThis.localStorage.getItem('clashCalc_playerTags'), JSON.stringify(['DEFAULT0']));

            const settings = JSON.parse(globalThis.localStorage.getItem('clashCalc_appSettings'));
            assert.equal(settings.theme, 'light');
            assert.equal(settings.language, 'de');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
