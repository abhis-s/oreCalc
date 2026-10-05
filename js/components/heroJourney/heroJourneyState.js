import { MAX_SAVED_PLAYERS } from '../../core/constants.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { sanitizePlayerProfile } from '../../core/playerStorageSanitizer.js';
import {
    CANONICAL_PLAYER_PREFIX,
    CANONICAL_PLAYER_TAGS_KEY,
    getActivePlayerTagsKey,
    getActiveUserId,
    getPlayerStorageKey,
    isClashCalcHost,
    normalizePlayerTag,
    PLAYER_PREFIX,
    PLAYER_TAGS_KEY
} from '../../core/storageKeys.js';
import { saveSinglePlayerData } from '../../services/apiService.js';
import { getPlayerTagFromUrl, syncPlayerTagToUrl } from '../../core/playerUrlRouter.js';

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
    thLevel: 18,
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
 * Calculates cumulative hero level from API player response or stored partition.
 * @param {Object | null} playerData - Player data payload from backend API or localStorage.
 * @returns {number} Cumulative hero level.
 */
export function computePlayerCumulativeLevel(playerData) {
    if (!playerData || typeof playerData !== 'object') return 0;
    const activeHeroes = ['Barbarian King', 'Archer Queen', 'Grand Warden', 'Royal Champion', 'Minion Prince', 'Dragon Duke'];
    let total = 0;

    if (Array.isArray(playerData.heroes)) {
        for (const hero of playerData.heroes) {
            if (hero && activeHeroes.includes(hero.name) && Number.isFinite(hero.level)) {
                total += Number(hero.level) || 0;
            }
        }
        if (total > 0) return total;
    }

    const ownedMap = playerData.ownedHeroes || playerData.playerProfile?.ownedHeroes;
    if (ownedMap && typeof ownedMap === 'object' && !Array.isArray(ownedMap)) {
        for (const heroName of activeHeroes) {
            const h = ownedMap[heroName];
            if (h !== undefined && h !== null) {
                const lvl = typeof h === 'object' ? Number(h.level) : Number(h);
                if (Number.isFinite(lvl)) {
                    total += lvl;
                }
            }
        }
        if (total > 0) return total;
    }

    if (playerData.heroes && typeof playerData.heroes === 'object' && !Array.isArray(playerData.heroes)) {
        for (const heroName of activeHeroes) {
            const h = playerData.heroes[heroName];
            if (h !== undefined && h !== null) {
                const lvl = typeof h === 'object' ? Number(h.level) : Number(h);
                if (Number.isFinite(lvl)) {
                    total += lvl;
                }
            }
        }
        if (total > 0) return total;
    }

    const tag = playerData.tag || playerData.playerProfile?.tag;
    if (tag) {
        const cleanTag = normalizePlayerTag(tag);
        if (cleanTag && cleanTag !== 'DEFAULT0') {
            try {
                const canonicalKey = getPlayerStorageKey(cleanTag);
                const raw = localStorage.getItem(canonicalKey) || localStorage.getItem(`${PLAYER_PREFIX}#${cleanTag}`);
                if (raw) {
                    const parsed = safeJsonParse(raw, null);
                    if (parsed && parsed !== playerData) {
                        return computePlayerCumulativeLevel(parsed.playerProfile || parsed);
                    }
                }
            } catch (_) {}
        }
    }

    return total;
}

/**
 * Parses URL query params for initial player tag.
 * @returns {string} Cleaned player tag if present (without '#' or '%23').
 */
export function getTagFromUrl() {
    return getPlayerTagFromUrl() || '';
}

/**
 * Updates URL search parameter with clean active tag without reloading or '%23' escaping.
 * @param {string} tag - Tag to set in URL.
 */
export function updateUrlTag(tag) {
    syncPlayerTagToUrl(tag);
}

/**
 * Constructs an AppState-compatible state object from the active player data.
 * @param {Object | null} playerData - API player data object or stored playerProfile.
 * @param {StandaloneHJState} state - Standalone Hero Journey state.
 * @returns {import('../../core/types.js').AppState | Object} AppState slice.
 */
