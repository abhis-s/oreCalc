import { MAX_TOWN_HALL } from '../../core/constants.js';
import { heroData } from '../../data/heroData.js';
import { heroMaxLevelsPerTH } from '../../data/heroJourneyData.js';

let cachedMaxCumulativeLevelsByTH = null;

/**
 * Resolves a hero's max level at a given Town Hall by walking down to the highest defined TH cap.
 *
 * @param {string} heroKey - Canonical hero key in heroMaxLevelsPerTH.
 * @param {number} thLevel - Target Town Hall level.
 * @returns {number} Maximum hero level unlocked at or below thLevel.
 */
function getHeroMaxLevelForTH(heroKey, thLevel) {
    const thObj = heroMaxLevelsPerTH[heroKey];
    if (!thObj) return 0;

    const targetTH = Math.floor(Number(thLevel) || 0);
    for (let currentTH = targetTH; currentTH >= 1; currentTH--) {
        if (thObj[currentTH] !== undefined && thObj[currentTH] !== null) {
            return Number(thObj[currentTH]) || 0;
        }
    }
    return 0;
}

/**
 * Calculates max cumulative hero levels reachable for each Town Hall level (minTH to maxTH).
 * Dynamically determines minTH and maxTH from dataset and supports fallback lookup down to minTH.
 *
 * @returns {Readonly<Record<number, number>>} Memoized map of TH level to cumulative max hero levels.
 */
export function getMaxCumulativeLevelsByTH() {
    if (cachedMaxCumulativeLevelsByTH) {
        return cachedMaxCumulativeLevelsByTH;
    }

    let minTH = Infinity;
    let maxTH = 1;

    for (const heroKey in heroMaxLevelsPerTH) {
        const thObj = heroMaxLevelsPerTH[heroKey];
        if (thObj && typeof thObj === 'object') {
            for (const thKey in thObj) {
                const thNum = Number(thKey);
                if (!Number.isNaN(thNum)) {
                    if (thNum < minTH) minTH = thNum;
                    if (thNum > maxTH) maxTH = thNum;
                }
            }
        }
    }

    if (minTH === Infinity) minTH = 1;

    const result = {};
    for (let th = minTH; th <= maxTH; th++) {
        let sum = 0;
        for (const heroKey in heroMaxLevelsPerTH) {
            sum += getHeroMaxLevelForTH(heroKey, th);
        }
        result[th] = sum;
    }

    cachedMaxCumulativeLevelsByTH = Object.freeze(result);
    return cachedMaxCumulativeLevelsByTH;
}

const HERO_NAME_TO_KEY = Object.freeze({
    'Barbarian King': 'barbarianKing',
    'Archer Queen': 'archerQueen',
    'Minion Prince': 'minionPrince',
    'Grand Warden': 'grandWarden',
    'Royal Champion': 'royalChampion',
    'Dragon Duke': 'dragonDuke'
});

/**
 * Resolves the maximum cumulative hero level cap for a Town Hall by walking down to the highest defined cap.
 *
 * @param {number|string} thLevel - Target Town Hall level.
 * @returns {number} Cumulative hero level cap unlocked at or below thLevel.
 */
export function getMaxCumulativeLevelForTH(thLevel) {
    const levelsMap = getMaxCumulativeLevelsByTH();
    const targetTH = Math.floor(Number(thLevel) || 0);
    for (let currentTH = targetTH; currentTH >= 1; currentTH--) {
        if (levelsMap[currentTH] !== undefined) {
            return levelsMap[currentTH];
        }
    }
    return 0;
}

/**
 * Resolves maximum Town Hall level currently defined in Hero Journey data.
 * @returns {number} Maximum Town Hall level.
 */
export function getMaxTownHallLevel() {
    const levelsMap = getMaxCumulativeLevelsByTH();
    const thKeys = Object.keys(levelsMap).map(Number);
    return thKeys.length > 0 ? Math.max(...thKeys) : MAX_TOWN_HALL;
}

/**
 * Resolves maximum cumulative hero level defined across all heroes at the highest configured Town Hall.
 *
 * @returns {number} Maximum cumulative hero level.
 */
export function getMaxCumulativeHeroLevel() {
    const levelsMap = getMaxCumulativeLevelsByTH();
    const vals = Object.values(levelsMap).map(Number).filter(n => Number.isFinite(n) && n > 0);
    return vals.length > 0 ? Math.max(...vals) : 480;
}

/**
 * Get Town Hall level from state (or profile). Defaults dynamically to the maximum Town Hall level if not set.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {number} Active Town Hall level.
 */
export function getTownHallLevel(state) {
    const maxTH = getMaxTownHallLevel();
    if (state?.playerProfile?.townHallLevel || state?.playerProfile?.townHall) {
        return Number(state.playerProfile.townHallLevel || state.playerProfile.townHall) || maxTH;
    }
    if (state?.income?.starBonus?.thUpgrades) {
        const ths = Object.keys(state.income.starBonus.thUpgrades).map(Number);
        if (ths.length > 0) return Math.max(...ths);
    }
    return maxTH;
}

/**
 * Gets effective hero levels for the player based on state, optionally clamped by current Town Hall limits.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @param {boolean} [clampToTH=true] - Whether to clamp individual hero levels to Town Hall track caps.
 * @returns {Record<string, number>} Map of hero key to hero level.
 */
