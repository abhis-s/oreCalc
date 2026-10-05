/**
 * Feature Domain Test Suite: ZapQuake Combination Partitioning & Collapsing Logic.
 * Verifies that combinations taking 6 or more spells are cleanly classified as non-optimal
 * and segregated from the primary optimal combinations counter.
 */

import { test, describe } from 'node:test';
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
    solveZapQuakeCombinations,
    filterDominatedCombos,
    partitionOptimalCombos
} from '../../js/domain/damage/zapQuakeSolver.js';
await preloadDefensesData();

describe('ZapQuake Combination Partitioning (6+ Spell Collapsing)', () => {
    test('partitionOptimalCombos handles invalid or empty inputs gracefully', () => {
        assert.deepEqual(partitionOptimalCombos(null), { optimal: [], nonOptimal: [] });
        assert.deepEqual(partitionOptimalCombos(undefined), { optimal: [], nonOptimal: [] });
        assert.deepEqual(partitionOptimalCombos([]), { optimal: [], nonOptimal: [] });
        assert.deepEqual(partitionOptimalCombos('invalid'), { optimal: [], nonOptimal: [] });
    });

    test('partitionOptimalCombos correctly partitions based on custom threshold', () => {
        const sampleCombos = [
            { totalHousingSpace: 0, eqCount: 0, zapCount: 0 },
            { totalHousingSpace: 2, eqCount: 1, zapCount: 1 },
            { totalHousingSpace: 5, eqCount: 1, zapCount: 4 },
            { totalHousingSpace: 6, eqCount: 1, zapCount: 5 },
            { totalHousingSpace: 7, eqCount: 1, zapCount: 6 },
            { totalHousingSpace: 10, eqCount: 2, zapCount: 8 }
        ];

        const { optimal, nonOptimal } = partitionOptimalCombos(sampleCombos, 6);

        assert.equal(optimal.length, 3);
        assert.deepEqual(optimal.map(c => c.totalHousingSpace), [0, 2, 5]);

        assert.equal(nonOptimal.length, 3);
        assert.deepEqual(nonOptimal.map(c => c.totalHousingSpace), [6, 7, 10]);
    });

    test('Scattershot Level 7 Supercharge 2 with all sources partitions into 52 optimal and 9 non-optimal combinations', () => {
        const solverOpts = {
            superchargeTier: 2,
            townHallLevel: 18,
            enabledSpells: {
                lightning: true,
                earthquake: true,
                cc_lightning: true,
                cc_earthquake: true
            },
            enabledEquipment: [
                { id: 'spiky_ball', level: 27 },
                { id: 'giant_arrow', level: 18 },
                { id: 'seeking_shield', level: 18 },
                { id: 'fireball', level: 27 },
                { id: 'flame_blower', level: 18 },
                { id: 'rocket_backpack', level: 27 }
            ],
            ccSpells: {
                lightning: 13,
                earthquake: 8
            }
        };

        const solution = solveZapQuakeCombinations('scattershot', 7, 13, 8, solverOpts);
        const nonDominated = filterDominatedCombos(solution.combinations || []);

        assert.equal(nonDominated.length, 61, 'Total Pareto frontier combinations for Scattershot L7 SC2 must be 61');

        const { optimal, nonOptimal } = partitionOptimalCombos(nonDominated, 6);

        assert.equal(optimal.length, 52, 'Exactly 52 combinations use < 6 spells and qualify as optimal');
        assert.equal(nonOptimal.length, 9, 'Exactly 9 combinations take >= 6 spells and qualify as non-optimal');

        // Verify that every single optimal combo requires strictly fewer than 6 spells
        for (const combo of optimal) {
            const space = combo.totalHousingSpace ?? (combo.eqCount + combo.zapCount);
            assert.ok(space < 6, `Optimal combo must have space < 6, received ${space}`);
        }

        // Verify that every single non-optimal combo requires 6 or more spells
        for (const combo of nonOptimal) {
            const space = combo.totalHousingSpace ?? (combo.eqCount + combo.zapCount);
            assert.ok(space >= 6, `Non-optimal combo must have space >= 6, received ${space}`);
        }

        // Verify pure equipment combos are classified as optimal (0 spells used)
        const pureEquip = optimal.filter(c => c.totalHousingSpace === 0);
        assert.equal(pureEquip.length, 8, 'All 8 pure equipment combinations (4 pairs + 4 triplets from up to 2 heroes) must be in optimal');

        // Verify heavy 8-EQ and 12-EQ non-optimal combinations are in non-optimal
        const heavyEq = nonOptimal.filter(c => c.eqCount >= 8);
        assert.ok(heavyEq.length >= 2, 'Extreme Earthquake combos (8+ EQ) must reside in non-optimal group');
    });

    test('Zero optimal combinations edge case (pure spells on Scattershot without equipment)', () => {
        const solverOpts = {
            superchargeTier: 2,
            townHallLevel: 18,
            enabledSpells: {
                lightning: true,
                earthquake: true,
                cc_lightning: true,
                cc_earthquake: true
            },
            enabledEquipment: [],
            ccSpells: {
                lightning: 13,
                earthquake: 8
            }
        };

        const solution = solveZapQuakeCombinations('scattershot', 7, 13, 8, solverOpts);
        const nonDominated = filterDominatedCombos(solution.combinations || []);

        assert.equal(nonDominated.length, 3, 'Pure ZapQuake on Scattershot produces 3 Pareto combos: 6Z+1E, 5Z+3E, 9Z');

        const { optimal, nonOptimal } = partitionOptimalCombos(nonDominated, 6);

        assert.equal(optimal.length, 0, 'Zero pure spell combinations use < 6 spells for 5,950 HP Scattershot');
        assert.equal(nonOptimal.length, 3, 'All 3 pure spell combinations take >= 6 spells (7, 8, and 9 spells)');
    });

    test('Low-HP defense where all combinations qualify as optimal (Air Defense)', () => {
        const solverOpts = {
            townHallLevel: 18,
            enabledSpells: {
                lightning: true,
                earthquake: true,
                cc_lightning: true,
                cc_earthquake: true
            },
            enabledEquipment: [],
            ccSpells: {
                lightning: 13,
                earthquake: 8
            }
        };

        const solution = solveZapQuakeCombinations('air_defense', 15, 13, 8, solverOpts);
        const nonDominated = filterDominatedCombos(solution.combinations || []);

        const { optimal, nonOptimal } = partitionOptimalCombos(nonDominated, 6);

        assert.ok(optimal.length > 0, 'Air Defense must have optimal combinations');
        assert.equal(nonOptimal.length, 0, 'Air Defense must have 0 non-optimal combos taking >= 6 spells');
    });
});
