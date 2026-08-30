import test, { describe } from 'node:test';
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

describe('Player URL Router Suite', () => {
    test('getPlayerTagFromUrl extracts and normalizes various query parameters', async () => {
        const { getPlayerTagFromUrl } = await import('../../js/core/playerUrlRouter.js');

        const originalWindow = globalThis.window;
        try {
            // Test ?tag=8PJYGUJC
            globalThis.window = {
                location: {
                    search: '?tag=8PJYGUJC'
                }
            };
            assert.equal(getPlayerTagFromUrl(), '8PJYGUJC');

            // Test lowercase and leading hashes ?tag=##2pp
            globalThis.window = {
                location: {
                    search: '?tag=##2pp'
                }
            };
            assert.equal(getPlayerTagFromUrl(), '2PP');

            // Test ?p=abc
            globalThis.window = {
                location: {
                    search: '?p=abc'
                }
            };
            assert.equal(getPlayerTagFromUrl(), 'ABC');

            // Test ?player=xyz
            globalThis.window = {
                location: {
                    search: '?player=xyz'
                }
            };
            assert.equal(getPlayerTagFromUrl(), 'XYZ');

            // Test DEFAULT0 fallback
            globalThis.window = {
                location: {
                    search: '?tag=DEFAULT0'
                }
            };
            assert.equal(getPlayerTagFromUrl(), null);

            // Test empty search
            globalThis.window = {
                location: {
                    search: ''
                }
            };
            assert.equal(getPlayerTagFromUrl(), null);
        } finally {
            globalThis.window = originalWindow;
        }
    });

    test('syncPlayerTagToUrl updates search parameters preserving pathname and hash', async () => {
        const { syncPlayerTagToUrl } = await import('../../js/core/playerUrlRouter.js');

        const originalWindow = globalThis.window;
        try {
            let replacedUrl = null;
            globalThis.window = {
                location: {
                    href: 'https://orecalc.tech/de/?foo=bar#planner',
                    pathname: '/de/',
                    search: '?foo=bar',
                    hash: '#planner'
                },
                history: {
                    replaceState: (_state, _title, url) => {
                        replacedUrl = url;
                    }
                }
            };

            syncPlayerTagToUrl('#8PJYGUJC');
            assert.equal(replacedUrl, '/de/?foo=bar&tag=8PJYGUJC#planner');

            // Remove tag when passing null or DEFAULT0
            globalThis.window.location.href = 'https://orecalc.tech/de/?tag=8PJYGUJC#planner';
            globalThis.window.location.search = '?tag=8PJYGUJC';

            syncPlayerTagToUrl(null);
            assert.equal(replacedUrl, '/de/#planner');
        } finally {
            globalThis.window = originalWindow;
        }
    });

    test('verifies urlTag bootstrap prioritizes cached recent partitions and switches active player', async () => {
        const { loadPlayerData, updateSavedPlayerTags, getPlayerStorageKey } = await import('../../js/core/localStorageManager.js');
        const { state, getDefaultPlayerState } = await import('../../js/core/state.js');
        const { switchActivePlayer } = await import('../../js/core/stateManager.js');

        const testTag = 'GUYCG8G9R';
        const samplePlayer = getDefaultPlayerState();
        samplePlayer.playerProfile = { name: 'JeffLogos', tag: `#${testTag}` };

        if (!state.allPlayersData) state.allPlayersData = {};
        if (!state.savedPlayerTags) state.savedPlayerTags = [];
        if (!state.uiSettings) state.uiSettings = {};

        try {
            localStorage.setItem(getPlayerStorageKey(testTag), JSON.stringify(samplePlayer));
            const cached = loadPlayerData(testTag);
            assert.ok(cached, 'Cached player partition must be retrievable via loadPlayerData');
            assert.equal(cached.playerProfile.name, 'JeffLogos');

            state.allPlayersData[testTag] = cached;
            updateSavedPlayerTags(testTag);
            switchActivePlayer(testTag);

            assert.equal(state.savedPlayerTags[0], testTag, 'Active tag must be shifted to index 0');
            assert.equal(state.playerProfile?.name, 'JeffLogos', 'Active state.playerProfile must point to new player');
        } finally {
            localStorage.removeItem(getPlayerStorageKey(testTag));
        }
    });
});
