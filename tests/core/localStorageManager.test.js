import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => store.get(key) || null,
        setItem: (key, val) => store.set(key, String(val)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; }
    };
}

import { state } from '../../js/core/state.js';
import { MAX_SAVED_PLAYERS } from '../../js/core/constants.js';
import { updateSavedPlayerTags, updateAllPlayersData, saveState } from '../../js/core/localStorageManager.js';

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
