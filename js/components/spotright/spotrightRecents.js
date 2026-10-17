/**
 * Spotright Recent Searches Management Engine.
 * Manages LRU recent search items, persistent local storage, and registry resolution.
 * Tier 4: Search Component Utility.
 */

import { MAX_RECENT_SEARCHES } from '../../core/constants.js';
import { SPOTRIGHT_RECENTS_KEY } from '../../core/storageKeys.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { translate } from '../../i18n/translator.js';

/**
 * Retrieves the stored list of recent item IDs from localStorage.
 * @returns {string[]} Array of recent item IDs.
 */
export function getRecentItemIds() {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(SPOTRIGHT_RECENTS_KEY);
        if (!raw) return [];
        const parsed = safeJsonParse(raw, []);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(id => typeof id === 'string' && id.trim().length > 0);
    } catch (_) {
        return [];
    }
}

/**
 * Adds an item ID to recent searches, hoisting it to index 0 and enforcing the LRU cap.
 * @param {string} id - Unique item identifier.
 */
export function addRecentItem(id) {
    if (!id || typeof id !== 'string' || typeof localStorage === 'undefined') return;
    const cleanId = id.trim();
    if (!cleanId) return;

    try {
        const existing = getRecentItemIds();
        const filtered = existing.filter(existingId => existingId !== cleanId);
        const updated = [cleanId, ...filtered].slice(0, MAX_RECENT_SEARCHES);
        localStorage.setItem(SPOTRIGHT_RECENTS_KEY, JSON.stringify(updated));
    } catch (_) {}
}

/**
 * Removes a specific item ID from recent searches.
 * @param {string} id - Item identifier to remove.
 */
export function removeRecentItem(id) {
    if (!id || typeof localStorage === 'undefined') return;
    const cleanId = id.trim();

    try {
        const existing = getRecentItemIds();
        const updated = existing.filter(existingId => existingId !== cleanId);
        if (updated.length === 0) {
            localStorage.removeItem(SPOTRIGHT_RECENTS_KEY);
        } else {
            localStorage.setItem(SPOTRIGHT_RECENTS_KEY, JSON.stringify(updated));
        }
    } catch (_) {}
}

/**
 * Clears all recent searches from localStorage.
 */
export function clearRecentItems() {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.removeItem(SPOTRIGHT_RECENTS_KEY);
    } catch (_) {}
}

/**
 * Resolves stored recent IDs against the current live registry.
 * Decorates matches with recent category metadata and self-heals orphan IDs.
 *
 * @param {import('./spotrightRegistry.js').SpotrightItem[]} registry - Current indexed items.
 * @returns {import('./spotrightRegistry.js').SpotrightItem[]} Resolved recent items.
 */
export function resolveRecentItems(registry) {
    if (!Array.isArray(registry) || registry.length === 0) return [];
    const ids = getRecentItemIds();
    if (ids.length === 0) return [];

    const categoryTitle = translate('views.spotright.recent');
    /** @type {import('./spotrightRegistry.js').SpotrightItem[]} */
    const resolved = [];
    const validIds = [];

    for (let i = 0; i < ids.length; i++) {
        const targetId = ids[i];
        const match = registry.find(item => item.id === targetId);
        if (match) {
            resolved.push({
                ...match,
                category: categoryTitle,
                isRecent: true
            });
            validIds.push(targetId);
        }
    }

    // Self-healing: purge orphan IDs (e.g. deleted village tags) from storage
    if (validIds.length !== ids.length && typeof localStorage !== 'undefined') {
        try {
            if (validIds.length === 0) {
                localStorage.removeItem(SPOTRIGHT_RECENTS_KEY);
            } else {
                localStorage.setItem(SPOTRIGHT_RECENTS_KEY, JSON.stringify(validIds));
            }
        } catch (_) {}
    }

    return resolved;
}
