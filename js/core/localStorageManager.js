import { MAX_SAVED_PLAYERS } from './constants.js';
import { EFFECTIVE_DATE_WELCOME, getDefaultPlayerState as initializeDefaultPlayerState, state } from './state.js';
import { migrateFullState, cleanupOrphanedPlayerPartitions } from './stateCleanup.js';

import { safeJsonParse } from '../utils/jsonUtils.js';

import { hideSavingIndicator, showSaveErrorIndicator, showSavingIndicator } from '../ui/savingIndicator.js';

export const APP_SETTINGS_KEY = 'oreCalc_appSettings';
export const CANONICAL_APP_SETTINGS_KEY = 'clashCalc_appSettings';
export const PLAYER_TAGS_KEY = 'oreCalc_playerTags';
export const CANONICAL_PLAYER_TAGS_KEY = 'clashCalc_playerTags';
export const PLAYER_PREFIX = 'oreCalc_player_';
export const CANONICAL_PLAYER_PREFIX = 'clashCalc_player_';

/**
 * Checks whether the current window host represents ClashCalc.
 * Defaults to false in Node.js test environments.
 * @returns {boolean} Whether host is clashcalc.
 */
export function isClashCalcHost() {
    if (typeof window === 'undefined' || !window.location?.hostname) {
        return false;
    }
    return window.location.hostname.includes('clashcalc');
}

/**
 * Returns active player storage prefix based on current host.
 * @returns {string} Active player prefix.
 */
export function getActivePlayerPrefix() {
    return isClashCalcHost() ? CANONICAL_PLAYER_PREFIX : PLAYER_PREFIX;
}

/**
 * Returns active player tags storage key based on current host.
 * @returns {string} Active player tags key.
 */
export function getActivePlayerTagsKey() {
    return isClashCalcHost() ? CANONICAL_PLAYER_TAGS_KEY : PLAYER_TAGS_KEY;
}

/**
 * Returns active app settings storage key based on current host.
 * @returns {string} Active app settings key.
 */
export function getActiveAppSettingsKey() {
    return isClashCalcHost() ? CANONICAL_APP_SETTINGS_KEY : APP_SETTINGS_KEY;
}

/**
 * Resolves a storage item prioritizing canonical key with fallback to legacy key.
 * @param {string} canonicalKey - Primary key to inspect.
 * @param {string} [legacyKey] - Fallback key if canonical is null.
 * @returns {string|null} Stored value or null.
 */
export function getStorageItem(canonicalKey, legacyKey) {
    if (typeof localStorage === 'undefined') return null;
    try {
        const canonicalVal = localStorage.getItem(canonicalKey);
        if (canonicalVal !== null) return canonicalVal;
        if (legacyKey && legacyKey !== canonicalKey) {
            return localStorage.getItem(legacyKey);
        }
    } catch (_) {}
    return null;
}

/**
 * Normalizes a player tag for storage and state (strips ALL hashes, trims, uppercases).
 * 'DEFAULT0' is preserved as 'DEFAULT0'.
 * @param {any} tag
 * @returns {string} Clean tag (e.g. '8PJYGUJC' or 'DEFAULT0')
 */
