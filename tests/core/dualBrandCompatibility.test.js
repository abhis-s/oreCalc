import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage if in Node.js test environment
const store = new Map();
if (typeof globalThis.localStorage === 'undefined') {
    globalThis.localStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        key: (index) => Array.from(store.keys())[index] ?? null,
        get length() { return store.size; }
    };
}

// Mock customElements and HTMLElement before loading custom element managers
if (typeof globalThis.HTMLElement === 'undefined') {
    // @ts-expect-error Mocking HTMLElement for Node.js
    globalThis.HTMLElement = class HTMLElement {};
}
if (typeof globalThis.customElements === 'undefined') {
    const registry = new Map();
    // @ts-expect-error Mocking CustomElementRegistry for Node.js
    globalThis.customElements = {
        define: (name, constructor) => registry.set(name, constructor),
        get: (name) => registry.get(name)
    };
}

import {
    CANONICAL_PLAYER_PREFIX,
    LEGACY_PLAYER_PREFIX,
    STORAGE_KEY_MAP
} from '../../js/core/constants.js';

import {
    APP_SETTINGS_KEY,
    CANONICAL_APP_SETTINGS_KEY,
    PLAYER_TAGS_KEY,
    CANONICAL_PLAYER_TAGS_KEY,
    PLAYER_PREFIX,
    getStorageItem,
    getActivePlayerPrefix,
    getActivePlayerTagsKey,
    getActiveAppSettingsKey,
    isClashCalcHost,
    loadState,
    loadPlayerData,
    saveState,
    updateAllPlayersData
} from '../../js/core/localStorageManager.js';

import { state } from '../../js/core/state.js';
import { cleanupOrphanedPlayerPartitions } from '../../js/core/stateCleanup.js';
import {
    CANONICAL_RECENT_SEARCHES_KEY,
    RECENT_SEARCHES_KEY,
    getRecentSearches,
    addRecentSearch
} from '../../js/core/recentSearchesManager.js';

