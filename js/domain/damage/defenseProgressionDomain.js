/**
 * Pure Mathematical Domain Calculations for Defense Progression, Stats, Hitpoints & Categorization.
 * Tier 2: Pure Domain Math (0 side effects, 0 DOM references, 0 browser globals).
 */

import { getDefensesData } from '../../data/defenseTargetsData.js';
import { battleModifiersData } from '../../data/battleModifiersData.js';

/**
 * Evaluates whether a specific Town Hall level functions as an active defense.
 * TH 12–17 are weaponized (Giga Tesla, Giga Inferno, Inferno Artillery) and act as defenses.
 * TH 1–11 are standard non-defensive buildings. TH 18 is also not a defense.
 *
 * @param {number|string|null|undefined} level - Town Hall level.
 * @returns {boolean} True if Town Hall level is between 12 and 17 (inclusive).
 */
export function isTownHallDefenseLevel(level) {
    const lvl = Number(level);
    return Number.isFinite(lvl) && lvl >= 12 && lvl <= 17;
}

/**
 * Evaluates whether a target entity or defense key is a defensive structure.
 * Defenses include regular defenses (subCategory 'defense'), crafted defenses ('crafted'),
 * and Town Hall levels 12–17.
 *
 * @param {string|Object} targetDefOrKey - Canonical defense key or definition object.
 * @param {number|Object} [targetLevelOrOptions=null] - Target level or options object containing level.
 * @returns {boolean} True if the target is a defense structure.
 */
export function isDefensiveStructure(targetDefOrKey, targetLevelOrOptions = null) {
    if (!targetDefOrKey) return false;
    const key = typeof targetDefOrKey === 'string' ? targetDefOrKey : (targetDefOrKey?.id || targetDefOrKey?.defenseKey);
    const def = (key && getDefensesData()[key]) ? getDefensesData()[key] : (typeof targetDefOrKey === 'object' ? targetDefOrKey : null);
    if (!def) return false;

    if (def.subCategory === 'defense' || def.subCategory === 'crafted') {
        return true;
    }

    if (def.subCategory === 'townhall' || def.id === 'town_hall' || key === 'town_hall') {
        let level = null;
        if (typeof targetLevelOrOptions === 'number') {
            level = targetLevelOrOptions;
        } else if (targetLevelOrOptions && typeof targetLevelOrOptions === 'object') {
            level = targetLevelOrOptions.level ?? targetLevelOrOptions.targetLevel ?? targetLevelOrOptions.defenseLevel ?? null;
        } else if (typeof targetDefOrKey === 'object' && targetDefOrKey !== null) {
            level = targetDefOrKey.level ?? targetDefOrKey.targetLevel ?? targetDefOrKey.defenseLevel ?? null;
        }
        return isTownHallDefenseLevel(level);
    }

    return false;
}

/**
 * Evaluates whether a hero equipment can target a specific defensive structure, building, hero, or guardian.
 * Seeking shield only targets defensive structures (regular defenses, crafted defenses, and Town Hall levels 12–17).
 * Spiky ball only targets buildings of all types (no heroes, no guardians).
 * Other equipment have no category targeting restrictions.
 *
 * @param {string} equipmentId - Canonical equipment identifier.
 * @param {string|Object} targetDefOrKey - Canonical defense key or building definition object.
 * @param {number|Object} [targetLevelOrOptions=null] - Target level number or options object containing level.
 * @returns {boolean} True if the equipment can target the entity; false otherwise.
 */
export function canEquipmentTarget(equipmentId, targetDefOrKey, targetLevelOrOptions = null) {
    if (!equipmentId || !targetDefOrKey) return false;
    const key = typeof targetDefOrKey === 'string' ? targetDefOrKey : (targetDefOrKey?.id || targetDefOrKey?.defenseKey);
    const def = (key && getDefensesData()[key]) ? getDefensesData()[key] : (typeof targetDefOrKey === 'object' ? targetDefOrKey : null);
    if (!def) return false;

    switch (equipmentId) {
        case 'seeking_shield': {
            return def.category === 'building' && isDefensiveStructure(targetDefOrKey, targetLevelOrOptions);
        }
        case 'spiky_ball': {
            return def.category === 'building';
        }
        default: {
            return true;
        }
    }
}

