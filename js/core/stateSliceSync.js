/**
 * Slice-Level Last-Write-Wins (LWW) Timestamp Tracking & State Convergence Engine.
 * Tracks per-slice modification timestamps across player partitions and user preferences
 * so concurrent edits to different slices across devices merge without data clobbering.
 * Tier 3: Core State Synchronization.
 */

import { stripAutoPlacedCalendarChips } from './playerStorageSanitizer.js';
import { normalizePlayerTag } from './storageKeys.js';

const PLAYER_SYNC_SLICES = Object.freeze([
    'heroes',
    'storedOres',
    'income',
    'planner',
    'heroJourney',
    'currency'
]);

/**
 * Creates a default sliceTimestamps map initialized to the given epoch timestamp.
 *
 * @param {number} [initialMs=0] - Initial epoch timestamp in milliseconds.
 * @returns {Record<string, number>}
 */
export function createDefaultSliceTimestamps(initialMs = 0) {
    const ts = Number.isFinite(initialMs) && initialMs > 0 ? Math.trunc(initialMs) : 0;
    return {
        heroes: ts,
        storedOres: ts,
        income: ts,
        planner: ts,
        heroJourney: ts,
        currency: ts
    };
}

/**
 * Normalizes a sliceTimestamps object, backfilling missing keys with fallbackMs.
 *
 * @param {Record<string, any> | null | undefined} rawTimestamps - Existing sliceTimestamps map.
 * @param {number} [fallbackMs=0] - Fallback epoch timestamp for missing slices.
 * @returns {Record<string, number>}
 */
export function normalizeSliceTimestamps(rawTimestamps, fallbackMs = 0) {
    const base = createDefaultSliceTimestamps(fallbackMs);
    if (!rawTimestamps || typeof rawTimestamps !== 'object') {
        return base;
    }
    for (const sliceKey of PLAYER_SYNC_SLICES) {
        if (rawTimestamps[sliceKey] !== undefined) {
            const val = Number(rawTimestamps[sliceKey]);
            base[sliceKey] = Number.isFinite(val) && val >= 0 ? Math.trunc(val) : base[sliceKey];
        }
    }
    return base;
}

/**
 * Serializes a player slice into a canonical JSON string for change detection.
 *
 * @param {string} sliceKey
 * @param {any} sliceVal
 * @returns {string}
 */
function serializePlayerSlice(sliceKey, sliceVal) {
    if (sliceVal === undefined || sliceVal === null) return '';
    try {
        if (sliceKey === 'planner' && typeof sliceVal === 'object') {
            const cal = sliceVal.calendar;
            if (cal && typeof cal === 'object') {
                const cleanCal = {
                    ...cal,
                    dates: cal.dates ? stripAutoPlacedCalendarChips(cal.dates) : {}
                };
                delete cleanCal.isHydrated;
                delete cleanCal.isDirty;
                return JSON.stringify({ ...sliceVal, calendar: cleanCal });
            }
        }
        return JSON.stringify(sliceVal);
    } catch {
        return '';
    }
}

/**
 * Serializes uiSettings without transient runtime properties for change detection.
 *
 * @param {Record<string, any> | null | undefined} uiSettings
 * @returns {string}
 */
function serializeUiSettings(uiSettings) {
    if (!uiSettings || typeof uiSettings !== 'object') return '';
    try {
        const copy = { ...uiSettings };
        delete copy.saveError;
        delete copy.updatedAt;
        return JSON.stringify(copy);
    } catch {
        return '';
    }
}

/**
 * Captures a pre-mutation snapshot of the active player's slices and uiSettings.
 *
 * @param {Record<string, any>} stateObj - Current application state.
 * @returns {{ activeTag: string, slices: Record<string, string>, uiSettingsJson: string }}
 */
export function snapshotActivePlayerSlices(stateObj) {
    const activeTag = normalizePlayerTag(stateObj?.savedPlayerTags?.[0]);
    /** @type {Record<string, string>} */
    const slices = {};
    if (activeTag && activeTag !== 'DEFAULT0') {
        const partition = stateObj?.allPlayersData?.[activeTag];
        for (const sliceKey of PLAYER_SYNC_SLICES) {
            const val = sliceKey === 'currency'
                ? (partition?.currency || stateObj?.uiSettings?.currency)
                : (stateObj?.[sliceKey] ?? partition?.[sliceKey]);
            slices[sliceKey] = serializePlayerSlice(sliceKey, val);
        }
    }
    return {
        activeTag,
        slices,
        uiSettingsJson: serializeUiSettings(stateObj?.uiSettings)
    };
}

