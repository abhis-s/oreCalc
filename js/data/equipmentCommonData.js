export const EQUIPMENT_STATS_LAST_UPDATED = "2026-08-01";

export const upgradeCosts = {
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

export const heroUnlockTownHallMap = {
    barbarianKing: 4,
    archerQueen: 8,
    minionPrince: 9,
    grandWarden: 11,
    royalChampion: 13,
    dragonDuke: 15
};

const townHallCapsMap = {
    8: { commonMax: 9, epicMax: 12, unlocks: ['Earthquake Boots'] },
    9: { commonMax: 9, epicMax: 12, unlocks: ['Giant Arrow'] },
    10: { commonMax: 12, epicMax: 15, unlocks: ['Vampstache', 'Metal Pants'] },
    11: { commonMax: 12, epicMax: 15, unlocks: ['Rage Gem'] },
    12: { commonMax: 15, epicMax: 18, unlocks: ['Healer Puppet', 'Noble Iron'] },
    13: { commonMax: 15, epicMax: 18, unlocks: ['Healing Tome'] },
    14: { commonMax: 18, epicMax: 21, unlocks: ['Hog Rider Puppet'] },
    15: { commonMax: 18, epicMax: 24, unlocks: ['Haste Vial'] },
    16: { commonMax: 18, epicMax: 27, unlocks: ['Stun Blaster'] },
    17: { commonMax: 18, epicMax: 27, unlocks: ['Electro Fangs'] },
    18: { commonMax: 18, epicMax: 27, unlocks: [] },
};

export const EQUIPMENT_MAX_LEVELS = Object.freeze({
    common: 18,
    epic: 27
});

/**
 * Returns the maximum level cap based on equipment rarity (Common = 18, Epic = 27).
 */
export function getEquipmentMaxLevel(rarity = 'Common') {
    if (!rarity) return EQUIPMENT_MAX_LEVELS.common;
    const r = rarity.toLowerCase();
    return r === 'epic' ? EQUIPMENT_MAX_LEVELS.epic : EQUIPMENT_MAX_LEVELS.common;
}

/**
 * Returns the upgrade cost object { shiny, glowy, starry } for a given equipment level.
 */
export function getEquipmentUpgradeCost(level) {
    return upgradeCosts[level] || { shiny: 0, glowy: 0, starry: 0 };
}

/**
 * Returns the minimum Town Hall level required for a given equipment level, rarity, and hero.
 */
export function getRequiredTownHall(level, rarity = 'Common', heroKey = null) {
    const isEpic = rarity.toLowerCase() === 'epic';

    let levelTH = 8;
    if (!isEpic) {
        if (level <= 9) levelTH = 8;
        else if (level <= 12) levelTH = 10;
        else if (level <= 15) levelTH = 12;
        else levelTH = 14; // Levels 16–18
    } else {
        if (level <= 12) levelTH = 8;
        else if (level <= 15) levelTH = 10;
        else if (level <= 18) levelTH = 12;
        else if (level <= 21) levelTH = 14;
        else if (level <= 24) levelTH = 15;
        else levelTH = 16; // Levels 25–27
    }

    const heroUnlockTH = heroKey && heroUnlockTownHallMap[heroKey] ? heroUnlockTownHallMap[heroKey] : 8;

    return Math.max(heroUnlockTH, levelTH);
}

/**
 * Returns the Town Hall equipment caps ({ commonMax, epicMax, unlocks }) for a given Town Hall level.
 * Falls back to TH 8 caps for TH < 8, and the highest available TH caps for TH > 18.
 */
export function getTownHallCaps(townHallLevel = 8) {
    const th = Math.floor(Number(townHallLevel)) || 8;
    if (th < 8) {
        return townHallCapsMap[8];
    }
    return townHallCapsMap[th] || townHallCapsMap[18] || townHallCapsMap[8];
}
