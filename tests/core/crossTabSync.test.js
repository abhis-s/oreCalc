import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        key: (index) => Array.from(store.keys())[index] ?? null,
        get length() { return store.size; }
    };
}

const mockDoc = {
    hidden: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
        id: '',
        textContent: '',
        sheet: { insertRule: () => {} },
        setAttribute: () => {},
        getAttribute: () => null
    }),
    head: { appendChild: () => {} },
    dispatchEvent: () => true,
    documentElement: {
        classList: { add: () => {}, remove: () => {} },
        style: { setProperty: () => {}, getPropertyValue: () => '' },
        setAttribute: () => {},
        getAttribute: () => null
    },
    body: {
        classList: { add: () => {}, remove: () => {} },
        style: { setProperty: () => {}, getPropertyValue: () => '' }
    }
};

describe('Cross-Tab In-Session Storage Synchronization Suite', () => {
    test('verifies initMainAppCrossTabSync attaches storage event listener and safely processes appSettings updates', async () => {
        const { state } = await import('../../js/core/state.js');
        const { initMainAppCrossTabSync, resetCrossTabSyncForTesting } = await import('../../js/core/crossTabSync.js');
        resetCrossTabSyncForTesting();

        const listeners = {};
        const originalWindow = globalThis.window;
        const originalDocument = globalThis.document;

        try {
            globalThis.window = {
                addEventListener: (event, handler) => {
                    listeners[event] = handler;
                }
            };
            globalThis.document = mockDoc;

            initMainAppCrossTabSync();

            assert.ok(typeof listeners['storage'] === 'function', 'storage listener must be registered');

            const handler = listeners['storage'];
            await handler({
                key: 'oreCalc_appSettings',
                newValue: JSON.stringify({
                    theme: 'light',
                    accentColor: 'gold',
                    revealBeyondTH: true
                })
            });

            assert.equal(state.uiSettings.theme, 'light', 'state.uiSettings.theme must be updated to light');
            assert.equal(state.uiSettings.accentColor, 'gold', 'state.uiSettings.accentColor must be updated to gold');
            assert.equal(state.heroJourney.revealBeyondTH, true, 'state.heroJourney.revealBeyondTH must sync');

            await handler({
                key: 'oreCalc_isAccelerated',
                newValue: 'true'
            });
            assert.equal(state.heroJourney.isAccelerated, true, 'state.heroJourney.isAccelerated must sync to true');

            await handler({
                key: 'oreCalc_appSettings',
                newValue: 'invalid_json_payload'
            });
            assert.equal(state.uiSettings.theme, 'light', 'state should remain unchanged on malformed payload');
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDocument;
        }
    });

    test('verifies initHjCrossTabSync invokes onStateChange on accelerated rewards update and handles malformed payloads safely', async () => {
        const { initHjCrossTabSync } = await import('../../js/components/heroJourney/heroJourneySettings.js');

        const listeners = {};
        const originalWindow = globalThis.window;
        const originalDocument = globalThis.document;

        try {
            globalThis.window = {
                addEventListener: (event, handler) => {
                    listeners[event] = handler;
                }
            };
            globalThis.document = mockDoc;

            let stateChangeCount = 0;
            initHjCrossTabSync(() => {
                stateChangeCount++;
            });

            assert.ok(typeof listeners['storage'] === 'function', 'HJ storage listener must be registered');
            const handler = listeners['storage'];

            await handler({
                key: 'oreCalc_isAccelerated',
                newValue: 'true'
            });
            assert.equal(stateChangeCount, 1, 'onStateChange must be called when isAccelerated changes');

            await handler({
                key: 'oreCalc_appSettings',
                newValue: JSON.stringify({ revealBeyondTH: false })
            });
            assert.equal(stateChangeCount, 2, 'onStateChange must be called when revealBeyondTH changes');

            await handler({
                key: 'oreCalc_appSettings',
                newValue: ''
            });
            assert.equal(stateChangeCount, 2, 'onStateChange should not fire on empty event payload');
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDocument;
        }
    });

    test('verifies partitioned per-player updates sync correctly without disrupting unselected active player', async () => {
        const { state } = await import('../../js/core/state.js');
        const { initMainAppCrossTabSync, resetCrossTabSyncForTesting } = await import('../../js/core/crossTabSync.js');
        resetCrossTabSyncForTesting();

        const listeners = {};
        const docListeners = {};
        const originalWindow = globalThis.window;
        const originalDocument = globalThis.document;

        try {
            globalThis.window = {
                addEventListener: (event, handler) => {
                    listeners[event] = handler;
                }
            };
            globalThis.document = {
                ...mockDoc,
                addEventListener: (event, handler) => {
                    docListeners[event] = handler;
                }
            };

            state.savedPlayerTags = ['PLAYER_ACTIVE', 'PLAYER_OTHER'];
            state.storedOres = { shiny: 100, glowy: 50, starry: 10 };
            state.allPlayersData = {
                'PLAYER_ACTIVE': { storedOres: { shiny: 100, glowy: 50, starry: 10 } },
                'PLAYER_OTHER': { storedOres: { shiny: 200, glowy: 100, starry: 20 } }
            };

            initMainAppCrossTabSync();
            const handler = listeners['storage'];

            await handler({
                key: 'oreCalc_player_PLAYER_OTHER',
                newValue: JSON.stringify({
                    storedOres: { shiny: 500, glowy: 250, starry: 50 }
                })
            });

            assert.equal(state.allPlayersData['PLAYER_OTHER'].storedOres.shiny, 500);
            assert.equal(state.storedOres.shiny, 100, 'Active player view must remain undisturbed');

            await handler({
                key: 'oreCalc_player_PLAYER_ACTIVE',
                newValue: JSON.stringify({
                    storedOres: { shiny: 999, glowy: 333, starry: 44 }
                })
            });

            assert.equal(state.storedOres.shiny, 999, 'Active player view must sync live when active player changes');
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDocument;
        }
    });

    test('verifies initMainAppCrossTabSync processes oreCalc_recentSearches storage updates and visibility dropdown refresh', async () => {
        const { initMainAppCrossTabSync, resetCrossTabSyncForTesting } = await import('../../js/core/crossTabSync.js');
        resetCrossTabSyncForTesting();

        const listeners = {};
        const docListeners = {};
        const originalWindow = globalThis.window;
        const originalDocument = globalThis.document;

        try {
            globalThis.window = {
                addEventListener: (event, handler) => {
                    listeners[event] = handler;
                }
            };
            globalThis.document = {
                ...mockDoc,
                addEventListener: (event, handler) => {
                    docListeners[event] = handler;
                }
            };

            initMainAppCrossTabSync();

            assert.ok(typeof listeners['storage'] === 'function', 'storage listener must be registered');
            assert.ok(typeof docListeners['visibilitychange'] === 'function', 'visibilitychange listener must be registered');

            const handler = listeners['storage'];
            await handler({
                key: 'oreCalc_recentSearches',
                newValue: JSON.stringify([
                    { tag: '#TAG99', cleanTag: 'TAG99', name: 'Recent Cross Tab Player', townHallLevel: 15 }
                ])
            });

            assert.doesNotThrow(() => {
                docListeners['visibilitychange']();
            });
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDocument;
        }
    });

    test('verifies handleStateUpdate with { skipSave: true } updates state and triggers callback without writing to localStorage', async () => {
        const { handleStateUpdate, registerStateUpdateCallback } = await import('../../js/core/stateManager.js');
        const { state } = await import('../../js/core/state.js');
        const { getPlayerStorageKey } = await import('../../js/core/localStorageManager.js');

        let callbackFired = false;
        registerStateUpdateCallback(() => {
            callbackFired = true;
        });

        const testKey = getPlayerStorageKey(state.savedPlayerTags?.[0] || 'DEFAULT0');
        const prevStorageValue = localStorage.getItem(testKey);

        handleStateUpdate(() => {
            if (!state.heroJourney) state.heroJourney = {};
            state.heroJourney.isAccelerated = true;
        }, false, { skipSave: true });

        assert.equal(state.heroJourney.isAccelerated, true, 'State in-memory should be updated');
        assert.equal(callbackFired, true, 'State callback should be invoked');
        assert.equal(localStorage.getItem(testKey), prevStorageValue, 'localStorage must not be written when skipSave is true');
    });
});