/**
 * Evaluates whether a target is a unit (defending hero or guardian) as opposed to a building structure.
 *
 * @param {string|Object} [targetDefOrKey] - Canonical defense key or target definition object.
 * @returns {boolean} True if target is a hero or guardian unit.
 */
export function isUnitTarget(targetDefOrKey) {
    if (!targetDefOrKey) return false;
    if (typeof targetDefOrKey === 'string') {
        if (targetDefOrKey === 'hero' || targetDefOrKey === 'guardian') return true;
        const def = getDefensesData()[targetDefOrKey];
        return def?.category === 'hero' || def?.category === 'guardian';
    }
    return targetDefOrKey.category === 'hero' || targetDefOrKey.category === 'guardian';
}

/**
 * Resolves the effective HP of a target structure based on level, weapon stars, and supercharge tier.
 *
 * @param {string} defenseKey - Defense identifier (e.g. 'air_defense', 'inferno_tower').
 * @param {number} level - Defense level.
 * @param {Object} [options={}]
 * @param {number} [options.superchargeTier=0] - Supercharge tier (0, 1, 2).
 * @param {number} [options.townHallStar=1] - TH17 weapon star (1 to 5).
 * @param {string} [options.modifier] - Optional battle modifier.
 * @param {string} [options.modifierKey] - Optional battle modifier key.
 * @param {string} [options.leagueId] - Optional league / modifier ID.
 * @returns {number} Effective hitpoints.
 */
export function getDefenseMaxHp(defenseKey, level, options = {}) {
    const def = getDefensesData()[defenseKey];
    if (!def || !def.levels) return 0;

    const lvlData = def.levels[level];
    if (!lvlData) return 0;

    let baseHp = lvlData.hp || 0;
    const tier = options.superchargeTier || 0;
    if (tier > 0 && lvlData.supercharges) {
        const tierKey = `tier${tier}`;
        if (lvlData.supercharges[tierKey]?.hp) {
            baseHp = lvlData.supercharges[tierKey].hp;
        }
    }

    const modifierKey = options.leagueId || options.modifierKey || options.modifier;
    if (modifierKey && modifierKey !== 'standard') {
        const league = battleModifiersData.leagues[modifierKey];
        if (league) {
            if (def.category === 'hero' && league.defHeroBonus) {
                return Math.round(baseHp * (1 + league.defHeroBonus));
            }
            if (def.category === 'guardian' && league.defGuardianBonus) {
                return Math.round(baseHp * (1 + league.defGuardianBonus));
            }
        }
    }

    return baseHp;
}

/**
 * Dynamically resolves the maximum supercharge tier available for a given defense and level.
 *
 * @param {string} defenseKey - Defense identifier.
 * @param {number} [level] - Defense level (defaults to maxLevel).
 * @returns {number} Maximum supercharge tier available, or 0 if not superchargeable.
 */
export function getMaxSuperchargeTier(defenseKey, level) {
    const def = getDefensesData()?.[defenseKey];
    if (!def || !def.levels) return 0;

    const targetLevel = level != null ? level : def.maxLevel;
    const lvlData = def.levels[targetLevel];
    if (!lvlData || !lvlData.supercharges) return 0;

    const tierNumbers = Object.keys(lvlData.supercharges)
        .map(key => {
            const match = key.match(/tier(\d+)/i);
            return match ? (Number(match[1]) || 0) : 0;
        })
        .filter(n => Number.isInteger(n) && n > 0);

    return tierNumbers.length > 0 ? Math.max(...tierNumbers) : 0;
}

/**
 * Dynamically resolves the maximum supercharge tier available across all defenses for a Town Hall level.
 *
 * @param {number} [townHallLevel=18] - Town Hall level.
 * @returns {number} Highest supercharge tier found across available defenses for this Town Hall.
 */
export function getMaxSuperchargeTierForTownHall(townHallLevel = 18) {
    let maxTier = 0;

    for (const def of Object.values(getDefensesData())) {
        if (!def.levels) continue;
        for (const lvlData of Object.values(def.levels)) {
            if (townHallLevel != null && lvlData.th && lvlData.th > townHallLevel) continue;
            if (!lvlData.supercharges) continue;

            const tierNumbers = Object.keys(lvlData.supercharges)
                .map(key => {
                    const match = key.match(/tier(\d+)/i);
                    return match ? (Number(match[1]) || 0) : 0;
                })
                .filter(n => Number.isInteger(n) && n > 0);

            if (tierNumbers.length > 0) {
                maxTier = Math.max(maxTier, ...tierNumbers);
            }
        }
    }

    return maxTier;
}

