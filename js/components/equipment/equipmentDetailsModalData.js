import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { toCamelCase } from '../../utils/stringUtils.js';

/** @type {Map<string, Object | null>} */
const equipmentDataCache = new Map();

/** @type {Set<string>} */
const dismissedNotes = new Set();

/** @type {Object | null} */
let recommendationsCache = null;

let activeEquipmentName = null;

let sessionActiveModifierTab = null;
let sessionViewModePreference = 'overview';
let sessionRecommendationHidden = true;
let sessionTableExpanded = false;

/**
 * Resets modal transient session state when closing.
 */
export function resetModalSessionState() {
    sessionActiveModifierTab = null;
    sessionViewModePreference = 'overview';
    sessionRecommendationHidden = true;
    sessionTableExpanded = false;
}

/**
 * Returns current modal session preferences.
 *
 * @returns {{
 *   activeModifierTab: string | null,
 *   viewModePreference: string,
 *   recommendationHidden: boolean,
 *   tableExpanded: boolean,
 *   activeEquipmentName: string | null
 * }}
 */
export function getModalSessionState() {
    return {
        activeModifierTab: sessionActiveModifierTab,
        viewModePreference: sessionViewModePreference,
        recommendationHidden: sessionRecommendationHidden,
        tableExpanded: sessionTableExpanded,
        activeEquipmentName
    };
}

/**
 * Updates transient modal session state properties.
 *
 * @param {Object} updates
 * @param {string} [updates.activeModifierTab]
 * @param {string} [updates.viewModePreference]
 * @param {boolean} [updates.recommendationHidden]
 * @param {boolean} [updates.tableExpanded]
 * @param {string} [updates.activeEquipmentName]
 */
export function setModalSessionState(updates = {}) {
    if (updates.activeModifierTab !== undefined) sessionActiveModifierTab = updates.activeModifierTab;
    if (updates.viewModePreference !== undefined) sessionViewModePreference = updates.viewModePreference;
    if (updates.recommendationHidden !== undefined) sessionRecommendationHidden = updates.recommendationHidden;
    if (updates.tableExpanded !== undefined) sessionTableExpanded = updates.tableExpanded;
    if (updates.activeEquipmentName !== undefined) activeEquipmentName = updates.activeEquipmentName;
}

/**
 * Session dismissed notes set accessors.
 */
export function isNoteDismissed(equipId) {
    return dismissedNotes.has(equipId);
}

/**
 * Adds an equipment ID to the session dismissed equipment notes set.
 * @param {string} equipId - Equipment unique identifier.
 */
export function dismissNote(equipId) {
    dismissedNotes.add(equipId);
}

/**
 * Removes an equipment ID from the session dismissed equipment notes set.
 * @param {string} equipId - Equipment unique identifier.
 */
export function undismissNote(equipId) {
    dismissedNotes.delete(equipId);
}

/**
 * Converts equipment display name to filename slug.
 *
 * @param {string} equipmentName
 * @returns {string}
 */
function getEquipmentSlug(equipmentName) {
    if (!equipmentName) return '';
    return equipmentName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Checks whether JSON dataset exists for the specified equipment.
 *
 * @param {string} equipmentName
 * @returns {Promise<boolean>}
 */
function hasEquipmentData(equipmentName) {
    if (!equipmentName) return Promise.resolve(false);
    const slug = getEquipmentSlug(equipmentName);
    if (equipmentDataCache.has(slug)) {
        return Promise.resolve(Boolean(equipmentDataCache.get(slug)));
    }
    return fetch(`js/data/equipment/${slug}.json`)
        .then(response => {
            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.includes('application/json')) {
                return response.json().then(data => {
                    equipmentDataCache.set(slug, data);
                    return true;
                });
            } else {
                equipmentDataCache.set(slug, null);
                return false;
            }
        })
        .catch(() => {
            equipmentDataCache.set(slug, null);
            return false;
        });
}

/**
 * Fetches JSON dataset for the specified equipment.
 *
 * @param {string} equipmentName
 * @returns {Promise<Object | null>}
 */
export function fetchEquipmentData(equipmentName) {
    if (!equipmentName) return Promise.resolve(null);
    const slug = getEquipmentSlug(equipmentName);
    if (equipmentDataCache.has(slug)) {
        return Promise.resolve(equipmentDataCache.get(slug));
    }
    return fetch(`js/data/equipment/${slug}.json`)
        .then(response => {
            const contentType = response.headers.get('content-type');
            if (response.ok && contentType && contentType.includes('application/json')) {
                return response.json().then(data => {
                    equipmentDataCache.set(slug, data);
                    return data;
                });
            } else {
                equipmentDataCache.set(slug, null);
                return null;
            }
        })
        .catch(e => {
            console.warn(`Could not load details for ${equipmentName}:`, e);
            equipmentDataCache.set(slug, null);
            return null;
        });
}

