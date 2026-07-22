import { sanitizeUISettings, sanitizePlayerState, migrateFullState } from './stateCleanup.js';
import { state, getDefaultPlayerState as initializeDefaultPlayerState } from './state.js';

import { showSavingIndicator, hideSavingIndicator, showSaveErrorIndicator } from '../ui/savingIndicator.js';

const APP_SETTINGS_KEY = 'oreCalc_appSettings';
const APP_PLAYERS_INDEX_KEY = 'oreCalc_players';
const PLAYER_TAGS_KEY = 'oreCalc_playerTags';
const PLAYER_PREFIX = 'oreCalc_player_';
const LEGACY_APP_STATE_KEY = 'oreCalculatorState';

let saveTimeout;
let isResettingState = false;

export function setResettingState(val) {
    isResettingState = val;
}

export function getResettingState() {
    return isResettingState;
}

export function saveState(state, immediate = false) {
    if (isResettingState || state.uiSettings?.saveError) {
        return;
    }
    clearTimeout(saveTimeout);

    const performSave = () => {
        try {
            // 1. Sync active player data back to allPlayersData
            const currentPlayerTag = state.savedPlayerTags[0];
            if (currentPlayerTag) {
                const existingData = state.allPlayersData[currentPlayerTag] || {};
                // Clone planner sub-structure to avoid mutating running in-memory state during save
                let serializedPlanner = state.planner;
                if (state.planner) {
                    serializedPlanner = {
                        ...state.planner,
                        calendar: state.planner.calendar ? {
                            ...state.planner.calendar,
                            dates: state.planner.calendar.dates
                        } : undefined
                    };
                }

                const playerData = {
                    ...existingData,
                    heroes: state.heroes,
                    storedOres: state.storedOres,
                    income: state.income,
                    planner: serializedPlanner,
                    playerProfile: state.playerProfile,
                    currency: {
                        code: state.uiSettings.currency?.code || 'USD',
                        globalPricing: existingData.currency?.globalPricing || {}
                    }
                };

                // Strip auto-placed events from calendar dates before saving
                if (playerData.planner?.calendar?.dates) {
                    const cleanDates = {};
                    const val = playerData.planner.calendar.dates;
                    for (const monthYearKey in val) {
                        const monthDays = val[monthYearKey];
                        const cleanDays = {};
                        for (const dayKey in monthDays) {
                            const chips = monthDays[dayKey];
                            if (Array.isArray(chips)) {
                                const cleanChips = chips.filter(id => typeof id === 'string' && !id.endsWith('-cal-auto'));
                                if (cleanChips.length > 0) {
                                    cleanDays[dayKey] = cleanChips;
                                }
                            }
                        }
                        if (Object.keys(cleanDays).length > 0) {
                            cleanDates[monthYearKey] = cleanDays;
                        }
                    }
                    playerData.planner.calendar.dates = cleanDates;
                }

                sanitizePlayerState(playerData);
                state.allPlayersData[currentPlayerTag] = playerData;

                // Write player specific data key
                localStorage.setItem(`${PLAYER_PREFIX}${currentPlayerTag}`, JSON.stringify(playerData));
            }

            // 2. Write UI/App settings
            const cleanAppSettings = sanitizeUISettings(state.uiSettings);
            const appSettingsToSave = {
                ...cleanAppSettings,
                appVersion: state.appVersion || '2.0.0',
                timestamp: state.timestamp || new Date().toISOString()
            };
            localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettingsToSave));

            // 3. Write index metadata key (directly save the array)
            const tagsToSave = state.savedPlayerTags.length > 0 ? state.savedPlayerTags : ['DEFAULT0'];
            localStorage.setItem(PLAYER_TAGS_KEY, JSON.stringify(tagsToSave));

            hideSavingIndicator();
        } catch (error) {
            console.error("Could not save partitioned state to localStorage", error);
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
    // Migrate legacy user ID if it exists
    const legacyUserId = localStorage.getItem('oreCalcUserId');
    if (legacyUserId) {
        localStorage.setItem('oreCalc_userId', legacyUserId);
        localStorage.removeItem('oreCalcUserId');
    }

    // 1. Detect if legacy monolithic state exists. If so, migrate it first!
    const legacyStateStr = localStorage.getItem('oreCalculatorState') || localStorage.getItem('OreCalculatorState');
    if (legacyStateStr !== null) {
        try {
            const legacyState = JSON.parse(legacyStateStr);
            if (legacyState && typeof legacyState === 'object' && (legacyState.allPlayersData || legacyState.savedPlayerTags || legacyState.uiSettings)) {
                migrateFullState(legacyState);
            }
        } catch (e) {
            console.error("Error migrating legacy state during loadState:", e);
        }
    }

    // 2. Load partitioned tags index
    const tagsStr = localStorage.getItem(PLAYER_TAGS_KEY);
    if (tagsStr === null) {
        return null;
    }

    try {
        const savedPlayerTags = JSON.parse(tagsStr) || ['DEFAULT0'];

        // 3. Load app settings
        const appSettingsStr = localStorage.getItem(APP_SETTINGS_KEY);
        const appSettings = appSettingsStr ? JSON.parse(appSettingsStr) : {};
        const savedAppVersion = appSettings.appVersion || '2.0.0';
        const savedTimestamp = appSettings.timestamp;
        const uiSettings = { ...appSettings };
        delete uiSettings.appVersion;
        delete uiSettings.timestamp;

        // 4. Load all players data
        const allPlayersData = {};
        for (const tag of savedPlayerTags) {
            const playerStr = localStorage.getItem(`${PLAYER_PREFIX}${tag}`);
            if (playerStr) {
                allPlayersData[tag] = JSON.parse(playerStr);
            } else {
                allPlayersData[tag] = initializeDefaultPlayerState();
            }
        }

        // 5. Reconstruct monolithic state object
        const reconstructedState = {
            appVersion: savedAppVersion,
            timestamp: savedTimestamp,
            savedPlayerTags,
            uiSettings,
            allPlayersData
        };
        return reconstructedState;
    } catch (error) {
        console.error("Could not load state from partitioned localStorage:", error);
        throw new Error("State corruption: Invalid JSON in partitioned localStorage. " + error.message);
    }
}

