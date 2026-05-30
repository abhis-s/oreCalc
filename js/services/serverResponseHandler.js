import { state, getDefaultPlayerState } from '../core/state.js';
import { shopOfferData, leagueTiers, heroData } from '../data/appData.js';
import { fetchPlayerData } from './apiService.js';
import { handleStateUpdate } from '../app.js';
import { updateSavedPlayerTags, updateAllPlayersData } from '../core/localStorageManager.js';
import { translate } from '../i18n/translator.js';
import { cleanupUpgradePlan, reindexGlobalPriority } from '../utils/plannerUtils.js';

import { showAddPlayerModal } from '../components/player/playerModal.js';

export async function loadAndProcessPlayerData(playerTag, { verifyToken = null } = {}) {
    if (!playerTag || playerTag.trim() === '') {
        return { success: false, message: translate('errors.playerTagRequired') };
    }

    try {
        const playerData = await fetchPlayerData(playerTag, verifyToken);
        
        if (!playerData || !playerData.tag) {
            throw new Error('errors.invalidServerData');
        }
        
        const cleanedServerTag = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;

        handleStateUpdate(() => {
            if (playerTag !== cleanedServerTag) {
                console.warn(`Player tag corrected: Original '${playerTag}', Corrected '${cleanedServerTag}'`);
            }
            processPlayerDataResponse(playerData);
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to load player data:', error);
        
        const errorMessage = translate(error.message);

        // Special handling for protected tags found during refresh/load
        if (error.message === 'apiErrors.protectedTag' || error.message === 'apiErrors.invalidToken') {
            return { success: false, message: errorMessage, errorType: error.message };
        }

        return { success: false, message: translate('errors.fetchPlayerFailed', { error: errorMessage }) };
    }
}

export function processPlayerDataResponse(playerData) {
    const cleanedTag = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;

    updateSavedPlayerTags(cleanedTag);

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
    const previousSyncedHeroes = new Set(basePlayerState.playerProfile?.ownedHeroes || []);
    
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
            heroState.enabled = false;
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
                equipState.checked = false;
            }
        }

        for (const equipKey in heroState.equipment) {
            cleanupUpgradePlan(heroState.equipment[equipKey]);
        }
    }

    if (playerData.leagueTier?.id) {
        if (!newPlayerState.income.starBonus) newPlayerState.income.starBonus = {};
        const leagueExists = leagueTiers.items.some(l => l.id === playerData.leagueTier.id);
        if (leagueExists) {
            newPlayerState.income.starBonus.league = playerData.leagueTier.id;
        } else {
            newPlayerState.income.starBonus.league = 105000000; // Unranked
        }
    }

    const selected = Object.keys(newPlayerState.income.shopOffers || {})[0] || '0';
    if (selected === '0' && playerData.townHallLevel) {
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
        newPlayerState.income.shopOffers = { [bestMatchSet]: {} };
    }

    newPlayerState.income.prospector = { 
        ...getDefaultPlayerState().income.prospector, 
        ...(newPlayerState.income.prospector || {}) 
    };

    newPlayerState.playerProfile = {
        name: playerData.name,
        tag: playerData.tag,
        townHallLevel: playerData.townHallLevel,
        clanBadgeUrl: playerData.clan?.badgeUrls?.small || '',
        ownedHeroes: homeHeroes.map(h => h.name),
        ownedEquipment: Object.fromEntries(homeEquipment.map(e => [e.name, e.level])),
    };

    state.heroes = newPlayerState.heroes;
    state.storedOres = newPlayerState.storedOres;
    state.income = newPlayerState.income;
    state.planner = newPlayerState.planner;
    state.playerProfile = newPlayerState.playerProfile;

    reindexGlobalPriority();
    updateAllPlayersData(cleanedTag, newPlayerState);
}