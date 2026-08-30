import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizePlayerTag,
    formatDisplayTag,
    getPlayerStorageKey,
    saveState,
    loadState,
    loadPlayerData,
    removePlayerTag,
    updateSavedPlayerTags,
    updateAllPlayersData,
    PLAYER_PREFIX,
    PLAYER_TAGS_KEY,
    APP_SETTINGS_KEY
} from '../../js/core/localStorageManager.js';
import { cleanupOrphanedPlayerPartitions } from '../../js/core/stateCleanup.js';
import {
    addRecentSearch,
    getRecentSearches,
    removeRecentSearch,
    RECENT_SEARCHES_KEY
} from '../../js/core/recentSearchesManager.js';
import { state, getDefaultPlayerState } from '../../js/core/state.js';
import { syncPlayerToStorage, getSavedProfiles } from '../../js/components/heroJourney/heroJourneyState.js';
import { processPlayerDataResponse } from '../../js/services/serverResponseHandler.js';

describe('Player Storage Normalization & Anti-Hashed Keys Suite', () => {
    /** @type {Map<string, string>} */
    let storageMap;

    beforeEach(() => {
        storageMap = new Map();
        globalThis.localStorage = {
            getItem: (key) => storageMap.has(key) ? storageMap.get(key) : null,
            setItem: (key, val) => storageMap.set(key, String(val)),
            removeItem: (key) => storageMap.delete(key),
            clear: () => storageMap.clear(),
            get length() { return storageMap.size; },
            key: (idx) => Array.from(storageMap.keys())[idx] || null
        };
    });

    describe('1. normalizePlayerTag & formatDisplayTag', () => {
        it('strips single leading hash and uppercases tag', () => {
            assert.equal(normalizePlayerTag('#9L0V9G9C9'), '9L0V9G9C9');
            assert.equal(normalizePlayerTag('#9l0v9g9c9'), '9L0V9G9C9');
        });

        it('strips multiple leading and trailing hashes (5+ hashes attack)', () => {
            assert.equal(normalizePlayerTag('#####9L0V9G9C9'), '9L0V9G9C9');
            assert.equal(normalizePlayerTag('###9L0V9G9C9###'), '9L0V9G9C9');
            assert.equal(normalizePlayerTag('   #####R2J0LUYP9   '), 'R2J0LUYP9');
            assert.equal(normalizePlayerTag('#######'), '');
        });

        it('preserves clean tags without hashes and handles DEFAULT0', () => {
            assert.equal(normalizePlayerTag('YG9P8LQ88'), 'YG9P8LQ88');
            assert.equal(normalizePlayerTag('DEFAULT0'), 'DEFAULT0');
        });

        it('returns empty string for null, undefined, or empty values', () => {
            assert.equal(normalizePlayerTag(''), '');
            assert.equal(normalizePlayerTag(null), '');
            assert.equal(normalizePlayerTag(undefined), '');
        });

        it('formatDisplayTag guarantees strictly one leading hash', () => {
            assert.equal(formatDisplayTag('9L0V9G9C9'), '#9L0V9G9C9');
            assert.equal(formatDisplayTag('#9L0V9G9C9'), '#9L0V9G9C9');
            assert.equal(formatDisplayTag('#####9L0V9G9C9'), '#9L0V9G9C9');
            assert.equal(formatDisplayTag('  ###R2J0LUYP9  '), '#R2J0LUYP9');
            assert.equal(formatDisplayTag('DEFAULT0'), '');
            assert.equal(formatDisplayTag(''), '');
            assert.equal(formatDisplayTag(null), '');
        });
    });

    describe('2. getPlayerStorageKey', () => {
        it('always produces canonical oreCalc_player_CLEANTAG with zero hashes', () => {
            assert.equal(getPlayerStorageKey('#9L0V9G9C9'), 'oreCalc_player_9L0V9G9C9');
            assert.equal(getPlayerStorageKey('9L0V9G9C9'), 'oreCalc_player_9L0V9G9C9');
            assert.equal(getPlayerStorageKey('#####R2J0LUYP9'), 'oreCalc_player_R2J0LUYP9');
            assert.equal(getPlayerStorageKey('DEFAULT0'), 'oreCalc_player_DEFAULT0');
            assert.equal(getPlayerStorageKey(null), 'oreCalc_player_DEFAULT0');
            assert.ok(!getPlayerStorageKey('#####9L0V9G9C9').includes('#'));
        });
    });

    describe('3. saveState partition key normalization & purge', () => {
        it('saves to canonical key without hash when active tag contains 5+ hashes', () => {
            state.savedPlayerTags = ['#####9L0V9G9C9', '###YG9P8LQ88'];
            state.allPlayersData = {
                '9L0V9G9C9': {
                    ...getDefaultPlayerState(),
                    playerProfile: { name: 'Player One', tag: '9L0V9G9C9', townHallLevel: 17 }
                }
            };
            state.heroes = state.allPlayersData['9L0V9G9C9'].heroes;
            state.storedOres = state.allPlayersData['9L0V9G9C9'].storedOres;
            state.income = state.allPlayersData['9L0V9G9C9'].income;
            state.planner = state.allPlayersData['9L0V9G9C9'].planner;
            state.playerProfile = state.allPlayersData['9L0V9G9C9'].playerProfile;

            // Seed a legacy hashed key to verify purge
            localStorage.setItem('oreCalc_player_#9L0V9G9C9', '{"legacy":true}');

            saveState(state, true);

            // Canonical key must exist
            assert.ok(localStorage.getItem('oreCalc_player_9L0V9G9C9') !== null);
            // Legacy hashed key must be purged
            assert.equal(localStorage.getItem('oreCalc_player_#9L0V9G9C9'), null);

            // Stored playerTags array must contain clean tags without '#'
            const savedTags = JSON.parse(localStorage.getItem(PLAYER_TAGS_KEY));
            assert.deepEqual(savedTags, ['9L0V9G9C9', 'YG9P8LQ88']);
        });
    });

    describe('4. loadState automatic legacy migration', () => {
        it('migrates legacy oreCalc_player_#TAG disk keys to canonical format on load', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['#####9L0V9G9C9']));
            localStorage.setItem('oreCalc_player_#9L0V9G9C9', JSON.stringify({
                ...getDefaultPlayerState(),
                playerProfile: { name: 'Legacy Hero', tag: '#9L0V9G9C9', townHallLevel: 16 }
            }));

            const loaded = loadState();
            assert.ok(loaded);
            assert.deepEqual(loaded.savedPlayerTags, ['9L0V9G9C9']);
            assert.ok(loaded.allPlayersData['9L0V9G9C9']);
            assert.equal(loaded.allPlayersData['9L0V9G9C9'].playerProfile.name, 'Legacy Hero');

            // Assert disk state was migrated
            assert.ok(localStorage.getItem('oreCalc_player_9L0V9G9C9') !== null);
            assert.equal(localStorage.getItem('oreCalc_player_#9L0V9G9C9'), null);
        });
    });

    describe('5. loadPlayerData & removePlayerTag with multi-hashes', () => {
        it('loadPlayerData migrates and returns profile when queried with 5 hashes', () => {
            state.allPlayersData = {};
            localStorage.setItem('oreCalc_player_#TAG_MIGRATE', JSON.stringify({
                ...getDefaultPlayerState(),
                playerProfile: { name: 'Migrated', tag: '#TAG_MIGRATE', townHallLevel: 15 }
            }));

            const data = loadPlayerData('#####TAG_MIGRATE');
            assert.ok(data);
            assert.equal(data.playerProfile.name, 'Migrated');
            assert.ok(localStorage.getItem('oreCalc_player_TAG_MIGRATE') !== null);
            assert.equal(localStorage.getItem('oreCalc_player_#TAG_MIGRATE'), null);
        });

        it('removePlayerTag removes both canonical and any legacy hashed key', () => {
            state.savedPlayerTags = ['TAG1', 'TAG2'];
            state.allPlayersData = {
                'TAG1': getDefaultPlayerState(),
                'TAG2': getDefaultPlayerState()
            };
            localStorage.setItem('oreCalc_player_TAG1', JSON.stringify(getDefaultPlayerState()));
            localStorage.setItem('oreCalc_player_#TAG1', JSON.stringify(getDefaultPlayerState()));

            removePlayerTag('#####TAG1');

            assert.equal(localStorage.getItem('oreCalc_player_TAG1'), null);
            assert.equal(localStorage.getItem('oreCalc_player_#TAG1'), null);
            assert.ok(!state.savedPlayerTags.includes('TAG1'));
        });
    });

    describe('6. Server Response Tag Sanitization', () => {
        it('processPlayerDataResponse sanitizes server responded tag to clean format in state and storage', () => {
            state.savedPlayerTags = ['DEFAULT0'];
            state.allPlayersData = {};

            processPlayerDataResponse({
                tag: '#9L0V9G9C9',
                name: 'Server Chief',
                townHallLevel: 17,
                heroes: [{ name: 'Barbarian King', level: 95, equipment: [] }],
                heroEquipment: []
            });

            assert.ok(state.savedPlayerTags.includes('9L0V9G9C9'));
            assert.ok(!state.savedPlayerTags.includes('#9L0V9G9C9'));
            assert.ok(state.allPlayersData['9L0V9G9C9']);
            assert.equal(state.allPlayersData['9L0V9G9C9'].playerProfile.name, 'Server Chief');
            assert.ok(localStorage.getItem('oreCalc_player_9L0V9G9C9') !== null);
            assert.equal(localStorage.getItem('oreCalc_player_#9L0V9G9C9'), null);
        });
    });

    describe('7. Recent Searches Anti-Hash Normalization & Saved Player Exclusion', () => {
        it('addRecentSearch sanitizes 5+ hashes and stores clean tag', () => {
            addRecentSearch({
                tag: '#####TESTTAG1',
                name: 'TestHero',
                townHallLevel: 16
            });

            const recents = getRecentSearches();
            assert.ok(recents.length > 0);
            const found = recents.find(r => r.cleanTag === 'TESTTAG1');
            assert.ok(found);
            assert.equal(found.cleanTag, 'TESTTAG1');
            assert.equal(found.tag, '#TESTTAG1');
        });

        it('addRecentSearch refuses to add players that are already saved profiles', () => {
            state.savedPlayerTags = ['SAVED_HERO'];
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['SAVED_HERO']));

            addRecentSearch({
                tag: '#SAVED_HERO',
                name: 'Saved Hero',
                townHallLevel: 17
            });

            const recents = getRecentSearches();
            const found = recents.find(r => r.cleanTag === 'SAVED_HERO');
            assert.equal(found, undefined, 'Saved player must not be added to recent searches');
        });

        it('processPlayerDataResponse and updateSavedPlayerTags purge player from recent searches', () => {
            // First add to recent searches
            addRecentSearch({
                tag: '#PROMOTED_HERO',
                name: 'Promoted Hero',
                townHallLevel: 16
            });
            assert.ok(getRecentSearches().some(r => r.cleanTag === 'PROMOTED_HERO'));

            // Now save as active player via processPlayerDataResponse
            processPlayerDataResponse({
                tag: '#PROMOTED_HERO',
                name: 'Promoted Hero',
                townHallLevel: 16,
                heroes: [],
                heroEquipment: []
            });

            // Must be purged from recent searches
            assert.ok(!getRecentSearches().some(r => r.cleanTag === 'PROMOTED_HERO'), 'Saved player must be purged from recent searches');
        });
    });

    describe('8. Hero Journey Standalone key normalization & sync', () => {
        it('syncPlayerToStorage writes strictly to oreCalc_player_CLEANTAG and purges legacy hash', () => {
            localStorage.setItem('oreCalc_player_#R2J0LUYP9', '{"stale":true}');

            syncPlayerToStorage({
                tag: '#####R2J0LUYP9',
                name: 'Legend Warrior',
                townHallLevel: 17,
                heroes: [{ name: 'Barbarian King', level: 95, village: 'home' }],
                heroEquipment: [{ name: 'Giant Gauntlet', level: 27, village: 'home' }]
            });

            // Canonical key must be set
            assert.ok(localStorage.getItem('oreCalc_player_R2J0LUYP9') !== null);
            // Legacy hashed key must be deleted
            assert.equal(localStorage.getItem('oreCalc_player_#R2J0LUYP9'), null);
        });

        it('getSavedProfiles reads and migrates legacy hashed partitions', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['#####EXISTING_TAG']));
            localStorage.setItem('oreCalc_player_#EXISTING_TAG', JSON.stringify({
                playerProfile: { name: 'Existing Hero', tag: '#EXISTING_TAG', townHallLevel: 16 }
            }));

            const profiles = getSavedProfiles();
            assert.equal(profiles.length, 1);
            assert.equal(profiles[0].cleanTag, 'EXISTING_TAG');
            assert.equal(profiles[0].tag, '#EXISTING_TAG');
            assert.equal(profiles[0].name, 'Existing Hero');

            // Verify disk migration
            assert.ok(localStorage.getItem('oreCalc_player_EXISTING_TAG') !== null);
            assert.equal(localStorage.getItem('oreCalc_player_#EXISTING_TAG'), null);
        });
    });

    describe('9. Orphaned player partition garbage collection', () => {
        it('cleanupOrphanedPlayerPartitions deletes partitions not in playerTags or recentSearches', () => {
            // Seed saved players
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['SAVED1', 'SAVED2']));
            localStorage.setItem('oreCalc_player_SAVED1', JSON.stringify({ heroes: {} }));
            localStorage.setItem('oreCalc_player_SAVED2', JSON.stringify({ heroes: {} }));

            // Seed recent searches
            localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([
                { cleanTag: 'RECENT1', tag: '#RECENT1', name: 'Recent 1' }
            ]));
            localStorage.setItem('oreCalc_player_RECENT1', JSON.stringify({ heroes: {} }));

            // Seed orphaned partitions
            localStorage.setItem('oreCalc_player_92GJJ99L', JSON.stringify({ heroes: {} }));
            localStorage.setItem('oreCalc_player_RANDOM_OLD', JSON.stringify({ heroes: {} }));

            const deleted = cleanupOrphanedPlayerPartitions();
            assert.equal(deleted.length, 2);
            assert.ok(deleted.includes('oreCalc_player_92GJJ99L'));
            assert.ok(deleted.includes('oreCalc_player_RANDOM_OLD'));

            // Valid retained
            assert.ok(localStorage.getItem('oreCalc_player_SAVED1') !== null);
            assert.ok(localStorage.getItem('oreCalc_player_SAVED2') !== null);
            assert.ok(localStorage.getItem('oreCalc_player_RECENT1') !== null);

            // Orphaned deleted
            assert.equal(localStorage.getItem('oreCalc_player_92GJJ99L'), null);
            assert.equal(localStorage.getItem('oreCalc_player_RANDOM_OLD'), null);
        });

        it('renames and migrates solitary oreCalc_player_#TAG to unhashed oreCalc_player_TAG', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['92GJJ99L']));
            localStorage.setItem('oreCalc_player_#92GJJ99L', JSON.stringify({
                heroes: { BarbarianKing: { level: 95 } },
                heroJourney: { acceleratedRewards: true, strayBogus: 123 }
            }));

            const deleted = cleanupOrphanedPlayerPartitions();
            assert.ok(deleted.includes('oreCalc_player_#92GJJ99L'));

            // Must have migrated to unhashed key
            const migratedStr = localStorage.getItem('oreCalc_player_92GJJ99L');
            assert.ok(migratedStr !== null);
            const parsed = JSON.parse(migratedStr);
            assert.equal(parsed.heroes.BarbarianKing.level, 95);
            assert.deepEqual(parsed.heroJourney, {
                acceleratedRewards: true,
                revealBeyondTH: false,
                hidden: false
            });

            // Hashed key must be deleted
            assert.equal(localStorage.getItem('oreCalc_player_#92GJJ99L'), null);
        });

        it('deduplicates and removes oreCalc_player_#TAG directly if unhashed oreCalc_player_TAG already exists', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['92GJJ99L']));
            // Both exist
            localStorage.setItem('oreCalc_player_92GJJ99L', JSON.stringify({
                heroes: { BarbarianKing: { level: 95 } }
            }));
            localStorage.setItem('oreCalc_player_#92GJJ99L', JSON.stringify({
                heroes: { BarbarianKing: { level: 50 } }
            }));

            const deleted = cleanupOrphanedPlayerPartitions();
            assert.ok(deleted.includes('oreCalc_player_#92GJJ99L'));

            // Unhashed must be preserved intact
            const unhashedStr = localStorage.getItem('oreCalc_player_92GJJ99L');
            assert.ok(unhashedStr !== null);
            assert.equal(JSON.parse(unhashedStr).heroes.BarbarianKing.level, 95);

            // Hashed key must be directly removed
            assert.equal(localStorage.getItem('oreCalc_player_#92GJJ99L'), null);
        });

        it('deletes orphaned oreCalc_player_#ORPHAN_TAG that is neither in tags nor recent searches', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['OTHER1']));
            localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([]));
            localStorage.setItem('oreCalc_player_#ORPHAN_TAG', JSON.stringify({ heroes: {} }));

            const deleted = cleanupOrphanedPlayerPartitions();
            assert.ok(deleted.includes('oreCalc_player_#ORPHAN_TAG'));
            assert.equal(localStorage.getItem('oreCalc_player_#ORPHAN_TAG'), null);
            assert.equal(localStorage.getItem('oreCalc_player_ORPHAN_TAG'), null);
        });
    });
});
