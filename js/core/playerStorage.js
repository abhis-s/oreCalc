/**
 * Player Profile Partition Operations and Multi-Account Storage Manager.
 * Tier 3: Core Service (Player Profile Storage).
 */

import { MAX_SAVED_PLAYERS, UNRANKED_LEAGUE_ID } from './constants.js';
import { getDefaultPlayerState as initializeDefaultPlayerState, state } from './state.js';
import { safeJsonParse } from '../utils/jsonUtils.js';
import { escapeHTML } from '../utils/stringUtils.js';
import { translate } from '../i18n/translator.js';
import {
    CANONICAL_PLAYER_PREFIX,
    PLAYER_PREFIX,
    CANONICAL_PLAYER_TAGS_KEY,
    PLAYER_TAGS_KEY,
    getActivePlayerPrefix,
    getActivePlayerTagsKey,
    getPlayerStorageKey,
    getStorageItem,
    normalizePlayerTag,
    formatDisplayTag,
    isClashCalcHost,
    getActiveUserId,
    rotateActiveUserId
} from './storageKeys.js';
import { sanitizePlayerProfile } from './playerStorageSanitizer.js';
import { saveState } from './localStorageManager.js';
import { cancelCloudSaveTimer } from './stateManager.js';
import { cancelPreferencesSaveTimer, triggerCloudSave } from '../services/cloudSaveService.js';
import { deleteUserData } from '../services/apiService.js';
import { syncPlayerTagToUrl } from './playerUrlRouter.js';
import { calculateEquipmentProgress } from '../domain/equipment/equipmentProgressDomain.js';
import { getCumulativeHeroLevel } from '../domain/income/heroJourneyLevels.js';
import { heroJourneyNodes } from '../data/heroJourneyData.js';
import { leagueTiers } from '../data/leagueTiers.js';

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
        const tagsKey = getActivePlayerTagsKey();
        const rawTags = localStorage.getItem(tagsKey);
        const list = safeJsonParse(rawTags, []);
        let isLastPlayer = false;
        if (Array.isArray(list)) {
            const pruned = list.map(normalizePlayerTag).filter(tag => tag && tag !== cleanTag && tag !== 'DEFAULT0');
            isLastPlayer = pruned.length === 0;
            localStorage.setItem(tagsKey, JSON.stringify(isLastPlayer ? ['DEFAULT0'] : pruned));
            if (typeof document !== 'undefined' && document?.documentElement?.classList) {
                if (isLastPlayer) {
                    document.documentElement.classList.remove('has-player');
                } else {
                    document.documentElement.classList.add('has-player');
                }
            }
        }

        // 1. Universally purge player partitions and sub-partitions from disk
        localStorage.removeItem(getPlayerStorageKey(cleanTag, CANONICAL_PLAYER_PREFIX));
        localStorage.removeItem(getPlayerStorageKey(cleanTag, PLAYER_PREFIX));
        localStorage.removeItem(`${CANONICAL_PLAYER_PREFIX}#${cleanTag}`);
        localStorage.removeItem(`${PLAYER_PREFIX}#${cleanTag}`);
        localStorage.removeItem(`clashCalc_planner_${cleanTag}`);
        localStorage.removeItem(`oreCalc_planner_${cleanTag}`);
        localStorage.removeItem(`clashCalc_history_${cleanTag}`);
        localStorage.removeItem(`oreCalc_history_${cleanTag}`);

        try {
            const dmgRaw = localStorage.getItem('clashCalc_damageCalcState');
            if (dmgRaw) {
                const dmgParsed = safeJsonParse(dmgRaw, null);
                if (dmgParsed && dmgParsed.activeTag === cleanTag) {
                    const fallbackTag = (Array.isArray(state?.savedPlayerTags) ? state.savedPlayerTags.find(t => {
                        const n = normalizePlayerTag(t);
                        return n && n !== cleanTag && n !== 'DEFAULT0';
                    }) : null) || (Array.isArray(list) ? list.find(t => {
                        const n = normalizePlayerTag(t);
                        return n && n !== cleanTag && n !== 'DEFAULT0';
                    }) : null) || null;
                    dmgParsed.activeTag = fallbackTag ? normalizePlayerTag(fallbackTag) : null;
                    localStorage.setItem('clashCalc_damageCalcState', JSON.stringify(dmgParsed));
                }
            }
        } catch (_) {}

        // 2. Synchronize in-memory monolithic state if present
        if (state.allPlayersData) {
            const wasActive = normalizePlayerTag(state.savedPlayerTags[0]) === cleanTag;

            delete state.allPlayersData[cleanTag];
            delete state.allPlayersData[playerTagToDelete];
            state.savedPlayerTags = state.savedPlayerTags
                .map(normalizePlayerTag)
                .filter(tag => tag !== cleanTag);

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
        } else if (isLastPlayer) {
            const defaultKey = getPlayerStorageKey('DEFAULT0');
            if (!localStorage.getItem(defaultKey)) {
                localStorage.setItem(defaultKey, JSON.stringify(initializeDefaultPlayerState()));
            }
        }

        // 3. Universally defuse cloud timers, rotate UUID, and strip URL when the last player is removed
        if (isLastPlayer) {
            cancelCloudSaveTimer();
            cancelPreferencesSaveTimer();
            syncPlayerTagToUrl(null);

            const isAuthed = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('clashCalc_authToken') && localStorage.getItem('clashCalc_username'));
            if (!isAuthed) {
                const oldUserId = getActiveUserId(false);
                if (oldUserId) {
                    deleteUserData(oldUserId).catch(() => {});
                }
                rotateActiveUserId();
            } else {
                triggerCloudSave({ silent: true }).catch(() => {});
            }
        } else {
            const isAuthed = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('clashCalc_authToken') && localStorage.getItem('clashCalc_username'));
            const shouldSync = isAuthed || state.uiSettings?.cloudSync !== false;
            if (shouldSync) {
                triggerCloudSave({ silent: true }).catch(() => {});
            }
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
        const activePrefix = getActivePlayerPrefix();
        const inactivePrefix = isClashCalcHost() ? PLAYER_PREFIX : CANONICAL_PLAYER_PREFIX;
        const primaryKey = getPlayerStorageKey(cleanTag, activePrefix);
        const fallbackKey = getPlayerStorageKey(cleanTag, inactivePrefix);
        let playerStr = localStorage.getItem(primaryKey) || localStorage.getItem(fallbackKey);
        if (!playerStr && cleanTag !== 'DEFAULT0') {
            const legacyKey1 = `${activePrefix}#${cleanTag}`;
            const legacyKey2 = `${inactivePrefix}#${cleanTag}`;
            playerStr = localStorage.getItem(legacyKey1) || localStorage.getItem(legacyKey2);
            if (playerStr) {
                try {
                    localStorage.setItem(primaryKey, playerStr);
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

        const rawProfile = playerState.playerProfile || null;
        const isProfileMatch = !rawProfile?.tag || isGuest || normalizePlayerTag(rawProfile.tag) === cleanTag;
        const resolvedProfile = isProfileMatch ? rawProfile : null;

        return {
            heroes: playerState.heroes || (isGuest ? defaultState.heroes : undefined),
            storedOres: playerState.storedOres || (isGuest ? defaultState.storedOres : undefined),
            income: playerState.income || (isGuest ? defaultState.income : undefined),
            planner: playerState.planner || (isGuest ? defaultState.planner : undefined),
            heroJourney: playerState.heroJourney || (isGuest ? defaultState.heroJourney : undefined),
            playerProfile: resolvedProfile,
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
    if (!state.allPlayersData || typeof state.allPlayersData !== 'object') {
        state.allPlayersData = {};
    }
    if (!Array.isArray(state.savedPlayerTags)) {
        state.savedPlayerTags = [];
    }
    try {
        if (cleanTag !== 'DEFAULT0') {
            if (typeof document !== 'undefined' && document?.documentElement?.classList) {
                document.documentElement.classList.add('has-player');
            }
            state.savedPlayerTags = state.savedPlayerTags
                .map(normalizePlayerTag)
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
            .map(normalizePlayerTag)
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
        saveState(state, true);
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
    if (!state.allPlayersData || typeof state.allPlayersData !== 'object') {
        state.allPlayersData = {};
    }
    if (!Array.isArray(state.savedPlayerTags)) {
        state.savedPlayerTags = [];
    }
    try {
        state.allPlayersData[cleanTag] = playerState;
        const targetPrefix = getActivePlayerPrefix();
        const inactivePrefix = isClashCalcHost() ? PLAYER_PREFIX : CANONICAL_PLAYER_PREFIX;
        localStorage.setItem(getPlayerStorageKey(cleanTag, targetPrefix), JSON.stringify(playerState));
        localStorage.removeItem(getPlayerStorageKey(cleanTag, inactivePrefix));
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

        saveState(state, true);
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
        const realTags = state.savedPlayerTags.map(normalizePlayerTag).filter(t => t && t !== 'DEFAULT0');
        if (realTags.length > 0) {
            return realTags;
        }
    }
    try {
        const str = getStorageItem(CANONICAL_PLAYER_TAGS_KEY, PLAYER_TAGS_KEY);
        const list = safeJsonParse(str, []);
        if (Array.isArray(list)) {
            return list.map(normalizePlayerTag).filter(t => t && t !== 'DEFAULT0');
        }
    } catch {}
    return [];
}

/**
 * @typedef {Object} SavedProfileSummary
 * @property {string} tag
 * @property {string} cleanTag
 * @property {string} name
 * @property {number} townHallLevel
 * @property {number} trophies
 * @property {any} [cachedData]
 * @property {any} [heroJourney]
 */

/**
 * Retrieves list of saved player profile summaries from localStorage or in-memory state.
 * @returns {SavedProfileSummary[]} Array of saved profiles.
 */
export function getSavedProfiles() {
    try {
        const tagsStr = getStorageItem(CANONICAL_PLAYER_TAGS_KEY, PLAYER_TAGS_KEY);
        const tags = safeJsonParse(tagsStr, []);
        let tagList = Array.isArray(tags) ? [...tags] : [];
        if (tagList.length === 0 && state && Array.isArray(state.savedPlayerTags) && state.savedPlayerTags.length > 0) {
            tagList = state.savedPlayerTags.filter(t => t && t !== 'DEFAULT0');
        }
        const seenTags = new Set();
        const summaries = [];
        const orphanedTags = [];
        for (const rawTag of tagList) {
            if (!rawTag || rawTag === 'DEFAULT0') continue;
            const cleanTag = normalizePlayerTag(rawTag);
            if (!cleanTag || cleanTag === 'DEFAULT0' || seenTags.has(cleanTag)) continue;
            seenTags.add(cleanTag);

            const activeKey = getPlayerStorageKey(cleanTag);
            let playerStr = localStorage.getItem(activeKey);
            if (!playerStr) {
                const fallbackKey = isClashCalcHost()
                    ? getPlayerStorageKey(cleanTag, PLAYER_PREFIX)
                    : getPlayerStorageKey(cleanTag, CANONICAL_PLAYER_PREFIX);
                playerStr = localStorage.getItem(fallbackKey);
                if (!playerStr) {
                    const legacyHashKey = `${PLAYER_PREFIX}#${cleanTag}`;
                    playerStr = localStorage.getItem(legacyHashKey);
                    if (playerStr) {
                        try {
                            localStorage.setItem(activeKey, playerStr);
                            localStorage.removeItem(legacyHashKey);
                        } catch {}
                    }
                }
            }
            const playerData = safeJsonParse(playerStr, null) || (state?.allPlayersData && (state.allPlayersData[cleanTag] || state.allPlayersData[rawTag])) || null;
            const rawProfile = playerData?.playerProfile || playerData?.playerData || null;
            const isMismatch = Boolean(rawProfile?.tag && normalizePlayerTag(rawProfile.tag) !== cleanTag);
            const profile = isMismatch ? null : rawProfile;

            // If neither partition state nor profile exists, skip dummy skeleton creation and prune orphan
            if (!playerData && !profile) {
                orphanedTags.push(cleanTag);
                continue;
            }

            summaries.push({
                tag: formatDisplayTag(cleanTag),
                cleanTag,
                name: profile?.name || formatDisplayTag(cleanTag),
                townHallLevel: Number(profile?.townHallLevel) || 1,
                trophies: Number(profile?.trophies) || 0,
                cachedData: profile || null,
                heroJourney: playerData?.heroJourney || null
            });
        }

        if (orphanedTags.length > 0) {
            const tagsKey = getActivePlayerTagsKey();
            const rawTags = localStorage.getItem(tagsKey);
            const list = safeJsonParse(rawTags, []);
            if (Array.isArray(list)) {
                const pruned = list.filter(t => !orphanedTags.includes(normalizePlayerTag(t)));
                localStorage.setItem(tagsKey, JSON.stringify(pruned.length > 0 ? pruned : ['DEFAULT0']));
            }
            if (state && Array.isArray(state.savedPlayerTags)) {
                state.savedPlayerTags = state.savedPlayerTags.filter(t => !orphanedTags.includes(normalizePlayerTag(t)));
            }
        }

        return summaries;
    } catch {
        return [];
    }
}

/**
 * Persists freshly fetched player data into local storage and updates saved player tags.
 * Ensures the stored partition is a complete canonical structure containing heroes,
 * storedOres, income, planner, heroJourney, and playerProfile to prevent loadState wipeouts.
 *
 * @param {any} data - Raw player API response object.
 * @param {boolean} [updateOrder=true] - Whether to move this tag to the beginning of saved tags.
 * @returns {string} Normalized clean server tag.
 */
export function savePlayerProfileToStorage(data, updateOrder = true) {
    if (!data || !data.tag) return '';
    const serverTag = normalizePlayerTag(data.tag);
    if (!serverTag || serverTag === 'DEFAULT0') return '';

    const canonicalKey = getPlayerStorageKey(serverTag);
    const existingStr = localStorage.getItem(canonicalKey);
    const existing = safeJsonParse(existingStr, null);
    const partition = (existing && typeof existing === 'object' && existing.heroes)
        ? existing
        : initializeDefaultPlayerState();

    const homeHeroes = data.heroes?.filter(h => h.village === 'home' || !h.village) || [];

    partition.playerProfile = sanitizePlayerProfile(data);

    if (partition.heroes && typeof partition.heroes === 'object') {
        for (const hero of homeHeroes) {
            if (partition.heroes[hero.name]?.equipment && Array.isArray(hero.equipment)) {
                for (const eq of hero.equipment) {
                    if (partition.heroes[hero.name].equipment[eq.name]) {
                        partition.heroes[hero.name].equipment[eq.name].level = eq.level;
                    }
                }
            }
        }
    }

    localStorage.setItem(canonicalKey, JSON.stringify(partition));

    const tagsKey = getActivePlayerTagsKey();
    const rawTags = localStorage.getItem(tagsKey);
    const list = safeJsonParse(rawTags, []);
    const tags = Array.isArray(list) ? list.map(normalizePlayerTag).filter(t => t && t !== 'DEFAULT0') : [];

    let updatedTags;
    if (updateOrder) {
        updatedTags = tags.filter(t => t !== serverTag);
        updatedTags.unshift(serverTag);
    } else {
        updatedTags = tags.includes(serverTag) ? tags : [...tags, serverTag];
    }
    localStorage.setItem(tagsKey, JSON.stringify(updatedTags));

    if (state && Array.isArray(state.savedPlayerTags)) {
        state.savedPlayerTags = updatedTags;
    }
    if (state && state.allPlayersData) {
        state.allPlayersData[serverTag] = partition;
    }

    return serverTag;
}

/**
 * Promotes a player tag to the active position (index 0) in localStorage and state.
 *
 * @param {string} playerTag - Normalized or raw player tag to set as active.
 */
export function setActivePlayerTag(playerTag) {
    const cleanTag = normalizePlayerTag(playerTag);
    if (!cleanTag || cleanTag === 'DEFAULT0') return;

    if (typeof document !== 'undefined' && document?.documentElement?.classList) {
        document.documentElement.classList.add('has-player');
    }

    const tagsKey = getActivePlayerTagsKey();
    const rawTags = localStorage.getItem(tagsKey);
    const list = safeJsonParse(rawTags, []);
    const tags = Array.isArray(list) ? list.map(normalizePlayerTag).filter(t => t && t !== 'DEFAULT0') : [];

    if (tags[0] === cleanTag) return;

    const remaining = tags.filter(t => t !== cleanTag);
    const updatedTags = [cleanTag, ...remaining];
    localStorage.setItem(tagsKey, JSON.stringify(updatedTags));

    if (state && Array.isArray(state.savedPlayerTags)) {
        state.savedPlayerTags = updatedTags;
    }
}

/**
 * Resolves normalized, display-ready summary statistics for a given player tag or profile.
 *
 * @param {string} [cleanTag=''] - Raw or normalized player tag.
 * @param {Object} [explicitProfile=null] - Optional override player profile object.
 * @returns {{
 *   rawTag: string,
 *   cleanTag: string,
 *   cleanName: string,
 *   profileName: string,
 *   hasProfile: boolean,
 *   displayTag: string,
 *   thLevel: number,
 *   orePct: number,
 *   oreProgressPct: number,
 *   heroLevel: number | null,
 *   oresDoneText: string,
 *   nextNodeText: string,
 *   finalTrophies: number,
 *   trophies: number,
 *   leagueIcon: string,
 *   leagueAlt: string,
 *   leagueName: string,
 *   clanBadge: string,
 *   clanName: string
 * }}
 */
export function resolvePlayerSummaryStats(cleanTag = '', explicitProfile = null) {
    const rawTag = cleanTag ? cleanTag.replace(/^#+/, '').trim() : '';
    let name = explicitProfile?.name || '';
    let townHallLevel = explicitProfile?.townHallLevel;
    let trophies = typeof explicitProfile?.trophies === 'number'
        ? Math.max(0, explicitProfile.trophies)
        : (explicitProfile?.trophies ? Math.max(0, Number(explicitProfile.trophies) || 0) : null);
    let oreProgressPct = typeof explicitProfile?.oreProgressPct === 'number'
        ? explicitProfile.oreProgressPct
        : (typeof explicitProfile?.progressPct === 'number' ? explicitProfile.progressPct : null);
    let heroLevel = typeof explicitProfile?.heroLevel === 'number'
        ? explicitProfile.heroLevel
        : (explicitProfile?.heroJourney?.cumulativeHeroLevel ?? null);

    let found = null;
    if (rawTag && rawTag !== 'DEFAULT0' && rawTag !== 'GUEST') {
        const savedProfiles = getSavedProfiles();
        found = savedProfiles.find(p => p.cleanTag === rawTag);
        if (found) {
            if (!name) name = found.name;
            if (!townHallLevel) townHallLevel = found.townHallLevel;
            if (trophies === null && found.trophies !== undefined && found.trophies !== null) {
                trophies = Math.max(0, Number(found.trophies) || 0);
            }
            if (heroLevel === null && found.heroJourney?.cumulativeHeroLevel != null) {
                heroLevel = Number(found.heroJourney.cumulativeHeroLevel) || 0;
            }
        }

        const sourceCachedData = explicitProfile?.cachedData || found?.cachedData;
        let ownedEquipment = {};
        let ownedHeroes = {};

        if (sourceCachedData?.ownedEquipment && typeof sourceCachedData.ownedEquipment === 'object' && !Array.isArray(sourceCachedData.ownedEquipment)) {
            ownedEquipment = { ...sourceCachedData.ownedEquipment };
            if (sourceCachedData.ownedHeroes && typeof sourceCachedData.ownedHeroes === 'object' && !Array.isArray(sourceCachedData.ownedHeroes)) {
                ownedHeroes = { ...sourceCachedData.ownedHeroes };
            }
        } else if (Array.isArray(sourceCachedData?.heroEquipment) || Array.isArray(sourceCachedData?.heroes)) {
            if (Array.isArray(sourceCachedData.heroEquipment)) {
                sourceCachedData.heroEquipment.forEach(eq => {
                    if (eq?.name && (!eq.village || eq.village === 'home')) {
                        ownedEquipment[eq.name] = Number(eq.level) || 1;
                    }
                });
            }
            if (Array.isArray(sourceCachedData.heroes)) {
                sourceCachedData.heroes.forEach(h => {
                    if (h?.name && (!h.village || h.village === 'home')) {
                        ownedHeroes[h.name] = h;
                    }
                });
            }
        }

        if (Object.keys(ownedEquipment).length === 0 && rawTag) {
            let partition = state?.allPlayersData?.[rawTag] || state?.allPlayersData?.[cleanTag];
            if (!partition) {
                try {
                    const rawPartition = localStorage.getItem(getPlayerStorageKey(cleanTag));
                    if (rawPartition) partition = safeJsonParse(rawPartition, null);
                } catch {}
            }
            if (partition?.heroes && typeof partition.heroes === 'object') {
                for (const heroName in partition.heroes) {
                    const heroState = partition.heroes[heroName];
                    if (heroState?.enabled !== false) {
                        ownedHeroes[heroName] = { level: heroState?.level || 1, maxLevel: 95 };
                        if (heroState?.equipment) {
                            for (const equipName in heroState.equipment) {
                                const eqState = heroState.equipment[equipName];
                                if (eqState && eqState.checked !== false) {
                                    ownedEquipment[equipName] = eqState.level || 1;
                                }
                            }
                        }
                    }
                }
            } else if (partition?.playerProfile?.ownedEquipment) {
                ownedEquipment = { ...partition.playerProfile.ownedEquipment };
                if (partition.playerProfile.ownedHeroes) {
                    ownedHeroes = { ...partition.playerProfile.ownedHeroes };
                }
            }
        }

        if (oreProgressPct === null && (Object.keys(ownedEquipment).length > 0 || Object.keys(ownedHeroes).length > 0)) {
            try {
                oreProgressPct = calculateEquipmentProgress(ownedEquipment, ownedHeroes).overall;
            } catch (_) {}
        }

        if (heroLevel === null) {
            if (sourceCachedData) {
                try {
                    heroLevel = getCumulativeHeroLevel({ playerProfile: sourceCachedData });
                } catch (_) {}
            }
            if (heroLevel === null && Object.keys(ownedHeroes).length > 0) {
                try {
                    heroLevel = getCumulativeHeroLevel({ playerProfile: { ownedHeroes } });
                } catch (_) {}
            }
        }
    }

    const cleanName = (name === 'DEFAULT0' || name === '#DEFAULT0') ? '' : name;
    const hasProfile = Boolean(cleanName);
    const thLevel = Math.max(1, Math.min(18, Number(townHallLevel) || 18));
    const orePct = typeof oreProgressPct === 'number' ? Math.round(Math.max(0, Math.min(100, oreProgressPct))) : 0;
    const oresDoneText = translate('nav.context.oresDone', { percent: orePct }) || `${orePct}% Ores Done`;

    let nextNodeText = '';
    if (heroLevel === null || heroLevel === undefined) {
        nextNodeText = `TH${thLevel}`;
    } else if (heroLevel >= 480) {
        nextNodeText = translate('views.home.profile.maxed') || 'Maxed';
    } else {
        const nextNode = heroJourneyNodes.find(n => n.level > heroLevel);
        if (!nextNode) {
            nextNodeText = translate('views.home.profile.maxed') || 'Maxed';
        } else {
            const delta = Math.max(0, nextNode.level - heroLevel);
            nextNodeText = translate('nav.context.nextNodeIn', { levels: delta }) || `Next Node in ${delta} lvls`;
        }
    }

    const displayTag = explicitProfile?.tag || (rawTag ? `#${rawTag}` : '');
    const finalTrophies = typeof trophies === 'number' ? trophies : 0;

    const rawLeague = explicitProfile?.leagueTier ||
        explicitProfile?.league ||
        explicitProfile?.cachedData?.leagueTier ||
        explicitProfile?.cachedData?.league ||
        found?.cachedData?.leagueTier ||
        found?.cachedData?.league || null;

    const leagueId = Number(rawLeague?.id);
    const canonicalLeague = leagueTiers.items.find(l => l.id === leagueId);
    const unrankedLeague = leagueTiers.items.find(l => l.id === UNRANKED_LEAGUE_ID) || leagueTiers.items[0];
    const leagueIcon = explicitProfile?.leagueIcon ||
        canonicalLeague?.icon ||
        canonicalLeague?.iconUrls?.small ||
        rawLeague?.iconUrls?.small ||
        rawLeague?.iconUrls?.medium ||
        unrankedLeague?.icon ||
        'assets/leagues/unranked.png';
    const leagueAlt = explicitProfile?.leagueAlt || canonicalLeague?.name || rawLeague?.name || unrankedLeague?.name || 'League Icon';

    let leagueName = explicitProfile?.leagueName || canonicalLeague?.name || rawLeague?.name || '';
    if (!explicitProfile?.leagueName && canonicalLeague) {
        const leagueKey = 'entities.leagues.' + canonicalLeague.name.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (_, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        leagueName = translate(leagueKey);
    }
    const leagueNameDisplay = leagueName || translate('entities.leagues.unranked') || 'Unranked';

    const rawClan = explicitProfile?.clan || explicitProfile?.cachedData?.clan || found?.cachedData?.clan;
    const clanBadge = rawClan?.badgeUrls?.small || rawClan?.badgeUrls?.medium || '';
    const clanName = escapeHTML(rawClan?.name || '');

    return {
        rawTag,
        cleanTag: rawTag,
        cleanName,
        profileName: cleanName,
        hasProfile,
        displayTag,
        thLevel,
        orePct,
        oreProgressPct: orePct,
        heroLevel,
        oresDoneText,
        nextNodeText,
        finalTrophies,
        trophies: finalTrophies,
        leagueIcon,
        leagueAlt,
        leagueName: leagueNameDisplay,
        clanBadge,
        clanName
    };
}
