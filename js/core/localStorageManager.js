import { MAX_SAVED_PLAYERS } from './constants.js';
import { EFFECTIVE_DATE_WELCOME, getDefaultPlayerState as initializeDefaultPlayerState, state } from './state.js';
import { migrateFullState } from './stateCleanup.js';

import { safeJsonParse } from '../utils/jsonUtils.js';

import { hideSavingIndicator, showSaveErrorIndicator, showSavingIndicator } from '../ui/savingIndicator.js';

const APP_SETTINGS_KEY = 'oreCalc_appSettings';
const PLAYER_TAGS_KEY = 'oreCalc_playerTags';
const PLAYER_PREFIX = 'oreCalc_player_';

let saveTimeout;
let isResettingState = false;

/**
 * Sets state resetting lock flag.
 * @param {boolean} val - Lock state.
 */
export function setResettingState(val) {
    isResettingState = val;
}

/**
 * Returns current resetting state lock flag.
 * @returns {boolean} Whether state is actively resetting.
 */
export function getResettingState() {
    return isResettingState;
}

/**
 * Persists the application state to localStorage using partitioned player keys,
 * with debouncing for non-immediate calls and saving status indicators.
 * @param {import('./types.js').AppState} state - Current global application state.
 * @param {boolean} [immediate=false] - Whether to bypass 1000ms debounce timer.
 */
