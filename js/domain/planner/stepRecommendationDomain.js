/**
 * Step Recommendation & Priority Index Calculation Engine.
 * Tier 2: Pure Domain Math (0 DOM references, 0 state mutations).
 */

/**
 * Calculates candidate recommended level milestones for a given step based on lower bound and rarity.
 *
 * @param {number} stepIndex - 1-based step index (1, 2, or 3).
 * @param {number} lowerBound - Strict minimum level the step must exceed.
 * @param {number} currentLevel - The hero equipment's base level in state.
 * @param {number} maxLevel - Maximum equipment level (18 for common, 27 for epic).
 * @param {string} [type='common'] - Equipment rarity type ('common' or 'epic').
 * @returns {number} The recommended level, or 0 if options are exhausted.
 */
export function calculateStepRecommendation(stepIndex, lowerBound, currentLevel, maxLevel, type = 'common') {
    if (lowerBound >= maxLevel) {
        return 0;
    }

    const milestones = [];
    for (let lvl = 9; lvl <= maxLevel; lvl += 3) {
        milestones.push(lvl);
    }
    const available = milestones.filter(m => m > lowerBound);

    if (available.length === 0) {
        return 0;
    }

    if (stepIndex === 3) {
        return maxLevel;
    }

    if (type === 'epic' && stepIndex === 2 && lowerBound <= 9 && maxLevel >= 18) {
        return 18;
    }

    return available[0];
}

/**
 * Calculates default initial upgrade levels for steps 1, 2, and 3.
 *
 * @param {number} currentLevel - Current equipment level.
 * @param {number} minLevel - Minimum allowed upgrade level.
 * @param {number} maxLevel - Maximum equipment level.
 * @param {string} type - Equipment rarity type ('common' or 'epic').
 * @returns {{ defaultLevel1: number, defaultLevel2: number, defaultLevel3: number }} Initial milestone levels.
 */
export function getDefaultLevels(currentLevel, minLevel, maxLevel, type) {
    const defaultLevel1 = calculateStepRecommendation(1, currentLevel, currentLevel, maxLevel, type);
    const bound1 = defaultLevel1 > 0 ? defaultLevel1 : currentLevel;

    const defaultLevel2 = calculateStepRecommendation(2, bound1, currentLevel, maxLevel, type);
    const bound2 = defaultLevel2 > 0 ? defaultLevel2 : bound1;

    const defaultLevel3 = calculateStepRecommendation(3, bound2, currentLevel, maxLevel, type);

    return { defaultLevel1, defaultLevel2, defaultLevel3 };
}

/**
 * Calculates the min and max allowed level bounds for a given step.
 *
 * @param {number} stepIndex - 1-based step index (1, 2, or 3).
 * @param {number} prevVal - Value of the preceding step (or 0 if none/invalid).
 * @param {number} currentLevel - Current equipment level.
 * @param {number} maxLevel - Maximum equipment level.
 * @returns {{ minVal: number, maxVal: number, isPrecedingMaxed: boolean }} Calculated bounds.
 */
export function calculateStepBounds(stepIndex, prevVal, currentLevel, maxLevel) {
    const defaultMinLevel = Math.max(9, currentLevel + 1);
    let minVal = defaultMinLevel;
    let isPrecedingMaxed = false;

    if (stepIndex > 1) {
        if (!isNaN(prevVal) && prevVal > 0) {
            if (prevVal + 1 <= maxLevel) {
                minVal = prevVal + 1;
            } else {
                minVal = defaultMinLevel;
                isPrecedingMaxed = true;
            }
        }
    }

    return { minVal, maxVal: maxLevel, isPrecedingMaxed };
}

/**
 * Pure calculation engine for updating equipment upgrade plan priority indices.
 * Handles duplicate level suppression, anchor-based fractional priority insertion,
 * and maintains relative sequencing between existing and newly introduced steps.
 *
 * @param {Record<string, { targetLevel: number, enabled: boolean, priorityIndex: number }>} [oldUpgradePlan={}] - Existing plan.
 * @param {Array<{ stepKey: string, level: number, enabled: boolean }>} [rawUiSteps=[]] - Raw step inputs.
 * @param {number} [maxPriority=0] - Current highest priority index across all equipment.
 * @returns {Record<string, { targetLevel: number, enabled: boolean, priorityIndex: number }> | null} New plan, or null if empty.
 */
