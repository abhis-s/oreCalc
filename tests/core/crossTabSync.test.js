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
                key: 'oreCalc_appSettings',
                newValue: 'invalid_json_payload'
            });
            assert.equal(state.uiSettings.theme, 'light', 'state should remain unchanged on malformed payload');
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDocument;
        }
    });

    test('verifies handleStateUpdate with { skipSave: true } updates state and triggers callback without writing to localStorage', async () => {
        const { handleStateUpdate, registerStateUpdateCallback } = await import('../../js/core/stateManager.js');
        const { state } = await import('../../js/core/state.js');
        const { getPlayerStorageKey } = await import('../../js/core/storageKeys.js');

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

    test('verifies active player switches reactively when playerTags storage key changes across tabs', async () => {
        const { state, getDefaultPlayerState } = await import('../../js/core/state.js');
        const { initMainAppCrossTabSync, resetCrossTabSyncForTesting } = await import('../../js/core/crossTabSync.js');
        const { getPlayerStorageKey } = await import('../../js/core/storageKeys.js');
        resetCrossTabSyncForTesting();

        const windowListeners = {};
        const docListeners = {};
        const dispatchedEvents = [];
        const originalWindow = globalThis.window;
        const originalDocument = globalThis.document;

        try {
            globalThis.window = {
                addEventListener: (event, handler) => {
                    windowListeners[event] = handler;
                },
                location: { search: '?tag=TESTTAG1', pathname: '/ore-calculator/', href: 'http://localhost/?tag=TESTTAG1' },
                history: {
                    replaceState: (_data, _unused, url) => {
                        globalThis.window.location.search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
                    }
                }
            };
            globalThis.document = {
                ...mockDoc,
                addEventListener: (event, handler) => {
                    docListeners[event] = handler;
                },
                dispatchEvent: (event) => {
                    dispatchedEvents.push(event.type);
                    return true;
                }
            };

            const tag1State = getDefaultPlayerState();
            tag1State.heroes = { barbarianKing: { level: 50 } };
            tag1State.storedOres = { shiny: 1000, glowy: 50, starry: 10 };

            const tag2State = getDefaultPlayerState();
            tag2State.heroes = { barbarianKing: { level: 90 } };
            tag2State.storedOres = { shiny: 9999, glowy: 888, starry: 77 };

            localStorage.setItem(getPlayerStorageKey('TESTTAG1'), JSON.stringify(tag1State));
            localStorage.setItem(getPlayerStorageKey('TESTTAG2'), JSON.stringify(tag2State));

            state.savedPlayerTags = ['TESTTAG1', 'TESTTAG2'];
            state.allPlayersData = {
                TESTTAG1: tag1State,
                TESTTAG2: tag2State
            };
            state.heroes = tag1State.heroes;
            state.storedOres = tag1State.storedOres;

            initMainAppCrossTabSync();

            const storageHandler = windowListeners['storage'];
            assert.ok(typeof storageHandler === 'function', 'storage listener must be active');

            // Another tab moved TESTTAG2 to index 0 (active player)
            await storageHandler({
                key: 'clashCalc_playerTags',
                newValue: JSON.stringify(['#TESTTAG2', '#TESTTAG1'])
            });

            assert.equal(state.savedPlayerTags[0], 'TESTTAG2', 'Active tag in state must switch to TESTTAG2');
            assert.equal(state.heroes?.barbarianKing?.level, 90, 'Active heroes state must be switched to TESTTAG2 data');
            assert.equal(state.storedOres?.shiny, 9999, 'Active stored ores must be switched to TESTTAG2 data');
            assert.ok(dispatchedEvents.includes('app:playerDropdownSync'), 'app:playerDropdownSync event must be dispatched');
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDocument;
        }
    });

    test('verifies active player partition changes update current view state without recursive save loop', async () => {
        const { state, getDefaultPlayerState } = await import('../../js/core/state.js');
        const { initMainAppCrossTabSync, resetCrossTabSyncForTesting } = await import('../../js/core/crossTabSync.js');
        const { getPlayerStorageKey } = await import('../../js/core/storageKeys.js');
        resetCrossTabSyncForTesting();

        const windowListeners = {};
        const dispatchedEvents = [];
        const originalWindow = globalThis.window;
        const originalDocument = globalThis.document;

        try {
            globalThis.window = {
                addEventListener: (event, handler) => {
                    windowListeners[event] = handler;
                },
                location: { search: '?tag=TESTTAG2', pathname: '/ore-calculator/', href: 'http://localhost/?tag=TESTTAG2' },
                history: { replaceState: () => {} }
            };
            globalThis.document = {
                ...mockDoc,
                hidden: false,
                dispatchEvent: (event) => {
                    dispatchedEvents.push(event.type);
                    return true;
                }
            };

            const tag2State = getDefaultPlayerState();
            tag2State.heroes = { barbarianKing: { level: 90 } };
            tag2State.storedOres = { shiny: 1000, glowy: 100, starry: 10 };

            state.savedPlayerTags = ['TESTTAG2'];
            state.heroes = tag2State.heroes;
            state.storedOres = tag2State.storedOres;

            initMainAppCrossTabSync();

            const storageHandler = windowListeners['storage'];
            const key = getPlayerStorageKey('TESTTAG2');
            const updatedPayload = {
                ...tag2State,
                heroes: { barbarianKing: { level: 95 } },
                storedOres: { shiny: 50000, glowy: 2000, starry: 150 }
            };

            await storageHandler({
                key,
                newValue: JSON.stringify(updatedPayload)
            });

            assert.equal(state.heroes?.barbarianKing?.level, 95, 'Hero level must be reactively updated in state');
            assert.equal(state.storedOres?.shiny, 50000, 'Stored ores must be reactively updated in state');
            assert.ok(dispatchedEvents.includes('app:playerDropdownSync'), 'app:playerDropdownSync event must be dispatched on partition update');
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDocument;
        }
    });

    test('verifies visibilitychange synchronizes pending updates when hidden tab becomes visible', async () => {
        const { state, getDefaultPlayerState } = await import('../../js/core/state.js');
        const { initMainAppCrossTabSync, resetCrossTabSyncForTesting } = await import('../../js/core/crossTabSync.js');
        const { getPlayerStorageKey } = await import('../../js/core/storageKeys.js');
        resetCrossTabSyncForTesting();

        const windowListeners = {};
        const docListeners = {};
        const dispatchedEvents = [];
        const originalWindow = globalThis.window;
        const originalDocument = globalThis.document;

        try {
            globalThis.window = {
                addEventListener: (event, handler) => {
                    windowListeners[event] = handler;
                },
                location: { search: '?tag=TESTTAG1', pathname: '/ore-calculator/', href: 'http://localhost/?tag=TESTTAG1' },
                history: { replaceState: () => {} }
            };

            let isDocHidden = true;
            globalThis.document = {
                ...mockDoc,
                get hidden() { return isDocHidden; },
                get visibilityState() { return isDocHidden ? 'hidden' : 'visible'; },
                addEventListener: (event, handler) => {
                    docListeners[event] = handler;
                },
                dispatchEvent: (event) => {
                    dispatchedEvents.push(event.type);
                    return true;
                }
            };

            const tag1State = getDefaultPlayerState();
            tag1State.heroes = { barbarianKing: { level: 50 } };
            const tag3State = getDefaultPlayerState();
            tag3State.heroes = { barbarianKing: { level: 80 } };

            localStorage.setItem(getPlayerStorageKey('TESTTAG1'), JSON.stringify(tag1State));
            localStorage.setItem(getPlayerStorageKey('TESTTAG3'), JSON.stringify(tag3State));

            state.savedPlayerTags = ['TESTTAG1'];
            state.heroes = tag1State.heroes;

            initMainAppCrossTabSync();

            // Simulate tag list changed while this tab was backgrounded/hidden
            localStorage.setItem('clashCalc_playerTags', JSON.stringify(['#TESTTAG3', '#TESTTAG1']));

            // Tab becomes visible
            isDocHidden = false;
            const visibilityHandler = docListeners['visibilitychange'];
            assert.ok(typeof visibilityHandler === 'function', 'visibilitychange listener must be active');
            visibilityHandler();

            assert.equal(state.savedPlayerTags[0], 'TESTTAG3', 'Active tag in state must switch to TESTTAG3 upon visibilitychange');
            assert.equal(state.heroes?.barbarianKing?.level, 80, 'Hero level must sync to TESTTAG3 data upon visibilitychange');
        } finally {
            globalThis.window = originalWindow;
            globalThis.document = originalDocument;
        }
    });
});