describe('Dual-Brand & Multi-Domain Compatibility Test Suite', () => {
    beforeEach(() => {
        store.clear();
        state.allPlayersData = {};
        state.savedPlayerTags = [];
    });

    test('1. Core Constants and Key Maps adhere to dual-namespace specifications', () => {
        assert.equal(LEGACY_PLAYER_PREFIX, 'oreCalc_player_');
        assert.equal(CANONICAL_PLAYER_PREFIX, 'clashCalc_player_');
        assert.equal(PLAYER_PREFIX, 'oreCalc_player_');

        assert.equal(CANONICAL_APP_SETTINGS_KEY, 'clashCalc_appSettings');
        assert.equal(APP_SETTINGS_KEY, 'oreCalc_appSettings');

        assert.equal(CANONICAL_PLAYER_TAGS_KEY, 'clashCalc_playerTags');
        assert.equal(PLAYER_TAGS_KEY, 'oreCalc_playerTags');

        assert.equal(CANONICAL_RECENT_SEARCHES_KEY, 'clashCalc_recentSearches');
        assert.equal(RECENT_SEARCHES_KEY, 'oreCalc_recentSearches');

        assert.ok(Object.isFrozen(STORAGE_KEY_MAP));
        assert.equal(STORAGE_KEY_MAP.appSettings.canonical, 'clashCalc_appSettings');
        assert.equal(STORAGE_KEY_MAP.appSettings.legacy, 'oreCalc_appSettings');
        assert.equal(STORAGE_KEY_MAP.playerTags.canonical, 'clashCalc_playerTags');
        assert.equal(STORAGE_KEY_MAP.playerTags.legacy, 'oreCalc_playerTags');
        assert.equal(STORAGE_KEY_MAP.userId.canonical, 'clashCalc_userId');
        assert.equal(STORAGE_KEY_MAP.userId.legacy, 'oreCalc_userId');
        assert.equal(STORAGE_KEY_MAP.playerPrefix.canonical, 'clashCalc_player_');
        assert.equal(STORAGE_KEY_MAP.playerPrefix.legacy, 'oreCalc_player_');
    });

    test('2. getStorageItem resolves host-prioritized key and falls back to opposing namespace', () => {
        assert.equal(getStorageItem('canonical_test', 'legacy_test'), null);

        // In default test environment (!isClashCalcHost()), legacy_test is primary
        localStorage.setItem('canonical_test', 'canonical_value');
        assert.equal(getStorageItem('canonical_test', 'legacy_test'), 'canonical_value');

        localStorage.setItem('legacy_test', 'legacy_value');
        assert.equal(getStorageItem('canonical_test', 'legacy_test'), 'legacy_value');

        assert.equal(getStorageItem('canonical_test'), 'canonical_value');
        assert.equal(getStorageItem('non_existent'), null);
    });

    test('3. Host detection and active key resolution default safely in test environment', () => {
        assert.equal(isClashCalcHost(), false);
        assert.equal(getActivePlayerPrefix(), 'oreCalc_player_');
        assert.equal(getActivePlayerTagsKey(), 'oreCalc_playerTags');
        assert.equal(getActiveAppSettingsKey(), 'oreCalc_appSettings');
    });

    test('4. loadState prioritizes host-appropriate appSettings and falls back to opposing namespace', () => {
        localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['DEFAULT0']));
        const legacySettings = { theme: 'light', accentColor: 'orange', appVersion: '2.2.0' };
        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(legacySettings));

        let loaded = loadState();
        assert.ok(loaded);
        assert.equal(loaded.uiSettings.theme, 'light');
        assert.equal(loaded.uiSettings.accentColor, 'orange');

        // On OreCalc host, legacy settings take priority
        const canonicalSettings = { theme: 'dark', accentColor: 'emerald', appVersion: '2.2.0' };
        localStorage.setItem(CANONICAL_APP_SETTINGS_KEY, JSON.stringify(canonicalSettings));

        loaded = loadState();
        assert.ok(loaded);
        assert.equal(loaded.uiSettings.theme, 'light');
        assert.equal(loaded.uiSettings.accentColor, 'orange');

        // When legacy is removed, falls back to canonical
        localStorage.removeItem(APP_SETTINGS_KEY);
        loaded = loadState();
        assert.ok(loaded);
        assert.equal(loaded.uiSettings.theme, 'dark');
        assert.equal(loaded.uiSettings.accentColor, 'emerald');
    });

    test('5. loadPlayerData resolves player data with host priority and cleans up inactive shadow partition', () => {
        const testTag = '2PP';
        const mockPlayerState = {
            tag: '#2PP',
            heroes: {},
            storedOres: { shiny: 5000, glowy: 600, starry: 80 },
            income: {},
            planner: {}
        };

        // Case A: Stored under host-active legacy prefix
        localStorage.setItem(`oreCalc_player_${testTag}`, JSON.stringify(mockPlayerState));
        let player = loadPlayerData(testTag);
        assert.ok(player);
        assert.equal(player.storedOres.shiny, 5000);

        // Clear in-memory cache to verify disk resolution
        delete state.allPlayersData[testTag];

        // Case B: On OreCalc host, oreCalc_player_ takes priority even if clashCalc_player_ exists
        const updatedPlayerState = {
            ...mockPlayerState,
            storedOres: { shiny: 9999, glowy: 1200, starry: 150 }
        };
        localStorage.setItem(`clashCalc_player_${testTag}`, JSON.stringify(updatedPlayerState));
        player = loadPlayerData(testTag);
        assert.ok(player);
        assert.equal(player.storedOres.shiny, 5000);

        // Case C: When host-active key is missing, falls back to canonical prefix
        delete state.allPlayersData[testTag];
        localStorage.removeItem(`oreCalc_player_${testTag}`);
        player = loadPlayerData(testTag);
        assert.ok(player);
        assert.equal(player.storedOres.shiny, 9999);
    });

    test('6. cleanupOrphanedPlayerPartitions preserves active partitions across both namespaces', () => {
        localStorage.setItem(CANONICAL_PLAYER_TAGS_KEY, JSON.stringify(['USER1', 'USER2']));
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([{ cleanTag: 'RECENT1' }]));

        localStorage.setItem('clashCalc_player_USER1', JSON.stringify({ heroJourney: {} }));
        localStorage.setItem('oreCalc_player_USER2', JSON.stringify({ heroJourney: {} }));
        localStorage.setItem('oreCalc_player_RECENT1', JSON.stringify({ heroJourney: {} }));

        localStorage.setItem('clashCalc_player_ORPHAN1', JSON.stringify({ heroJourney: {} }));
        localStorage.setItem('oreCalc_player_ORPHAN2', JSON.stringify({ heroJourney: {} }));

        const deleted = cleanupOrphanedPlayerPartitions();

        assert.ok(deleted.includes('clashCalc_player_ORPHAN1'));
        assert.ok(deleted.includes('oreCalc_player_ORPHAN2'));
        assert.equal(localStorage.getItem('clashCalc_player_USER1') !== null, true);
        assert.equal(localStorage.getItem('oreCalc_player_USER2') !== null, true);
        assert.equal(localStorage.getItem('oreCalc_player_RECENT1') !== null, true);
        assert.equal(localStorage.getItem('clashCalc_player_ORPHAN1'), null);
        assert.equal(localStorage.getItem('oreCalc_player_ORPHAN2'), null);
    });

    test('7. Custom element definitions register both orecalc and clashcalc tag aliases', async () => {
        await import('../../js/utils/svgManager.js');
        await import('../../js/utils/imageManager.js');

        assert.ok(globalThis.customElements.get('orecalc-assets-svg'));
        assert.ok(globalThis.customElements.get('clashcalc-assets-svg'));
        assert.ok(globalThis.customElements.get('orecalc-assets-image'));
        assert.ok(globalThis.customElements.get('clashcalc-assets-image'));

        const SvgClass1 = globalThis.customElements.get('orecalc-assets-svg');
        const SvgClass2 = globalThis.customElements.get('clashcalc-assets-svg');
        assert.ok(SvgClass2.prototype instanceof SvgClass1 || SvgClass1 === SvgClass2);

        const ImgClass1 = globalThis.customElements.get('orecalc-assets-image');
        const ImgClass2 = globalThis.customElements.get('clashcalc-assets-image');
        assert.ok(ImgClass2.prototype instanceof ImgClass1 || ImgClass1 === ImgClass2);
    });

    test('8. recentSearchesManager resolves dual-key searches seamlessly', () => {
        assert.deepEqual(getRecentSearches(), []);

        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([
            { cleanTag: 'TAG1', tag: '#TAG1', name: 'Chief 1', townHallLevel: 15, timestamp: 100 }
        ]));

        let recents = getRecentSearches();
        assert.equal(recents.length, 1);
        assert.equal(recents[0].cleanTag, 'TAG1');

        addRecentSearch({ tag: '#TAG2', name: 'Chief 2', townHallLevel: 16 });
        recents = getRecentSearches();
        assert.ok(recents.some(r => r.cleanTag === 'TAG2'));
    });

    test('9. saveState and updateAllPlayersData write to active host prefix and purge inactive shadow partition', () => {
        const testTag = 'TAG99';
        const mockPlayerState = {
            tag: '#TAG99',
            heroes: {},
            storedOres: { shiny: 100, glowy: 20, starry: 5 },
            income: {},
            planner: {}
        };

        // Seed a stale inactive partition
        localStorage.setItem(`clashCalc_player_${testTag}`, JSON.stringify({ stale: true }));
        assert.ok(localStorage.getItem(`clashCalc_player_${testTag}`));

        state.savedPlayerTags = [testTag];
        state.allPlayersData[testTag] = mockPlayerState;

        // Perform saveState
        saveState(state, true);

        // Host active prefix must be saved, inactive prefix must be purged
        assert.ok(localStorage.getItem(`oreCalc_player_${testTag}`));
        assert.equal(localStorage.getItem(`clashCalc_player_${testTag}`), null);

        // Test updateAllPlayersData
        localStorage.setItem(`clashCalc_player_${testTag}`, JSON.stringify({ stale: true }));
        updateAllPlayersData(testTag, { ...mockPlayerState, storedOres: { shiny: 200 } });
        assert.ok(localStorage.getItem(`oreCalc_player_${testTag}`));
        assert.equal(localStorage.getItem(`clashCalc_player_${testTag}`), null);
    });

    test('10. Simulated ClashCalc host prioritizes canonical keys and falls back to legacy keys', () => {
        const originalWindow = globalThis.window;
        // @ts-expect-error Mocking window for ClashCalc simulation
        globalThis.window = {
            location: {
                hostname: 'clashcalc.com'
            }
        };

        try {
            assert.equal(isClashCalcHost(), true);
            assert.equal(getActivePlayerPrefix(), 'clashCalc_player_');
            assert.equal(getActivePlayerTagsKey(), 'clashCalc_playerTags');
            assert.equal(getActiveAppSettingsKey(), 'clashCalc_appSettings');

            // getStorageItem prioritizes canonical key on ClashCalc host
            localStorage.setItem('legacy_test', 'legacy_value');
            localStorage.setItem('canonical_test', 'canonical_value');
            assert.equal(getStorageItem('canonical_test', 'legacy_test'), 'canonical_value');

            // Falls back to legacy when canonical is absent
            localStorage.removeItem('canonical_test');
            assert.equal(getStorageItem('canonical_test', 'legacy_test'), 'legacy_value');
        } finally {
            // @ts-expect-error Restoring original window
            globalThis.window = originalWindow;
        }
    });
});