/**
 * Resolves the maximum available level and unlock status for a defense at a given Town Hall level.
 *
 * @param {string} defenseKey - Canonical defense identifier.
 * @param {number} [townHallLevel=18] - Target Town Hall level.
 * @returns {{ level: number, status: 'available' | 'locked' | 'sunset', minTH?: number, maxTH?: number } | null}
 */
export function getMaxDefenseLevelForTownHall(defenseKey, townHallLevel = 18) {
    const def = getDefensesData()[defenseKey];
    if (!def || !def.levels) return { level: 0, status: 'locked' };

    if (townHallLevel != null) {
        if (def.minTH && townHallLevel < def.minTH) {
            return { level: 0, status: 'locked', minTH: def.minTH };
        }
        if ('maxTH' in def && typeof def.maxTH === 'number' && townHallLevel > def.maxTH) {
            return { level: def.maxLevel, status: 'sunset', maxTH: def.maxTH };
        }
    }

    const availableLevels = Object.entries(def.levels)
        .filter(([_, lvlData]) => !townHallLevel || (lvlData.th && lvlData.th <= townHallLevel))
        .map(([lvl]) => Number(lvl));

    if (availableLevels.length === 0) return { level: 0, status: 'locked' };

    return {
        level: Math.max(...availableLevels),
        status: 'available'
    };
}

/**
 * Checks whether a defense is active and in season for a given reference date.
 * Permanent non-crafted defenses are always in season.
 * Crafted defenses are filtered primarily by end date (seasonExpires), with an optional start date (seasonStarts).
 *
 * @param {string|Object} defenseOrKey - Canonical defense key or defense data object.
 * @param {Date|string|number} [referenceDate=new Date()] - Reference timestamp or date to evaluate against.
 * @returns {boolean} True if the defense is in season and active.
 */
export function isDefenseInSeason(defenseOrKey, referenceDate = new Date()) {
    if (!defenseOrKey) return false;
    const def = typeof defenseOrKey === 'string' ? getDefensesData()[defenseOrKey] : defenseOrKey;
    if (!def) return false;

    // Standard non-crafted defenses without seasonal dates are permanently active
    if (def.subCategory !== 'crafted' && !def.seasonExpires && !def.seasonStarts) {
        return true;
    }

    const refTime = referenceDate instanceof Date
        ? referenceDate.getTime()
        : new Date(referenceDate).getTime();

    if (Number.isNaN(refTime)) return true;

    // Optional start date constraint: inactive before seasonStarts
    if (def.seasonStarts) {
        const startTime = new Date(def.seasonStarts).getTime();
        if (!Number.isNaN(startTime) && refTime < startTime) {
            return false;
        }
    }

    // Primary end date constraint: inactive after seasonExpires
    if (def.seasonExpires) {
        const expireTime = new Date(def.seasonExpires).getTime();
        if (!Number.isNaN(expireTime) && refTime > expireTime) {
            return false;
        }
    }

    return true;
}

/**
 * Resolves the default supercharge tier for a defense level and Town Hall.
 * For TH18, supercharging is the max level progression, defaulting to the maximum available tier.
 * For lower Town Halls or non-superchargeable structures, defaults to 0.
 *
 * @param {string} [defenseKey] - Optional defense identifier.
 * @param {number} [level] - Optional defense level.
 * @param {number} [townHallLevel=18] - Target Town Hall level.
 * @returns {number} Default supercharge tier.
 */
export function getDefaultSuperchargeTier(defenseKey, level, townHallLevel = 18) {
    if (townHallLevel < 18) return 0;

    if (defenseKey) {
        return getMaxSuperchargeTier(defenseKey, level);
    }

    return getMaxSuperchargeTierForTownHall(townHallLevel);
}

/**
 * Checks whether a defense structure is a defending hero.
 *
 * @param {string} defenseKey - Defense identifier.
 * @returns {boolean} True if the structure belongs to the hero category.
 */
