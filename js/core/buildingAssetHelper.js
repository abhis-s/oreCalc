/**
 * Building Asset URL Resolver.
 * Tier 2: Pure Domain Math & Utilities (Referentially transparent, zero side effects).
 */

import { getDefensesData } from '../data/defenseTargetsData.js';

const HERO_ASSET_MAP = Object.freeze({
    barbarian_king: 'barbarianKing',
    archer_queen: 'archerQueen',
    grand_warden: 'grandWarden',
    royal_champion: 'royalChampion',
    minion_prince: 'minionPrince',
    dragon_duke: 'dragonDuke'
});

/**
 * Returns the absolute asset URL for a given target entity key and level.
 *
 * @param {string} buildingKey - Canonical target entity key (e.g. 'air_defense', 'barbarian_king', 'smasher').
 * @param {number} [level=1] - Level number (1-based index).
 * @returns {string} Absolute web path to target sprite PNG.
 */
export function getBuildingAssetUrl(buildingKey, level = 1) {
    if (!buildingKey) return '';

    const def = getDefensesData()[buildingKey];
    if (!def) return '';

    if (def.category === 'hero') {
        const fileBase = HERO_ASSET_MAP[buildingKey] || buildingKey;
        return `/assets/heroes/${fileBase}.png`;
    }

    if (def.category === 'guardian') {
        return `/assets/guardians/${buildingKey}.png`;
    }

    const maxLvl = def.maxLevel || 1;
    const clampedLevel = Math.max(1, Math.min(Math.floor(Number(level) || 1), maxLvl));

    if (def.subCategory === 'crafted') {
        // Crafted seasonal defenses unlock 4 visual tier models at HP levels 1, 4, 7, and 10.
        // Intermediate levels fall back to the preceding tier anchor level.
        const anchorLevel = clampedLevel <= 3 ? 1 : clampedLevel <= 6 ? 4 : clampedLevel <= 9 ? 7 : 10;
        return `/assets/buildings/${buildingKey}/level_${anchorLevel}.png`;
    }

    return `/assets/buildings/${buildingKey}/level_${clampedLevel}.png`;
}
