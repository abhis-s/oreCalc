import { handleStateUpdate } from '../app.js';
import { state, getDefaultPlayerState } from '../core/state.js';
import { updateSavedPlayerTags, updateAllPlayersData } from '../core/localStorageManager.js';

import { showAddPlayerModal } from '../components/player/playerModal.js';

import { cleanupUpgradePlan, reindexGlobalPriority } from '../utils/plannerUtils.js';
import { shopOfferData, leagueTiers, heroData } from '../data/appData.js';
import { translate } from '../i18n/translator.js';

import { fetchPlayerData } from './apiService.js';

export async function loadAndProcessPlayerData(playerTag, { verifyToken = null, timeoutMs = null, updateOrder = true } = {}) {
    if (!playerTag || playerTag.trim() === '') {
        return { success: false, message: translate('errors.playerTagRequired'), isNetworkError: false };
    }

    try {
        const playerData = await fetchPlayerData(playerTag, verifyToken, timeoutMs);

        
        if (!playerData || !playerData.tag) {
            throw new Error('errors.invalidServerData');
        }
        
        const cleanedServerTag = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;

        handleStateUpdate(() => {
            if (playerTag !== cleanedServerTag) {
                console.warn(`Player tag corrected: Original '${playerTag}', Corrected '${cleanedServerTag}'`);
            }
            processPlayerDataResponse(playerData, { updateOrder });
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to load player data:', error);
        
        const errorKey = error.message;
        const errorMessage = translate(errorKey);

        // Network-level failures: timeout, server errors (5xx), or no network at all.
        // These indicate the API itself may be down — count toward circuit-breaker.
        // 4xx errors mean the API is healthy but rejected this specific request.
        const isNetworkError =
            errorKey === 'apiErrors.timeout' ||
            errorKey === 'apiErrors.500' ||
            errorKey === 'apiErrors.503' ||
            errorKey === 'apiErrors.inMaintenance' ||
            errorKey === 'apiErrors.serverOffline' ||
            errorKey === 'apiErrors.offline' ||
            error.name === 'TypeError'; // Failed to fetch (no network)

        // Special handling for protected tags found during refresh/load
        if (errorKey === 'apiErrors.protectedTag' || errorKey === 'apiErrors.invalidToken') {
            return { success: false, message: errorMessage, errorType: errorKey, isNetworkError: false };
        }

        return { success: false, message: translate('errors.fetchPlayerFailed', { error: errorMessage }), isNetworkError };
    }
}

export function processPlayerDataResponse(playerData, { updateOrder = true } = {}) {
    const cleanedTag = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;

    if (updateOrder) {
        // Explicit add or selection: move this player to the front of the list.
        // This also calls saveState, so only do it when the player's globals are
        // about to be set correctly (i.e., on intentional user actions).
        updateSavedPlayerTags(cleanedTag);
    } else {
        // Background refresh: player already exists in the list — don't reorder
        // and don't trigger a premature saveState with stale global state.
        if (!state.savedPlayerTags.includes(cleanedTag)) {
            state.savedPlayerTags.push(cleanedTag);
        }
    }

    let basePlayerState;
    if (state.allPlayersData[cleanedTag]) {
        basePlayerState = JSON.parse(JSON.stringify(state.allPlayersData[cleanedTag]));
    } else {
        basePlayerState = getDefaultPlayerState();
    }

    const newPlayerState = {
        ...basePlayerState,
        playerProfile: null,
    };

    const isInitialLoadForBase = !basePlayerState.playerProfile;
    const rawOwnedHeroes = basePlayerState.playerProfile?.ownedHeroes;
    let previousSyncedHeroes;
    if (Array.isArray(rawOwnedHeroes)) {
        previousSyncedHeroes = new Set(rawOwnedHeroes);
    } else if (rawOwnedHeroes && typeof rawOwnedHeroes === 'object') {
        previousSyncedHeroes = new Set(Object.keys(rawOwnedHeroes));
    } else {
        previousSyncedHeroes = new Set();
    }
    
    let previousSyncedEquipment;
    const rawOwned = basePlayerState.playerProfile?.ownedEquipment;
    if (Array.isArray(rawOwned)) {
        previousSyncedEquipment = new Set(rawOwned);
    } else if (rawOwned && typeof rawOwned === 'object') {
        previousSyncedEquipment = new Set(Object.keys(rawOwned));
    } else {
        previousSyncedEquipment = new Set();
    }

    const homeHeroes = playerData.heroes?.filter(h => h.village === 'home') || [];
    const homeEquipment = playerData.heroEquipment?.filter(e => e.village === 'home') || [];

    const serverHeroMap = new Map(homeHeroes.map(hero => [hero.name, hero]));
    const serverEquipMap = new Map(homeEquipment.map(eq => [eq.name, eq]));

    for (const heroKey in heroData) {
        const heroName = heroData[heroKey].name;
        const serverHero = serverHeroMap.get(heroName);
        const wasHeroPreviouslySynced = previousSyncedHeroes.has(heroName);

        if (!newPlayerState.heroes[heroName]) {
            newPlayerState.heroes[heroName] = { equipment: {} };
        }
        const heroState = newPlayerState.heroes[heroName];

        if (serverHero) {
            if (isInitialLoadForBase || !wasHeroPreviouslySynced) {
                heroState.enabled = true;
            } else {
                heroState.enabled = basePlayerState.heroes[heroName]?.enabled ?? true;
            }
        } else {
            if (isInitialLoadForBase) {
                heroState.enabled = false;
            } else {
                heroState.enabled = basePlayerState.heroes[heroName]?.enabled ?? false;
            }
        }

        const heroInfo = heroData[heroKey];
        for (const equip of heroInfo.equipment) {
            const equipKey = equip.name;
            const serverEquip = serverEquipMap.get(equipKey);
            const wasEquipPreviouslySynced = previousSyncedEquipment.has(equipKey);

            if (!heroState.equipment[equipKey]) {
                heroState.equipment[equipKey] = {};
            }
            const equipState = heroState.equipment[equipKey];

            if (serverEquip) {
                equipState.level = serverEquip.level;

                if (isInitialLoadForBase || !wasEquipPreviouslySynced) {
                    equipState.checked = true;
                } else {
                    equipState.checked = basePlayerState.heroes[heroName]?.equipment[equipKey]?.checked ?? true;
                }
            } else {
                if (isInitialLoadForBase) {
                    equipState.checked = false;
                } else {
                    equipState.checked = basePlayerState.heroes[heroName]?.equipment[equipKey]?.checked ?? false;
                }
            }
        }

        for (const equipKey in heroState.equipment) {
            cleanupUpgradePlan(heroState.equipment[equipKey]);
        }
    }

    const targetLeagueId = playerData.leagueTier?.id;
    if (targetLeagueId) {
        if (!newPlayerState.income.starBonus) newPlayerState.income.starBonus = {};
        const leagueExists = leagueTiers.items.some(l => l.id === targetLeagueId);
        if (leagueExists) {
            newPlayerState.income.starBonus.league = targetLeagueId;
        } else {
            newPlayerState.income.starBonus.league = 105000000; // Unranked
        }
    }

    const selected = newPlayerState.income.shopOffers?.selectedSet;
    if ((selected === undefined || selected === null) && playerData.townHallLevel) {
        const thLevel = playerData.townHallLevel;
        let bestMatchSet = '0';
        let closestTh = -1;

        for (const setKey in shopOfferData) {
            const set = shopOfferData[setKey];
            if (set.townHallLevel !== undefined && set.townHallLevel <= thLevel && set.townHallLevel > closestTh) {
                closestTh = set.townHallLevel;
                bestMatchSet = setKey;
            }
        }
        if (!newPlayerState.income.shopOffers) newPlayerState.income.shopOffers = {};
        newPlayerState.income.shopOffers.selectedSet = parseInt(bestMatchSet, 10);
        newPlayerState.income.shopOffers[bestMatchSet] = {};
    }

    newPlayerState.income.prospector = { 
        ...getDefaultPlayerState().income.prospector, 
        ...(newPlayerState.income.prospector || {}) 
    };

    const leagueObj = playerData.leagueTier ? {
        id: playerData.leagueTier.id,
        name: playerData.leagueTier.name || '',
        iconUrls: {
            small: playerData.leagueTier.iconUrls?.small || ''
        }
    } : null;

    newPlayerState.playerProfile = {
        name: playerData.name,
        tag: playerData.tag,
        townHallLevel: playerData.townHallLevel,
        clanBadgeUrl: playerData.clan?.badgeUrls?.small || '',
        clan: playerData.clan ? {
            tag: playerData.clan.tag,
            name: playerData.clan.name,
            badgeUrls: {
                small: playerData.clan.badgeUrls?.small || '',
                medium: playerData.clan.badgeUrls?.medium || '',
                large: playerData.clan.badgeUrls?.large || ''
            }
        } : null,
        role: playerData.role || null,
        leagueTier: leagueObj,
        trophies: playerData.trophies || 0,
        warStars: playerData.warStars || 0,
        ownedHeroes: Object.fromEntries(homeHeroes.map(h => [h.name, { 
            level: h.level, 
            maxLevel: h.maxLevel,
            equipment: h.equipment?.map(eq => ({ name: eq.name, level: eq.level })) || []
        }])),
        ownedEquipment: Object.fromEntries(homeEquipment.map(e => [e.name, e.level]))
    };

    const activePlayerTag = state.savedPlayerTags[0];
    if (cleanedTag === activePlayerTag) {
        state.heroes = newPlayerState.heroes;
        state.storedOres = newPlayerState.storedOres;
        state.income = newPlayerState.income;
        state.planner = newPlayerState.planner;
        state.playerProfile = newPlayerState.playerProfile;
        reindexGlobalPriority();
    }
    updateAllPlayersData(cleanedTag, newPlayerState);
}