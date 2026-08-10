import { heroJourneyNodes, oreChestRewardsNormal, oreChestRewardsAccelerated, heroMaxLevelsPerTH } from '../data/heroJourneyData.js';
import { heroData, getHeroEpicEquipmentPool } from '../data/heroData.js';
import { translate } from '../i18n/translator.js';

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

    // 1. Direct Server API profile lookup in ownedEquipment map
    if (state?.playerProfile?.ownedEquipment) {
        const oe = state.playerProfile.ownedEquipment;
        if (eqName && oe[eqName] !== undefined) return { level: oe[eqName], isServerOwned: true, checked: true };
        if (eqKey && oe[eqKey] !== undefined) return { level: oe[eqKey], isServerOwned: true, checked: true };
        const translatedName = translate(`equipment.${eqKey}`);
        if (translatedName && oe[translatedName] !== undefined) return { level: oe[translatedName], isServerOwned: true, checked: true };
    }

    // 2. Direct Server API profile lookup in ownedHeroes equipment lists
    if (state?.playerProfile?.ownedHeroes) {
        for (const heroName in state.playerProfile.ownedHeroes) {
            const h = state.playerProfile.ownedHeroes[heroName];
            if (h?.equipment && Array.isArray(h.equipment)) {
                const found = h.equipment.find(e => e.name === eqName || e.name === eqKey);
                if (found) return { level: found.level, isServerOwned: true, checked: true };
            }
        }
    }

    // 3. Fallback to heroState.equipment (state.heroes[heroName].equipment)
    if (heroState?.equipment) {
        const he = heroState.equipment;
        if (eqName && he[eqName]) return he[eqName];
        if (eqKey && he[eqKey]) return he[eqKey];
        const translatedName = translate(`equipment.${eqKey}`);
        if (translatedName && he[translatedName]) return he[translatedName];
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
 * Gets effective hero levels for the player based on state, clamped by current Town Hall limits.
 */
export function getHeroLevels(state) {
    const thLevel = getTownHallLevel(state);
    const heroLevels = { barbarianKing: 0, archerQueen: 0, minionPrince: 0, grandWarden: 0, royalChampion: 0, dragonDuke: 0 };

    if (state?.playerProfile?.ownedHeroes) {
        for (const heroName in state.playerProfile.ownedHeroes) {
            const hero = state.playerProfile.ownedHeroes[heroName];
            let key = null;
            if (heroName === "Barbarian King") key = "barbarianKing";
            else if (heroName === "Archer Queen") key = "archerQueen";
            else if (heroName === "Minion Prince") key = "minionPrince";
            else if (heroName === "Grand Warden") key = "grandWarden";
            else if (heroName === "Royal Champion") key = "royalChampion";
            else if (heroName === "Dragon Duke") key = "dragonDuke";

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
        const userEqState = getUserEquipmentState(heroState, eq, state);
        const isOwned = Boolean(userEqState && (userEqState.isServerOwned || userEqState.checked !== false));
        if (!isOwned) {
            unownedPool.push(eq);
        }
    }

    const nodeTH = getNodeTownHallLevel(node.level);
    const targetLevel = node.equipmentLevel || String(getEquipmentUnlockLevelForTH(nodeTH));

    // 1. Primary Direct Match by heroJourneyNode key from heroData
    const directMatchEq = pool.find(eq => eq.heroJourneyNode === node.level);

    if (directMatchEq) {
        const isServerOwned = isEquipmentServerOwned(directMatchEq.name, state);

        return {
            ...node,
            resolvedKey: directMatchEq.key,
            resolvedName: translate(`equipment.${directMatchEq.key}`),
            resolvedIcon: directMatchEq.icon,
            equipmentLevel: targetLevel,
            isFallbackStarry: isServerOwned,
            isOwned: isServerOwned
        };
    }

    // 2. Fallback for unassigned nodes
    const defaultEq = pool[heroSlotIndex] || pool[pool.length - 1];
    const isDefaultServerOwned = defaultEq ? isEquipmentServerOwned(defaultEq.name, state) : false;
    return {
        ...node,
        resolvedKey: defaultEq?.key,
        resolvedName: defaultEq ? translate(`equipment.${defaultEq.key}`) : '',
        resolvedIcon: defaultEq?.icon,
        equipmentLevel: targetLevel,
        isFallbackStarry: isDefaultServerOwned,
        isOwned: isDefaultServerOwned
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
 * Determines the Town Hall level corresponding to a specific Hero's Journey node level.
 * Maps cumulative hero level thresholds to Town Hall max cumulative hero level caps.
 */
export function getNodeTownHallLevel(nodeLevel) {
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const sortedTHs = Object.keys(maxLevelsByTH).map(Number).sort((a, b) => a - b);
    for (const th of sortedTHs) {
        if (maxLevelsByTH[th] >= nodeLevel) {
            return Math.max(8, Math.min(18, th));
        }
    }
    return 18;
}

/**
 * Resolves the default equipment unlock starting level based on Town Hall level.
 * TH8 -> Lvl 1
 * TH9 -> Lvl 6
 * TH10 -> Lvl 9
 * TH11-13 -> Lvl 12
 * TH14+ -> Lvl 15
 */
export function getEquipmentUnlockLevelForTH(thLevel) {
    if (thLevel <= 8) {
        return 1;
    } else if (thLevel === 9) {
        return 6;
    } else if (thLevel === 10) {
        return 9;
    } else if (thLevel <= 13) {
        return 12;
    } else {
        return 15;
    }
}

/**
 * Resolves the effective Town Hall level for a quest node.
 * Claimed nodes reflect the node's original TH level (nodeTH).
 * Unclaimed nodes (unreached or overridden as unclaimed) scale to at minimum the player's current TH level (Math.max(playerTH, nodeTH)).
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
 * Helper to determine if the active player is a default/guest profile (e.g. DEFAULT0, no tag, or guest).
 */
export function isDefaultOrGuestPlayer(state) {
    const activeTag = state?.playerProfile?.tag || state?.savedPlayerTags?.[0];
    if (!activeTag) return true;
    const upper = String(activeTag).toUpperCase();
    return upper === 'DEFAULT0' || upper.startsWith('DEFAULT') || upper.startsWith('GUEST');
}

/**
 * Checks whether the active player profile has synced hero information from the official API.
 * Returns false for guest / DEFAULT0 profiles or profiles with no hero data.
 */
export function hasSyncedHeroInfo(state) {
    if (!state?.playerProfile) return false;
    const tag = state.playerProfile.tag || state.savedPlayerTags?.[0];
    if (!tag || tag === 'DEFAULT0' || tag.toUpperCase().startsWith('DEFAULT') || tag.toUpperCase().startsWith('GUEST')) {
        return false;
    }
    const ownedHeroes = state.playerProfile.ownedHeroes;
    if (!ownedHeroes || (typeof ownedHeroes === 'object' && Object.keys(ownedHeroes).length === 0)) {
        return false;
    }
    return true;
}

/**
 * Filters out expired or invalid unclaimed node overrides from state.heroJourney.overrideUnclaimed.
 * An override expires when the player's cumulative hero level advances > 10 levels beyond the node level,
 * or when the player reaches true max level, or for DEFAULT0/guest tags, or for invalid node types/future levels.
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
 * Resolves the default equipment unlock level for unowned equipment.
 * For Hero's Journey equipment nodes, returns the TH milestone level (Lvl 1, 6, 9, 12, 15).
 * For other equipment, returns 1.
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
 */
export function isEquipmentServerOwned(equipNameOrKey, state) {
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
 * If equipment is owned as per server response, returns false.
 */
export function isEquipmentServerUnowned(equipName, state) {
    return !isEquipmentServerOwned(equipName, state);
}

/**
 * Checks whether an equipment item corresponds to a future or unclaimed node in Hero's Journey (Filter 1).
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
 * Evaluates whether auto unlock level should be applied according to:
 * Filter 1: Equipment is in future node or unclaimed node.
 * Filter 2: Equipment is unowned (decided based on server response only).
 * Post-condition: If 1 & 2 pass, apply level if disabled (checked === false); do not apply if enabled.
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

    // Filter 2: Must be unowned strictly based on server response
    if (!isEquipmentServerUnowned(equipName, state)) {
        return false;
    }

    // Filter 1: Must be in a future node or unclaimed node
    if (!isHeroJourneyFutureOrUnclaimedEquipment(resolvedHeroName, equipName, state)) {
        return false;
    }

    // Post-condition: Apply only if disabled (checked === false)
    const isChecked = state?.heroes?.[resolvedHeroName]?.equipment?.[equipName]?.checked !== false;
    return !isChecked;
}

/**
 * Calculates unclaimed / upcoming ores for the green +n badge in Stored Ores and core calculation deduction.
 */
export function calculateHeroJourneyUpcomingOres(state) {
    if (!hasSyncedHeroInfo(state)) {
        return {
            shiny: 0,
            glowy: 0,
            starry: 0
        };
    }

    cleanupHeroJourneyOverrides(state);
    const cumulativeLevel = getCumulativeHeroLevel(state);
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
