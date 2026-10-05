import { getEquipmentMaxLevel, heroUnlockTownHallMap } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';
import { getDefaultPlayerState, state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { guidedSetupState } from './guidedSetupState.js';

/**
 * Generates fallback player profile data for guest mode based on Town Hall and League ID.
 * @param {number} [thLevel=16] - Target Town Hall level.
 * @param {number} [leagueId=105000000] - Selected League tier ID.
 * @returns {import('../../core/types.js').PlayerProfile} Synthetic Clash of Clans player profile object.
 */
export function generateGuestPlayerData(thLevel, leagueId) {
    const defaultTH = thLevel || 16;
    const defaultLeagueId = leagueId !== undefined ? leagueId : 105000000;
    const leagueObj = leagueTiers.items.find(l => l.id === defaultLeagueId) || {
        id: defaultLeagueId,
        name: "Unranked",
        iconUrls: {
            small: "https://api-assets.clashofclans.com/leagues/72/e9reA2sw0STcR3OHBkwWZaaPQZbqIFL0vsBQWFneIVg.png",
            tiny: "https://api-assets.clashofclans.com/leagues/36/e9reA2sw0STcR3OHBkwWZaaPQZbqIFL0vsBQWFneIVg.png"
        }
    };

    return {
        tag: "DEFAULT0",
        name: translate('player.guest'),
        townHallLevel: defaultTH,
        townHallWeaponLevel: 1,
        expLevel: 1,
        trophies: 0,
        bestTrophies: 0,
        warStars: 0,
        attackWins: 0,
        defenseWins: 0,
        builderHallLevel: 0,
        versusTrophies: 0,
        bestVersusTrophies: 0,
        versusBattleWins: 0,
        role: "notInClan",
        warPreference: "in",
        donations: 0,
        donationsReceived: 0,
        clanCapitalContributions: 0,
        clan: {
            tag: "#00000000",
            name: translate('views.guidedSetup.noClan') || "No Clan",
            clanLevel: 1,
            badgeUrls: {
                small: "https://api-assets.clashofclans.com/badges/70/4e5e4e.png",
                large: "https://api-assets.clashofclans.com/badges/512/4e5e4e.png",
                medium: "https://api-assets.clashofclans.com/badges/200/4e5e4e.png"
            }
        },
        leagueTier: {
            id: leagueObj.id,
            name: leagueObj.name
        },
        league: leagueObj,
        heroes: [],
        heroEquipment: []
    };
}

/**
 * Initializes unlocked hero and equipment structures in guest player state.
 * @param {import('../../core/types.js').PlayerData} guestPlayerState - Guest state partition object to populate.
 */
export function initializeGuestHeroesState(guestPlayerState) {
    if (!guestPlayerState || !guestPlayerState.playerProfile) return;
    const thLevel = Number(guestPlayerState.playerProfile.townHallLevel) || 16;

    if (!guestPlayerState.heroes) {
        guestPlayerState.heroes = {};
    }

    Object.keys(heroData).forEach(heroKey => {
        const heroInfo = heroData[heroKey];
        const unlockTH = heroUnlockTownHallMap[heroKey] ?? 1;
        if (unlockTH <= thLevel) {
            const heroState = {
                level: 1,
                checked: true,
                enabled: true,
                equipment: {}
            };

            const availableEquipment = heroInfo.equipment || [];
            availableEquipment.forEach(equip => {
                const maxLevel = getEquipmentMaxLevel(equip.type);
                heroState.equipment[equip.name] = {
                    level: 1,
                    checked: true,
                    targetLevel: maxLevel
                };
            });

            guestPlayerState.heroes[heroInfo.name] = heroState;
        }
    });
}

/**
 * Ensures that the 'DEFAULT0' partition exists in state.allPlayersData and is initialized.
 * @param {number} [thLevel] - Optional town hall override.
 * @param {number} [leagueId] - Optional league ID override.
 */
export function ensureGuestPlayerState(thLevel, leagueId) {
    const targetTH = thLevel || guidedSetupState.selectedTH || 16;
    const targetLeague = leagueId !== undefined ? leagueId : (guidedSetupState.selectedLeague || 105000000);

    if (!state.allPlayersData['DEFAULT0']) {
        const guestPlayerData = generateGuestPlayerData(targetTH, targetLeague);
        const guestPlayerState = {
            ...getDefaultPlayerState(),
            playerProfile: guestPlayerData,
            onboardingTimestamp: null
        };
        if (!guestPlayerState.income) guestPlayerState.income = {};
        if (!guestPlayerState.income.starBonus) {
            guestPlayerState.income.starBonus = { league: targetLeague };
        } else {
            guestPlayerState.income.starBonus.league = targetLeague;
        }
        initializeGuestHeroesState(guestPlayerState);
        handleStateUpdate(() => {
            state.allPlayersData['DEFAULT0'] = guestPlayerState;
        }, true);
    } else {
        const guestObj = state.allPlayersData['DEFAULT0'];
        if (guestObj.playerProfile) {
            guestObj.playerProfile.townHallLevel = targetTH;
            guestObj.playerProfile.leagueTier = { id: targetLeague };
        }
        if (guestObj.income?.starBonus) {
            guestObj.income.starBonus.league = targetLeague;
        }
        initializeGuestHeroesState(guestObj);
    }
}
