import { formatDisplayTag, getActiveUserId, normalizePlayerTag } from '../core/storageKeys.js';
import { logger } from '../utils/logger.js';

/**
 * Resolves the appropriate backend API base URL based on the active origin.
 *
 * @param {string} [hostname] - Optional hostname override for testing or SSR contexts.
 * @returns {string} Fully qualified backend API origin.
 */
export function getApiBaseUrl(hostname) {
    const currentHost = hostname || (typeof window !== 'undefined' ? window.location?.hostname : '');
    if (currentHost) {
        if (currentHost === 'clashcalc.com' ||
            currentHost === 'www.clashcalc.com' ||
            currentHost.endsWith('.clashcalc.com')) {
            return 'https://api.clashcalc.com';
        }
    }
    return (typeof window !== 'undefined' && (window.__ENV__?.PUBLIC_API_BASE_URL || window.__ENV__?.VITE_API_BASE_URL)) || 'https://api.orecalc.tech';
}

const BASE_URL = getApiBaseUrl();

/**
 * Injects Authorization header if a session token is present.
 * @param {Record<string, string>} [baseHeaders]
 * @returns {Record<string, string>}
 */
function getAuthHeaders(baseHeaders = {}) {
    const headers = { ...baseHeaders };
    if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem('clashCalc_authToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return headers;
}

let apiBlockedUntil = 0;
let clashApiBlockedUntil = 0;

/**
 * Checks if the general API is blocked due to rate limiting (429).
 * Throws an error immediately if blocked.
 */
function checkApiBlock() {
    if (apiBlockedUntil && Date.now() < apiBlockedUntil) {
        const secondsLeft = Math.ceil((apiBlockedUntil - Date.now()) / 1000);
        throw new Error(`apiErrors.rateLimitedWithTime:${secondsLeft}`);
    }
}

/**
 * Checks if Clash of Clans API proxy requests are blocked due to maintenance (503).
 * Throws an error immediately if blocked.
 */
function checkClashApiBlock() {
    if (clashApiBlockedUntil && Date.now() < clashApiBlockedUntil) {
        throw new Error('apiErrors.503');
    }
}

/**
 * Sets a block on general API requests for a specified duration.
 * @param {number} seconds - The duration in seconds (minimum 60).
 */
function setApiBlock(seconds) {
    const blockDurationMs = Math.max(seconds, 60) * 1000;
    apiBlockedUntil = Date.now() + blockDurationMs;
}

/**
 * Sets a block on Clash of Clans API requests for 60 seconds.
 */
function setClashApiBlock() {
    clashApiBlockedUntil = Date.now() + 60 * 1000;
}

/**
 * Helper to construct standard and rate-limiting error messages from HTTP responses.
 *
 * @param {Response} response - The Fetch API Response object.
 * @returns {Promise<string>} The resolved error translation key or raw message.
 */
async function handleResponseError(response) {
    if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        let seconds = 60;
        if (retryAfter) {
            const parsedSeconds = Number(retryAfter);
            if (!isNaN(parsedSeconds)) {
                seconds = Math.max(parsedSeconds, 60);
            }
        }
        setApiBlock(seconds);
        return `apiErrors.rateLimitedWithTime:${seconds}`;
    }

    if (response.status === 503) {
        setClashApiBlock();
        return 'apiErrors.503';
    }

    if (response.status === 410) {
        return 'apiErrors.deletedUser';
    }

    if (response.status === 426) {
        sessionStorage.setItem('oreCalcUpdateDetectedAt', '1');
        document.dispatchEvent(new CustomEvent('app:api-version-force-update'));
        return 'apiErrors.updateRequired';
    }

    let errorKey = `apiErrors.${response.status}`;
    try {
        const errorData = await response.json();
        if (errorData.reason) {
            if (errorData.reason === 'inMaintenance') {
                setClashApiBlock();
                errorKey = 'apiErrors.inMaintenance';
            } else {
                errorKey = `apiErrors.${errorData.reason}`;
            }
        } else if (errorData.message) {
            errorKey = errorData.message;
        }
    } catch (jsonErr) {
        // Keep default status key if not JSON
    }
    return errorKey;
}

/**
 * Fetches player data for a given player tag, automatically stripping all '#' hashes.
 * The request is proxied through the API server to avoid CORS or auth issues.
 *
 * @param {string} playerTag - The player tag to query (e.g. "#8PJYGUJC", "#####8PJYGUJC", or "8PJYGUJC").
 * @param {string | null} [token=null] - Optional Clash of Clans API verification token for protected tag access.
 * @param {number | null} [timeoutMs=null] - Request timeout duration in milliseconds.
 * @returns {Promise<any>} The parsed player data from the API response.
 * @throws {Error} Throws if the API request fails or returns a non-OK HTTP status.
 */
