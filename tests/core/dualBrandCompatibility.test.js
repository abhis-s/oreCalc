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
    ALLOWED_STATIC_STORAGE_KEYS,
    getStorageItem,
    getActivePlayerPrefix,
    getActivePlayerTagsKey,
    getActiveAppSettingsKey,
    getActiveUserId,
    getActiveUserIdKey,
    isClashCalcHost
} from '../../js/core/storageKeys.js';
import { consolidateLocalStorageKeys, sweepObsoleteStorageKeys } from '../../js/core/storageMigrations.js';
import { loadState } from '../../js/core/localStorageManager.js';
import { loadPlayerData } from '../../js/core/playerStorage.js';

import { state } from '../../js/core/state.js';
import { cleanupOrphanedPlayerPartitions } from '../../js/core/stateCleanup.js';

describe('Dual-Brand & Multi-Domain Compatibility Test Suite', () => {
    beforeEach(() => {
        store.clear();
        state.allPlayersData = {};
        state.savedPlayerTags = [];
    });

    test('Core Constants and Key Maps adhere to dual-namespace specifications', () => {
        assert.equal(LEGACY_PLAYER_PREFIX, 'oreCalc_player_');
        assert.equal(CANONICAL_PLAYER_PREFIX, 'clashCalc_player_');
        assert.equal(PLAYER_PREFIX, 'oreCalc_player_');

        assert.equal(CANONICAL_APP_SETTINGS_KEY, 'clashCalc_appSettings');
        assert.equal(APP_SETTINGS_KEY, 'oreCalc_appSettings');

        assert.equal(CANONICAL_PLAYER_TAGS_KEY, 'clashCalc_playerTags');
        assert.equal(PLAYER_TAGS_KEY, 'oreCalc_playerTags');

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

    test('getStorageItem resolves canonical key when present and falls back to legacy', () => {
        assert.equal(getStorageItem('canonical_test', 'legacy_test'), null);

        localStorage.setItem('legacy_test', 'legacy_value');
        assert.equal(getStorageItem('canonical_test', 'legacy_test'), 'legacy_value');

        localStorage.setItem('canonical_test', 'canonical_value');
        assert.equal(getStorageItem('canonical_test', 'legacy_test'), 'canonical_value');

        assert.equal(getStorageItem('canonical_test'), 'canonical_value');
        assert.equal(getStorageItem('non_existent'), null);
    });

    test('Host detection and active key resolution default safely in test environment', () => {
        assert.equal(isClashCalcHost(), false);
        assert.equal(getActivePlayerPrefix(), 'oreCalc_player_');
        assert.equal(getActivePlayerTagsKey(), 'oreCalc_playerTags');
        assert.equal(getActiveAppSettingsKey(), 'oreCalc_appSettings');
    });

    test('loadState prioritizes clashCalc_appSettings and falls back to oreCalc_appSettings', () => {
        localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['DEFAULT0']));
        const legacySettings = { theme: 'light', accentColor: 'orange', appVersion: '2.2.0' };
        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(legacySettings));

        let loaded = loadState();
        assert.ok(loaded);
        assert.equal(loaded.uiSettings.theme, 'light');
        assert.equal(loaded.uiSettings.accentColor, 'orange');

        const canonicalSettings = { theme: 'dark', accentColor: 'emerald', appVersion: '2.2.0' };
        localStorage.setItem(CANONICAL_APP_SETTINGS_KEY, JSON.stringify(canonicalSettings));

        loaded = loadState();
        assert.ok(loaded);
        assert.equal(loaded.uiSettings.theme, 'dark');
        assert.equal(loaded.uiSettings.accentColor, 'emerald');
    });

    test('loadPlayerData resolves player data across canonical and legacy namespaces', () => {
        const testTag = '8PJYGUJC';
        const mockPlayerState = {
            tag: '#8PJYGUJC',
            heroes: {},
            storedOres: { shiny: 5000, glowy: 600, starry: 80 },
            income: {},
            planner: {}
        };

        // Case A: Stored under legacy prefix
        localStorage.setItem(`oreCalc_player_${testTag}`, JSON.stringify(mockPlayerState));
        let player = loadPlayerData(testTag);
        assert.ok(player);
        assert.equal(player.storedOres.shiny, 5000);

        // Clear in-memory cache to verify disk resolution
        delete state.allPlayersData[testTag];

        // Case B: Stored under canonical prefix takes priority
        const updatedPlayerState = {
            ...mockPlayerState,
            storedOres: { shiny: 9999, glowy: 1200, starry: 150 }
        };
        localStorage.setItem(`clashCalc_player_${testTag}`, JSON.stringify(updatedPlayerState));
        player = loadPlayerData(testTag);
        assert.ok(player);
        assert.equal(player.storedOres.shiny, 9999);
    });

    test('cleanupOrphanedPlayerPartitions preserves active partitions across both namespaces', () => {
        localStorage.setItem(CANONICAL_PLAYER_TAGS_KEY, JSON.stringify(['USER1', 'USER2']));

        localStorage.setItem('clashCalc_player_USER1', JSON.stringify({ heroJourney: {} }));
        localStorage.setItem('oreCalc_player_USER2', JSON.stringify({ heroJourney: {} }));

        localStorage.setItem('clashCalc_player_ORPHAN1', JSON.stringify({ heroJourney: {} }));
        localStorage.setItem('oreCalc_player_ORPHAN2', JSON.stringify({ heroJourney: {} }));

        const deleted = cleanupOrphanedPlayerPartitions();

        assert.ok(deleted.includes('clashCalc_player_ORPHAN1'));
        assert.ok(deleted.includes('oreCalc_player_ORPHAN2'));
        assert.equal(localStorage.getItem('clashCalc_player_USER1') !== null, true);
        assert.equal(localStorage.getItem('oreCalc_player_USER2') !== null, true);
        assert.equal(localStorage.getItem('clashCalc_player_ORPHAN1'), null);
        assert.equal(localStorage.getItem('oreCalc_player_ORPHAN2'), null);
    });

    test('Custom element definitions register both orecalc and clashcalc tag aliases', async () => {
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

    test('Host detection accurately resolves localhost, 127.0.0.1, clashcalc.com, and orecalc.tech', () => {
        // Default in test environment without window
        assert.equal(isClashCalcHost(), false);

        // Simulated window environments
        globalThis.window = /** @type {any} */ ({ location: { hostname: 'localhost' } });
        assert.equal(isClashCalcHost(), true);

        globalThis.window = /** @type {any} */ ({ location: { hostname: '127.0.0.1' } });
        assert.equal(isClashCalcHost(), true);

        globalThis.window = /** @type {any} */ ({ location: { hostname: 'clashcalc.com' } });
        assert.equal(isClashCalcHost(), true);

        globalThis.window = /** @type {any} */ ({ location: { hostname: 'beta.clashcalc.com' } });
        assert.equal(isClashCalcHost(), true);

        globalThis.window = /** @type {any} */ ({ location: { hostname: 'orecalc.tech' } });
        assert.equal(isClashCalcHost(), false);

        globalThis.window = /** @type {any} */ ({ location: { hostname: 'www.orecalc.tech' } });
        assert.equal(isClashCalcHost(), false);

        // Reset
        delete globalThis.window;
    });

    test('consolidateLocalStorageKeys merges legacy settings, tags, and user ID into canonical namespace, and purges deprecated recent searches on ClashCalc host', () => {
        globalThis.window = /** @type {any} */ ({ location: { hostname: 'clashcalc.com' } });

        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify({
            theme: 'dark',
            accentColor: 'orange',
            language: 'de',
            uiTimestamps: { tour: 100 }
        }));
        localStorage.setItem(CANONICAL_APP_SETTINGS_KEY, JSON.stringify({
            theme: 'light',
            uiTimestamps: { welcome: 200 }
        }));

        localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['TAG1', 'TAG2']));
        localStorage.setItem(CANONICAL_PLAYER_TAGS_KEY, JSON.stringify(['TAG2', 'TAG3']));

        localStorage.setItem('oreCalc_userId', 'user-legacy-123');
        localStorage.setItem('clashCalc_recentSearches', JSON.stringify([
            { cleanTag: 'TAG1', tag: '#TAG1', name: 'Chief 1', timestamp: 100 }
        ]));
        localStorage.setItem('oreCalc_recentSearches', JSON.stringify([
            { cleanTag: 'TAG2', tag: '#TAG2', name: 'Chief 2', timestamp: 200 }
        ]));

        const summary = consolidateLocalStorageKeys();

        assert.ok(summary.migrated.includes(CANONICAL_APP_SETTINGS_KEY));
        assert.ok(summary.deleted.includes(APP_SETTINGS_KEY));
        assert.equal(localStorage.getItem(APP_SETTINGS_KEY), null);

        const mergedSettings = JSON.parse(localStorage.getItem(CANONICAL_APP_SETTINGS_KEY));
        assert.equal(mergedSettings.theme, 'light');
        assert.equal(mergedSettings.accentColor, 'orange');
        assert.equal(mergedSettings.language, 'de');
        assert.equal(mergedSettings.uiTimestamps.tour, 100);
        assert.equal(mergedSettings.uiTimestamps.welcome, undefined);

        const mergedTags = JSON.parse(localStorage.getItem(CANONICAL_PLAYER_TAGS_KEY));
        assert.deepEqual(mergedTags, ['TAG2', 'TAG3', 'TAG1']);
        assert.equal(localStorage.getItem(PLAYER_TAGS_KEY), null);

        assert.equal(localStorage.getItem('clashCalc_userId'), 'user-legacy-123');
        assert.equal(localStorage.getItem('oreCalc_userId'), null);

        assert.ok(summary.deleted.includes('clashCalc_recentSearches'));
        assert.ok(summary.deleted.includes('oreCalc_recentSearches'));
        assert.equal(localStorage.getItem('clashCalc_recentSearches'), null);
        assert.equal(localStorage.getItem('oreCalc_recentSearches'), null);

        delete globalThis.window;
    });

    test('consolidateLocalStorageKeys migrates player partitions, merges missing fields, and normalizes hash keys', () => {
        globalThis.window = /** @type {any} */ ({ location: { hostname: 'localhost' } });

        // Player A: only in legacy namespace
        localStorage.setItem('oreCalc_player_PLYA', JSON.stringify({
            heroes: { BK: { level: 20 } },
            playerProfile: { name: 'Player A', townHallLevel: 14 }
        }));

        // Player B: in both, but legacy has playerProfile while canonical only has heroJourney
        localStorage.setItem('oreCalc_player_PLYB', JSON.stringify({
            heroes: { AQ: { level: 30 } },
            playerProfile: { name: 'Player B', townHallLevel: 15 }
        }));
        localStorage.setItem('clashCalc_player_PLYB', JSON.stringify({
            heroes: { AQ: { level: 35 } },
            heroJourney: { acceleratedRewards: true }
        }));

        // Player C: un-normalized hash key
        localStorage.setItem('clashCalc_player_#PLYD', JSON.stringify({
            playerProfile: { name: 'Player C', townHallLevel: 16 }
        }));

        consolidateLocalStorageKeys();

        // Player A migrated to canonical and legacy removed
        assert.equal(localStorage.getItem('oreCalc_player_PLYA'), null);
        const playerA = JSON.parse(localStorage.getItem('clashCalc_player_PLYA'));
        assert.equal(playerA.playerProfile.name, 'Player A');

        // Player B merged: canonical heroes level preserved, playerProfile merged in
        assert.equal(localStorage.getItem('oreCalc_player_PLYB'), null);
        const playerB = JSON.parse(localStorage.getItem('clashCalc_player_PLYB'));
        assert.equal(playerB.heroes.AQ.level, 35);
        assert.equal(playerB.playerProfile.name, 'Player B');
        assert.equal(playerB.heroJourney.acceleratedRewards, true);

        // Player C normalized from #PLYD to PLYD
        assert.equal(localStorage.getItem('clashCalc_player_#PLYD'), null);
        const playerC = JSON.parse(localStorage.getItem('clashCalc_player_PLYD'));
        assert.equal(playerC.playerProfile.name, 'Player C');

        delete globalThis.window;
    });

    test('consolidateLocalStorageKeys absorbs obsolete welcomeModalDismissed and orecalc_lang flags', () => {
        globalThis.window = /** @type {any} */ ({ location: { hostname: 'clashcalc.com' } });

        localStorage.setItem('welcomeModalDismissed', 'true');
        localStorage.setItem('orecalc_lang', 'tr');
        localStorage.setItem(CANONICAL_APP_SETTINGS_KEY, JSON.stringify({
            theme: 'dark',
            language: 'auto'
        }));

        consolidateLocalStorageKeys();

        assert.equal(localStorage.getItem('welcomeModalDismissed'), null);
        assert.equal(localStorage.getItem('orecalc_lang'), null);

        const settings = JSON.parse(localStorage.getItem(CANONICAL_APP_SETTINGS_KEY));
        assert.equal(settings.language, 'tr');
        assert.equal(settings.uiTimestamps?.welcome, undefined);

        delete globalThis.window;
    });

    test('consolidateLocalStorageKeys safely preserves legacy keys on legacy orecalc.tech host', () => {
        globalThis.window = /** @type {any} */ ({ location: { hostname: 'orecalc.tech' } });

        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify({ theme: 'dark' }));
        localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['TAG1']));
        localStorage.setItem('oreCalc_player_TAG1', JSON.stringify({ playerProfile: { name: 'Chief' } }));
        localStorage.setItem('oreCalc_userId', 'user-legacy');

        consolidateLocalStorageKeys();

        // Legacy keys must be preserved on orecalc.tech host
        assert.ok(localStorage.getItem(APP_SETTINGS_KEY) !== null);
        assert.ok(localStorage.getItem(PLAYER_TAGS_KEY) !== null);
        assert.ok(localStorage.getItem('oreCalc_player_TAG1') !== null);
        assert.equal(localStorage.getItem('oreCalc_userId'), 'user-legacy');

        delete globalThis.window;
    });

    test('cleanupOrphanedPlayerPartitions purges redundant duplicate legacy partitions when canonical partition exists', () => {
        localStorage.setItem(CANONICAL_PLAYER_TAGS_KEY, JSON.stringify(['USER1', 'USER2']));

        // USER1 has partitions under BOTH canonical and legacy namespaces
        localStorage.setItem('clashCalc_player_USER1', JSON.stringify({ heroJourney: {} }));
        localStorage.setItem('oreCalc_player_USER1', JSON.stringify({ heroJourney: {} }));

        // USER2 has partition only under legacy namespace
        localStorage.setItem('oreCalc_player_USER2', JSON.stringify({ heroJourney: {} }));

        const deleted = cleanupOrphanedPlayerPartitions();

        assert.ok(deleted.includes('oreCalc_player_USER1'));
        assert.equal(localStorage.getItem('clashCalc_player_USER1') !== null, true);
        assert.equal(localStorage.getItem('oreCalc_player_USER1'), null);
        assert.equal(localStorage.getItem('oreCalc_player_USER2') !== null, true);
    });

    test('consolidateLocalStorageKeys purges browser orphans (orecalc_ui_settings and preferred_language)', () => {
        localStorage.setItem('orecalc_ui_settings', JSON.stringify({ language: 'en' }));
        localStorage.setItem('preferred_language', 'en');

        const summary = consolidateLocalStorageKeys();

        assert.equal(localStorage.getItem('orecalc_ui_settings'), null);
        assert.equal(localStorage.getItem('preferred_language'), null);
        assert.ok(summary.deleted.includes('orecalc_ui_settings'));
        assert.ok(summary.deleted.includes('preferred_language'));
    });

    test('consolidateLocalStorageKeys purges stray dev key oreCalc_damageCalcState without migration', () => {
        localStorage.setItem('oreCalc_damageCalcState', JSON.stringify({ activeTab: 'zapquake' }));

        const summary = consolidateLocalStorageKeys();

        assert.equal(localStorage.getItem('oreCalc_damageCalcState'), null);
        assert.ok(summary.deleted.includes('oreCalc_damageCalcState'));
    });

    test('getActiveUserIdKey returns canonical key on ClashCalc host and legacy on legacy host', () => {
        globalThis.window = /** @type {any} */ ({ location: { hostname: 'localhost' } });
        assert.equal(getActiveUserIdKey(), 'clashCalc_userId');

        globalThis.window = /** @type {any} */ ({ location: { hostname: 'orecalc.tech' } });
        assert.equal(getActiveUserIdKey(), 'oreCalc_userId');

        delete globalThis.window;
    });

    test('getActiveUserId resolves canonical key, falls back to legacy, and generates when requested', () => {
        assert.equal(getActiveUserId(), '');

        localStorage.setItem('clashCalc_userId', 'canonical-user-123');
        assert.equal(getActiveUserId(), 'canonical-user-123');

        localStorage.removeItem('clashCalc_userId');
        localStorage.setItem('oreCalc_userId', 'legacy-user-456');
        assert.equal(getActiveUserId(), 'legacy-user-456');

        localStorage.removeItem('oreCalc_userId');
        globalThis.window = /** @type {any} */ ({ location: { hostname: 'localhost' } });
        const generated = getActiveUserId(true);
        assert.ok(generated.length > 0);
        assert.equal(localStorage.getItem('clashCalc_userId'), generated);

        delete globalThis.window;
    });

    test('appSettings.persistAppSettings purges legacy settings key on ClashCalc host and does not duplicate it', async () => {
        globalThis.window = /** @type {any} */ ({ location: { hostname: 'localhost' }, addEventListener: () => {} });

        const { persistAppSettings: persistDamageSettings } = await import('../../js/components/common/appSettings.js');

        // Pre-populate legacy settings
        localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify({ theme: 'dark', language: 'en' }));

        persistDamageSettings({ theme: 'light', accentColor: 'gold' });

        assert.equal(localStorage.getItem(APP_SETTINGS_KEY), null, 'Legacy settings key must be removed on ClashCalc host');
        assert.ok(localStorage.getItem(CANONICAL_APP_SETTINGS_KEY) !== null, 'Canonical settings key must exist');

        const canonical = JSON.parse(localStorage.getItem(CANONICAL_APP_SETTINGS_KEY));
        assert.equal(canonical.theme, 'light');
        assert.equal(canonical.accentColor, 'gold');

        delete globalThis.window;
    });

    test('ALLOWED_STATIC_STORAGE_KEYS is deeply frozen and contains future auth and session keys', () => {
        assert.ok(Object.isFrozen(ALLOWED_STATIC_STORAGE_KEYS));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_authToken'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_username'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_stateResetEpoch'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_appSettings'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_playerTags'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('clashCalc_userId'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('oreCalc_appSettings'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('oreCalc_playerTags'));
        assert.ok(ALLOWED_STATIC_STORAGE_KEYS.has('oreCalc_userId'));

        assert.equal(ALLOWED_STATIC_STORAGE_KEYS.has('oreCalculatorState'), false);
        assert.equal(ALLOWED_STATIC_STORAGE_KEYS.has('oreCalc_damageCalcState'), false);
        assert.equal(ALLOWED_STATIC_STORAGE_KEYS.has('orecalc_ui_settings'), false);
        assert.equal(ALLOWED_STATIC_STORAGE_KEYS.has('welcomeModalDismissed'), false);
    });

    test('sweepObsoleteStorageKeys preserves allowlisted static keys and valid player partitions', () => {
        localStorage.setItem('clashCalc_authToken', 'jwt_test_token');
        localStorage.setItem('clashCalc_username', 'clash_commander');
        localStorage.setItem('clashCalc_stateResetEpoch', '1710000000000');
        localStorage.setItem('clashCalc_appSettings', JSON.stringify({ theme: 'dark' }));
        localStorage.setItem('clashCalc_playerTags', JSON.stringify(['TAG1', 'TAG2']));
        localStorage.setItem('clashCalc_userId', 'usr_uuid_123');

        localStorage.setItem('clashCalc_player_TAG1', JSON.stringify({ heroes: {} }));
        localStorage.setItem('oreCalc_player_TAG1', JSON.stringify({ heroes: {} }));
        localStorage.setItem('clashCalc_player_TAG2', JSON.stringify({ heroes: {} }));

        const deleted = sweepObsoleteStorageKeys(['TAG1', 'TAG2']);

        assert.deepEqual(deleted, []);
        assert.equal(localStorage.getItem('clashCalc_authToken'), 'jwt_test_token');
        assert.equal(localStorage.getItem('clashCalc_username'), 'clash_commander');
        assert.equal(localStorage.getItem('clashCalc_stateResetEpoch'), '1710000000000');
        assert.ok(localStorage.getItem('clashCalc_appSettings') !== null);
        assert.ok(localStorage.getItem('clashCalc_playerTags') !== null);
        assert.equal(localStorage.getItem('clashCalc_userId'), 'usr_uuid_123');
        assert.ok(localStorage.getItem('clashCalc_player_TAG1') !== null);
        assert.ok(localStorage.getItem('oreCalc_player_TAG1') !== null);
        assert.ok(localStorage.getItem('clashCalc_player_TAG2') !== null);
    });

    test('sweepObsoleteStorageKeys surgically deletes un-allowlisted keys and orphaned player partitions', () => {
        localStorage.setItem('oreCalculatorState', '{"old": true}');
        localStorage.setItem('oreCalc_damageCalcState', '{"stray": true}');
        localStorage.setItem('orecalc_ui_settings', '{"lang": "en"}');
        localStorage.setItem('preferred_language', 'en');
        localStorage.setItem('welcomeModalDismissed', 'true');
        localStorage.setItem('clashCalc_player_OLDTAG', '{"orphaned": true}');
        localStorage.setItem('oreCalc_player_DEADTAG', '{"orphaned": true}');

        localStorage.setItem('clashCalc_player_ACTIVETAG', JSON.stringify({ heroes: {} }));

        const deleted = sweepObsoleteStorageKeys(['ACTIVETAG']);

        assert.ok(deleted.includes('oreCalculatorState'));
        assert.ok(deleted.includes('oreCalc_damageCalcState'));
        assert.ok(deleted.includes('orecalc_ui_settings'));
        assert.ok(deleted.includes('preferred_language'));
        assert.ok(deleted.includes('welcomeModalDismissed'));
        assert.ok(deleted.includes('clashCalc_player_OLDTAG'));
        assert.ok(deleted.includes('oreCalc_player_DEADTAG'));

        assert.equal(localStorage.getItem('oreCalculatorState'), null);
        assert.equal(localStorage.getItem('oreCalc_damageCalcState'), null);
        assert.equal(localStorage.getItem('orecalc_ui_settings'), null);
        assert.equal(localStorage.getItem('preferred_language'), null);
        assert.equal(localStorage.getItem('welcomeModalDismissed'), null);
        assert.equal(localStorage.getItem('clashCalc_player_OLDTAG'), null);
        assert.equal(localStorage.getItem('oreCalc_player_DEADTAG'), null);

        assert.ok(localStorage.getItem('clashCalc_player_ACTIVETAG') !== null);
    });

    test('sweepObsoleteStorageKeys safeguards player partitions when no valid tags are provided', () => {
        localStorage.setItem('clashCalc_player_TAG1', JSON.stringify({ heroes: {} }));
        localStorage.setItem('oreCalc_player_TAG2', JSON.stringify({ heroes: {} }));
        localStorage.setItem('oreCalculatorState', '{"ancient": true}');

        const deleted = sweepObsoleteStorageKeys([]);

        assert.ok(deleted.includes('oreCalculatorState'));
        assert.equal(localStorage.getItem('oreCalculatorState'), null);

        assert.ok(localStorage.getItem('clashCalc_player_TAG1') !== null);
        assert.ok(localStorage.getItem('oreCalc_player_TAG2') !== null);
    });
});
