const BASE_URL = "__VITE_API_BASE_URL__"; // Placeholder for environment variable

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