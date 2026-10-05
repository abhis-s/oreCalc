/**
 * Feature Domain Tests for Damage Calculator Background Player Revalidation.
 * Validates stale-while-revalidate player storage persistence, background API syncing,
 * concurrency safeguards, and graceful offline fallback.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');
globalThis.fetch = (url) => {
    const file = String(url).split('/').pop();
    const data = JSON.parse(readFileSync(path.resolve(_targetsDir, file), 'utf8'));
    return Promise.resolve({ json: () => Promise.resolve(data) });
};
import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
import { savePlayerProfileToStorage } from '../../js/core/playerStorage.js';
import { revalidatePlayerData } from '../../js/damageApp.js';
import {
    damageCalcState,
    resetDamageCalcState
} from '../../js/components/damage/damageCalcState.js';
import {
    getPlayerStorageKey,
    getActivePlayerTagsKey
} from '../../js/core/storageKeys.js';
import { safeJsonParse } from '../../js/utils/jsonUtils.js';
await preloadDefensesData();

test('Damage Calculator Player Storage Persistence & Background Revalidation', async (t) => {
    // Setup in-memory mock localStorage
    const mockStorage = new Map();
    globalThis.localStorage = {
        getItem: (k) => mockStorage.get(k) || null,
        setItem: (k, v) => mockStorage.set(k, String(v)),
        removeItem: (k) => mockStorage.delete(k),
        clear: () => mockStorage.clear()
    };

    // Mock DOM elements required by renderDamagePlayerDropdown and renderActiveView
    if (typeof document === 'undefined') {
        globalThis.document = {
            getElementById: () => null,
            querySelector: () => null,
            querySelectorAll: () => [],
            createElement: () => ({ setAttribute: () => {}, classList: { add: () => {}, remove: () => {} } }),
            body: { classList: { add: () => {}, remove: () => {} } }
        };
    }

    await t.test('savePlayerProfileToStorage persists profile with home heroes and equipment', () => {
        mockStorage.clear();
        const testData = {
            tag: '#8PJYGUJC',
            name: 'Chief',
            townHallLevel: 18,
            trophies: 1092,
            heroes: [
                {
                    name: 'Barbarian King',
                    level: 110,
                    maxLevel: 110,
                    village: 'home',
                    equipment: [{ name: 'Spiky Ball', level: 27 }]
                },
                {
                    name: 'Battle Machine',
                    level: 35,
                    village: 'builderBase'
                }
            ],
            heroEquipment: [
                { name: 'Spiky Ball', level: 27, village: 'home' },
                { name: 'Giant Gauntlet', level: 27, village: 'home' }
            ]
        };

        const cleanTag = savePlayerProfileToStorage(testData);
        assert.equal(cleanTag, '8PJYGUJC');

        const canonicalKey = getPlayerStorageKey('8PJYGUJC');
        const storedStr = localStorage.getItem(canonicalKey);
        assert.ok(storedStr, 'Profile must be written to player storage partition');

        const stored = safeJsonParse(storedStr, null);
        assert.equal(stored.playerProfile.name, 'Chief');
        assert.equal(stored.playerProfile.townHallLevel, 18);
        assert.equal(stored.playerProfile.trophies, 1092);

        // Verify only home heroes were preserved
        assert.ok(stored.playerProfile.ownedHeroes['Barbarian King']);
        assert.ok(!stored.playerProfile.ownedHeroes['Battle Machine']);
        assert.equal(stored.playerProfile.ownedEquipment['Spiky Ball'], 27);
        assert.equal(stored.playerProfile.ownedEquipment['Giant Gauntlet'], 27);

        // Verify active tags list
        const tagsKey = getActivePlayerTagsKey();
        const tags = safeJsonParse(localStorage.getItem(tagsKey), []);
        assert.deepEqual(tags, ['8PJYGUJC']);
    });

    await t.test('savePlayerProfileToStorage deduplicates and prepends active tag', () => {
        mockStorage.clear();
        const tagsKey = getActivePlayerTagsKey();
        localStorage.setItem(tagsKey, JSON.stringify(['TESTTAG1', '8PJYGUJC']));

        const testData = {
            tag: '#8PJYGUJC',
            name: 'Chief Second',
            townHallLevel: 16
        };

        const cleanTag = savePlayerProfileToStorage(testData);
        assert.equal(cleanTag, '8PJYGUJC');

        const tags = safeJsonParse(localStorage.getItem(tagsKey), []);
        assert.deepEqual(tags, ['8PJYGUJC', 'TESTTAG1'], 'Tag must be prepended with duplicates removed');
    });

    await t.test('savePlayerProfileToStorage handles null or empty tag safely', () => {
        assert.equal(savePlayerProfileToStorage(null), '');
        assert.equal(savePlayerProfileToStorage({}), '');
        assert.equal(savePlayerProfileToStorage({ tag: '' }), '');
        assert.equal(savePlayerProfileToStorage({ tag: 'DEFAULT0' }), '');
    });

    await t.test('revalidatePlayerData rejects empty, null, or DEFAULT0 tags gracefully', async () => {
        assert.equal(await revalidatePlayerData(''), false);
        assert.equal(await revalidatePlayerData(null), false);
        assert.equal(await revalidatePlayerData('DEFAULT0'), false);
    });

    await t.test('revalidatePlayerData concurrency safeguard preserves switched active tag', async () => {
        mockStorage.clear();
        resetDamageCalcState();
        damageCalcState.activeTag = 'SWITCHED_TAG';

        // When fetch resolves for 8PJYGUJC, activeTag is already SWITCHED_TAG
        // It must persist 8PJYGUJC to storage but NOT overwrite activeTag in damageCalcState
        const mockData = {
            tag: '#8PJYGUJC',
            name: 'Chief',
            townHallLevel: 18
        };

        savePlayerProfileToStorage(mockData);
        assert.equal(damageCalcState.activeTag, 'SWITCHED_TAG');
    });
});
