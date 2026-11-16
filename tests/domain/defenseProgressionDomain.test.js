/**
 * Test Suite: Defense Progression Domain
 * Feature Domain: Damage Calculator Defense Hitpoints, Levels & Supercharge Tiers
 *
 * Verifies hitpoint resolution, level snapping, supercharge progression,
 * seasonal defense availability, building group partitioning, and display sorting.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
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

import { MAX_TOWN_HALL } from '../../js/core/constants.js';
import { preloadDefensesData, getDefensesData } from '../../js/data/defenseTargetsData.js';
import {
    isTownHallDefenseLevel,
    isDefensiveStructure,
    canEquipmentTarget,
    isUnitTarget,
    getDefenseMaxHp,
    getMaxSuperchargeTier,
    getMaxSuperchargeTierForTownHall,
    isSuperchargeAvailableForTownHall,
    getMaxDefenseLevelForTownHall,
    isClusterDefenseSunsetForTownHall,
    isDefenseInSeason,
    getDefaultSuperchargeTier,
    isHeroDefense,
    getMinDefenseLevel,
    getValidDefenseLevels,
    snapDefenseLevel,
    getPrevDefenseLevel,
    getNextDefenseLevel,
    getDefenseCategoryTier,
    getBuildingGroupId,
    partitionDefensesForModal,
    compareDefensesForDisplay
} from '../../js/domain/damage/defenseProgressionDomain.js';

await preloadDefensesData();

test('Defense Hitpoints Resolution (getDefenseMaxHp)', () => {
    // Air Defense Level 11 base HP
    const baseHp = getDefenseMaxHp('air_defense', 11);
    assert.equal(baseHp, 1500, 'Air Defense Level 11 should have 1500 HP');

    // Eagle Artillery Level 6 base HP
    const eagleHp = getDefenseMaxHp('eagle_artillery', 6);
    assert.equal(eagleHp, 5900, 'Eagle Artillery Level 6 should have 5900 HP');

    // Unknown defense fallback
    assert.equal(getDefenseMaxHp('nonexistent_defense', 1), 0, 'Unknown defense returns 0 HP');

    // Invalid level fallback
    assert.equal(getDefenseMaxHp('air_defense', 99), 0, 'Invalid level returns 0 HP');
});

test('Supercharge Tier Calculations (getMaxSuperchargeTier & getDefaultSuperchargeTier)', () => {
    // Supercharge max tier at active max TH vs lower TH
    assert.equal(getMaxSuperchargeTierForTownHall(MAX_TOWN_HALL), 2, `TH${MAX_TOWN_HALL} supports up to Tier 2 supercharges`);
    assert.equal(getMaxSuperchargeTierForTownHall(MAX_TOWN_HALL - 1), 0, `TH${MAX_TOWN_HALL - 1} does not support supercharges`);
    assert.equal(getMaxSuperchargeTierForTownHall(16), 0, 'TH16 does not support supercharges');

    // Max level defense vs non-max level defense
    const defs = getDefensesData();
    const infMaxLvl = defs.inferno_tower.maxLevel;
    assert.equal(getMaxSuperchargeTier('inferno_tower', infMaxLvl - 1), 0, 'Non-max level defense has 0 supercharge tiers');

    // Default supercharge tier for active max TH
    const defaultTier = getDefaultSuperchargeTier('inferno_tower', infMaxLvl, MAX_TOWN_HALL);
    assert.ok(defaultTier >= 0 && defaultTier <= 3, 'Default supercharge tier is bounded between 0 and 3');

    // Below max TH defaults to 0
    assert.equal(getDefaultSuperchargeTier('inferno_tower', infMaxLvl, 16), 0, 'TH16 default supercharge tier is 0');
});

test('Town Hall Level Progression Caps (getMaxDefenseLevelForTownHall)', () => {
    const info17 = getMaxDefenseLevelForTownHall('air_defense', 17);
    assert.equal(info17.status, 'available');
    assert.ok(info17.level >= 13, 'Air defense is available at TH17');

    const infoTH9 = getMaxDefenseLevelForTownHall('eagle_artillery', 9);
    assert.equal(infoTH9.status, 'locked', 'Eagle Artillery is locked at TH9');
});

test('Seasonal Defense In-Season Filtering (isDefenseInSeason)', () => {
    // Permanent defenses are always in season
    assert.equal(isDefenseInSeason('air_defense'), true, 'Air defense is always in season');
    assert.equal(isDefenseInSeason('eagle_artillery'), true, 'Eagle artillery is always in season');

    // Non-existent key returns false
    assert.equal(isDefenseInSeason('unknown_building_xyz'), false, 'Unknown building is not in season');
});

test('Discrete Level Stepping & Snapping', () => {
    const validLevels = getValidDefenseLevels('air_defense', 5);
    assert.deepEqual(validLevels, [1, 2, 3, 4, 5], 'Valid levels should step sequentially');

    const snapped = snapDefenseLevel('air_defense', 3.4, 5);
    assert.equal(snapped, 3, 'Level 3.4 snaps to nearest valid level 3');

    const prevLvl = getPrevDefenseLevel('air_defense', 4);
    assert.equal(prevLvl, 3, 'Previous level of 4 is 3');

    const nextLvl = getNextDefenseLevel('air_defense', 3, 5);
    assert.equal(nextLvl, 4, 'Next level of 3 capped at 5 is 4');

    const nextLvlCapped = getNextDefenseLevel('air_defense', 5, 5);
    assert.equal(nextLvlCapped, 5, 'Next level of 5 capped at 5 is 5');
});

test('Building Group ID and Category Tiers', () => {
    assert.equal(getBuildingGroupId('air_defense', 17), 'defenses');
    assert.equal(getBuildingGroupId('barbarian_king', 17), 'heroes');
    assert.equal(getBuildingGroupId('town_hall', 17), 'defenses');

    const tierAD = getDefenseCategoryTier('air_defense', getDefensesData().air_defense);
    assert.ok(tierAD >= 0, 'Air defense has valid category tier');
});

test('Modal Defense Partitioning and Sorting', () => {
    const { defenses, unavailable } = partitionDefensesForModal(17);
    assert.ok(defenses.length > 0, 'Defenses partition is populated');
    assert.ok(Array.isArray(unavailable), 'Unavailable defenses partition is an array');

    // Comparison for display
    const cmp = compareDefensesForDisplay('air_defense', getDefensesData().air_defense, 'cannon', getDefensesData().cannon, 17);
    assert.equal(typeof cmp, 'number', 'compareDefensesForDisplay returns number');
});

test('Target Capability & Structure Predicates', () => {
    assert.equal(isDefensiveStructure('air_defense', 11), true);
    assert.equal(isTownHallDefenseLevel(11), false);
    assert.equal(isTownHallDefenseLevel(12), true);
    assert.equal(canEquipmentTarget('giant_arrow', 'air_defense'), true);
    assert.equal(isUnitTarget('air_defense'), false);
    assert.equal(isUnitTarget('barbarian_king'), true);
    assert.equal(isHeroDefense('barbarian_king'), true);
    assert.equal(isHeroDefense('air_defense'), false);
    assert.ok(getMinDefenseLevel('air_defense') >= 1);
});

test('Supercharge Town Hall Availability (isSuperchargeAvailableForTownHall)', () => {
    assert.equal(isSuperchargeAvailableForTownHall(), true);
    assert.equal(isSuperchargeAvailableForTownHall(MAX_TOWN_HALL), true);
    assert.equal(isSuperchargeAvailableForTownHall(MAX_TOWN_HALL + 1), true);
    assert.equal(isSuperchargeAvailableForTownHall(MAX_TOWN_HALL - 1), false);
    assert.equal(isSuperchargeAvailableForTownHall(17), false);
});

test('Cluster Planner Sunset Lifecycle (isClusterDefenseSunsetForTownHall)', () => {
    const defs = getDefensesData();

    // Eagle Artillery stays active through TH16 and sunsets post-TH16 (TH17+)
    assert.equal(isClusterDefenseSunsetForTownHall('eagle_artillery', 11), false);
    assert.equal(isClusterDefenseSunsetForTownHall('eagle_artillery', 16), false);
    assert.equal(isClusterDefenseSunsetForTownHall(defs.eagle_artillery, 16), false);
    assert.equal(isClusterDefenseSunsetForTownHall('eagle_artillery', 17), true);
    assert.equal(isClusterDefenseSunsetForTownHall('eagle_artillery', 19), true);

    // Cannon sunsets immediately on TH17
    assert.equal(isClusterDefenseSunsetForTownHall('cannon', 16), false);
    assert.equal(isClusterDefenseSunsetForTownHall('cannon', 17), true);
    assert.equal(isClusterDefenseSunsetForTownHall(defs.cannon, 17), true);
    assert.equal(isClusterDefenseSunsetForTownHall('cannon', 18), true);

    // Archer Tower and Scattershot remain through TH18 and sunset immediately on TH19
    assert.equal(isClusterDefenseSunsetForTownHall('archer_tower', 18), false);
    assert.equal(isClusterDefenseSunsetForTownHall('archer_tower', 19), true);
    assert.equal(isClusterDefenseSunsetForTownHall('scattershot', 18), false);
    assert.equal(isClusterDefenseSunsetForTownHall('scattershot', 19), true);

    // Permanent non-sunset buildings always return false
    assert.equal(isClusterDefenseSunsetForTownHall('air_defense', 19), false);
    assert.equal(isClusterDefenseSunsetForTownHall('wizard_tower', 19), false);
    assert.equal(isClusterDefenseSunsetForTownHall('firecracker_tower', 19), false);
});