/**
 * Compares post-mutation state against a pre-mutation snapshot and advances timestamps
 * strictly for the slices that were modified.
 *
 * @param {Record<string, any>} stateObj - Current application state after updateFn().
 * @param {{ activeTag: string, slices: Record<string, string>, uiSettingsJson: string } | null} prevSnapshot - Pre-mutation snapshot.
 * @param {number} nowMs - Current mutation epoch timestamp in milliseconds.
 * @param {{ preferencesOnly?: boolean, allowedSlices?: string[] }} [options={}] - Update options.
 */
export function stampModifiedPlayerSlices(stateObj, prevSnapshot, nowMs, options = {}) {
    if (!stateObj || !prevSnapshot) return;
    const allowedSet = Array.isArray(options.allowedSlices) ? new Set(options.allowedSlices) : null;
    const nextUiJson = serializeUiSettings(stateObj.uiSettings);
    if (!allowedSet && (options.preferencesOnly || (nextUiJson && nextUiJson !== prevSnapshot.uiSettingsJson))) {
        if (stateObj.uiSettings && typeof stateObj.uiSettings === 'object') {
            stateObj.uiSettings.updatedAt = nowMs;
        }
    }
    if (options.preferencesOnly) return;

    const currentTag = normalizePlayerTag(stateObj.savedPlayerTags?.[0]);
    if (!currentTag || currentTag === 'DEFAULT0' || currentTag !== prevSnapshot.activeTag) {
        return;
    }

    const partition = stateObj.allPlayersData?.[currentTag];
    if (!partition || typeof partition !== 'object') return;

    if (!partition.sliceTimestamps || typeof partition.sliceTimestamps !== 'object') {
        partition.sliceTimestamps = createDefaultSliceTimestamps(0);
    }

    for (const sliceKey of PLAYER_SYNC_SLICES) {
        if (allowedSet && !allowedSet.has(sliceKey)) continue;
        const val = sliceKey === 'currency'
            ? (partition.currency || stateObj.uiSettings?.currency)
            : (stateObj[sliceKey] ?? partition[sliceKey]);
        const nextJson = serializePlayerSlice(sliceKey, val);
        if (nextJson !== prevSnapshot.slices[sliceKey]) {
            partition.sliceTimestamps[sliceKey] = nowMs;
        }
    }
    stateObj.sliceTimestamps = partition.sliceTimestamps;
}

/**
 * Merges two player partitions slice-by-slice using Last-Write-Wins timestamps.
 *
 * @param {Record<string, any> | null | undefined} localPlayer - Local player partition.
 * @param {Record<string, any> | null | undefined} cloudPlayer - Cloud player partition.
 * @param {number} [localFallbackMs=0] - Fallback timestamp for legacy local partitions lacking sliceTimestamps.
 * @param {number} [cloudFallbackMs=0] - Fallback timestamp for legacy cloud partitions lacking sliceTimestamps.
 * @returns {{ mergedPlayer: Record<string, any>, hasLocalNewer: boolean, hasCloudNewer: boolean }}
 */