export async function fetchPlayerData(playerTag, token = null, timeoutMs = null) {
    checkApiBlock();
    checkClashApiBlock();

    const cleanTag = normalizePlayerTag(playerTag);
    const url = `${BASE_URL}/proxy/players/${encodeURIComponent(cleanTag)}`;

    const headers = { 'Accept': 'application/json' };
    if (token) {
        headers['x-verify-token'] = token;
    }
    const userId = getActiveUserId();
    if (userId) {
        headers['x-user-id'] = userId;
    }

    let controller = null;
    let timeoutId = null;
    if (timeoutMs) {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
        const response = await fetch(url, { headers, signal: controller?.signal });

        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('apiErrors.timeout');
        }
        logger.error("Error fetching player data:", error);
        throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}

/**
 * Saves/persists the user's progress or application data (like levels, calculations) to the server.
 *
 * @param {string} userId - The unique identifier of the user.
 * @param {Object} data - The data object to be saved/persisted.
 * @returns {Promise<Object|undefined>} The API response payload on success, or undefined on failure.
 */
export async function saveUserData(userId, data) {
    checkApiBlock();

    const url = `${BASE_URL}/api/user-data/save`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders({
            'Content-Type': 'application/json',
            'x-app-version': window.__ENV__?.APP_VERSION || '2.0.0'
        }),
        body: JSON.stringify({ userId, data })
    });

    if (!response.ok) {
        throw new Error(await handleResponseError(response));
    }

    return await response.json();
}

/**
 * Saves/persists a single player profile data payload to the server.
 *
 * @param {string} userId - The unique identifier of the user.
 * @param {string} tag - The player tag being saved.
 * @param {Object} playerData - The single player data object.
 * @returns {Promise<Object|undefined>} The API response payload on success.
 */
export async function saveSinglePlayerData(userId, tag, playerData) {
    checkApiBlock();

    const url = `${BASE_URL}/api/user-data/save-player`;
    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders({
            'Content-Type': 'application/json',
            'x-app-version': window.__ENV__?.APP_VERSION || '2.0.0'
        }),
        body: JSON.stringify({ userId, tag, playerData })
    });

    if (!response.ok) {
        throw new Error(await handleResponseError(response));
    }

    return await response.json();
}

/**
 * Saves/persists decoupled user preferences to the server.
 *
 * @param {string} userId - The unique identifier of the user.
 * @param {Object} preferences - The decoupled uiSettings preferences object.
 * @returns {Promise<Object|undefined>} The API response payload on success.
 */
export async function saveUserPreferences(userId, preferences) {
    checkApiBlock();

    const url = `${BASE_URL}/api/user-data/preferences`;
    const response = await fetch(url, {
        method: 'PATCH',
        headers: getAuthHeaders({
            'Content-Type': 'application/json',
            'x-app-version': window.__ENV__?.APP_VERSION || '2.0.0'
        }),
        body: JSON.stringify({ userId, preferences })
    });

    if (!response.ok) {
        throw new Error(await handleResponseError(response));
    }

    return await response.json();
}

/**
 * Explicitly marks a user ID as migrated to ClashCalc in Firestore.
 *
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<Object|null>} Server response or null on error.
 */
export async function markUserMigrated(userId) {
    if (!userId) return null;
    checkApiBlock();

    const url = `${BASE_URL}/api/user-data/mark-migrated`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: getAuthHeaders({
                'Content-Type': 'application/json',
                'x-app-version': window.__ENV__?.APP_VERSION || '3.0.0'
            }),
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            return null;
        }

        return await response.json();
    } catch (error) {
        logger.warn('Failed to mark user migrated:', error);
        return null;
    }
}

/**
 * Loads/retrieves the user's previously saved progress or data from the server.
 * Gracefully handles 404 (user doesn't exist/no saved data yet) by returning null.
 *
 * @param {string} userId - The unique identifier of the user.
 * @returns {Promise<Object|null>} The loaded data payload, or null if not found (404) or on error.
 */
export async function loadUserData(userId) {
    checkApiBlock();

    const url = `${BASE_URL}/api/user-data/load/${userId}`;
    const response = await fetch(url, {
        headers: getAuthHeaders({
            'x-app-version': window.__ENV__?.APP_VERSION || '2.0.0'
        })
    });

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }
        throw new Error(await handleResponseError(response));
    }

    return await response.json();
}

/**
 * Deletes a user's cloud data from Firestore.
 *
 * @param {string} userId - The unique identifier of the user to delete.
 * @returns {Promise<Object>} The server response.
 * @throws {Error} If the API request fails.
 */
export async function deleteUserData(userId) {
    checkApiBlock();

    const url = `${BASE_URL}/api/user-data/delete/${userId}`;
    try {
        const response = await fetch(url, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }

        return await response.json();
    } catch (error) {
        logger.error("Error deleting user data:", error);
        throw error;
    }
}