export function resetState() {
    isResettingState = true;
    clearTimeout(saveTimeout);
    try {
        localStorage.removeItem(LEGACY_APP_STATE_KEY);
        localStorage.removeItem('OreCalculatorState');
        localStorage.removeItem(APP_SETTINGS_KEY);
        localStorage.removeItem(APP_PLAYERS_INDEX_KEY);
        localStorage.removeItem(PLAYER_TAGS_KEY);
        localStorage.removeItem('oreCalc_userId');
        
        // Remove all player profile keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(PLAYER_PREFIX) || key.startsWith('oreCalc_'))) {
                localStorage.removeItem(key);
                i--; // Adjust index as key removal shifts array
            }
        }
        localStorage.clear();
        sessionStorage.clear();
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
            
            // Delete in-memory references
            delete state.allPlayersData[playerTagToDelete];
            state.savedPlayerTags = state.savedPlayerTags.filter(tag => tag !== playerTagToDelete);
            
            // Delete from disk
            localStorage.removeItem(`${PLAYER_PREFIX}${playerTagToDelete}`);

            if (wasActive) {
                const nextTag = state.savedPlayerTags[0];
                const nextData = nextTag ? state.allPlayersData[nextTag] : null;
                
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
            currencyCode = playerState.currency !== undefined ? playerState.currency : (state.uiSettings?.currency?.code || 'USD');
        }

        return {
            heroes: playerState.heroes,
            storedOres: playerState.storedOres,
            income: playerState.income,
            planner: playerState.planner,
            playerProfile: playerState.playerProfile,
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
                localStorage.removeItem(`${PLAYER_PREFIX}DEFAULT0`);
            }
        }

        const existingIndex = state.savedPlayerTags.indexOf(playerTag);
        if (existingIndex !== -1) {
            state.savedPlayerTags.splice(existingIndex, 1);
        }
        state.savedPlayerTags.unshift(playerTag);
        if (state.savedPlayerTags.length > 12) {
            const poppedTag = state.savedPlayerTags.pop();
            if (poppedTag) {
                delete state.allPlayersData[poppedTag];
                localStorage.removeItem(`${PLAYER_PREFIX}${poppedTag}`);
            }
        }
        saveState(state);
    } catch (error) {
        console.error(`Could not update saved player tags for ${playerTag} in localStorage`, error);
    }
}

export function updateAllPlayersData(playerTag, playerState) {
    try {
        state.allPlayersData[playerTag] = playerState;
        localStorage.setItem(`${PLAYER_PREFIX}${playerTag}`, JSON.stringify(playerState));

        const newAllPlayersData = {};
        const tagsToRemove = [];
        let count = 0;
        
        for (const tag of state.savedPlayerTags) {
            if (state.allPlayersData[tag] && count < 6) {
                newAllPlayersData[tag] = state.allPlayersData[tag];
                count++;
            } else {
                tagsToRemove.push(tag);
            }
        }
        
        state.allPlayersData = newAllPlayersData;
        
        // Remove surplus tags from disk
        for (const tag of tagsToRemove) {
            localStorage.removeItem(`${PLAYER_PREFIX}${tag}`);
        }
        
        saveState(state);
    } catch (error) {
        console.error(`Could not update all players data for ${playerTag} in localStorage`, error);
    }
}
