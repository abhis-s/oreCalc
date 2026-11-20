export const EQUIPMENT_STATS_LAST_UPDATED = "2026-11-17";
export const EQUIPMENT_RECOMMENDATIONS_LAST_UPDATED = "2026-10-31";

const CLASSIC_UPGRADE_COSTS = {
    2: { shiny: 120, glowy: 0, starry: 0 }, 3: { shiny: 240, glowy: 20, starry: 0 },
    4: { shiny: 400, glowy: 0, starry: 0 }, 5: { shiny: 600, glowy: 0, starry: 0 },
    6: { shiny: 840, glowy: 100, starry: 0 }, 7: { shiny: 1120, glowy: 0, starry: 0 },
    8: { shiny: 1440, glowy: 0, starry: 0 }, 9: { shiny: 1800, glowy: 200, starry: 10 },
    10: { shiny: 1900, glowy: 0, starry: 0 }, 11: { shiny: 2000, glowy: 0, starry: 0 },
    12: { shiny: 2100, glowy: 400, starry: 20 }, 13: { shiny: 2200, glowy: 0, starry: 0 },
    14: { shiny: 2300, glowy: 0, starry: 0 }, 15: { shiny: 2400, glowy: 600, starry: 30 },
    16: { shiny: 2500, glowy: 0, starry: 0 }, 17: { shiny: 2600, glowy: 0, starry: 0 },
    18: { shiny: 2700, glowy: 600, starry: 50 }, 19: { shiny: 2800, glowy: 0, starry: 0 },
    20: { shiny: 2900, glowy: 0, starry: 0 }, 21: { shiny: 3000, glowy: 600, starry: 100 },
    22: { shiny: 3100, glowy: 0, starry: 0 }, 23: { shiny: 3200, glowy: 0, starry: 0 },
    24: { shiny: 3300, glowy: 600, starry: 120 }, 25: { shiny: 3400, glowy: 0, starry: 0 },
    26: { shiny: 3500, glowy: 0, starry: 0 }, 27: { shiny: 3600, glowy: 600, starry: 150 },
};

const MODERN_UPGRADE_COSTS = {
    2: { shiny: 120, glowy: 0, starry: 0 }, 3: { shiny: 240, glowy: 20, starry: 0 },
    4: { shiny: 400, glowy: 0, starry: 0 }, 5: { shiny: 600, glowy: 0, starry: 0 },
    6: { shiny: 840, glowy: 50, starry: 0 }, 7: { shiny: 1120, glowy: 0, starry: 0 },
    8: { shiny: 1440, glowy: 0, starry: 0 }, 9: { shiny: 1800, glowy: 100, starry: 10 },
    10: { shiny: 1900, glowy: 0, starry: 0 }, 11: { shiny: 2000, glowy: 0, starry: 0 },
    12: { shiny: 2100, glowy: 250, starry: 15 }, 13: { shiny: 2200, glowy: 0, starry: 0 },
    14: { shiny: 2300, glowy: 0, starry: 0 }, 15: { shiny: 2400, glowy: 450, starry: 30 },
    16: { shiny: 2500, glowy: 0, starry: 0 }, 17: { shiny: 2600, glowy: 0, starry: 0 },
    18: { shiny: 2700, glowy: 600, starry: 50 }, 19: { shiny: 2800, glowy: 0, starry: 0 },
    20: { shiny: 2900, glowy: 0, starry: 0 }, 21: { shiny: 3000, glowy: 650, starry: 90 },
    22: { shiny: 3100, glowy: 0, starry: 0 }, 23: { shiny: 3200, glowy: 0, starry: 0 },
    24: { shiny: 3300, glowy: 700, starry: 110 }, 25: { shiny: 3400, glowy: 0, starry: 0 },
    26: { shiny: 3500, glowy: 0, starry: 0 }, 27: { shiny: 3600, glowy: 730, starry: 125 },
    28: { shiny: 3700, glowy: 0, starry: 0 }, 29: { shiny: 3800, glowy: 0, starry: 0 },
    30: { shiny: 3900, glowy: 760, starry: 135 }, 31: { shiny: 4000, glowy: 0, starry: 0 },
    32: { shiny: 4100, glowy: 0, starry: 0 }, 33: { shiny: 4200, glowy: 790, starry: 140 },
};

export const heroUnlockTownHallMap = {
    barbarianKing: 4,
    archerQueen: 8,
    minionPrince: 9,
    grandWarden: 11,
    royalChampion: 13,
    dragonDuke: 15
};

