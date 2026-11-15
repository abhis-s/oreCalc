/**
 * Central registry mapping Clash of Clans API troop names to canonical internal keys
 * and Town-Hall-gated Laboratory maximum levels for hero equipment spawned units.
 */

import { MAX_TOWN_HALL } from '../core/constants.js';

export const LAB_SCALING_TROOP_KEYS = {
    'Barbarian': 'barbarian',
    'Archer': 'archer'
};

const LAB_TROOP_MAX_LEVELS_BY_TH = Object.freeze({
    barbarian: Object.freeze({
        1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 5, 9: 6,
        10: 7, 11: 8, 12: 9, 13: 9, 14: 10, 15: 11, 16: 12, 17: 12, 18: 13, 19: 14
    }),
    archer: Object.freeze({
        1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 5, 9: 6,
        10: 7, 11: 8, 12: 9, 13: 9, 14: 10, 15: 11, 16: 12, 17: 13, 18: 14, 19: 15
    })
});

/**
 * Resolves the maximum Laboratory level for a spawned troop at a given Town Hall level.
 *
 * @param {string} unitType - Canonical unit key (e.g. 'barbarian', 'archer').
 * @param {number} [townHallLevel=MAX_TOWN_HALL] - Player Town Hall level.
 * @returns {number | null} Maximum unlocked level, or null if unitType has no TH table.
 */
export function getMaxLabTroopLevelForTownHall(unitType, townHallLevel = MAX_TOWN_HALL) {
    const thTable = LAB_TROOP_MAX_LEVELS_BY_TH[unitType];
    if (!thTable) return null;

    const rawTh = Math.floor(Number(townHallLevel) || MAX_TOWN_HALL);
    const boundedTh = Math.max(1, rawTh);
    for (let th = boundedTh; th >= 1; th--) {
        if (thTable[th] !== undefined) {
            return thTable[th];
        }
    }
    return 1;
}
