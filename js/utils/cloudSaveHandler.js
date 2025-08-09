import { dom } from '../dom/domElements.js';
import { state } from '../core/state.js';
import { loadUserData, saveUserData } from '../services/apiService.js';
import { generateUUID } from './uuidGenerator.js';
import { checkAppVersion } from './versioning.js';

export async function initializeAppData() {
    let userId = localStorage.getItem('oreCalcUserId');
    if (!userId) {
        userId = generateUUID();
        localStorage.setItem('oreCalcUserId', userId);
    }

    const localData = await checkAppVersion();
    if (localData && localData.savedPlayerTags.length === 1 && localData.savedPlayerTags[0] === 'DEFAULT0') {
        console.log("Skipping cloud sync: Only default player tag exists locally.");
        return localData;
    }

    let cloudData = null;
    try {
        cloudData = await loadUserData(userId);
    } catch (error) {
        console.error('Failed to load data from cloud, falling back to local storage:', error);
    }

    if (cloudData && localData) {
        const cloudTimestamp = new Date(cloudData.timestamp || 0);
        const localTimestamp = new Date(localData.timestamp || 0);
        const timeDifference = Math.abs(cloudTimestamp.getTime() - localTimestamp.getTime());
        const timeTolerance = 5 * 1000; // 5 seconds

        if (timeDifference < timeTolerance) {
            console.log("Local and cloud data are within 5 seconds discrepancy. Considering them in sync.");
            return localData;
        } else if (cloudTimestamp > localTimestamp) {
            if (confirm("Newer data is available on the cloud. Do you want to sync?")) {
                console.log("User chose to sync. Using cloud data.");
                return cloudData;
            } else {
                console.log("User chose not to sync. Using local data and pushing to cloud.");
                if (userId) { // userId should exist here
                    try {
                        await saveUserData(userId, localData);
                        console.log("Local data pushed to cloud.");
                    } catch (error) {
                        console.error("Failed to push local data to cloud:", error);
                    }
                }
                return localData;
            }
        } else if (localTimestamp > cloudTimestamp) {
            console.log("Local data is newer. Automatically pushing to cloud.");
                const userId = localStorage.getItem('oreCalcUserId');
                if (userId) {
                    try {
                        await saveUserData(userId, localData);
                        console.log("Local data pushed to cloud.");
                    } catch (error) {
                        console.error("Failed to push local data to cloud:", error);
                    }
                }
            return localData;
        }
    } else if (cloudData) {
        console.log("Only cloud data found. Using cloud data.");
        return cloudData;
    } else {
        console.log("Only local data found. Using local data.");
        return localData;
    }
}

// Escape special characters to prevent XSS in dialog text
function escapeForDialog(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function importUserData(importId) {
    if (importId) {
        const safeImportId = escapeForDialog(importId);
        if (confirm(`Are you sure you want to import data for User ID: ${safeImportId}? This will overwrite your current data.`)) {
            try {
                const importedData = await loadUserData(importId);
                if (importedData) {
                    // Overwrite local storage with imported data
                    localStorage.setItem('oreCalcState', JSON.stringify(importedData));
                    localStorage.setItem('oreCalcUserId', importId); // Set new userId
                    alert('Data imported successfully! Reloading app...');
                    location.reload(); // Reload app to apply new state
                } else {
                    alert('No data found for that User ID.');
                }
            } catch (error) {
                console.error('Error importing data:', error);
                alert('Failed to import data. Please check the User ID and try again.');
            }
        }
    } else {
        alert('Please enter a User ID to import.');
    }
}

// Function to trigger an explicit cloud save
async function triggerCloudSave() {
    const currentUserId = localStorage.getItem('oreCalcUserId');
    if (currentUserId) {
        try {
            // Construct the state object to save, similar to localStorageManager.js
            const currentPlayerTag = state.lastPlayerTag;
            if (currentPlayerTag) {
                state.allPlayersData[currentPlayerTag] = {
                    heroes: state.heroes,
                    storedOres: state.storedOres,
                    income: state.income,
                    playerData: state.playerData,
                    regionalPricingEnabled: state.uiSettings.regionalPricingEnabled,
                    currency: state.uiSettings.currency,
                };
            }

            const stateToSave = {
                appVersion: state.appVersion,
                lastPlayerTag: state.lastPlayerTag,
                savedPlayerTags: state.savedPlayerTags,
                uiSettings: state.uiSettings,
                allPlayersData: state.allPlayersData,
                timestamp: state.timestamp,
            };

            await saveUserData(currentUserId, stateToSave);
            alert('Data saved to cloud successfully!');
        } catch (error) {
            console.error('Failed to save data to cloud:', error);
            alert('Failed to save data to cloud. Please try again.');
        }
    }
}

export function initializeCloudSaveButtons() {
    const floatingSaveBtn = dom.controls?.saveButton;
    const fabSaveDataPill = dom.fab?.pills?.saveData;

    if (floatingSaveBtn) {
        floatingSaveBtn.addEventListener('click', triggerCloudSave);
    }
    if (fabSaveDataPill) {
        fabSaveDataPill.addEventListener('click', triggerCloudSave);
    }
}