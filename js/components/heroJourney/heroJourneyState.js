import { safeJsonParse } from '../../utils/jsonUtils.js';
import {
    formatDisplayTag,
    getPlayerStorageKey,
    normalizePlayerTag,
    PLAYER_PREFIX,
    PLAYER_TAGS_KEY
} from '../../core/localStorageManager.js';
import {
    addRecentSearch
} from '../../core/recentSearchesManager.js';

/**
 * @typedef {Object} StandaloneHJState
 * @property {string} activeTag
 * @property {any} playerData
 * @property {number} cumulativeLevel
 * @property {number} thLevel
 * @property {boolean} unclaimedOnly
 * @property {string} typeFilter
 * @property {string} searchQuery
 * @property {boolean} isAccelerated
 * @property {boolean} isLoading
 * @property {string} errorMessage
 * @property {boolean} showTable
 * @property {boolean} [tableMaximized]
 * @property {boolean} revealBeyondTH
 */

/**
 * Global state object for the standalone Hero Journey page.
 * @type {StandaloneHJState}
 */
export const hjState = {
    activeTag: '',
    playerData: null,
    cumulativeLevel: 0,
    thLevel: 17,
    unclaimedOnly: false,
    typeFilter: 'all',
    searchQuery: '',
    isAccelerated: false,
    isLoading: false,
    errorMessage: '',
    showTable: true,
    tableMaximized: false,
    revealBeyondTH: false
};

/**
 * Calculates cumulative hero level from API player response.
 * @param {Object | null} playerData - Player data payload from backend API.
 * @returns {number} Cumulative hero level.
 */
export function computePlayerCumulativeLevel(playerData) {
    if (!playerData || !Array.isArray(playerData.heroes)) return 0;
    const activeHeroes = ['Barbarian King', 'Archer Queen', 'Grand Warden', 'Royal Champion', 'Minion Prince', 'Dragon Duke'];
    let total = 0;
    for (const hero of playerData.heroes) {
        if (activeHeroes.includes(hero.name) && Number.isFinite(hero.level)) {
            total += hero.level;
        }
    }
    return total;
}

/**
 * Parses URL query params or hash for initial player tag.
 * @returns {string} Cleaned player tag if present (without '#' or '%23').
 */