export function isHeroDefense(defenseKey) {
    return getDefensesData()[defenseKey]?.category === 'hero';
}

/**
 * Resolves the absolute minimum selectable level for a defense.
 * For Builder's Huts, level 1 is non-defensive and unweaponized, so selectable levels start at 2.
 * For all other defenses and heroes, valid levels start at 1.
 *
 * @param {string} defenseKey - Canonical defense key.
 * @returns {number} Minimum selectable defense level.
 */
export function getMinDefenseLevel(defenseKey) {
    if (defenseKey === 'builders_hut') return 2;
    return 1;
}

/**
 * Resolves the valid selectable levels for a defense.
 * Defending heroes are restricted to level 1 and multiples of 5; standard defenses use continuous 1-step increments.
 *
 * @param {string} defenseKey - Defense identifier.
 * @param {number} [maxAllowedLevel] - Maximum level permitted by Town Hall or defense cap.
 * @returns {Array<number>} Array of valid integer levels.
 */
export function getValidDefenseLevels(defenseKey, maxAllowedLevel = null) {
    const def = getDefensesData()[defenseKey];
    const minLevel = getMinDefenseLevel(defenseKey);
    if (!def) return [minLevel];

    const maxCap = (maxAllowedLevel !== undefined && maxAllowedLevel !== null && Number(maxAllowedLevel) > 0)
        ? Math.min(Number(maxAllowedLevel), def.maxLevel || minLevel)
        : (def.maxLevel || minLevel);

    if (def.category === 'hero') {
        const levels = [1];
        for (let lvl = 5; lvl <= maxCap; lvl += 5) {
            levels.push(lvl);
        }
        return levels;
    }

    const levels = [];
    for (let lvl = minLevel; lvl <= maxCap; lvl++) {
        levels.push(lvl);
    }
    return levels;
}

/**
 * Snaps an arbitrary requested level to the nearest valid level for the defense.
 * For defending heroes, levels <= 2 snap to 1, and higher levels snap to the nearest multiple of 5.
 *
 * @param {string} defenseKey - Defense identifier.
 * @param {number} requestedLevel - Desired level value.
 * @param {number} [maxAllowedLevel] - Progression cap for the defense.
 * @returns {number} Valid snapped defense level.
 */
export function snapDefenseLevel(defenseKey, requestedLevel, maxAllowedLevel = null) {
    const def = getDefensesData()[defenseKey];
    const minLevel = getMinDefenseLevel(defenseKey);
    const maxCap = (maxAllowedLevel !== undefined && maxAllowedLevel !== null && Number(maxAllowedLevel) > 0)
        ? Math.min(Number(maxAllowedLevel), def?.maxLevel || minLevel)
        : (def?.maxLevel || minLevel);

    const raw = Number(requestedLevel) || minLevel;

    if (def?.category === 'hero') {
        if (raw <= 2) return 1;
        const rounded = Math.round(raw / 5) * 5;
        return Math.min(maxCap, Math.max(5, rounded));
    }

    return Math.max(minLevel, Math.min(maxCap, Math.round(raw)));
}

/**
 * Calculates the previous discrete level step below the current level.
 *
 * @param {string} defenseKey - Defense identifier.
 * @param {number} currentLevel - Current level.
 * @returns {number} Decremented valid level.
 */
export function getPrevDefenseLevel(defenseKey, currentLevel) {
    const def = getDefensesData()[defenseKey];
    const minLevel = getMinDefenseLevel(defenseKey);
    const raw = Number(currentLevel) || minLevel;

    if (def?.category === 'hero') {
        if (raw <= 5) return 1;
        return Math.max(5, Math.ceil(raw / 5) * 5 - 5);
    }

    return Math.max(minLevel, raw - 1);
}

/**
 * Calculates the next discrete level step above the current level.
 *
 * @param {string} defenseKey - Defense identifier.
 * @param {number} currentLevel - Current level.
 * @param {number} [maxAllowedLevel] - Maximum permissible level.
 * @returns {number} Incremented valid level.
 */
