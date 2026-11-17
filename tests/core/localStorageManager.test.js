import { test } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        key: (i) => Array.from(store.keys())[i] || null,
        get length() { return store.size; }
    };
}

import { state } from '../../js/core/state.js';
import { MAX_SAVED_PLAYERS } from '../../js/core/constants.js';
import { saveState, loadState } from '../../js/core/localStorageManager.js';
import { updateSavedPlayerTags, updateAllPlayersData, getSavedProfiles, getSavedPlayerTagsList, removePlayerTag } from '../../js/core/playerStorage.js';
import { getActivePlayerTagsKey, getPlayerStorageKey } from '../../js/core/storageKeys.js';

test('localStorageManager supports up to MAX_SAVED_PLAYERS (12) without truncating', () => {
    state.uiSettings = { currency: { code: 'USD' } };
    state.savedPlayerTags = [];
    state.allPlayersData = {};

    for (let i = 1; i <= 12; i++) {
        const tag = `PLAYER${i}`;
        const mockPlayerState = {
            heroes: {},
            storedOres: { shiny: i * 100 },
            income: {},
            planner: {}
        };
        updateSavedPlayerTags(tag);
        updateAllPlayersData(tag, mockPlayerState);
    }

    assert.equal(state.savedPlayerTags.length, 12);
    assert.equal(Object.keys(state.allPlayersData).length, 12);
    assert.equal(state.savedPlayerTags[0], 'PLAYER12');
    assert.ok(state.allPlayersData['PLAYER1']);
    assert.ok(state.allPlayersData['PLAYER7']);
});

test('localStorageManager purges surplus when exceeding MAX_SAVED_PLAYERS', () => {
    state.savedPlayerTags = [];
    state.allPlayersData = {};

    for (let i = 1; i <= 15; i++) {
        const tag = `PLAYER${i}`;
        const mockPlayerState = { heroes: {}, storedOres: { shiny: i * 10 } };
        updateSavedPlayerTags(tag);
        updateAllPlayersData(tag, mockPlayerState);
    }

    assert.equal(state.savedPlayerTags.length, MAX_SAVED_PLAYERS);
    assert.equal(Object.keys(state.allPlayersData).length, MAX_SAVED_PLAYERS);
});

test('saveState handles uninitialized, null, and empty state objects without throwing', () => {
    assert.doesNotThrow(() => {
        // @ts-expect-error - Testing defensive boundary
        saveState(null, true);
    });

    assert.doesNotThrow(() => {
        // @ts-expect-error - Testing defensive boundary
        saveState({}, true);
    });

    assert.doesNotThrow(() => {
        // @ts-expect-error - Testing defensive boundary
        saveState({ savedPlayerTags: undefined }, true);
    });

    assert.doesNotThrow(() => {
        // @ts-expect-error - Testing defensive boundary
        saveState({ savedPlayerTags: [], allPlayersData: null }, true);
    });
});

test('getSavedProfiles immediately reflects newly added player tags and profiles synchronously', () => {
    state.savedPlayerTags = [];
    state.allPlayersData = {};

    const tag = 'SYNCTEST99';
    const mockPlayerState = {
        playerProfile: {
            name: 'Sync Chief',
            tag: '#SYNCTEST99',
            townHallLevel: 17,
            trophies: 5400
        },
        heroes: {},
        storedOres: { shiny: 5000 },
        income: {},
        planner: {}
    };

    updateSavedPlayerTags(tag);
    updateAllPlayersData(tag, mockPlayerState);

    const tagsList = getSavedPlayerTagsList();
    assert.deepEqual(tagsList, ['SYNCTEST99']);

    const profiles = getSavedProfiles();
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].cleanTag, 'SYNCTEST99');
    assert.equal(profiles[0].name, 'Sync Chief');
    assert.equal(profiles[0].townHallLevel, 17);
    assert.equal(profiles[0].trophies, 5400);
});

test('removePlayerTag with empty string or null does not mutate tags or delete accounts', () => {
    state.savedPlayerTags = ['DEFAULT0'];
    localStorage.setItem('clashCalc_playerTags', JSON.stringify(['DEFAULT0']));
    removePlayerTag('');
    removePlayerTag(null);
    removePlayerTag(undefined);

    const tags = JSON.parse(localStorage.getItem('clashCalc_playerTags') || '[]');
    assert.deepEqual(tags, ['DEFAULT0']);
});

test('updateSavedPlayerTags with empty string does not remove DEFAULT0 or add empty tag', () => {
    state.savedPlayerTags = ['DEFAULT0'];
    updateSavedPlayerTags('');
    updateSavedPlayerTags(null);

    assert.ok(state.savedPlayerTags.includes('DEFAULT0'));
    assert.ok(!state.savedPlayerTags.includes(''));
});

test('loadState preserves storedOres and other slices on partial partitions lacking heroes', () => {
    const testTag = 'PARTIALTAG1';
    state.savedPlayerTags = [testTag];
    const tagsKey = getActivePlayerTagsKey();
    localStorage.setItem(tagsKey, JSON.stringify([testTag]));
    const storageKey = getPlayerStorageKey(testTag);
    localStorage.setItem(storageKey, JSON.stringify({
        storedOres: { shiny: 8888, glowy: 444, starry: 22 },
        heroJourney: { acceleratedRewards: true, revealBeyondTH: true, hidden: false },
        playerProfile: { name: 'Partial Tester', tag: `#${testTag}`, townHallLevel: 16 }
    }));

    const loaded = loadState();

    assert.ok(loaded, 'loadState must return a reconstructed state object');
    const partition = loaded.allPlayersData[testTag];
    assert.ok(partition, 'Player partition must be loaded in allPlayersData');
    assert.equal(partition.storedOres?.shiny, 8888, 'storedOres must not be wiped');
    assert.equal(partition.heroJourney?.acceleratedRewards, true, 'heroJourney must not be wiped');
    assert.ok(partition.heroes, 'Default heroes must be populated additively');
});
