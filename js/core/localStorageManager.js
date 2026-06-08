import { sanitizeUISettings, sanitizePlayerState } from './stateCleanup.js';
import { state, getDefaultPlayerState as initializeDefaultPlayerState } from './state.js';

import { showSavingIndicator, hideSavingIndicator, showSaveErrorIndicator } from '../ui/savingIndicator.js';

const APP_STATE_KEY = 'oreCalculatorState';

let saveTimeout;

export function saveState(state, immediate = false) {
    if (state.uiSettings.saveError) {
        return;
    }
    clearTimeout(saveTimeout);

    const performSave = () => {
        try {
            const currentPlayerTag = state.savedPlayerTags[0];
            if (currentPlayerTag) {
                const playerData = {
                    heroes: state.heroes,
                    storedOres: state.storedOres,
                    income: state.income,
                    planner: state.planner,
                    playerProfile: state.playerProfile,
                    currency: {
                        code: state.uiSettings.currency.code,
                        globalPricing: state.allPlayersData[currentPlayerTag]?.currency?.globalPricing || {}
                    }
                };

                sanitizePlayerState(playerData);

                state.allPlayersData[currentPlayerTag] = playerData;
            }

            const stateToSave = {
                appVersion: state.appVersion,
                savedPlayerTags: state.savedPlayerTags.length > 0 ? state.savedPlayerTags : ['DEFAULT0'],
                uiSettings: sanitizeUISettings(state.uiSettings),
                allPlayersData: state.allPlayersData,
                timestamp: new Date().toISOString(),
            };

            const serializedState = JSON.stringify(stateToSave);
            localStorage.setItem(APP_STATE_KEY, serializedState);
            hideSavingIndicator();
        } catch (error) {
            console.error("Could not save state to localStorage", error);
            showSaveErrorIndicator();
        }
    };

    if (immediate) {
        performSave();
    } else {
        showSavingIndicator();
        saveTimeout = setTimeout(performSave, 1000);
    }
}


export function loadState() {
    const serializedState = localStorage.getItem(APP_STATE_KEY);
    if (serializedState === null) {
        return null;
    }
    try {
        let parsedState = JSON.parse(serializedState);
        if (!parsedState.savedPlayerTags || parsedState.savedPlayerTags.length === 0) {
            parsedState.savedPlayerTags = ['DEFAULT0'];
        }
        return parsedState;
    } catch (error) {
        console.error("Could not load state from localStorage:", error);
        throw new Error("State corruption: Invalid JSON in localStorage. " + error.message);
    }
}

export function resetState() {
    try {
        localStorage.removeItem(APP_STATE_KEY);
    } catch (error) {
        console.error("Could not reset state in localStorage", error);
    }
}

export function removePlayerTag(playerTagToDelete) {
    if (playerTagToDelete === 'DEFAULT0') {
        console.warn('Attempted to delete DEFAULT0. This tag cannot be removed.');
        return;
    }
    try {
        if (state.allPlayersData) {
            const wasActive = state.savedPlayerTags[0] === playerTagToDelete;
            
            delete state.allPlayersData[playerTagToDelete];
            state.savedPlayerTags = state.savedPlayerTags.filter(tag => tag !== playerTagToDelete);
            
            if (wasActive) {
                const nextTag = state.savedPlayerTags[0];
                const nextData = nextTag ? state.allPlayersData[nextTag] : null;
                
                // Switch global state objects to the next player's data to prevent "dumping"
                // the deleted player's data into the next player's slot during saveState.
                const fallback = nextData || initializeDefaultPlayerState();
                state.heroes = fallback.heroes || {};
                state.storedOres = fallback.storedOres || {};
                state.income = fallback.income || {};
                state.planner = fallback.planner || {};
                state.playerProfile = fallback.playerProfile || null;
            }

            saveState(state, true);
        }
    } catch (error) {
        console.error(`Could not delete data for player ${playerTagToDelete} from localStorage`, error);
    }
}

export function isPlayerTagCached(playerTag) {
    return state.allPlayersData && state.allPlayersData[playerTag] !== undefined;
}
export function loadPlayerData(playerTag) {
    if (state.allPlayersData && state.allPlayersData[playerTag]) {
        const playerState = state.allPlayersData[playerTag];
        
        // Handle migration/fallback for nested currency
        let currencyCode = 'USD';
        let globalPricing = {};

        if (playerState.currency && typeof playerState.currency === 'object') {
            currencyCode = playerState.currency.code || 'USD';
            globalPricing = playerState.currency.globalPricing || {};
        } else {
            // Fallback to old flat structure or global settings
            currencyCode = playerState.currency !== undefined ? playerState.currency : (state.uiSettings?.currency?.code || 'USD');
        }

        return {
            heroes: playerState.heroes,
            storedOres: playerState.storedOres,
            income: playerState.income,
            planner: playerState.planner,
            playerProfile: playerState.playerProfile || playerState.playerData,
            currency: {
                code: currencyCode,
                globalPricing: globalPricing
            }
        };
    }
    return null;
}

export function updateSavedPlayerTags(playerTag) {
    try {
        if (playerTag !== 'DEFAULT0' && state.savedPlayerTags.includes('DEFAULT0')) {
            state.savedPlayerTags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
            if (state.allPlayersData['DEFAULT0']) {
                delete state.allPlayersData['DEFAULT0'];
            }
        }

        const existingIndex = state.savedPlayerTags.indexOf(playerTag);
        if (existingIndex !== -1) {
            state.savedPlayerTags.splice(existingIndex, 1);
        }
        state.savedPlayerTags.unshift(playerTag);
        if (state.savedPlayerTags.length > 12) {
            state.savedPlayerTags.pop();
        }
        saveState(state);
    } catch (error) {
        console.error(`Could not update saved player tags for ${playerTag} in localStorage`, error);
    }
}

export function updateAllPlayersData(playerTag, playerState) {
    try {
        state.allPlayersData[playerTag] = playerState;

        const newAllPlayersData = {};
        let count = 0;
        for (const tag of state.savedPlayerTags) {
            if (state.allPlayersData[tag] && count < 6) {
                newAllPlayersData[tag] = state.allPlayersData[tag];
                count++;
            }
        }
        state.allPlayersData = newAllPlayersData;
        saveState(state);
    } catch (error) {
        console.error(`Could not update all players data for ${playerTag} in localStorage`, error);
    }
}
