const BASE_URL = window.__ENV__?.VITE_API_BASE_URL || "https://api.orecalc.tech";

/**
 * Fetches player data for a given player tag, automatically stripping a leading '#' if present.
 * The request is proxied through the API server to avoid CORS or auth issues.
 *
 * @param {string} playerTag - The player tag to query (e.g. "#PPYY9988" or "PPYY9988").
 * @returns {Promise<Object>} The parsed player data from the API response.
 * @throws {Error} Throws if the API request fails or returns a non-OK HTTP status.
 */
export async function fetchPlayerData(playerTag) {
    const cleanedTag = playerTag.startsWith('#') ? playerTag.substring(1) : playerTag;
    const url = `${BASE_URL}/proxy/players/${cleanedTag}`;

    try {
        const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} - ${errorData.reason || 'Unknown error'}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error fetching player data:", error);
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
        console.error("Error fetching required client version:", error);
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
        console.error("Error saving user data:", error);
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
        console.error("Error loading user data:", error);
        return null;
    }
}