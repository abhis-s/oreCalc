import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    hasComingSoonEquipment,
    getComingSoonEquipment,
    hasAnyCustomComingSoonEquipment,
    getActiveCustomComingSoon,
    canAddComingSoonEquipment,
    createComingSoonEquipmentItem,
    deleteComingSoonEquipment,
    getHeroEquipmentList,
    findHeroEquipment,
    resolveEquipmentType
} from '../../js/domain/equipment/comingSoonEquipmentDomain.js';

describe('Custom Coming Soon Equipment Domain Engine', () => {
    test('createComingSoonEquipmentItem produces pure descriptor with validated rarity', () => {
        const epicItem = createComingSoonEquipmentItem('epic');
        assert.deepEqual(epicItem, {
            level: 1,
            checked: true,
            type: 'epic',
            isCustom: true
        });

        const commonItem = createComingSoonEquipmentItem('common');
        assert.deepEqual(commonItem, {
            level: 1,
            checked: true,
            type: 'common',
            isCustom: true
        });
    });

    test('hasComingSoonEquipment accurately identifies presence of placeholder equipment', () => {
        const cleanHero = { equipment: { barbarianPuppet: { level: 18, checked: true } } };
        assert.equal(hasComingSoonEquipment(cleanHero), false);

        const heroWithSoon = {
            equipment: {
                barbarianPuppet: { level: 18, checked: true },
                comingSoon: { level: 1, checked: true, type: 'epic', isCustom: true }
            }
        };
        assert.equal(hasComingSoonEquipment(heroWithSoon), true);

        const heroWithDisplaySoon = {
            equipment: {
                'Coming Soon': { level: 5, checked: true, type: 'common', isCustom: true }
            }
        };
        assert.equal(hasComingSoonEquipment(heroWithDisplaySoon), true);
    });

    test('getComingSoonEquipment extracts normalized equipment details', () => {
        const heroState = {
            equipment: {
                'Coming Soon': { level: 12, checked: false, type: 'common', isCustom: true }
            }
        };
        const details = getComingSoonEquipment(heroState);
        assert.ok(details);
        assert.equal(details.key, 'comingSoon');
        assert.equal(details.name, 'Coming Soon');
        assert.equal(details.level, 12);
        assert.equal(details.checked, false);
        assert.equal(details.type, 'common');
        assert.equal(details.isCustom, true);
    });

    test('canAddComingSoonEquipment strictly enforces max 1 coming soon equipment globally', () => {
        const heroesMap = {
            barbarianKing: {
                equipment: {
                    giantGauntlet: { level: 27, checked: true }
                }
            },
            archerQueen: {
                equipment: {
                    invisibilityCloak: { level: 18, checked: true }
                }
            }
        };

        assert.equal(canAddComingSoonEquipment(heroesMap, 'barbarianKing'), true);
        heroesMap.barbarianKing.equipment.comingSoon = createComingSoonEquipmentItem('epic');

        // Cannot add to the same hero
        assert.equal(canAddComingSoonEquipment(heroesMap, 'barbarianKing'), false);

        // Cannot add to another hero because global max is 1
        assert.equal(canAddComingSoonEquipment(heroesMap, 'archerQueen'), false);
        assert.equal(hasComingSoonEquipment(heroesMap.archerQueen), false);
    });

    test('hasAnyCustomComingSoonEquipment and getActiveCustomComingSoon track global custom state', () => {
        const heroesMap = {
            barbarianKing: {
                equipment: {
                    giantGauntlet: { level: 27, checked: true }
                }
            },
            archerQueen: {
                equipment: {
                    comingSoon: { level: 1, checked: true, type: 'epic', isCustom: true }
                }
            }
        };

        assert.equal(hasAnyCustomComingSoonEquipment(heroesMap), true);
        const active = getActiveCustomComingSoon(heroesMap);
        assert.ok(active);
        assert.equal(active.heroKey, 'archerQueen');
        assert.equal(active.item.type, 'epic');

        delete heroesMap.archerQueen.equipment.comingSoon;
        assert.equal(hasAnyCustomComingSoonEquipment(heroesMap), false);
        assert.equal(getActiveCustomComingSoon(heroesMap), null);
    });

    test('getHeroEquipmentList unifies static and dynamic custom equipment', () => {
        const heroDef = {
            name: 'Barbarian King',
            equipment: [
                { name: 'Barbarian Puppet', key: 'barbarianPuppet', type: 'common', image: 'assets/equipment/bk_puppet.png' }
            ]
        };

        const listWithoutSoon = getHeroEquipmentList(heroDef, null);
        assert.equal(listWithoutSoon.length, 1);
        assert.equal(listWithoutSoon[0].key, 'barbarianPuppet');
        assert.equal(listWithoutSoon[0].isCustom, false);

        const heroState = {
            equipment: {
                comingSoon: createComingSoonEquipmentItem('epic')
            }
        };

        const listWithSoon = getHeroEquipmentList(heroDef, heroState);
        assert.equal(listWithSoon.length, 2);
        assert.equal(listWithSoon[1].key, 'comingSoon');
        assert.equal(listWithSoon[1].name, 'Coming Soon');
        assert.equal(listWithSoon[1].type, 'epic');
        assert.equal(listWithSoon[1].isCustom, true);
    });

    test('findHeroEquipment and resolveEquipmentType resolve standard and custom equipment polymorphically', () => {
        const heroDef = {
            name: 'Barbarian King',
            equipment: [
                { name: 'Barbarian Puppet', key: 'barbarianPuppet', type: 'common', image: 'assets/equipment/bk_puppet.png' }
            ]
        };
        const heroState = {
            equipment: {
                comingSoon: createComingSoonEquipmentItem('epic')
            }
        };

        const standardByName = findHeroEquipment(heroDef, 'Barbarian Puppet', heroState);
        assert.ok(standardByName);
        assert.equal(standardByName.key, 'barbarianPuppet');

        const standardByKey = findHeroEquipment(heroDef, 'barbarianPuppet', heroState);
        assert.ok(standardByKey);
        assert.equal(standardByKey.name, 'Barbarian Puppet');

        const customByName = findHeroEquipment(heroDef, 'Coming Soon', heroState);
        assert.ok(customByName);
        assert.equal(customByName.key, 'comingSoon');
        assert.equal(customByName.type, 'epic');

        const customByKey = findHeroEquipment(heroDef, 'comingSoon', heroState);
        assert.ok(customByKey);
        assert.equal(customByKey.name, 'Coming Soon');

        assert.equal(resolveEquipmentType(heroDef, 'Barbarian Puppet', heroState), 'common');
        assert.equal(resolveEquipmentType(heroDef, 'Coming Soon', heroState), 'epic');
        assert.equal(resolveEquipmentType(heroDef, 'nonExistent', heroState), 'epic');
    });

    test('deleteComingSoonEquipment safely removes coming soon keys from hero equipment', () => {
        const heroState = {
            equipment: {
                barbarianPuppet: { level: 18, checked: true },
                comingSoon: createComingSoonEquipmentItem('epic')
            }
        };

        deleteComingSoonEquipment(heroState);
        assert.equal(heroState.equipment.comingSoon, undefined);
        assert.ok(heroState.equipment.barbarianPuppet);

        // Safe on null/empty
        deleteComingSoonEquipment(null);
        deleteComingSoonEquipment({});
    });
});
