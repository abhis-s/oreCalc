/**
 * Feature Domain Tests for Equipment Damage & ZapQuake Solver Engine.
 * Tests mathematical purity, diminishing returns, immunities, competitive modifiers, and attack sequences.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { solveZapQuakeCombinations, filterDominatedCombos, getComboSignature } from '../../js/domain/damage/zapQuakeSolver.js';
import {
    solveClusteredZapQuake,
    solveAllDefensesZapQuake,
    groupDefensesBySpellCombo
} from '../../js/domain/damage/zapQuakeBatchSolver.js';
import {
    calculateEarthquakeDamage,
    calculateCumulativeEarthquakeDamage,
    calculateEarthquakeDamageWithCc,
    calculateEarthquakeDamageWithPools,
    calculateRequiredZapsTwoPools,
    getSpellCapacities,
    getEffectiveEquipmentLevel,
    isSameHeroEquipment,
    calculateEquipmentTargetDamage,
    isValidHeroEquipmentCombo,
    isTargetImmuneToSpell
} from '../../js/domain/damage/damageFormulas.js';
import {
    getDefenseMaxHp,
    isHeroDefense,
    getValidDefenseLevels,
    snapDefenseLevel,
    getPrevDefenseLevel,
    getNextDefenseLevel,
    canEquipmentTarget,
    isTownHallDefenseLevel,
    isDefensiveStructure,
    getMaxDefenseLevelForTownHall,
    getMinDefenseLevel
} from '../../js/domain/damage/defenseProgressionDomain.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const _testDir = path.dirname(fileURLToPath(import.meta.url));
const _targetsDir = path.resolve(_testDir, '../../js/data/targets');
globalThis.fetch = (url) => {
    const file = String(url).split('/').pop();
    const data = JSON.parse(readFileSync(path.resolve(_targetsDir, file), 'utf8'));
    return Promise.resolve({ json: () => Promise.resolve(data) });
};
import { preloadDefensesData, getDefensesData } from '../../js/data/defenseTargetsData.js';
import {
    calculateEquipmentDamage
} from '../../js/domain/damage/equipmentDamage.js';
import {
    simulateAttackSequence,
    simulateSequenceAcrossAllDefenses,
    BUILDER_REPAIR_PER_HIT
} from '../../js/domain/damage/attackSimulator.js';
await preloadDefensesData();

test('ZapQuake Solver - Diminishing Returns Math', async (t) => {
    await t.test('Strikes 1-4 deal exact diminishing returns percentages', () => {
        const hp = 10000;
        assert.equal(calculateEarthquakeDamage(hp, 8, 1), 2900); // Strike 1: 29%
        assert.equal(calculateEarthquakeDamage(hp, 8, 2), 966);  // Strike 2: 29% / 3 = 9.667%
        assert.equal(calculateEarthquakeDamage(hp, 8, 3), 580);  // Strike 3: 29% / 5 = 5.8%
        assert.equal(calculateEarthquakeDamage(hp, 8, 4), 414);  // Strike 4: 29% / 7 = 4.14%
    });

    await t.test('Cumulative damage correctly aggregates series sum', () => {
        const hp = 10000;
        const total = calculateCumulativeEarthquakeDamage(hp, 8, 4);
        assert.equal(total, 2900 + 966 + 580 + 414); // 4860
    });

    await t.test('Donated Clan Castle Earthquake prioritizes higher level on first strike', () => {
        const hp = 10000;
        // eqLevel 1 has 14.5% damage; ccEqLevel 5 has 29% damage
        const singleStrikeCc = calculateEarthquakeDamageWithCc(hp, 1, 1, 5);
        assert.equal(singleStrikeCc, 2900); // 29% from CC Lvl 5

        const twoStrikesCc = calculateEarthquakeDamageWithCc(hp, 1, 2, 5);
        // Strike 1: 2900 (CC Lvl 5). Strike 2: Math.floor(10000 * (0.145 / 3)) = 483 (Personal Lvl 1)
        assert.equal(twoStrikesCc, 2900 + 483);

        // When CC level is lower or equal, regular level is used
        const regularEqual = calculateEarthquakeDamageWithCc(hp, 8, 1, 7);
        assert.equal(regularEqual, 2900);
    });

    await t.test('calculateEarthquakeDamageWithPools prioritizes higher level strikes and respects pools', () => {
        const hp = 10000;
        // 1 Regular (lvl 1: 14.5%) + 1 CC (lvl 5: 29%)
        // Prioritizes CC first (2900) then regular second (483) = 3383
        const dmgCcFirst = calculateEarthquakeDamageWithPools(hp, 1, 1, 1, 5);
        assert.equal(dmgCcFirst, 2900 + 483);

        // 1 Regular (lvl 5: 29%) + 1 CC (lvl 1: 14.5%)
        // Prioritizes regular first (2900) then CC second (483) = 3383
        const dmgRegFirst = calculateEarthquakeDamageWithPools(hp, 1, 5, 1, 1);
        assert.equal(dmgRegFirst, 2900 + 483);

        // 0 strikes returns 0
        assert.equal(calculateEarthquakeDamageWithPools(hp, 0, 5, 0, 5), 0);
    });

    await t.test('Levels 1-5 deal 0 damage to defending heroes and guardians', () => {
        const heroHp = 10000;
        for (let lvl = 1; lvl <= 5; lvl++) {
            assert.equal(calculateEarthquakeDamage(heroHp, lvl, 1, 'barbarian_king'), 0);
            assert.equal(calculateEarthquakeDamage(heroHp, lvl, 1, 'archer_queen'), 0);
            assert.equal(calculateEarthquakeDamage(heroHp, lvl, 1, 'smasher'), 0);
        }
    });

    await t.test('Levels 6-8 deal exact troop percentages (5%, 10%, 14.5%) on strike 1', () => {
        const heroHp = 10000;
        assert.equal(calculateEarthquakeDamage(heroHp, 6, 1, 'barbarian_king'), 500); // 5%
        assert.equal(calculateEarthquakeDamage(heroHp, 7, 1, 'barbarian_king'), 1000); // 10%
        assert.equal(calculateEarthquakeDamage(heroHp, 8, 1, 'barbarian_king'), 1450); // 14.5%
    });

    await t.test('Hero diminishing returns follow harmonic series divider on damaging strikes', () => {
        const heroHp = 10000;
        // Level 8: 14.5% base
        assert.equal(calculateEarthquakeDamage(heroHp, 8, 1, 'barbarian_king'), 1450); // Strike 1: 14.5%
        assert.equal(calculateEarthquakeDamage(heroHp, 8, 2, 'barbarian_king'), 483);  // Strike 2: 14.5% / 3 = 4.833%
        assert.equal(calculateEarthquakeDamage(heroHp, 8, 3, 'barbarian_king'), 290);  // Strike 3: 14.5% / 5 = 2.9%
        assert.equal(calculateEarthquakeDamage(heroHp, 8, 4, 'barbarian_king'), 207);  // Strike 4: 14.5% / 7 = 2.071%

        const cumulative = calculateCumulativeEarthquakeDamage(heroHp, 8, 4, 'barbarian_king');
        assert.equal(cumulative, 1450 + 483 + 290 + 207);
    });

    await t.test('Non-damaging earthquakes do not advance the diminishing returns scaling series', () => {
        const heroHp = 10000;
        // 1 Regular Lvl 5 (0%) + 1 CC Lvl 8 (14.5%)
        // The Lvl 8 strike must deal full Strike 1 damage (1450 HP)
        const pooledDmg = calculateEarthquakeDamageWithPools(heroHp, 1, 5, 1, 8, 'barbarian_king');
        assert.equal(pooledDmg, 1450);

        // Sequence simulation: Lvl 5 followed by Lvl 8
        const sim = simulateAttackSequence('barbarian_king', 1, [
            { type: 'spell', id: 'earthquake', level: 5, count: 1 },
            { type: 'spell', id: 'earthquake', level: 8, count: 1 }
        ]);
        assert.equal(sim.timeline[0].damageDealt, 0);
        assert.equal(sim.timeline[0].notes, 'zero_damage_to_units_below_lvl6');
        assert.equal(sim.timeline[1].strikeIndex, 1);
        assert.ok(sim.timeline[1].damageDealt > 0);
    });

    await t.test('Minion Prince is an aerial hero and immune to earthquake damage', () => {
        const princeHp = 5000;
        assert.equal(isTargetImmuneToSpell('minion_prince', 'earthquake'), true);
        assert.equal(calculateEarthquakeDamage(princeHp, 8, 1, 'minion_prince'), 0);
        assert.equal(calculateCumulativeEarthquakeDamage(princeHp, 8, 4, 'minion_prince'), 0);
        assert.equal(calculateEarthquakeDamageWithPools(princeHp, 2, 8, 1, 8, 'minion_prince'), 0);
    });

    await t.test('Dragon Duke is an aerial hero and immune to earthquake damage', () => {
        const dukeHp = 10000;
        assert.equal(isTargetImmuneToSpell('dragon_duke', 'earthquake'), true);
        assert.equal(calculateEarthquakeDamage(dukeHp, 8, 1, 'dragon_duke'), 0);
        assert.equal(calculateCumulativeEarthquakeDamage(dukeHp, 8, 4, 'dragon_duke'), 0);
        assert.equal(calculateEarthquakeDamageWithPools(dukeHp, 2, 8, 1, 8, 'dragon_duke'), 0);
    });

    await t.test('Buildings continue to take full standard earthquake damage', () => {
        const bldHp = 10000;
        assert.equal(calculateEarthquakeDamage(bldHp, 5, 1, 'town_hall'), 2900); // 29%
        assert.equal(calculateEarthquakeDamage(bldHp, 8, 1, 'town_hall'), 2900); // 29%
        assert.equal(calculateEarthquakeDamage(bldHp, 8, 1, 'air_defense'), 2900); // 29%
    });

    await t.test('calculateRequiredZapsTwoPools prioritizes higher damage and handles capacity exhaustion', () => {
        // Remaining 1000 HP, CC zap deals 720 (1 available), regular zap deals 600
        // Needs 1 CC zap (720) + 1 reg zap (600) = 1320 dmg >= 1000
        const resMixed = calculateRequiredZapsTwoPools(1000, 600, 720, 5, 1);
        assert.equal(resMixed.possible, true);
        assert.equal(resMixed.ccZapCount, 1);
        assert.equal(resMixed.regZapCount, 1);
        assert.equal(resMixed.zapsNeeded, 2);

        // Equal damage (720 each): prefers regular zaps to conserve CC donations
        // Remaining 1400 HP, needs 2 zaps
        const resTied = calculateRequiredZapsTwoPools(1400, 720, 720, 5, 2);
        assert.equal(resTied.possible, true);
        assert.equal(resTied.regZapCount, 2);
        assert.equal(resTied.ccZapCount, 0);

        // Different damage (640 reg vs 720 CC): 500 HP prioritizes higher-damage CC zap in raw formula
        const resHigherDmg = calculateRequiredZapsTwoPools(500, 640, 720, 5, 2);
        assert.equal(resHigherDmg.possible, true);
        assert.equal(resHigherDmg.regZapCount, 0);
        assert.equal(resHigherDmg.ccZapCount, 1);

        // Capacity exhausted: 2000 HP remaining, 720 dmg, available: 1 reg + 1 CC = 1440 < 2000
        const resExhausted = calculateRequiredZapsTwoPools(2000, 720, 720, 1, 1);
        assert.equal(resExhausted.possible, false);
    });
});

test('ZapQuake Solver - Walls Exclusion Invariant', async (t) => {
    await t.test('walls are completely excluded from damage calculation registries and solver', () => {
        const allSolutions = solveAllDefensesZapQuake(13, 8);
        assert.equal(allSolutions.some(s => s.defenseKey === 'walls' || s.defenseKey === 'wall'), false);
        const sequenceResults = simulateSequenceAcrossAllDefenses([
            { type: 'equipment', id: 'giant_arrow', level: 18 }
        ]);
        assert.equal(sequenceResults.some(r => r.defenseKey === 'walls' || r.defenseKey === 'wall'), false);
    });
});

test('ZapQuake Solver - Immunities & Edge Cases', async (t) => {
    await t.test('Town Hall is 100% immune to Lightning and takes Earthquake damage', () => {
        const thRes = solveZapQuakeCombinations('town_hall', 17, 13, 8);
        assert.equal(thRes.isImmuneToLightning, true);
        assert.equal(thRes.isImmuneToEarthquake, false);
    });

    await t.test('Clan Castle is 100% immune to Lightning and takes Earthquake damage', () => {
        const ccRes = solveZapQuakeCombinations('clan_castle', 14, 13, 8);
        assert.equal(ccRes.isImmuneToLightning, true);
        assert.equal(ccRes.isImmuneToEarthquake, false);
    });

    await t.test('Storages are immune to both Lightning and Earthquake', () => {
        const storageRes = solveZapQuakeCombinations('gold_storage', 18, 13, 8);
        assert.equal(storageRes.isImmuneToLightning, true);
        assert.equal(storageRes.isImmuneToEarthquake, true);
        assert.equal(storageRes.optimalCombination, null);
        assert.equal(storageRes.reason, 'immune_to_both_spells');
    });

    await t.test('Dark Elixir Storage is a resource building: immune to both Lightning and Earthquake spells', () => {
        const deRes = solveZapQuakeCombinations('dark_elixir_storage', 12, 13, 8);
        assert.equal(deRes.isImmuneToLightning, true);
        assert.equal(deRes.isImmuneToEarthquake, true);
        assert.equal(deRes.optimalCombination, null);
        assert.equal(deRes.reason, 'immune_to_both_spells');
        assert.ok(deRes.bestAttempt);
        assert.equal(deRes.bestAttempt.totalDamage, 0);
        assert.equal(deRes.bestAttempt.remainingHp, 4700);
    });

    await t.test('Hero Equipment bypasses spell immunities: Fireball 27 destroys Storages', () => {
        const fireballOptions = { enabledEquipment: [{ id: 'fireball', level: 27 }] };

        const elixirRes = solveZapQuakeCombinations('elixir_storage', 17, 13, 8, fireballOptions);
        assert.ok(elixirRes.optimalCombination, 'Elixir Storage must be destroyed by Fireball 27');
        assert.equal(elixirRes.optimalCombination.totalHousingSpace, 0, 'Equipment alone requires 0 spell housing space');
        assert.equal(elixirRes.optimalCombination.equipment[0].id, 'fireball');

        const goldRes = solveZapQuakeCombinations('gold_storage', 17, 13, 8, fireballOptions);
        assert.ok(goldRes.optimalCombination, 'Gold Storage must be destroyed by Fireball 27');
        assert.equal(goldRes.optimalCombination.totalHousingSpace, 0);

        const deRes = solveZapQuakeCombinations('dark_elixir_storage', 9, 13, 8, fireballOptions);
        assert.ok(deRes.optimalCombination, 'Dark Elixir Storage must be destroyed by Fireball 27');
        assert.equal(deRes.optimalCombination.totalHousingSpace, 0);
    });

    await t.test('Clan Castle is destroyed by Fireball 27 combined with Earthquakes', () => {
        const fireballOptions = { enabledEquipment: [{ id: 'fireball', level: 27 }] };
        const ccRes = solveZapQuakeCombinations('clan_castle', 14, 13, 8, fireballOptions);
        assert.ok(ccRes.optimalCombination, 'Clan Castle must be destroyed by Fireball 27 + Earthquakes');
        assert.equal(ccRes.optimalCombination.equipment[0].id, 'fireball');
        assert.equal(ccRes.optimalCombination.eqCount, 2, 'Requires 2 Earthquakes to finish off Clan Castle');
        assert.equal(ccRes.optimalCombination.zapCount, 0, 'Must not use Lightning against Lightning-immune Clan Castle');
    });

    await t.test('Town Hall 18 is destroyed by Fireball 27 combined with 11x Earthquake', () => {
        const fireballOptions = {
            townHallLevel: 18,
            enabledEquipment: [{ id: 'fireball', level: 27 }],
            enabledSpells: { lightning: true, earthquake: true, cc_lightning: false, cc_earthquake: false }
        };
        const thRes = solveZapQuakeCombinations('town_hall', 18, 13, 8, fireballOptions);
        assert.ok(thRes.optimalCombination, 'Town Hall 18 must be destroyed by Fireball 27 + 11x Earthquake');
        assert.equal(thRes.optimalCombination.equipment[0].id, 'fireball');
        assert.equal(thRes.optimalCombination.eqCount, 11, 'Requires 11 Earthquakes to finish off TH18');
        assert.equal(thRes.optimalCombination.zapCount, 0, 'Must not use Lightning against Lightning-immune Town Hall');
        assert.equal(thRes.optimalCombination.totalHousingSpace, 11, 'Fits within 11 regular spell housing space');
    });

    await t.test('Town Hall 18 without equipment (100% HP remaining > 67.7%) caps bestAttempt at 4x Earthquake', () => {
        const thRes = solveZapQuakeCombinations('town_hall', 18, 13, 8, { townHallLevel: 18 });
        assert.equal(thRes.optimalCombination, null, 'Town Hall 18 cannot be destroyed by spells alone');
        assert.ok(thRes.bestAttempt);
        assert.equal(thRes.bestAttempt.eqCount, 4, 'Must cap Earthquake strikes at 4 when > 67.7% HP remains');
        assert.equal(thRes.bestAttempt.zapCount, 0);
    });

    await t.test('Surviving defenses compute accurate bestAttempt partial damage and remaining HP', () => {
        // Elixir storage with no equipment: spells deal 0 HP
        const storageRes = solveZapQuakeCombinations('elixir_storage', 18, 13, 8);
        assert.equal(storageRes.optimalCombination, null);
        assert.ok(storageRes.bestAttempt);
        assert.equal(storageRes.bestAttempt.totalDamage, 0);
        assert.equal(storageRes.bestAttempt.remainingHp, 4200);
        assert.equal(storageRes.bestAttempt.percentRemaining, 100);

        // Clan castle with Earthquakes only: Earthquakes deal partial damage
        const ccRes = solveZapQuakeCombinations('clan_castle', 14, 13, 8);
        assert.equal(ccRes.optimalCombination, null);
        assert.ok(ccRes.bestAttempt);
        assert.ok(ccRes.bestAttempt.totalDamage > 0);
        assert.ok(ccRes.bestAttempt.remainingHp > 0);
        assert.equal(ccRes.bestAttempt.zapCount, 0, 'Must not use Lightning on Clan Castle');
        assert.equal(ccRes.bestAttempt.totalDamage + ccRes.bestAttempt.remainingHp, 6000);
        assert.equal(ccRes.bestAttempt.eqCount, 4, 'Must cap Earthquake strikes at 4 when > 67.7% HP remains');
    });
});

test('ZapQuake Solver - Optimal Combinations for Standard Defenses', async (t) => {
    await t.test('Solves Air Defense Level 15 (TH17, 1950 HP)', () => {
        const res = solveZapQuakeCombinations('air_defense', 15, 13, 8);
        assert.equal(res.targetHp, 1950);
        assert.ok(res.optimalCombination);

        // Zap level 13 deals 720 dmg.
        // 3 Zaps = 2160 dmg (3 space).
        // 1 EQ (565 dmg) + 2 Zaps (1440 dmg) = 2005 dmg (3 space).
        assert.equal(res.optimalCombination.totalHousingSpace, 3);
    });

    await t.test('Clustered ZapQuake calculates shared spells across two Air Defenses', () => {
        const cluster = [
            { defenseKey: 'air_defense', level: 14 },
            { defenseKey: 'air_defense', level: 14 }
        ];
        const res = solveClusteredZapQuake(cluster, 13, 8);
        assert.equal(res.allDestroyed, true);
        assert.ok(res.totalHousingSpace > 0);
    });

    await t.test('Clustered ZapQuake computes solutions for large clusters exceeding standard capacity', () => {
        const cluster = [
            { defenseKey: 'monolith', level: 5 },
            { defenseKey: 'air_sweeper', level: 7 },
            { defenseKey: 'inferno_tower', level: 12 },
            { defenseKey: 'scattershot', level: 7 }
        ];
        const res = solveClusteredZapQuake(cluster, 13, 8, { townHallLevel: 18 });
        assert.equal(res.allDestroyed, true);
        assert.equal(res.targets.length, 4);
        assert.ok(res.combinations.length >= 5);
        assert.ok(res.totalHousingSpace > 0);
        assert.ok(res.totalZaps > 0);

        assert.equal(res.maxArmyCapacity, 15);
        assert.equal(res.optimalCombination.exceedsCapacity, true);

        // With adjacent pairings, housing space drops significantly and viable combinations sort ahead
        const pairedRes = solveClusteredZapQuake(cluster, 13, 8, {
            townHallLevel: 18,
            adjacentPairs: ['0-3', '1-2']
        });
        assert.equal(pairedRes.allDestroyed, true);
        assert.ok(pairedRes.spellsSaved > 0);
        assert.ok(pairedRes.totalHousingSpace < res.totalHousingSpace);
        assert.equal(pairedRes.optimalCombination.exceedsCapacity, false);
        assert.ok(pairedRes.optimalCombination.totalHousingSpace <= pairedRes.maxArmyCapacity);
        const lastCombo = pairedRes.combinations[pairedRes.combinations.length - 1];
        assert.equal(lastCombo.exceedsCapacity, true);
    });

    await t.test('Clustered ZapQuake prioritizes Earthquake over Lightning when housing space is tied (aligned with Tab 1)', () => {
        const cluster = [
            { defenseKey: 'inferno_tower', level: 12, superchargeTier: 2 },
            { defenseKey: 'monolith', level: 5, superchargeTier: 2 },
            { defenseKey: 'ricochet_cannon', level: 4, superchargeTier: 2 },
            { defenseKey: 'scattershot', level: 7, superchargeTier: 2 }
        ];
        const res = solveClusteredZapQuake(cluster, 13, 8, {
            townHallLevel: 18,
            adjacentPairs: ['0-1', '1-2', '2-3', '0-3']
        });
        assert.equal(res.allDestroyed, true);
        assert.equal(res.optimalCombination.totalHousingSpace, 8);
        assert.equal(res.optimalCombination.sharedEqCount, 3);
        assert.equal(res.optimalCombination.totalZaps, 5);

        const eightSpaceCombos = res.combinations.filter(c => c.totalHousingSpace === 8);
        assert.deepEqual(
            eightSpaceCombos.map(c => ({ eq: c.sharedEqCount, zap: c.totalZaps })),
            [
                { eq: 3, zap: 5 },
                { eq: 2, zap: 6 },
                { eq: 1, zap: 7 }
            ]
        );
    });

    await t.test('Clustered ZapQuake integrates hero equipment damage to reduce required spells', () => {
        const cluster = [
            { defenseKey: 'monolith', level: 5 },
            { defenseKey: 'scattershot', level: 7 }
        ];
        const resWithoutEquip = solveClusteredZapQuake(cluster, 13, 8, { townHallLevel: 18 });
        const resWithEquip = solveClusteredZapQuake(cluster, 13, 8, {
            townHallLevel: 18,
            clusterEquipment: [{ id: 'spiky_ball', level: 27 }]
        });

        assert.equal(resWithEquip.allDestroyed, true);
        assert.ok(resWithEquip.totalHousingSpace < resWithoutEquip.totalHousingSpace);
        assert.equal(resWithEquip.targets[0].equipmentDamage > 0, true);
        assert.equal(resWithEquip.targets[1].equipmentDamage > 0, true);
        assert.equal(resWithEquip.targets[0].equipment[0].id, 'spiky_ball');
    });

    await t.test('Clustered ZapQuake supports selective equipment target sharing', () => {
        const cluster = [
            { defenseKey: 'monolith', level: 5 },
            { defenseKey: 'scattershot', level: 7 }
        ];
        const res = solveClusteredZapQuake(cluster, 13, 8, {
            townHallLevel: 18,
            clusterEquipment: [{ id: 'spiky_ball', level: 27 }],
            clusterEquipmentSharing: { spiky_ball: [0] }
        });

        assert.equal(res.allDestroyed, true);
        assert.ok(res.targets[0].equipmentDamage > 0);
        assert.equal(res.targets[1].equipmentDamage, 0);
        assert.equal(res.targets[0].equipment.length, 1);
        assert.equal(res.targets[1].equipment.length, 0);
    });

    await t.test('ZapQuake solver utilizes higher level CC donated spell', () => {
        // Player has low level EQ (lvl 2: 17% base) but CC donated EQ is lvl 8 (29% base)
        const solutionWithCc = solveZapQuakeCombinations('air_defense', 11, 7, 2, {
            ccSpells: { lightning: 10, earthquake: 8 }
        });
        const solutionWithoutCc = solveZapQuakeCombinations('air_defense', 11, 7, 2, {
            ccSpells: { lightning: 7, earthquake: 2 }
        });

        // Solution with CC requires fewer or equal housing space due to stronger first EQ
        assert.ok(solutionWithCc.optimalCombination.totalHousingSpace <= solutionWithoutCc.optimalCombination.totalHousingSpace);

        // Step details indicates donated spell on strike 1
        const firstEq = solutionWithCc.optimalCombination.stepDetails.find(s => s.spell === 'earthquake' && s.index === 1);
        if (firstEq) {
            assert.equal(firstEq.isDonated, true);
            assert.equal(firstEq.level, 8);
        }
    });

    await t.test('getSpellCapacities correctly returns regular and CC capacity across Town Halls', () => {
        assert.deepEqual(getSpellCapacities(1), { regularCapacity: 0, ccCapacity: 0, regular: 0, clanCastle: 0, totalCapacity: 0 });
        assert.deepEqual(getSpellCapacities(5), { regularCapacity: 2, ccCapacity: 0, regular: 2, clanCastle: 0, totalCapacity: 2 });
        assert.deepEqual(getSpellCapacities(7), { regularCapacity: 6, ccCapacity: 0, regular: 6, clanCastle: 0, totalCapacity: 6 });
        assert.deepEqual(getSpellCapacities(8), { regularCapacity: 7, ccCapacity: 1, regular: 7, clanCastle: 1, totalCapacity: 8 });
        assert.deepEqual(getSpellCapacities(9), { regularCapacity: 9, ccCapacity: 1, regular: 9, clanCastle: 1, totalCapacity: 10 });
        assert.deepEqual(getSpellCapacities(10), { regularCapacity: 11, ccCapacity: 1, regular: 11, clanCastle: 1, totalCapacity: 12 });
        assert.deepEqual(getSpellCapacities(11), { regularCapacity: 11, ccCapacity: 2, regular: 11, clanCastle: 2, totalCapacity: 13 });
        assert.deepEqual(getSpellCapacities(14), { regularCapacity: 11, ccCapacity: 3, regular: 11, clanCastle: 3, totalCapacity: 14 });
        assert.deepEqual(getSpellCapacities(18), { regularCapacity: 11, ccCapacity: 4, regular: 11, clanCastle: 4, totalCapacity: 15 });
    });

    await t.test('ZapQuake solver enforces TH18 two-pool capacity limit (11 regular + 4 CC = 15 total)', () => {
        const solution = solveZapQuakeCombinations('scattershot', 5, 13, 8, {
            townHallLevel: 18
        });
        assert.ok(solution.optimalCombination);
        assert.ok(solution.optimalCombination.totalHousingSpace <= 15);
        assert.ok(solution.optimalCombination.regHousingSpace <= 11);
        assert.ok(solution.optimalCombination.ccHousingSpace <= 4);
        for (const c of solution.combinations) {
            assert.ok(c.totalHousingSpace <= 15);
            assert.ok(c.regHousingSpace <= 11);
            assert.ok(c.ccHousingSpace <= 4);
        }
    });

    await t.test('ZapQuake solver enforces TH9 capacity limit (9 regular + 1 CC = 10 total)', () => {
        const solution = solveZapQuakeCombinations('x_bow', 3, 7, 2, {
            townHallLevel: 9
        });
        assert.ok(solution.optimalCombination);
        assert.ok(solution.optimalCombination.totalHousingSpace <= 10);
        assert.ok(solution.optimalCombination.regHousingSpace <= 9);
        assert.ok(solution.optimalCombination.ccHousingSpace <= 1);
        for (const c of solution.combinations) {
            assert.ok(c.totalHousingSpace <= 10);
            assert.ok(c.regHousingSpace <= 9);
            assert.ok(c.ccHousingSpace <= 1);
        }
    });

    await t.test('Independent toggle: disabling regular lightning permits CC lightning up to CC capacity', () => {
        const solution = solveZapQuakeCombinations('air_defense', 11, 13, 8, {
            townHallLevel: 18,
            enabledSpells: {
                lightning: false,
                cc_lightning: true,
                earthquake: true,
                cc_earthquake: true
            },
            ccSpells: { lightning: 13, earthquake: 8 }
        });
        assert.ok(solution.optimalCombination);
        assert.equal(solution.optimalCombination.regZapCount, 0);
        assert.ok(solution.optimalCombination.ccZapCount > 0);
        assert.ok(solution.optimalCombination.ccHousingSpace <= 4);
    });

    await t.test('Independent toggle: disabling CC lightning uses only regular lightning', () => {
        const solution = solveZapQuakeCombinations('air_defense', 11, 13, 8, {
            townHallLevel: 18,
            enabledSpells: {
                lightning: true,
                cc_lightning: false,
                earthquake: false,
                cc_earthquake: false
            }
        });
        assert.ok(solution.optimalCombination);
        assert.equal(solution.optimalCombination.ccZapCount, 0);
        assert.equal(solution.optimalCombination.ccHousingSpace, 0);
        assert.ok(solution.optimalCombination.regZapCount > 0);
    });
});

test('ZapQuake Solver - Equipment and Spell Priority Hierarchy', async (t) => {
    await t.test('One-shot equipment priority selects highest damage equipment', () => {
        // Mortar Level 18 has 2625 HP.
        // Fireball 27 (4100 HP) and Spiky Ball 27 (3250 HP) can both one-shot it.
        const res = solveZapQuakeCombinations('mortar', 18, 13, 8, {
            enabledEquipment: [
                { id: 'spiky_ball', level: 27 },
                { id: 'fireball', level: 27 }
            ]
        });
        assert.ok(res.optimalCombination);
        assert.equal(res.optimalCombination.totalHousingSpace, 0);
        assert.equal(res.optimalCombination.equipment.length, 1);
        assert.equal(res.optimalCombination.equipment[0].id, 'fireball', 'Prefers Fireball over Spiky Ball due to higher damage');
        assert.equal(res.optimalCombination.totalDamage, 4100);
    });

    await t.test('Multi-equipment synergy prioritizes same-hero equipment before cross-hero equipment', () => {
        assert.equal(isSameHeroEquipment([{ id: 'flame_blower' }, { id: 'rocket_backpack' }]), true);
        assert.equal(isSameHeroEquipment([{ id: 'fireball' }, { id: 'rocket_backpack' }]), false);

        // Hot Candle Level 8 has 4500 HP.
        // flame_blower (2500) + rocket_backpack (2150) = 4650 HP >= 4500 HP (0 spells, 2 equip, SAME HERO).
        // fireball (4100) + rocket_backpack (2150) = 6250 HP >= 4500 HP (0 spells, 2 equip, CROSS HERO).
        const res = solveZapQuakeCombinations('hot_candle', 8, 13, 8, {
            enabledEquipment: [
                { id: 'fireball', level: 27 },
                { id: 'flame_blower', level: 18 },
                { id: 'rocket_backpack', level: 27 }
            ]
        });
        assert.ok(res.optimalCombination);
        assert.equal(res.optimalCombination.totalHousingSpace, 0);
        assert.equal(res.optimalCombination.equipment.length, 2);
        assert.equal(res.optimalCombination.isSameHero, true, 'Prioritizes same-hero equipment combo');
        const equipIds = res.optimalCombination.equipment.map(e => e.id).sort();
        assert.deepEqual(equipIds, ['flame_blower', 'rocket_backpack']);
    });

    await t.test('Earthquake is preferred over Lightning when housing space is tied', () => {
        // Hot Candle Level 10 has 6000 HP.
        // Fireball 27 deals 4100 HP, leaving 1900 HP.
        // 2x EQ deals 1740 + 580 = 2320 HP >= 1900 HP (2 housing space).
        // 1x EQ + 1x Zap deals 1740 + 720 = 2460 HP >= 1900 HP (2 housing space).
        // Both require 2 housing space; solver must choose Fireball + 2x EQ.
        const res = solveZapQuakeCombinations('hot_candle', 10, 13, 8, {
            enabledEquipment: [{ id: 'fireball', level: 27 }]
        });
        assert.ok(res.optimalCombination);
        assert.equal(res.optimalCombination.totalHousingSpace, 2);
        assert.equal(res.optimalCombination.eqCount, 2, 'Prefers 2x EQ over 1x EQ + 1x Zap');
        assert.equal(res.optimalCombination.zapCount, 0, 'Uses 0 Lightning spells');
    });

    await t.test('Clan Castle spells are preserved when regular spells suffice for destruction', () => {
        // Player has level 13 Zap (720 dmg), CC has level 13 Zap (720 dmg).
        // Target is Air Sweeper Level 1 (750 HP) -> 2 Zaps needed.
        // 2 regular Zaps = 1440 >= 750 (2 space, 0 CC).
        // 1 regular + 1 CC Zap = 1440 >= 750 (2 space, 1 CC).
        // Both take 2 spells; regular must be preferred (ccHousingSpace === 0).
        const resTie = solveZapQuakeCombinations('air_sweeper', 1, 13, 8, {
            ccSpells: { lightning: 13, earthquake: 8 },
            enabledSpells: { earthquake: false }
        });
        assert.ok(resTie.optimalCombination);
        assert.equal(resTie.optimalCombination.totalHousingSpace, 2);
        assert.equal(resTie.optimalCombination.ccHousingSpace, 0, 'Does not use CC when regular spells suffice');
        assert.equal(resTie.optimalCombination.regZapCount, 2);
        assert.equal(resTie.combinations.some(c => c.ccZapCount > 0), false, 'Prunes exact CC duplicates');

        // Different levels, tied count: selects lower-level spell option (Zap 10 reg vs Zap 11 CC)
        const resLower = solveZapQuakeCombinations('air_defense', 15, 10, 8, {
            ccSpells: { lightning: 11, earthquake: 8 },
            enabledSpells: { regularEarthquake: false, ccEarthquake: false, regularLightning: true, ccLightning: true }
        });
        assert.ok(resLower.optimalCombination);
        assert.equal(resLower.optimalCombination.regZapCount, 4);
        assert.equal(resLower.optimalCombination.ccZapCount, 0);

        // However, if player has low level Zap (lvl 1: 300 dmg) and CC has lvl 13 (720 dmg):
        // Air Sweeper Level 1 (750 HP):
        // Regular alone: 300 * 3 = 900 (3 spells).
        // With CC: 300 + 720 = 1020 >= 750 (2 spells: 1 regular + 1 CC).
        // CC saves a spell, so 2-spell combination using CC must win!
        const resSave = solveZapQuakeCombinations('air_sweeper', 1, 1, 8, {
            ccSpells: { lightning: 13, earthquake: 8 },
            enabledSpells: { earthquake: false }
        });
        assert.ok(resSave.optimalCombination);
        assert.equal(resSave.optimalCombination.totalHousingSpace, 2);
        assert.equal(resSave.optimalCombination.ccZapCount, 1, 'Uses CC when it reduces total spell count');
    });

    await t.test('isValidHeroEquipmentCombo enforces up to 2 distinct heroes and at most 2 equipment per hero', () => {
        assert.equal(isValidHeroEquipmentCombo([]), true);
        assert.equal(isValidHeroEquipmentCombo([{ id: 'fireball' }]), true);
        assert.equal(isValidHeroEquipmentCombo([{ id: 'fireball' }, { id: 'spiky_ball' }]), true);
        assert.equal(isValidHeroEquipmentCombo([{ id: 'flame_blower' }, { id: 'rocket_backpack' }]), true);

        // 3 equipment from 2 heroes (Dragon Duke 2 + Grand Warden 1): VALID
        assert.equal(isValidHeroEquipmentCombo([
            { id: 'flame_blower' },
            { id: 'rocket_backpack' },
            { id: 'fireball' }
        ]), true);

        // 3 equipment from 3 different heroes: INVALID (exceeds 2 heroes limit)
        assert.equal(isValidHeroEquipmentCombo([
            { id: 'fireball' },
            { id: 'spiky_ball' },
            { id: 'giant_arrow' }
        ]), false);

        // 3 equipment from same hero: INVALID (exceeds 2 equipment per hero limit)
        assert.equal(isValidHeroEquipmentCombo([
            { id: 'flame_blower' },
            { id: 'rocket_backpack' },
            { id: 'flame_blower' }
        ]), false);
    });

    await t.test('Multi-equipment generation evaluates 3 equipment from up to 2 heroes and ranks after 2-equipment options', () => {
        // Town Hall 18 has 12,000 HP.
        // fireball (4100) + flame_blower (2500) + rocket_backpack (2150) = 8750 HP (3 equipment from 2 heroes: Warden + Duke).
        const res = solveZapQuakeCombinations('town_hall', 18, 13, 8, {
            enabledEquipment: [
                { id: 'fireball', level: 27 },
                { id: 'flame_blower', level: 18 },
                { id: 'rocket_backpack', level: 27 }
            ]
        });
        assert.ok(res.combinations.length > 0);

        // Find combos with 3 equipment
        const threeEqCombos = res.combinations.filter(c => c.equipment?.length === 3);
        assert.ok(threeEqCombos.length > 0, 'Generates 3-equipment combinations for high HP targets');

        // All 3-equipment combos must only use at most 2 distinct heroes
        for (const combo of threeEqCombos) {
            assert.equal(isValidHeroEquipmentCombo(combo.equipment), true);
        }

        // All <= 2 equipment combos must appear before any > 2 equipment combo
        let seenOverTwo = false;
        for (const combo of res.combinations) {
            if ((combo.equipment?.length || 0) > 2) {
                seenOverTwo = true;
            } else {
                assert.equal(seenOverTwo, false, '<= 2 equipment combos must appear before any > 2 equipment combo');
            }
        }
    });

    await t.test('Matching spell count awards strict priority to 2-equipment combos over 3-equipment combos', () => {
        // Monolith Level 4 has 6020 HP.
        // fireball 27 (4100) + flame_blower 18 (2500) = 6600 >= 6020 HP (0 spells, 2 equipment).
        // fireball 27 (4100) + flame_blower 18 (2500) + rocket_backpack 27 (2150) = 8750 >= 6020 HP (0 spells, 3 equipment).
        // Both require 0 spells! The 2-equipment combo must be chosen over the 3-equipment combo.
        const res = solveZapQuakeCombinations('monolith', 4, 13, 8, {
            enabledEquipment: [
                { id: 'fireball', level: 27 },
                { id: 'flame_blower', level: 18 },
                { id: 'rocket_backpack', level: 27 }
            ]
        });
        assert.ok(res.optimalCombination);
        assert.equal(res.optimalCombination.totalHousingSpace, 0);
        assert.equal(res.optimalCombination.equipment.length, 2, 'Prefers 2-equipment combo when spell counts match at 0');
    });
});

test('Hero Equipment Damage - Giant Arrow Mechanics', async (t) => {
    await t.test('Giant Arrow deals 2x damage against Air Defense', () => {
        const adCalc = calculateEquipmentDamage('giant_arrow', 18, 'air_defense', 16);
        assert.equal(adCalc.rawDamage, 3000); // 1500 * 2.0
        assert.equal(adCalc.oneShotKill, true);
        assert.ok(adCalc.specialNotes.includes('giant_arrow_air_defense_2x'));
    });

    await t.test('Giant Arrow deals 1x damage against other defenses (e.g. Inferno Tower)', () => {
        const infernoCalc = calculateEquipmentDamage('giant_arrow', 18, 'inferno_tower', 12);
        assert.equal(infernoCalc.rawDamage, 1500);
        assert.equal(infernoCalc.oneShotKill, false);
    });
});

test('Hero Equipment Damage - Active Damage Equipment Mechanics', async (t) => {
    await t.test('Flame Blower deals flat damage up to 2500 at level 18', () => {
        const calc = calculateEquipmentDamage('flame_blower', 18, 'eagle_artillery', 7);
        assert.equal(calc.rawDamage, 2500);
        assert.equal(calc.damageDealt, 2500);
    });

    await t.test('Rocket Backpack deals flat damage up to 2150 at level 27', () => {
        const calc = calculateEquipmentDamage('rocket_backpack', 27, 'eagle_artillery', 7);
        assert.equal(calc.rawDamage, 2150);
        assert.equal(calc.damageDealt, 2150);
    });

    await t.test('Excised equipment returns 0 damage safely without throwing', () => {
        const calc = calculateEquipmentDamage('earthquake_boots', 18, 'town_hall', 17);
        assert.equal(calc.rawDamage, 0);
        assert.equal(calc.damageDealt, 0);
    });
});

test('Competitive Modifiers & Esports Mode', async (t) => {
    await t.test('Esports Mode applies -3 level loss to Common and -6 to Epic equipment', () => {
        // Max level equipment: 18 - 3 = 15, 27 - 6 = 21
        assert.equal(getEffectiveEquipmentLevel('giant_arrow', 18, 'esports'), 15);
        assert.equal(getEffectiveEquipmentLevel('fireball', 27, 'esports'), 21);

        // Sub-max equipment applies dynamic level loss: 16 - 3 = 13, 25 - 6 = 19
        assert.equal(getEffectiveEquipmentLevel('giant_arrow', 16, 'esports'), 13);
        assert.equal(getEffectiveEquipmentLevel('spiky_ball', 25, 'esports'), 19);

        // Low-level equipment clamps at Level 1 minimum
        assert.equal(getEffectiveEquipmentLevel('giant_arrow', 2, 'esports'), 1);
        assert.equal(getEffectiveEquipmentLevel('fireball', 5, 'esports'), 1);
    });

    await t.test('Standard mode preserves full natural levels', () => {
        assert.equal(getEffectiveEquipmentLevel('giant_arrow', 18, 'standard'), 18);
        assert.equal(getEffectiveEquipmentLevel('giant_arrow', 16, 'standard'), 16);
        assert.equal(getEffectiveEquipmentLevel('fireball', 27, 'standard'), 27);
        assert.equal(getEffectiveEquipmentLevel('spiky_ball', 25, 'standard'), 25);
    });

    await t.test('Fixed damage equipment is unpenalized under Legend I (-20% hero penalty)', () => {
        const fireballStandard = calculateEquipmentDamage('fireball', 27, 'eagle_artillery', 7, { leagueId: 'standard' });
        const fireballLegend1 = calculateEquipmentDamage('fireball', 27, 'eagle_artillery', 7, { leagueId: 'legend1' });
        assert.equal(fireballStandard.rawDamage, 4100);
        assert.equal(fireballLegend1.rawDamage, 4100); // Fixed ability damage is unpenalized
    });
});

test('Attack Sequence Simulator - Shared Diminishing Returns & Timing', async (t) => {
    await t.test('Consecutive Earthquake Spells apply diminishing returns formula', () => {
        const steps = [
            { type: 'spell', id: 'earthquake', level: 8, count: 2 },
            { type: 'spell', id: 'lightning', level: 13, count: 2 }
        ];

        const sim = simulateAttackSequence('eagle_artillery', 7, steps);
        const hp = getDefenseMaxHp('eagle_artillery', 7); // 6200

        // Step 1: Strike 1 deals 29% (1798 dmg)
        assert.equal(sim.timeline[0].strikeIndex, 1);
        assert.equal(sim.timeline[0].damageDealt, Math.floor(hp * 0.29));

        // Step 2: Strike 2 deals (29% / 3) = 9.667% (599 dmg)
        assert.equal(sim.timeline[1].strikeIndex, 2);
        assert.equal(sim.timeline[1].damageDealt, Math.floor(hp * (0.29 / 3)));

        // Step 3 & 4: Zaps deal 720 dmg each
        assert.equal(sim.timeline[2].damageDealt, 720);
        assert.equal(sim.timeline[3].damageDealt, 720);
    });

    await t.test('Builder repair restores hitpoints per hit based on hut level', () => {
        const expectedRates = { 1: 0, 2: 37.5, 3: 45.0, 4: 52.5, 5: 60.0, 6: 63.75, 7: 67.5, 8: 71.25, sc1: 71.25, sc2: 71.25 };
        for (const [lvl, rate] of Object.entries(expectedRates)) {
            assert.equal(BUILDER_REPAIR_PER_HIT[lvl], rate);
        }

        const steps = [
            { type: 'spell', id: 'lightning', level: 13, count: 2 }, // 1440 dmg
            { type: 'builder_repair', hutLevel: 8 },                    // Builder repairs 71.25 HP
            { type: 'spell', id: 'lightning', level: 13, count: 1 }
        ];

        const sim = simulateAttackSequence('inferno_tower', 12, steps);

        // Builder repair step repaired 71.25 HP
        const repairStep = sim.timeline[2];
        assert.equal(repairStep.type, 'builder_repair');
        assert.equal(repairStep.damageDealt, -71.25);
        assert.equal(repairStep.remainingHp, sim.initialHp - 1440 + 71.25);
    });

    await t.test('Subsequent steps skipped when target is destroyed', () => {
        const steps = [
            { type: 'equipment', id: 'giant_arrow', level: 18 }, // One-shots air defense (3000 dmg > 2000 hp)
            { type: 'spell', id: 'lightning', level: 13, count: 2 }
        ];

        const sim = simulateAttackSequence('air_defense', 16, steps);
        assert.equal(sim.isDestroyed, true);
        assert.equal(sim.timeline[0].isDestroyed, true);
        assert.equal(sim.timeline[1].skipped, true);
    });
});

test('Domain Math Purity & Exports', async (t) => {
    await t.test('Domain functions are pure and properly exported', () => {
        assert.equal(typeof solveZapQuakeCombinations, 'function');
        assert.equal(typeof calculateEquipmentDamage, 'function');
        assert.equal(typeof simulateAttackSequence, 'function');
        assert.equal(typeof solveAllDefensesZapQuake, 'function');
        assert.equal(typeof groupDefensesBySpellCombo, 'function');
        assert.equal(typeof simulateSequenceAcrossAllDefenses, 'function');
    });
});

test('Whole-Village ZapQuake Solutions & Combo Grouping', async (t) => {
    await t.test('solveAllDefensesZapQuake evaluates all 38 targets when unrestricted', () => {
        const all = solveAllDefensesZapQuake({ lightningLevel: 13, earthquakeLevel: 8 });
        assert.equal(all.length, 38);
        const ad = all.find(d => d.defenseKey === 'air_defense');
        assert.ok(ad);
        assert.equal(ad.bestCombo.isDestroyed, true);
        assert.ok(ad.bestCombo.housingSpace <= 4);
    });

    await t.test('groupDefensesBySpellCombo correctly groups by housing space', () => {
        const groups = groupDefensesBySpellCombo({ lightningLevel: 13, earthquakeLevel: 8 });
        assert.ok(groups.length > 0);
        for (let i = 1; i < groups.length; i++) {
            assert.ok(groups[i].housingSpace >= groups[i - 1].housingSpace);
        }
        for (const g of groups) {
            assert.ok(g.defenses.length > 0);
        }
    });

    await t.test('groupDefensesBySpellCombo appends remaining defenses bucket at the end when defenses survive', () => {
        // Only Fireball enabled (cannot destroy high HP structures like Monolith or Town Hall)
        const groups = groupDefensesBySpellCombo({
            townHallLevel: 18,
            enabledSpells: { lightning: false, earthquake: false, cc_lightning: false, cc_earthquake: false },
            enabledEquipment: [{ id: 'fireball', level: 27 }]
        });
        assert.ok(groups.length > 0);

        const remGroup = groups.at(-1);
        assert.ok(remGroup);
        assert.equal(remGroup.isRemaining, true);
        assert.equal(remGroup.key, 'remaining');
        assert.equal(remGroup.housingSpace, Infinity);
        assert.ok(remGroup.defenses.length > 0);

        // High HP and immune defenses should be in the remaining bucket
        const remKeys = remGroup.defenses.map(d => d.defenseKey);
        assert.ok(remKeys.includes('town_hall'), 'Town Hall must be in remaining group');
        assert.ok(remKeys.includes('clan_castle'), 'Clan Castle must be in remaining group');
        assert.ok(remKeys.includes('monolith'), 'Monolith must be in remaining group');

        // Defenses inside remaining bucket must be sorted by max HP descending
        for (let i = 1; i < remGroup.defenses.length; i++) {
            assert.ok(remGroup.defenses[i - 1].maxHp >= remGroup.defenses[i].maxHp);
        }

        // Respects includeRemaining: false
        const groupsNoRem = groupDefensesBySpellCombo({
            townHallLevel: 18,
            enabledSpells: { lightning: false, earthquake: false, cc_lightning: false, cc_earthquake: false },
            enabledEquipment: [{ id: 'fireball', level: 27 }],
            includeRemaining: false
        });
        assert.equal(groupsNoRem.some(g => g.isRemaining), false);
    });

    await t.test('solveAllDefensesZapQuake lifecycle: TH17 sunsets eagle artillery but retains cannon, archer tower and merged defenses', () => {
        const th17 = solveAllDefensesZapQuake({ townHallLevel: 17, lightningLevel: 13, earthquakeLevel: 8 });
        const keys = th17.map(d => d.defenseKey);

        assert.strictEqual(keys.includes('cannon'), true, 'Standard cannon must be included at TH17 (available till TH17)');
        assert.strictEqual(keys.includes('eagle_artillery'), false, 'Standalone eagle artillery must be excluded at TH17');
        assert.strictEqual(keys.includes('ricochet_cannon'), true, 'Ricochet cannon must be included at TH17');
        assert.strictEqual(keys.includes('multi_archer_tower'), true, 'Multi-archer tower must be included at TH17');
        assert.strictEqual(keys.includes('archer_tower'), true, 'Standard archer tower must remain at TH17');
        assert.strictEqual(keys.includes('super_wizard_tower'), false, 'Super wizard tower must be excluded at TH17');
        assert.equal(th17.length, 32, 'TH17 must have exactly 32 active targets');
    });

    await t.test('solveAllDefensesZapQuake lifecycle: TH18 sunsets cannon and eagle artillery but includes super wizard tower', () => {
        const th18 = solveAllDefensesZapQuake({ townHallLevel: 18, lightningLevel: 13, earthquakeLevel: 8 });
        const keys = th18.map(d => d.defenseKey);

        assert.strictEqual(keys.includes('cannon'), false, 'Standard cannon must be excluded at TH18');
        assert.strictEqual(keys.includes('eagle_artillery'), false, 'Standalone eagle artillery must be excluded at TH18');
        assert.strictEqual(keys.includes('super_wizard_tower'), true, 'Super wizard tower must be included at TH18');
        assert.equal(th18.length, 36, 'TH18 must have exactly 36 active targets');
    });

    await t.test('solveAllDefensesZapQuake lifecycle: TH16 has both merged and unmerged defenses plus eagle artillery', () => {
        const th16 = solveAllDefensesZapQuake({ townHallLevel: 16, lightningLevel: 13, earthquakeLevel: 8 });
        const keys = th16.map(d => d.defenseKey);

        assert.strictEqual(keys.includes('cannon'), true, 'Standard cannon must be included at TH16');
        assert.strictEqual(keys.includes('archer_tower'), true, 'Standard archer tower must be included at TH16');
        assert.strictEqual(keys.includes('eagle_artillery'), true, 'Eagle artillery must be included at TH16');
        assert.strictEqual(keys.includes('ricochet_cannon'), true, 'Ricochet cannon must be included at TH16');
        assert.strictEqual(keys.includes('multi_archer_tower'), true, 'Multi-archer tower must be included at TH16');
        assert.strictEqual(keys.includes('super_wizard_tower'), false, 'Super wizard tower must be excluded at TH16');
        assert.equal(th16.length, 31, 'TH16 must have exactly 31 active targets');
    });

    await t.test('solveAllDefensesZapQuake lifecycle: TH15 excludes all merged defenses', () => {
        const th15 = solveAllDefensesZapQuake({ townHallLevel: 15, lightningLevel: 13, earthquakeLevel: 8 });
        const keys = th15.map(d => d.defenseKey);

        assert.strictEqual(keys.includes('cannon'), true, 'Standard cannon must be included at TH15');
        assert.strictEqual(keys.includes('archer_tower'), true, 'Standard archer tower must be included at TH15');
        assert.strictEqual(keys.includes('eagle_artillery'), true, 'Eagle artillery must be included at TH15');
        assert.strictEqual(keys.includes('monolith'), true, 'Monolith must be included at TH15');
        assert.strictEqual(keys.includes('spell_tower'), true, 'Spell tower must be included at TH15');
        assert.strictEqual(keys.includes('ricochet_cannon'), false, 'Ricochet cannon must not exist at TH15');
        assert.strictEqual(keys.includes('multi_archer_tower'), false, 'Multi-archer tower must not exist at TH15');
        assert.strictEqual(keys.includes('super_wizard_tower'), false, 'Super wizard tower must not exist at TH15');
    });

    await t.test('solveAllDefensesZapQuake lifecycle: TH11 excludes TH13+ defenses', () => {
        const th11 = solveAllDefensesZapQuake({ townHallLevel: 11, lightningLevel: 13, earthquakeLevel: 8 });
        const keys = th11.map(d => d.defenseKey);

        assert.strictEqual(keys.includes('eagle_artillery'), true, 'Eagle artillery unlocks at TH11');
        assert.strictEqual(keys.includes('scattershot'), false, 'Scattershot must not exist at TH11');
        assert.strictEqual(keys.includes('monolith'), false, 'Monolith must not exist at TH11');
        assert.strictEqual(keys.includes('spell_tower'), false, 'Spell tower must not exist at TH11');
        assert.strictEqual(keys.includes('ricochet_cannon'), false, 'Ricochet cannon must not exist at TH11');
        assert.strictEqual(keys.includes('multi_archer_tower'), false, 'Multi-archer tower must not exist at TH11');
    });
});

test('Whole-Village Attack Sequence Simulator', async (t) => {
    await t.test('simulateSequenceAcrossAllDefenses executes on all 38 targets when unrestricted', () => {
        const steps = [{ type: 'spell', id: 'earthquake', level: 8, count: 1 }, { type: 'spell', id: 'lightning', level: 13, count: 6 }];
        const results = simulateSequenceAcrossAllDefenses(steps);
        assert.equal(results.length, 38);
        // Air defense (2000 HP) takes 1 EQ (~580) + 6 Zap (4320) -> should be destroyed
        const ad = results.find(d => d.defenseKey === 'air_defense');
        assert.ok(ad);
        assert.equal(ad.isDestroyed, true);
        assert.equal(ad.remainingHp, 0);
    });

    await t.test('simulateSequenceAcrossAllDefenses respects TH17 and TH18 lifecycle filtering', () => {
        const steps = [{ type: 'spell', id: 'earthquake', level: 8, count: 1 }, { type: 'spell', id: 'lightning', level: 13, count: 6 }];
        const results17 = simulateSequenceAcrossAllDefenses(steps, { townHallLevel: 17 });
        assert.equal(results17.length, 32);
        const keys17 = results17.map(d => d.defenseKey);
        assert.ok(keys17.includes('cannon') && !keys17.includes('eagle_artillery') && keys17.includes('ricochet_cannon'));

        const results18 = simulateSequenceAcrossAllDefenses(steps, { townHallLevel: 18 });
        assert.equal(results18.length, 36);
        const keys18 = results18.map(d => d.defenseKey);
        assert.ok(!keys18.includes('cannon') && !keys18.includes('eagle_artillery') && keys18.includes('super_wizard_tower'));
    });

    await t.test('filterDominatedCombos prunes redundant combos with higher spell counts', () => {
        assert.deepEqual(filterDominatedCombos([
            { eqCount: 1, zapCount: 3, equipment: [] },
            { eqCount: 2, zapCount: 3, equipment: [] },
            { eqCount: 2, zapCount: 2, equipment: [] },
            { eqCount: 3, zapCount: 2, equipment: [] },
            { eqCount: 0, zapCount: 3, equipment: [{ id: 'giant_arrow', level: 18 }] },
            { eqCount: 0, zapCount: 4, equipment: [{ id: 'giant_arrow', level: 18 }] }
        ]), [
            { eqCount: 1, zapCount: 3, equipment: [] },
            { eqCount: 2, zapCount: 2, equipment: [] },
            { eqCount: 0, zapCount: 3, equipment: [{ id: 'giant_arrow', level: 18 }] }
        ]);

        // Air Sweeper scenario: 0 EQ + 2 Zap strictly dominates 1 EQ + 2 Zap
        assert.deepEqual(filterDominatedCombos([
            { eqCount: 0, zapCount: 2, equipment: [] },
            { eqCount: 1, zapCount: 2, equipment: [] },
            { eqCount: 2, zapCount: 1, equipment: [] }
        ]), [
            { eqCount: 0, zapCount: 2, equipment: [] },
            { eqCount: 2, zapCount: 1, equipment: [] }
        ]);

        // Exact duplicates at identical levels: CC duplicate is pruned in favor of regular spell (EQ and Zap)
        assert.deepEqual(filterDominatedCombos([
            { eqCount: 1, regEqCount: 1, ccEqCount: 0, eqLevel: 8, ccEqLevel: 8, equipment: [] },
            { eqCount: 1, regEqCount: 0, ccEqCount: 1, eqLevel: 8, ccEqLevel: 8, equipment: [] }
        ]), [{ eqCount: 1, regEqCount: 1, ccEqCount: 0, eqLevel: 8, ccEqLevel: 8, equipment: [] }]);
        assert.deepEqual(filterDominatedCombos([
            { eqCount: 0, zapCount: 2, regZapCount: 2, ccZapCount: 0, lightningLevel: 13, ccLightningLevel: 13, equipment: [] },
            { eqCount: 0, zapCount: 2, regZapCount: 1, ccZapCount: 1, lightningLevel: 13, ccLightningLevel: 13, equipment: [] }
        ]), [{ eqCount: 0, zapCount: 2, regZapCount: 2, ccZapCount: 0, lightningLevel: 13, ccLightningLevel: 13, equipment: [] }]);

        // Different levels, tied count: lower-level option is kept, higher-level option is pruned
        assert.deepEqual(filterDominatedCombos([
            { eqCount: 1, regEqCount: 1, ccEqCount: 0, eqLevel: 7, ccEqLevel: 8, equipment: [] },
            { eqCount: 1, regEqCount: 0, ccEqCount: 1, eqLevel: 7, ccEqLevel: 8, equipment: [] }
        ]), [{ eqCount: 1, regEqCount: 1, ccEqCount: 0, eqLevel: 7, ccEqLevel: 8, equipment: [] }]);
        assert.deepEqual(filterDominatedCombos([
            { eqCount: 0, zapCount: 2, regZapCount: 2, ccZapCount: 0, lightningLevel: 10, ccLightningLevel: 11, equipment: [] },
            { eqCount: 0, zapCount: 2, regZapCount: 0, ccZapCount: 2, lightningLevel: 10, ccLightningLevel: 11, equipment: [] }
        ]), [{ eqCount: 0, zapCount: 2, regZapCount: 2, ccZapCount: 0, lightningLevel: 10, ccLightningLevel: 11, equipment: [] }]);
    });

    await t.test('getComboSignature produces deterministic unique signatures', () => {
        const sig1 = getComboSignature({ eqCount: 1, zapCount: 2, equipment: [] });
        assert.equal(sig1, '1eq_2zap__cc_0eq_0zap');
        const sig2 = getComboSignature({ eqCount: 0, zapCount: 1, equipment: [{ id: 'fireball', level: 27 }] });
        assert.equal(sig2, 'fireball_27__0eq_1zap__cc_0eq_0zap');
    });

    await t.test('groupDefensesBySpellCombo respects options.selectedCombos override', () => {
        const defaultGroups = groupDefensesBySpellCombo({ townHallLevel: 16, lightningLevel: 13, earthquakeLevel: 8 });
        assert.ok(defaultGroups.length > 0, 'Default groups must not be empty');
        const allDef = solveAllDefensesZapQuake({ townHallLevel: 16, lightningLevel: 13, earthquakeLevel: 8 });
        const ad = allDef.find(d => d.defenseKey === 'air_defense');
        assert.ok(ad && ad.allCombos.length > 1);

        // Pick an alternate valid combination for air_defense
        const altCombo = ad.allCombos[1];
        const altSig = getComboSignature(altCombo);

        const customGroups = groupDefensesBySpellCombo({
            townHallLevel: 16,
            lightningLevel: 13,
            earthquakeLevel: 8,
            selectedCombos: { air_defense: altSig }
        });

        // Find the group with altSig
        const targetGroup = customGroups.find(g => g.key === altSig);
        assert.ok(targetGroup, 'Target group matching custom selection must exist');
        const hasAd = targetGroup.defenses.some(d => d.defenseKey === 'air_defense');
        assert.equal(hasAd, true, 'Air Defense must be grouped under custom selected combo');
    });

    await t.test('New high-TH defenses have correct base and supercharge HP values', () => {
        // Firespitter
        assert.equal(getDefenseMaxHp('firespitter', 1), 4500);
        assert.equal(getDefenseMaxHp('firespitter', 3), 5300);
        assert.equal(getDefenseMaxHp('firespitter', 3, { superchargeTier: 1 }), 5300);
        assert.equal(getDefenseMaxHp('firespitter', 3, { superchargeTier: 2 }), 5550);

        // Multi Gear Tower
        assert.equal(getDefenseMaxHp('multi_gear_tower', 1), 4000);
        assert.equal(getDefenseMaxHp('multi_gear_tower', 3), 4350);
        assert.equal(getDefenseMaxHp('multi_gear_tower', 3, { superchargeTier: 1 }), 4350);
        assert.equal(getDefenseMaxHp('multi_gear_tower', 3, { superchargeTier: 2 }), 4500);

        // Revenge Tower
        assert.equal(getDefenseMaxHp('revenge_tower', 1), 5800);
        assert.equal(getDefenseMaxHp('revenge_tower', 2), 6200);
        assert.equal(getDefenseMaxHp('revenge_tower', 2, { superchargeTier: 1 }), 6200);
        assert.equal(getDefenseMaxHp('revenge_tower', 2, { superchargeTier: 2 }), 6300);
    });

    await t.test('Defending heroes and guardians have accurate hitpoints', () => {
        assert.equal(getDefenseMaxHp('barbarian_king', 110), 13350);
        assert.equal(getDefenseMaxHp('archer_queen', 110), 3576);
        assert.equal(getDefenseMaxHp('grand_warden', 85), 2669);
        assert.equal(getDefenseMaxHp('royal_champion', 55), 4298);
        assert.equal(getDefenseMaxHp('minion_prince', 95), 4510);
        assert.equal(getDefenseMaxHp('dragon_duke', 25), 10900);

        assert.equal(getDefenseMaxHp('smasher', 1), 12000);
        assert.equal(getDefenseMaxHp('smasher', 5), 16000);
        assert.equal(getDefenseMaxHp('logger', 5), 12000);
        assert.equal(getDefenseMaxHp('longshot', 5), 11000);
    });

    await t.test('Legend League HP scaling applies correctly to heroes and guardians, but not buildings', () => {
        const bkLvl = 50;
        const baseHp = getDefenseMaxHp('barbarian_king', bkLvl);

        // Standard: 0% boost
        assert.equal(getDefenseMaxHp('barbarian_king', bkLvl, { modifier: 'standard' }), baseHp);

        // Legend III: +10% hero, +5% guardian
        const l3Hero = getDefenseMaxHp('barbarian_king', bkLvl, { modifier: 'legend3' });
        assert.equal(l3Hero, Math.round(baseHp * 1.10));
        const l3Guardian = getDefenseMaxHp('smasher', 5, { modifier: 'legend3' });
        assert.equal(l3Guardian, Math.round(16000 * 1.05)); // 16800

        // Legend II: +15% hero, +10% guardian
        const l2Hero = getDefenseMaxHp('barbarian_king', bkLvl, { modifier: 'legend2' });
        assert.equal(l2Hero, Math.round(baseHp * 1.15));
        const l2Guardian = getDefenseMaxHp('smasher', 5, { modifier: 'legend2' });
        assert.equal(l2Guardian, Math.round(16000 * 1.10)); // 17600

        // Legend I & Esports: +20% hero, +20% guardian
        const l1Hero = getDefenseMaxHp('barbarian_king', bkLvl, { modifier: 'legend1' });
        assert.equal(l1Hero, Math.round(baseHp * 1.20));
        const l1Guardian = getDefenseMaxHp('smasher', 5, { modifier: 'legend1' });
        assert.equal(l1Guardian, Math.round(16000 * 1.20)); // 19200

        const esportsHero = getDefenseMaxHp('barbarian_king', bkLvl, { modifier: 'esports' });
        assert.equal(esportsHero, Math.round(baseHp * 1.20));

        // Standard defenses do NOT receive HP boosts in any league
        const adBase = getDefenseMaxHp('air_defense', 14);
        assert.equal(getDefenseMaxHp('air_defense', 14, { modifier: 'legend1' }), adBase);
        assert.equal(getDefenseMaxHp('air_defense', 14, { modifier: 'esports' }), adBase);
    });
});

test('Hero Defense Level Stepping & Snapping - Pure Domain Math', async (t) => {
    await t.test('isHeroDefense correctly identifies defending heroes and rejects standard defenses', () => {
        assert.equal(isHeroDefense('barbarian_king'), true);
        assert.equal(isHeroDefense('archer_queen'), true);
        assert.equal(isHeroDefense('grand_warden'), true);
        assert.equal(isHeroDefense('royal_champion'), true);
        assert.equal(isHeroDefense('minion_prince'), true);
        assert.equal(isHeroDefense('dragon_duke'), true);

        assert.equal(isHeroDefense('air_defense'), false);
        assert.equal(isHeroDefense('eagle_artillery'), false);
        assert.equal(isHeroDefense('smasher'), false);
        assert.equal(isHeroDefense('logger'), false);
        assert.equal(isHeroDefense('longshot'), false);
    });

    await t.test('getValidDefenseLevels returns level 1 and multiples of 5 for heroes', () => {
        const bkLevels = getValidDefenseLevels('barbarian_king', 110);
        assert.equal(bkLevels.length, 23);
        assert.equal(bkLevels[0], 1);
        assert.equal(bkLevels[1], 5);
        assert.equal(bkLevels[2], 10);
        assert.equal(bkLevels[22], 110);

        // Dragon Duke max 25
        const ddLevels = getValidDefenseLevels('dragon_duke', 25);
        assert.deepEqual(ddLevels, [1, 5, 10, 15, 20, 25]);

        // Standard defense produces consecutive levels 1..16
        const adLevels = getValidDefenseLevels('air_defense', 16);
        assert.equal(adLevels.length, 16);
        assert.deepEqual(adLevels, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    });

    await t.test('snapDefenseLevel correctly snaps hero levels to 1 or multiples of 5', () => {
        assert.equal(snapDefenseLevel('barbarian_king', 0), 1);
        assert.equal(snapDefenseLevel('barbarian_king', 1), 1);
        assert.equal(snapDefenseLevel('barbarian_king', 2), 1);
        assert.equal(snapDefenseLevel('barbarian_king', 3), 5);
        assert.equal(snapDefenseLevel('barbarian_king', 4), 5);
        assert.equal(snapDefenseLevel('barbarian_king', 5), 5);
        assert.equal(snapDefenseLevel('barbarian_king', 6), 5);
        assert.equal(snapDefenseLevel('barbarian_king', 7), 5);
        assert.equal(snapDefenseLevel('barbarian_king', 8), 10);
        assert.equal(snapDefenseLevel('barbarian_king', 12), 10);
        assert.equal(snapDefenseLevel('barbarian_king', 13), 15);
        assert.equal(snapDefenseLevel('barbarian_king', 110), 110);
        assert.equal(snapDefenseLevel('barbarian_king', 115, 110), 110);

        // Non-hero snaps to integer clamped between 1 and max
        assert.equal(snapDefenseLevel('air_defense', 0), 1);
        assert.equal(snapDefenseLevel('air_defense', 7), 7);
        assert.equal(snapDefenseLevel('air_defense', 18, 16), 16);
    });

    await t.test('getPrevDefenseLevel decrements hero levels in discrete 5-step chunks down to 1', () => {
        assert.equal(getPrevDefenseLevel('barbarian_king', 110), 105);
        assert.equal(getPrevDefenseLevel('barbarian_king', 10), 5);
        assert.equal(getPrevDefenseLevel('barbarian_king', 5), 1);
        assert.equal(getPrevDefenseLevel('barbarian_king', 1), 1);

        // Non-hero decrements by 1
        assert.equal(getPrevDefenseLevel('air_defense', 10), 9);
        assert.equal(getPrevDefenseLevel('air_defense', 1), 1);
    });

    await t.test('getNextDefenseLevel increments hero levels in discrete 5-step chunks up to cap', () => {
        assert.equal(getNextDefenseLevel('barbarian_king', 1, 110), 5);
        assert.equal(getNextDefenseLevel('barbarian_king', 5, 110), 10);
        assert.equal(getNextDefenseLevel('barbarian_king', 10, 110), 15);
        assert.equal(getNextDefenseLevel('barbarian_king', 105, 110), 110);
        assert.equal(getNextDefenseLevel('barbarian_king', 110, 110), 110);

        // Non-hero increments by 1
        assert.equal(getNextDefenseLevel('air_defense', 1, 16), 2);
        assert.equal(getNextDefenseLevel('air_defense', 15, 16), 16);
        assert.equal(getNextDefenseLevel('air_defense', 16, 16), 16);
    });
});

test('Equipment Targeting Validation - Seeking Shield, Spiky Ball, and Category Restrictions', async (t) => {
    const regularDefenses = [
        'air_defense', 'air_sweeper', 'inferno_tower', 'eagle_artillery', 'scattershot',
        'monolith', 'spell_tower', 'ricochet_cannon', 'multi_archer_tower', 'super_wizard_tower',
        'firespitter', 'multi_gear_tower', 'revenge_tower', 'x_bow', 'hidden_tesla',
        'wizard_tower', 'bomb_tower', 'mortar', 'cannon', 'archer_tower', 'builders_hut'
    ];
    const craftedDefenses = ['hot_candle', 'hero_hunter', 'cake_a_pult'];
    const townHallsAndCc = ['town_hall', 'clan_castle'];
    const resourceStorages = ['gold_storage', 'elixir_storage', 'dark_elixir_storage'];
    const heroes = ['barbarian_king', 'archer_queen', 'grand_warden', 'royal_champion', 'minion_prince', 'dragon_duke'];
    const guardians = ['smasher', 'logger', 'longshot'];

    await t.test('Seeking Shield only targets regular and crafted defenses', () => {
        for (const defKey of regularDefenses) {
            assert.equal(canEquipmentTarget('seeking_shield', defKey), true, `Seeking Shield should target regular defense: ${defKey}`);
        }
        for (const defKey of craftedDefenses) {
            assert.equal(canEquipmentTarget('seeking_shield', defKey), true, `Seeking Shield should target crafted defense: ${defKey}`);
        }
        for (const defKey of townHallsAndCc) {
            assert.equal(canEquipmentTarget('seeking_shield', defKey), false, `Seeking Shield must NOT target: ${defKey}`);
        }
        for (const defKey of resourceStorages) {
            assert.equal(canEquipmentTarget('seeking_shield', defKey), false, `Seeking Shield must NOT target storage: ${defKey}`);
        }
        for (const defKey of heroes) {
            assert.equal(canEquipmentTarget('seeking_shield', defKey), false, `Seeking Shield must NOT target hero: ${defKey}`);
        }
        for (const defKey of guardians) {
            assert.equal(canEquipmentTarget('seeking_shield', defKey), false, `Seeking Shield must NOT target guardian: ${defKey}`);
        }
    });

    await t.test('Spiky Ball only targets buildings of all types, excluding heroes and guardians', () => {
        for (const defKey of regularDefenses) {
            assert.equal(canEquipmentTarget('spiky_ball', defKey), true, `Spiky Ball should target regular defense: ${defKey}`);
        }
        for (const defKey of craftedDefenses) {
            assert.equal(canEquipmentTarget('spiky_ball', defKey), true, `Spiky Ball should target crafted defense: ${defKey}`);
        }
        for (const defKey of townHallsAndCc) {
            assert.equal(canEquipmentTarget('spiky_ball', defKey), true, `Spiky Ball should target: ${defKey}`);
        }
        for (const defKey of resourceStorages) {
            assert.equal(canEquipmentTarget('spiky_ball', defKey), true, `Spiky Ball should target storage: ${defKey}`);
        }
        for (const defKey of heroes) {
            assert.equal(canEquipmentTarget('spiky_ball', defKey), false, `Spiky Ball must NOT target hero: ${defKey}`);
        }
        for (const defKey of guardians) {
            assert.equal(canEquipmentTarget('spiky_ball', defKey), false, `Spiky Ball must NOT target guardian: ${defKey}`);
        }
    });

    await t.test('Universal equipment (Giant Arrow, Fireball, Rocket Backpack, Flame Blower) target all categories', () => {
        const universalEquip = ['giant_arrow', 'fireball', 'flame_blower', 'rocket_backpack'];
        const allEntities = [...regularDefenses, ...craftedDefenses, ...townHallsAndCc, ...resourceStorages, ...heroes, ...guardians];
        for (const eqId of universalEquip) {
            for (const entKey of allEntities) {
                assert.equal(canEquipmentTarget(eqId, entKey), true, `${eqId} should target ${entKey}`);
            }
        }
    });

    await t.test('calculateEquipmentTargetDamage returns 0 for invalid targets', () => {
        assert.equal(calculateEquipmentTargetDamage('seeking_shield', 18, 'town_hall', 10000), 0);
        assert.equal(calculateEquipmentTargetDamage('seeking_shield', 18, 'barbarian_king', 12000), 0);
        assert.equal(calculateEquipmentTargetDamage('seeking_shield', 18, 'clan_castle', 5000), 0);
        assert.equal(calculateEquipmentTargetDamage('spiky_ball', 27, 'barbarian_king', 12000), 0);
        assert.equal(calculateEquipmentTargetDamage('spiky_ball', 27, 'smasher', 8000), 0);

        assert.ok(calculateEquipmentTargetDamage('seeking_shield', 18, 'air_defense', 2000) > 0);
        assert.ok(calculateEquipmentTargetDamage('spiky_ball', 27, 'town_hall', 10000) > 0);
        assert.ok(calculateEquipmentTargetDamage('giant_arrow', 18, 'barbarian_king', 12000) > 0);
    });

    await t.test('calculateEquipmentDamage returns 0 damage and invalid_target note for invalid combinations', () => {
        const resShieldTH = calculateEquipmentDamage('seeking_shield', 18, 'town_hall', 18);
        assert.equal(resShieldTH.damageDealt, 0);
        assert.equal(resShieldTH.rawDamage, 0);
        assert.deepEqual(resShieldTH.specialNotes, ['invalid_target']);

        const resSpikyHero = calculateEquipmentDamage('spiky_ball', 27, 'barbarian_king', 100);
        assert.equal(resSpikyHero.damageDealt, 0);
        assert.equal(resSpikyHero.rawDamage, 0);
        assert.deepEqual(resSpikyHero.specialNotes, ['invalid_target']);
    });

    await t.test('solveZapQuakeCombinations filters out incompatible equipment from search space', () => {
        const enabledEquipment = [
            { id: 'seeking_shield', level: 18, rawLevel: 18 },
            { id: 'spiky_ball', level: 27, rawLevel: 27 },
            { id: 'giant_arrow', level: 18, rawLevel: 18 }
        ];

        const thSolution = solveZapQuakeCombinations('town_hall', 18, 13, 8, {
            enabledEquipment,
            townHallLevel: 18
        });
        for (const combo of thSolution.combinations) {
            if (combo.equipment) {
                for (const eq of combo.equipment) {
                    assert.notEqual(eq.id, 'seeking_shield', 'Seeking Shield must never appear in Town Hall solutions');
                }
            }
        }

        const bkSolution = solveZapQuakeCombinations('barbarian_king', 100, 13, 8, {
            enabledEquipment,
            townHallLevel: 18
        });
        for (const combo of bkSolution.combinations) {
            if (combo.equipment) {
                for (const eq of combo.equipment) {
                    assert.notEqual(eq.id, 'seeking_shield', 'Seeking Shield must never appear in Hero solutions');
                    assert.notEqual(eq.id, 'spiky_ball', 'Spiky Ball must never appear in Hero solutions');
                }
            }
        }
    });

    await t.test('Town Hall level-based targeting classification', async (subT) => {
        await subT.test('isTownHallDefenseLevel accurately identifies weaponized TH levels 12-17', () => {
            for (let lvl = 1; lvl <= 11; lvl++) {
                assert.equal(isTownHallDefenseLevel(lvl), false, `TH${lvl} is not a defense`);
            }
            for (let lvl = 12; lvl <= 17; lvl++) {
                assert.equal(isTownHallDefenseLevel(lvl), true, `TH${lvl} acts as a defense`);
            }
            assert.equal(isTownHallDefenseLevel(18), false, 'TH18 is not a defense');
            assert.equal(isTownHallDefenseLevel(null), false);
            assert.equal(isTownHallDefenseLevel(undefined), false);
            assert.equal(isTownHallDefenseLevel(NaN), false);
            assert.equal(isTownHallDefenseLevel(0), false);
            assert.equal(isTownHallDefenseLevel(19), false);
        });

        await subT.test('isDefensiveStructure accurately classifies structures and TH levels', () => {
            assert.equal(isDefensiveStructure('air_defense'), true);
            assert.equal(isDefensiveStructure('inferno_tower'), true);
            assert.equal(isDefensiveStructure('hot_candle'), true);
            assert.equal(isDefensiveStructure('clan_castle'), false);
            assert.equal(isDefensiveStructure('gold_storage'), false);
            assert.equal(isDefensiveStructure('barbarian_king'), false);
            assert.equal(isDefensiveStructure('smasher'), false);

            // Town hall without level specified returns false
            assert.equal(isDefensiveStructure('town_hall'), false);

            // Town hall with levels 1-11 returns false
            for (let lvl = 1; lvl <= 11; lvl++) {
                assert.equal(isDefensiveStructure('town_hall', lvl), false, `TH${lvl} is not a defense structure`);
                assert.equal(isDefensiveStructure('town_hall', { level: lvl }), false);
                assert.equal(isDefensiveStructure({ id: 'town_hall', level: lvl }), false);
            }

            // Town hall with levels 12-17 returns true
            for (let lvl = 12; lvl <= 17; lvl++) {
                assert.equal(isDefensiveStructure('town_hall', lvl), true, `TH${lvl} is a defense structure`);
                assert.equal(isDefensiveStructure('town_hall', { level: lvl }), true);
                assert.equal(isDefensiveStructure({ id: 'town_hall', level: lvl }), true);
            }

            // Town hall 18 returns false
            assert.equal(isDefensiveStructure('town_hall', 18), false, 'TH18 is not a defense structure');
            assert.equal(isDefensiveStructure('town_hall', { level: 18 }), false);
            assert.equal(isDefensiveStructure({ id: 'town_hall', level: 18 }), false);
        });

        await subT.test('canEquipmentTarget correctly classifies Town Hall by level', () => {
            // Seeking Shield
            for (let lvl = 1; lvl <= 11; lvl++) {
                assert.equal(canEquipmentTarget('seeking_shield', 'town_hall', lvl), false, `Seeking Shield cannot target TH${lvl}`);
            }
            for (let lvl = 12; lvl <= 17; lvl++) {
                assert.equal(canEquipmentTarget('seeking_shield', 'town_hall', lvl), true, `Seeking Shield can target TH${lvl}`);
            }
            assert.equal(canEquipmentTarget('seeking_shield', 'town_hall', 18), false, 'Seeking Shield cannot target TH18');

            // Spiky Ball targets all Town Hall levels 1-18
            for (let lvl = 1; lvl <= 18; lvl++) {
                assert.equal(canEquipmentTarget('spiky_ball', 'town_hall', lvl), true, `Spiky Ball targets TH${lvl}`);
            }

            // Universal equipment targets all Town Hall levels
            for (let lvl = 1; lvl <= 18; lvl++) {
                assert.equal(canEquipmentTarget('giant_arrow', 'town_hall', lvl), true);
                assert.equal(canEquipmentTarget('fireball', 'town_hall', lvl), true);
                assert.equal(canEquipmentTarget('flame_blower', 'town_hall', lvl), true);
                assert.equal(canEquipmentTarget('rocket_backpack', 'town_hall', lvl), true);
            }
        });

        await subT.test('calculateEquipmentDamage deals damage to TH12-17 and rejects TH1-11 and TH18 for Seeking Shield', () => {
            // TH16 is a valid target for Seeking Shield
            const resTH16 = calculateEquipmentDamage('seeking_shield', 18, 'town_hall', 16);
            assert.ok(resTH16.damageDealt > 0, 'Seeking Shield should deal damage to TH16');
            assert.equal(resTH16.specialNotes.includes('invalid_target'), false);

            // TH11 is an invalid target for Seeking Shield
            const resTH11 = calculateEquipmentDamage('seeking_shield', 18, 'town_hall', 11);
            assert.equal(resTH11.damageDealt, 0);
            assert.deepEqual(resTH11.specialNotes, ['invalid_target']);

            // TH18 is an invalid target for Seeking Shield
            const resTH18 = calculateEquipmentDamage('seeking_shield', 18, 'town_hall', 18);
            assert.equal(resTH18.damageDealt, 0);
            assert.deepEqual(resTH18.specialNotes, ['invalid_target']);

            // Spiky Ball deals damage across all levels
            const spikyTH16 = calculateEquipmentDamage('spiky_ball', 27, 'town_hall', 16);
            assert.ok(spikyTH16.damageDealt > 0);
            const spikyTH11 = calculateEquipmentDamage('spiky_ball', 27, 'town_hall', 11);
            assert.ok(spikyTH11.damageDealt > 0);
            const spikyTH18 = calculateEquipmentDamage('spiky_ball', 27, 'town_hall', 18);
            assert.ok(spikyTH18.damageDealt > 0);
        });

        await subT.test('Town Hall retains dedicated subCategory townhall and spell immunities', () => {
            assert.equal(getDefensesData().town_hall.subCategory, 'townhall');
            assert.equal(isTargetImmuneToSpell('town_hall', 'lightning'), true, 'Town Hall is immune to Lightning');
            assert.equal(isTargetImmuneToSpell('town_hall', 'earthquake'), false, 'Town Hall is vulnerable to Earthquake');
        });

        await subT.test('solveZapQuakeCombinations includes Seeking Shield for TH16 and excludes for TH11/TH18', () => {
            const enabledEquipment = [
                { id: 'seeking_shield', level: 18, rawLevel: 18 },
                { id: 'spiky_ball', level: 27, rawLevel: 27 }
            ];

            // TH16: Seeking Shield can be in combinations
            const th16Solution = solveZapQuakeCombinations('town_hall', 16, 13, 8, {
                enabledEquipment,
                townHallLevel: 16
            });
            const hasShieldTH16 = th16Solution.combinations.some(combo =>
                combo.equipment?.some(eq => eq.id === 'seeking_shield')
            );
            assert.equal(hasShieldTH16, true, 'Seeking Shield should be eligible for TH16 combinations');

            // TH18: Seeking Shield must NOT be in combinations
            const th18Solution = solveZapQuakeCombinations('town_hall', 18, 13, 8, {
                enabledEquipment,
                townHallLevel: 18
            });
            const hasShieldTH18 = th18Solution.combinations.some(combo =>
                combo.equipment?.some(eq => eq.id === 'seeking_shield')
            );
            assert.equal(hasShieldTH18, false, 'Seeking Shield must NOT be eligible for TH18 combinations');

            // TH11: Seeking Shield must NOT be in combinations
            const th11Solution = solveZapQuakeCombinations('town_hall', 11, 13, 8, {
                enabledEquipment,
                townHallLevel: 11
            });
            const hasShieldTH11 = th11Solution.combinations.some(combo =>
                combo.equipment?.some(eq => eq.id === 'seeking_shield')
            );
            assert.equal(hasShieldTH11, false, 'Seeking Shield must NOT be eligible for TH11 combinations');
        });
    });

    await t.test('Builder\'s Hut level limits and minTH specifications', async (st) => {
        await st.test('getMinDefenseLevel enforces floor of 2 for builders_hut and 1 for others', () => {
            assert.equal(getMinDefenseLevel('builders_hut'), 2);
            assert.equal(getMinDefenseLevel('air_defense'), 1);
            assert.equal(getMinDefenseLevel('eagle_artillery'), 1);
            assert.equal(getMinDefenseLevel('barbarian_king'), 1);
        });

        await st.test('builders_hut minTH is 14 and locks at lower Town Halls', () => {
            assert.equal(getDefensesData().builders_hut.minTH, 14);

            for (let th = 9; th <= 13; th++) {
                const info = getMaxDefenseLevelForTownHall('builders_hut', th);
                assert.equal(info.status, 'locked', `builders_hut must be locked at TH${th}`);
                assert.equal(info.level, 0);
            }

            const th14Info = getMaxDefenseLevelForTownHall('builders_hut', 14);
            assert.equal(th14Info.status, 'available');
            assert.equal(th14Info.level, 4);
        });

        await st.test('snapDefenseLevel clamps builders_hut level 1 to level 2', () => {
            assert.equal(snapDefenseLevel('builders_hut', 1), 2);
            assert.equal(snapDefenseLevel('builders_hut', 0), 2);
            assert.equal(snapDefenseLevel('builders_hut', -5), 2);
            assert.equal(snapDefenseLevel('builders_hut', 3), 3);
            assert.equal(snapDefenseLevel('builders_hut', 10), 8);
        });

        await st.test('getPrevDefenseLevel stops at level 2 for builders_hut', () => {
            assert.equal(getPrevDefenseLevel('builders_hut', 3), 2);
            assert.equal(getPrevDefenseLevel('builders_hut', 2), 2);
            assert.equal(getPrevDefenseLevel('builders_hut', 1), 2);
        });

        await st.test('getValidDefenseLevels starts at level 2 for builders_hut', () => {
            const valid = getValidDefenseLevels('builders_hut', 8);
            assert.deepEqual(valid, [2, 3, 4, 5, 6, 7, 8]);
            assert.equal(valid.includes(1), false, 'Level 1 must not be in valid levels for builders_hut');
        });
    });
});
