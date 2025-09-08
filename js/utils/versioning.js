import { loadState, resetState } from '../core/localStorageManager.js';
import { initializeState } from '../core/state.js';
import { fetchRequiredClientVersion } from '../services/apiService.js';

export const compareVersions = (v1, v2) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
};

export async function checkAppVersion() {
    let currentAppVersionFromServer = '0.0.0';
    try {
        currentAppVersionFromServer = await fetchRequiredClientVersion();
    } catch (error) {
        console.error('Error fetching current app version:', error);
    }

    let savedState = loadState();

    let savedAppVersion = savedState ? savedState.appVersion : undefined;

    if (savedState) {
        if (savedAppVersion === undefined) {
            console.warn('Saved data format is old (missing appVersion). Resetting data without confirmation.');
            resetState();
            savedState = null;
            alert('Your saved data format is outdated. Data has been reset. The page will now reload.');
            location.reload();
        } else if (compareVersions(savedAppVersion, currentAppVersionFromServer) < 0) {
            console.warn(`App version mismatch. Saved: ${savedAppVersion}, Current: ${currentAppVersionFromServer}. Resetting data.`);
            if (confirm(`Your saved data is from an older version (${savedAppVersion}). It might be incompatible with the current version (${currentAppVersionFromServer}). Do you want to reset all your data?`)) {
                resetState();
                savedState = null;
                alert('Data reset successful. The page will now reload.');
                location.reload();
            } else {
                alert('Data not reset. You might experience issues with incompatible data.\nUse the "Reset" button in the settings tab to reset your data at any point.');
            }
        }
    }

    if (!savedState) {
        savedState = {
            appVersion: currentAppVersionFromServer,
            savedPlayerTags: ['DEFAULT0']
        };
    }

    return savedState;
}