export function saveState(state, immediate = false) {
    if (isResettingState || state.uiSettings?.saveError) {
        return;
    }
    clearTimeout(saveTimeout);

    const performSave = () => {
        try {
            const currentPlayerTag = state.savedPlayerTags[0];
            if (currentPlayerTag) {
                /** @type {Record<string, any>} */
                const existingData = state.allPlayersData[currentPlayerTag] || {};
                // Clone planner sub-structure to avoid mutating running in-memory state during save
                let serializedPlanner = state.planner;
                if (state.planner) {
                    let calendarCopy = undefined;
                    if (state.planner.calendar) {
                        calendarCopy = {
                            ...state.planner.calendar,
                            dates: state.planner.calendar.dates
                        };
                        delete calendarCopy.isHydrated;
                    }
                    serializedPlanner = {
                        ...state.planner,
                        calendar: calendarCopy
                    };
                }

                let serializedHeroJourney = undefined;
                if (state.heroJourney) {
                    serializedHeroJourney = {
                        overrideUnclaimed: state.heroJourney.overrideUnclaimed || [],
                        acceleratedRewards: Boolean(state.heroJourney.acceleratedRewards ?? state.heroJourney.accelerated ?? (state.heroJourney.rewardMode === 'accelerated')),
                        hidden: Boolean(state.heroJourney.hidden),
                        revealBeyondTH: Boolean(state.heroJourney.revealBeyondTH)
                    };
                }

                const playerData = {
                    ...existingData,
                    heroes: state.heroes,
                    storedOres: state.storedOres,
                    income: state.income,
                    planner: serializedPlanner,
                    playerProfile: state.playerProfile,
                    heroJourney: serializedHeroJourney,
                    onboardingTimestamp: existingData.onboardingTimestamp !== undefined
                        ? existingData.onboardingTimestamp
                        : (state.onboardingTimestamp ?? null),
                    currency: {
                        code: state.uiSettings?.currency?.code || 'USD',
                        globalPricing: existingData?.currency?.globalPricing || {}
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

                state.allPlayersData[currentPlayerTag] = playerData;

                localStorage.setItem(`${PLAYER_PREFIX}${currentPlayerTag}`, JSON.stringify(playerData));
            }

            const appSettingsToSave = {
                ...(state.uiSettings || {}),
                appVersion: state.appVersion || '2.0.0',
                timestamp: state.timestamp || new Date().toISOString()
            };
            localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(appSettingsToSave));

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

/**
 * Loads and reconstructs application state from partitioned localStorage keys,
 * automatically running schema migrations for legacy monolithic state format.
 *
 * @returns {import('./types.js').AppState | null} Loaded state or null if no saved state found.
 */
export function loadState() {
    // Migrate legacy user ID if it exists
    const legacyUserId = localStorage.getItem('oreCalcUserId');
    if (legacyUserId) {
        localStorage.setItem('oreCalc_userId', legacyUserId);
        localStorage.removeItem('oreCalcUserId');
    }

    const legacySwTime = localStorage.getItem('oreCalcSWUpdatedTime');
    if (legacySwTime) {
        localStorage.setItem('oreCalc_SWUpdatedTime', legacySwTime);
        localStorage.removeItem('oreCalcSWUpdatedTime');
    }

    // Detect if legacy monolithic state exists on disk and migrate before partition loading.
    const legacyStateStr = localStorage.getItem('oreCalculatorState') || localStorage.getItem('OreCalculatorState');
    if (legacyStateStr !== null) {
        const legacyState = safeJsonParse(legacyStateStr, null);
        if (legacyState && typeof legacyState === 'object' && (legacyState.allPlayersData || legacyState.savedPlayerTags || legacyState.uiSettings)) {
            try {
                migrateFullState(legacyState);
            } catch (e) {
                console.error("Error migrating legacy state during loadState:", e);
            }
        }
    }

    const tagsStr = localStorage.getItem(PLAYER_TAGS_KEY);
    if (tagsStr === null) {
        return null;
    }

    try {
        let savedPlayerTags = safeJsonParse(tagsStr, ['DEFAULT0']);
        if (!Array.isArray(savedPlayerTags) || savedPlayerTags.length === 0) {
            savedPlayerTags = ['DEFAULT0'];
        }

        const realTags = savedPlayerTags.filter(tag => tag && tag !== 'DEFAULT0');
        if (realTags.length > 0) {
            savedPlayerTags = realTags;
            try {
                localStorage.removeItem(`${PLAYER_PREFIX}DEFAULT0`);
            } catch (e) {}
        } else {
            savedPlayerTags = ['DEFAULT0'];
        }

        const appSettingsStr = localStorage.getItem(APP_SETTINGS_KEY);
        /** @type {Record<string, any>} */
        const appSettings = (appSettingsStr ? safeJsonParse(appSettingsStr, {}) : {}) || {};
        const savedAppVersion = appSettings.appVersion || '2.0.0';
        const savedTimestamp = appSettings.timestamp;
        const uiSettings = { ...appSettings };
        delete uiSettings.appVersion;
        delete uiSettings.timestamp;

        const allPlayersData = {};
        const globalWelcomeTimestamp = uiSettings?.uiTimestamps?.welcome;
        const isAppGloballyOnboarded = typeof globalWelcomeTimestamp === 'number' && globalWelcomeTimestamp >= EFFECTIVE_DATE_WELCOME;

        for (const tag of savedPlayerTags) {
            const playerStr = localStorage.getItem(`${PLAYER_PREFIX}${tag}`);
            if (playerStr) {
                const parsedPlayer = safeJsonParse(playerStr, null);
                const playerObj = parsedPlayer || initializeDefaultPlayerState();
                if (playerObj.planner?.calendar) {
                    delete playerObj.planner.calendar.isHydrated;
                }
                if (playerObj.heroJourney) {
                    delete playerObj.heroJourney.scrollPosition;
                    delete playerObj.heroJourney.typeFilter;
                    delete playerObj.heroJourney.unclaimedOnly;
                    delete playerObj.heroJourney.filterScrollPositions;
                }

                if (isAppGloballyOnboarded && typeof playerObj.onboardingTimestamp !== 'number') {
                    playerObj.onboardingTimestamp = globalWelcomeTimestamp;
                    try {
                        localStorage.setItem(`${PLAYER_PREFIX}${tag}`, JSON.stringify(playerObj));
                    } catch (e) {}
                }

                allPlayersData[tag] = playerObj;
            } else {
                allPlayersData[tag] = initializeDefaultPlayerState();
            }
        }

        /** @type {any} */
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
        return null;
    }
}

/**
 * Completely purges all stored state and caches from localStorage and sessionStorage.
 */
export function resetState() {
    isResettingState = true;
    clearTimeout(saveTimeout);
    try {
        localStorage.clear();
        sessionStorage.clear();
    } catch (error) {
        console.error("Could not reset state in localStorage", error);
    }
}

/**
 * Deletes a player profile partition from memory and localStorage disk.
 *
 * @param {string} playerTagToDelete - Tag of player to remove.
 */
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

            localStorage.removeItem(`${PLAYER_PREFIX}${playerTagToDelete}`);

            if (state.savedPlayerTags.length === 0) {
                // Last remaining player deleted: re-seed DEFAULT0
                state.savedPlayerTags = ['DEFAULT0'];
                const defaultGuestState = initializeDefaultPlayerState();
                state.allPlayersData['DEFAULT0'] = defaultGuestState;
                state.heroes = defaultGuestState.heroes;
                state.storedOres = defaultGuestState.storedOres;
                state.income = defaultGuestState.income;
                state.planner = defaultGuestState.planner;
                state.playerProfile = null;
                state.heroJourney = defaultGuestState.heroJourney || { overrideUnclaimed: [], acceleratedRewards: false };
                if (state.uiSettings && defaultGuestState.currency?.code) {
                    state.uiSettings.currency = { code: defaultGuestState.currency.code };
                }
                localStorage.setItem(`${PLAYER_PREFIX}DEFAULT0`, JSON.stringify(defaultGuestState));
            } else if (wasActive) {
                const nextTag = state.savedPlayerTags[0];
                const nextData = nextTag ? state.allPlayersData[nextTag] : null;

                const fallback = nextData || initializeDefaultPlayerState();
                state.heroes = fallback.heroes || {};
                state.storedOres = fallback.storedOres || {};
                state.income = fallback.income || {};
                state.planner = fallback.planner || {};
                state.playerProfile = fallback.playerProfile || null;
                state.heroJourney = fallback.heroJourney || { overrideUnclaimed: [], acceleratedRewards: false };
                if (nextData?.currency && typeof nextData.currency === 'object' && state.uiSettings) {
                    state.uiSettings.currency = { code: nextData.currency.code || 'USD' };
                }
            }

            saveState(state, true);
        }
    } catch (error) {
        console.error(`Could not delete data for player ${playerTagToDelete} from localStorage`, error);
    }
}

/**
 * Retrieves partitioned player state from memory.
 * @param {string} playerTag - Normalized player tag identifier.
 * @returns {Partial<import('./types.js').PlayerData> | null} Player state or null.
 */
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
            onboardingTimestamp: typeof playerState.onboardingTimestamp === 'number' ? playerState.onboardingTimestamp : null,
            currency: {
                code: currencyCode,
                globalPricing: globalPricing
            }
        };
    }
    return null;
}

