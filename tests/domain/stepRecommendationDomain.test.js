import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateStepRecommendation,
    getDefaultLevels,
    calculateStepBounds,
    calculateUpgradePlanPriorities
} from '../../js/domain/planner/stepRecommendationDomain.js';

describe('Step Recommendation & Priority Index Domain Suite', () => {
    test('calculateStepRecommendation returns next multiple of 3 above lower bound', () => {
        // Common equipment max 18
        assert.equal(calculateStepRecommendation(1, 1, 1, 18, 'common'), 9);
        assert.equal(calculateStepRecommendation(1, 9, 9, 18, 'common'), 12);
        assert.equal(calculateStepRecommendation(2, 12, 1, 18, 'common'), 15);
        // Step 3 always returns maxLevel
        assert.equal(calculateStepRecommendation(3, 15, 1, 18, 'common'), 18);
        // Exhausted bounds return 0
        assert.equal(calculateStepRecommendation(1, 18, 18, 18, 'common'), 0);
    });

    test('getDefaultLevels derives progressive milestone triples for common and epic equipment', () => {
        const commonDefaults = getDefaultLevels(1, 1, 18, 'common');
        assert.equal(commonDefaults.defaultLevel1, 9);
        assert.equal(commonDefaults.defaultLevel2, 12);
        assert.equal(commonDefaults.defaultLevel3, 18);

        const epicDefaults = getDefaultLevels(1, 1, 27, 'epic');
        assert.equal(epicDefaults.defaultLevel1, 9);
        assert.equal(epicDefaults.defaultLevel2, 18);
        assert.equal(epicDefaults.defaultLevel3, 27);
    });

    test('calculateStepBounds calculates valid min and max boundaries for each step', () => {
        const bounds1 = calculateStepBounds(1, 0, 1, 18);
        assert.equal(bounds1.minVal, 9);
        assert.equal(bounds1.maxVal, 18);

        const bounds2 = calculateStepBounds(2, 9, 1, 18);
        assert.equal(bounds2.minVal, 10);
        assert.equal(bounds2.maxVal, 18);
    });

    test('calculateUpgradePlanPriorities allocates sequential priorities when no old plan exists', () => {
        const rawUiSteps = [
            { stepKey: '1', level: 9, enabled: true },
            { stepKey: '2', level: 15, enabled: true },
            { stepKey: '3', level: 18, enabled: true }
        ];

        const plan = calculateUpgradePlanPriorities({}, rawUiSteps, 5);
        assert.ok(plan);
        assert.equal(plan['1'].priorityIndex, 6);
        assert.equal(plan['2'].priorityIndex, 7);
        assert.equal(plan['3'].priorityIndex, 8);
    });

    test('calculateUpgradePlanPriorities preserves matching old step priority index when N_new <= N_old', () => {
        const oldPlan = {
            '1': { targetLevel: 9, enabled: true, priorityIndex: 2 },
            '2': { targetLevel: 18, enabled: true, priorityIndex: 4 }
        };
        const rawUiSteps = [
            { stepKey: '1', level: 9, enabled: true },
            { stepKey: '2', level: 18, enabled: true }
        ];

        const plan = calculateUpgradePlanPriorities(oldPlan, rawUiSteps, 10);
        assert.ok(plan);
        assert.equal(plan['1'].priorityIndex, 2);
        assert.equal(plan['2'].priorityIndex, 4);
    });

    test('calculateUpgradePlanPriorities handles N_new > N_old >= 3 without throwing and ensures positive indices', () => {
        const oldPlan = {
            '1': { targetLevel: 6, enabled: true, priorityIndex: 1 },
            '2': { targetLevel: 9, enabled: true, priorityIndex: 2 },
            '3': { targetLevel: 12, enabled: true, priorityIndex: 3 }
        };
        const rawUiSteps = [
            { stepKey: '1', level: 6, enabled: true },
            { stepKey: '2', level: 9, enabled: true },
            { stepKey: '3', level: 12, enabled: true },
            { stepKey: '4', level: 15, enabled: true }
        ];

        const plan = calculateUpgradePlanPriorities(oldPlan, rawUiSteps, 10);
        assert.ok(plan);
        assert.ok(plan['1'].priorityIndex > 0);
        assert.ok(plan['2'].priorityIndex > 0);
        assert.ok(plan['3'].priorityIndex > 0);
        assert.ok(plan['4'].priorityIndex > 0);
    });
});
