import { test, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';

let localStorageStore = new Map();
globalThis.localStorage = {
    getItem: (key) => localStorageStore.get(key) ?? null,
    setItem: (key, val) => localStorageStore.set(key, String(val)),
    removeItem: (key) => localStorageStore.delete(key),
    clear: () => localStorageStore.clear(),
    key: (index) => Array.from(localStorageStore.keys())[index] ?? null,
    get length() { return localStorageStore.size; }
};

let sessionStorageStore = new Map();
globalThis.sessionStorage = {
    getItem: (key) => sessionStorageStore.get(key) ?? null,
    setItem: (key, val) => sessionStorageStore.set(key, String(val)),
    removeItem: (key) => sessionStorageStore.delete(key),
    clear: () => sessionStorageStore.clear(),
    get length() { return sessionStorageStore.size; }
};

if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
        addEventListener: () => {},
        removeEventListener: () => {},
        __ENV__: { APP_VERSION: '2.2.0' },
        location: { hostname: 'localhost' }
    };
}

if (typeof globalThis.document === 'undefined') {
    globalThis.document = {
        dispatchEvent: () => true,
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => []
    };
}

const stateModule = await import('../../js/core/state.js');
const { getDefaultState, getDefaultPlayerState } = stateModule;
const {
    migrateComingSoonEquipment,
    cleanupOrphanedPlayerPartitions
} = await import('../../js/core/stateCleanup.js');
const { isComingSoonEquipment } = await import('../../js/core/constants.js');
const { getGlobalPriorityList } = await import('../../js/components/planner/priorityListScheduler.js');

