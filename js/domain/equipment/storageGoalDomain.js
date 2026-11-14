/**
 * Post-Max Equipment Storage Goals & Capacity Calculation Engine.
 * Tier 2: Pure Domain Math (Zero DOM dependencies, zero side effects).
 */

import {
    STORAGE_GOAL_PRESETS,
    STORAGE_LIMITS
} from '../../core/constants.js';
import {
    EQUIPMENT_MAX_LEVELS,
    getEquipmentMaxLevel,
    upgradeCosts
} from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { getActiveCustomComingSoon } from './comingSoonEquipmentDomain.js';

/**
 * Calculates remaining upgrade ore costs from an initial level to a target level.
 *
 * @param {'common' | 'epic'} rarity - Equipment rarity.
 * @param {number} [fromLevel=1] - Starting level.
 * @param {number | null} [toLevel=null] - Destination level (defaults to max level).
 * @returns {import('../../core/types.js').OreQuantity} Total required shiny, glowy, and starry ores.
 */
function getEquipmentRemainingUpgradeCost(rarity, fromLevel = 1, toLevel = null) {
    const maxLevel = toLevel || EQUIPMENT_MAX_LEVELS[rarity] || (rarity === 'epic' ? 27 : 18);
    const cost = { shiny: 0, glowy: 0, starry: 0 };

    for (let level = Math.max(2, fromLevel + 1); level <= maxLevel; level++) {
        const step = upgradeCosts[level];
        if (step) {
            cost.shiny += step.shiny || 0;
            cost.glowy += step.glowy || 0;
            if (rarity === 'epic') {
                cost.starry += step.starry || 0;
            }
        }
    }

    return cost;
}

/**
 * Resolves the canonical target ore quantities for a given storage goal configuration.
 *
 * @param {import('../../core/types.js').StorageGoalConfig | null | undefined} storageGoal - Storage goal configuration.
 * @param {Record<string, import('../../core/types.js').HeroItem> | null} [heroesState=null] - Optional heroes state.
 * @returns {import('../../core/types.js').OreQuantity | null} Target ore quantities or null if disabled.
 */
function getStorageGoalTargetOres(storageGoal, heroesState = null) {
    const preset = storageGoal?.preset || STORAGE_GOAL_PRESETS.AUTO;

    switch (preset) {
        case STORAGE_GOAL_PRESETS.MAX_STORAGE:
            return {
                shiny: STORAGE_LIMITS.shiny,
                glowy: STORAGE_LIMITS.glowy,
                starry: STORAGE_LIMITS.starry
            };
        case STORAGE_GOAL_PRESETS.NEXT_EPIC: {
            if (heroesState) {
                const activeSoon = getActiveCustomComingSoon(heroesState);
                if (activeSoon) {
                    return getEquipmentRemainingUpgradeCost(activeSoon.item.type, activeSoon.item.level);
                }
            }
            return getEquipmentRemainingUpgradeCost('epic', 1);
        }
        case STORAGE_GOAL_PRESETS.NONE:
            return null;
        case STORAGE_GOAL_PRESETS.AUTO:
        default:
            return {
                shiny: STORAGE_LIMITS.shiny,
                glowy: STORAGE_LIMITS.glowy,
                starry: STORAGE_LIMITS.starry
            };
    }
}

/**
 * Computes capacity utilization metrics and overflow amounts for each ore against Blacksmith storage limits.
 *
 * @param {import('../../core/types.js').StoredOres | null | undefined} storedOres - Stored ores state.
 * @returns {import('../../core/types.js').StorageCapacityMetrics} Detailed capacity metrics.
 */
export function getStorageCapacityMetrics(storedOres) {
    const oreTypes = ['shiny', 'glowy', 'starry'];
    const metrics = {};

    let anyFull = false;
    let allFull = true;
    let anyOverflowed = false;

    for (const ore of oreTypes) {
        const amount = Math.max(0, Number(storedOres?.[ore]) || 0);
        const cap = STORAGE_LIMITS[ore] || 1;
        const fillPct = (amount / cap) * 100;
        const clampedPct = Math.min(100, Math.max(0, Math.round(fillPct)));
        const overflowAmount = Math.max(0, amount - cap);
        const isFull = amount >= cap;
        const isOverflowed = amount > cap;

        if (isFull) anyFull = true;
        else allFull = false;
        if (isOverflowed) anyOverflowed = true;

        metrics[ore] = {
            amount,
            cap,
            fillPct,
            clampedPct,
            overflowAmount,
            isFull,
            isOverflowed
        };
    }

    return {
        shiny: metrics.shiny,
        glowy: metrics.glowy,
        starry: metrics.starry,
        anyFull,
        allFull,
        anyOverflowed
    };
}

