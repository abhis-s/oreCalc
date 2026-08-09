import { heroJourneyNodes, oreChestRewardsNormal, oreChestRewardsAccelerated, heroMaxLevelsPerTH } from '../data/heroJourneyData.js';
import { heroData, getHeroEpicEquipmentPool } from '../data/heroData.js';
import { translate } from '../i18n/translator.js';

function getUserEquipmentState(heroState, eqKey) {
    if (!heroState?.equipment) return null;
    if (heroState.equipment[eqKey]) return heroState.equipment[eqKey];
    const translatedName = translate(`equipment.${eqKey}`);
    if (translatedName && heroState.equipment[translatedName]) {
        return heroState.equipment[translatedName];
    }
    return null;
}

/**
 * Calculates max cumulative hero levels reachable for each Town Hall level (minTH to maxTH).
 * Dynamically determines minTH and maxTH from dataset and supports fallback lookup down to minTH.
 */
export function getMaxCumulativeLevelsByTH() {
    let minTH = Infinity;
    let maxTH = 1;

    for (const heroKey in heroMaxLevelsPerTH) {
        const thObj = heroMaxLevelsPerTH[heroKey];
        if (thObj && typeof thObj === 'object') {
            for (const thKey in thObj) {
                const thNum = parseInt(thKey, 10);
                if (!isNaN(thNum)) {
                    if (thNum < minTH) minTH = thNum;
                    if (thNum > maxTH) maxTH = thNum;
                }
            }
        }
    }

    if (minTH === Infinity) minTH = 1;

    const getHeroMaxLevelWithFallback = (heroKey, th) => {
        const thObj = heroMaxLevelsPerTH[heroKey];
        if (!thObj) return 0;

        for (let currentTH = th; currentTH >= minTH; currentTH--) {
            if (thObj[currentTH] !== undefined && thObj[currentTH] !== null) {
                return parseInt(thObj[currentTH], 10) || 0;
            }
        }
        return 0;
    };

    const result = {};
    for (let th = minTH; th <= maxTH; th++) {
        let sum = 0;
        for (const heroKey in heroMaxLevelsPerTH) {
            sum += getHeroMaxLevelWithFallback(heroKey, th);
        }
        result[th] = sum;
    }
    return result;
}

/**
 * Get Town Hall level from state (or profile). Default to 16 if not set.
 */
export function getTownHallLevel(state) {
    if (state?.playerProfile?.townHallLevel) {
        return parseInt(state.playerProfile.townHallLevel, 10);
    }
    if (state?.income?.starBonus?.thUpgrades) {
        // Find highest TH level configured
        const ths = Object.keys(state.income.starBonus.thUpgrades).map(n => parseInt(n, 10));
        if (ths.length > 0) return Math.max(...ths);
    }
    return 16;
}

/**
 * Calculates current level of each hero, capped at Town Hall max level limit.
 */
