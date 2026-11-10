import { deepFreeze } from '../../utils/objectUtils.js';

/**
 * Town Hall based daily Star Bonus ore reward specifications.
 * TH1-7 provide zero ores (ores unlock at Town Hall 8 in Clash of Clans).
 * Values for TH8 through TH18 represent canonical Supercell daily star bonus rewards.
 * @type {Readonly<Record<number, Readonly<{ shiny: number, glowy: number, starry: number }>>>}
 */
export const townHallStarBonusData = deepFreeze({
    1: { shiny: 0, glowy: 0, starry: 0 },
    2: { shiny: 0, glowy: 0, starry: 0 },
    3: { shiny: 0, glowy: 0, starry: 0 },
    4: { shiny: 0, glowy: 0, starry: 0 },
    5: { shiny: 0, glowy: 0, starry: 0 },
    6: { shiny: 0, glowy: 0, starry: 0 },
    7: { shiny: 0, glowy: 0, starry: 0 },
    8: { shiny: 480, glowy: 33, starry: 1 },
    9: { shiny: 630, glowy: 42, starry: 1 },
    10: { shiny: 760, glowy: 43, starry: 1 },
    11: { shiny: 860, glowy: 47, starry: 1 },
    12: { shiny: 950, glowy: 51, starry: 1 },
    13: { shiny: 1100, glowy: 56, starry: 1 },
    14: { shiny: 1100, glowy: 60, starry: 1 },
    15: { shiny: 1200, glowy: 66, starry: 2 },
    16: { shiny: 1300, glowy: 69, starry: 2 },
    17: { shiny: 1400, glowy: 78, starry: 2 },
    18: { shiny: 1500, glowy: 81, starry: 2 }
});

const MAX_SUPPORTED_TH = 18;

/**
 * Retrieves the base Star Bonus ore rewards for a given Town Hall level.
 * Falls back to maximum supported Town Hall (TH18) rewards for future unreleased Town Halls.
 *
 * @param {number | string} townHallLevel - Town Hall level.
 * @returns {Readonly<{ shiny: number, glowy: number, starry: number }>}
 */
export function getStarBonusForTownHall(townHallLevel) {
    const numericTH = Math.max(1, Number(townHallLevel) || 1);
    if (numericTH > MAX_SUPPORTED_TH) {
        return townHallStarBonusData[MAX_SUPPORTED_TH];
    }
    return townHallStarBonusData[numericTH] || townHallStarBonusData[1];
}
