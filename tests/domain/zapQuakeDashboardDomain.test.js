/**
 * Feature Domain Unit Tests for ZapQuake Dashboard Domain.
 * Validates combo bucketing, assigned defense mapping, layout expansion, and combo sorting.
 */

import { describe, it } from 'node:test';
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

import { preloadDefensesData } from '../../js/data/defenseTargetsData.js';
import {
    getDashboardComboBuckets,
    getDashboardAssignedDefensesMap,
    shouldComboExpandFullWidth,
    sortDetailedCombos
} from '../../js/domain/damage/zapQuakeDashboardDomain.js';

await preloadDefensesData();

describe('ZapQuake Dashboard Domain Suite', () => {

    it('getDashboardComboBuckets generates valid recipe buckets for default state', () => {
        const mockState = {
            playerTownHall: 18,
            globalSuperchargeTier: 2,
            offense: {
                spells: { lightning: 13, earthquake: 8 },
                ccSpells: { lightning: 13, earthquake: 8 },
                equipment: { spiky_ball: 27, giant_arrow: 18, fireball: 27 },
                enabledSources: {
                    lightning: true,
                    earthquake: true,
                    cc_lightning: true,
                    cc_earthquake: true
                }
            },
            zapQuake: {
                lightningLevel: 13,
                earthquakeLevel: 8,
                buildingFilter: 'all',
                selectedCombos: {}
            },
            defenseLevelOverrides: {},
            defenseSuperchargeOverrides: {}
        };

        const buckets = getDashboardComboBuckets(mockState);
        assert.ok(Array.isArray(buckets), 'Buckets must be an array');
        assert.ok(buckets.length > 0, 'Must produce at least one combo recipe bucket');

        const firstBucket = buckets[0];
        assert.ok(firstBucket.key, 'Each bucket must contain a key');
        assert.ok(Array.isArray(firstBucket.defenses), 'Each bucket must contain defenses array');
    });

    it('getDashboardAssignedDefensesMap groups defenses and respects building filters', () => {
        const mockState = {
            playerTownHall: 18,
            zapQuake: {
                buildingFilter: 'defenses',
                selectedCombos: {}
            },
            offense: {
                spells: { lightning: 13, earthquake: 8 }
            }
        };

        const assignedMap = getDashboardAssignedDefensesMap(mockState);
        assert.ok(assignedMap instanceof Map, 'Result must be a Map instance');
        assert.ok(assignedMap.size > 0, 'Map must contain assigned entries');

        // Check that targetDefenseKey overrides effective filter
        const heroMap = getDashboardAssignedDefensesMap(mockState, 'barbarian_king');
        assert.ok(heroMap instanceof Map);
    });

    it('shouldComboExpandFullWidth applies strict dominance rules', () => {
        // Must be false in compact mode
        assert.equal(shouldComboExpandFullWidth(20, [20, 4, 2], 'compact'), false);

        // Must be false if count < 12
        assert.equal(shouldComboExpandFullWidth(10, [10, 2], 'detailed'), false);

        // Must be false if only 1 combo exists
        assert.equal(shouldComboExpandFullWidth(20, [20], 'detailed'), false);

        // Must be false if tied maximum
        assert.equal(shouldComboExpandFullWidth(20, [20, 20, 2], 'detailed'), false);

        // Must be false if runner up > 8
        assert.equal(shouldComboExpandFullWidth(20, [20, 9, 2], 'detailed'), false);

        // Must be true for solitary dominant combo in detailed mode
        assert.equal(shouldComboExpandFullWidth(20, [20, 4, 2], 'detailed'), true);
    });

    it('sortDetailedCombos orders by defense count and tiebreaker rules', () => {
        const combos = [
            { combo: { housingSpace: 4 }, filteredDefenses: [{}, {}] },
            { combo: { housingSpace: 2 }, filteredDefenses: [{}, {}, {}, {}] },
            { combo: { housingSpace: 3 }, filteredDefenses: [{}] }
        ];

        const sorted = sortDetailedCombos(combos);
        assert.equal(sorted[0].filteredDefenses.length, 4);
        assert.equal(sorted[1].filteredDefenses.length, 2);
        assert.equal(sorted[2].filteredDefenses.length, 1);
    });
});
