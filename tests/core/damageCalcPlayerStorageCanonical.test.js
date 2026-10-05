import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        key: (idx) => Array.from(store.keys())[idx] || null,
        get length() { return store.size; }
    };
}

import { getSavedProfiles, savePlayerProfileToStorage } from '../../js/core/playerStorage.js';
import { loadState } from '../../js/core/localStorageManager.js';
import { state } from '../../js/core/state.js';
import { safeJsonParse } from '../../js/utils/jsonUtils.js';
import { getPlayerStorageKey, getActivePlayerTagsKey } from '../../js/core/storageKeys.js';

beforeEach(() => {
    globalThis.localStorage.clear();
    state.savedPlayerTags = [];
    state.allPlayersData = {};
});

test('savePlayerProfileToStorage writes complete canonical partition preserving all domain properties', () => {
    const mockApiResponse = {
        tag: '#TEST9999',
        name: 'Thunder Chief',
        townHallLevel: 17,
        trophies: 5250,
        warStars: 1400,
        clan: {
            tag: '#CLAN123',
            name: 'Clash Legends',
            badgeUrls: { small: 'https://example.com/badge.png' }
        },
        heroes: [
            {
                name: 'Barbarian King',
                level: 95,
                maxLevel: 95,
                village: 'home',
                equipment: [
                    { name: 'Giant Gauntlet', level: 27 },
                    { name: 'Spiky Ball', level: 27 }
                ]
            }
        ],
        heroEquipment: [
            { name: 'Giant Gauntlet', level: 27, village: 'home' },
            { name: 'Spiky Ball', level: 27, village: 'home' }
        ]
    };

    const serverTag = savePlayerProfileToStorage(mockApiResponse);
    assert.equal(serverTag, 'TEST9999');

    const canonicalKey = getPlayerStorageKey(serverTag);
    const storedRaw = globalThis.localStorage.getItem(canonicalKey);
    assert.ok(storedRaw, 'Storage key must be present in localStorage');

    const partition = safeJsonParse(storedRaw, null);
    assert.ok(partition, 'Partition must parse as valid JSON');

    // Assert canonical structure is present
    assert.ok(partition.heroes, 'Partition must include heroes structure');
    assert.ok(partition.storedOres, 'Partition must include storedOres structure');
    assert.ok(partition.income, 'Partition must include income structure');
    assert.ok(partition.planner, 'Partition must include planner structure');
    assert.ok(partition.heroJourney, 'Partition must include heroJourney structure');
    assert.ok(partition.playerProfile, 'Partition must include playerProfile structure');

    // Assert profile metadata integrity
    assert.equal(partition.playerProfile.name, 'Thunder Chief');
    assert.equal(partition.playerProfile.townHallLevel, 17);
    assert.equal(partition.playerProfile.trophies, 5250);
    assert.equal(partition.playerProfile.clan?.name, 'Clash Legends');
    assert.equal(partition.heroes['Barbarian King']?.equipment['Giant Gauntlet']?.level, 27);
});

test('loadState loads damage calc partition without wiping playerProfile or reverting to TH1 defaults', () => {
    const mockApiResponse = {
        tag: '#ALPHA77',
        name: 'Alpha Leader',
        townHallLevel: 18,
        trophies: 5600,
        heroes: [
            { name: 'Archer Queen', level: 95, maxLevel: 95, village: 'home', equipment: [] }
        ]
    };

    savePlayerProfileToStorage(mockApiResponse);

    const loadedState = loadState();
    assert.ok(loadedState, 'loadState must return state object');
    assert.ok(loadedState.savedPlayerTags.includes('ALPHA77'), 'savedPlayerTags must include ALPHA77');

    const playerObj = loadedState.allPlayersData['ALPHA77'];
    assert.ok(playerObj, 'ALPHA77 partition must exist in allPlayersData');
    assert.ok(playerObj.playerProfile, 'playerProfile must not be wiped to null');
    assert.equal(playerObj.playerProfile.name, 'Alpha Leader');
    assert.equal(playerObj.playerProfile.townHallLevel, 18);
    assert.equal(playerObj.playerProfile.trophies, 5600);

    state.savedPlayerTags = loadedState.savedPlayerTags;
    state.allPlayersData = loadedState.allPlayersData;

    const summaries = getSavedProfiles();
    assert.equal(summaries.length, 1);
    assert.equal(summaries[0].cleanTag, 'ALPHA77');
    assert.equal(summaries[0].name, 'Alpha Leader');
    assert.equal(summaries[0].townHallLevel, 18);
    assert.equal(summaries[0].trophies, 5600);
});

test('loadState defensively preserves existing playerProfile even if partition heroes structure was missing', () => {
    const partialPartition = {
        playerProfile: {
            tag: '#PARTIAL1',
            name: 'Resilient Chief',
            townHallLevel: 16,
            trophies: 4900
        }
    };

    const tagsKey = getActivePlayerTagsKey();
    const playerKey = getPlayerStorageKey('PARTIAL1');
    globalThis.localStorage.setItem(tagsKey, JSON.stringify(['PARTIAL1']));
    globalThis.localStorage.setItem(playerKey, JSON.stringify(partialPartition));

    const loadedState = loadState();
    assert.ok(loadedState, 'loadState must return populated state');
    const playerObj = loadedState.allPlayersData['PARTIAL1'];

    assert.ok(playerObj, 'PARTIAL1 partition must be loaded');
    assert.ok(playerObj.heroes, 'heroes structure must be initialized from defaults');
    assert.ok(playerObj.playerProfile, 'playerProfile must be preserved defensively');
    assert.equal(playerObj.playerProfile.name, 'Resilient Chief');
    assert.equal(playerObj.playerProfile.townHallLevel, 16);
    assert.equal(playerObj.playerProfile.trophies, 4900);
});
