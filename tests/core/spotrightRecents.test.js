/**
 * Feature Domain Test Suite: Spotright Recent Searches Management.
 * Asserts LRU capacity, hoisting, removal, storage serialization, and registry resolution.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    getRecentItemIds,
    addRecentItem,
    removeRecentItem,
    clearRecentItems,
    resolveRecentItems
} from '../../js/components/spotright/spotrightRecents.js';
import { SPOTRIGHT_RECENTS_KEY } from '../../js/core/storageKeys.js';
import { MAX_RECENT_SEARCHES } from '../../js/core/constants.js';

describe('Spotright Recents Domain Suite', () => {
    /** @type {Map<string, string>} */
    const mockStorage = new Map();

    beforeEach(() => {
        mockStorage.clear();
        globalThis.localStorage = {
            getItem: (k) => mockStorage.get(k) || null,
            setItem: (k, v) => mockStorage.set(k, String(v)),
            removeItem: (k) => mockStorage.delete(k),
            clear: () => mockStorage.clear(),
            key: (i) => Array.from(mockStorage.keys())[i] || null,
            get length() { return mockStorage.size; }
        };
    });

    test('getRecentItemIds returns empty array when localStorage is empty', () => {
        assert.deepEqual(getRecentItemIds(), []);
    });

    test('getRecentItemIds safely handles invalid JSON or non-array values', () => {
        mockStorage.set(SPOTRIGHT_RECENTS_KEY, '{ invalid json');
        assert.deepEqual(getRecentItemIds(), []);

        mockStorage.set(SPOTRIGHT_RECENTS_KEY, JSON.stringify({ not: 'an array' }));
        assert.deepEqual(getRecentItemIds(), []);

        mockStorage.set(SPOTRIGHT_RECENTS_KEY, JSON.stringify(['valid-1', '', null, 123, 'valid-2']));
        assert.deepEqual(getRecentItemIds(), ['valid-1', 'valid-2']);
    });

    test('addRecentItem enforces strict LRU hoisting and maximum 5-item cap', () => {
        addRecentItem('item-1');
        addRecentItem('item-2');
        addRecentItem('item-3');
        assert.deepEqual(getRecentItemIds(), ['item-3', 'item-2', 'item-1']);

        // Hoisting: re-adding item-1 brings it to index 0
        addRecentItem('item-1');
        assert.deepEqual(getRecentItemIds(), ['item-1', 'item-3', 'item-2']);

        // Fill up to cap of 5
        addRecentItem('item-4');
        addRecentItem('item-5');
        assert.equal(getRecentItemIds().length, MAX_RECENT_SEARCHES);
        assert.deepEqual(getRecentItemIds(), ['item-5', 'item-4', 'item-1', 'item-3', 'item-2']);

        // 6th item pushes out the oldest (item-2)
        addRecentItem('item-6');
        assert.equal(getRecentItemIds().length, MAX_RECENT_SEARCHES);
        assert.deepEqual(getRecentItemIds(), ['item-6', 'item-5', 'item-4', 'item-1', 'item-3']);
        assert.equal(getRecentItemIds().includes('item-2'), false);
    });

    test('removeRecentItem surgically removes specific ID and cleans storage on empty', () => {
        addRecentItem('item-a');
        addRecentItem('item-b');
        addRecentItem('item-c');

        removeRecentItem('item-b');
        assert.deepEqual(getRecentItemIds(), ['item-c', 'item-a']);

        removeRecentItem('item-c');
        removeRecentItem('item-a');
        assert.deepEqual(getRecentItemIds(), []);
        assert.equal(mockStorage.has(SPOTRIGHT_RECENTS_KEY), false);
    });

    test('clearRecentItems completely clears the storage key', () => {
        addRecentItem('item-1');
        addRecentItem('item-2');
        assert.equal(getRecentItemIds().length, 2);

        clearRecentItems();
        assert.deepEqual(getRecentItemIds(), []);
        assert.equal(mockStorage.has(SPOTRIGHT_RECENTS_KEY), false);
    });

    test('resolveRecentItems maps IDs to live registry items and applies recent category metadata', () => {
        const dummyRegistry = [
            { id: 'eq-gauntlet', title: 'Giant Gauntlet', category: 'Equipment' },
            { id: 'nav-calc', title: 'Ore Calculator', category: 'Tools & Views' },
            { id: 'village-8PJY', title: 'Chief', category: 'Villages' }
        ];

        addRecentItem('nav-calc');
        addRecentItem('eq-gauntlet');

        const resolved = resolveRecentItems(/** @type {any} */ (dummyRegistry));
        assert.equal(resolved.length, 2);
        assert.equal(resolved[0].id, 'eq-gauntlet');
        assert.equal(resolved[0].title, 'Giant Gauntlet');
        assert.equal(resolved[0].isRecent, true);
        assert.equal(resolved[1].id, 'nav-calc');
        assert.equal(resolved[1].isRecent, true);
    });

    test('resolveRecentItems self-heals by pruning orphan IDs absent from the registry', () => {
        const dummyRegistry = [
            { id: 'valid-item', title: 'Valid Item', category: 'Tools' }
        ];

        addRecentItem('valid-item');
        addRecentItem('deleted-orphan');
        assert.equal(getRecentItemIds().length, 2);

        const resolved = resolveRecentItems(/** @type {any} */ (dummyRegistry));
        assert.equal(resolved.length, 1);
        assert.equal(resolved[0].id, 'valid-item');

        // Storage was self-healed to only contain valid IDs
        assert.deepEqual(getRecentItemIds(), ['valid-item']);
    });
});
