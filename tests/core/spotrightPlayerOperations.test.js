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
    buildSpotrightRegistry
} from '../../js/components/spotright/spotrightRegistry.js';
import {
    getActiveUrlTag
} from '../../js/components/spotright/spotrightNavigator.js';
import {
    createSpotrightDialog,
    renderSpotrightResults
} from '../../js/components/spotright/spotrightDisplay.js';
import {
    extractScopePrefix,
    searchSpotright
} from '../../js/components/spotright/spotrightMatcher.js';
import { loadTranslations, translate } from '../../js/i18n/translator.js';
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
            assert.equal(item.id, 'action-clipboard-tag-8PJYGUJC');
            assert.equal(item.type, 'action');
            assert.equal(item.category, translate('player.tag') || 'Player Tag');
            assert.equal(item.icon, 'copy');
            assert.equal(item.iconType, 'svg');
            assert.equal(item.priorityTier, 100);
            assert.ok(item.title.includes('8PJYGUJC'));
            assert.equal(item.isAsyncAction, true);
            assert.equal(typeof item.execute, 'function');
        });
    });

    describe('switchSavedVillage & switchOrLoadPlayerTag', () => {
        test('activates in-place on Hub and navigates to Hub from other tool pages', () => {
            const store = new Map();
            globalThis.localStorage = /** @type {any} */ ({
                getItem: (k) => store.get(k) || null,
                setItem: (k, v) => store.set(k, String(v)),
                removeItem: (k) => store.delete(k),
                clear: () => store.clear()
            });

            globalThis.window = /** @type {any} */ ({
                location: {
                    pathname: '/',
                    search: '',
                    href: ''
                }
            });

            switchSavedVillage('#8PJYGUJC');
            assert.equal(globalThis.window.location.href, '');

            globalThis.window.location.pathname = '/damage-calculator/';
            switchSavedVillage('2PP09');
            assert.equal(globalThis.window.location.href, '/?tag=2PP09');

            globalThis.window.location.pathname = '/hero-journey/';
            switchSavedVillage('9L0V9G9C9');
            assert.equal(globalThis.window.location.href, '/?tag=9L0V9G9C9');

            globalThis.window.location.pathname = '/ore-calculator/';
            switchOrLoadPlayerTag('2PP09');
            assert.equal(globalThis.window.location.href, '/?tag=2PP09');
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
            assert.equal(addPlayerItem.category, translate('nav.settings') || 'Settings');
            assert.equal(addPlayerItem.icon, 'plus');
            assert.equal(addPlayerItem.type, 'action');
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
            const villageItems = registry.filter(i => i.isVillage);

            assert.equal(villageItems.length, 2, 'Must index both saved profiles');
            assert.equal(villageItems[0].category, translate('nav.views.hub.villages') || 'Saved Villages');

            const chiefItem = villageItems.find(i => i.id === 'village-8PJYGUJC');
            assert.ok(chiefItem, 'Must contain village-8PJYGUJC');
            assert.equal(chiefItem.title, 'Chief Goblin');
            assert.ok(chiefItem.subtitle.includes('8PJYGUJC'));
            assert.equal(chiefItem.icon, 'assets/th/th17.png');
            assert.equal(chiefItem.iconType, 'image');
            assert.equal(chiefItem.isVillage, true);
            assert.equal(chiefItem.thLevel, 17);
            assert.equal(chiefItem.cleanTag, '8PJYGUJC');
            assert.equal(chiefItem.displayTag, '#8PJYGUJC');
            assert.equal(chiefItem.type, 'village');
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
            assert.equal(topMatch.id, 'action-direct-tag-8PJYGUJC');
            assert.equal(topMatch.type, 'action');
            assert.equal(topMatch.category, translate('player.tag') || 'Player Tag');
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

            const hasDirectTag = result.matches.some(i => i.id === 'action-direct-tag-8PJYGUJC');
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

        test('allows searching saved villages by clan name', () => {
            const tagsKey = getActivePlayerTagsKey();
            const mockStorage = {
                [tagsKey]: JSON.stringify(['8PJYGUJC']),
                [getPlayerStorageKey('8PJYGUJC')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJYGUJC',
                        name: 'Goblin King',
                        townHallLevel: 18,
                        clan: {
                            name: 'Invincible Clan',
                            tag: '#CLAN123',
                            badgeUrls: { small: 'https://example.com/badge.png' }
                        }
                    }
                })
            };

            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; }
            });

            const registry = buildSpotrightRegistry();
            const result = searchSpotright('Invincible', registry, 'all');

            assert.ok(result.matches.length > 0);
            const match = result.matches.find(i => i.id === 'village-8PJYGUJC');
            assert.ok(match, 'Must match village by clan name');
            assert.equal(match.title, 'Goblin King');
            assert.equal(match.clanName, 'Invincible Clan');
            assert.equal(match.clanBadge, 'https://example.com/badge.png');
        });

        test('renders rich village card with Town Hall image, level badge, meta row, and active status', () => {
            /** @type {any} */
            const activeVillage = {
                id: 'village-8PJYGUJC',
                title: 'Chief Jeff',
                category: 'Villages',
                subtitle: 'Village · #8PJYGUJC · TH18',
                icon: 'assets/th/th18.png',
                iconType: 'image',
                acronym: 'cj',
                isVillage: true,
                isActiveVillage: true,
                cleanTag: '8PJYGUJC',
                displayTag: '#8PJYGUJC',
                thLevel: 18,
                trophies: 5240,
                clanName: 'Elite Warriors',
                clanBadge: 'https://example.com/clan.png',
                leagueName: 'Titan League I',
                leagueIcon: 'https://example.com/league.png',
                execute: () => {}
            };

            /** @type {any} */
            const container = { innerHTML: '' };
            renderSpotrightResults(container, [activeVillage], 0);

            const html = container.innerHTML;
            assert.ok(html.includes('spotright-result-item--village'), 'Must apply village modifier class');
            assert.ok(html.includes('is-active-village'), 'Must apply active village class');
            assert.ok(html.includes('spotright-th-wrapper'), 'Must render Town Hall wrapper');
            assert.ok(html.includes('assets/th/th18.png'), 'Must render Town Hall image asset');
            assert.ok(html.includes('<span class="spotright-th-badge">18</span>'), 'Must render TH level badge');
            assert.ok(html.includes('#8PJYGUJC'), 'Must render player tag');
            assert.ok(html.includes('spotright-tag--active'), 'Must render active tag');
            assert.ok(html.includes('Elite Warriors'), 'Must render clan name');
            assert.ok(html.includes('https://example.com/clan.png'), 'Must render clan badge');
            assert.ok(html.includes('5,240'), 'Must render formatted trophies');
            assert.ok(html.includes('name="trophy"'), 'Must render trophy vector SVG');
            assert.ok(html.includes('https://example.com/league.png'), 'Must render league icon');
            assert.ok(html.includes('name="check"'), 'Must render check icon for active village action cue');
        });

        test('matches saved villages with 0 when searching with O across exact, prefix, and substring variations', () => {
            const tagsKey = getActivePlayerTagsKey();
            const mockStorage = {
                [tagsKey]: JSON.stringify(['8PJY0UJC']),
                [getPlayerStorageKey('8PJY0UJC')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJY0UJC',
                        name: 'Base Alpha',
                        townHallLevel: 15
                    }
                })
            };

            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; }
            });

            const registry = buildSpotrightRegistry();

            // Exact tag with O and with #
            const resultExactWithHash = searchSpotright('#8PJYOUJC', registry, 'all');
            assert.ok(resultExactWithHash.matches.length > 0);
            assert.equal(resultExactWithHash.matches[0].id, 'village-8PJY0UJC');
            assert.equal(resultExactWithHash.matches.some(i => i.id === 'action-direct-tag-8PJYOUJC'), false);

            // Exact tag with O and without #
            const resultExactNoHash = searchSpotright('8PJYOUJC', registry, 'all');
            assert.ok(resultExactNoHash.matches.length > 0);
            assert.equal(resultExactNoHash.matches[0].id, 'village-8PJY0UJC');

            // Prefix with O and with #
            const resultPrefixWithHash = searchSpotright('#8PJYO', registry, 'all');
            assert.ok(resultPrefixWithHash.matches.length > 0);
            assert.equal(resultPrefixWithHash.matches[0].id, 'village-8PJY0UJC');

            // Prefix with O and without #
            const resultPrefixNoHash = searchSpotright('8PJYO', registry, 'all');
            assert.ok(resultPrefixNoHash.matches.length > 0);
            assert.equal(resultPrefixNoHash.matches[0].id, 'village-8PJY0UJC');

            // Substring with O
            const resultSub = searchSpotright('jyou', registry, 'all');
            assert.ok(resultSub.matches.some(i => i.id === 'village-8PJY0UJC'));
        });

        test('ranks Add Player direct action lower than saved villages on partial tag match', () => {
            const tagsKey = getActivePlayerTagsKey();
            const mockStorage = {
                [tagsKey]: JSON.stringify(['8PJY0UJC']),
                [getPlayerStorageKey('8PJY0UJC')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJY0UJC',
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
            const result = searchSpotright('#8PJ', registry, 'all');

            assert.ok(result.matches.length >= 2);
            assert.equal(result.matches[0].id, 'village-8PJY0UJC', 'Saved village must be #1 top hit');
            assert.equal(result.matches[1].id, 'action-direct-tag-8PJ', 'Add player direct action must be ranked below saved village');
        });

        test('ranks active village lowest among villages when multiple saved villages match', () => {
            const tagsKey = getActivePlayerTagsKey();
            const mockStorage = {
                [tagsKey]: JSON.stringify(['8PJY0UJC', '8PJY2XYZ']),
                [getPlayerStorageKey('8PJY0UJC')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJY0UJC',
                        name: 'Inactive Base',
                        townHallLevel: 16
                    }
                }),
                [getPlayerStorageKey('8PJY2XYZ')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJY2XYZ',
                        name: 'Active Base',
                        townHallLevel: 17
                    }
                })
            };

            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; }
            });

            // Set active URL tag to 8PJY2XYZ
            globalThis.window = /** @type {any} */ ({
                location: {
                    pathname: '/ore-calculator/',
                    search: '?tag=8PJY2XYZ'
                }
            });

            const registry = buildSpotrightRegistry();
            const result = searchSpotright('#8PJY', registry, 'all');

            const villageMatches = result.matches.filter(i => i.isVillage);
            assert.equal(villageMatches.length, 2);
            assert.equal(villageMatches[0].id, 'village-8PJY0UJC', 'Inactive village must rank higher');
            assert.equal(villageMatches[1].id, 'village-8PJY2XYZ', 'Active village must be ranked lowest among matched villages');

            const directIndex = result.matches.findIndex(i => i.id === 'action-direct-tag-8PJY');
            assert.ok(directIndex > 1, 'Add player direct action must rank below all matching saved villages');
        });

        test('isolates O and 0 matching strictly to player tags and preserves exact matching for player names and equipment', () => {
            const tagsKey = getActivePlayerTagsKey();
            const mockStorage = {
                [tagsKey]: JSON.stringify(['8PJYGUJC']),
                [getPlayerStorageKey('8PJYGUJC')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJYGUJC',
                        name: 'Oliver',
                        townHallLevel: 16
                    }
                })
            };

            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; }
            });

            const registry = buildSpotrightRegistry();

            // Player name matching
            const oliverResult = searchSpotright('Oliver', registry, 'all');
            assert.ok(oliverResult.matches.some(i => i.id === 'village-8PJYGUJC'));

            const zeroLiverResult = searchSpotright('0liver', registry, 'all');
            assert.equal(zeroLiverResult.matches.some(i => i.id === 'village-8PJYGUJC'), false, 'Searching 0liver must NOT match player name Oliver');

            // Equipment matching
            const arrowResult = searchSpotright('Giant Arrow', registry, 'equipment');
            assert.ok(arrowResult.matches.some(i => i.title === 'Giant Arrow'));

            const zeroArrowResult = searchSpotright('arr0w', registry, 'equipment');
            assert.equal(zeroArrowResult.matches.some(i => i.title === 'Giant Arrow'), false, 'Searching arr0w must NOT match Giant Arrow');
        });

        test('renders villages filter chip at position 2 in spotright dialog', () => {
            const originalDoc = globalThis.document;
            try {
                let innerHTMLVal = '';
                globalThis.document = /** @type {any} */ ({
                    createElement: () => ({
                        id: '',
                        className: '',
                        setAttribute: () => {},
                        set innerHTML(val) { innerHTMLVal = val; },
                        get innerHTML() { return innerHTMLVal; },
                        querySelector: (sel) => {
                            if (sel === '#spotright-filter-track') {
                                return {
                                    querySelectorAll: () => {
                                        const matches = Array.from(innerHTMLVal.matchAll(/data-scope="([^"]+)"/g));
                                        return matches.map(m => ({
                                            getAttribute: (attr) => attr === 'data-scope' ? m[1] : null
                                        }));
                                    }
                                };
                            }
                            return null;
                        }
                    })
                });

                const dialog = createSpotrightDialog();
                const track = dialog.querySelector('#spotright-filter-track');
                assert.ok(track, 'Must contain spotright-filter-track');

                const chips = Array.from(track.querySelectorAll('.spotright-filter-chip'));
                assert.ok(chips.length >= 6, 'Must contain all 6 filter chips');

                assert.equal(chips[0].getAttribute('data-scope'), 'all', 'Position 1 must be all');
                assert.equal(chips[1].getAttribute('data-scope'), 'villages', 'Position 2 must be villages');
                assert.equal(chips[2].getAttribute('data-scope'), 'equipment', 'Position 3 must be equipment');
                assert.equal(chips[3].getAttribute('data-scope'), 'hero', 'Position 4 must be hero');
                assert.equal(chips[4].getAttribute('data-scope'), 'tools', 'Position 5 must be tools');
                assert.equal(chips[5].getAttribute('data-scope'), 'settings', 'Position 6 must be settings');
            } finally {
                globalThis.document = originalDoc;
            }
        });

        test('scopes search results correctly when villages category filter is active', () => {
            const tagsKey = getActivePlayerTagsKey();
            const mockStorage = {
                [tagsKey]: JSON.stringify(['8PJY0UJC', '9L0V9G9C9']),
                [getPlayerStorageKey('8PJY0UJC')]: JSON.stringify({
                    playerProfile: {
                        tag: '#8PJY0UJC',
                        name: 'Base Alpha',
                        townHallLevel: 15
                    }
                }),
                [getPlayerStorageKey('9L0V9G9C9')]: JSON.stringify({
                    playerProfile: {
                        tag: '#9L0V9G9C9',
                        name: 'Base Beta',
                        townHallLevel: 14
                    }
                })
            };

            globalThis.localStorage = /** @type {any} */ ({
                getItem: (key) => mockStorage[key] || null,
                setItem: (key, val) => { mockStorage[key] = val; }
            });

            const registry = buildSpotrightRegistry();

            // 1. Empty query with villages scope returns saved villages followed by Add Player action
            const emptyResult = searchSpotright('', registry, 'villages');
            assert.equal(emptyResult.matches.length, 3, 'Must return both saved villages and add player action');
            assert.equal(emptyResult.matches[0].id, 'village-8PJY0UJC');
            assert.equal(emptyResult.matches[1].id, 'village-9L0V9G9C9');
            assert.equal(emptyResult.matches[2].id, 'action-add-player');

            // 2. Query search within villages scope matches specific village
            const searchResult = searchSpotright('Beta', registry, 'villages');
            assert.ok(searchResult.matches.length > 0);
            assert.equal(searchResult.matches[0].id, 'village-9L0V9G9C9');
            assert.equal(searchResult.matches.some(i => i.type === 'equipment' || i.type === 'page'), false, 'Must not return equipment or tools in villages scope');

            // 3. Settings scope does not include villages or add-player action
            const settingsResult = searchSpotright('', registry, 'settings');
            assert.equal(settingsResult.matches.some(i => i.isVillage || i.id === 'action-add-player'), false, 'Settings scope must exclude villages');
        });

        test('extractScopePrefix resolves /v, /village, and /villages to villages scope', () => {
            assert.deepEqual(extractScopePrefix('/v alpha'), { scope: 'villages', remainingQuery: 'alpha' });
            assert.deepEqual(extractScopePrefix('/village beta'), { scope: 'villages', remainingQuery: 'beta' });
            assert.deepEqual(extractScopePrefix('/villages gamma'), { scope: 'villages', remainingQuery: 'gamma' });
        });
    });
});
