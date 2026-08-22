import { getHeroEpicEquipmentPool, heroData } from '../../data/heroData.js';
import { heroJourneyNodes, oreChestRewardsAccelerated, oreChestRewardsNormal } from '../../data/heroJourneyData.js';

import {
    getCumulativeHeroLevel,
    getEquipmentUnlockLevelForTH,
    getHeroLevels,
    getMaxCumulativeLevelsByTH,
    getNodeTownHallLevel,
    getTownHallLevel,
    hasSyncedHeroInfo,
    isDefaultOrGuestPlayer
} from './heroJourneyLevels.js';

/**
 * Resolves equipment ownership state for a given hero equipment item.
 *
 * @param {any} heroState - In-memory state slice for the hero.
 * @param {string | { name?: string, key?: string }} eqObjOrKey - Equipment object or key name.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {import('../../core/types.js').EquipmentItem | null} Resolved equipment item or null if not found.
 */
function getUserEquipmentState(heroState, eqObjOrKey, state) {
    let eqKey = typeof eqObjOrKey === 'string' ? eqObjOrKey : eqObjOrKey?.key;
    let eqName = typeof eqObjOrKey === 'object' ? eqObjOrKey?.name : null;

    if (!eqName && eqKey) {
        for (const hKey in heroData) {
            const match = heroData[hKey]?.equipment?.find(e => e.key === eqKey || e.name === eqKey);
            if (match) {
                eqName = match.name;
                eqKey = match.key;
                break;
            }
        }
    }

    if (state?.playerProfile?.ownedEquipment) {
        const oe = state.playerProfile.ownedEquipment;
        if (eqName && oe[eqName] !== undefined) return { level: oe[eqName], isServerOwned: true, checked: true };
        if (eqKey && oe[eqKey] !== undefined) return { level: oe[eqKey], isServerOwned: true, checked: true };
    }

    if (state?.playerProfile?.ownedHeroes) {
        for (const heroName in state.playerProfile.ownedHeroes) {
            const h = state.playerProfile.ownedHeroes[heroName];
            if (h?.equipment && Array.isArray(h.equipment)) {
                const found = h.equipment.find(e => e.name === eqName || e.key === eqKey || e.name === eqKey);
                if (found) return { level: found.level, isServerOwned: true, checked: true };
            }
        }
    }

    if (heroState?.equipment) {
        const he = heroState.equipment;
        if (eqName && he[eqName]) return he[eqName];
        if (eqKey && he[eqKey]) return he[eqKey];
    }

    return null;
}

/**
 * Resolves the specific equipment reward (name, icon, level/fallback Starry Ore)
 * for Equipment milestone nodes based on player ownership state.
 *
 * @param {any} node - Hero's journey node configuration.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {any} Resolved node object with dynamic equipment metadata.
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
    const heroName = heroNameMap[node.hero] || node.hero;
    const heroState = state?.heroes?.[heroName];

    // Check which pool items are already owned by the player
    const unownedPoolItems = [];
    const ownedPoolItems = [];

    for (const item of pool) {
        const eqState = getUserEquipmentState(heroState, item, state);
        if (eqState && (eqState.level > 0 || eqState.isServerOwned || eqState.checked)) {
            ownedPoolItems.push({ item, level: eqState.level || 1 });
        } else {
            unownedPoolItems.push(item);
        }
    }

    let targetEquipment = null;
    let isFallbackStarry = false;
    let resolvedLevel = 1;
    let isDefaultServerOwned = false;

    if (unownedPoolItems.length > 0) {
        targetEquipment = unownedPoolItems[0];
        isFallbackStarry = false;
        const nodeTH = getNodeTownHallLevel(node.level);
        resolvedLevel = getEquipmentUnlockLevelForTH(nodeTH);
    } else {
        if (ownedPoolItems.length > 0) {
            const chosenIndex = heroSlotIndex % ownedPoolItems.length;
            targetEquipment = ownedPoolItems[chosenIndex].item;
            resolvedLevel = ownedPoolItems[chosenIndex].level;
        } else {
            const fallbackIndex = heroSlotIndex % pool.length;
            targetEquipment = pool[fallbackIndex];
            resolvedLevel = 1;
        }
        isFallbackStarry = true;
        isDefaultServerOwned = true;
    }

    return {
        ...node,
        resolvedName: targetEquipment.name,
        resolvedKey: targetEquipment.key,
        resolvedIcon: targetEquipment.icon,
        isFallbackStarry: isFallbackStarry,
        equipmentLevel: resolvedLevel,
        isOwned: isDefaultServerOwned
    };
}

/**
 * Resolves the effective Town Hall level for a quest node.
 * Claimed nodes reflect the node's original TH level (nodeTH).
 * Unclaimed nodes (unreached or overridden as unclaimed) scale to at minimum the player's current TH level (Math.max(playerTH, nodeTH)).
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
    const isOverrideUnclaimed = Boolean(state?.heroJourney?.overrideUnclaimed?.includes(node.level));
    const isClaimed = isTrueMaxPlayer || (isReached && !isOverrideUnclaimed);

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
 * Filters out expired or invalid unclaimed node overrides from state.heroJourney.overrideUnclaimed.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {number[]} Cleaned list of valid unclaimed override level thresholds.
 */