export function getNextDefenseLevel(defenseKey, currentLevel, maxAllowedLevel = null) {
    const def = getDefensesData()[defenseKey];
    const maxCap = (maxAllowedLevel !== undefined && maxAllowedLevel !== null && Number(maxAllowedLevel) > 0)
        ? Math.min(Number(maxAllowedLevel), def?.maxLevel || 1)
        : (def?.maxLevel || 1);

    const raw = Number(currentLevel) || 1;

    if (def?.category === 'hero') {
        if (raw < 5) return Math.min(maxCap, 5);
        return Math.min(maxCap, Math.floor(raw / 5) * 5 + 5);
    }

    return Math.min(maxCap, raw + 1);
}

let _defenseCanonicalIndices = null;
const getDefenseCanonicalIndices = () => {
    if (!_defenseCanonicalIndices) {
        _defenseCanonicalIndices = new Map(Object.keys(getDefensesData()).map((k, i) => [k, i]));
    }
    return _defenseCanonicalIndices;
};

/**
 * Resolves the presentation category tier for a defense or building structure.
 * 1: Defenses (including Clan Castle and Town Hall)
 * 2: Heroes
 * 3: Guardians
 * 4: Other building types (Storages)
 *
 * @param {string} key - Canonical building identifier.
 * @param {Object} [def] - Building definition object.
 * @returns {number} Category tier (1 to 4).
 */
export function getDefenseCategoryTier(key, def = getDefensesData()[key]) {
    if (def?.category === 'hero') return 2;
    if (def?.category === 'guardian') return 3;
    if (def?.subCategory === 'resource') return 4;
    if (def?.subCategory === 'defense' || def?.subCategory === 'crafted' || def?.subCategory === 'townhall' || def?.subCategory === 'cc') return 1;

    // Defensive fallbacks for safety
    if (key === 'town_hall' || key === 'clan_castle') return 1;
    if (key === 'gold_storage' || key === 'elixir_storage' || key === 'dark_elixir_storage' || def?.category === 'resource' || def?.category === 'storage') return 4;
    if (def?.category === 'defense' || def?.category === 'building') return 1;
    return 4;
}

/**
 * Resolves the category group identifier for a building at a given Town Hall level.
 * Segregates locked and sunset buildings into 'unavailable', and available buildings into
 * 'defenses', 'heroes', 'guardians', or 'other'.
 *
 * @param {string} key - Canonical building identifier.
 * @param {number} [townHallLevel=18] - Target Town Hall level.
 * @returns {'defenses' | 'heroes' | 'guardians' | 'other' | 'unavailable'} Group identifier.
 */
export function getBuildingGroupId(key, townHallLevel = 18) {
    const info = getMaxDefenseLevelForTownHall(key, townHallLevel);
    if (info?.status === 'locked' || info?.status === 'sunset') {
        return 'unavailable';
    }
    const tier = getDefenseCategoryTier(key);
    if (tier === 1) return 'defenses';
    if (tier === 2) return 'heroes';
    if (tier === 3) return 'guardians';
    return 'other';
}

/**
 * Partitions and sorts defenses and structures for the Edit Levels modal.
 * Segregates available entities into 4 category groups and groups all unavailable
 * (locked and sunset) entities under a unified 'unavailable' umbrella.
 *
 * @param {number} [currentTH=18] - Target Town Hall level.
 * @param {Date|string|number} [referenceDate=new Date()] - Reference date for seasonal filtering.
 * @returns {{
 *   defenses: Array<{ key: string, def: Object, info: Object }>,
 *   heroes: Array<{ key: string, def: Object, info: Object }>,
 *   guardians: Array<{ key: string, def: Object, info: Object }>,
 *   other: Array<{ key: string, def: Object, info: Object }>,
 *   unavailable: Array<{ key: string, def: Object, info: Object }>
 * }} Partitioned and sorted building groups.
 */
