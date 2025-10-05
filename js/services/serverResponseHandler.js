import { state, getDefaultPlayerState } from '../core/state.js';
import { shopOfferData, leagues } from '../data/appData.js';
import { fetchPlayerData } from './apiService.js';
import { handleStateUpdate } from '../app.js';
import { updateSavedPlayerTags, updateAllPlayersData } from '../core/localStorageManager.js';

export async function loadAndProcessPlayerData(playerTag) {
    if (!playerTag || playerTag.trim() === '') {
        return { success: false, message: 'Please enter a player tag.' };
    }

    try {
        const playerData = await fetchPlayerData(playerTag);
        const cleanedServerTag = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;

        handleStateUpdate(() => {
            if (playerTag !== cleanedServerTag) {
                console.warn(`Player tag corrected: Original '${playerTag}', Corrected '${cleanedServerTag}'`);
            }
            state.lastPlayerTag = cleanedServerTag;
            processPlayerDataResponse(playerData);
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to load player data:', error);
        return { success: false, message: `Failed to load player data: ${error.message}` };
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
        playerData: null,
    };

    const isInitialLoadForBase = !basePlayerState.playerData;
    const previousServerHeroMap = isInitialLoadForBase ? new Map() : new Map(basePlayerState.playerData.heroes?.map(hero => [hero.name, hero]));
    const previousServerEquipMap = isInitialLoadForBase ? new Map() : new Map(basePlayerState.playerData.heroEquipment?.map(eq => [eq.name, eq]));


    const serverHeroMap = new Map(playerData.heroes?.map(hero => [hero.name, hero]));
    const serverEquipMap = new Map(playerData.heroEquipment?.map(eq => [eq.name, eq]));

    for (const heroKey in newPlayerState.heroes) {
        const serverHero = serverHeroMap.get(heroKey);
        const wasHeroPreviouslyPresent = previousServerHeroMap.has(heroKey);

        if (serverHero) {
            if (isInitialLoadForBase || !wasHeroPreviouslyPresent) {
                newPlayerState.heroes[heroKey].enabled = true;
            } else {
                newPlayerState.heroes[heroKey].enabled = basePlayerState.heroes[heroKey].enabled;
            }
        } else {
            newPlayerState.heroes[heroKey].enabled = false;
        }

        for (const equipKey in newPlayerState.heroes[heroKey].equipment) {
            const serverEquip = serverEquipMap.get(equipKey);
            const wasEquipPreviouslyPresent = previousServerEquipMap.has(equipKey);

            if (serverEquip) {
                newPlayerState.heroes[heroKey].equipment[equipKey].level = serverEquip.level;

                if (isInitialLoadForBase || !wasEquipPreviouslyPresent) {
                    newPlayerState.heroes[heroKey].equipment[equipKey].checked = true;
                } else {
                    newPlayerState.heroes[heroKey].equipment[equipKey].checked = basePlayerState.heroes[heroKey].equipment[equipKey].checked;
                }
            } else {
                newPlayerState.heroes[heroKey].equipment[equipKey].checked = false;
            }
        }

        for (const equipKey in newPlayerState.heroes[heroKey].equipment) {
            const equipment = newPlayerState.heroes[heroKey].equipment[equipKey];
            if (equipment.upgradePlan) {
                for (const stepNum in equipment.upgradePlan) {
                    const stepData = equipment.upgradePlan[stepNum];
                    if (stepData.target <= equipment.level) {
                        stepData.enabled = false;
                    }
                }
            }
        }
    }

    if (playerData.league?.id) {
        const leagueExists = leagues.items.some(l => l.id === playerData.league.id);
        if (leagueExists) {
            newPlayerState.income.starBonusLeague = playerData.league.id;
        } else {
            newPlayerState.income.starBonusLeague = 29000000; // Unranked
        }
    }

    if (newPlayerState.income.shopOffers.selectedSet === 'none' && playerData.townHallLevel) {
        const thLevel = playerData.townHallLevel;
        let bestMatchSet = 'none';
        let closestTh = -1;

        for (const setKey in shopOfferData) {
            const set = shopOfferData[setKey];
            if (set.townHallLevel !== undefined && set.townHallLevel <= thLevel && set.townHallLevel > closestTh) {
                closestTh = set.townHallLevel;
                bestMatchSet = setKey;
            }
        }
        newPlayerState.income.shopOffers.selectedSet = bestMatchSet;
    }
    newPlayerState.playerData = {
        name: playerData.name,
        tag: playerData.tag,
        clan: playerData.clan ? { badgeUrls: { small: playerData.clan.badgeUrls.small } } : {},
        heroes: playerData.heroes,
        heroEquipment: playerData.heroEquipment,
        league: playerData.league,
        townHallLevel: playerData.townHallLevel,
    };

    state.heroes = newPlayerState.heroes;
    state.income = newPlayerState.income;
    state.playerData = newPlayerState.playerData;

    updateAllPlayersData(cleanedTag, newPlayerState);
}