export function cleanupHeroJourneyOverrides(state) {
    if (!state?.heroJourney?.overrideUnclaimed || !Array.isArray(state.heroJourney.overrideUnclaimed)) {
        return [];
    }

    const isGuest = isDefaultOrGuestPlayer(state);
    const cumulativeLevel = getCumulativeHeroLevel(state);
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    if (isTrueMaxPlayer || isGuest) {
        return [];
    }

    return state.heroJourney.overrideUnclaimed.filter(level => {
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
}

/**
 * Resolves the default equipment unlock level for unowned equipment.
 *
 * @param {string} [heroNameOrKey] - Hero name or identifier.
 * @param {string | any} [equipNameOrKey] - Equipment name or object.
 * @returns {number} Default unlock level.
 */
export function getDefaultEquipmentUnlockLevel(heroNameOrKey, equipNameOrKey) {
    let eqKey = typeof equipNameOrKey === 'string' ? equipNameOrKey : equipNameOrKey?.key;
    let eqName = typeof equipNameOrKey === 'object' ? equipNameOrKey?.name : equipNameOrKey;

    let targetNodeLevel = null;

    for (const hKey in heroData) {
        const hero = heroData[hKey];
        if (!heroNameOrKey || hero.key === heroNameOrKey || hero.name === heroNameOrKey) {
            const eq = hero.equipment?.find(e => e.key === eqKey || e.name === eqName || e.key === equipNameOrKey || e.name === equipNameOrKey);
            if (eq) {
                if (eq.heroJourneyNode) {
                    targetNodeLevel = eq.heroJourneyNode;
                }
                break;
            }
        }
    }

    if (targetNodeLevel !== null) {
        const nodeTH = getNodeTownHallLevel(targetNodeLevel);
        return getEquipmentUnlockLevelForTH(nodeTH);
    }

    return 1;
}

/**
 * Checks whether an equipment item is owned strictly based on official server response data.
 *
 * @param {string | any} equipNameOrKey - Equipment name or key.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {boolean} Whether verified owned by server data.
 */
function isEquipmentServerOwned(equipNameOrKey, state) {
    if (!state?.playerProfile) {
        return false;
    }
    const equipName = typeof equipNameOrKey === 'string' ? equipNameOrKey : equipNameOrKey?.name;
    const equipKey = typeof equipNameOrKey === 'string' ? equipNameOrKey : equipNameOrKey?.key;

    if (state.playerProfile.ownedEquipment) {
        const oe = state.playerProfile.ownedEquipment;
        if (equipName && oe[equipName] !== undefined) return true;
        if (equipKey && oe[equipKey] !== undefined) return true;
        for (const hKey in heroData) {
            const match = heroData[hKey]?.equipment?.find(e => e.key === equipKey || e.name === equipName || e.key === equipName || e.name === equipKey);
            if (match) {
                if (oe[match.name] !== undefined || oe[match.key] !== undefined) return true;
            }
        }
    }

    if (state.playerProfile.ownedHeroes) {
        for (const hName in state.playerProfile.ownedHeroes) {
            const h = state.playerProfile.ownedHeroes[hName];
            if (h.equipment?.some(e => e.name === equipName || e.name === equipKey)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Checks whether an equipment item is unowned strictly based on official server response data.
 *
 * @param {string | any} equipName - Equipment name or key.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {boolean} Whether equipment is unowned.
 */
function isEquipmentServerUnowned(equipName, state) {
    return !isEquipmentServerOwned(equipName, state);
}

/**
 * Checks whether an equipment item corresponds to a future or unclaimed node in Hero's Journey (Filter 1).
 *
 * @param {string} heroNameOrKey - Hero name or identifier.
 * @param {string | any} equipNameOrKey - Equipment name or identifier.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {boolean} Whether node is future or unclaimed.
 */
export function isHeroJourneyFutureOrUnclaimedEquipment(heroNameOrKey, equipNameOrKey, state) {
    let targetNodeLevel = null;

    for (const hKey in heroData) {
        const hero = heroData[hKey];
        if (!heroNameOrKey || hero.key === heroNameOrKey || hero.name === heroNameOrKey) {
            const eq = hero.equipment?.find(e => e.key === equipNameOrKey || e.name === equipNameOrKey || e.key === equipNameOrKey?.key || e.name === equipNameOrKey?.name);
            if (eq) {
                targetNodeLevel = eq.heroJourneyNode || null;
                break;
            }
        }
    }

    if (!targetNodeLevel) return false;

    const cumulativeLevel = getCumulativeHeroLevel(state);
    const overrideUnclaimed = state?.heroJourney?.overrideUnclaimed || [];
    const isReached = cumulativeLevel >= targetNodeLevel;
    const isClaimed = isReached && !overrideUnclaimed.includes(targetNodeLevel);

    return !isClaimed;
}

/**
 * Evaluates whether auto unlock level should be applied.
 * @param {string} heroNameOrKey - Hero canonical name or camelCase key (e.g. 'Barbarian King' or 'barbarianKing').
 * @param {string | any} equipNameOrKey - Equipment name or key.
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {boolean} Whether auto-level adjustment applies.
 */
export function shouldApplyHeroJourneyAutoLevel(heroNameOrKey, equipNameOrKey, state) {
    const heroNameMap = {
        barbarianKing: 'Barbarian King',
        archerQueen: 'Archer Queen',
        minionPrince: 'Minion Prince',
        grandWarden: 'Grand Warden',
        royalChampion: 'Royal Champion',
        dragonDuke: 'Dragon Duke'
    };
    const resolvedHeroName = heroNameMap[heroNameOrKey] || heroNameOrKey;
    const equipName = typeof equipNameOrKey === 'string' ? equipNameOrKey : equipNameOrKey?.name;

    if (!isEquipmentServerUnowned(equipName, state)) {
        return false;
    }

    if (!isHeroJourneyFutureOrUnclaimedEquipment(resolvedHeroName, equipName, state)) {
        return false;
    }

    const isChecked = state?.heroes?.[resolvedHeroName]?.equipment?.[equipName]?.checked !== false;
    return !isChecked;
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

    const validOverrides = cleanupHeroJourneyOverrides(state);
    const cumulativeLevel = getCumulativeHeroLevel(state);
    const isAccelerated = Boolean(state?.heroJourney?.acceleratedRewards ?? state?.heroJourney?.accelerated ?? (state?.heroJourney?.rewardMode === 'accelerated'));
    const mode = isAccelerated ? 'accelerated' : 'normal';
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMaxValues = Object.values(maxLevelsByTH);
    const overallTrueMaxLevel = allMaxValues.length > 0 ? Math.max(...allMaxValues) : 0;
    const isTrueMaxPlayer = cumulativeLevel >= overallTrueMaxLevel && overallTrueMaxLevel > 0;

    const overrideUnclaimedSet = new Set(validOverrides);

    let upcomingShiny = 0;
    let upcomingGlowy = 0;
    let upcomingStarry = 0;

    for (const node of heroJourneyNodes) {
        const isReached = cumulativeLevel >= node.level;
        const isClaimed = isTrueMaxPlayer || (isReached && !overrideUnclaimedSet.has(node.level));

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
                const resolved = getResolvedEquipmentReward(node, state);
                if (resolved.isFallbackStarry) {
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
