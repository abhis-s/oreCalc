import { state } from './state.js';

const APP_STATE_KEY = 'oreCalculatorState';

export function saveState(state) {
    try {
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
        };

        const serializedState = JSON.stringify(stateToSave);
        localStorage.setItem(APP_STATE_KEY, serializedState);
    } catch (error) {
        console.error("Could not save state to localStorage", error);
    }
}

export function loadState() {
    try {
        const serializedState = localStorage.getItem(APP_STATE_KEY);
        if (serializedState === null) {
            return null;
        }
        return JSON.parse(serializedState);
    } catch (error) {
        console.error("Could not load state from localStorage. Resetting.", error);
        return null;
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
    try {
        if (state.allPlayersData) {
            delete state.allPlayersData[playerTagToDelete];
            state.savedPlayerTags = state.savedPlayerTags.filter(tag => tag !== playerTagToDelete);
            saveState(state);
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
        const playerData = state.allPlayersData[playerTag];
        const currency = playerData.currency !== undefined ? playerData.currency : (state.uiSettings?.currency !== undefined ? state.uiSettings.currency : 'USD');
        const regionalPricingEnabled = playerData.regionalPricingEnabled !== undefined ? playerData.regionalPricingEnabled : (state.uiSettings?.regionalPricingEnabled !== undefined ? state.uiSettings.regionalPricingEnabled : false);

        return {
            heroes: playerData.heroes,
            storedOres: playerData.storedOres,
            income: playerData.income,
            playerData: playerData.playerData,
            regionalPricingEnabled: regionalPricingEnabled,
            currency: currency,
        };
    }
    return null;
}

export function updateSavedPlayerTags(playerTag) {
    try {
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