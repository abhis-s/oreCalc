import { getISOWeekNumber } from '../utils/dateUtils.js';
import { heroData } from '../data/heroData.js';
import { priceTierRegistry } from '../data/pricingData.js';

/**
 * Normalizes a hero's equipment state, ensuring all expected fields exist.
 */
export function normalizeEquipmentState(heroName, heroState) {
    // Migration disabled
    return heroState || { equipment: {} };
}

/**
 * Migrates UI settings from legacy structures.
 */
export function migrateUISettings(uiSettings) {
    // Migration disabled
    return;
}

/**
 * Minimalizes player data by removing redundant/default values before persistence.
 */
export function sanitizePlayerState(playerData) {
    // Cleanup disabled
    return;
}

/**
 * Migrates a player state instance (individual player data).
 */
export function migratePlayerState(playerState) {
    // Migration disabled
    return;
}

/**
 * Migrates global pricing keys from USD prices to standardized tier keys.
 */
function migrateGlobalPricing(playerData) {
    // Migration disabled
    return;
}

/**
 * Purges legacy and past data from the player's state.
 */
export function purgeLegacyStateData(playerData) {
    // Migration disabled
    return;
}

/**
 * Cleans UI settings before persistence (minimalization).
 */
export function sanitizeUISettings(uiSettings) {
    // Cleanup disabled
    return uiSettings;
}

/**
 * Migrates the full application state, including UI settings and all player instances.
 */
export function migrateFullState(state) {
    // Migration disabled
    return;
}

/**
 * Version comparison utility.
 */
export function compareVersions(v1, v2) {
    const cleanV1 = v1.split(/[+-]/)[0];
    const cleanV2 = v2.split(/[+-]/)[0];
    const parts1 = cleanV1.split('.').map(Number);
    const parts2 = cleanV2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}