/**
 * Evaluates whether all currently tracked equipment upgrades across enabled heroes are fully maxed out.
 *
 * @param {Record<string, import('../../core/types.js').HeroItem> | null | undefined} heroesState - Heroes state map.
 * @param {import('../../core/types.js').PlannerState | null | undefined} [plannerState] - Planner state.
 * @returns {boolean} True if player has tracked equipment and all tracked equipment has reached max level.
 */
export function isTrackedEquipmentMaxed(heroesState, plannerState) {
    if (!heroesState || typeof heroesState !== 'object') return false;

    let checkedCount = 0;
    let levelsRemaining = 0;

    for (const heroName in heroesState) {
        const hero = heroesState[heroName];
        if (!hero || hero.enabled === false) continue;

        const heroObj = Object.values(heroData).find(h => h.name === heroName || h.key === heroName);
        if (!heroObj?.equipment) continue;

        for (const equipName in hero.equipment) {
            const equip = hero.equipment[equipName];
            if (!equip || equip.checked === false) continue;

            const eqObj = heroObj.equipment.find(e => e.name === equipName || e.key === equipName);
            if (!eqObj) {
                // Non-official equipment or custom Coming Soon placeholders do not block maxed evaluation
                continue;
            }

            checkedCount++;
            const maxLevel = plannerState?.customMaxLevel?.[eqObj.type] || getEquipmentMaxLevel(eqObj.type);
            const currentLevel = equip.level || 1;
            if (currentLevel < maxLevel) {
                levelsRemaining += (maxLevel - currentLevel);
            }
        }
    }

    return checkedCount > 0 && levelsRemaining === 0;
}

/**
 * Resolves active storage goal, target quantities, remaining ores needed, and overflow prerequisites.
 *
 * @param {Object} params
 * @param {boolean} params.isEquipmentMaxed - Whether tracked equipment is maxed.
 * @param {import('../../core/types.js').StorageGoalConfig | null | undefined} params.storageGoal - Configured goal.
 * @param {import('../../core/types.js').StoredOres | null | undefined} params.storedOres - Stored inventory.
 * @param {Partial<import('../../core/types.js').OreQuantity>} [params.heroJourneyUpcomingOres={}] - Upcoming rewards.
 * @param {Record<string, import('../../core/types.js').HeroItem> | null} [params.heroesState=null] - Optional heroes state.
 * @returns {import('../../core/types.js').ActiveStorageGoal} Resolved active goal data.
 */
