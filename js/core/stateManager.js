import { state } from './state.js';
import { saveState } from './localStorageManager.js';

let stateUpdateCallback = null;
let cloudSaveTimeout = null;

/**
 * Registers the callback for updating UI elements on state change.
 * This decouples the state manager from calculator and renderer modules.
 *
 * @param {Function} callback - Callback function(state, silent).
 */
export function registerStateUpdateCallback(callback) {
    stateUpdateCallback = callback;
}

/**
 * Updates application state safely, triggering recalculations, UI renders, local storage persistence,
 * and debounced cloud saves.
 *
 * @param {Function} updateFn - Function that modifies state.
 * @param {boolean} [silent=false] - If true, skips UI rendering.
 */
export function handleStateUpdate(updateFn, silent = false) {
    if (!silent && state.planner?.calendar) {
        state.planner.calendar.isDirty = true;
    }
    state.timestamp = new Date().toISOString();
    updateFn();

    if (stateUpdateCallback) {
        stateUpdateCallback(state, silent);
    }
    saveState(state);

    if (state.uiSettings.cloudSync !== false) {
        if (cloudSaveTimeout) {
            clearTimeout(cloudSaveTimeout);
        }
        cloudSaveTimeout = setTimeout(() => {
            import('../utils/cloudSaveHandler.js').then(module => {
                module.triggerCloudSave({ silent: true });
            });
        }, 3000);
    } else {
        if (cloudSaveTimeout) {
            clearTimeout(cloudSaveTimeout);
            cloudSaveTimeout = null;
        }
    }
}

/**
 * Safely switches the active player by saving the current player's state
 * and loading the new player's state into the global state fields,
 * avoiding data bleeding.
 *
 * @param {string} newTag - The player tag to switch to.
 */
export function switchActivePlayer(newTag) {
    handleStateUpdate(() => {
        const oldTag = state.savedPlayerTags[0];
        
        // 1. Save old active player data to their slot in allPlayersData
        if (oldTag && state.allPlayersData[oldTag]) {
            const oldPlayerData = {
                ...state.allPlayersData[oldTag],
                heroes: JSON.parse(JSON.stringify(state.heroes)),
                storedOres: JSON.parse(JSON.stringify(state.storedOres)),
                income: JSON.parse(JSON.stringify(state.income)),
                planner: JSON.parse(JSON.stringify(state.planner)),
                playerProfile: state.playerProfile ? JSON.parse(JSON.stringify(state.playerProfile)) : null
            };
            state.allPlayersData[oldTag] = oldPlayerData;
            localStorage.setItem(`oreCalc_player_${oldTag}`, JSON.stringify(oldPlayerData));
        }

        // 2. Load the new player's data from allPlayersData
        const newPlayerData = state.allPlayersData[newTag];
        if (!newPlayerData) {
            console.error(`switchActivePlayer: Player data not found for tag: ${newTag}`);
            return;
        }

        // 3. Update savedPlayerTags order
        if (newTag !== 'DEFAULT0' && state.savedPlayerTags.includes('DEFAULT0')) {
            state.savedPlayerTags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
            delete state.allPlayersData['DEFAULT0'];
        }

        const existingIndex = state.savedPlayerTags.indexOf(newTag);
        if (existingIndex !== -1) {
            state.savedPlayerTags.splice(existingIndex, 1);
        }
        state.savedPlayerTags.unshift(newTag);
        if (state.savedPlayerTags.length > 12) {
            state.savedPlayerTags.pop();
        }

        // 4. Update the global state active fields
        const safeClone = (obj, fallback = {}) => {
            try {
                return obj ? JSON.parse(JSON.stringify(obj)) : fallback;
            } catch (e) {
                console.warn('Failed to clone state object, using fallback', e);
                return fallback;
            }
        };

        state.heroes = safeClone(newPlayerData.heroes);
        state.storedOres = safeClone(newPlayerData.storedOres);
        state.income = safeClone(newPlayerData.income);
        state.planner = safeClone(newPlayerData.planner);
        state.playerProfile = safeClone(newPlayerData.playerProfile, null);

        if (newPlayerData.currency && typeof newPlayerData.currency === 'object') {
            state.uiSettings.currency = {
                code: newPlayerData.currency.code || 'USD'
            };
        }
    });
}

// Flush pending changes on page unload
window.addEventListener('beforeunload', () => {
    // 1. Force immediate local storage save
    saveState(state, true);

    // 2. Force immediate cloud save via sendBeacon if cloudSync is enabled
    if (cloudSaveTimeout && state.uiSettings?.cloudSync !== false) {
        clearTimeout(cloudSaveTimeout);
        cloudSaveTimeout = null;

        const currentUserId = localStorage.getItem('oreCalc_userId');
        if (currentUserId) {
            const currentPlayerTag = state.savedPlayerTags[0];
            if (currentPlayerTag) {
                state.allPlayersData[currentPlayerTag] = {
                    heroes: state.heroes,
                    storedOres: state.storedOres,
                    income: state.income,
                    planner: state.planner,
                    playerProfile: state.playerProfile,
                    currency: {
                        code: state.uiSettings.currency?.code || 'USD',
                        globalPricing: state.allPlayersData[currentPlayerTag]?.currency?.globalPricing || {}
                    }
                };
            }

            const stateToSave = {
                appVersion: state.appVersion,
                savedPlayerTags: state.savedPlayerTags,
                uiSettings: state.uiSettings,
                allPlayersData: state.allPlayersData,
                timestamp: state.timestamp,
            };

            const isOnlyDefault = state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0';
            if (!isOnlyDefault) {
                const BASE_URL = window.__ENV__?.VITE_API_BASE_URL || "https://api.orecalc.tech";
                const url = `${BASE_URL}/api/user-data/save`;
                const blob = new Blob([JSON.stringify({ userId: currentUserId, data: stateToSave })], { type: 'application/json' });
                navigator.sendBeacon(url, blob);
            }
        }
    }
});

