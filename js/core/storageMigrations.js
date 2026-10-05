/**
 * LocalStorage Migration and Key Consolidation Service.
 * Tier 3: Core Service (Storage Migration Pipeline).
 */

import { MAX_SAVED_PLAYERS } from './constants.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import {
    isClashCalcHost,
    normalizePlayerTag,
    CANONICAL_APP_SETTINGS_KEY,
    APP_SETTINGS_KEY,
    CANONICAL_PLAYER_TAGS_KEY,
    PLAYER_TAGS_KEY,
    PLAYER_PREFIX,
    CANONICAL_PLAYER_PREFIX,
    ALLOWED_STATIC_STORAGE_KEYS
} from './storageKeys.js';

/**
 * Consolidates legacy storage partitions, settings, user IDs, and recent searches into canonical
 * clashCalc_* keys, purging duplicates and obsolete historical artifacts without data loss.
 * Safe to call repeatedly (idempotent).
 * @returns {{ migrated: string[], deleted: string[] }} Summary of operations performed.
 */
export function consolidateLocalStorageKeys() {
    const summary = { migrated: [], deleted: [] };
    if (typeof localStorage === 'undefined') return summary;

    const isCanonicalHost = isClashCalcHost();

    try {
        // Consolidate App Settings
        const canonicalSettingsRaw = localStorage.getItem(CANONICAL_APP_SETTINGS_KEY);
        const legacySettingsRaw = localStorage.getItem(APP_SETTINGS_KEY);

        if (legacySettingsRaw !== null && isCanonicalHost) {
            const legacySettings = safeJsonParse(legacySettingsRaw, {}) || {};
            const canonicalSettings = safeJsonParse(canonicalSettingsRaw, {}) || {};

            const mergedSettings = {
                ...legacySettings,
                ...canonicalSettings
            };

            if (legacySettings.uiTimestamps || canonicalSettings.uiTimestamps) {
                mergedSettings.uiTimestamps = {
                    ...(legacySettings.uiTimestamps || {}),
                    ...(canonicalSettings.uiTimestamps || {})
                };
            }

            if (mergedSettings.uiTimestamps) {
                delete mergedSettings.uiTimestamps.privacy;
                delete mergedSettings.uiTimestamps.tos;
                delete mergedSettings.uiTimestamps.terms;
                delete mergedSettings.uiTimestamps.welcome;
            }

            if (legacySettings.currency || canonicalSettings.currency) {
                mergedSettings.currency = {
                    ...(legacySettings.currency || {}),
                    ...(canonicalSettings.currency || {})
                };
            }

            // Absorb obsolete orecalc_lang key
            const oldLang = localStorage.getItem('orecalc_lang');
            if (oldLang && (!mergedSettings.language || mergedSettings.language === 'auto')) {
                mergedSettings.language = oldLang;
            }

            localStorage.setItem(CANONICAL_APP_SETTINGS_KEY, JSON.stringify(mergedSettings));
            summary.migrated.push(CANONICAL_APP_SETTINGS_KEY);

            localStorage.removeItem(APP_SETTINGS_KEY);
            summary.deleted.push(APP_SETTINGS_KEY);
        } else if (canonicalSettingsRaw !== null && isCanonicalHost) {
            let settingsModified = false;
            const canonicalSettings = safeJsonParse(canonicalSettingsRaw, {}) || {};
            if (canonicalSettings.uiTimestamps && (
                'privacy' in canonicalSettings.uiTimestamps ||
                'tos' in canonicalSettings.uiTimestamps ||
                'terms' in canonicalSettings.uiTimestamps ||
                'welcome' in canonicalSettings.uiTimestamps
            )) {
                delete canonicalSettings.uiTimestamps.privacy;
                delete canonicalSettings.uiTimestamps.tos;
                delete canonicalSettings.uiTimestamps.terms;
                delete canonicalSettings.uiTimestamps.welcome;
                settingsModified = true;
            }
            const oldLang = localStorage.getItem('orecalc_lang');
            if (oldLang && (!canonicalSettings.language || canonicalSettings.language === 'auto')) {
                canonicalSettings.language = oldLang;
                settingsModified = true;
            }
            if (settingsModified) {
                localStorage.setItem(CANONICAL_APP_SETTINGS_KEY, JSON.stringify(canonicalSettings));
            }
        }

        // Clean up obsolete un-namespaced keys on canonical host
        if (isCanonicalHost) {
            if (localStorage.getItem('welcomeModalDismissed') !== null) {
                localStorage.removeItem('welcomeModalDismissed');
                summary.deleted.push('welcomeModalDismissed');
            }
            if (localStorage.getItem('orecalc_lang') !== null) {
                localStorage.removeItem('orecalc_lang');
                summary.deleted.push('orecalc_lang');
            }
        }

        // Consolidate Player Tags
        const canonicalTagsRaw = localStorage.getItem(CANONICAL_PLAYER_TAGS_KEY);
        const legacyTagsRaw = localStorage.getItem(PLAYER_TAGS_KEY);

        if (isCanonicalHost && (legacyTagsRaw !== null || canonicalTagsRaw !== null)) {
            const canonicalTags = safeJsonParse(canonicalTagsRaw, []);
            const legacyTags = safeJsonParse(legacyTagsRaw, []);

            const mergedTags = [];
            const seenTags = new Set();

            const appendTag = (rawTag) => {
                const clean = normalizePlayerTag(rawTag);
                if (!clean || clean === 'DEFAULT0' || seenTags.has(clean)) return;
                seenTags.add(clean);
                mergedTags.push(clean);
            };

            if (Array.isArray(canonicalTags)) {
                for (const t of canonicalTags) appendTag(t);
            }
            if (Array.isArray(legacyTags)) {
                for (const t of legacyTags) appendTag(t);
            }

            if (mergedTags.length === 0) {
                const hadGuest = (Array.isArray(canonicalTags) && canonicalTags.includes('DEFAULT0')) ||
                                 (Array.isArray(legacyTags) && legacyTags.includes('DEFAULT0'));
                if (hadGuest) {
                    mergedTags.push('DEFAULT0');
                }
            }

            const cappedTags = mergedTags.slice(0, MAX_SAVED_PLAYERS);
            localStorage.setItem(CANONICAL_PLAYER_TAGS_KEY, JSON.stringify(cappedTags));
            summary.migrated.push(CANONICAL_PLAYER_TAGS_KEY);

            if (legacyTagsRaw !== null) {
                localStorage.removeItem(PLAYER_TAGS_KEY);
                summary.deleted.push(PLAYER_TAGS_KEY);
            }
        }

        // Consolidate Player Partitions
        const allStorageKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) allStorageKeys.push(k);
        }

        for (const key of allStorageKeys) {
            if (key.startsWith(PLAYER_PREFIX)) {
                const rawTag = key.slice(PLAYER_PREFIX.length);
                const cleanTag = normalizePlayerTag(rawTag);
                if (!cleanTag) continue;

                // Normalize legacy hash keys (e.g. oreCalc_player_#TAG -> oreCalc_player_TAG)
                const normalizedLegacyKey = `${PLAYER_PREFIX}${cleanTag}`;
                if (key !== normalizedLegacyKey) {
                    if (localStorage.getItem(normalizedLegacyKey) === null) {
                        const val = localStorage.getItem(key);
                        if (val !== null) localStorage.setItem(normalizedLegacyKey, val);
                    }
                    localStorage.removeItem(key);
                    summary.deleted.push(key);
                }

                if (isCanonicalHost) {
                    const canonicalKey = `${CANONICAL_PLAYER_PREFIX}${cleanTag}`;
                    const legacyValRaw = localStorage.getItem(normalizedLegacyKey);
                    const canonicalValRaw = localStorage.getItem(canonicalKey);

                    if (canonicalValRaw === null) {
                        if (legacyValRaw !== null) {
                            localStorage.setItem(canonicalKey, legacyValRaw);
                            summary.migrated.push(canonicalKey);
                        }
                    } else if (legacyValRaw !== null) {
                        const canonicalData = safeJsonParse(canonicalValRaw, null);
                        const legacyData = safeJsonParse(legacyValRaw, null);

                        if (canonicalData && legacyData && typeof canonicalData === 'object' && typeof legacyData === 'object') {
                            let merged = false;
                            if (!canonicalData.playerProfile && legacyData.playerProfile) {
                                canonicalData.playerProfile = legacyData.playerProfile;
                                merged = true;
                            }
                            if (!canonicalData.heroes && legacyData.heroes) {
                                canonicalData.heroes = legacyData.heroes;
                                merged = true;
                            }
                            if (!canonicalData.storedOres && legacyData.storedOres) {
                                canonicalData.storedOres = legacyData.storedOres;
                                merged = true;
                            }
                            if (!canonicalData.income && legacyData.income) {
                                canonicalData.income = legacyData.income;
                                merged = true;
                            }
                            if (!canonicalData.planner && legacyData.planner) {
                                canonicalData.planner = legacyData.planner;
                                merged = true;
                            }
                            if (merged) {
                                localStorage.setItem(canonicalKey, JSON.stringify(canonicalData));
                                summary.migrated.push(canonicalKey);
                            }
                        }
                    }

                    localStorage.removeItem(normalizedLegacyKey);
                    summary.deleted.push(normalizedLegacyKey);
                }
            }

            if (key.startsWith(CANONICAL_PLAYER_PREFIX) && key.includes('#')) {
                const rawTag = key.slice(CANONICAL_PLAYER_PREFIX.length);
                const cleanTag = normalizePlayerTag(rawTag);
                const canonicalKey = `${CANONICAL_PLAYER_PREFIX}${cleanTag}`;
                if (cleanTag && canonicalKey !== key) {
                    if (localStorage.getItem(canonicalKey) === null) {
                        const val = localStorage.getItem(key);
                        if (val !== null) localStorage.setItem(canonicalKey, val);
                    }
                    localStorage.removeItem(key);
                    summary.deleted.push(key);
                }
            }
        }

        // Consolidate User ID (only on canonical host)
        if (isCanonicalHost) {
            const canonicalUserId = localStorage.getItem('clashCalc_userId');
            const legacyUserId = localStorage.getItem('oreCalc_userId') || localStorage.getItem('oreCalcUserId');
            if (!canonicalUserId && legacyUserId) {
                localStorage.setItem('clashCalc_userId', legacyUserId);
                summary.migrated.push('clashCalc_userId');
            }
            if (localStorage.getItem('oreCalc_userId') !== null) {
                localStorage.removeItem('oreCalc_userId');
                summary.deleted.push('oreCalc_userId');
            }
            if (localStorage.getItem('oreCalcUserId') !== null) {
                localStorage.removeItem('oreCalcUserId');
                summary.deleted.push('oreCalcUserId');
            }
        }

        // Clean up deprecated Recent Searches
        if (localStorage.getItem('clashCalc_recentSearches') !== null) {
            localStorage.removeItem('clashCalc_recentSearches');
            summary.deleted.push('clashCalc_recentSearches');
        }
        if (localStorage.getItem('oreCalc_recentSearches') !== null) {
            localStorage.removeItem('oreCalc_recentSearches');
            summary.deleted.push('oreCalc_recentSearches');
        }

        // Eradicate deprecated clashCalc_activePasskeyId (Active Session feature removed)
        if (localStorage.getItem('clashCalc_activePasskeyId') !== null) {
            localStorage.removeItem('clashCalc_activePasskeyId');
            summary.deleted.push('clashCalc_activePasskeyId');
        }

        // Consolidate Service Worker Updated Time (only on canonical host)
        if (isCanonicalHost) {
            const canonicalSwTime = localStorage.getItem('clashCalc_SWUpdatedTime');
            const legacySwTime = localStorage.getItem('oreCalc_SWUpdatedTime') || localStorage.getItem('oreCalcSWUpdatedTime');
            if (!canonicalSwTime && legacySwTime) {
                localStorage.setItem('clashCalc_SWUpdatedTime', legacySwTime);
                summary.migrated.push('clashCalc_SWUpdatedTime');
            }
            if (localStorage.getItem('oreCalc_SWUpdatedTime') !== null) {
                localStorage.removeItem('oreCalc_SWUpdatedTime');
                summary.deleted.push('oreCalc_SWUpdatedTime');
            }
            if (localStorage.getItem('oreCalcSWUpdatedTime') !== null) {
                localStorage.removeItem('oreCalcSWUpdatedTime');
                summary.deleted.push('oreCalcSWUpdatedTime');
            }
        }

        // Surgically Purge Un-Allowlisted Keys and Obsolete Historical Partitions
        const activeTagsRaw = localStorage.getItem(CANONICAL_PLAYER_TAGS_KEY) || localStorage.getItem(PLAYER_TAGS_KEY);
        const activeTags = safeJsonParse(activeTagsRaw, []);
        const swept = sweepObsoleteStorageKeys(Array.isArray(activeTags) ? activeTags : []);
        for (const k of swept) {
            summary.deleted.push(k);
        }
    } catch (e) {
        console.error("Error during localStorage consolidation:", e);
    }

    return summary;
}