/**
 * Loads equipment recommendations dataset.
 *
 * @returns {Promise<Object>}
 */
export function getRecommendationsData() {
    if (recommendationsCache) return Promise.resolve(recommendationsCache);
    return fetch('js/data/equipmentRecommendations.json')
        .then(response => {
            if (response.ok) {
                return response.json().then(data => {
                    recommendationsCache = data;
                    return data;
                });
            }
            recommendationsCache = {};
            return {};
        })
        .catch(e => {
            console.warn('Could not load equipment recommendations dataset:', e);
            recommendationsCache = {};
            return {};
        });
}

/**
 * Finds adjacent valid equipment index in navigation list.
 *
 * @param {Array<Object>} list
 * @param {number} currentIdx
 * @param {'next' | 'prev'} direction
 * @returns {Promise<number>}
 */
export async function findValidEquipmentIndex(list, currentIdx, direction) {
    if (direction === 'next') {
        for (let i = currentIdx + 1; i < list.length; i++) {
            if (await hasEquipmentData(list[i].name)) return i;
        }
    } else if (direction === 'prev') {
        for (let i = currentIdx - 1; i >= 0; i--) {
            if (await hasEquipmentData(list[i].name)) return i;
        }
    }
    return -1;
}

/**
 * Computes difference / delta between current level stat value and previous level stat value.
 *
 * @param {number} [currentVal]
 * @param {number} [prevVal]
 * @param {'flat' | 'percent' | 'decrease'} [deltaType]
 * @param {string} [valueUnit='number']
 * @param {string} [category='ability']
 * @returns {string} Formatted difference tag (e.g. '+20%', '+0.5s', '+120') or empty string.
 */
export function computeStatDelta(currentVal, prevVal, deltaType, valueUnit = 'number', category = 'ability') {
    if (prevVal === undefined || prevVal === null || prevVal === 0 || currentVal === undefined || currentVal === null) {
        return '';
    }
    const rawDiff = currentVal - prevVal;
    if (rawDiff <= 0) return '';

    // Clean floating point precision issues (e.g. 0.20000000000000018 -> 0.2)
    const diff = Math.round(rawDiff * 1000) / 1000;

    let effectiveDeltaType = deltaType;
    if (!effectiveDeltaType) {
        effectiveDeltaType = category === 'heroBoost' ? 'percent' : 'flat';
    }

    if (effectiveDeltaType === 'flat') {
        return `+${diff}`;
    } else {
        const pct = Math.round((rawDiff / prevVal) * 100);
        if (pct > 99) {
            return `+${diff}`;
        }
        return `+${pct}%`;
    }
}

/**
 * Returns a flattened array of all equipment items with hero ownership info.
 *
 * @returns {Array<{key: string, name: string, id: string, heroKey: string, heroName: string}>}
 */
export function getFlatEquipmentsList() {
    const list = [];
    for (const hKey in heroData) {
        const heroName = translate(`entities.heroes.${hKey}`);
        const equips = heroData[hKey].equipment || heroData[hKey].equipments || [];
        equips.forEach(eq => {
            list.push({
                key: eq.key,
                name: translate(`entities.equipment.${eq.key}`),
                id: eq.key || eq.id,
                heroKey: hKey,
                heroName: heroName
            });
        });
    }
    return list;
}

/**
 * Resolves current level of an equipment item from application state.
 *
 * @param {string} equipName
 * @param {string} [heroName=null]
 * @param {string} [heroKey=null]
 * @returns {number}
 */
export function getEquipLevel(equipName, heroName = null, heroKey = null) {
    if (state && state.heroes) {
        const keysToTry = [heroName, heroKey].filter(Boolean);
        for (const k of keysToTry) {
            const level = state.heroes[k]?.equipment?.[equipName]?.level;
            if (typeof level === 'number') return level;
        }

        for (const h in state.heroes) {
            const eqMap = state.heroes[h]?.equipment;
            if (eqMap) {
                if (typeof eqMap[equipName]?.level === 'number') {
                    return eqMap[equipName].level;
                }
                for (const eqKey in eqMap) {
                    if (eqKey.toLowerCase() === equipName.toLowerCase() && typeof eqMap[eqKey]?.level === 'number') {
                        return eqMap[eqKey].level;
                    }
                }
            }
        }
    }
    const slug = getEquipmentSlug(equipName);
    const camel = toCamelCase(slug);
    const userLevels = (state && state.equipmentLevels) || {};
    return userLevels[camel] || userLevels[slug] || userLevels[equipName] || 1;
}
