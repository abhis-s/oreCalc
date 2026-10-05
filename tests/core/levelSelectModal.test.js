import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
    calculateStepBounds,
    calculateStepRecommendation,
    getDefaultLevels,
    calculateUpgradePlanPriorities
} from '../../js/domain/planner/stepRecommendationDomain.js';
import { getEquipmentRecommendedLevel } from '../../js/components/planner/levelSelectModal.js';

describe('Level Select Modal Dynamic Stepping & Exhaustion Logic', () => {
    test('calculateStepBounds enforces lower bound and falls back to default range without inverting', () => {
        // Step 1: bounds default to Math.max(9, currentLevel + 1) to maxLevel
        assert.deepEqual(calculateStepBounds(1, 0, 1, 27), { minVal: 9, maxVal: 27, isPrecedingMaxed: false });
        assert.deepEqual(calculateStepBounds(1, 0, 12, 27), { minVal: 13, maxVal: 27, isPrecedingMaxed: false });

        // Step 2 with preceding step at 15: minVal is 16 (prevVal + 1)
        assert.deepEqual(calculateStepBounds(2, 15, 1, 27), { minVal: 16, maxVal: 27, isPrecedingMaxed: false });

        // Step 2 with preceding step at 27 (epic max): prevVal + 1 would be 28 > 27
        // Must fall back to defaultMinLevel (9) and mark preceding maxed, NEVER invert to 28 - 27
        assert.deepEqual(calculateStepBounds(2, 27, 1, 27), { minVal: 9, maxVal: 27, isPrecedingMaxed: true });

        // Step 2 with preceding step at 18 (common max): falls back to defaultMinLevel (9)
        assert.deepEqual(calculateStepBounds(2, 18, 1, 18), { minVal: 9, maxVal: 18, isPrecedingMaxed: true });

        // Step 3 with preceding step empty (NaN): falls back to defaultMinLevel (9)
        assert.deepEqual(calculateStepBounds(3, NaN, 1, 27), { minVal: 9, maxVal: 27, isPrecedingMaxed: false });

        // Step 3 with preceding step at 27: falls back to defaultMinLevel (9) and marks preceding maxed
        assert.deepEqual(calculateStepBounds(3, 27, 1, 27), { minVal: 9, maxVal: 27, isPrecedingMaxed: true });
    });

    test('calculateStepRecommendation steps over previous level for common equipment', () => {
        // Common equipment max level 18
        // When equipment level is 9, step 1 recommends 12
        assert.equal(calculateStepRecommendation(1, 9, 9, 18, 'common'), 12);

        // When step 1 is 12, step 2 recommends 15
        assert.equal(calculateStepRecommendation(2, 12, 9, 18, 'common'), 15);

        // When step 2 is 15, step 3 recommends 18 (max level)
        assert.equal(calculateStepRecommendation(3, 15, 9, 18, 'common'), 18);

        // Key bug scenario: user sets 15 in cell 1 -> cell 2 must step over to 18
        assert.equal(calculateStepRecommendation(2, 15, 9, 18, 'common'), 18);

        // When cell 2 is 18 (max level) -> cell 3 must be exhausted (0)
        assert.equal(calculateStepRecommendation(3, 18, 9, 18, 'common'), 0);

        // When cell 1 is set to 18 (max level) -> all subsequent steps are exhausted
        assert.equal(calculateStepRecommendation(2, 18, 9, 18, 'common'), 0);
        assert.equal(calculateStepRecommendation(3, 18, 9, 18, 'common'), 0);

        // Custom intermediate levels step over cleanly to the next multiple of 3
        assert.equal(calculateStepRecommendation(2, 13, 9, 18, 'common'), 15);
        assert.equal(calculateStepRecommendation(2, 14, 9, 18, 'common'), 15);
        assert.equal(calculateStepRecommendation(2, 16, 9, 18, 'common'), 18);
    });

    test('calculateStepRecommendation steps over previous level for epic equipment', () => {
        // Epic equipment max level 27
        // Low level baseline: 9 -> 18 -> 27
        assert.equal(calculateStepRecommendation(1, 1, 1, 27, 'epic'), 9);
        assert.equal(calculateStepRecommendation(2, 9, 1, 27, 'epic'), 18);
        assert.equal(calculateStepRecommendation(3, 18, 1, 27, 'epic'), 27);

        // User sets 15 in cell 1 -> cell 2 recommends 18, cell 3 recommends 27
        assert.equal(calculateStepRecommendation(2, 15, 9, 27, 'epic'), 18);
        assert.equal(calculateStepRecommendation(3, 18, 9, 27, 'epic'), 27);

        // High level stepping
        assert.equal(calculateStepRecommendation(2, 21, 18, 27, 'epic'), 24);
        assert.equal(calculateStepRecommendation(2, 24, 18, 27, 'epic'), 27);
        assert.equal(calculateStepRecommendation(3, 24, 18, 27, 'epic'), 27);

        // Exhausted options when cell 2 reaches max level (27)
        assert.equal(calculateStepRecommendation(3, 27, 18, 27, 'epic'), 0);

        // Exhausted options when cell 1 reaches max level (27)
        assert.equal(calculateStepRecommendation(2, 27, 18, 27, 'epic'), 0);
        assert.equal(calculateStepRecommendation(3, 27, 18, 27, 'epic'), 0);
    });

    test('getDefaultLevels derives non-duplicate defaults and suppresses exhausted steps', () => {
        // Common at level 9
        const common9 = getDefaultLevels(9, 10, 18, 'common');
        assert.deepEqual(common9, { defaultLevel1: 12, defaultLevel2: 15, defaultLevel3: 18 });

        // Common at level 12 -> step 3 exhausted
        const common12 = getDefaultLevels(12, 13, 18, 'common');
        assert.deepEqual(common12, { defaultLevel1: 15, defaultLevel2: 18, defaultLevel3: 0 });

        // Common at level 15 -> steps 2 and 3 exhausted
        const common15 = getDefaultLevels(15, 16, 18, 'common');
        assert.deepEqual(common15, { defaultLevel1: 18, defaultLevel2: 0, defaultLevel3: 0 });

        // Epic at level 1
        const epic1 = getDefaultLevels(1, 9, 27, 'epic');
        assert.deepEqual(epic1, { defaultLevel1: 9, defaultLevel2: 18, defaultLevel3: 27 });

        // Epic at level 18
        const epic18 = getDefaultLevels(18, 19, 27, 'epic');
        assert.deepEqual(epic18, { defaultLevel1: 21, defaultLevel2: 24, defaultLevel3: 27 });

        // Epic at level 21 -> step 3 exhausted
        const epic21 = getDefaultLevels(21, 22, 27, 'epic');
        assert.deepEqual(epic21, { defaultLevel1: 24, defaultLevel2: 27, defaultLevel3: 0 });

        // Epic at level 24 -> steps 2 and 3 exhausted
        const epic24 = getDefaultLevels(24, 25, 27, 'epic');
        assert.deepEqual(epic24, { defaultLevel1: 27, defaultLevel2: 0, defaultLevel3: 0 });
    });

    test('getEquipmentRecommendedLevel safely returns 0 when no equipment is active', () => {
        assert.equal(getEquipmentRecommendedLevel(1), 0);
        assert.equal(getEquipmentRecommendedLevel(2), 0);
        assert.equal(getEquipmentRecommendedLevel(3), 0);
    });

    test('calculateUpgradePlanPriorities correctly computes plan updates', () => {
        // All disabled -> returns null
        const emptyResult = calculateUpgradePlanPriorities({}, [
            { stepKey: '1', level: 12, enabled: false },
            { stepKey: '2', level: 15, enabled: false }
        ], 5);
        assert.strictEqual(emptyResult, null);

        // New steps on empty plan (N_old === 0)
        const newPlan = calculateUpgradePlanPriorities({}, [
            { stepKey: '1', level: 12, enabled: true },
            { stepKey: '2', level: 15, enabled: true },
            { stepKey: '3', level: 18, enabled: true }
        ], 10);
        assert.deepEqual(newPlan, {
            '1': { targetLevel: 12, enabled: true, priorityIndex: 11 },
            '2': { targetLevel: 15, enabled: true, priorityIndex: 12 },
            '3': { targetLevel: 18, enabled: true, priorityIndex: 13 }
        });

        // Duplicate levels are deduplicated
        const dedupPlan = calculateUpgradePlanPriorities({}, [
            { stepKey: '1', level: 15, enabled: true },
            { stepKey: '2', level: 15, enabled: true },
            { stepKey: '3', level: 18, enabled: true }
        ], 0);
        assert.deepEqual(dedupPlan, {
            '1': { targetLevel: 15, enabled: true, priorityIndex: 1 },
            '2': { targetLevel: 18, enabled: true, priorityIndex: 2 }
        });
    });
});