export function resolveActiveStorageGoal({ isEquipmentMaxed, storageGoal, storedOres, heroJourneyUpcomingOres = {}, heroesState = null }) {
    const configuredPreset = storageGoal?.preset || STORAGE_GOAL_PRESETS.AUTO;
    let activePreset = configuredPreset;

    if (configuredPreset === STORAGE_GOAL_PRESETS.AUTO) {
        activePreset = isEquipmentMaxed ? STORAGE_GOAL_PRESETS.MAX_STORAGE : STORAGE_GOAL_PRESETS.NONE;
    }

    const isGoalActive = Boolean(isEquipmentMaxed) && activePreset !== STORAGE_GOAL_PRESETS.NONE;

    const zeroOres = { shiny: 0, glowy: 0, starry: 0 };
    if (!isGoalActive) {
        return {
            preset: STORAGE_GOAL_PRESETS.NONE,
            labelKey: 'views.equipment.goals.none',
            isGoalActive: false,
            targetOres: zeroOres,
            remainingOres: zeroOres,
            storageFillRemainingOres: zeroOres,
            isTargetMet: true,
            requiresOverflow: false,
            overflowRequired: zeroOres
        };
    }

    const targetOres = getStorageGoalTargetOres({
        preset: activePreset
    }, heroesState) || zeroOres;

    const stored = {
        shiny: Number(storedOres?.shiny) || 0,
        glowy: Number(storedOres?.glowy) || 0,
        starry: Number(storedOres?.starry) || 0
    };

    const upcoming = {
        shiny: Number(heroJourneyUpcomingOres?.shiny) || 0,
        glowy: Number(heroJourneyUpcomingOres?.glowy) || 0,
        starry: Number(heroJourneyUpcomingOres?.starry) || 0
    };

    const remainingOres = {
        shiny: Math.max(0, targetOres.shiny - stored.shiny - upcoming.shiny),
        glowy: Math.max(0, targetOres.glowy - stored.glowy - upcoming.glowy),
        starry: Math.max(0, targetOres.starry - stored.starry - upcoming.starry)
    };

    const storageFillRemainingOres = {
        shiny: Math.max(0, Math.min(targetOres.shiny, STORAGE_LIMITS.shiny) - Math.min(stored.shiny + upcoming.shiny, STORAGE_LIMITS.shiny)),
        glowy: Math.max(0, Math.min(targetOres.glowy, STORAGE_LIMITS.glowy) - Math.min(stored.glowy + upcoming.glowy, STORAGE_LIMITS.glowy)),
        starry: Math.max(0, Math.min(targetOres.starry, STORAGE_LIMITS.starry) - Math.min(stored.starry + upcoming.starry, STORAGE_LIMITS.starry))
    };

    const isTargetMet = remainingOres.shiny === 0 &&
        remainingOres.glowy === 0 &&
        remainingOres.starry === 0;

    const overflowRequired = {
        shiny: Math.max(0, targetOres.shiny - STORAGE_LIMITS.shiny),
        glowy: Math.max(0, targetOres.glowy - STORAGE_LIMITS.glowy),
        starry: Math.max(0, targetOres.starry - STORAGE_LIMITS.starry)
    };

    const requiresOverflow = overflowRequired.shiny > 0 ||
        overflowRequired.glowy > 0 ||
        overflowRequired.starry > 0;

    const labelKeyMap = {
        [STORAGE_GOAL_PRESETS.MAX_STORAGE]: 'views.equipment.goals.maxStorage',
        [STORAGE_GOAL_PRESETS.NEXT_EPIC]: 'views.equipment.goals.nextEpic',
        [STORAGE_GOAL_PRESETS.NONE]: 'views.equipment.goals.none'
    };

    return {
        preset: activePreset,
        labelKey: labelKeyMap[activePreset] || 'views.equipment.goals.maxStorage',
        isGoalActive: true,
        targetOres,
        remainingOres,
        storageFillRemainingOres,
        isTargetMet,
        requiresOverflow,
        overflowRequired
    };
}

/**
 * Determines whether the periodic Stored Ores reminder modal should be prompted when navigating to the Planner tab.
 * Softens prompt when player storages are already full at Blacksmith limits.
 *
 * @param {Object} params
 * @param {import('../../core/types.js').StoredOres | null | undefined} params.storedOres - Stored inventory.
 * @param {number} [params.lastUpdated=0] - Timestamp of last inventory save.
 * @param {number} [params.now=Date.now()] - Current epoch timestamp.
 * @returns {boolean} Whether reminder modal should be triggered.
 */
export function shouldPromptStoredOresReminder({ storedOres, lastUpdated = 0, now = Date.now() }) {
    const timeDiff = now - (lastUpdated || 0);
    const capacity = getStorageCapacityMetrics(storedOres);

    // If all storages are full at Blacksmith limits:
    if (capacity.allFull) {
        // Without overflow enabled: fully suppress automatic reminder popup
        if (!storedOres?.allowOverflow) {
            return false;
        }
        // With overflow enabled: relax reminder frequency to 7 days
        return timeDiff > (7 * 24 * 60 * 60 * 1000);
    }

    const isMoreThan48HoursOld = timeDiff > (48 * 60 * 60 * 1000);
    const isMoreThan12HoursOld = timeDiff > (12 * 60 * 60 * 1000);

    const shiny = Number(storedOres?.shiny) || 0;
    const glowy = Number(storedOres?.glowy) || 0;
    const starry = Number(storedOres?.starry) || 0;
    const hasAtLeastOneZero = shiny === 0 || glowy === 0 || starry === 0;

    return isMoreThan48HoursOld || (isMoreThan12HoursOld && hasAtLeastOneZero);
}
