import { logger } from '../utils/logger.js';

const BASE_URL = window.__ENV__?.VITE_API_BASE_URL || "https://api.orecalc.tech";

/**
 * Checks if the general API is blocked due to rate limiting (429).
 * Throws an error immediately if blocked.
 */
function checkApiBlock() {
    const blockedUntilStr = localStorage.getItem('oreCalcApiBlockedUntil');
    if (blockedUntilStr) {
        const blockedUntil = parseInt(blockedUntilStr, 10);
        const now = Date.now();
        if (now < blockedUntil) {
            const secondsLeft = Math.ceil((blockedUntil - now) / 1000);
            throw new Error(`apiErrors.rateLimitedWithTime:${secondsLeft}`);
        } else {
            localStorage.removeItem('oreCalcApiBlockedUntil');
        }
    }
}

/**
 * Checks if Clash of Clans API proxy requests are blocked due to maintenance (503).
 * Throws an error immediately if blocked.
 */
function checkClashApiBlock() {
    const blockedUntilStr = localStorage.getItem('oreCalcClashApiBlockedUntil');
    if (blockedUntilStr) {
        const blockedUntil = parseInt(blockedUntilStr, 10);
        const now = Date.now();
        if (now < blockedUntil) {
            throw new Error('apiErrors.503');
        } else {
            localStorage.removeItem('oreCalcClashApiBlockedUntil');
        }
    }
}

/**
 * Sets a block on general API requests for a specified duration.
 *
 * @param {number} seconds - The duration in seconds (minimum 60).
 */
function setApiBlock(seconds) {
    const blockDurationMs = Math.max(seconds, 60) * 1000;
    localStorage.setItem('oreCalcApiBlockedUntil', (Date.now() + blockDurationMs).toString());
}

/**
 * Sets a block on Clash of Clans API requests for 60 seconds.
 */
function setClashApiBlock() {
    const blockDurationMs = 60 * 1000; // minimum 60 seconds
    localStorage.setItem('oreCalcClashApiBlockedUntil', (Date.now() + blockDurationMs).toString());
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
        let seconds = 60; // minimum 60 seconds
        if (retryAfter) {
            const parsedSeconds = parseInt(retryAfter, 10);
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
        localStorage.setItem('oreCalcUpdateDetectedAt', '1');
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
 * Fetches player data for a given player tag, automatically stripping a leading '#' if present.
 * The request is proxied through the API server to avoid CORS or auth issues.
 *
 * @param {string} playerTag - The player tag to query (e.g. "#PPYY9988" or "PPYY9988").
 * @param {string} [token] - Optional Clash of Clans API verification token for protected tag access.
 * @returns {Promise<Object>} The parsed player data from the API response.
 * @throws {Error} Throws if the API request fails or returns a non-OK HTTP status.
 */
export async function fetchPlayerData(playerTag, token = null, timeoutMs = null) {
    checkApiBlock();
    checkClashApiBlock();

    const cleanedTag = playerTag.startsWith('#') ? playerTag.substring(1) : playerTag;
    let url = `${BASE_URL}/proxy/players/${cleanedTag}`;
    if (token) {
        url += `?token=${encodeURIComponent(token)}`;
    }

    const headers = { 'Accept': 'application/json' };
    const userId = localStorage.getItem('oreCalcUserId');
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
 * Fetches the minimum required client/app version from the backend.
 * Used for cache busting or checking if the user needs to reload to get update.
 *
 * @returns {Promise<string>} The current application version string.
 * @throws {Error} Throws if the network fails or version cannot be retrieved.
 */
export async function fetchRequiredClientVersion() {
    checkApiBlock();

    const url = `${BASE_URL}/api/version`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }
        const data = await response.json();
        return data.currentAppVersion;
    } catch (error) {
        logger.error("Error fetching required client version:", error);
        throw error;
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
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, data })
        });

        if (!response.ok) {
            throw new Error(await handleResponseError(response));
        }

        return await response.json();
    } catch (error) {
        logger.error("Error saving user data:", error);
        throw error;
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
    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(await handleResponseError(response));
        }

        return await response.json();
    } catch (error) {
        logger.error("Error loading user data:", error);
        throw error;
    }
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
                'x-user-id': localStorage.getItem('oreCalcUserId') || ''
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

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const url = `${BASE_URL}/proxy/clans/${cleanedTag}/warlog`;

    const headers = { 'Accept': 'application/json' };
    const userId = localStorage.getItem('oreCalcUserId');
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
        logger.error("Error fetching clan war log:", error);
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

    const cleanedTag = clanTag.startsWith('#') ? clanTag.substring(1) : clanTag;
    const url = `${BASE_URL}/proxy/clans/${cleanedTag}/currentwar/leaguegroup`;

    const headers = { 'Accept': 'application/json' };
    const userId = localStorage.getItem('oreCalcUserId');
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

    const cleanedTag = warTag.startsWith('#') ? warTag.substring(1) : warTag;
    const url = `${BASE_URL}/proxy/clanwarleagues/wars/${cleanedTag}`;

    const headers = { 'Accept': 'application/json' };
    const userId = localStorage.getItem('oreCalcUserId');
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

    const cleanedTag = clanTag.startsWith('#') ? clanTag : `#${clanTag}`;
    const url = `${BASE_URL}/api/cwl/wars?clanTag=${encodeURIComponent(cleanedTag)}`;

    const headers = { 'Accept': 'application/json' };
    const userId = localStorage.getItem('oreCalcUserId');
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