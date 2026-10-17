/**
 * Player Data API Refresh Throttler & Stale Cache Evaluator.
 * Tracks partition refresh timestamps and prevents redundant network requests on page loads and cross-app navigation.
 * Tier 3: Core Service (Refresh Throttling & Cache Lifecycle).
 */

import { state } from './state.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import {
    CANONICAL_PLAYER_PREFIX,
    PLAYER_PREFIX,
    getPlayerStorageKey,
    isClashCalcHost,
    normalizePlayerTag
} from './storageKeys.js';

/** Default cooldown duration: 10 minutes (600,000 ms) */
export const ACCOUNT_REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Retrieves the timestamp (epoch ms) when player profile data was last refreshed from the API.
 *
 * @param {string} playerTag - Player tag identifier.
 * @returns {number} Timestamp in milliseconds, or 0 if never refreshed.
 */
export function getPlayerLastRefreshed(playerTag) {
    const cleanTag = normalizePlayerTag(playerTag);
    if (!cleanTag || cleanTag === 'DEFAULT0') return 0;

    if (state?.allPlayersData?.[cleanTag]?.lastRefreshedAt) {
        const val = Number(state.allPlayersData[cleanTag].lastRefreshedAt);
        if (Number.isFinite(val) && val > 0) return val;
    }

    try {
        const activeKey = getPlayerStorageKey(cleanTag);
        let playerStr = localStorage.getItem(activeKey);
        if (!playerStr) {
            const fallbackKey = isClashCalcHost()
                ? getPlayerStorageKey(cleanTag, PLAYER_PREFIX)
                : getPlayerStorageKey(cleanTag, CANONICAL_PLAYER_PREFIX);
            playerStr = localStorage.getItem(fallbackKey);
        }
        if (playerStr) {
            const parsed = safeJsonParse(playerStr, null);
            const val = Number(parsed?.lastRefreshedAt);
            if (Number.isFinite(val) && val > 0) return val;
        }
    } catch {}

    return 0;
}

/**
 * Sets the last refreshed timestamp for a player profile in state and local storage.
 *
 * @param {string} playerTag - Player tag identifier.
 * @param {number} [timestamp=Date.now()] - Epoch timestamp in milliseconds.
 */
export function setPlayerLastRefreshed(playerTag, timestamp = Date.now()) {
    const cleanTag = normalizePlayerTag(playerTag);
    if (!cleanTag || cleanTag === 'DEFAULT0') return;

    if (state?.allPlayersData && typeof state.allPlayersData === 'object') {
        if (!state.allPlayersData[cleanTag]) {
            state.allPlayersData[cleanTag] = {};
        }
        state.allPlayersData[cleanTag].lastRefreshedAt = timestamp;
    }

    try {
        const activeKey = getPlayerStorageKey(cleanTag);
        const playerStr = localStorage.getItem(activeKey);
        const parsed = safeJsonParse(playerStr, {}) || {};
        parsed.lastRefreshedAt = timestamp;
        localStorage.setItem(activeKey, JSON.stringify(parsed));
    } catch {}
}

/**
 * Determines whether a player's cached data is stale and requires refreshing from the API.
 *
 * @param {string} playerTag - Player tag identifier.
 * @param {number} [cooldownMs=ACCOUNT_REFRESH_COOLDOWN_MS] - Cooldown duration in milliseconds.
 * @returns {boolean} True if data is stale or uninitialized, false if fresh.
 */
export function isPlayerRefreshStale(playerTag, cooldownMs = ACCOUNT_REFRESH_COOLDOWN_MS) {
    const cleanTag = normalizePlayerTag(playerTag);
    if (!cleanTag || cleanTag === 'DEFAULT0') return false;

    const lastRefreshed = getPlayerLastRefreshed(cleanTag);
    if (!lastRefreshed || !Number.isFinite(lastRefreshed) || lastRefreshed <= 0) return true;

    const now = Date.now();
    // Clock anomaly guard: if timestamp is significantly in the future (> 60s), treat as stale
    if (lastRefreshed > now + 60000) return true;

    return (now - lastRefreshed) >= cooldownMs;
}

/**
 * Filters a list of player tags down to only those whose cache is stale.
 *
 * @param {string[]} tags - Player tags to evaluate.
 * @param {number} [cooldownMs=ACCOUNT_REFRESH_COOLDOWN_MS] - Cooldown duration in milliseconds.
 * @returns {string[]} Filtered list of stale player tags.
 */
export function getStaleTagsForRefresh(tags, cooldownMs = ACCOUNT_REFRESH_COOLDOWN_MS) {
    if (!Array.isArray(tags)) return [];
    return tags.filter(tag => isPlayerRefreshStale(tag, cooldownMs));
}
