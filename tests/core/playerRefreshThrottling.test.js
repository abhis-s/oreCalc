/**
 * Feature Domain Test Suite: Client-Side Player Data Refresh Throttling.
 * Asserts cooldown tracking, stale cache detection, clock anomaly guards, and profile summary parity.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    ACCOUNT_REFRESH_COOLDOWN_MS,
    getPlayerLastRefreshed,
    setPlayerLastRefreshed,
    isPlayerRefreshStale,
    getStaleTagsForRefresh
} from '../../js/core/playerRefreshThrottler.js';
import {
    getSavedProfiles,
    savePlayerProfileToStorage
} from '../../js/core/playerStorage.js';
import { state } from '../../js/core/state.js';
import { getPlayerStorageKey, getActivePlayerTagsKey } from '../../js/core/storageKeys.js';

describe('Player Refresh Throttling Domain Suite', () => {
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

        state.allPlayersData = {};
        state.savedPlayerTags = [];
    });

    test('ACCOUNT_REFRESH_COOLDOWN_MS defines canonical 10-minute cooldown window', () => {
        assert.equal(ACCOUNT_REFRESH_COOLDOWN_MS, 10 * 60 * 1000);
        assert.equal(ACCOUNT_REFRESH_COOLDOWN_MS, 600000);
    });

    test('getPlayerLastRefreshed safely handles invalid, empty, or DEFAULT0 tags', () => {
        assert.equal(getPlayerLastRefreshed(''), 0);
        assert.equal(getPlayerLastRefreshed('DEFAULT0'), 0);
        assert.equal(getPlayerLastRefreshed('#DEFAULT0'), 0);
        assert.equal(getPlayerLastRefreshed(null), 0);
        assert.equal(getPlayerLastRefreshed(undefined), 0);
    });

    test('getPlayerLastRefreshed reads timestamp from in-memory partition or localStorage partition', () => {
        const tag = '8PJYGUJC';
        const now = 1700000000000;

        // In-memory state partition
        state.allPlayersData = {
            '8PJYGUJC': { lastRefreshedAt: now }
        };
        assert.equal(getPlayerLastRefreshed(tag), now);

        // Fallback to localStorage partition when in-memory state is empty
        state.allPlayersData = {};
        const key = getPlayerStorageKey(tag);
        mockStorage.set(key, JSON.stringify({
            heroes: {},
            lastRefreshedAt: now + 5000
        }));
        assert.equal(getPlayerLastRefreshed(tag), now + 5000);
    });

    test('setPlayerLastRefreshed updates both in-memory state and localStorage partition', () => {
        const tag = '8PJYGUJC';
        const key = getPlayerStorageKey(tag);
        mockStorage.set(key, JSON.stringify({
            heroes: {},
            playerProfile: { name: 'Chief' }
        }));
        state.allPlayersData = {
            '8PJYGUJC': { heroes: {} }
        };

        const targetTime = 1710000000000;
        setPlayerLastRefreshed(tag, targetTime);

        assert.equal(state.allPlayersData['8PJYGUJC'].lastRefreshedAt, targetTime);
        const stored = JSON.parse(mockStorage.get(key) || '{}');
        assert.equal(stored.lastRefreshedAt, targetTime);
    });

    test('isPlayerRefreshStale accurately classifies fresh, expired, missing, and anomalous timestamps', () => {
        const tag = '9V8UYQ';

        assert.equal(isPlayerRefreshStale('DEFAULT0'), false);
        assert.equal(isPlayerRefreshStale(''), false);

        assert.equal(isPlayerRefreshStale(tag), true);

        const now = Date.now();
        setPlayerLastRefreshed(tag, now - (3 * 60 * 1000));
        assert.equal(isPlayerRefreshStale(tag), false);

        setPlayerLastRefreshed(tag, now - (10 * 60 * 1000));
        assert.equal(isPlayerRefreshStale(tag), true);

        setPlayerLastRefreshed(tag, now - (25 * 60 * 1000));
        assert.equal(isPlayerRefreshStale(tag), true);

        setPlayerLastRefreshed(tag, now + 120000);
        assert.equal(isPlayerRefreshStale(tag), true);

        setPlayerLastRefreshed(tag, now - 5000);
        assert.equal(isPlayerRefreshStale(tag, 3000), true);
        assert.equal(isPlayerRefreshStale(tag, 10000), false);
    });

    test('getStaleTagsForRefresh filters a mixed list of player tags', () => {
        const now = Date.now();

        // Setup tags:
        // FRESH1: refreshed 2 mins ago
        // STALE1: refreshed 15 mins ago
        // NEW1: never refreshed (no timestamp)
        // DEFAULT0: guest tag
        setPlayerLastRefreshed('FRESH1', now - (2 * 60 * 1000));
        setPlayerLastRefreshed('STALE1', now - (15 * 60 * 1000));

        const result = getStaleTagsForRefresh(['#FRESH1', '#STALE1', '#NEW1', 'DEFAULT0', '']);
        assert.deepEqual(result, ['#STALE1', '#NEW1']);
    });

    test('getSavedProfiles includes lastRefreshedAt on profile summaries', () => {
        const now = 1720000000000;
        const tagsKey = getActivePlayerTagsKey();
        mockStorage.set(tagsKey, JSON.stringify(['#TAG1', '#TAG2']));

        const p1Key = getPlayerStorageKey('TAG1');
        mockStorage.set(p1Key, JSON.stringify({
            playerProfile: { name: 'Player One', townHallLevel: 17, trophies: 5200 },
            lastRefreshedAt: now
        }));

        const p2Key = getPlayerStorageKey('TAG2');
        mockStorage.set(p2Key, JSON.stringify({
            playerProfile: { name: 'Player Two', townHallLevel: 15, trophies: 3400 }
        }));

        const profiles = getSavedProfiles();
        assert.equal(profiles.length, 2);

        const p1 = profiles.find(p => p.cleanTag === 'TAG1');
        assert.ok(p1);
        assert.equal(p1.lastRefreshedAt, now);

        const p2 = profiles.find(p => p.cleanTag === 'TAG2');
        assert.ok(p2);
        assert.equal(p2.lastRefreshedAt, 0);
    });

    test('savePlayerProfileToStorage automatically stamps lastRefreshedAt on partition', () => {
        const before = Date.now();
        const testPayload = {
            tag: '#TESTTAG',
            name: 'TestChief',
            townHallLevel: 18,
            trophies: 4500,
            heroes: []
        };

        savePlayerProfileToStorage(testPayload, true);
        const after = Date.now();

        const canonicalKey = getPlayerStorageKey('TESTTAG');
        const stored = JSON.parse(mockStorage.get(canonicalKey) || '{}');
        assert.ok(stored.lastRefreshedAt >= before && stored.lastRefreshedAt <= after);
    });
});
