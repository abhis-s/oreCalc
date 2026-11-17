import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '../../js/core/state.js';
import { calculateCompletionDates } from '../../js/utils/predictionCalculator.js';

describe('Prediction Calculator Domain Suite', () => {
    beforeEach(() => {
        state.storedOres = { shiny: 10000, glowy: 1000, starry: 100 };
        state.playerProfile = { townHallLevel: 16 };
        state.heroes = {
            BarbarianKing: {
                level: 95,
                equipment: {
                    barbarianPuppet: { level: 1, active: true },
                    rageVial: { level: 1, active: true },
                    giantGauntlet: { level: 1, active: false }
                }
            }
        };
        state.planner = {
            calendar: {
                dates: {},
                customChipData: {}
            }
        };
    });

    test('calculateCompletionDates returns empty predictions and suggestions for empty list', () => {
        const result = calculateCompletionDates([]);
        assert.deepEqual(result.predictions, []);
        assert.deepEqual(result.suggestions, []);
    });

    test('flags sequence error when an item has step index less than or equal to previous step for same equipment', () => {
        const priorityList = [
            { heroName: 'BarbarianKing', name: 'rageVial', step: 2, targetLevel: 6 },
            { heroName: 'BarbarianKing', name: 'rageVial', step: 1, targetLevel: 3 }
        ];

        const result = calculateCompletionDates(priorityList);
        assert.equal(result.predictions.length, 2);
        assert.equal(result.predictions[1].error, true);
    });

    test('calculates completion date for an affordable upgrade using stored ores immediately', () => {
        // Upgrading rageVial from 1 to 2 costs only 120 Shiny, 0 Glowy, 0 Starry
        state.storedOres = { shiny: 5000, glowy: 500, starry: 50 };
        const priorityList = [
            { heroName: 'BarbarianKing', name: 'rageVial', step: 1, targetLevel: 2 }
        ];

        const result = calculateCompletionDates(priorityList);
        assert.equal(result.predictions.length, 1);
        assert.ok(result.predictions[0].completionDate instanceof Date);
        assert.equal(result.predictions[0].requiredOres.shiny, 120);
        // Includes daily income accrued on simulation day 1 minus upgrade cost
        assert.ok(result.predictions[0].oresPostCompletion.shiny > 5000 - 120);
    });

    test('simulates future calendar dates when stored ores are insufficient', () => {
        state.storedOres = { shiny: 0, glowy: 0, starry: 0 };
        const priorityList = [
            { heroName: 'BarbarianKing', name: 'rageVial', step: 1, targetLevel: 5 }
        ];

        const result = calculateCompletionDates(priorityList);
        assert.equal(result.predictions.length, 1);
        assert.ok(result.predictions[0].completionDate instanceof Date);
        const now = new Date();
        assert.ok(result.predictions[0].completionDate.getTime() >= now.getTime());
    });

    test('detects starry bottleneck for epic equipment when shiny and glowy are ready but starry is not', () => {
        // Giant Gauntlet is epic, requires starry ore at levels 9, 12, 15, 18, 21, 24, 27
        state.storedOres = { shiny: 50000, glowy: 5000, starry: 0 };
        const priorityList = [
            { heroName: 'BarbarianKing', name: 'giantGauntlet', step: 1, targetLevel: 9 }
        ];

        const result = calculateCompletionDates(priorityList);
        assert.equal(result.predictions.length, 1);
        assert.equal(result.predictions[0].bottleneckOre, 'starry');
    });
});
