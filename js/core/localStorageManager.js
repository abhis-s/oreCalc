import { getDefaultPlayerState as initializeDefaultPlayerState, state } from './state.js';
import { cleanupOrphanedPlayerPartitions } from './stateCleanup.js';
import { safeJsonParse } from '../utils/jsonUtils.js';

import {
    isClashCalcHost,
    getActivePlayerPrefix,
    getActivePlayerTagsKey,
    getActiveAppSettingsKey,
    getStorageItem,
    normalizePlayerTag,
    getPlayerStorageKey,
    PLAYER_PREFIX,
    CANONICAL_PLAYER_PREFIX,
    PLAYER_TAGS_KEY,
    CANONICAL_PLAYER_TAGS_KEY,
    APP_SETTINGS_KEY,
    CANONICAL_APP_SETTINGS_KEY
} from './storageKeys.js';

import { consolidateLocalStorageKeys, sweepObsoleteStorageKeys } from './storageMigrations.js';
import { sanitizePlayerProfile, stripAutoPlacedCalendarChips } from './playerStorageSanitizer.js';

/**
 * Emits saving status event to decoupled UI listeners.
 * @param {'saving' | 'idle' | 'error'} status
 */
function emitSavingStatus(status) {
    if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
        document.dispatchEvent(new CustomEvent('app:savingState', { detail: { status } }));
    }
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

                // Defensive guard: prevent bleeding in-memory player into partition if tags do not match
                const profileTag = state.playerProfile?.tag ? normalizePlayerTag(state.playerProfile.tag) : null;
                const isProfileMatch = cleanPlayerTag === 'DEFAULT0' ? !profileTag : (!profileTag || profileTag === cleanPlayerTag);

                const playerData = {
                    ...existingData,
                    heroes: isProfileMatch ? (state.heroes || existingData.heroes) : (existingData.heroes || initializeDefaultPlayerState().heroes),
                    storedOres: isProfileMatch ? (state.storedOres || existingData.storedOres) : (existingData.storedOres || initializeDefaultPlayerState().storedOres),
                    income: isProfileMatch ? (state.income || existingData.income) : (existingData.income || initializeDefaultPlayerState().income),
                    planner: isProfileMatch ? (serializedPlanner || existingData.planner) : (existingData.planner || initializeDefaultPlayerState().planner),
                    playerProfile: isProfileMatch ? (state.playerProfile || existingData.playerProfile || null) : (existingData.playerProfile || null),
                    heroJourney: isProfileMatch ? (serializedHeroJourney || existingData.heroJourney || null) : (existingData.heroJourney || null),
                    onboardingTimestamp: existingData.onboardingTimestamp !== undefined
                        ? existingData.onboardingTimestamp
                        : (state.onboardingTimestamp ?? null),
                    currency: {
                        code: existingData?.currency?.code || state.uiSettings?.currency?.code || 'USD',
                        globalPricing: existingData?.currency?.globalPricing || {}
                    }
                };

                // Strip auto-placed events from calendar dates before saving
                if (playerData.planner?.calendar?.dates) {
                    playerData.planner.calendar.dates = stripAutoPlacedCalendarChips(playerData.planner.calendar.dates);
                }

                // Sanitize player profile to prevent raw API bloat persistence
                if (playerData.playerProfile) {
                    playerData.playerProfile = sanitizePlayerProfile(playerData.playerProfile);
                }

                state.allPlayersData[cleanPlayerTag] = playerData;
                if (cleanPlayerTag !== currentPlayerTag && state.allPlayersData[currentPlayerTag]) {
                    delete state.allPlayersData[currentPlayerTag];
                }

                const targetPrefix = getActivePlayerPrefix();
                const inactivePrefix = isClashCalcHost() ? PLAYER_PREFIX : CANONICAL_PLAYER_PREFIX;
                localStorage.setItem(getPlayerStorageKey(cleanPlayerTag, targetPrefix), JSON.stringify(playerData));
                localStorage.removeItem(getPlayerStorageKey(cleanPlayerTag, inactivePrefix));
                if (cleanPlayerTag !== 'DEFAULT0') {
                    localStorage.removeItem(`${PLAYER_PREFIX}#${cleanPlayerTag}`);
                    localStorage.removeItem(`${CANONICAL_PLAYER_PREFIX}#${cleanPlayerTag}`);
                }

                // Ensure partitions exist for secondary saved tags if present in allPlayersData
                for (const tag of state.savedPlayerTags) {
                    const cleanOther = normalizePlayerTag(tag);
                    if (!cleanOther || cleanOther === cleanPlayerTag) continue;
                    const otherData = state.allPlayersData[cleanOther];
                    if (otherData && typeof otherData === 'object') {
                        const otherKey = getPlayerStorageKey(cleanOther, targetPrefix);
                        if (immediate || localStorage.getItem(otherKey) === null) {
                            localStorage.setItem(otherKey, JSON.stringify(otherData));
                            localStorage.removeItem(getPlayerStorageKey(cleanOther, inactivePrefix));
                        }
                    }
                }
            }

            const cleanUiTimestamps = state.uiSettings?.uiTimestamps ? {
                tour: state.uiSettings.uiTimestamps.tour ?? null
            } : { tour: null };
            const appSettingsToSave = {
                ...(state.uiSettings || {}),
                uiTimestamps: cleanUiTimestamps,
                appVersion: state.appVersion || '3.0.0',
                timestamp: state.timestamp || new Date().toISOString()
            };
            delete appSettingsToSave.saveError;
            localStorage.setItem(getActiveAppSettingsKey(), JSON.stringify(appSettingsToSave));

            const tagsToSave = (Array.isArray(state.savedPlayerTags) && state.savedPlayerTags.length > 0)
                ? state.savedPlayerTags.map(normalizePlayerTag).filter(Boolean)
                : ['DEFAULT0'];
            localStorage.setItem(getActivePlayerTagsKey(), JSON.stringify(tagsToSave.length > 0 ? tagsToSave : ['DEFAULT0']));

            emitSavingStatus('idle');

        } catch (error) {
            console.error("Could not save partitioned state to localStorage", error);
            emitSavingStatus('error');
        }
    };

    if (immediate) {
        performSave();
    } else {
        emitSavingStatus('saving');
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
    // Ancient Monolithic State Floor: If legacy oreCalculatorState is detected,
    // extract player tags, discard monolithic bloat without running legacy v1 migrations,
    // and seed clean baseline partitioned state.
    const legacyStateStr = localStorage.getItem('oreCalculatorState') || localStorage.getItem('OreCalculatorState');
    if (legacyStateStr) {
        let extractedTags = [];
        const legacyParsed = safeJsonParse(legacyStateStr, null);
        if (legacyParsed?.savedPlayerTags && Array.isArray(legacyParsed.savedPlayerTags)) {
            extractedTags = legacyParsed.savedPlayerTags.map(normalizePlayerTag).filter(t => t && t !== 'DEFAULT0');
        }
        localStorage.removeItem('oreCalculatorState');
        localStorage.removeItem('OreCalculatorState');

        const safeTags = extractedTags.length > 0 ? extractedTags : ['DEFAULT0'];
        const targetTagsKey = isClashCalcHost() ? CANONICAL_PLAYER_TAGS_KEY : PLAYER_TAGS_KEY;
        localStorage.setItem(targetTagsKey, JSON.stringify(safeTags));

        // Seed fresh baseline partition for each preserved player tag
        for (const tag of safeTags) {
            const partitionKey = getPlayerStorageKey(tag);
            if (localStorage.getItem(partitionKey) === null) {
                const legacyPlayer = legacyParsed?.allPlayersData?.[tag] || {};
                const basePlayer = initializeDefaultPlayerState();
                if (legacyPlayer.playerProfile) {
                    basePlayer.playerProfile = legacyPlayer.playerProfile;
                }
                localStorage.setItem(partitionKey, JSON.stringify(basePlayer));
            }
        }

        const appSettingsStr = getStorageItem(CANONICAL_APP_SETTINGS_KEY, APP_SETTINGS_KEY);
        const appSettings = (appSettingsStr ? safeJsonParse(appSettingsStr, {}) : {}) || {};
        appSettings.appVersion = '3.0.0';
        const targetSettingsKey = isClashCalcHost() ? CANONICAL_APP_SETTINGS_KEY : APP_SETTINGS_KEY;
        localStorage.setItem(targetSettingsKey, JSON.stringify(appSettings));
    }

    consolidateLocalStorageKeys();

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
    const tagsStr = getStorageItem(CANONICAL_PLAYER_TAGS_KEY, PLAYER_TAGS_KEY);
    if (tagsStr === null) {
        return null;
    }

    try {
        let savedPlayerTags = safeJsonParse(tagsStr, ['DEFAULT0']);
        if (!Array.isArray(savedPlayerTags) || savedPlayerTags.length === 0) {
            savedPlayerTags = ['DEFAULT0'];
        }
        savedPlayerTags = savedPlayerTags.map(normalizePlayerTag).filter(Boolean);
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
        delete uiSettings.saveError;
        if (uiSettings.uiTimestamps) {
            delete uiSettings.uiTimestamps.privacy;
            delete uiSettings.uiTimestamps.tos;
            delete uiSettings.uiTimestamps.terms;
            delete uiSettings.uiTimestamps.welcome;
        }

        const allPlayersData = {};

        const activePrefix = getActivePlayerPrefix();
        const inactivePrefix = isClashCalcHost() ? PLAYER_PREFIX : CANONICAL_PLAYER_PREFIX;

        for (const tag of savedPlayerTags) {
            const cleanKey = normalizePlayerTag(tag);
            const primaryKey = getPlayerStorageKey(cleanKey, activePrefix);
            const fallbackKey = getPlayerStorageKey(cleanKey, inactivePrefix);
            let playerStr = localStorage.getItem(primaryKey) || localStorage.getItem(fallbackKey);
            if (!playerStr && cleanKey !== 'DEFAULT0') {
                const legacyKey1 = `${activePrefix}#${cleanKey}`;
                const legacyKey2 = `${inactivePrefix}#${cleanKey}`;
                playerStr = localStorage.getItem(legacyKey1) || localStorage.getItem(legacyKey2);
                if (playerStr) {
                    try {
                        localStorage.setItem(primaryKey, playerStr);
                        localStorage.removeItem(legacyKey1);
                        localStorage.removeItem(legacyKey2);
                    } catch (e) {}
                }
            }

            if (playerStr) {
                const parsedPlayer = safeJsonParse(playerStr, null);
                let playerObj = parsedPlayer || initializeDefaultPlayerState();
                if (!playerObj.heroes && cleanKey !== 'DEFAULT0') {
                    const existingProfile = playerObj.playerProfile;
                    playerObj = initializeDefaultPlayerState();
                    if (existingProfile && typeof existingProfile === 'object') {
                        playerObj.playerProfile = existingProfile;
                    }
                }
                // Purge cross-contaminated profile if partition key does not match internal profile tag
                if (cleanKey !== 'DEFAULT0' && playerObj.playerProfile?.tag && normalizePlayerTag(playerObj.playerProfile.tag) !== cleanKey) {
                    playerObj.playerProfile = null;
                }
                if (playerObj.playerProfile) {
                    playerObj.playerProfile = sanitizePlayerProfile(playerObj.playerProfile);
                }
                if (playerObj.planner?.calendar?.dates) {
                    playerObj.planner.calendar.dates = stripAutoPlacedCalendarChips(playerObj.planner.calendar.dates);
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

                try {
                    const activeKey = getPlayerStorageKey(cleanKey, activePrefix);
                    localStorage.setItem(activeKey, JSON.stringify(playerObj));
                    if (localStorage.getItem(fallbackKey) !== null) {
                        localStorage.removeItem(fallbackKey);
                    }
                } catch (e) {}

                allPlayersData[cleanKey] = playerObj;
            } else {
                allPlayersData[cleanKey] = initializeDefaultPlayerState();
            }
        }

        cleanupOrphanedPlayerPartitions(state);
        sweepObsoleteStorageKeys(savedPlayerTags);

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
        if (typeof document !== 'undefined' && document?.documentElement?.classList) {
            document.documentElement.classList.remove('has-player');
        }
    } catch (error) {
        console.error("Could not reset state in localStorage", error);
    }
}