export function buildStateFromPlayerData(playerData, state) {
    const cleanTag = normalizePlayerTag(playerData?.tag || state?.activeTag);
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

    let ownedHeroes = {};
    if (Array.isArray(playerData?.heroes)) {
        const homeHeroes = playerData.heroes.filter(h => h && (h.village === 'home' || !h.village));
        ownedHeroes = Object.fromEntries(
            homeHeroes.map(h => [h.name, {
                level: h.level,
                maxLevel: h.maxLevel,
                equipment: h.equipment?.map(eq => ({ name: eq.name, level: eq.level })) || []
            }])
        );
    } else if (playerData?.ownedHeroes && typeof playerData.ownedHeroes === 'object') {
        ownedHeroes = playerData.ownedHeroes;
    } else if (savedPartition?.playerProfile?.ownedHeroes && typeof savedPartition.playerProfile.ownedHeroes === 'object') {
        ownedHeroes = savedPartition.playerProfile.ownedHeroes;
    } else if (savedPartition?.heroes && typeof savedPartition.heroes === 'object') {
        ownedHeroes = Object.fromEntries(
            Object.entries(savedPartition.heroes).map(([name, h]) => [name, {
                level: h.level ?? 1,
                maxLevel: h.maxLevel ?? 100,
                equipment: h.equipment ? Object.entries(h.equipment).map(([eqName, eq]) => ({
                    name: eqName,
                    level: typeof eq === 'object' ? eq.level : eq
                })) : []
            }])
        );
    } else if (playerData?.heroes && typeof playerData.heroes === 'object') {
        ownedHeroes = Object.fromEntries(
            Object.entries(playerData.heroes).map(([name, h]) => [name, {
                level: h.level ?? 1,
                maxLevel: h.maxLevel ?? 100,
                equipment: h.equipment ? Object.entries(h.equipment).map(([eqName, eq]) => ({
                    name: eqName,
                    level: typeof eq === 'object' ? eq.level : eq
                })) : []
            }])
        );
    }

    let ownedEquipment = {};
    if (Array.isArray(playerData?.heroEquipment)) {
        const homeEquipment = playerData.heroEquipment.filter(e => e && (e.village === 'home' || !e.village));
        ownedEquipment = Object.fromEntries(
            homeEquipment.map(e => [e.name, e.level])
        );
    } else if (playerData?.ownedEquipment && typeof playerData.ownedEquipment === 'object') {
        ownedEquipment = playerData.ownedEquipment;
    } else if (savedPartition?.playerProfile?.ownedEquipment && typeof savedPartition.playerProfile.ownedEquipment === 'object') {
        ownedEquipment = savedPartition.playerProfile.ownedEquipment;
    } else if (savedPartition?.heroes && typeof savedPartition.heroes === 'object') {
        const extracted = {};
        for (const heroName in savedPartition.heroes) {
            const h = savedPartition.heroes[heroName];
            if (h?.equipment && typeof h.equipment === 'object') {
                for (const eqName in h.equipment) {
                    const eq = h.equipment[eqName];
                    extracted[eqName] = typeof eq === 'object' ? (eq.level || 1) : (eq || 1);
                }
            }
        }
        ownedEquipment = extracted;
    }

    const thLevel = Math.min(Math.max(
        Number(playerData?.townHallLevel) ||
        Number(playerData?.townHall) ||
        Number(savedPartition?.playerProfile?.townHallLevel) ||
        Number(state?.thLevel) ||
        18,
        1
    ), 18);

    const playerProfile = cleanTag ? {
        name: playerData?.name || savedPartition?.playerProfile?.name || '',
        townHall: thLevel,
        townHallLevel: thLevel,
        tag: cleanTag,
        ownedHeroes,
        ownedEquipment,
        clan: playerData?.clan || savedPartition?.playerProfile?.clan || null,
        leagueTier: playerData?.leagueTier || savedPartition?.playerProfile?.leagueTier || null,
        trophies: playerData?.trophies ?? savedPartition?.playerProfile?.trophies ?? 0
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

        existing.playerProfile = sanitizePlayerProfile(playerData);
        existing.heroJourney = {
            acceleratedRewards: Boolean(state.isAccelerated),
            revealBeyondTH: state.revealBeyondTH ?? false,
            hidden: Boolean(existing.heroJourney?.hidden)
        };

        try {
            const targetKey = getActivePlayerTagsKey();
            const fallbackKey = isClashCalcHost() ? PLAYER_TAGS_KEY : CANONICAL_PLAYER_TAGS_KEY;
            const rawStr = localStorage.getItem(targetKey) || localStorage.getItem(fallbackKey);
            const list = safeJsonParse(rawStr, []);
            const tags = Array.isArray(list) ? list.map(normalizePlayerTag).filter(t => t && t !== 'DEFAULT0') : [];
            const filtered = tags.filter(t => t !== cleanTag);
            filtered.unshift(cleanTag);
            if (filtered.length > MAX_SAVED_PLAYERS) {
                const poppedTag = filtered.pop();
                if (poppedTag) {
                    const cleanPopped = normalizePlayerTag(poppedTag);
                    localStorage.removeItem(getPlayerStorageKey(cleanPopped, CANONICAL_PLAYER_PREFIX));
                    localStorage.removeItem(getPlayerStorageKey(cleanPopped, PLAYER_PREFIX));
                    localStorage.removeItem(`${CANONICAL_PLAYER_PREFIX}#${cleanPopped}`);
                    localStorage.removeItem(`${PLAYER_PREFIX}#${cleanPopped}`);
                }
            }
            localStorage.setItem(targetKey, JSON.stringify(filtered));
            if (fallbackKey && localStorage.getItem(fallbackKey)) {
                localStorage.setItem(fallbackKey, JSON.stringify(filtered));
            }
        } catch {}

        localStorage.setItem(canonicalKey, JSON.stringify(existing));
        localStorage.removeItem(legacyKey);

        const userId = getActiveUserId();
        if (userId) {
            saveSinglePlayerData(userId, cleanTag, existing).catch(() => {});
        }
    } catch {}
}
