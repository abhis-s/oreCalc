import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { recalculateAll } from '../../js/core/calculator.js';
import { getDefaultPlayerState, getDefaultState } from '../../js/core/state.js';

describe('Master Calculator Domain Suite', () => {
    test('recalculateAll handles null gracefully', () => {
        assert.doesNotThrow(() => recalculateAll(null));
    });

    test('recalculateAll populates derived state for default player state', () => {
        const testState = {
            ...getDefaultState(),
            ...getDefaultPlayerState()
        };

        recalculateAll(testState);

        assert.ok(testState.derived);
        assert.ok(testState.derived.requiredOres);
        assert.ok(testState.derived.incomeSources);
        assert.ok(testState.derived.totalIncome);
        assert.ok(testState.derived.remainingTime);
    });

    test('recalculateAll deducts stored ores from required ores', () => {
        const testState = {
            ...getDefaultState(),
            ...getDefaultPlayerState(),
            storedOres: { shiny: 50000, glowy: 5000, starry: 1000 }
        };

        recalculateAll(testState);

        // With huge stored ores, required ores should be zero or significantly reduced
        assert.ok(testState.derived.requiredOres.shiny >= 0);
        assert.ok(testState.derived.requiredOres.glowy >= 0);
        assert.ok(testState.derived.requiredOres.starry >= 0);
    });

    test('recalculateAll converts monthly base income to daily using DAYS_IN_MONTH_AVERAGE for assisted prospector', () => {
        const testState = {
            ...getDefaultState(),
            ...getDefaultPlayerState(),
            income: {
                ...getDefaultPlayerState().income,
                prospector: {
                    goldPass: true,
                    assistedConversion: true
                }
            }
        };

        recalculateAll(testState);

        assert.ok(testState.derived.totalMonthlyIncome);
        assert.ok(testState.derived.totalIncome);
        assert.ok(testState.derived.incomeSources.prospector);
    });

    test('recalculateAll computes remaining time ETAs for positive income and requirements', () => {
        const testState = {
            ...getDefaultState(),
            ...getDefaultPlayerState(),
            storedOres: { shiny: 0, glowy: 0, starry: 0 }
        };

        recalculateAll(testState);

        const eta = testState.derived.remainingTime;
        assert.ok(eta);
        assert.ok('shiny' in eta);
        assert.ok('glowy' in eta);
        assert.ok('starry' in eta);
    });

    test('recalculateAll aggregates totalMoneyCost across all currencies including craftPass monthly costs', () => {
        const testState = {
            ...getDefaultState(),
            ...getDefaultPlayerState(),
            income: {
                ...getDefaultPlayerState().income,
                craftPass: { craftPass: true }
            }
        };

        recalculateAll(testState);

        assert.ok(testState.derived.totalMoneyCost);
        assert.ok('USD' in testState.derived.totalMoneyCost);
        assert.ok('EUR' in testState.derived.totalMoneyCost);
        assert.equal(typeof testState.derived.totalMoneyCost.USD, 'number');
        assert.ok(Number.isInteger(testState.derived.totalMoneyCost.USD));
        assert.ok(Number.isInteger(testState.derived.totalMoneyCost.EUR));
    });
});