describe('Coming Soon Equipment Planning Migration & State Purging', () => {
    beforeEach(() => {
        localStorageStore.clear();
        sessionStorageStore.clear();
        const fresh = getDefaultState();
        Object.keys(stateModule.state).forEach(k => delete stateModule.state[k]);
        Object.assign(stateModule.state, fresh);
        stateModule.state.savedPlayerTags = ['DEFAULT0'];
        stateModule.state.allPlayersData = {
            DEFAULT0: getDefaultPlayerState()
        };
        stateModule.state.heroes = stateModule.state.allPlayersData.DEFAULT0.heroes;
    });

    test('isComingSoonEquipment correctly identifies coming soon variations', () => {
        assert.equal(isComingSoonEquipment('comingSoon'), true);
        assert.equal(isComingSoonEquipment('Coming Soon'), true);
        assert.equal(isComingSoonEquipment('COMING_SOON'), true);
        assert.equal(isComingSoonEquipment('coming-soon'), true);
        assert.equal(isComingSoonEquipment('revengeDeck'), false);
        assert.equal(isComingSoonEquipment('Revenge Deck'), false);
        assert.equal(isComingSoonEquipment(''), false);
        assert.equal(isComingSoonEquipment(null), false);
    });

    test('migrates upgradePlan from Coming Soon to Revenge Deck while strictly preserving level and checked', () => {
        const heroes = {
            'Dragon Duke': {
                enabled: true,
                equipment: {
                    'Fire Heart': { level: 1, checked: true },
                    'Revenge Deck': { level: 1, checked: true },
                    'Coming Soon': {
                        level: 27, // Coming soon had arbitrary level
                        checked: false, // Coming soon was unchecked
                        upgradePlan: {
                            '1': { targetLevel: 18, enabled: true, priorityIndex: 1 },
                            '2': { targetLevel: 27, enabled: true, priorityIndex: 2 }
                        }
                    }
                }
            }
        };

        const changed = migrateComingSoonEquipment(heroes);
        assert.equal(changed, true);

        const revengeDeck = heroes['Dragon Duke'].equipment['Revenge Deck'];
        assert.ok(revengeDeck);
        // Level must remain 1 (NOT overwritten by 27)
        assert.equal(revengeDeck.level, 1);
        // Checked must remain true (NOT overwritten by false)
        assert.equal(revengeDeck.checked, true);
        // Upgrade plan must be migrated
        assert.ok(revengeDeck.upgradePlan);
        assert.equal(revengeDeck.upgradePlan['1'].targetLevel, 18);
        assert.equal(revengeDeck.upgradePlan['2'].targetLevel, 27);

        // Coming Soon must be completely purged
        assert.equal(heroes['Dragon Duke'].equipment['Coming Soon'], undefined);
        assert.equal(heroes['Dragon Duke'].equipment['comingSoon'], undefined);
    });

    test('supports camelCase hero and equipment keys during migration', () => {
        const heroes = {
            dragonDuke: {
                enabled: true,
                equipment: {
                    revengeDeck: { level: 1, checked: true },
                    comingSoon: {
                        level: 1,
                        checked: true,
                        upgradePlan: {
                            '1': { targetLevel: 21, enabled: true, priorityIndex: 3 }
                        }
                    }
                }
            }
        };

        const changed = migrateComingSoonEquipment(heroes);
        assert.equal(changed, true);

        const revengeDeck = heroes.dragonDuke.equipment.revengeDeck;
        assert.ok(revengeDeck);
        assert.equal(revengeDeck.level, 1);
        assert.equal(revengeDeck.upgradePlan?.['1']?.targetLevel, 21);
        assert.equal(heroes.dragonDuke.equipment.comingSoon, undefined);
    });

    test('collision safeguard: does NOT migrate if target equipment already has an active priority plan', () => {
        const heroes = {
            'Dragon Duke': {
                enabled: true,
                equipment: {
                    'Revenge Deck': {
                        level: 1,
                        checked: true,
                        upgradePlan: {
                            '1': { targetLevel: 15, enabled: true, priorityIndex: 5 }
                        }
                    },
                    'Coming Soon': {
                        level: 1,
                        checked: true,
                        upgradePlan: {
                            '1': { targetLevel: 27, enabled: true, priorityIndex: 1 }
                        }
                    }
                }
            }
        };

        const changed = migrateComingSoonEquipment(heroes);
        assert.equal(changed, true);

        const revengeDeck = heroes['Dragon Duke'].equipment['Revenge Deck'];
        // Existing Revenge Deck plan must be preserved
        assert.equal(revengeDeck.upgradePlan['1'].targetLevel, 15);
        assert.equal(revengeDeck.upgradePlan['1'].priorityIndex, 5);

        // Coming Soon must be purged
        assert.equal(heroes['Dragon Duke'].equipment['Coming Soon'], undefined);
    });

    test('purges unmapped coming soon equipment missing from the replacement registry', () => {
        const heroes = {
            'Minion Prince': {
                enabled: true,
                equipment: {
                    'Dark Orb': { level: 1, checked: true },
                    'Coming Soon': {
                        level: 1,
                        checked: true,
                        upgradePlan: {
                            '1': { targetLevel: 18, enabled: true, priorityIndex: 1 }
                        }
                    }
                }
            }
        };

        const changed = migrateComingSoonEquipment(heroes);
        assert.equal(changed, true);

        // Coming Soon must be deleted even if unmapped
        assert.equal(heroes['Minion Prince'].equipment['Coming Soon'], undefined);
        assert.equal(heroes['Minion Prince'].equipment['Dark Orb'].level, 1);
    });

    test('purges coming soon equipment that has no upgrade plan', () => {
        const heroes = {
            'Dragon Duke': {
                enabled: true,
                equipment: {
                    'Revenge Deck': { level: 1, checked: true },
                    'Coming Soon': { level: 1, checked: true }
                }
            }
        };

        const changed = migrateComingSoonEquipment(heroes);
        assert.equal(changed, true);

        assert.equal(heroes['Dragon Duke'].equipment['Coming Soon'], undefined);
        assert.equal(heroes['Dragon Duke'].equipment['Revenge Deck'].upgradePlan, undefined);
    });

    test('migration is idempotent on multiple invocations', () => {
        const heroes = {
            'Dragon Duke': {
                enabled: true,
                equipment: {
                    'Revenge Deck': { level: 1, checked: true },
                    'Coming Soon': {
                        level: 1,
                        checked: true,
                        upgradePlan: {
                            '1': { targetLevel: 18, enabled: true, priorityIndex: 1 }
                        }
                    }
                }
            }
        };

        assert.equal(migrateComingSoonEquipment(heroes), true);
        assert.equal(migrateComingSoonEquipment(heroes), false);
        assert.equal(heroes['Dragon Duke'].equipment['Coming Soon'], undefined);
    });

    test('cleanupOrphanedPlayerPartitions sanitizes and updates stored partitions on disk', () => {
        const partitionKey = 'clashCalc_player_PLAYER1';
        localStorageStore.set('clashCalc_playerTags', JSON.stringify(['PLAYER1']));
        localStorageStore.set(partitionKey, JSON.stringify({
            heroes: {
                'Dragon Duke': {
                    enabled: true,
                    equipment: {
                        'Revenge Deck': { level: 1, checked: true },
                        'Coming Soon': {
                            level: 1,
                            checked: true,
                            upgradePlan: {
                                '1': { targetLevel: 24, enabled: true, priorityIndex: 2 }
                            }
                        }
                    }
                }
            }
        }));

        cleanupOrphanedPlayerPartitions(stateModule.state);

        const updatedRaw = localStorageStore.get(partitionKey);
        assert.ok(updatedRaw);
        const updated = JSON.parse(updatedRaw);
        assert.equal(updated.heroes['Dragon Duke'].equipment['Coming Soon'], undefined);
        assert.equal(updated.heroes['Dragon Duke'].equipment['Revenge Deck'].upgradePlan['1'].targetLevel, 24);
    });

    test('getGlobalPriorityList replaces Coming Soon with Revenge Deck and never outputs raw strings or broken images', () => {
        stateModule.state.heroes = {
            'Dragon Duke': {
                enabled: true,
                equipment: {
                    'Revenge Deck': { level: 1, checked: true },
                    'Coming Soon': {
                        level: 1,
                        checked: true,
                        upgradePlan: {
                            '1': { targetLevel: 18, enabled: true, priorityIndex: 1 }
                        }
                    }
                }
            }
        };

        const { globalPriorityList } = getGlobalPriorityList();

        // Must NOT contain "Coming Soon"
        const comingSoonItem = globalPriorityList.find(item => item.name === 'Coming Soon' || item.name === 'comingSoon');
        assert.equal(comingSoonItem, undefined);

        // Must contain "Revenge Deck" with valid image and target level
        const revengeDeckItem = globalPriorityList.find(item => item.name === 'Revenge Deck');
        assert.ok(revengeDeckItem);
        assert.equal(revengeDeckItem.targetLevel, 18);
        assert.equal(revengeDeckItem.step, 1);
        assert.ok(revengeDeckItem.image);
        assert.ok(revengeDeckItem.image.includes('revenge_deck'));

        // Zero items must have missing or undefined images
        for (const item of globalPriorityList) {
            assert.ok(item.image, `Priority list item ${item.name} must have a defined image`);
            assert.notEqual(item.name, 'Coming Soon');
        }
    });

    test('getGlobalPriorityList defensively suppresses unmapped obsolete equipment with missing image', () => {
        stateModule.state.heroes = {
            'Dragon Duke': {
                enabled: true,
                equipment: {
                    'Defunct Equipment': {
                        level: 1,
                        checked: true,
                        upgradePlan: {
                            '1': { targetLevel: 18, enabled: true, priorityIndex: 99 }
                        }
                    }
                }
            }
        };

        const { globalPriorityList } = getGlobalPriorityList();
        const defunct = globalPriorityList.find(item => item.name === 'Defunct Equipment');
        assert.equal(defunct, undefined);
    });
});
