import { heroJourneyNodes, oreChestRewardsAccelerated, oreChestRewardsNormal } from '../../data/heroJourneyData.js';
import {
    getCumulativeHeroLevel,
    getMaxCumulativeLevelsByTH,
    getNodeTownHallLevel,
    getTownHallLevel,
    hasSyncedHeroInfo
} from './heroJourneyLevels.js';
import { resolveHeroJourneyTrack } from './heroJourneyResolution.js';

/**
 * Resolves the effective Town Hall level for a quest node.
 * Claimed nodes reflect the node's original TH level (nodeTH).
 * Unclaimed nodes scale to at minimum the player's current TH level (Math.max(playerTH, nodeTH)).
 *
 * @param {any} node - Hero's journey node.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {number} Effective Town Hall level.
 */
export function getEffectiveQuestNodeTH(node, state) {
    const nodeTH = getNodeTownHallLevel(node.level);
    const playerTH = getTownHallLevel(state);
    const cumulativeLevel = getCumulativeHeroLevel(state);

    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    const isReached = cumulativeLevel >= node.level;
    const isClaimed = isTrueMaxPlayer || isReached;

    if (!isClaimed) {
        return Math.max(playerTH, nodeTH);
    }
    return nodeTH;
}

/**
 * Evaluates chest rewards for a single hero quest node based on TH level & mode.
 *
 * @param {number} thLevel - Town Hall level.
 * @param {'normal' | 'accelerated'} [mode='normal'] - Progression chest reward mode.
 * @returns {import('../../core/types.js').OreQuantity & Record<string, number>} Average and min/max ore rewards.
 */
export function getQuestChestReward(thLevel, mode = 'normal') {
    // TH must be between 8 and 18
    const thClamped = Math.max(8, Math.min(18, thLevel || 16));
    const table = mode === 'accelerated' ? oreChestRewardsAccelerated : oreChestRewardsNormal;
    const rewards = table[thClamped] || table[16];

    // Each quest grants 3 Ore Chests (1 Shiny, 1 Glowy, 1 Starry)
    return {
        shiny: Math.round(rewards.shiny.avg),
        glowy: Math.round(rewards.glowy.avg),
        starry: Math.round(rewards.starry.avg),
        minShiny: rewards.shiny.min,
        maxShiny: rewards.shiny.max,
        minGlowy: rewards.glowy.min,
        maxGlowy: rewards.glowy.max,
        minStarry: rewards.starry.min,
        maxStarry: rewards.starry.max
    };
}

/**
 * Calculates unclaimed / upcoming ores for the green +n badge in Stored Ores and core calculation deduction.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {import('../../core/types.js').OreQuantity} Upcoming ore quantities.
 */
export function calculateHeroJourneyUpcomingOres(state) {
    if (!hasSyncedHeroInfo(state)) {
        return {
            shiny: 0,
            glowy: 0,
            starry: 0
        };
    }

    const cumulativeLevel = getCumulativeHeroLevel(state);
    const isAccelerated = Boolean(state?.heroJourney?.acceleratedRewards ?? state?.heroJourney?.accelerated ?? (state?.heroJourney?.rewardMode === 'accelerated'));
    const mode = isAccelerated ? 'accelerated' : 'normal';
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    let upcomingShiny = 0;
    let upcomingGlowy = 0;
    let upcomingStarry = 0;

    const trackResolution = resolveHeroJourneyTrack(state);

    for (const node of heroJourneyNodes) {
        const isReached = cumulativeLevel >= node.level;
        const isClaimed = isTrueMaxPlayer || isReached;

        if (!isClaimed) {
            if (node.type === 'quest') {
                const effectiveTH = getEffectiveQuestNodeTH(node, state);
                const chestReward = getQuestChestReward(effectiveTH, mode);
                upcomingShiny += chestReward.shiny;
                upcomingGlowy += chestReward.glowy;
                upcomingStarry += chestReward.starry;
            } else if (node.type === 'ore') {
                const amount = node.amount || 0;
                if (node.resourceType === 'shiny') {
                    upcomingShiny += amount;
                } else if (node.resourceType === 'glowy') {
                    upcomingGlowy += amount;
                } else if (node.resourceType === 'starry') {
                    upcomingStarry += amount;
                }
            } else if (node.type === 'equipment') {
                const resolved = trackResolution[node.level];
                if (resolved?.isFallbackStarry) {
                    upcomingStarry += node.fallbackStarry || 50;
                }
            }
        }
    }

    return {
        shiny: upcomingShiny,
        glowy: upcomingGlowy,
        starry: upcomingStarry
    };
}