const townHallCapsMap = {
    8: { commonMax: 9, epicMax: 12, legendaryMax: 12, unlocks: ['Earthquake Boots', 'Blizzard Axe'] },
    9: { commonMax: 9, epicMax: 12, legendaryMax: 12, unlocks: ['Giant Arrow'] },
    10: { commonMax: 12, epicMax: 15, legendaryMax: 15, unlocks: ['Vampstache', 'Metal Pants'] },
    11: { commonMax: 12, epicMax: 15, legendaryMax: 15, unlocks: ['Rage Gem'] },
    12: { commonMax: 15, epicMax: 18, legendaryMax: 18, unlocks: ['Healer Puppet', 'Noble Iron'] },
    13: { commonMax: 15, epicMax: 18, legendaryMax: 18, unlocks: ['Healing Tome'] },
    14: { commonMax: 18, epicMax: 21, legendaryMax: 21, unlocks: ['Hog Rider Puppet'] },
    15: { commonMax: 18, epicMax: 24, legendaryMax: 24, unlocks: ['Haste Vial'] },
    16: { commonMax: 18, epicMax: 27, legendaryMax: 30, unlocks: ['Stun Blaster'] },
    17: { commonMax: 18, epicMax: 27, legendaryMax: 30, unlocks: ['Electro Fangs'] },
    18: { commonMax: 18, epicMax: 27, legendaryMax: 33, unlocks: [] },
    19: { commonMax: 18, epicMax: 27, legendaryMax: 33, unlocks: [] },
};

export const EQUIPMENT_MAX_LEVELS = Object.freeze({
    common: 18,
    epic: 27,
    legendary: 33
});

/**
 * Returns the maximum level cap based on equipment rarity (Common = 18, Epic = 27, Legendary = 33).
 *
 * @param {string} [rarity='Common'] - Equipment rarity ('Common', 'Epic', or 'Legendary').
 * @returns {number} Maximum level cap.
 */
export function getEquipmentMaxLevel(rarity = 'Common') {
    if (!rarity) return EQUIPMENT_MAX_LEVELS.common;
    const r = rarity.toLowerCase();
    return EQUIPMENT_MAX_LEVELS[r] ?? EQUIPMENT_MAX_LEVELS.common;
}

/**
 * Returns true if equipment of the given rarity requires Starry Ore for upgrades.
 *
 * @param {string | null | undefined} rarity - Equipment rarity ('common', 'epic', or 'legendary').
 * @returns {boolean} True for epic and legendary equipment.
 */
export function usesStarryOre(rarity) {
    const r = (rarity || '').toLowerCase();
    return r === 'epic' || r === 'legendary';
}

/**
 * Returns the upgrade cost object { shiny, glowy, starry } for a given equipment level,
 * rarity, and pricing schedule.
 *
 * @param {number} level - Target equipment upgrade level.
 * @param {string} [rarity='common'] - Equipment rarity ('common', 'epic', or 'legendary').
 * @param {string} [costSchedule='classic'] - Pricing schedule ('classic' or 'modern').
 * @returns {{ shiny: number, glowy: number, starry: number }} Upgrade cost breakdown.
 */
export function getEquipmentUpgradeCost(level, rarity = 'common', costSchedule = 'classic') {
    const isModern = costSchedule === 'modern' || rarity?.toLowerCase() === 'legendary';
    const schedule = isModern ? MODERN_UPGRADE_COSTS : CLASSIC_UPGRADE_COSTS;
    return schedule[level] || { shiny: 0, glowy: 0, starry: 0 };
}

/**
 * Returns the minimum Town Hall level required for a given equipment level, rarity, and hero.
 *
 * @param {number} level - Equipment level.
 * @param {string} [rarity='Common'] - Equipment rarity ('Common', 'Epic', or 'Legendary').
 * @param {string|null} [heroKey=null] - Hero identifier key.
 * @returns {number} Required Town Hall level.
 */
export function getRequiredTownHall(level, rarity = 'Common', heroKey = null) {
    const r = rarity ? rarity.toLowerCase() : 'common';

    let levelTH = 8;
    if (r === 'legendary') {
        if (level <= 12) levelTH = 8;
        else if (level <= 15) levelTH = 10;
        else if (level <= 18) levelTH = 12;
        else if (level <= 21) levelTH = 14;
        else if (level <= 24) levelTH = 15;
        else if (level <= 30) levelTH = 16;
        else levelTH = 18; // Levels 31–33
    } else if (r === 'epic') {
        if (level <= 12) levelTH = 8;
        else if (level <= 15) levelTH = 10;
        else if (level <= 18) levelTH = 12;
        else if (level <= 21) levelTH = 14;
        else if (level <= 24) levelTH = 15;
        else levelTH = 16; // Levels 25–27
    } else {
        if (level <= 9) levelTH = 8;
        else if (level <= 12) levelTH = 10;
        else if (level <= 15) levelTH = 12;
        else levelTH = 14; // Levels 16–18
    }

    const heroUnlockTH = heroKey && heroUnlockTownHallMap[heroKey] ? heroUnlockTownHallMap[heroKey] : 8;

    return Math.max(heroUnlockTH, levelTH);
}

/**
 * Returns the Town Hall equipment caps ({ commonMax, epicMax, unlocks }) for a given Town Hall level.
 * Falls back to TH 8 caps for TH < 8, and the highest available TH caps for TH > 19.
 *
 * @param {number} [townHallLevel=8] - Target Town Hall level.
 * @returns {{ commonMax: number, epicMax: number, legendaryMax?: number, unlocks: string[] }} Town Hall equipment caps.
 */
export function getTownHallCaps(townHallLevel = 8) {
    const th = Math.floor(Number(townHallLevel)) || 8;
    if (th < 8) {
        return townHallCapsMap[8];
    }
    return townHallCapsMap[th] || townHallCapsMap[19] || townHallCapsMap[18] || townHallCapsMap[8];
}
