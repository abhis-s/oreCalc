import { normalizePlayerTag, formatDisplayTag, getSavedPlayerTagsList } from './localStorageManager.js';
import { safeJsonParse } from '../utils/jsonUtils.js';

export const RECENT_SEARCHES_KEY = 'oreCalc_recentSearches';
const MAX_RECENT_SEARCHES = 10;

/**
 * Retrieves list of recently searched player profiles from localStorage.
 * @returns {Array<{ tag: string, cleanTag: string, name: string, townHallLevel: number, timestamp: number }>} Array of recent search summaries.
 */
export function getRecentSearches() {
    if (typeof localStorage === 'undefined') return [];
    try {
        const str = localStorage.getItem(RECENT_SEARCHES_KEY);
        const list = safeJsonParse(str, []);
        if (!Array.isArray(list)) return [];
        const savedTags = getSavedPlayerTagsList();
        const savedSet = new Set(savedTags);
        return list.filter(item => item && item.cleanTag && !savedSet.has(item.cleanTag));
    } catch {
        return [];
    }
}

/**
 * Adds or updates a player in the recent searches list.
 * @param {Object} playerData - Player data payload.
 */
export function addRecentSearch(playerData) {
    if (typeof localStorage === 'undefined' || !playerData || !playerData.tag) return;
    const cleanTag = normalizePlayerTag(playerData.tag);
    if (!cleanTag || cleanTag === 'DEFAULT0') return;

    const savedTags = getSavedPlayerTagsList();
    if (savedTags.includes(cleanTag)) return;

    try {
        const current = getRecentSearches().filter(item => item.cleanTag !== cleanTag);
        const newEntry = {
            tag: formatDisplayTag(cleanTag),
            cleanTag,
            name: playerData.name || formatDisplayTag(cleanTag),
            townHallLevel: Number(playerData.townHallLevel) || 1,
            timestamp: Date.now()
        };
        current.unshift(newEntry);
        if (current.length > MAX_RECENT_SEARCHES) {
            current.length = MAX_RECENT_SEARCHES;
        }
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(current));
    } catch {}
}

/**
 * Removes a player tag from recent searches.
 * @param {string} tag - Tag to remove.
 */
export function removeRecentSearch(tag) {
    if (typeof localStorage === 'undefined' || !tag) return;
    const cleanTag = normalizePlayerTag(tag);
    try {
        const str = localStorage.getItem(RECENT_SEARCHES_KEY);
        const list = safeJsonParse(str, []);
        if (!Array.isArray(list)) return;
        const current = list.filter(item => item && item.cleanTag !== cleanTag);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(current));
    } catch {}
}