export function getHeroLevels(state) {
    const thLevel = getTownHallLevel(state);
    const heroLevels = {
        barbarianKing: 0,
        archerQueen: 0,
        minionPrince: 0,
        grandWarden: 0,
        royalChampion: 0,
        dragonDuke: 0
    };

    // If profile exists with ownedHeroes map or array
    const rawHeroes = state?.playerProfile?.ownedHeroes || state?.playerProfile?.heroes;
    if (rawHeroes) {
        const heroEntries = Array.isArray(rawHeroes) ? rawHeroes : Object.entries(rawHeroes).map(([name, data]) => ({ name, ...data }));
        for (const hero of heroEntries) {
            let key = null;
            if (hero.name === "Barbarian King") key = "barbarianKing";
            else if (hero.name === "Archer Queen") key = "archerQueen";
            else if (hero.name === "Minion Prince") key = "minionPrince";
            else if (hero.name === "Grand Warden") key = "grandWarden";
            else if (hero.name === "Royal Champion") key = "royalChampion";
            else if (hero.name === "Dragon Duke") key = "dragonDuke";

            if (key) {
                const maxAllowed = heroMaxLevelsPerTH[key]?.[thLevel] ?? 100;
                heroLevels[key] = Math.min(hero.level || 0, maxAllowed);
            }
        }
    } else if (state?.heroes) {
        // Fallback using state.heroes enabled status or heroLevels state
        for (const heroKey in heroData) {
            const heroInfo = heroData[heroKey];
            const heroState = state.heroes[heroInfo.name];
            if (heroState && heroState.enabled !== false) {
                const levelInState = state.heroLevels?.[heroKey] ?? heroState.level ?? 1;
                const maxAllowed = heroMaxLevelsPerTH[heroKey]?.[thLevel] ?? 100;
                heroLevels[heroKey] = Math.min(levelInState, maxAllowed);
            }
        }
    }

    // Direct override from state.heroLevels if present
    if (state?.heroLevels) {
        for (const key in heroLevels) {
            if (state.heroLevels[key] !== undefined) {
                const maxAllowed = heroMaxLevelsPerTH[key]?.[thLevel] ?? 100;
                heroLevels[key] = Math.min(parseInt(state.heroLevels[key], 10) || 0, maxAllowed);
            }
        }
    }

    return heroLevels;
}

/**
 * Resolves the specific equipment reward (name, icon, level/fallback Starry Ore)
 * for Equipment milestone nodes based on player ownership state.
 */
export function getResolvedEquipmentReward(node, state) {
    if (node.type !== 'equipment' || !node.hero) return node;

    const pool = getHeroEpicEquipmentPool(node.hero);
    if (!pool || pool.length === 0) return node;

    // Determine hero slot index among all equipment nodes for this hero (sorted by level)
    const heroEquipmentNodes = heroJourneyNodes
        .filter(n => n.type === 'equipment' && n.hero === node.hero)
        .sort((a, b) => a.level - b.level);

    const slotIndex = heroEquipmentNodes.findIndex(n => n.level === node.level);
    const heroSlotIndex = slotIndex !== -1 ? slotIndex : 0;

    const heroNameMap = {
        barbarianKing: 'Barbarian King',
        archerQueen: 'Archer Queen',
        minionPrince: 'Minion Prince',
        grandWarden: 'Grand Warden',
        royalChampion: 'Royal Champion',
        dragonDuke: 'Dragon Duke'
    };

    const heroDisplayName = heroNameMap[node.hero];
    const heroState = state?.heroes?.[heroDisplayName];

    // Filter unowned equipment in pool order
    const unownedPool = [];
    for (const eq of pool) {
        const userEqState = getUserEquipmentState(heroState, eq.key);
        const isOwned = Boolean(userEqState && (userEqState.level > 1 || userEqState.unlocked === true));
        if (!isOwned) {
            unownedPool.push(eq);
        }
    }

    const targetLevel = node.equipmentLevel || '1';

    // 1. Primary Direct Match by heroJourneyNode key from heroData
    const directMatchEq = pool.find(eq => eq.heroJourneyNode === node.level);

    if (directMatchEq) {
        const userEqState = getUserEquipmentState(heroState, directMatchEq.key);
        const isOwned = Boolean(userEqState && (userEqState.level > 1 || userEqState.unlocked === true));

        return {
            ...node,
            resolvedKey: directMatchEq.key,
            resolvedName: translate(`equipment.${directMatchEq.key}`),
            resolvedIcon: directMatchEq.icon,
            equipmentLevel: targetLevel,
            isFallbackStarry: isOwned,
            isOwned: isOwned
        };
    }

    // 2. Fallback to unowned pool slot index for nodes without heroJourneyNode
    if (heroSlotIndex < unownedPool.length) {
        const targetEq = unownedPool[heroSlotIndex];
        return {
            ...node,
            resolvedKey: targetEq.key,
            resolvedName: translate(`equipment.${targetEq.key}`),
            resolvedIcon: targetEq.icon,
            equipmentLevel: targetLevel,
            isFallbackStarry: false,
            isOwned: false
        };
    }

    // 3. Fallback for unassigned nodes when all pool items are owned
    const defaultEq = pool[heroSlotIndex] || pool[pool.length - 1];
    return {
        ...node,
        resolvedKey: defaultEq.key,
        resolvedName: translate(`equipment.${defaultEq.key}`),
        resolvedIcon: defaultEq.icon,
        equipmentLevel: targetLevel,
        isFallbackStarry: true,
        isOwned: true
    };
}