function getHeroLevels(state, clampToTH = true) {
    const thLevel = getTownHallLevel(state);
    const heroLevels = { barbarianKing: 0, archerQueen: 0, minionPrince: 0, grandWarden: 0, royalChampion: 0, dragonDuke: 0 };

    const assignHeroLevel = (key, rawLevel) => {
        const level = Math.max(0, Number(rawLevel) || 0);
        if (!clampToTH) {
            heroLevels[key] = level;
            return;
        }
        const maxAllowed = getHeroMaxLevelForTH(key, thLevel);
        heroLevels[key] = Math.min(level, maxAllowed);
    };

    if (state?.playerProfile?.ownedHeroes && typeof state.playerProfile.ownedHeroes === 'object' && !Array.isArray(state.playerProfile.ownedHeroes) && Object.keys(state.playerProfile.ownedHeroes).length > 0) {
        for (const heroName in state.playerProfile.ownedHeroes) {
            const hero = state.playerProfile.ownedHeroes[heroName];
            const key = HERO_NAME_TO_KEY[heroName];
            if (key) {
                assignHeroLevel(key, hero?.level);
            }
        }
    } else if (Array.isArray(state?.playerProfile?.heroes) || Array.isArray(state?.heroes)) {
        const heroesArray = Array.isArray(state?.playerProfile?.heroes) ? state.playerProfile.heroes : state.heroes;
        const homeHeroes = heroesArray.filter(h => h.village === 'home' || !h.village);
        for (const hero of homeHeroes) {
            const key = HERO_NAME_TO_KEY[hero?.name];
            if (key) {
                assignHeroLevel(key, hero.level);
            }
        }
    } else if (state?.heroes) {
        for (const heroKey in heroData) {
            const heroInfo = heroData[heroKey];
            const heroState = state.heroes[heroInfo.name];
            if (heroState && heroState.enabled !== false) {
                const levelInState = state.heroLevels?.[heroKey] ?? heroState.level ?? 1;
                assignHeroLevel(heroKey, levelInState);
            }
        }
    }

    if (state?.heroLevels) {
        for (const key in heroLevels) {
            if (state.heroLevels[key] !== undefined) {
                assignHeroLevel(key, state.heroLevels[key]);
            }
        }
    }

    return heroLevels;
}

/**
 * Calculates total cumulative hero level across all 6 heroes, clamped to defined Town Hall Hero Journey caps.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {number} Sum of clamped hero levels.
 */
export function getCumulativeHeroLevel(state) {
    const levels = getHeroLevels(state, true);
    return Object.values(levels).reduce((sum, lvl) => sum + lvl, 0);
}

/**
 * Calculates uncapped cumulative hero level across all 6 heroes for user-facing progress display.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {number} Uncapped sum of active hero levels.
 */
export function getRawCumulativeHeroLevel(state) {
    const levels = getHeroLevels(state, false);
    return Object.values(levels).reduce((sum, lvl) => sum + lvl, 0);
}

/**
 * Determines the Town Hall level corresponding to a specific Hero's Journey node level.
 * Maps cumulative hero level thresholds to Town Hall max cumulative hero level caps.
 *
 * @param {number} nodeLevel - Milestone node level threshold.
 * @returns {number} Clamped Town Hall level (8-18).
 */
export function getNodeTownHallLevel(nodeLevel) {
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const maxTH = getMaxTownHallLevel();
    const sortedTHs = Object.keys(maxLevelsByTH).map(Number).sort((a, b) => a - b);
    for (const th of sortedTHs) {
        if (maxLevelsByTH[th] >= nodeLevel) {
            return Math.max(7, Math.min(maxTH, th));
        }
    }
    return maxTH;
}

/**
 * Resolves the starting cumulative level for a Town Hall tier.
 *
 * @param {number} th - Town Hall level (7-18).
 * @returns {number} Starting cumulative level for this TH tier.
 */
export function getTownHallStartLevel(th) {
    if (th <= 7) return 1;
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const prevMax = maxLevelsByTH[th - 1];
    return prevMax ? (prevMax + 1) : 1;
}

/**
 * Resolves the default equipment unlock starting level based on Town Hall level.
 *
 * @param {number} thLevel - Town hall level.
 * @returns {number} Starting unlock level.
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
 * Helper to determine if the active player is a default/guest profile.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {boolean} Whether player is default or guest.
 */
export function isDefaultOrGuestPlayer(state) {
    const activeTag = state?.playerProfile?.tag || state?.savedPlayerTags?.[0];
    if (!activeTag) return true;
    const upper = String(activeTag).toUpperCase();
    return upper === 'DEFAULT0' || upper.startsWith('DEFAULT') || upper.startsWith('GUEST');
}

/**
 * Checks whether the active player profile has synced hero information from the official API.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {boolean} Whether player has synced official hero data.
 */
export function hasSyncedHeroInfo(state) {
    const profile = state?.playerProfile || (state?.savedPlayerTags?.[0] ? state?.allPlayersData?.[state.savedPlayerTags[0]]?.playerProfile : null);
    if (!profile) return false;
    const tag = profile.tag || state?.savedPlayerTags?.[0];
    if (!tag || tag === 'DEFAULT0' || tag.toUpperCase().startsWith('DEFAULT') || tag.toUpperCase().startsWith('GUEST')) {
        return false;
    }
    return true;
}

/**
 * Checks whether a cumulative hero level has reached true max (max hero levels allowed by max Town Hall).
 *
 * @param {number} cumulativeLevel - Total hero levels.
 * @returns {boolean} Whether player has reached true max.
 */
export function isTrueMaxCumulativeLevel(cumulativeLevel) {
    const maxLevelsByTH = getMaxCumulativeLevelsByTH();
    const allMax = Object.values(maxLevelsByTH);
    const overallMax = allMax.length > 0 ? Math.max(...allMax) : 0;
    return cumulativeLevel >= overallMax && overallMax > 0;
}
