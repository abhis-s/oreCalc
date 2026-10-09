import { MAX_SAVED_PLAYERS, STORAGE_KEY_MAP } from './constants.js';
import { getResettingState, saveState } from './localStorageManager.js';
import { normalizePlayerTag, getPlayerStorageKey, getStorageItem } from './storageKeys.js';
import { getDefaultPlayerState, state } from './state.js';
import { getApiBaseUrl } from '../services/apiService.js';
import { triggerPreferencesSave, triggerCloudSave } from '../services/cloudSaveService.js';

let stateUpdateCallback = null;
let cloudSaveTimeout = null;

/**
 * Cancels any active pending debounced cloud save timer.
 */
export function cancelCloudSaveTimer() {
    if (cloudSaveTimeout) {
        clearTimeout(cloudSaveTimeout);
        cloudSaveTimeout = null;
    }
}

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
 * @param {{ skipSave?: boolean, preferencesOnly?: boolean, skipRecalculate?: boolean, isTabSwitch?: boolean }} [options={}] - Optional execution flags (e.g. skipSave for cross-tab sync, preferencesOnly for decoupled preferences, isTabSwitch/skipRecalculate for view updates).
 */
export function handleStateUpdate(updateFn, silent = false, options = {}) {
    if (!silent && !options.isTabSwitch && state.planner?.calendar) {
        state.planner.calendar.isDirty = true;
    }
    if (!options.isTabSwitch) {
        state.timestamp = new Date().toISOString();
    }
    updateFn();

    if (stateUpdateCallback) {
        stateUpdateCallback(state, silent, options);
    }
    if (!options.skipSave && !options.isTabSwitch) {
        saveState(state, Boolean(options.preferencesOnly));
    }

    if (options.isTabSwitch) {
        return;
    }

    if (options.preferencesOnly) {
        triggerPreferencesSave({ silent: true }).catch(() => {});
        return;
    }

    const hasPlayerState = Array.isArray(state.savedPlayerTags) && Boolean(state.allPlayersData);
    const hasRealPlayer = hasPlayerState && state.savedPlayerTags.some(t => t && t !== 'DEFAULT0');
    const isAuthed = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('clashCalc_authToken') && localStorage.getItem('clashCalc_username'));
    const shouldSync = isAuthed || (state.uiSettings?.cloudSync !== false && hasRealPlayer);
    if (shouldSync && !options.skipSave && hasPlayerState) {
        if (cloudSaveTimeout) {
            clearTimeout(cloudSaveTimeout);
        }
        cloudSaveTimeout = setTimeout(() => {
            triggerCloudSave({ silent: true }).catch(() => {});
        }, 3000);
    } else if (!options.skipSave) {
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
 * @param {{ skipSave?: boolean, preferencesOnly?: boolean, silent?: boolean }} [options={}] - Execution options.
 */
export function switchActivePlayer(newTag, options = {}) {
    handleStateUpdate(() => {
        const cleanTag = normalizePlayerTag(newTag);
        let newPlayerData = state.allPlayersData[cleanTag] || state.allPlayersData[newTag];
        if (!newPlayerData) {
            if (state.savedPlayerTags.some(t => normalizePlayerTag(t) === cleanTag)) {
                newPlayerData = getDefaultPlayerState();
                state.allPlayersData[cleanTag] = newPlayerData;
            } else {
                console.error(`switchActivePlayer: Player data not found for tag: ${newTag}`);
                return;
            }
        }

        if (cleanTag !== 'DEFAULT0' && state.savedPlayerTags.some(t => normalizePlayerTag(t) === 'DEFAULT0')) {
            state.savedPlayerTags = state.savedPlayerTags.filter(tag => normalizePlayerTag(tag) !== 'DEFAULT0');
            delete state.allPlayersData['DEFAULT0'];
            try {
                localStorage.removeItem(getPlayerStorageKey('DEFAULT0'));
            } catch (e) {}
        }

        state.savedPlayerTags = state.savedPlayerTags.filter(tag => normalizePlayerTag(tag) !== cleanTag);
        state.savedPlayerTags.unshift(cleanTag);
        if (state.savedPlayerTags.length > MAX_SAVED_PLAYERS) {
            state.savedPlayerTags.pop();
        }

        // ponytail: direct reference binding over JSON clone. Active player references point to partition.
        const defaultState = getDefaultPlayerState();
        state.heroes = newPlayerData.heroes || defaultState.heroes;
        state.storedOres = newPlayerData.storedOres || defaultState.storedOres;
        state.income = newPlayerData.income || defaultState.income;
        state.planner = newPlayerData.planner || defaultState.planner;
        if (state.planner?.calendar) {
            state.planner.calendar.isHydrated = false;
        }
        state.playerProfile = newPlayerData.playerProfile || null;
        state.heroJourney = newPlayerData.heroJourney || defaultState.heroJourney;
        state.onboardingTimestamp = newPlayerData.onboardingTimestamp ?? null;

        if (newPlayerData.currency && typeof newPlayerData.currency === 'object') {
            state.uiSettings.currency = {
                code: newPlayerData.currency.code || 'USD'
            };
        }
    }, Boolean(options.silent), options);
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeunload', () => {
        if (
            getResettingState() ||
            !state ||
            !Array.isArray(state.savedPlayerTags) ||
            state.savedPlayerTags.length === 0 ||
            !state.allPlayersData ||
            getStorageItem(STORAGE_KEY_MAP.playerTags.canonical, STORAGE_KEY_MAP.playerTags.legacy) === null
        ) {
            return;
        }

        saveState(state, true);

        const isAuthedBeforeUnload = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('clashCalc_authToken') && localStorage.getItem('clashCalc_username'));
        const hasRealPlayer = Array.isArray(state.savedPlayerTags) && state.savedPlayerTags.some(t => t && t !== 'DEFAULT0');
        if (!isAuthedBeforeUnload && !hasRealPlayer) {
            return;
        }

        if (cloudSaveTimeout && (isAuthedBeforeUnload || state.uiSettings?.cloudSync !== false)) {
            clearTimeout(cloudSaveTimeout);
            cloudSaveTimeout = null;

            const currentUserId = getStorageItem(STORAGE_KEY_MAP.userId.canonical, STORAGE_KEY_MAP.userId.legacy);
            if (currentUserId) {
                const currentPlayerTag = state.savedPlayerTags[0];
                if (currentPlayerTag && state.allPlayersData[currentPlayerTag]) {
                    const existing = state.allPlayersData[currentPlayerTag];
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

                const url = `${getApiBaseUrl()}/api/user-data/save`;
                const payload = JSON.stringify({ userId: currentUserId, data: stateToSave });
                const headers = { 'Content-Type': 'application/json' };
                const token = typeof localStorage !== 'undefined' ? localStorage.getItem('clashCalc_authToken') : null;
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                if (typeof fetch === 'function') {
                    fetch(url, {
                        method: 'POST',
                        headers,
                        body: payload,
                        keepalive: true
                    }).catch(() => {});
                } else if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                    const blob = new Blob([payload], { type: 'application/json' });
                    navigator.sendBeacon(url, blob);
                }
            }
        }
    });
}
