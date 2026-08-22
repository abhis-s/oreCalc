import { heroData } from '../../data/heroData.js';
import { heroMaxLevelsPerTH } from '../../data/heroJourneyData.js';

let cachedMaxCumulativeLevelsByTH = null;

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

    cachedMaxCumulativeLevelsByTH = Object.freeze(result);
    return cachedMaxCumulativeLevelsByTH;
}

/**
 * Get Town Hall level from state (or profile). Default to 16 if not set.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {number} Active Town Hall level.
 */
export function getTownHallLevel(state) {
    if (state?.playerProfile?.townHallLevel) {
        return Number(state.playerProfile.townHallLevel) || 16;
    }
    if (state?.income?.starBonus?.thUpgrades) {
        const ths = Object.keys(state.income.starBonus.thUpgrades).map(Number);
        if (ths.length > 0) return Math.max(...ths);
    }
    return 16;
}

/**
 * Gets effective hero levels for the player based on state, clamped by current Town Hall limits.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {Record<string, number>} Map of hero key to clamped hero level.
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
 * Calculates total cumulative hero level across all 6 heroes.
 *
 * @param {import('../../core/types.js').AppState | any} state - Application state.
 * @returns {number} Sum of active hero levels.
 */
export function getCumulativeHeroLevel(state) {
    const levels = getHeroLevels(state);
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
