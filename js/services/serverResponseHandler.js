import { heroData } from '../data/heroData.js';
import { shopOfferData } from '../data/incomeSources/shopOffers.js';
import { LAB_SCALING_TROOP_KEYS } from '../data/labTroopsData.js';
import { leagueTiers } from '../data/leagueTiers.js';
import { translate } from '../i18n/translator.js';

import { UNRANKED_LEAGUE_ID } from '../core/constants.js';
import { updateAllPlayersData, updateSavedPlayerTags } from '../core/localStorageManager.js';
import { getDefaultPlayerState, state } from '../core/state.js';
import { handleStateUpdate } from '../core/stateManager.js';

import { cleanupHeroJourneyOverrides, getDefaultEquipmentUnlockLevel, isHeroJourneyFutureOrUnclaimedEquipment } from '../domain/income/heroJourneyIncome.js';
import { cleanupUpgradePlan, reindexGlobalPriority } from '../utils/plannerUtils.js';

import { fetchPlayerData } from './apiService.js';

/**
 * Fetches remote player profile data and syncs equipment, heroes, and town hall state.
 *
 * @param {string} playerTag - Clash of Clans player tag.
 * @param {{ verifyToken?: string | null, timeoutMs?: number | null, updateOrder?: boolean }} [options={}] - Request options.
 * @returns {Promise<import('../core/types.js').ServerResponseResult>} Execution status and error metadata.
 */
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

        let errorKey = error.message;
        if (error.name === 'TypeError' || errorKey === 'Failed to fetch' || (typeof errorKey === 'string' && errorKey.includes('Failed to fetch'))) {
            errorKey = 'apiErrors.serverOffline';
        }
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

/**
 * Merges raw Supercell API response data into the active player state and allPlayersData cache.
 * @param {Record<string, any>} playerData - Raw player payload from Clash API proxy.
 * @param {{ updateOrder?: boolean }} [options={}] - Options controlling tag prioritization.
 */