/**
 * Calculates total cumulative hero level across all 6 heroes.
 */
export function getCumulativeHeroLevel(state) {
    const levels = getHeroLevels(state);
    return Object.values(levels).reduce((sum, lvl) => sum + lvl, 0);
}

/**
 * Evaluates chest rewards for a single hero quest node based on TH level & mode.
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
 * Filters out expired or invalid unclaimed node overrides from state.heroJourney.overrideUnclaimed.
 * An override expires when the player's cumulative hero level advances > 10 levels beyond the node level,
 * or when the player reaches true max level, or for invalid node types/future levels.
 */
export function cleanupHeroJourneyOverrides(state) {
    if (!state?.heroJourney?.overrideUnclaimed || !Array.isArray(state.heroJourney.overrideUnclaimed)) {
        return [];
    }

    const cumulativeLevel = getCumulativeHeroLevel(state);
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    if (isTrueMaxPlayer) {
        state.heroJourney.overrideUnclaimed = [];
        return [];
    }

    const validOverrides = state.heroJourney.overrideUnclaimed.filter(level => {
        const node = heroJourneyNodes.find(n => n.level === level);
        if (!node) return false;

        // Must be an allowed node type
        if (!['quest', 'ore', 'equipment'].includes(node.type)) return false;

        // Must be reached
        if (cumulativeLevel < level) return false;

        // Expiry boundary check: drop override if player is > 10 levels past node level
        if (cumulativeLevel - level > 10) return false;

        return true;
    });

    if (validOverrides.length !== state.heroJourney.overrideUnclaimed.length) {
        state.heroJourney.overrideUnclaimed = validOverrides;
    }

    return validOverrides;
}

/**
 * Calculates unclaimed / upcoming ores for the green +n badge in Stored Ores.
 */
export function calculateHeroJourneyUpcomingOres(state) {
    cleanupHeroJourneyOverrides(state);
    const cumulativeLevel = getCumulativeHeroLevel(state);
    const thLevel = getTownHallLevel(state);
    const isAccelerated = Boolean(state?.heroJourney?.acceleratedRewards ?? state?.heroJourney?.accelerated ?? (state?.heroJourney?.rewardMode === 'accelerated'));
    const mode = isAccelerated ? 'accelerated' : 'normal';
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    const overrideUnclaimedSet = new Set(state?.heroJourney?.overrideUnclaimed || []);

    let upcomingShiny = 0;
    let upcomingGlowy = 0;
    let upcomingStarry = 0;

    for (const node of heroJourneyNodes) {
        const isReached = cumulativeLevel >= node.level;
        const isClaimed = isTrueMaxPlayer || (isReached && !overrideUnclaimedSet.has(node.level));

        // If not claimed (whether reached or unreached/upcoming)
        if (!isClaimed) {
            if (node.type === 'quest') {
                const chestReward = getQuestChestReward(thLevel, mode);
                upcomingShiny += chestReward.shiny;
                upcomingGlowy += chestReward.glowy;
                upcomingStarry += chestReward.starry;
            } else if (node.type === 'equipment') {
                // If equipment node fallback applies (already owned) -> grants 50 starry ore
                upcomingStarry += node.fallbackStarry || 0;
            }
        }
    }

    return {
        shiny: upcomingShiny,
        glowy: upcomingGlowy,
        starry: upcomingStarry
    };
}
