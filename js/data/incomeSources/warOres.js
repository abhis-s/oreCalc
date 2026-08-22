import { deepFreeze } from '../../utils/objectUtils.js';

/**
 * Game data for Clan War and CWL ore values per Town Hall level,
 * including absolute maximum limits.
 */
export const warOreTownHallValues = deepFreeze({
    shiny: {
        8: 380, 9: 410, 10: 460, 11: 560, 12: 610, 13: 710, 14: 810, 15: 960, 16: 1110
    },
    glowy: {
        8: 15, 9: 18, 10: 21, 11: 24, 12: 27, 13: 30, 14: 33, 15: 36, 16: 39
    },
    starry: {
        8: 0, 9: 0, 10: 3, 11: 3, 12: 4, 13: 4, 14: 5, 15: 5, 16: 6
    }
});

export const WAR_ORE_MAX_LIMITS = deepFreeze({
    shiny: 1110,
    glowy: 39,
    starry: 6
});

/**
 * Retrieves the war/CWL ore reward per attack for a given ore type and Town Hall level.
 * Clamps thLevel to the available range in warOreTownHallValues (8-16).
 *
 * @param {'shiny' | 'glowy' | 'starry' | string} oreType - Ore identifier.
 * @param {number | string} thLevel - Town Hall level.
 * @returns {number} Ore reward per attack.
 */
export function getWarOreValue(oreType, thLevel) {
    const table = warOreTownHallValues[oreType];
    if (!table) return 0;
    const numericTH = Number(thLevel);
    if (isNaN(numericTH)) return 0;
    const ths = Object.keys(table).map(Number);
    const minTH = Math.min(...ths);
    const maxTH = Math.max(...ths);
    const clampedTH = Math.min(Math.max(numericTH, minTH), maxTH);
    return table[clampedTH] ?? 0;
}
