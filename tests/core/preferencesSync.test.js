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
const { triggerPreferencesSave } = await import('../../js/services/cloudSaveService.js');
const { handleStateUpdate } = await import('../../js/core/stateManager.js');

describe('Decoupled Preferences Sync - Boundary Invariants', () => {
    let fetchCalls;

    beforeEach(() => {
        globalThis.localStorage.clear();
        globalThis.sessionStorage.clear();
        globalThis.localStorage.setItem('clashCalc_userId', 'guest-uuid-1234');

        fetchCalls = [];
        globalThis.fetch = async (url, options) => {
            fetchCalls.push({ url, options });
            return {
                ok: true,
                status: 200,
                json: async () => ({ message: 'Preferences updated successfully.' })
            };
        };

        state.savedPlayerTags = ['DEFAULT0'];
        state.allPlayersData = {
            DEFAULT0: { heroes: {}, storedOres: {} }
        };
        state.uiSettings = {
            theme: 'dark',
            accentColor: 'blue',
            currency: { code: 'USD' },
            language: 'en',
            cloudSync: true
        };
    });

    test('Guest with ONLY DEFAULT0 produces 0 network requests on preference save', async () => {
        state.savedPlayerTags = ['DEFAULT0'];
        state.uiSettings.theme = 'light';

        const result = await triggerPreferencesSave({ silent: true });

        assert.equal(result, false);
        assert.equal(fetchCalls.length, 0);
    });

    test('Guest with real player tag triggers PATCH /api/user-data/preferences', async () => {
        state.savedPlayerTags = ['#8PJYGUJC'];
        state.allPlayersData['#8PJYGUJC'] = { heroes: {}, storedOres: {} };
        state.uiSettings.theme = 'light';
        state.uiSettings.accentColor = 'gold';

        const result = await triggerPreferencesSave({ silent: true });

        assert.equal(result, true);
        assert.equal(fetchCalls.length, 1);
        assert.match(fetchCalls[0].url, /\/api\/user-data\/preferences$/);
        assert.equal(fetchCalls[0].options.method, 'PATCH');

        const body = JSON.parse(fetchCalls[0].options.body);
        assert.equal(body.userId, 'guest-uuid-1234');
        assert.equal(body.preferences.theme, 'light');
        assert.equal(body.preferences.accentColor, 'gold');
        assert.equal(body.preferences.allPlayersData, undefined);
    });

    test('Authenticated user with only DEFAULT0 triggers preferences sync with auth token', async () => {
        globalThis.localStorage.setItem('clashCalc_authToken', 'jwt-test-token');
        globalThis.localStorage.setItem('clashCalc_username', 'TestChief');
        state.savedPlayerTags = ['DEFAULT0'];
        state.uiSettings.currency = { code: 'EUR' };

        const result = await triggerPreferencesSave({ silent: true });

        assert.equal(result, true);
        assert.equal(fetchCalls.length, 1);
        assert.match(fetchCalls[0].url, /\/api\/user-data\/preferences$/);
        assert.equal(fetchCalls[0].options.headers['Authorization'], 'Bearer jwt-test-token');

        const body = JSON.parse(fetchCalls[0].options.body);
        assert.equal(body.preferences.currency.code, 'EUR');
    });

    test('handleStateUpdate with preferencesOnly: true updates localStorage without scheduling full save', async () => {
        globalThis.localStorage.setItem('clashCalc_authToken', 'jwt-test-token');
        globalThis.localStorage.setItem('clashCalc_username', 'TestChief');

        handleStateUpdate(() => {
            state.uiSettings.theme = 'light';
        }, false, { preferencesOnly: true });

        const rawSaved = globalThis.localStorage.getItem('clashCalc_appSettings') || globalThis.localStorage.getItem('oreCalc_appSettings');
        assert.ok(rawSaved);
        const parsed = JSON.parse(rawSaved);
        assert.equal(parsed.theme, 'light');

        await new Promise((resolve) => setTimeout(resolve, 600));

        assert.equal(fetchCalls.length, 1);
        assert.match(fetchCalls[0].url, /\/api\/user-data\/preferences$/);
    });
});