/**
 * Updates player tag ordering in memory and localStorage.
 * @param {string} playerTag - Normalized player tag to prioritize.
 */
export function updateSavedPlayerTags(playerTag) {
    try {
        if (playerTag !== 'DEFAULT0') {
            state.savedPlayerTags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
            if (state.allPlayersData['DEFAULT0']) {
                delete state.allPlayersData['DEFAULT0'];
            }
            try {
                localStorage.removeItem(`${PLAYER_PREFIX}DEFAULT0`);
            } catch (e) {}
        }

        const existingIndex = state.savedPlayerTags.indexOf(playerTag);
        if (existingIndex !== -1) {
            state.savedPlayerTags.splice(existingIndex, 1);
        }
        state.savedPlayerTags.unshift(playerTag);
        if (state.savedPlayerTags.length > MAX_SAVED_PLAYERS) {
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

/**
 * Updates or sets a player profile partition into memory and localStorage.
 * @param {string} playerTag - Normalized player tag identifier.
 * @param {any} playerState - Player data payload.
 */
export function updateAllPlayersData(playerTag, playerState) {
    try {
        state.allPlayersData[playerTag] = playerState;
        localStorage.setItem(`${PLAYER_PREFIX}${playerTag}`, JSON.stringify(playerState));

        const newAllPlayersData = {};
        const tagsToRemove = [];
        let count = 0;

        for (const tag of state.savedPlayerTags) {
            if (state.allPlayersData[tag] && count < MAX_SAVED_PLAYERS) {
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