export function processPlayerDataResponse(playerData, { updateOrder = true } = {}) {
    if (!playerData || typeof playerData !== 'object' || !playerData.tag) {
        console.warn('processPlayerDataResponse: Invalid or missing player data payload');
        return;
    }
    const cleanedTag = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;

    const guestData = state.allPlayersData['DEFAULT0']
        ? structuredClone(state.allPlayersData['DEFAULT0'])
        : (state.savedPlayerTags.includes('DEFAULT0') && state.storedOres ? {
            storedOres: structuredClone(state.storedOres),
            income: structuredClone(state.income),
            planner: structuredClone(state.planner),
            heroJourney: structuredClone(state.heroJourney || {}),
            currency: { code: state.uiSettings?.currency?.code || 'USD' }
        } : null);

    if (cleanedTag !== 'DEFAULT0') {
        state.savedPlayerTags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
        if (state.allPlayersData['DEFAULT0']) {
            delete state.allPlayersData['DEFAULT0'];
        }
        try {
            localStorage.removeItem('oreCalc_player_DEFAULT0');
        } catch (e) {}
    }

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
        basePlayerState = structuredClone(state.allPlayersData[cleanedTag]);
    } else if (guestData) {
        // Migrate non-API configurations from guest state
        basePlayerState = getDefaultPlayerState();
        if (guestData.storedOres) {
            basePlayerState.storedOres = structuredClone(guestData.storedOres);
        }
        if (guestData.income) {
            basePlayerState.income = structuredClone(guestData.income);
        }
        if (guestData.planner) {
            basePlayerState.planner = structuredClone(guestData.planner);
        }
        if (guestData.heroJourney) {
            basePlayerState.heroJourney = structuredClone(guestData.heroJourney);
        }
        if (guestData.currency) {
            basePlayerState.currency = structuredClone(guestData.currency);
        }
    } else {
        basePlayerState = getDefaultPlayerState();
    }

    const newPlayerState = {
        ...basePlayerState,
        playerProfile: null,
        onboardingTimestamp: typeof basePlayerState.onboardingTimestamp === 'number'
            ? basePlayerState.onboardingTimestamp
            : null
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
        ownedEquipment: Object.fromEntries(homeEquipment.map(e => [e.name, e.level])),
        labTroops: Object.fromEntries(
            (playerData.troops?.filter(t => t.village === 'home') || [])
                .filter(t => LAB_SCALING_TROOP_KEYS[t.name])
                .map(t => [LAB_SCALING_TROOP_KEYS[t.name], t.level])
        )
    };

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
            heroState.level = serverHero.level;
            heroState.maxLevel = serverHero.maxLevel;
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
                const wasChecked = basePlayerState.heroes[heroName]?.equipment[equipKey]?.checked;
                equipState.checked = isInitialLoadForBase ? false : (wasChecked ?? false);

                const isFutureOrUnclaimed = isHeroJourneyFutureOrUnclaimedEquipment(heroKey, equipKey, newPlayerState);
                if (isFutureOrUnclaimed && !equipState.checked) {
                    equipState.level = getDefaultEquipmentUnlockLevel(heroKey, equipKey);
                } else {
                    equipState.level = basePlayerState.heroes[heroName]?.equipment[equipKey]?.level ?? 1;
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
            newPlayerState.income.starBonus.league = UNRANKED_LEAGUE_ID;
        }
    }

    const selected = newPlayerState.income.shopOffers?.selectedSet;
    if (selected !== 0 && playerData.townHallLevel) {
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
        if (!newPlayerState.income.shopOffers[bestMatchSet]) {
            newPlayerState.income.shopOffers[bestMatchSet] = {};
        }
    }

    const defaultIncome = getDefaultPlayerState().income;
    newPlayerState.income = {
        ...defaultIncome,
        ...(newPlayerState.income || {}),
        shopOffers: {
            ...defaultIncome.shopOffers,
            ...(newPlayerState.income?.shopOffers || {}),
            purchases: { ...(newPlayerState.income?.shopOffers?.purchases || {}) }
        },
        raidMedals: {
            ...defaultIncome.raidMedals,
            ...(newPlayerState.income?.raidMedals || {}),
            packs: { ...defaultIncome.raidMedals.packs, ...(newPlayerState.income?.raidMedals?.packs || {}) }
        },
        gems: {
            ...defaultIncome.gems,
            ...(newPlayerState.income?.gems || {}),
            packs: { ...defaultIncome.gems.packs, ...(newPlayerState.income?.gems?.packs || {}) }
        },
        eventPass: {
            ...defaultIncome.eventPass,
            ...(newPlayerState.income?.eventPass || {}),
            trader: {
                ...defaultIncome.eventPass.trader,
                ...(newPlayerState.income?.eventPass?.trader || {}),
                packs: { ...defaultIncome.eventPass.trader.packs, ...(newPlayerState.income?.eventPass?.trader?.packs || {}) }
            }
        },
        eventTrader: {
            ...defaultIncome.eventTrader,
            ...(newPlayerState.income?.eventTrader || {}),
            packs: { ...defaultIncome.eventTrader.packs, ...(newPlayerState.income?.eventTrader?.packs || {}) }
        },
        clanWar: {
            ...defaultIncome.clanWar,
            ...(newPlayerState.income?.clanWar || newPlayerState.income?.clanWars || {}),
            oresPerAttack: { ...defaultIncome.clanWar.oresPerAttack, ...(newPlayerState.income?.clanWar?.oresPerAttack || newPlayerState.income?.clanWars?.oresPerAttack || {}) }
        },
        cwl: {
            ...defaultIncome.cwl,
            ...(newPlayerState.income?.cwl || {}),
            oresPerAttack: { ...defaultIncome.cwl.oresPerAttack, ...(newPlayerState.income?.cwl?.oresPerAttack || {}) }
        },
        supercellEvents: {
            ...defaultIncome.supercellEvents,
            ...(newPlayerState.income?.supercellEvents || {})
        },
        starBonus: {
            ...defaultIncome.starBonus,
            ...(newPlayerState.income?.starBonus || {})
        },
        prospector: {
            ...defaultIncome.prospector,
            ...(newPlayerState.income?.prospector || {})
        }
    };

    const activePlayerTag = state.savedPlayerTags[0];
    if (cleanedTag === activePlayerTag) {
        state.heroes = newPlayerState.heroes;
        state.storedOres = newPlayerState.storedOres;
        state.income = newPlayerState.income;
        state.planner = newPlayerState.planner;
        state.playerProfile = newPlayerState.playerProfile;
        state.heroJourney = newPlayerState.heroJourney || { overrideUnclaimed: [], acceleratedRewards: false };
        state.heroJourney.overrideUnclaimed = cleanupHeroJourneyOverrides(state);
        reindexGlobalPriority();
    }
    if (newPlayerState.heroJourney) {
        newPlayerState.heroJourney.overrideUnclaimed = cleanupHeroJourneyOverrides(newPlayerState);
    }
    updateAllPlayersData(cleanedTag, newPlayerState);
}