export function mergePlayerPartitionsLWW(localPlayer, cloudPlayer, localFallbackMs = 0, cloudFallbackMs = 0) {
    if (!localPlayer && !cloudPlayer) {
        return { mergedPlayer: {}, hasLocalNewer: false, hasCloudNewer: false };
    }
    if (!localPlayer) {
        return { mergedPlayer: { ...cloudPlayer }, hasLocalNewer: false, hasCloudNewer: true };
    }
    if (!cloudPlayer) {
        return { mergedPlayer: { ...localPlayer }, hasLocalNewer: true, hasCloudNewer: false };
    }

    const hasLocalMap = Boolean(localPlayer.sliceTimestamps && typeof localPlayer.sliceTimestamps === 'object');
    const hasCloudMap = Boolean(cloudPlayer.sliceTimestamps && typeof cloudPlayer.sliceTimestamps === 'object');
    const localTs = normalizeSliceTimestamps(localPlayer.sliceTimestamps, hasLocalMap ? 0 : localFallbackMs);
    const cloudTs = normalizeSliceTimestamps(cloudPlayer.sliceTimestamps, hasCloudMap ? 0 : cloudFallbackMs);

    const preferCloudOnTie = cloudFallbackMs >= localFallbackMs;
    const mergedPlayer = preferCloudOnTie
        ? { ...localPlayer, ...cloudPlayer }
        : { ...cloudPlayer, ...localPlayer };
    const mergedTimestamps = createDefaultSliceTimestamps(0);

    let hasLocalNewer = false;
    let hasCloudNewer = false;

    for (const sliceKey of PLAYER_SYNC_SLICES) {
        const lVal = localPlayer[sliceKey];
        const cVal = cloudPlayer[sliceKey];
        const lTime = lVal !== undefined ? localTs[sliceKey] : -1;
        const cTime = cVal !== undefined ? cloudTs[sliceKey] : -1;

        if (lTime > cTime && lVal !== undefined) {
            mergedPlayer[sliceKey] = lVal;
            mergedTimestamps[sliceKey] = lTime;
            if (cVal === undefined || serializePlayerSlice(sliceKey, lVal) !== serializePlayerSlice(sliceKey, cVal)) {
                hasLocalNewer = true;
            }
        } else if (cTime > lTime && cVal !== undefined) {
            mergedPlayer[sliceKey] = cVal;
            mergedTimestamps[sliceKey] = cTime;
            if (lVal === undefined || serializePlayerSlice(sliceKey, lVal) !== serializePlayerSlice(sliceKey, cVal)) {
                hasCloudNewer = true;
            }
        } else {
            const chosen = preferCloudOnTie ? (cVal !== undefined ? cVal : lVal) : (lVal !== undefined ? lVal : cVal);
            if (chosen !== undefined) {
                mergedPlayer[sliceKey] = chosen;
            }
            mergedTimestamps[sliceKey] = Math.max(0, lTime, cTime);
            if (lVal !== undefined && cVal !== undefined && serializePlayerSlice(sliceKey, lVal) !== serializePlayerSlice(sliceKey, cVal)) {
                if (preferCloudOnTie) {
                    hasCloudNewer = true;
                } else {
                    hasLocalNewer = true;
                }
            }
        }
    }

    mergedPlayer.sliceTimestamps = mergedTimestamps;

    const lRefresh = Number(localPlayer.lastRefreshedAt) || 0;
    const cRefresh = Number(cloudPlayer.lastRefreshedAt) || 0;
    const latestRefresh = Math.max(lRefresh, cRefresh);
    if (latestRefresh > 0) {
        mergedPlayer.lastRefreshedAt = latestRefresh;
    }

    const newerProfile = (lRefresh > cRefresh ? localPlayer.playerProfile : cloudPlayer.playerProfile)
        || cloudPlayer.playerProfile
        || localPlayer.playerProfile
        || null;
    const olderProfile = (lRefresh > cRefresh ? cloudPlayer.playerProfile : localPlayer.playerProfile) || null;
    if (newerProfile && olderProfile && newerProfile.clan?.tag === olderProfile.clan?.tag) {
        mergedPlayer.playerProfile = {
            ...newerProfile,
            ...(newerProfile.clanWarStats ? {} : (olderProfile.clanWarStats ? { clanWarStats: olderProfile.clanWarStats } : {})),
            ...(newerProfile.cwlSeasons ? {} : (olderProfile.cwlSeasons ? { cwlSeasons: olderProfile.cwlSeasons } : {})),
            ...(newerProfile.lastCwlFetchTime ? {} : (olderProfile.lastCwlFetchTime ? { lastCwlFetchTime: olderProfile.lastCwlFetchTime } : {}))
        };
    } else {
        mergedPlayer.playerProfile = newerProfile;
    }

    const lOnboard = typeof localPlayer.onboardingTimestamp === 'number' ? localPlayer.onboardingTimestamp : 0;
    const cOnboard = typeof cloudPlayer.onboardingTimestamp === 'number' ? cloudPlayer.onboardingTimestamp : 0;
    mergedPlayer.onboardingTimestamp = Math.max(lOnboard, cOnboard) > 0 ? Math.max(lOnboard, cOnboard) : null;

    return { mergedPlayer, hasLocalNewer, hasCloudNewer };
}

/**
 * Merges full local and cloud application states using slice-level LWW resolution.
 *
 * @param {Record<string, any>} localData - Local application state.
 * @param {Record<string, any>} cloudData - Cloud application state.
 * @returns {{ mergedState: Record<string, any>, hasLocalNewer: boolean, hasCloudNewer: boolean }}
 */