/**
 * Scans localStorage and surgically purges any key not registered in ALLOWED_STATIC_STORAGE_KEYS
 * or matching an active player partition (clashCalc_player_<TAG> / oreCalc_player_<TAG>).
 * @param {string[]} [validPlayerTags=[]] - Array of currently registered player tags.
 * @returns {string[]} List of deleted keys.
 */
export function sweepObsoleteStorageKeys(validPlayerTags = []) {
    const deleted = [];
    if (typeof localStorage === 'undefined') return deleted;

    const hasExplicitTags = Array.isArray(validPlayerTags) && validPlayerTags.length > 0;
    const validTagSet = new Set(
        hasExplicitTags
            ? validPlayerTags.map(normalizePlayerTag).filter(Boolean)
            : []
    );
    const isGuestAllowed = validTagSet.has('DEFAULT0');

    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) allKeys.push(k);
    }

    for (const key of allKeys) {
        if (ALLOWED_STATIC_STORAGE_KEYS.has(key)) {
            continue;
        }

        let isPartition = false;
        let partitionTag = '';
        if (key.startsWith(CANONICAL_PLAYER_PREFIX)) {
            isPartition = true;
            partitionTag = normalizePlayerTag(key.slice(CANONICAL_PLAYER_PREFIX.length));
        } else if (key.startsWith(PLAYER_PREFIX)) {
            isPartition = true;
            partitionTag = normalizePlayerTag(key.slice(PLAYER_PREFIX.length));
        }

        if (isPartition) {
            // Guard against accidental partition loss when valid tags are not explicitly provided
            if (!hasExplicitTags) {
                continue;
            }
            if (partitionTag && (validTagSet.has(partitionTag) || (partitionTag === 'DEFAULT0' && isGuestAllowed))) {
                continue;
            }
        }

        // Purge if it is an oreCalc/clashCalc/orecalc entity or known historical artifact
        if (
            key.startsWith('clashCalc_') ||
            key.startsWith('oreCalc_') ||
            key.startsWith('orecalc_') ||
            key.startsWith('OreCalculator') ||
            key.startsWith('oreCalculator') ||
            key === 'welcomeModalDismissed' ||
            key === 'preferred_language' ||
            key === 'orecalc_ui_settings'
        ) {
            localStorage.removeItem(key);
            deleted.push(key);
        }
    }

    return deleted;
}
