import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizePlayerTag,
    formatDisplayTag,
    getPlayerStorageKey,
    PLAYER_TAGS_KEY
} from '../../js/core/storageKeys.js';
import {
    saveState,
    loadState
} from '../../js/core/localStorageManager.js';
import {
    loadPlayerData,
    removePlayerTag,
    getSavedProfiles
} from '../../js/core/playerStorage.js';
import {
    sanitizePlayerProfile,
    stripAutoPlacedCalendarChips
} from '../../js/core/playerStorageSanitizer.js';
import { cleanupOrphanedPlayerPartitions } from '../../js/core/stateCleanup.js';
import { state, getDefaultPlayerState } from '../../js/core/state.js';
import { syncPlayerToStorage } from '../../js/components/heroJourney/heroJourneyState.js';
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
            assert.equal(normalizePlayerTag('#8PJYGUJC'), '8PJYGUJC');
            assert.equal(normalizePlayerTag('#8pjygujc'), '8PJYGUJC');
        });

        it('strips multiple leading and trailing hashes (5+ hashes attack)', () => {
            assert.equal(normalizePlayerTag('#####8PJYGUJC'), '8PJYGUJC');
            assert.equal(normalizePlayerTag('###8PJYGUJC###'), '8PJYGUJC');
            assert.equal(normalizePlayerTag('   #####TESTTAG2   '), 'TESTTAG2');
            assert.equal(normalizePlayerTag('#######'), '');
        });

        it('preserves clean tags without hashes and handles DEFAULT0', () => {
            assert.equal(normalizePlayerTag('TESTTAG3'), 'TESTTAG3');
            assert.equal(normalizePlayerTag('DEFAULT0'), 'DEFAULT0');
        });

        it('returns empty string for null, undefined, or empty values', () => {
            assert.equal(normalizePlayerTag(''), '');
            assert.equal(normalizePlayerTag(null), '');
            assert.equal(normalizePlayerTag(undefined), '');
        });

        it('formatDisplayTag guarantees strictly one leading hash', () => {
            assert.equal(formatDisplayTag('8PJYGUJC'), '#8PJYGUJC');
            assert.equal(formatDisplayTag('#8PJYGUJC'), '#8PJYGUJC');
            assert.equal(formatDisplayTag('#####8PJYGUJC'), '#8PJYGUJC');
            assert.equal(formatDisplayTag('  ###TESTTAG2  '), '#TESTTAG2');
            assert.equal(formatDisplayTag('DEFAULT0'), '');
            assert.equal(formatDisplayTag(''), '');
            assert.equal(formatDisplayTag(null), '');
        });
    });

    describe('2. getPlayerStorageKey', () => {
        it('always produces canonical oreCalc_player_CLEANTAG with zero hashes', () => {
            assert.equal(getPlayerStorageKey('#8PJYGUJC'), 'oreCalc_player_8PJYGUJC');
            assert.equal(getPlayerStorageKey('8PJYGUJC'), 'oreCalc_player_8PJYGUJC');
            assert.equal(getPlayerStorageKey('#####TESTTAG2'), 'oreCalc_player_TESTTAG2');
            assert.equal(getPlayerStorageKey('DEFAULT0'), 'oreCalc_player_DEFAULT0');
            assert.equal(getPlayerStorageKey(null), 'oreCalc_player_DEFAULT0');
            assert.ok(!getPlayerStorageKey('#####8PJYGUJC').includes('#'));
        });
    });

    describe('3. saveState partition key normalization & purge', () => {
        it('saves to canonical key without hash when active tag contains 5+ hashes', () => {
            state.savedPlayerTags = ['#####8PJYGUJC', '###TESTTAG3'];
            state.allPlayersData = {
                '8PJYGUJC': {
                    ...getDefaultPlayerState(),
                    playerProfile: { name: 'Player One', tag: '8PJYGUJC', townHallLevel: 17 }
                }
            };
            state.heroes = state.allPlayersData['8PJYGUJC'].heroes;
            state.storedOres = state.allPlayersData['8PJYGUJC'].storedOres;
            state.income = state.allPlayersData['8PJYGUJC'].income;
            state.planner = state.allPlayersData['8PJYGUJC'].planner;
            state.playerProfile = state.allPlayersData['8PJYGUJC'].playerProfile;

            // Seed a legacy hashed key to verify purge
            localStorage.setItem('oreCalc_player_#8PJYGUJC', '{"legacy":true}');

            saveState(state, true);

            // Canonical key must exist
            assert.ok(localStorage.getItem('oreCalc_player_8PJYGUJC') !== null);
            // Legacy hashed key must be purged
            assert.equal(localStorage.getItem('oreCalc_player_#8PJYGUJC'), null);

            // Stored playerTags array must contain clean tags without '#'
            const savedTags = JSON.parse(localStorage.getItem(PLAYER_TAGS_KEY));
            assert.deepEqual(savedTags, ['8PJYGUJC', 'TESTTAG3']);
        });
    });

    describe('4. loadState automatic legacy migration', () => {
        it('migrates legacy oreCalc_player_#TAG disk keys to canonical format on load', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['#####8PJYGUJC']));
            localStorage.setItem('oreCalc_player_#8PJYGUJC', JSON.stringify({
                ...getDefaultPlayerState(),
                playerProfile: { name: 'Legacy Hero', tag: '#8PJYGUJC', townHallLevel: 16 }
            }));

            const loaded = loadState();
            assert.ok(loaded);
            assert.deepEqual(loaded.savedPlayerTags, ['8PJYGUJC']);
            assert.ok(loaded.allPlayersData['8PJYGUJC']);
            assert.equal(loaded.allPlayersData['8PJYGUJC'].playerProfile.name, 'Legacy Hero');

            // Assert disk state was migrated
            assert.ok(localStorage.getItem('oreCalc_player_8PJYGUJC') !== null);
            assert.equal(localStorage.getItem('oreCalc_player_#8PJYGUJC'), null);
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

        it('removePlayerTag removes canonical, legacy hashed keys, sub-partitions, and sanitizes damageCalcState', () => {
            state.savedPlayerTags = ['TAG1', 'TAG2'];
            state.allPlayersData = {
                'TAG1': getDefaultPlayerState(),
                'TAG2': getDefaultPlayerState()
            };
            localStorage.setItem('oreCalc_player_TAG1', JSON.stringify(getDefaultPlayerState()));
            localStorage.setItem('oreCalc_player_#TAG1', JSON.stringify(getDefaultPlayerState()));
            localStorage.setItem('clashCalc_planner_TAG1', JSON.stringify({ chips: [] }));
            localStorage.setItem('clashCalc_history_TAG1', JSON.stringify({ logs: [] }));
            localStorage.setItem('clashCalc_damageCalcState', JSON.stringify({ activeTag: 'TAG1', playerTownHall: 17 }));

            removePlayerTag('#####TAG1');

            assert.equal(localStorage.getItem('oreCalc_player_TAG1'), null);
            assert.equal(localStorage.getItem('oreCalc_player_#TAG1'), null);
            assert.equal(localStorage.getItem('clashCalc_planner_TAG1'), null);
            assert.equal(localStorage.getItem('clashCalc_history_TAG1'), null);
            assert.ok(!state.savedPlayerTags.includes('TAG1'));

            const dmg = JSON.parse(localStorage.getItem('clashCalc_damageCalcState'));
            assert.equal(dmg.activeTag, 'TAG2');
        });
    });

    describe('6. Server Response Tag Sanitization', () => {
        it('processPlayerDataResponse sanitizes server responded tag to clean format in state and storage', () => {
            state.savedPlayerTags = ['DEFAULT0'];
            state.allPlayersData = {};

            processPlayerDataResponse({
                tag: '#8PJYGUJC',
                name: 'Server Chief',
                townHallLevel: 17,
                heroes: [{ name: 'Barbarian King', level: 95, equipment: [] }],
                heroEquipment: []
            });

            assert.ok(state.savedPlayerTags.includes('8PJYGUJC'));
            assert.ok(!state.savedPlayerTags.includes('#8PJYGUJC'));
            assert.ok(state.allPlayersData['8PJYGUJC']);
            assert.equal(state.allPlayersData['8PJYGUJC'].playerProfile.name, 'Server Chief');
            assert.ok(localStorage.getItem('oreCalc_player_8PJYGUJC') !== null);
            assert.equal(localStorage.getItem('oreCalc_player_#8PJYGUJC'), null);
        });
    });

    describe('8. Hero Journey Standalone key normalization & sync', () => {
        it('syncPlayerToStorage writes strictly to oreCalc_player_CLEANTAG and purges legacy hash', () => {
            localStorage.setItem('oreCalc_player_#TESTTAG1', '{"stale":true}');

            syncPlayerToStorage({
                tag: '#####TESTTAG1',
                name: 'Chief',
                townHallLevel: 17,
                heroes: [{ name: 'Barbarian King', level: 95, village: 'home' }],
                heroEquipment: [{ name: 'Giant Gauntlet', level: 27, village: 'home' }]
            });

            // Canonical key must be set
            assert.ok(localStorage.getItem('oreCalc_player_TESTTAG1') !== null);
            // Legacy hashed key must be deleted
            assert.equal(localStorage.getItem('oreCalc_player_#TESTTAG1'), null);
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
        it('cleanupOrphanedPlayerPartitions deletes partitions not in playerTags', () => {
            // Seed saved players
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['SAVED1', 'SAVED2']));
            localStorage.setItem('oreCalc_player_SAVED1', JSON.stringify({ heroes: {} }));
            localStorage.setItem('oreCalc_player_SAVED2', JSON.stringify({ heroes: {} }));

            // Seed orphaned partitions
            localStorage.setItem('oreCalc_player_TESTTAG2', JSON.stringify({ heroes: {} }));
            localStorage.setItem('oreCalc_player_RANDOM_OLD', JSON.stringify({ heroes: {} }));

            const deleted = cleanupOrphanedPlayerPartitions();
            assert.equal(deleted.length, 2);
            assert.ok(deleted.includes('oreCalc_player_TESTTAG2'));
            assert.ok(deleted.includes('oreCalc_player_RANDOM_OLD'));

            // Valid retained
            assert.ok(localStorage.getItem('oreCalc_player_SAVED1') !== null);
            assert.ok(localStorage.getItem('oreCalc_player_SAVED2') !== null);

            // Orphaned deleted
            assert.equal(localStorage.getItem('oreCalc_player_TESTTAG2'), null);
            assert.equal(localStorage.getItem('oreCalc_player_RANDOM_OLD'), null);
        });

        it('renames and migrates solitary oreCalc_player_#TAG to unhashed oreCalc_player_TAG', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['TESTTAG2']));
            localStorage.setItem('oreCalc_player_#TESTTAG2', JSON.stringify({
                heroes: { BarbarianKing: { level: 95 } },
                heroJourney: { acceleratedRewards: true, strayBogus: 123 }
            }));

            const deleted = cleanupOrphanedPlayerPartitions();
            assert.ok(deleted.includes('oreCalc_player_#TESTTAG2'));

            // Must have migrated to unhashed key
            const migratedStr = localStorage.getItem('oreCalc_player_TESTTAG2');
            assert.ok(migratedStr !== null);
            const parsed = JSON.parse(migratedStr);
            assert.equal(parsed.heroes.BarbarianKing.level, 95);
            assert.deepEqual(parsed.heroJourney, {
                acceleratedRewards: true,
                revealBeyondTH: false,
                hidden: false
            });

            // Hashed key must be deleted
            assert.equal(localStorage.getItem('oreCalc_player_#TESTTAG2'), null);
        });

        it('deduplicates and removes oreCalc_player_#TAG directly if unhashed oreCalc_player_TAG already exists', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['TESTTAG2']));
            // Both exist
            localStorage.setItem('oreCalc_player_TESTTAG2', JSON.stringify({
                heroes: { BarbarianKing: { level: 95 } }
            }));
            localStorage.setItem('oreCalc_player_#TESTTAG2', JSON.stringify({
                heroes: { BarbarianKing: { level: 50 } }
            }));

            const deleted = cleanupOrphanedPlayerPartitions();
            assert.ok(deleted.includes('oreCalc_player_#TESTTAG2'));

            // Unhashed must be preserved intact
            const unhashedStr = localStorage.getItem('oreCalc_player_TESTTAG2');
            assert.ok(unhashedStr !== null);
            assert.equal(JSON.parse(unhashedStr).heroes.BarbarianKing.level, 95);

            // Hashed key must be directly removed
            assert.equal(localStorage.getItem('oreCalc_player_#TESTTAG2'), null);
        });

        it('deletes orphaned oreCalc_player_#ORPHAN_TAG that is not in tags', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['OTHER1']));
            localStorage.setItem('oreCalc_player_#ORPHAN_TAG', JSON.stringify({ heroes: {} }));

            const deleted = cleanupOrphanedPlayerPartitions();
            assert.ok(deleted.includes('oreCalc_player_#ORPHAN_TAG'));
            assert.equal(localStorage.getItem('oreCalc_player_#ORPHAN_TAG'), null);
            assert.equal(localStorage.getItem('oreCalc_player_ORPHAN_TAG'), null);
        });
    });

    describe('10. Universal Display Tag Formatting & Leading Hash Regularization', () => {
        it('normalizes lowercase, unhashed, and multi-hashed tags to exactly one leading hash', () => {
            assert.equal(formatDisplayTag('8PJYGUJC'), '#8PJYGUJC');
            assert.equal(formatDisplayTag('#8PJYGUJC'), '#8PJYGUJC');
            assert.equal(formatDisplayTag('###8PJYGUJC'), '#8PJYGUJC');
            assert.equal(formatDisplayTag('#8pjygujc'), '#8PJYGUJC');
            assert.equal(formatDisplayTag('8pjygujc'), '#8PJYGUJC');
            assert.equal(formatDisplayTag('  #8PJYGUJC  '), '#8PJYGUJC');
        });

        it('returns empty string for guest profile or empty tags', () => {
            assert.equal(formatDisplayTag('DEFAULT0'), '');
            assert.equal(formatDisplayTag('#DEFAULT0'), '');
            assert.equal(formatDisplayTag(''), '');
            assert.equal(formatDisplayTag(null), '');
            assert.equal(formatDisplayTag(undefined), '');
        });

        it('getSavedProfiles populates tag with leading hash for all saved profiles', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['8PJYGUJC', 'TESTTAG2']));
            localStorage.setItem('oreCalc_player_8PJYGUJC', JSON.stringify({
                playerProfile: { name: 'Chief One', tag: '8PJYGUJC', townHallLevel: 16 }
            }));
            localStorage.setItem('oreCalc_player_TESTTAG2', JSON.stringify({
                playerProfile: { name: 'Chief Two', tag: '#TESTTAG2', townHallLevel: 15 }
            }));

            const profiles = getSavedProfiles();
            assert.equal(profiles.length, 2);
            assert.equal(profiles[0].tag, '#8PJYGUJC');
            assert.equal(profiles[0].cleanTag, '8PJYGUJC');
            assert.equal(profiles[1].tag, '#TESTTAG2');
            assert.equal(profiles[1].cleanTag, 'TESTTAG2');
        });

        it('defensive display fallback formats non-standard tags with exactly one hash', () => {
            const formatSafeTag = (raw) => formatDisplayTag(raw) || (raw && raw !== 'DEFAULT0' ? `#${String(raw).replace(/^#+/, '')}` : '');
            assert.equal(formatSafeTag('CUSTOM_TAG'), '#CUSTOM_TAG');
            assert.equal(formatSafeTag('#CUSTOM_TAG'), '#CUSTOM_TAG');
            assert.equal(formatSafeTag('###CUSTOM_TAG'), '#CUSTOM_TAG');
            assert.equal(formatSafeTag('DEFAULT0'), '');
            assert.equal(formatSafeTag(''), '');
            assert.equal(formatSafeTag(null), '');
        });
    });

    describe('11. Anti-Bleed & Cross-Partition Contamination Guards', () => {
        it('saveState does not write state.playerProfile into target partition when tags mismatch', () => {
            state.savedPlayerTags = ['TARGET99', 'SOURCE01'];
            state.allPlayersData = {
                TARGET99: {
                    ...getDefaultPlayerState(),
                    playerProfile: null
                }
            };
            state.playerProfile = {
                name: 'Source Player',
                tag: '#SOURCE01',
                townHallLevel: 17
            };

            saveState(state, true);

            const savedRaw = localStorage.getItem('oreCalc_player_TARGET99');
            assert.ok(savedRaw, 'Partition for TARGET99 must be saved');
            const savedData = JSON.parse(savedRaw);
            assert.equal(savedData.playerProfile, null, 'Source profile must NOT bleed into TARGET99 partition');
        });

        it('saveState does not write state.playerProfile into DEFAULT0 guest partition', () => {
            state.savedPlayerTags = ['DEFAULT0'];
            state.allPlayersData = {
                DEFAULT0: {
                    ...getDefaultPlayerState(),
                    playerProfile: null
                }
            };
            state.playerProfile = {
                name: 'Real Player',
                tag: '#REALTAG',
                townHallLevel: 16
            };

            saveState(state, true);

            const savedRaw = localStorage.getItem('oreCalc_player_DEFAULT0');
            if (savedRaw) {
                const savedData = JSON.parse(savedRaw);
                assert.equal(savedData.playerProfile, null, 'Real player profile must NOT bleed into DEFAULT0');
            }
        });

        it('loadState purges cross-contaminated playerProfile on startup and cleans disk', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['CORRUPT1']));
            localStorage.setItem('oreCalc_player_CORRUPT1', JSON.stringify({
                ...getDefaultPlayerState(),
                playerProfile: {
                    name: 'Bleed Player',
                    tag: '#OTHERTAG',
                    townHallLevel: 18
                }
            }));

            const loaded = loadState();
            assert.ok(loaded);
            assert.equal(loaded.allPlayersData.CORRUPT1.playerProfile, null, 'loadState must purge cross-contaminated profile in memory');

            const diskRaw = localStorage.getItem('oreCalc_player_CORRUPT1');
            const diskData = JSON.parse(diskRaw);
            assert.equal(diskData.playerProfile, null, 'loadState must self-heal corrupted partition on disk');
        });

        it('loadPlayerData ignores cross-contaminated profile when tag mismatches partition key', () => {
            localStorage.setItem('oreCalc_player_MISMATCH1', JSON.stringify({
                ...getDefaultPlayerState(),
                playerProfile: {
                    name: 'Contaminated Name',
                    tag: '#DIFFERENT',
                    townHallLevel: 18
                }
            }));

            const data = loadPlayerData('MISMATCH1');
            assert.ok(data);
            assert.equal(data.playerProfile, null, 'loadPlayerData must return null playerProfile on tag mismatch');
        });

        it('getSavedProfiles falls back to tag display when partition has cross-contaminated profile', () => {
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['CLEAN01', 'DIRTY02']));
            localStorage.setItem('oreCalc_player_CLEAN01', JSON.stringify({
                playerProfile: { name: 'Valid Chief', tag: '#CLEAN01', townHallLevel: 16 }
            }));
            localStorage.setItem('oreCalc_player_DIRTY02', JSON.stringify({
                playerProfile: { name: 'Contaminated Chief', tag: '#OTHERTAG', townHallLevel: 18 }
            }));

            const profiles = getSavedProfiles();
            assert.equal(profiles.length, 2);
            assert.equal(profiles[0].name, 'Valid Chief');
            assert.equal(profiles[1].name, '#DIRTY02', 'Mismatched profile must fall back to formatted tag name');
            assert.equal(profiles[1].cachedData, null);
        });
    });

    describe('12. Storage Sanitization & Payload Hygiene (sanitizePlayerProfile & stripAutoPlacedCalendarChips)', () => {
        it('sanitizePlayerProfile whitelists core fields and drops achievements, troops, unneeded spells, and builder base bloat', () => {
            const rawApiProfile = {
                tag: '#8PJYGUJC',
                name: 'Chief',
                townHallLevel: 18,
                trophies: 5600,
                warStars: 1850,
                role: 'leader',
                clan: {
                    tag: '#CLAN1',
                    name: 'Test Clan',
                    badgeUrls: { small: 'https://badge.small', medium: 'https://badge.medium', large: 'https://badge.large' }
                },
                leagueTier: { id: 105000036, name: 'Legend League', iconUrls: { small: 'https://league.small' } },
                achievements: [
                    { name: 'Bigger Coffers', stars: 3, value: 1000 },
                    { name: 'Get those Goblins!', stars: 3, value: 150 }
                ],
                troops: [
                    { name: 'Barbarian', level: 12, village: 'home' },
                    { name: 'Archer', level: 11, village: 'home' },
                    { name: 'Giant', level: 12, village: 'home' },
                    { name: 'Raged Barbarian', level: 20, village: 'builderBase' }
                ],
                spells: [
                    { name: 'Lightning Spell', level: 13, village: 'home' },
                    { name: 'Healing Spell', level: 9, village: 'home' },
                    { name: 'Earthquake Spell', level: 8, village: 'home' },
                    { name: 'Jump Spell', level: 5, village: 'home' }
                ],
                heroes: [
                    { name: 'Barbarian King', level: 95, maxLevel: 95, village: 'home', equipment: [{ name: 'Spiky Ball', level: 27 }] }
                ],
                heroEquipment: [
                    { name: 'Spiky Ball', level: 27, village: 'home' }
                ],
                playerHouse: { elements: [] },
                labels: [{ id: 57000001, name: 'Clan Wars' }],
                legendStatistics: { legendTrophies: 1200 },
                builderBaseTrophies: 4200,
                builderHallLevel: 10
            };

            const sanitized = sanitizePlayerProfile(rawApiProfile);
            assert.ok(sanitized);
            assert.equal(sanitized.tag, '8PJYGUJC');
            assert.equal(sanitized.name, 'Chief');
            assert.equal(sanitized.townHallLevel, 18);
            assert.equal(sanitized.trophies, 5600);
            assert.equal(sanitized.warStars, 1850);
            assert.equal(sanitized.role, 'leader');

            // Normalized spells preserved for Damage Calculator
            assert.deepEqual(sanitized.spells, { lightning: 13, earthquake: 8 });

            // Lab troops preserved strictly for Barbarian and Archer scaling
            assert.deepEqual(sanitized.labTroops, { barbarian: 12, archer: 11 });

            // Bloat strictly omitted
            assert.equal(sanitized.achievements, undefined);
            assert.equal(sanitized.troops, undefined);
            assert.equal(sanitized.playerHouse, undefined);
            assert.equal(sanitized.labels, undefined);
            assert.equal(sanitized.legendStatistics, undefined);
            assert.equal(sanitized.builderBaseTrophies, undefined);
            assert.equal(sanitized.builderHallLevel, undefined);
        });

        it('sanitizePlayerProfile preserves already-normalized spells object', () => {
            const profile = {
                tag: '#ALREADYCLEAN',
                name: 'Clean Chief',
                townHallLevel: 16,
                spells: { lightning: 11, earthquake: 6 }
            };
            const sanitized = sanitizePlayerProfile(profile);
            assert.ok(sanitized);
            assert.deepEqual(sanitized.spells, { lightning: 11, earthquake: 6 });
        });

        it('sanitizePlayerProfile returns null for null, undefined, or DEFAULT0 profiles', () => {
            assert.equal(sanitizePlayerProfile(null), null);
            assert.equal(sanitizePlayerProfile(undefined), null);
            assert.equal(sanitizePlayerProfile({ tag: 'DEFAULT0' }), null);
            assert.equal(sanitizePlayerProfile({ tag: '' }), null);
        });

        it('stripAutoPlacedCalendarChips removes all -cal-auto chips and prunes empty days/months', () => {
            const dirtyDates = {
                '2026-03': {
                    '2026-03-15': ['custom-chip-1', 'event-hero-boost-cal-auto', 'event-star-bonus-cal-auto'],
                    '2026-03-16': ['event-clan-games-cal-auto']
                },
                '2026-04': {
                    '2026-04-01': ['event-cwl-cal-auto']
                }
            };

            const cleanDates = stripAutoPlacedCalendarChips(dirtyDates);
            assert.deepEqual(cleanDates, {
                '2026-03': {
                    '2026-03-15': ['custom-chip-1']
                }
            });
            assert.equal(cleanDates['2026-04'], undefined, 'Months with only auto chips must be pruned');
        });

        it('saveState and loadState never persist or restore saveError flag', () => {
            state.savedPlayerTags = ['TESTSAVE1'];
            state.allPlayersData = {
                TESTSAVE1: {
                    ...getDefaultPlayerState(),
                    playerProfile: { tag: 'TESTSAVE1', name: 'Tester', townHallLevel: 15 }
                }
            };
            state.heroes = state.allPlayersData.TESTSAVE1.heroes;
            state.storedOres = state.allPlayersData.TESTSAVE1.storedOres;
            state.income = state.allPlayersData.TESTSAVE1.income;
            state.planner = state.allPlayersData.TESTSAVE1.planner;
            state.playerProfile = state.allPlayersData.TESTSAVE1.playerProfile;
            state.uiSettings = {
                theme: 'dark',
                saveError: false
            };

            saveState(state, true);

            const savedSettingsRaw = localStorage.getItem('oreCalc_appSettings') || localStorage.getItem('clashCalc_appSettings');
            assert.ok(savedSettingsRaw);
            const savedSettings = JSON.parse(savedSettingsRaw);
            assert.equal(savedSettings.saveError, undefined, 'saveError must be stripped before persisting appSettings');

            // Simulate loading settings that previously contained saveError (e.g. from prod Firestore)
            localStorage.setItem('oreCalc_appSettings', JSON.stringify({
                theme: 'dark',
                saveError: true
            }));

            const loaded = loadState();
            assert.ok(loaded);
            assert.equal(loaded.uiSettings.saveError, undefined, 'loadState must strip saveError from loaded uiSettings');

            delete state.uiSettings.saveError;
        });

        it('saveState and loadState sanitize bloated playerProfile and calendar chips on disk', () => {
            state.savedPlayerTags = ['BLOAT1'];
            state.allPlayersData = {
                BLOAT1: {
                    ...getDefaultPlayerState(),
                    playerProfile: {
                        tag: '#BLOAT1',
                        name: 'Bloated Chief',
                        townHallLevel: 17,
                        achievements: [{ name: 'Dead Weight', stars: 3 }],
                        troops: [{ name: 'Giant', level: 12 }],
                        spells: [{ name: 'Lightning Spell', level: 12 }, { name: 'Earthquake Spell', level: 7 }]
                    },
                    planner: {
                        calendar: {
                            dates: {
                                '2026-03': {
                                    '2026-03-10': ['manual-chip', 'auto-chip-cal-auto']
                                }
                            }
                        }
                    }
                }
            };
            state.heroes = state.allPlayersData.BLOAT1.heroes;
            state.storedOres = state.allPlayersData.BLOAT1.storedOres;
            state.income = state.allPlayersData.BLOAT1.income;
            state.planner = state.allPlayersData.BLOAT1.planner;
            state.playerProfile = state.allPlayersData.BLOAT1.playerProfile;
            state.uiSettings = {
                theme: 'dark'
            };

            saveState(state, true);

            const savedRaw = localStorage.getItem('oreCalc_player_BLOAT1') || localStorage.getItem('clashCalc_player_BLOAT1');
            assert.ok(savedRaw);
            const savedPlayer = JSON.parse(savedRaw);

            // Sanitized on save
            assert.equal(savedPlayer.playerProfile.achievements, undefined);
            assert.equal(savedPlayer.playerProfile.troops, undefined);
            assert.deepEqual(savedPlayer.playerProfile.spells, { lightning: 12, earthquake: 7 });
            assert.deepEqual(savedPlayer.planner.calendar.dates, {
                '2026-03': { '2026-03-10': ['manual-chip'] }
            });

            // Simulate legacy partition loaded from disk
            localStorage.setItem('oreCalc_player_LEGACYBLOAT', JSON.stringify({
                ...getDefaultPlayerState(),
                playerProfile: {
                    tag: '#LEGACYBLOAT',
                    name: 'Old Chief',
                    townHallLevel: 14,
                    achievements: [{ name: 'Old Achievement' }],
                    spells: [{ name: 'Lightning Spell', level: 10 }, { name: 'Earthquake Spell', level: 5 }]
                },
                planner: {
                    calendar: {
                        dates: {
                            '2026-01': { '2026-01-01': ['cal-auto-cal-auto'] }
                        }
                    }
                }
            }));
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(['LEGACYBLOAT']));

            const loaded = loadState();
            assert.ok(loaded);
            const loadedPlayer = loaded.allPlayersData.LEGACYBLOAT;
            assert.equal(loadedPlayer.playerProfile.achievements, undefined);
            assert.deepEqual(loadedPlayer.playerProfile.spells, { lightning: 10, earthquake: 5 });
            assert.deepEqual(loadedPlayer.planner.calendar.dates, {});
        });
    });
});