export function mergeAppStatesLWW(localData, cloudData) {
    const rawCloudTime = new Date(cloudData?.timestamp || 0).getTime();
    const rawLocalTime = new Date(localData?.timestamp || 0).getTime();
    const cloudMs = Number.isFinite(rawCloudTime) ? rawCloudTime : 0;
    const localMs = Number.isFinite(rawLocalTime) ? rawLocalTime : 0;
    const cloudIsNewerRoot = cloudMs >= localMs;

    let hasLocalNewer = false;
    let hasCloudNewer = false;

    const primaryTagsSource = cloudIsNewerRoot
        ? (Array.isArray(cloudData?.savedPlayerTags) && cloudData.savedPlayerTags.length > 0 ? cloudData.savedPlayerTags : localData?.savedPlayerTags)
        : (Array.isArray(localData?.savedPlayerTags) && localData.savedPlayerTags.length > 0 ? localData.savedPlayerTags : cloudData?.savedPlayerTags);

    const savedPlayerTags = (Array.isArray(primaryTagsSource) ? primaryTagsSource : [])
        .map(normalizePlayerTag)
        .filter(t => t && t !== 'DEFAULT0');

    const localTagsClean = (Array.isArray(localData?.savedPlayerTags) ? localData.savedPlayerTags : [])
        .map(normalizePlayerTag)
        .filter(t => t && t !== 'DEFAULT0');
    const cloudTagsClean = (Array.isArray(cloudData?.savedPlayerTags) ? cloudData.savedPlayerTags : [])
        .map(normalizePlayerTag)
        .filter(t => t && t !== 'DEFAULT0');

    if (JSON.stringify(localTagsClean) !== JSON.stringify(cloudTagsClean)) {
        if (cloudIsNewerRoot) {
            hasCloudNewer = true;
        } else {
            hasLocalNewer = true;
        }
    }

    /** @type {Record<string, any>} */
    const mergedAllPlayers = {};
    const allTagKeys = new Set([
        ...savedPlayerTags,
        ...Object.keys(cloudData?.allPlayersData || {}).map(normalizePlayerTag),
        ...Object.keys(localData?.allPlayersData || {}).map(normalizePlayerTag)
    ]);

    for (const cleanTag of allTagKeys) {
        if (!cleanTag || cleanTag === 'DEFAULT0') continue;
        if (savedPlayerTags.length > 0 && !savedPlayerTags.includes(cleanTag)) continue;

        const lPlayer = localData?.allPlayersData?.[cleanTag] || localData?.allPlayersData?.[`#${cleanTag}`] || null;
        const cPlayer = cloudData?.allPlayersData?.[cleanTag] || cloudData?.allPlayersData?.[`#${cleanTag}`] || null;

        const { mergedPlayer, hasLocalNewer: pLocalNewer, hasCloudNewer: pCloudNewer } = mergePlayerPartitionsLWW(
            lPlayer,
            cPlayer,
            localMs,
            cloudMs
        );
        mergedAllPlayers[cleanTag] = mergedPlayer;
        if (pLocalNewer) hasLocalNewer = true;
        if (pCloudNewer) hasCloudNewer = true;
    }

    const lUiTime = Number(localData?.uiSettings?.updatedAt ?? localMs) || 0;
    const cUiTime = Number(cloudData?.uiSettings?.updatedAt ?? cloudMs) || 0;
    let mergedUiSettings;
    if (lUiTime > cUiTime) {
        mergedUiSettings = { ...(cloudData?.uiSettings || {}), ...(localData?.uiSettings || {}), updatedAt: lUiTime };
        if (serializeUiSettings(localData?.uiSettings) !== serializeUiSettings(cloudData?.uiSettings)) {
            hasLocalNewer = true;
        }
    } else if (cUiTime > lUiTime) {
        mergedUiSettings = { ...(localData?.uiSettings || {}), ...(cloudData?.uiSettings || {}), updatedAt: cUiTime };
        if (serializeUiSettings(localData?.uiSettings) !== serializeUiSettings(cloudData?.uiSettings)) {
            hasCloudNewer = true;
        }
    } else {
        mergedUiSettings = cloudIsNewerRoot
            ? { ...(localData?.uiSettings || {}), ...(cloudData?.uiSettings || {}) }
            : { ...(cloudData?.uiSettings || {}), ...(localData?.uiSettings || {}) };
        if (Math.max(lUiTime, cUiTime) > 0) {
            mergedUiSettings.updatedAt = Math.max(lUiTime, cUiTime);
        }
    }

    const activePlayer = savedPlayerTags[0] ? mergedAllPlayers[savedPlayerTags[0]] : null;
    if (activePlayer?.currency?.code && mergedUiSettings) {
        mergedUiSettings.currency = {
            ...(mergedUiSettings.currency || {}),
            code: activePlayer.currency.code
        };
    }

    const latestMs = Math.max(localMs, cloudMs);
    const resolvedTimestamp = latestMs > 0
        ? (cloudMs >= localMs ? (cloudData?.timestamp || new Date(latestMs).toISOString()) : (localData?.timestamp || new Date(latestMs).toISOString()))
        : new Date().toISOString();

    const mergedState = {
        ...(cloudIsNewerRoot ? localData : cloudData),
        ...(cloudIsNewerRoot ? cloudData : localData),
        appVersion: cloudData?.appVersion || localData?.appVersion || '3.1.0',
        timestamp: resolvedTimestamp,
        savedPlayerTags,
        uiSettings: mergedUiSettings,
        allPlayersData: mergedAllPlayers
    };

    return { mergedState, hasLocalNewer, hasCloudNewer };
}
