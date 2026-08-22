import { MAX_SAVED_PLAYERS } from './constants.js';
import { getResettingState, saveState } from './localStorageManager.js';
import { state } from './state.js';

import { resetHeroJourneyScrollPositions } from '../components/home/heroJourneyScrollManager.js';

let stateUpdateCallback = null;
let cloudSaveTimeout = null;

/**
 * Registers the callback for updating UI elements on state change.
 * This decouples the state manager from calculator and renderer modules.
 * @param {(state: import('./types.js').AppState, silent: boolean) => void} callback - Callback function.
 */
export function registerStateUpdateCallback(callback) {
    stateUpdateCallback = callback;
}

/**
 * Updates application state safely, triggering recalculations, UI renders, local storage persistence,
 * and debounced cloud saves.
 * @param {() => void} updateFn - Function that modifies state.
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
 * Safely switches the active player by pointing global active state references
 * directly to the selected player's data partition in O(1) time without JSON cloning.
 * @param {string} newTag - The player tag to switch to.
 */
export function switchActivePlayer(newTag) {
    resetHeroJourneyScrollPositions();
    handleStateUpdate(() => {
        const newPlayerData = state.allPlayersData[newTag];
        if (!newPlayerData) {
            console.error(`switchActivePlayer: Player data not found for tag: ${newTag}`);
            return;
        }

        if (newTag !== 'DEFAULT0' && state.savedPlayerTags.includes('DEFAULT0')) {
            state.savedPlayerTags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
            delete state.allPlayersData['DEFAULT0'];
            try {
                localStorage.removeItem('oreCalc_player_DEFAULT0');
            } catch (e) {}
        }

        const existingIndex = state.savedPlayerTags.indexOf(newTag);
        if (existingIndex !== -1) {
            state.savedPlayerTags.splice(existingIndex, 1);
        }
        state.savedPlayerTags.unshift(newTag);
        if (state.savedPlayerTags.length > MAX_SAVED_PLAYERS) {
            state.savedPlayerTags.pop();
        }

        // ponytail: direct reference binding over JSON clone. Active player references point to partition.
        state.heroes = newPlayerData.heroes;
        state.storedOres = newPlayerData.storedOres;
        state.income = newPlayerData.income;
        state.planner = newPlayerData.planner;
        if (state.planner?.calendar) {
            state.planner.calendar.isHydrated = false;
        }
        state.playerProfile = newPlayerData.playerProfile || null;
        state.heroJourney = newPlayerData.heroJourney || { overrideUnclaimed: [], acceleratedRewards: false };
        state.onboardingTimestamp = newPlayerData.onboardingTimestamp ?? null;

        if (newPlayerData.currency && typeof newPlayerData.currency === 'object') {
            state.uiSettings.currency = {
                code: newPlayerData.currency.code || 'USD'
            };
        }
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (getResettingState() || localStorage.getItem('oreCalc_playerTags') === null) {
            return;
        }

        saveState(state, true);

        if (cloudSaveTimeout && state.uiSettings?.cloudSync !== false) {
            clearTimeout(cloudSaveTimeout);
            cloudSaveTimeout = null;

            const currentUserId = localStorage.getItem('oreCalc_userId');
            if (currentUserId) {
                const currentPlayerTag = state.savedPlayerTags[0];
                if (currentPlayerTag) {
                    const existing = state.allPlayersData[currentPlayerTag] || {};
                    state.allPlayersData[currentPlayerTag] = {
                        ...existing,
                        heroes: state.heroes,
                        storedOres: state.storedOres,
                        income: state.income,
                        planner: state.planner,
                        playerProfile: state.playerProfile,
                        onboardingTimestamp: existing.onboardingTimestamp !== undefined
                            ? existing.onboardingTimestamp
                            : (state.onboardingTimestamp ?? null),
                        currency: {
                            code: state.uiSettings.currency?.code || 'USD',
                            globalPricing: existing?.currency?.globalPricing || {}
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
}
