import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { heroData } from '../../js/data/heroData.js';
import {
    migrateHeroesToKeys,
    attachHeroStateAliases,
    normalizeHeroesState
} from '../../js/core/stateCleanup.js';
import { getDefaultState } from '../../js/core/state.js';
import { calculateEquipmentProgress } from '../../js/domain/equipment/equipmentProgressDomain.js';
import { inferTownHallLevel } from '../../js/core/playerStorage.js';

describe('State Key Migration & Transparent Backward Compatibility Suite', () => {
    test('migrateHeroesToKeys migrates legacy display names to canonical keys in-place', () => {
        const legacyHeroes = {
            'Barbarian King': {
                enabled: true,
                level: 95,
                equipment: {
                    'Giant Gauntlet': { level: 27, checked: true },
                    'Spiky Ball': { level: 27, checked: false }
                }
            },
            'Archer Queen': {
                enabled: true,
                level: 95,
                equipment: {
                    'Frozen Arrow': { level: 27, checked: true }
                }
            }
        };

        migrateHeroesToKeys(legacyHeroes);

        // Canonical keys must exist as own properties
        assert.ok(legacyHeroes.barbarianKing, 'Canonical barbarianKing must exist');
        assert.equal(legacyHeroes.barbarianKing.level, 95);
        assert.equal(legacyHeroes.barbarianKing.equipment.giantGauntlet.level, 27);
        assert.equal(legacyHeroes.barbarianKing.equipment.giantGauntlet.checked, true);
        assert.equal(legacyHeroes.barbarianKing.equipment.spikyBall.checked, false);

        assert.ok(legacyHeroes.archerQueen, 'Canonical archerQueen must exist');
        assert.equal(legacyHeroes.archerQueen.equipment.frozenArrow.level, 27);

        // Own legacy properties must be removed
        assert.equal(Object.prototype.hasOwnProperty.call(legacyHeroes, 'Barbarian King'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(legacyHeroes, 'Archer Queen'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(legacyHeroes.barbarianKing.equipment, 'Giant Gauntlet'), false);
    });

    test('attachHeroStateAliases provides transparent bidirectional reading and writing via legacy names', () => {
        const heroes = {
            barbarianKing: {
                enabled: true,
                level: 90,
                equipment: {
                    giantGauntlet: { level: 26, checked: true }
                }
            }
        };

        attachHeroStateAliases(heroes);

        // Read by legacy name resolves to the exact same object reference
        assert.strictEqual(heroes['Barbarian King'], heroes.barbarianKing);
        assert.strictEqual(heroes['Barbarian King'].equipment['Giant Gauntlet'], heroes.barbarianKing.equipment.giantGauntlet);

        // Mutating via legacy name updates the canonical key property in-place
        heroes['Barbarian King'].equipment['Giant Gauntlet'].level = 27;
        assert.equal(heroes.barbarianKing.equipment.giantGauntlet.level, 27);

        heroes['Barbarian King'].level = 95;
        assert.equal(heroes.barbarianKing.level, 95);

        // Membership checks pass for legacy names
        assert.equal('Barbarian King' in heroes, true);
        assert.equal('Giant Gauntlet' in heroes.barbarianKing.equipment, true);
        assert.equal(Object.hasOwn(heroes, 'Barbarian King'), true);
        assert.equal(Object.hasOwn(heroes.barbarianKing.equipment, 'Giant Gauntlet'), true);
    });

    test('Object.keys, for..in loops, and JSON.stringify iterate exclusively on canonical keys without duplicates', () => {
        const heroes = {
            barbarianKing: {
                enabled: true,
                equipment: {
                    giantGauntlet: { level: 27, checked: true }
                }
            },
            archerQueen: {
                enabled: true,
                equipment: {
                    frozenArrow: { level: 27, checked: true }
                }
            }
        };

        attachHeroStateAliases(heroes);

        // Object.keys must contain ONLY canonical keys
        const keys = Object.keys(heroes);
        assert.deepEqual(keys.sort(), ['archerQueen', 'barbarianKing']);

        // for..in loop must visit only canonical keys
        const loopKeys = [];
        for (const k in heroes) {
            loopKeys.push(k);
        }
        assert.deepEqual(loopKeys.sort(), ['archerQueen', 'barbarianKing']);

        // Equipment keys must also be strictly canonical
        const eqKeys = Object.keys(heroes.barbarianKing.equipment);
        assert.deepEqual(eqKeys, ['giantGauntlet']);

        // JSON.stringify must omit non-enumerable fallback aliases
        const serialized = JSON.parse(JSON.stringify(heroes));
        assert.deepEqual(Object.keys(serialized).sort(), ['archerQueen', 'barbarianKing']);
        assert.equal(serialized['Barbarian King'], undefined);
        assert.equal(serialized.barbarianKing.equipment['Giant Gauntlet'], undefined);
        assert.equal(serialized.barbarianKing.equipment.giantGauntlet.level, 27);
    });

    test('structuredClone succeeds cleanly without throwing DOMException', () => {
        const heroes = {
            barbarianKing: {
                enabled: true,
                equipment: {
                    giantGauntlet: { level: 27, checked: true }
                }
            }
        };

        attachHeroStateAliases(heroes);

        let cloned = null;
        assert.doesNotThrow(() => {
            cloned = structuredClone(heroes);
        });

        assert.ok(cloned);
        assert.equal(cloned.barbarianKing.equipment.giantGauntlet.level, 27);
    });

    test('normalizeHeroesState is idempotent across multiple sequential passes', () => {
        const legacyHeroes = {
            'Barbarian King': {
                enabled: true,
                equipment: {
                    'Giant Gauntlet': { level: 27, checked: true }
                }
            }
        };

        // First pass
        normalizeHeroesState(legacyHeroes);
        assert.equal(legacyHeroes.barbarianKing.equipment.giantGauntlet.level, 27);
        assert.equal(legacyHeroes['Barbarian King'].equipment['Giant Gauntlet'].level, 27);

        // Second pass
        normalizeHeroesState(legacyHeroes);
        assert.equal(legacyHeroes.barbarianKing.equipment.giantGauntlet.level, 27);
        assert.equal(legacyHeroes['Barbarian King'].equipment['Giant Gauntlet'].level, 27);

        // Third pass
        normalizeHeroesState(legacyHeroes);
        assert.equal(Object.keys(legacyHeroes).length, 1);
        assert.equal(Object.keys(legacyHeroes)[0], 'barbarianKing');
    });

    test('getDefaultState creates key-based hero state with aliases attached', () => {
        const defaultState = getDefaultState();
        const heroes = defaultState.heroes;

        assert.ok(heroes.barbarianKing, 'defaultState.heroes must have canonical barbarianKing');
        assert.ok(heroes.barbarianKing.equipment.giantGauntlet, 'defaultState.heroes must have canonical giantGauntlet');

        // Verify fallback alias access
        assert.strictEqual(heroes['Barbarian King'], heroes.barbarianKing);
        assert.strictEqual(heroes['Barbarian King'].equipment['Giant Gauntlet'], heroes.barbarianKing.equipment.giantGauntlet);

        // Verify all 6 heroes exist as canonical keys
        const expectedHeroKeys = Object.keys(heroData).sort();
        const actualHeroKeys = Object.keys(heroes).sort();
        assert.deepEqual(actualHeroKeys, expectedHeroKeys);
    });

    test('calculateEquipmentProgress handles key-based, name-based, and mixed inputs identically', () => {
        const nameBasedEquip = { 'Giant Gauntlet': 27, 'Frozen Arrow': 27 };
        const nameBasedHeroes = { 'Barbarian King': { level: 95 }, 'Archer Queen': { level: 95 } };

        const keyBasedEquip = { giantGauntlet: 27, frozenArrow: 27 };
        const keyBasedHeroes = { barbarianKing: { level: 95 }, archerQueen: { level: 95 } };

        const mixedEquip = { giantGauntlet: 27, 'Frozen Arrow': 27 };
        const mixedHeroes = { 'Barbarian King': { level: 95 }, archerQueen: { level: 95 } };

        const resultName = calculateEquipmentProgress(nameBasedEquip, nameBasedHeroes);
        const resultKey = calculateEquipmentProgress(keyBasedEquip, keyBasedHeroes);
        const resultMixed = calculateEquipmentProgress(mixedEquip, mixedHeroes);

        assert.equal(resultKey.overall, resultName.overall);
        assert.equal(resultKey.shiny, resultName.shiny);
        assert.equal(resultKey.glowy, resultName.glowy);
        assert.equal(resultKey.starry, resultName.starry);

        assert.equal(resultMixed.overall, resultName.overall);
        assert.equal(resultMixed.shiny, resultName.shiny);
        assert.equal(resultMixed.glowy, resultName.glowy);
        assert.equal(resultMixed.starry, resultName.starry);
    });

    test('inferTownHallLevel resolves correct TH with both canonical keys and legacy names', () => {
        const keyData = { heroes: { dragonDuke: { level: 1 } } };
        const nameData = { heroes: { 'Dragon Duke': { level: 1 } } };

        assert.equal(inferTownHallLevel(keyData), 18);
        assert.equal(inferTownHallLevel(nameData), 18);
    });
});
