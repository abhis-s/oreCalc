import { logger } from '../utils/logger.js';

const BASE_URL = window.__ENV__?.VITE_API_BASE_URL || "https://api.orecalc.tech";

/**
 * Fetches player data for a given player tag, automatically stripping a leading '#' if present.
 * The request is proxied through the API server to avoid CORS or auth issues.
 *
 * @param {string} playerTag - The player tag to query (e.g. "#PPYY9988" or "PPYY9988").
 * @param {string} [token] - Optional Clash of Clans API verification token for protected tag access.
 * @returns {Promise<Object>} The parsed player data from the API response.
 * @throws {Error} Throws if the API request fails or returns a non-OK HTTP status.
 */
export async function fetchPlayerData(playerTag, token = null) {
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

    try {
        const response = await fetch(url, { headers });

        if (!response.ok) {
            let errorKey = `apiErrors.${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.reason) {
                    errorKey = `apiErrors.${errorData.reason}`;
                } else if (errorData.message) {
                    errorKey = errorData.message;
                }
            } catch (jsonErr) {
                // Keep default status key if not JSON
            }
            throw new Error(errorKey);
        }

        return await response.json();
    } catch (error) {
        logger.error("Error fetching player data:", error);
        throw error;
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
    const url = `${BASE_URL}/api/version`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - Could not fetch client version`);
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
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }

        return await response.json();
    } catch (error) {
        logger.error("Error saving user data:", error);
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
    const url = `${BASE_URL}/api/user-data/load/${userId}`;
    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} - ${errorData.message || 'Unknown error'}`);
        }

        return await response.json();
    } catch (error) {
        logger.error("Error loading user data:", error);
        return null;
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
    const url = `${BASE_URL}/api/user-data/delete/${userId}`;
    try {
        const response = await fetch(url, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Unknown error during deletion');
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
    const url = `${BASE_URL}/api/user-data/erase-tag`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playerTag, token })
        });

        if (!response.ok) {
            let errorKey = `apiErrors.${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.reason) {
                    errorKey = `apiErrors.${errorData.reason}`;
                } else if (errorData.message) {
                    errorKey = errorData.message;
                }
            } catch (jsonErr) {
                // Not JSON, keep default status key
            }
            throw new Error(errorKey);
        }

        return await response.json();
    } catch (error) {
        logger.error("Error performing global player tag erasure:", error);
        throw error;
    }
}