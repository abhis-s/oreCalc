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

import { refreshSavedProfilesSequentially, ACCOUNT_REFRESH_DELAY_MS } from '../../js/components/landing/landingAccountsController.js';
import { state } from '../../js/core/state.js';

beforeEach(() => {
    globalThis.localStorage.clear();
    state.savedPlayerTags = [];
    state.allPlayersData = {};
});

test('refreshSavedProfilesSequentially handles empty or invalid tag lists safely', async () => {
    let callCount = 0;
    // @ts-expect-error - Testing defensive boundaries
    await refreshSavedProfilesSequentially(null, () => { callCount++; });
    // @ts-expect-error - Testing defensive boundaries
    await refreshSavedProfilesSequentially(undefined, () => { callCount++; });
    await refreshSavedProfilesSequentially([], () => { callCount++; });

    assert.equal(callCount, 0);
});

test('refreshSavedProfilesSequentially skips DEFAULT0 and invalid tags', async () => {
    const updatedTags = [];
    await refreshSavedProfilesSequentially(['DEFAULT0', '', null], (tag) => {
        updatedTags.push(tag);
    });

    assert.equal(updatedTags.length, 0);
});

test('refreshSavedProfilesSequentially processes profiles sequentially and triggers callback', async () => {
    const originalFetch = globalThis.fetch;
    const fetchOrder = [];

    globalThis.fetch = async (url) => {
        const urlStr = String(url);
        const tagMatch = urlStr.match(/\/proxy\/players\/([A-Z0-9]+)/i);
        const tag = tagMatch ? tagMatch[1] : 'UNKNOWN';
        fetchOrder.push(tag);

        return {
            ok: true,
            status: 200,
            json: async () => ({
                tag: `#${tag}`,
                name: `Player ${tag}`,
                townHallLevel: 16,
                heroes: [],
                heroEquipment: []
            })
        };
    };

    try {
        const updatedTags = [];
        await refreshSavedProfilesSequentially(['VILLAGE1', 'VILLAGE2'], (tag) => {
            updatedTags.push(tag);
        });

        assert.deepEqual(fetchOrder, ['VILLAGE1', 'VILLAGE2']);
        assert.deepEqual(updatedTags, ['VILLAGE1', 'VILLAGE2']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('refreshSavedProfilesSequentially continues to next profile if one fails', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('FAILING')) {
            return {
                ok: false,
                status: 404,
                json: async () => ({ error: 'notFound' })
            };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({
                tag: '#PASSING1',
                name: 'Passing Player',
                townHallLevel: 17,
                heroes: [],
                heroEquipment: []
            })
        };
    };

    try {
        const updatedTags = [];
        await refreshSavedProfilesSequentially(['FAILING', 'PASSING1'], (tag) => {
            updatedTags.push(tag);
        });

        assert.deepEqual(updatedTags, ['PASSING1']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('refreshSavedProfilesSequentially supports options object with onTagStart, throttle, and summary return', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('FAILING')) {
            return {
                ok: false,
                status: 404,
                json: async () => ({ error: 'notFound' })
            };
        }
        return {
            ok: true,
            status: 200,
            json: async () => ({
                tag: '#PASSING1',
                name: 'Passing Player',
                townHallLevel: 17,
                heroes: [],
                heroEquipment: []
            })
        };
    };

    try {
        const startedTags = [];
        const updatedTags = [];
        const startTime = Date.now();

        const summary = await refreshSavedProfilesSequentially(['FAILING', 'PASSING1'], {
            throttleMs: 50,
            onTagStart: (tag) => {
                startedTags.push(tag);
            },
            onProfileUpdated: (tag) => {
                updatedTags.push(tag);
            }
        });

        const elapsed = Date.now() - startTime;
        assert.deepEqual(startedTags, ['FAILING', 'PASSING1']);
        assert.deepEqual(updatedTags, ['PASSING1']);
        assert.deepEqual(summary, { total: 2, successCount: 1, failedCount: 1 });
        assert.ok(elapsed >= 40, `Throttle should introduce delay, elapsed: ${elapsed}ms`);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('ACCOUNT_REFRESH_DELAY_MS is strictly defined as 2000ms', () => {
    assert.equal(ACCOUNT_REFRESH_DELAY_MS, 2000);
});

test('refreshSavedProfilesSequentially executes delay strictly between account fetches', async () => {
    const originalFetch = globalThis.fetch;
    const fetchTimestamps = [];

    globalThis.fetch = async () => {
        fetchTimestamps.push(Date.now());
        return {
            ok: true,
            status: 200,
            json: async () => ({
                tag: '#TAG1',
                name: 'Player',
                townHallLevel: 16,
                heroes: [],
                heroEquipment: []
            })
        };
    };

    try {
        await refreshSavedProfilesSequentially(['TAG1', 'TAG2', 'TAG3'], {
            throttleMs: 40
        });

        assert.equal(fetchTimestamps.length, 3);
        const gap1 = fetchTimestamps[1] - fetchTimestamps[0];
        const gap2 = fetchTimestamps[2] - fetchTimestamps[1];
        assert.ok(gap1 >= 30, `Gap 1 between fetch 1 and 2 should be >= 30ms, got ${gap1}ms`);
        assert.ok(gap2 >= 30, `Gap 2 between fetch 2 and 3 should be >= 30ms, got ${gap2}ms`);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