export function calculateUpgradePlanPriorities(oldUpgradePlan = {}, rawUiSteps = [], maxPriority = 0) {
    const oldSteps = [];
    for (const stepKey in oldUpgradePlan) {
        const step = oldUpgradePlan[stepKey];
        if (step.enabled && step.priorityIndex > 0) {
            oldSteps.push({
                stepKey,
                level: step.targetLevel,
                priorityIndex: step.priorityIndex
            });
        }
    }
    oldSteps.sort((a, b) => a.level - b.level);

    // Map UI steps and enforce level uniqueness
    const uniqueLevels = new Set();
    const processedSteps = [];

    for (const step of rawUiSteps) {
        const isEnabled = Boolean(step.enabled && !isNaN(step.level) && step.level > 0);
        const oldPlanEntry = oldUpgradePlan[step.stepKey];
        const stepRecord = {
            stepKey: step.stepKey,
            level: isEnabled ? step.level : 0,
            enabled: isEnabled,
            priorityIndex: oldPlanEntry ? oldPlanEntry.priorityIndex : 0
        };

        if (stepRecord.enabled) {
            if (uniqueLevels.has(stepRecord.level)) {
                stepRecord.enabled = false;
            } else {
                uniqueLevels.add(stepRecord.level);
            }
        }
        processedSteps.push(stepRecord);
    }

    const enabledSteps = processedSteps.filter(s => s.enabled);
    enabledSteps.sort((a, b) => a.level - b.level);

    const N_new = enabledSteps.length;
    const N_old = oldSteps.length;

    if (N_new === 0) {
        return null;
    }

    if (N_old === 0) {
        enabledSteps.forEach((step, index) => {
            step.priorityIndex = maxPriority + 1 + index;
        });
    } else if (N_new <= N_old) {
        enabledSteps.forEach((step, index) => {
            step.priorityIndex = oldSteps[index].priorityIndex;
        });
    } else {
        const newHighest = enabledSteps[N_new - 1];
        const oldHighest = oldSteps[N_old - 1];

        if (newHighest.level > oldHighest.level) {
            newHighest.priorityIndex = maxPriority + 1;
        } else {
            newHighest.priorityIndex = oldHighest.priorityIndex;
        }

        if (N_old === 1) {
            const anchor = oldHighest.priorityIndex;
            for (let i = 0; i < N_new - 1; i++) {
                enabledSteps[i].priorityIndex = anchor - 0.002 + (i * 0.001);
            }
        } else if (N_old === 2) {
            const S_low = enabledSteps[0];
            const S_mid = enabledSteps[1];
            const O_low = oldSteps[0];

            if (S_mid.level > O_low.level) {
                S_mid.priorityIndex = O_low.priorityIndex + 0.001;
                if (S_low.level === O_low.level) {
                    S_low.priorityIndex = O_low.priorityIndex;
                } else {
                    S_low.priorityIndex = O_low.priorityIndex - 0.001;
                }
            } else {
                S_low.priorityIndex = O_low.priorityIndex;
                S_mid.priorityIndex = O_low.priorityIndex + 0.001;
            }
        } else if (N_old >= 3) {
            enabledSteps.forEach((step, index) => {
                step.priorityIndex = oldSteps[index].priorityIndex;
            });
        }
    }

    /** @type {Record<string, { targetLevel: number, enabled: boolean, priorityIndex: number }>} */
    const newPlan = {};
    enabledSteps.forEach((step, index) => {
        const stepKey = (index + 1).toString();
        newPlan[stepKey] = {
            targetLevel: step.level,
            enabled: true,
            priorityIndex: step.priorityIndex
        };
    });

    return newPlan;
}
