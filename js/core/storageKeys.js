/**
 * Storage Keys, Prefix Resolvers, and Tag Normalization Helpers.
 * Tier 3: Core Storage Foundations.
 */

import { STORAGE_KEY_MAP } from './constants.js';
import { generateUUID } from '../utils/uuidGenerator.js';

export const APP_SETTINGS_KEY = 'oreCalc_appSettings';
export const CANONICAL_APP_SETTINGS_KEY = 'clashCalc_appSettings';
export const PLAYER_TAGS_KEY = 'oreCalc_playerTags';
export const CANONICAL_PLAYER_TAGS_KEY = 'clashCalc_playerTags';
export const PLAYER_PREFIX = 'oreCalc_player_';
export const CANONICAL_PLAYER_PREFIX = 'clashCalc_player_';

export const ALLOWED_STATIC_STORAGE_KEYS = Object.freeze(new Set([
    'clashCalc_appSettings',
    'clashCalc_playerTags',
    'clashCalc_userId',
    'clashCalc_SWUpdatedTime',
    'clashCalc_domainNoticeDismissed',
    'clashCalc_stateResetEpoch',
    'clashCalc_authToken',
    'clashCalc_username',
    'clashCalc_avatar',
    'clashCalc_damageCalcState',
    'oreCalc_appSettings',
    'oreCalc_playerTags',
    'oreCalc_userId',
    'oreCalc_SWUpdatedTime',
    'oreCalc_domainNoticeDismissed',
    'oreCalc_migratedToClashCalc',
    'oreCalc_migratedUserId',
    'clashCalc_migratedToClashCalc',
    'clashCalc_migratedUserId'
]));

/**
 * Checks whether the current window host represents ClashCalc.
 * Returns false on legacy domain (orecalc.tech).
 * Defaults to true for clashcalc.com, beta.clashcalc.com, localhost, 127.0.0.1, etc.
 * In Node.js test environments (typeof window === 'undefined'), returns false
 * to preserve backward compatibility for legacy fallback unit tests.
 * @returns {boolean} Whether host is clashcalc.
 */
export function isClashCalcHost() {
    if (typeof window === 'undefined' || !window.location?.hostname) {
        return false;
    }
    const host = window.location.hostname.toLowerCase();
    if (host.includes('orecalc.tech')) {
        return false;
    }
    return true;
}

/**
 * Returns active player storage prefix based on current host.
 * @returns {string} Active player prefix.
 */
export function getActivePlayerPrefix() {
    return isClashCalcHost() ? CANONICAL_PLAYER_PREFIX : PLAYER_PREFIX;
}

/**
 * Returns active player tags storage key based on current host.
 * @returns {string} Active player tags key.
 */
export function getActivePlayerTagsKey() {
    return isClashCalcHost() ? CANONICAL_PLAYER_TAGS_KEY : PLAYER_TAGS_KEY;
}

/**
 * Returns active app settings storage key based on current host.
 * @returns {string} Active app settings key.
 */
export function getActiveAppSettingsKey() {
    return isClashCalcHost() ? CANONICAL_APP_SETTINGS_KEY : APP_SETTINGS_KEY;
}

/**
 * Returns active user ID storage key based on current host.
 * @returns {string} Active user ID key.
 */
export function getActiveUserIdKey() {
    return isClashCalcHost() ? STORAGE_KEY_MAP.userId.canonical : STORAGE_KEY_MAP.userId.legacy;
}

/**
 * Resolves a storage item prioritizing active host key with fallback to opposing key.
 * @param {string} canonicalKey - Primary key under ClashCalc canonical namespace.
 * @param {string} [legacyKey] - Fallback key under OreCalc legacy namespace.
 * @returns {string|null} Stored value or null.
 */
export function getStorageItem(canonicalKey, legacyKey) {
    if (typeof localStorage === 'undefined') return null;
    try {
        const isClash = isClashCalcHost();
        const primaryKey = isClash ? canonicalKey : (legacyKey || canonicalKey);
        const fallbackKey = isClash ? (legacyKey || canonicalKey) : canonicalKey;
        const primaryVal = localStorage.getItem(primaryKey);
        if (primaryVal !== null) return primaryVal;
        if (fallbackKey && fallbackKey !== primaryKey) {
            return localStorage.getItem(fallbackKey);
        }
    } catch (_) {}
    return null;
}

/**
 * Resolves active user ID from canonical or legacy localStorage keys.
 * If generateIfMissing is true and no ID exists in storage, generates and persists a new UUID.
 * @param {boolean} [generateIfMissing=false] - Whether to generate a new UUID if none is found.
 * @returns {string} User ID or empty string.
 */
export function getActiveUserId(generateIfMissing = false) {
    if (typeof localStorage === 'undefined') return '';
    try {
        let userId = getStorageItem(STORAGE_KEY_MAP.userId.canonical, STORAGE_KEY_MAP.userId.legacy) || '';
        if (!userId && generateIfMissing) {
            userId = generateUUID();
            localStorage.setItem(getActiveUserIdKey(), userId);
        }
        return userId;
    } catch (_) {
        return '';
    }
}

/**
 * Rotates the active user ID to a fresh UUID, disconnecting the device from previous cloud records.
 * @returns {string} New UUID or empty string.
 */
export function rotateActiveUserId() {
    if (typeof localStorage === 'undefined') return '';
    try {
        const newId = generateUUID();
        localStorage.setItem(getActiveUserIdKey(), newId);
        if (isClashCalcHost()) {
            localStorage.removeItem(STORAGE_KEY_MAP.userId.legacy);
        }
        return newId;
    } catch (_) {
        return '';
    }
}

/**
 * Normalizes a player tag for storage and state (strips ALL hashes, trims, uppercases).
 * 'DEFAULT0' is preserved as 'DEFAULT0'.
 * @param {any} tag
 * @returns {string} Clean tag (e.g. '8PJYGUJC' or 'DEFAULT0')
 */
export function normalizePlayerTag(tag) {
    if (!tag) return '';
    const str = String(tag).trim();
    if (str === 'DEFAULT0') return 'DEFAULT0';
    return str.replace(/#/g, '').trim().toUpperCase();
}

/**
 * Returns a display-formatted player tag with strictly ONE leading hash (e.g. '#8PJYGUJC').
 * Returns empty string for empty tags or 'DEFAULT0'.
 * @param {any} tag
 * @returns {string} Display tag (e.g. '#8PJYGUJC')
 */
export function formatDisplayTag(tag) {
    const clean = normalizePlayerTag(tag);
    if (!clean || clean === 'DEFAULT0') return '';
    return `#${clean}`;
}

/**
 * Returns the localStorage key for a player partition.
 * Guaranteed to have zero leading hashes in the key suffix.
 * @param {any} tag - Player tag identifier.
 * @param {string} [prefix=null] - Optional prefix override.
 * @returns {string} Partition key (e.g. 'oreCalc_player_8PJYGUJC' or 'clashCalc_player_8PJYGUJC')
 */
export function getPlayerStorageKey(tag, prefix = null) {
    const clean = normalizePlayerTag(tag) || 'DEFAULT0';
    const activePrefix = prefix || getActivePlayerPrefix();
    return `${activePrefix}${clean}`;
}