export function getTagFromUrl() {
    if (typeof window === 'undefined' || !window.location) return '';
    try {
        const params = new URLSearchParams(window.location.search);
        const tagParam = params.get('tag') || params.get('p') || window.location.hash.replace(/^#+/, '');
        if (!tagParam) return '';
        return tagParam.trim().replace(/^#+/, '').toUpperCase();
    } catch {
        return '';
    }
}

/**
 * Updates URL search parameter with clean active tag without reloading or '%23' escaping.
 * @param {string} tag - Tag to set in URL.
 */
export function updateUrlTag(tag) {
    if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
    try {
        const cleanTag = normalizePlayerTag(tag);
        const url = new URL(window.location.href);
        if (!url.pathname.endsWith('/') && !url.pathname.includes('.')) {
            url.pathname = `${url.pathname}/`;
        }
        if (cleanTag && cleanTag !== 'DEFAULT0') {
            url.searchParams.set('tag', cleanTag);
        } else {
            url.searchParams.delete('tag');
            url.searchParams.delete('p');
        }
        const newRelativeUrl = url.pathname + (url.search ? url.search : '') + url.hash;
        const currentRelativeUrl = window.location.pathname + window.location.search + window.location.hash;
        if (currentRelativeUrl !== newRelativeUrl) {
            window.history.replaceState({}, '', newRelativeUrl);
        }
    } catch {}
}

/**
 * Constructs an AppState-compatible state object from the active player data.
 * @param {Object | null} playerData - API player data object.
 * @param {StandaloneHJState} state - Standalone Hero Journey state.
 * @returns {import('../../core/types.js').AppState | Object} AppState slice.
 */
export function buildStateFromPlayerData(playerData, state) {
    const cleanTag = normalizePlayerTag(playerData?.tag);
    let savedPartition = null;
    if (cleanTag) {
        try {
            const canonicalKey = getPlayerStorageKey(cleanTag);
            let savedStr = localStorage.getItem(canonicalKey);
            if (!savedStr) {
                const legacyKey = `${PLAYER_PREFIX}#${cleanTag}`;
                savedStr = localStorage.getItem(legacyKey);
                if (savedStr) {
                    try {
                        localStorage.setItem(canonicalKey, savedStr);
                        localStorage.removeItem(legacyKey);
                    } catch {}
                }
            }
            savedPartition = safeJsonParse(savedStr, null);
        } catch {}
    }

    const isAccelerated = typeof state?.isAccelerated === 'boolean'
        ? state.isAccelerated
        : Boolean(savedPartition?.heroJourney?.acceleratedRewards);

    const revealBeyondTH = typeof state?.revealBeyondTH === 'boolean'
        ? state.revealBeyondTH
        : Boolean(savedPartition?.heroJourney?.revealBeyondTH);

    const typeFilter = state?.typeFilter || savedPartition?.heroJourney?.typeFilter || 'all';
    const unclaimedOnly = typeof state?.unclaimedOnly === 'boolean'
        ? state.unclaimedOnly
        : Boolean(savedPartition?.heroJourney?.unclaimedOnly);

    const showTable = typeof state?.showTable === 'boolean'
        ? state.showTable
        : (typeof savedPartition?.heroJourney?.showTable === 'boolean' ? savedPartition.heroJourney.showTable : true);

    const homeHeroes = playerData?.heroes?.filter(h => h.village === 'home' || !h.village) || [];
    const homeEquipment = playerData?.heroEquipment?.filter(e => e.village === 'home' || !e.village) || [];

    const ownedHeroes = Object.fromEntries(
        homeHeroes.map(h => [h.name, {
            level: h.level,
            maxLevel: h.maxLevel,
            equipment: h.equipment?.map(eq => ({ name: eq.name, level: eq.level })) || []
        }])
    );

    const ownedEquipment = Object.fromEntries(
        homeEquipment.map(e => [e.name, e.level])
    );

    const thLevel = Math.min(Math.max(Number(playerData?.townHallLevel) || Number(state?.thLevel) || 16, 1), 18);

    const playerProfile = cleanTag ? {
        name: playerData?.name || '',
        townHall: thLevel,
        townHallLevel: thLevel,
        tag: cleanTag,
        ownedHeroes,
        ownedEquipment
    } : null;

    return {
        playerProfile,
        townHall: thLevel,
        heroes: ownedHeroes,
        equipment: ownedEquipment,
        heroJourney: {
            acceleratedRewards: isAccelerated,
            revealBeyondTH,
            hidden: Boolean(savedPartition?.heroJourney?.hidden)
        },
        allPlayersData: cleanTag && playerProfile ? {
            [cleanTag]: {
                playerProfile
            }
        } : {},
        savedPlayerTags: cleanTag ? [cleanTag] : []
    };
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
 * Retrieves list of saved player profile summaries from localStorage.
 * @returns {SavedProfileSummary[]} Array of saved profiles.
 */
export function getSavedProfiles() {
    try {
        const tagsStr = localStorage.getItem(PLAYER_TAGS_KEY);
        const tags = safeJsonParse(tagsStr, []);
        const tagList = Array.isArray(tags) ? [...tags] : [];

        const seenTags = new Set();
        const summaries = [];
        for (const rawTag of tagList) {
            if (!rawTag || rawTag === 'DEFAULT0') continue;
            const cleanTag = normalizePlayerTag(rawTag);
            if (!cleanTag || cleanTag === 'DEFAULT0' || seenTags.has(cleanTag)) continue;
            seenTags.add(cleanTag);

            const canonicalKey = getPlayerStorageKey(cleanTag);
            let playerStr = localStorage.getItem(canonicalKey);
            if (!playerStr) {
                const legacyKey = `${PLAYER_PREFIX}#${cleanTag}`;
                playerStr = localStorage.getItem(legacyKey);
                if (playerStr) {
                    try {
                        localStorage.setItem(canonicalKey, playerStr);
                        localStorage.removeItem(legacyKey);
                    } catch {}
                }
            }
            const playerData = safeJsonParse(playerStr, null);
            const profile = playerData?.playerProfile || playerData?.playerData || null;

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
        return summaries;
    } catch {
        return [];
    }
}

/**
 * Saves or updates a fetched player profile in localStorage if it exists or is saved.
 * @param {Object} playerData - Live player data payload.
 * @param {StandaloneHJState} [state=hjState] - Current standalone state.
 */
export function syncPlayerToStorage(playerData, state = hjState) {
    if (!playerData || !playerData.tag) return;
    const cleanTag = normalizePlayerTag(playerData.tag);
    if (!cleanTag || cleanTag === 'DEFAULT0') return;
    try {
        const canonicalKey = getPlayerStorageKey(cleanTag);
        const legacyKey = `${PLAYER_PREFIX}#${cleanTag}`;
        const existingStr = localStorage.getItem(canonicalKey) || localStorage.getItem(legacyKey);
        const existing = safeJsonParse(existingStr, {});
        const homeHeroes = playerData.heroes?.filter(h => h.village === 'home' || !h.village) || [];
        const homeEquipment = playerData.heroEquipment?.filter(e => e.village === 'home' || !e.village) || [];

        existing.playerProfile = {
            ...playerData,
            tag: cleanTag,
            ownedHeroes: Object.fromEntries(homeHeroes.map(h => [h.name, {
                level: h.level,
                maxLevel: h.maxLevel,
                equipment: h.equipment?.map(eq => ({ name: eq.name, level: eq.level })) || []
            }])),
            ownedEquipment: Object.fromEntries(homeEquipment.map(e => [e.name, e.level]))
        };
        existing.heroJourney = {
            acceleratedRewards: Boolean(state.isAccelerated),
            revealBeyondTH: state.revealBeyondTH ?? false,
            hidden: Boolean(existing.heroJourney?.hidden)
        };

        localStorage.setItem(canonicalKey, JSON.stringify(existing));
        localStorage.removeItem(legacyKey);

        const tagsStr = localStorage.getItem(PLAYER_TAGS_KEY);
        const tags = safeJsonParse(tagsStr, []);
        const isSaved = Array.isArray(tags) && tags.some(t => normalizePlayerTag(t) === cleanTag);

        if (!isSaved) {
            addRecentSearch({
                ...playerData,
                tag: cleanTag
            });
        }
    } catch {}
}