export function normalizePlayerTag(tag) {
    if (!tag) return '';
    const str = String(tag).trim();
    if (str === 'DEFAULT0') return 'DEFAULT0';
    return str.replace(/#/g, '').trim().toUpperCase();
}

/**
 * Returns a display-formatted player tag with strictly ONE leading hash (e.g. '#8PJYGUJC').
 * Returns empty string for empty tags or 'DEFAULT0'.
 * @param {any} tag
 * @returns {string} Display tag (e.g. '#8PJYGUJC')
 */
export function formatDisplayTag(tag) {
    const clean = normalizePlayerTag(tag);
    if (!clean || clean === 'DEFAULT0') return '';
    return `#${clean}`;
}

/**
 * Returns the localStorage key for a player partition.
 * Guaranteed to have zero leading hashes in the key suffix.
 * @param {any} tag - Player tag identifier.
 * @param {string} [prefix=null] - Optional prefix override.
 * @returns {string} Partition key (e.g. 'oreCalc_player_8PJYGUJC' or 'clashCalc_player_8PJYGUJC')
 */
export function getPlayerStorageKey(tag, prefix = null) {
    const clean = normalizePlayerTag(tag) || 'DEFAULT0';
    const activePrefix = prefix || getActivePlayerPrefix();
    return `${activePrefix}${clean}`;
}

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
    if (isResettingState || !state || !Array.isArray(state.savedPlayerTags) || !state.allPlayersData || state.uiSettings?.saveError) {
        return;
    }
    clearTimeout(saveTimeout);

    const performSave = () => {
        try {
            if (typeof localStorage === 'undefined' || !Array.isArray(state.savedPlayerTags) || !state.allPlayersData) {
                return;
            }
            const currentPlayerTag = state.savedPlayerTags[0];
            if (currentPlayerTag) {
                const cleanPlayerTag = normalizePlayerTag(currentPlayerTag) || 'DEFAULT0';
                /** @type {Record<string, any>} */
                const existingData = state.allPlayersData[cleanPlayerTag] || state.allPlayersData[currentPlayerTag] || {};
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
                        acceleratedRewards: Boolean(state.heroJourney.acceleratedRewards ?? state.heroJourney.accelerated ?? (state.heroJourney.rewardMode === 'accelerated')),
                        revealBeyondTH: Boolean(state.heroJourney.revealBeyondTH),
                        hidden: Boolean(state.heroJourney.hidden)
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

                state.allPlayersData[cleanPlayerTag] = playerData;
                if (cleanPlayerTag !== currentPlayerTag && state.allPlayersData[currentPlayerTag]) {
                    delete state.allPlayersData[currentPlayerTag];
                }

                const targetPrefix = getActivePlayerPrefix();
                localStorage.setItem(getPlayerStorageKey(cleanPlayerTag, targetPrefix), JSON.stringify(playerData));
                if (cleanPlayerTag !== 'DEFAULT0') {
                    localStorage.removeItem(`${PLAYER_PREFIX}#${cleanPlayerTag}`);
                    localStorage.removeItem(`${CANONICAL_PLAYER_PREFIX}#${cleanPlayerTag}`);
                }
            }

            const appSettingsToSave = {
                ...(state.uiSettings || {}),
                appVersion: state.appVersion || '2.0.0',
                timestamp: state.timestamp || new Date().toISOString()
            };
            localStorage.setItem(getActiveAppSettingsKey(), JSON.stringify(appSettingsToSave));

            const tagsToSave = (Array.isArray(state.savedPlayerTags) && state.savedPlayerTags.length > 0)
                ? state.savedPlayerTags.map(t => normalizePlayerTag(t)).filter(Boolean)
                : ['DEFAULT0'];
            localStorage.setItem(getActivePlayerTagsKey(), JSON.stringify(tagsToSave.length > 0 ? tagsToSave : ['DEFAULT0']));

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
    const legacyUserId = getStorageItem('clashCalc_userId', 'oreCalc_userId') || localStorage.getItem('oreCalcUserId');
    if (legacyUserId) {
        const activeUserIdKey = isClashCalcHost() ? 'clashCalc_userId' : 'oreCalc_userId';
        localStorage.setItem(activeUserIdKey, legacyUserId);
        if (localStorage.getItem('oreCalcUserId')) {
            localStorage.removeItem('oreCalcUserId');
        }
    }

    const legacySwTime = getStorageItem('clashCalc_SWUpdatedTime', 'oreCalc_SWUpdatedTime') || localStorage.getItem('oreCalcSWUpdatedTime');
    if (legacySwTime) {
        const activeSwKey = isClashCalcHost() ? 'clashCalc_SWUpdatedTime' : 'oreCalc_SWUpdatedTime';
        localStorage.setItem(activeSwKey, legacySwTime);
        if (localStorage.getItem('oreCalcSWUpdatedTime')) {
            localStorage.removeItem('oreCalcSWUpdatedTime');
        }
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

    const tagsStr = getStorageItem(CANONICAL_PLAYER_TAGS_KEY, PLAYER_TAGS_KEY);
    if (tagsStr === null) {
        return null;
    }

    try {
        let savedPlayerTags = safeJsonParse(tagsStr, ['DEFAULT0']);
        if (!Array.isArray(savedPlayerTags) || savedPlayerTags.length === 0) {
            savedPlayerTags = ['DEFAULT0'];
        }
        savedPlayerTags = savedPlayerTags.map(t => normalizePlayerTag(t)).filter(Boolean);
        if (savedPlayerTags.length === 0) savedPlayerTags = ['DEFAULT0'];

        const realTags = savedPlayerTags.filter(tag => tag && tag !== 'DEFAULT0');
        if (realTags.length > 0) {
            savedPlayerTags = realTags;
            try {
                localStorage.removeItem(`${PLAYER_PREFIX}DEFAULT0`);
                localStorage.removeItem(`${CANONICAL_PLAYER_PREFIX}DEFAULT0`);
            } catch (e) {}
        } else {
            savedPlayerTags = ['DEFAULT0'];
        }

        const appSettingsStr = getStorageItem(CANONICAL_APP_SETTINGS_KEY, APP_SETTINGS_KEY);
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
            const cleanKey = normalizePlayerTag(tag);
            const canonicalKey = getPlayerStorageKey(cleanKey, CANONICAL_PLAYER_PREFIX);
            const legacyKey = getPlayerStorageKey(cleanKey, PLAYER_PREFIX);
            let playerStr = localStorage.getItem(canonicalKey) || localStorage.getItem(legacyKey);
            if (!playerStr && cleanKey !== 'DEFAULT0') {
                const legacyKey1 = `${CANONICAL_PLAYER_PREFIX}#${cleanKey}`;
                const legacyKey2 = `${PLAYER_PREFIX}#${cleanKey}`;
                playerStr = localStorage.getItem(legacyKey1) || localStorage.getItem(legacyKey2);
                if (playerStr) {
                    try {
                        const targetKey = getPlayerStorageKey(cleanKey);
                        localStorage.setItem(targetKey, playerStr);
                        localStorage.removeItem(legacyKey1);
                        localStorage.removeItem(legacyKey2);
                    } catch (e) {}
                }
            }

            if (playerStr) {
                const parsedPlayer = safeJsonParse(playerStr, null);
                let playerObj = parsedPlayer || initializeDefaultPlayerState();
                if (!playerObj.heroes && cleanKey !== 'DEFAULT0') {
                    playerObj = initializeDefaultPlayerState();
                }
                if (playerObj.planner?.calendar) {
                    delete playerObj.planner.calendar.isHydrated;
                }
                if (playerObj.heroJourney && typeof playerObj.heroJourney === 'object') {
                    playerObj.heroJourney = {
                        acceleratedRewards: Boolean(playerObj.heroJourney.acceleratedRewards ?? playerObj.heroJourney.accelerated ?? (playerObj.heroJourney.rewardMode === 'accelerated')),
                        revealBeyondTH: Boolean(playerObj.heroJourney.revealBeyondTH),
                        hidden: Boolean(playerObj.heroJourney.hidden)
                    };
                }

                if (isAppGloballyOnboarded && typeof playerObj.onboardingTimestamp !== 'number') {
                    playerObj.onboardingTimestamp = globalWelcomeTimestamp;
                }

                try {
                    localStorage.setItem(canonicalKey, JSON.stringify(playerObj));
                } catch (e) {}

                allPlayersData[cleanKey] = playerObj;
            } else {
                allPlayersData[cleanKey] = initializeDefaultPlayerState();
            }
        }

        cleanupOrphanedPlayerPartitions(state);

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
    const cleanTag = normalizePlayerTag(playerTagToDelete);
    if (cleanTag === 'DEFAULT0') {
        console.warn('Attempted to delete DEFAULT0. This tag cannot be removed.');
        return;
    }
    try {
        if (state.allPlayersData) {
            const wasActive = normalizePlayerTag(state.savedPlayerTags[0]) === cleanTag;

            delete state.allPlayersData[cleanTag];
            delete state.allPlayersData[playerTagToDelete];
            state.savedPlayerTags = state.savedPlayerTags
                .map(t => normalizePlayerTag(t))
                .filter(tag => tag !== cleanTag);

            localStorage.removeItem(getPlayerStorageKey(cleanTag, CANONICAL_PLAYER_PREFIX));
            localStorage.removeItem(getPlayerStorageKey(cleanTag, PLAYER_PREFIX));
            localStorage.removeItem(`${CANONICAL_PLAYER_PREFIX}#${cleanTag}`);
            localStorage.removeItem(`${PLAYER_PREFIX}#${cleanTag}`);

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
                state.heroJourney = defaultGuestState.heroJourney || { acceleratedRewards: false };
                if (state.uiSettings && defaultGuestState.currency?.code) {
                    state.uiSettings.currency = { code: defaultGuestState.currency.code };
                }
                localStorage.setItem(getPlayerStorageKey('DEFAULT0'), JSON.stringify(defaultGuestState));
            } else if (wasActive) {
                const nextTag = state.savedPlayerTags[0];
                const nextData = nextTag ? (state.allPlayersData[nextTag] || state.allPlayersData[normalizePlayerTag(nextTag)]) : null;

                const fallback = nextData || initializeDefaultPlayerState();
                state.heroes = fallback.heroes || {};
                state.storedOres = fallback.storedOres || {};
                state.income = fallback.income || {};
                state.planner = fallback.planner || {};
                state.heroJourney = fallback.heroJourney || { acceleratedRewards: false };
                state.playerProfile = fallback.playerProfile || null;
                state.onboardingTimestamp = fallback.onboardingTimestamp ?? null;
                if (state.uiSettings && fallback.currency?.code) {
                    state.uiSettings.currency = { code: fallback.currency.code };
                }
            }

            saveState(state, true);
        }
    } catch (error) {
        console.error(`Could not delete data for player ${playerTagToDelete} from localStorage`, error);
    }
}

/**
 * Retrieves partitioned player state from memory or disk.
 * @param {string} playerTag - Normalized player tag identifier.
 * @returns {Partial<import('./types.js').PlayerData> | null} Player state or null.
 */
export function loadPlayerData(playerTag) {
    if (!playerTag) return null;
    const cleanTag = normalizePlayerTag(playerTag);
    let playerState = (state.allPlayersData && (state.allPlayersData[cleanTag] || state.allPlayersData[playerTag])) || null;

    if (!playerState) {
        const canonicalKey = getPlayerStorageKey(cleanTag, CANONICAL_PLAYER_PREFIX);
        const legacyKey = getPlayerStorageKey(cleanTag, PLAYER_PREFIX);
        let playerStr = localStorage.getItem(canonicalKey) || localStorage.getItem(legacyKey);
        if (!playerStr && cleanTag !== 'DEFAULT0') {
            const legacyKey1 = `${CANONICAL_PLAYER_PREFIX}#${cleanTag}`;
            const legacyKey2 = `${PLAYER_PREFIX}#${cleanTag}`;
            playerStr = localStorage.getItem(legacyKey1) || localStorage.getItem(legacyKey2);
            if (playerStr) {
                try {
                    const targetKey = getPlayerStorageKey(cleanTag);
                    localStorage.setItem(targetKey, playerStr);
                    localStorage.removeItem(legacyKey1);
                    localStorage.removeItem(legacyKey2);
                } catch (e) {}
            }
        }
        playerState = safeJsonParse(playerStr, null);
    }

    if (playerState) {
        const isGuest = cleanTag === 'DEFAULT0';
        const defaultState = initializeDefaultPlayerState();
        // Handle migration/fallback for nested currency
        let currencyCode = 'USD';
        /** @type {Record<string, any>} */
        let globalPricing = {};

        if (playerState.currency && typeof playerState.currency === 'object') {
            currencyCode = playerState.currency.code || 'USD';
            globalPricing = playerState.currency.globalPricing || {};
        } else {
            currencyCode = playerState.currency !== undefined ? playerState.currency : (state.uiSettings?.currency?.code || 'USD');
        }

        return {
            heroes: playerState.heroes || (isGuest ? defaultState.heroes : undefined),
            storedOres: playerState.storedOres || (isGuest ? defaultState.storedOres : undefined),
            income: playerState.income || (isGuest ? defaultState.income : undefined),
            planner: playerState.planner || (isGuest ? defaultState.planner : undefined),
            heroJourney: playerState.heroJourney || (isGuest ? defaultState.heroJourney : undefined),
            playerProfile: playerState.playerProfile || null,
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
    const cleanTag = normalizePlayerTag(playerTag);
    try {
        const recentsStr = getStorageItem('clashCalc_recentSearches', 'oreCalc_recentSearches');
        if (recentsStr) {
            const list = safeJsonParse(recentsStr, []);
            if (Array.isArray(list)) {
                const filtered = list.filter(item => item && item.cleanTag !== cleanTag);
                const targetRecentsKey = isClashCalcHost() ? 'clashCalc_recentSearches' : 'oreCalc_recentSearches';
                localStorage.setItem(targetRecentsKey, JSON.stringify(filtered));
            }
        }
    } catch {}
    try {
        if (cleanTag !== 'DEFAULT0') {
            state.savedPlayerTags = state.savedPlayerTags
                .map(t => normalizePlayerTag(t))
                .filter(tag => tag !== 'DEFAULT0');
            if (state.allPlayersData['DEFAULT0']) {
                delete state.allPlayersData['DEFAULT0'];
            }
            try {
                localStorage.removeItem(getPlayerStorageKey('DEFAULT0', CANONICAL_PLAYER_PREFIX));
                localStorage.removeItem(getPlayerStorageKey('DEFAULT0', PLAYER_PREFIX));
            } catch (e) {}
        }

        state.savedPlayerTags = state.savedPlayerTags
            .map(t => normalizePlayerTag(t))
            .filter(tag => tag !== cleanTag);
        state.savedPlayerTags.unshift(cleanTag);
        if (state.savedPlayerTags.length > MAX_SAVED_PLAYERS) {
            const poppedTag = state.savedPlayerTags.pop();
            if (poppedTag) {
                const cleanPopped = normalizePlayerTag(poppedTag);
                delete state.allPlayersData[cleanPopped];
                delete state.allPlayersData[poppedTag];
                localStorage.removeItem(getPlayerStorageKey(cleanPopped, CANONICAL_PLAYER_PREFIX));
                localStorage.removeItem(getPlayerStorageKey(cleanPopped, PLAYER_PREFIX));
                localStorage.removeItem(`${CANONICAL_PLAYER_PREFIX}#${cleanPopped}`);
                localStorage.removeItem(`${PLAYER_PREFIX}#${cleanPopped}`);
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
    const cleanTag = normalizePlayerTag(playerTag);
    try {
        state.allPlayersData[cleanTag] = playerState;
        const targetPrefix = getActivePlayerPrefix();
        localStorage.setItem(getPlayerStorageKey(cleanTag, targetPrefix), JSON.stringify(playerState));
        localStorage.removeItem(`${PLAYER_PREFIX}#${cleanTag}`);
        localStorage.removeItem(`${CANONICAL_PLAYER_PREFIX}#${cleanTag}`);

        const newAllPlayersData = {};
        const tagsToRemove = [];
        let count = 0;

        for (const tag of state.savedPlayerTags) {
            const clean = normalizePlayerTag(tag);
            if (state.allPlayersData[clean] && count < MAX_SAVED_PLAYERS) {
                newAllPlayersData[clean] = state.allPlayersData[clean];
                count++;
            } else {
                tagsToRemove.push(clean);
            }
        }

        state.allPlayersData = newAllPlayersData;
        for (const tag of tagsToRemove) {
            const clean = normalizePlayerTag(tag);
            localStorage.removeItem(getPlayerStorageKey(clean, CANONICAL_PLAYER_PREFIX));
            localStorage.removeItem(getPlayerStorageKey(clean, PLAYER_PREFIX));
            localStorage.removeItem(`${CANONICAL_PLAYER_PREFIX}#${clean}`);
            localStorage.removeItem(`${PLAYER_PREFIX}#${clean}`);
        }

        saveState(state);
    } catch (error) {
        console.error(`Could not update all players data for ${playerTag} in localStorage`, error);
    }
}

/**
 * Returns clean list of saved player tags from state or localStorage.
 * @returns {string[]} Clean saved player tags.
 */
export function getSavedPlayerTagsList() {
    if (state && Array.isArray(state.savedPlayerTags) && state.savedPlayerTags.length > 0) {
        return state.savedPlayerTags.map(t => normalizePlayerTag(t)).filter(t => t && t !== 'DEFAULT0');
    }
    try {
        const str = getStorageItem(CANONICAL_PLAYER_TAGS_KEY, PLAYER_TAGS_KEY);
        const list = safeJsonParse(str, []);
        if (Array.isArray(list)) {
            return list.map(t => normalizePlayerTag(t)).filter(t => t && t !== 'DEFAULT0');
        }
    } catch {}
    return [];
}