export function partitionDefensesForModal(currentTH = 18, referenceDate = new Date()) {
    const groups = {
        defenses: [],
        heroes: [],
        guardians: [],
        other: [],
        unavailable: []
    };

    const locked = [];
    const sunset = [];

    for (const [key, def] of Object.entries(getDefensesData())) {
        if (key === 'town_hall') continue; // Town Hall level is governed globally by the active Town Hall selector
        if (!isDefenseInSeason(def, referenceDate)) continue;
        const info = getMaxDefenseLevelForTownHall(key, currentTH);
        if (info?.status === 'locked') {
            locked.push({ key, def, info });
        } else if (info?.status === 'sunset') {
            sunset.push({ key, def, info });
        } else {
            const tier = getDefenseCategoryTier(key, def);
            if (tier === 1) groups.defenses.push({ key, def, info });
            else if (tier === 2) groups.heroes.push({ key, def, info });
            else if (tier === 3) groups.guardians.push({ key, def, info });
            else groups.other.push({ key, def, info });
        }
    }

    locked.sort((a, b) => {
        const minTHA = a.def.minTH ?? a.info?.minTH ?? 0;
        const minTHB = b.def.minTH ?? b.info?.minTH ?? 0;
        if (minTHA !== minTHB) return minTHA - minTHB;
        const tierA = getDefenseCategoryTier(a.key, a.def);
        const tierB = getDefenseCategoryTier(b.key, b.def);
        if (tierA !== tierB) return tierA - tierB;
        return (getDefenseCanonicalIndices().get(a.key) ?? 0) - (getDefenseCanonicalIndices().get(b.key) ?? 0);
    });

    sunset.sort((a, b) => {
        const maxTHA = a.def.maxTH ?? a.info?.maxTH ?? 0;
        const maxTHB = b.def.maxTH ?? b.info?.maxTH ?? 0;
        if (maxTHA !== maxTHB) return maxTHB - maxTHA;
        const tierA = getDefenseCategoryTier(a.key, a.def);
        const tierB = getDefenseCategoryTier(b.key, b.def);
        if (tierA !== tierB) return tierA - tierB;
        return (getDefenseCanonicalIndices().get(a.key) ?? 0) - (getDefenseCanonicalIndices().get(b.key) ?? 0);
    });

    groups.unavailable = [...locked, ...sunset];

    return groups;
}

/**
 * Comparator for sorting defenses and structures in unified listings.
 *
 * @param {string} keyA
 * @param {Object} defA
 * @param {string} keyB
 * @param {Object} defB
 * @param {number} [currentTH=18]
 * @returns {number}
 */
export function compareDefensesForDisplay(keyA, defA, keyB, defB, currentTH = 18) {
    const dA = defA || getDefensesData()[keyA] || {};
    const dB = defB || getDefensesData()[keyB] || {};
    const infoA = getMaxDefenseLevelForTownHall(keyA, currentTH);
    const infoB = getMaxDefenseLevelForTownHall(keyB, currentTH);
    const isUnavailableA = infoA?.status === 'locked' || infoA?.status === 'sunset';
    const isUnavailableB = infoB?.status === 'locked' || infoB?.status === 'sunset';

    if (isUnavailableA !== isUnavailableB) {
        return isUnavailableA ? 1 : -1;
    }

    if (!isUnavailableA) {
        const tierA = getDefenseCategoryTier(keyA, dA);
        const tierB = getDefenseCategoryTier(keyB, dB);
        if (tierA !== tierB) return tierA - tierB;
        return (getDefenseCanonicalIndices().get(keyA) ?? 0) - (getDefenseCanonicalIndices().get(keyB) ?? 0);
    }

    const isSunsetA = infoA?.status === 'sunset';
    const isSunsetB = infoB?.status === 'sunset';
    if (isSunsetA !== isSunsetB) {
        return isSunsetA ? 1 : -1;
    }

    if (infoA?.status === 'locked') {
        const minTHA = dA.minTH ?? infoA?.minTH ?? 0;
        const minTHB = dB.minTH ?? infoB?.minTH ?? 0;
        if (minTHA !== minTHB) return minTHA - minTHB;
    } else if (isSunsetA) {
        const maxTHA = dA.maxTH ?? infoA?.maxTH ?? 0;
        const maxTHB = dB.maxTH ?? infoB?.maxTH ?? 0;
        if (maxTHA !== maxTHB) return maxTHB - maxTHA;
    }

    const tierA = getDefenseCategoryTier(keyA, dA);
    const tierB = getDefenseCategoryTier(keyB, dB);
    if (tierA !== tierB) return tierA - tierB;
    return (getDefenseCanonicalIndices().get(keyA) ?? 0) - (getDefenseCanonicalIndices().get(keyB) ?? 0);
}