/**
 * Erases a player tag globally from all user document configurations in Firestore,
 * verifying ownership using a Clash of Clans API verification token.
 *
 * @param {string} playerTag - The player tag to delete globally.
 * @param {string} token - The API token verifying tag ownership.
 * @returns {Promise<Object>} The server response.
 * @throws {Error} If verification or deletion fails, mapped to translation keys.
 */
export async function erasePlayerTagFromAllUsers(playerTag, token) {
    checkApiBlock();
    checkClashApiBlock();

    const url = `${BASE_URL}/api/user-data/erase-tag`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': getActiveUserId()
            },
            body: JSON.stringify({ playerTag, token })
        });

        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }

        return await response.json();
    } catch (error) {
        logger.error("Error performing global player tag erasure:", error);
        throw error;
    }
}

/**
 * Submits a bug report to the server.
 *
 * @param {string} email - Optional contact email of the user.
 * @param {string} description - The detailed description of the bug.
 * @param {Object} [attachData] - Optional serialized state data.
 * @param {string} [userId] - The user's ID.
 * @returns {Promise<Object>} The server response.
 * @throws {Error} If submission fails.
 */
export async function submitBugReport(email, description, attachData = null, userId = null) {
    checkApiBlock();

    const url = `${BASE_URL}/api/support/bug-report`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, description, attachData, userId })
        });

        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }

        return await response.json();
    } catch (error) {
        logger.error("Error submitting bug report:", error);
        throw error;
    }
}

/**
 * Fetches the clan war log for a specific clan tag.
 *
 * @param {string} clanTag - The clan tag to query.
 * @returns {Promise<Object>} The parsed war log data.
 */
export async function fetchClanWarLog(clanTag) {
    checkApiBlock();
    checkClashApiBlock();

    const cleanTag = normalizePlayerTag(clanTag);
    const url = `${BASE_URL}/proxy/clans/${encodeURIComponent(cleanTag)}/warlog`;

    const headers = { 'Accept': 'application/json' };
    const userId = getActiveUserId();
    if (userId) {
        headers['x-user-id'] = userId;
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }
        return await response.json();
    } catch (error) {
        logger.debug("Error fetching clan war log:", error);
        throw error;
    }
}

/**
 * Fetches the clan war league group information for a specific clan tag.
 *
 * @param {string} clanTag - The clan tag to query.
 * @returns {Promise<Object>} The parsed league group data.
 */
export async function fetchCwlLeagueGroup(clanTag) {
    checkApiBlock();
    checkClashApiBlock();

    const cleanTag = normalizePlayerTag(clanTag);
    const url = `${BASE_URL}/proxy/clans/${encodeURIComponent(cleanTag)}/currentwar/leaguegroup`;

    const headers = { 'Accept': 'application/json' };
    const userId = getActiveUserId();
    if (userId) {
        headers['x-user-id'] = userId;
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }
        return await response.json();
    } catch (error) {
        logger.error("Error fetching CWL league group:", error);
        throw error;
    }
}

/**
 * Fetches data for an individual CWL war tag.
 *
 * @param {string} warTag - The war tag to query.
 * @returns {Promise<Object>} The parsed war data.
 */
export async function fetchCwlWar(warTag) {
    checkApiBlock();
    checkClashApiBlock();

    const cleanTag = normalizePlayerTag(warTag);
    const url = `${BASE_URL}/proxy/clanwarleagues/wars/${encodeURIComponent(cleanTag)}`;

    const headers = { 'Accept': 'application/json' };
    const userId = getActiveUserId();
    if (userId) {
        headers['x-user-id'] = userId;
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }
        return await response.json();
    } catch (error) {
        logger.error("Error fetching CWL war info:", error);
        throw error;
    }
}

/**
 * Fetches cached historical CWL wars from our Firestore database for a specific clan tag.
 *
 * @param {string} clanTag - The clan tag to query.
 * @returns {Promise<Array>} List of cached CWL war objects.
 */
export async function fetchCwlWarsFromServer(clanTag) {
    checkApiBlock();

    const cleanTag = normalizePlayerTag(clanTag);
    const requestTag = formatDisplayTag(cleanTag);
    const url = `${BASE_URL}/api/cwl/wars?clanTag=${encodeURIComponent(requestTag)}`;

    const headers = { 'Accept': 'application/json' };
    const userId = getActiveUserId();
    if (userId) {
        headers['x-user-id'] = userId;
    }

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }
        return await response.json();
    } catch (error) {
        logger.error("Error fetching cached CWL wars from server:", error);
        throw error;
    }
}

/**
 * Fetches the live/cached running costs data from the server.
 *
 * @returns {Promise<Object>} The running costs data.
 */
export async function fetchRunningCosts() {
    checkApiBlock();
    const url = `${BASE_URL}/api/billing/costs`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        logger.error("Error fetching running costs from server:", error);
        throw error;
    }
}
