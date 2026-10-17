import { describe, test, beforeEach, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    extractPlayerTag,
    detectClipboardPlayerTag,
    switchOrLoadPlayerTag,
    switchSavedVillage,
    loadAndSwitchPlayerTag,
    createClipboardSpotrightItem
} from '../../js/components/spotright/spotrightClipboard.js';
import {
    buildSpotrightRegistry,
    getActiveUrlTag
} from '../../js/components/spotright/spotrightRegistry.js';
import { searchSpotright } from '../../js/components/spotright/spotrightMatcher.js';
import { loadTranslations } from '../../js/i18n/translator.js';
import { state } from '../../js/core/state.js';
import { getActivePlayerTagsKey, getPlayerStorageKey } from '../../js/core/storageKeys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const enJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'js/i18n/en.json'), 'utf8'));

describe('Spotright Player Tag Operations & Smart Clipboard Architecture', () => {
    /** @type {PropertyDescriptor | undefined} Original global navigator property descriptor */
    let originalNavigatorDesc;
    /** @type {any} Original window */
    let originalWindow;
    /** @type {any} Original localStorage */
    let originalLocalStorage;
    /** @type {any} Original fetch */
    let originalFetch;

    /**
     * Safely defines a mocked navigator on globalThis.
     * @param {any} mockObj
     */
    function setMockNavigator(mockObj) {
        Object.defineProperty(globalThis, 'navigator', {
            value: mockObj,
            configurable: true,
            writable: true
        });
    }

    before(async () => {
        state.uiSettings = { language: 'en' };
        originalFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
            if (String(url).includes('/en.json')) {
                return /** @type {any} */ ({ ok: true, json: async () => enJson });
            }
            return /** @type {any} */ ({ ok: false, status: 404 });
        };
        await loadTranslations('en');
        globalThis.fetch = originalFetch;
    });

    beforeEach(() => {
        originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
        originalWindow = globalThis.window;
        originalLocalStorage = globalThis.localStorage;
        state.savedPlayerTags = ['DEFAULT0'];
        state.allPlayersData = {};
    });

    afterEach(() => {
        if (originalNavigatorDesc) {
            Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
        }
        globalThis.window = originalWindow;
        globalThis.localStorage = originalLocalStorage;
        state.savedPlayerTags = ['DEFAULT0'];
        state.allPlayersData = {};
    });

    describe('extractPlayerTag', () => {
        test('extracts and normalizes clean player tags with or without leading hash', () => {
            assert.equal(extractPlayerTag('#8PJYGUJC'), '8PJYGUJC');
            assert.equal(extractPlayerTag('8PJYGUJC'), '8PJYGUJC');
            assert.equal(extractPlayerTag('#2PP'), '2PP');
            assert.equal(extractPlayerTag('9L0V9G9C9'), '9L0V9G9C9');
            assert.equal(extractPlayerTag('  #8pjygujc  '), '8PJYGUJC');
        });

        test('extracts player tag from official Clash of Clans profile share URLs', () => {
            const urlEncoded = 'https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=%238PJYGUJC';
            assert.equal(extractPlayerTag(urlEncoded), '8PJYGUJC');

            const urlPlain = 'https://link.clashofclans.com/?action=OpenPlayerProfile&tag=2PP09';
            assert.equal(extractPlayerTag(urlPlain), '2PP09');
        });

        test('returns null for empty, non-string, or invalid player tags', () => {
            assert.equal(extractPlayerTag(''), null);
            assert.equal(extractPlayerTag('   '), null);
            assert.equal(extractPlayerTag(/** @type {any} */ (null)), null);
            assert.equal(extractPlayerTag(/** @type {any} */ (undefined)), null);
            assert.equal(extractPlayerTag('DEFAULT0'), null);
            // Too short (< 3 chars)
            assert.equal(extractPlayerTag('#8P'), null);
            // Too long (> 12 chars)
            assert.equal(extractPlayerTag('0289CGJLOPQRUVY12345'), null);
            // Invalid characters 'I', 'S', '1', 'B' (excluded from Supercell Base32)
            assert.equal(extractPlayerTag('#8PJYGUJI'), null);
            assert.equal(extractPlayerTag('#INVALID'), null);
        });
    });

    describe('detectClipboardPlayerTag (Zero-Prompt Guarantee)', () => {
        test('reads clipboard text only when permission is strictly granted', async () => {
            let readCalled = false;
            setMockNavigator({
                permissions: {
                    query: async ({ name }) => {
                        assert.equal(name, 'clipboard-read');
                        return { state: 'granted' };
                    }
                },
                clipboard: {
                    readText: async () => {
                        readCalled = true;
                        return 'Found tag: #8PJYGUJC in text';
                    }
                }
            });

            const tag = await detectClipboardPlayerTag();
            assert.equal(readCalled, true, 'readText should be invoked when permission is granted');
            assert.equal(tag, '8PJYGUJC');
        });

        test('never invokes readText if permission is prompt (prevents browser prompt popup)', async () => {
            let readCalled = false;
            setMockNavigator({
                permissions: {
                    query: async () => ({ state: 'prompt' })
                },
                clipboard: {
                    readText: async () => {
                        readCalled = true;
                        return '#8PJYGUJC';
                    }
                }
            });

            const tag = await detectClipboardPlayerTag();
            assert.equal(readCalled, false, 'readText must NEVER be called if permission state is prompt');
            assert.equal(tag, null);
        });

        test('never invokes readText if permission is denied', async () => {
            let readCalled = false;
            setMockNavigator({
                permissions: {
                    query: async () => ({ state: 'denied' })
                },
                clipboard: {
                    readText: async () => {
                        readCalled = true;
                        return '#8PJYGUJC';
                    }
                }
            });

            const tag = await detectClipboardPlayerTag();
            assert.equal(readCalled, false, 'readText must NEVER be called if permission state is denied');
            assert.equal(tag, null);
        });

        test('fails silently when permissions.query throws (Safari/Firefox permission name error)', async () => {
            let readCalled = false;
            setMockNavigator({
                permissions: {
                    query: async () => {
                        throw new TypeError("Failed to execute 'query' on 'Permissions': 'clipboard-read' is not a valid enum value");
                    }
                },
                clipboard: {
                    readText: async () => {
                        readCalled = true;
                        return '#8PJYGUJC';
                    }
                }
            });

            const tag = await detectClipboardPlayerTag();
            assert.equal(readCalled, false, 'readText must NOT be called if query throws');
            assert.equal(tag, null);
        });

        test('returns null when navigator or permissions API is unavailable', async () => {
            setMockNavigator(undefined);
            assert.equal(await detectClipboardPlayerTag(), null);

            setMockNavigator({});
            assert.equal(await detectClipboardPlayerTag(), null);

            setMockNavigator({
                clipboard: {
                    readText: async () => '#8PJYGUJC'
                }
            });
            assert.equal(await detectClipboardPlayerTag(), null);
        });
    });

    describe('createClipboardSpotrightItem', () => {
        test('constructs valid Spotright item for clipboard detected player tag', () => {
            const item = createClipboardSpotrightItem('8PJYGUJC');
            assert.equal(item.id, 'clipboard-tag-8PJYGUJC');
            assert.equal(item.category, 'Clipboard');
            assert.equal(item.icon, 'copy');
            assert.equal(item.iconType, 'svg');
            assert.equal(item.priorityTier, 100);
            assert.ok(item.title.includes('8PJYGUJC'));
            assert.equal(item.isAsyncAction, true);
            assert.equal(typeof item.execute, 'function');
        });
    });

    describe('switchSavedVillage & switchOrLoadPlayerTag', () => {
        test('navigates to appropriate tool route with clean tag parameter', () => {
            globalThis.window = /** @type {any} */ ({
                location: {
                    pathname: '/',
                    search: '',
                    href: ''
                }
            });

            switchSavedVillage('#8PJYGUJC');
            assert.equal(globalThis.window.location.href, '/ore-calculator/?tag=8PJYGUJC');

            globalThis.window.location.pathname = '/damage-calculator/';
            switchSavedVillage('2PP09');
            assert.equal(globalThis.window.location.href, '/damage-calculator/?tag=2PP09');

            globalThis.window.location.pathname = '/hero-journey/';
            switchSavedVillage('9L0V9G9C9');
            assert.equal(globalThis.window.location.href, '/hero-journey/?tag=9L0V9G9C9');

            switchOrLoadPlayerTag('2PP09');
            assert.equal(globalThis.window.location.href, '/hero-journey/?tag=2PP09');
        });
    });

    describe('loadAndSwitchPlayerTag (Non-Destructive In-Palette Loader)', () => {
        test('returns validation error on empty or invalid tag format without navigating', async () => {
            globalThis.window = /** @type {any} */ ({
                location: { pathname: '/ore-calculator/', search: '', href: '' }
            });

            const emptyRes = await loadAndSwitchPlayerTag('');
            assert.equal(emptyRes.success, false);
            assert.equal(globalThis.window.location.href, '');

            const invalidRes = await loadAndSwitchPlayerTag('INVALID');
            assert.equal(invalidRes.success, false);
            assert.equal(globalThis.window.location.href, '');
        });

        test('returns failure message gracefully when player is not found (404) without navigating', async () => {
            globalThis.window = /** @type {any} */ ({
                location: { pathname: '/ore-calculator/', search: '', href: '' }
            });

            globalThis.fetch = async (url) => {
                if (String(url).includes('/proxy/players/')) {
                    return /** @type {any} */ ({
                        ok: false,
                        status: 404,
                        json: async () => ({ reason: 'notFound', message: 'Player not found.' })
                    });
                }
                return /** @type {any} */ ({ ok: false, status: 500 });
            };

            const result = await loadAndSwitchPlayerTag('99999999');
            assert.equal(result.success, false);
            assert.ok(result.message);
            // Asserts window.location.href was NEVER modified (zero disruptive reload)
            assert.equal(globalThis.window.location.href, '');
        });

        test('returns success and syncs URL on tool page when player exists (200)', async () => {
            let replacedUrl = null;
            const mockStorage = {};
            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; },
                removeItem: (key) => { delete mockStorage[key]; }
            });
            globalThis.window = /** @type {any} */ ({
                location: {
                    pathname: '/ore-calculator/',
                    search: '',
                    href: 'https://clashcalc.com/ore-calculator/'
                },
                history: {
                    replaceState: (_state, _title, url) => {
                        replacedUrl = url;
                    }
                }
            });

            globalThis.fetch = async (url) => {
                if (String(url).includes('/proxy/players/')) {
                    return /** @type {any} */ ({
                        ok: true,
                        status: 200,
                        json: async () => ({
                            tag: '#8PJYGUJC',
                            name: 'Chief Goblin',
                            townHallLevel: 17,
                            heroes: [],
                            heroEquipment: []
                        })
                    });
                }
                return /** @type {any} */ ({ ok: false, status: 404 });
            };

            const result = await loadAndSwitchPlayerTag('8PJYGUJC');
            assert.equal(result.success, true);
            assert.equal(result.cleanTag, '8PJYGUJC');
            assert.ok(replacedUrl?.includes('tag=8PJYGUJC'));
        });
    });

    describe('Spotright Registry Village & Player Operations', () => {
        test('registers Add Player Tag action item in registry', () => {
            const registry = buildSpotrightRegistry();
            const addPlayerItem = registry.find(i => i.id === 'action-add-player');

            assert.ok(addPlayerItem, 'action-add-player must be registered');
            assert.equal(addPlayerItem.category, 'Modals & Actions');
            assert.equal(addPlayerItem.icon, 'plus');
            assert.equal(addPlayerItem.entityType, 'modal');
            assert.equal(typeof addPlayerItem.execute, 'function');
        });

        test('indexes saved player profiles as switchable village items', () => {
            const tagsKey = getActivePlayerTagsKey();
            const mockStorage = {
                [tagsKey]: JSON.stringify(['8PJYGUJC', '9L0V9G9C9']),
                [getPlayerStorageKey('8PJYGUJC')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJYGUJC',
                        name: 'Chief Goblin',
                        townHallLevel: 17
                    }
                }),
                [getPlayerStorageKey('9L0V9G9C9')]: JSON.stringify({
                    playerProfile: {
                        tag: '#9L0V9G9C9',
                        name: 'Mini Chief',
                        townHallLevel: 14
                    }
                })
            };

            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; }
            });

            const registry = buildSpotrightRegistry();
            const villageItems = registry.filter(i => i.category === 'Villages');

            assert.equal(villageItems.length, 2, 'Must index both saved profiles');

            const chiefItem = villageItems.find(i => i.id === 'village-8PJYGUJC');
            assert.ok(chiefItem, 'Must contain village-8PJYGUJC');
            assert.equal(chiefItem.title, 'Chief Goblin');
            assert.ok(chiefItem.subtitle.includes('8PJYGUJC'));
            assert.ok(chiefItem.subtitle.includes('17'));
            assert.equal(chiefItem.icon, 'user');
            assert.equal(chiefItem.entityType, 'modal');
            assert.equal(typeof chiefItem.execute, 'function');
        });

        test('resolves active player tag from URL parameters via getActiveUrlTag', () => {
            globalThis.window = /** @type {any} */ ({
                location: {
                    pathname: '/ore-calculator/',
                    search: '?tag=%238PJYGUJC'
                }
            });

            assert.equal(getActiveUrlTag(), '8PJYGUJC');
        });
    });

    describe('searchSpotright Direct Tag & Village Search', () => {
        test('synthesizes top-ranked Load Player action when searching an unsaved valid tag', () => {
            const mockStorage = {};
            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; }
            });

            const registry = buildSpotrightRegistry();
            const result = searchSpotright('#8PJYGUJC', registry, 'all');

            assert.ok(result.matches.length > 0);
            const topMatch = result.matches[0];
            assert.equal(topMatch.id, 'direct-tag-8PJYGUJC');
            assert.equal(topMatch.category, 'Player Search');
            assert.ok(topMatch.title.includes('8PJYGUJC'));
            assert.equal(topMatch.isAsyncAction, true);
            assert.equal(typeof topMatch.execute, 'function');
        });

        test('prioritizes existing saved village over direct tag synthesis when tag is saved', () => {
            const tagsKey = getActivePlayerTagsKey();
            const mockStorage = {
                [tagsKey]: JSON.stringify(['8PJYGUJC']),
                [getPlayerStorageKey('8PJYGUJC')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJYGUJC',
                        name: 'Dragon Master',
                        townHallLevel: 16
                    }
                })
            };

            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; }
            });

            const registry = buildSpotrightRegistry();
            const result = searchSpotright('8PJYGUJC', registry, 'all');

            assert.ok(result.matches.length > 0);
            const matchedVillage = result.matches.find(i => i.id === 'village-8PJYGUJC');
            assert.ok(matchedVillage, 'Must find saved village-8PJYGUJC');
            assert.equal(matchedVillage.title, 'Dragon Master');

            const hasDirectTag = result.matches.some(i => i.id === 'direct-tag-8PJYGUJC');
            assert.equal(hasDirectTag, false, 'Must not synthesize duplicate direct tag when village already exists');
        });

        test('allows searching saved villages by village name', () => {
            const tagsKey = getActivePlayerTagsKey();
            const mockStorage = {
                [tagsKey]: JSON.stringify(['8PJYGUJC']),
                [getPlayerStorageKey('8PJYGUJC')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJYGUJC',
                        name: 'Spartan Army',
                        townHallLevel: 15
                    }
                })
            };

            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; }
            });

            const registry = buildSpotrightRegistry();
            const result = searchSpotright('Spartan', registry, 'all');

            assert.ok(result.matches.length > 0);
            const match = result.matches.find(i => i.id === 'village-8PJYGUJC');
            assert.ok(match, 'Must match Spartan Army by name');
            assert.equal(match.title, 'Spartan Army');
        });
    });
});
