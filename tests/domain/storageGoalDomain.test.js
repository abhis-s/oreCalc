import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    getStorageCapacityMetrics,
    isTrackedEquipmentMaxed,
    resolveActiveStorageGoal,
    shouldPromptStoredOresReminder
} from '../../js/domain/equipment/storageGoalDomain.js';
import { STORAGE_LIMITS, STORAGE_GOAL_PRESETS } from '../../js/core/constants.js';

describe('Storage Goal & Capacity Domain Engine (storageGoalDomain.js)', () => {

    test('resolveActiveStorageGoal correctly resolves targets for maxStorage and nextEpic presets', () => {
        const maxStorage = resolveActiveStorageGoal({
            isEquipmentMaxed: true,
            storageGoal: { preset: STORAGE_GOAL_PRESETS.MAX_STORAGE }
        });
        assert.equal(maxStorage.isGoalActive, true);
        assert.deepEqual(maxStorage.targetOres, STORAGE_LIMITS);

        const nextEpic = resolveActiveStorageGoal({
            isEquipmentMaxed: true,
            storageGoal: { preset: STORAGE_GOAL_PRESETS.NEXT_EPIC }
        });
        assert.equal(nextEpic.isGoalActive, true);
        assert.deepEqual(nextEpic.targetOres, { shiny: 56060, glowy: 3720, starry: 480 });

        // When a custom Coming Soon equipment is active on any hero, NEXT_EPIC targets that equipment's cost
        const heroesWithCommonSoon = {
            barbarianKing: {
                equipment: {
                    comingSoon: { level: 1, checked: true, type: 'common', isCustom: true }
                }
            }
        };
        const targetForCommonSoon = resolveActiveStorageGoal({
            isEquipmentMaxed: true,
            storageGoal: { preset: STORAGE_GOAL_PRESETS.NEXT_EPIC },
            heroesState: heroesWithCommonSoon
        });
        assert.equal(targetForCommonSoon.isGoalActive, true);
        assert.deepEqual(targetForCommonSoon.targetOres, { shiny: 27260, glowy: 1920, starry: 0 });

        const heroesWithEpicSoon = {
            archerQueen: {
                equipment: {
                    comingSoon: { level: 1, checked: true, type: 'epic', isCustom: true }
                }
            }
        };
        const targetForEpicSoon = resolveActiveStorageGoal({
            isEquipmentMaxed: true,
            storageGoal: { preset: STORAGE_GOAL_PRESETS.NEXT_EPIC },
            heroesState: heroesWithEpicSoon
        });
        assert.equal(targetForEpicSoon.isGoalActive, true);
        assert.deepEqual(targetForEpicSoon.targetOres, { shiny: 56060, glowy: 3720, starry: 480 });

        const none = resolveActiveStorageGoal({
            isEquipmentMaxed: true,
            storageGoal: { preset: STORAGE_GOAL_PRESETS.NONE }
        });
        assert.equal(none.isGoalActive, false);
    });

    test('resolveActiveStorageGoal strictly guarantees goals are inactive for non-maxed players', () => {
        // Even if nextEpic or maxStorage is configured, isGoalActive MUST be false when unmaxed
        const unmaxedWithPreset = resolveActiveStorageGoal({
            isEquipmentMaxed: false,
            storageGoal: { preset: STORAGE_GOAL_PRESETS.NEXT_EPIC },
            storedOres: { shiny: 1000, glowy: 100, starry: 10 }
        });
        assert.equal(unmaxedWithPreset.isGoalActive, false);
        assert.deepEqual(unmaxedWithPreset.remainingOres, { shiny: 0, glowy: 0, starry: 0 });

        const unmaxedWithMaxStorage = resolveActiveStorageGoal({
            isEquipmentMaxed: false,
            storageGoal: { preset: STORAGE_GOAL_PRESETS.MAX_STORAGE },
            storedOres: { shiny: 1000, glowy: 100, starry: 10 }
        });
        assert.equal(unmaxedWithMaxStorage.isGoalActive, false);
    });

    test('getStorageCapacityMetrics accurately evaluates percentages, caps, and overflow metrics', () => {
        const empty = getStorageCapacityMetrics({ shiny: 0, glowy: 0, starry: 0 });
        assert.equal(empty.anyFull, false);
        assert.equal(empty.allFull, false);
        assert.equal(empty.anyOverflowed, false);
        assert.equal(empty.shiny.fillPct, 0);

        const partial = getStorageCapacityMetrics({ shiny: 25000, glowy: 5000, starry: 1200 });
        assert.equal(partial.shiny.fillPct, 50);
        assert.equal(partial.shiny.clampedPct, 50);
        assert.equal(partial.shiny.isFull, false);
        assert.equal(partial.shiny.overflowAmount, 0);

        assert.equal(partial.glowy.fillPct, 100);
        assert.equal(partial.glowy.isFull, true);
        assert.equal(partial.glowy.overflowAmount, 0);

        assert.equal(partial.starry.fillPct, 120);
        assert.equal(partial.starry.clampedPct, 100);
        assert.equal(partial.starry.isFull, true);
        assert.equal(partial.starry.isOverflowed, true);
        assert.equal(partial.starry.overflowAmount, 200);

        assert.equal(partial.anyFull, true);
        assert.equal(partial.allFull, false);
        assert.equal(partial.anyOverflowed, true);

        const allCapped = getStorageCapacityMetrics({ shiny: 50000, glowy: 5000, starry: 1000 });
        assert.equal(allCapped.allFull, true);
        assert.equal(allCapped.anyOverflowed, false);
    });

    test('isTrackedEquipmentMaxed accurately evaluates maxed status of player equipment', () => {
        assert.equal(isTrackedEquipmentMaxed(null), false);
        assert.equal(isTrackedEquipmentMaxed({}), false);

        const unmaxedHeroes = {
            barbarianKing: {
                enabled: true,
                equipment: {
                    barbarianPuppet: { level: 10, checked: true },
                    giantGauntlet: { level: 27, checked: true }
                }
            }
        };
        assert.equal(isTrackedEquipmentMaxed(unmaxedHeroes), false);

        const maxedHeroes = {
            barbarianKing: {
                enabled: true,
                equipment: {
                    barbarianPuppet: { level: 18, checked: true },
                    giantGauntlet: { level: 27, checked: true }
                }
            }
        };
        assert.equal(isTrackedEquipmentMaxed(maxedHeroes), true);

        // Checked = false ignores unmaxed equipment
        const mixedHeroes = {
            barbarianKing: {
                enabled: true,
                equipment: {
                    barbarianPuppet: { level: 1, checked: false },
                    giantGauntlet: { level: 27, checked: true }
                }
            }
        };
        assert.equal(isTrackedEquipmentMaxed(mixedHeroes), true);

        // Custom Coming Soon equipment does not disqualify maxed status
        maxedHeroes.barbarianKing.equipment.comingSoon = {
            level: 1,
            checked: true,
            type: 'common',
            isCustom: true
        };
        assert.equal(isTrackedEquipmentMaxed(maxedHeroes), true);
        delete maxedHeroes.barbarianKing.equipment.comingSoon;
    });

    test('resolveActiveStorageGoal handles auto transition, explicit presets, and remaining calculations', () => {
        // Auto preset with unmaxed equipment -> goal inactive
        const unmaxedAuto = resolveActiveStorageGoal({
            isEquipmentMaxed: false,
            storageGoal: { preset: 'auto' },
            storedOres: { shiny: 1000, glowy: 100, starry: 10 }
        });
        assert.equal(unmaxedAuto.isGoalActive, false);
        assert.equal(unmaxedAuto.preset, 'none');

        // Auto preset with maxed equipment -> goal resolves to maxStorage
        const maxedAuto = resolveActiveStorageGoal({
            isEquipmentMaxed: true,
            storageGoal: { preset: 'auto' },
            storedOres: { shiny: 40000, glowy: 4500, starry: 900 },
            heroJourneyUpcomingOres: { shiny: 5000, glowy: 200, starry: 50 }
        });
        assert.equal(maxedAuto.isGoalActive, true);
        assert.equal(maxedAuto.preset, 'maxStorage');
        assert.deepEqual(maxedAuto.targetOres, STORAGE_LIMITS);
        // remaining = 50000 - 40000 - 5000 = 5000
        assert.equal(maxedAuto.remainingOres.shiny, 5000);
        // remaining = 5000 - 4500 - 200 = 300
        assert.equal(maxedAuto.remainingOres.glowy, 300);
        // remaining = 1000 - 900 - 50 = 50
        assert.equal(maxedAuto.remainingOres.starry, 50);
        assert.equal(maxedAuto.isTargetMet, false);
        assert.equal(maxedAuto.requiresOverflow, false);

        // Next Epic preset requires shiny overflow (56,060 > 50,000)
        const nextEpicGoal = resolveActiveStorageGoal({
            isEquipmentMaxed: true,
            storageGoal: { preset: 'nextEpic' },
            storedOres: { shiny: 0, glowy: 0, starry: 0 }
        });
        assert.equal(nextEpicGoal.isGoalActive, true);
        assert.equal(nextEpicGoal.preset, 'nextEpic');
        assert.equal(nextEpicGoal.requiresOverflow, true);
        assert.equal(nextEpicGoal.overflowRequired.shiny, 6060);
        // Storage fill requirement strictly does not consider overflow (clamped to 50,000 Blacksmith cap)
        assert.equal(nextEpicGoal.storageFillRemainingOres.shiny, STORAGE_LIMITS.shiny);
        assert.equal(nextEpicGoal.storageFillRemainingOres.glowy, 3720);
        assert.equal(nextEpicGoal.storageFillRemainingOres.starry, 480);
    });

    test('shouldPromptStoredOresReminder applies smart softening when storages are full', () => {
        const now = 1000000000000;
        const hour = 3600 * 1000;

        // Unmaxed/partial player: prompt after 48 hours
        const partialOres = { shiny: 1000, glowy: 100, starry: 10, allowOverflow: false };
        assert.equal(shouldPromptStoredOresReminder({ storedOres: partialOres, lastUpdated: now - 10 * hour, now }), false);
        assert.equal(shouldPromptStoredOresReminder({ storedOres: partialOres, lastUpdated: now - 50 * hour, now }), true);

        // All storages full without overflow: suppressed completely
        const fullOres = { shiny: 50000, glowy: 5000, starry: 1000, allowOverflow: false };
        assert.equal(shouldPromptStoredOresReminder({ storedOres: fullOres, lastUpdated: now - 50 * hour, now }), false);
        assert.equal(shouldPromptStoredOresReminder({ storedOres: fullOres, lastUpdated: now - 100 * hour, now }), false);

        // All storages full with overflow enabled: suppressed until 7 days
        const fullOverflowOres = { shiny: 52000, glowy: 5000, starry: 1000, allowOverflow: true };
        assert.equal(shouldPromptStoredOresReminder({ storedOres: fullOverflowOres, lastUpdated: now - 50 * hour, now }), false);
        assert.equal(shouldPromptStoredOresReminder({ storedOres: fullOverflowOres, lastUpdated: now - (8 * 24 * hour), now }), true);
    });

});
