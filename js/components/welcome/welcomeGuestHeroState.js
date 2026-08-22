import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { leagueTiers } from '../../data/leagueTiers.js';
import { translate } from '../../i18n/translator.js';

import { toCamelCase } from '../../utils/stringUtils.js';

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
            name: translate('views.welcome.noClan'),
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
    const thLevel = guestPlayerState.playerProfile.townHallLevel || 16;

    if (!guestPlayerState.heroes) {
        guestPlayerState.heroes = {};
    }

    Object.keys(heroData).forEach(heroKey => {
        const heroInfo = heroData[heroKey];
        if (heroInfo.thUnlock <= thLevel) {
            const heroState = {
                level: 1,
                checked: false,
                enabled: true,
                equipment: {}
            };

            const availableEquipment = heroInfo.equipment || [];
            availableEquipment.forEach(equip => {
                const eqKey = equip.key || toCamelCase(equip.name);
                const maxLevel = getEquipmentMaxLevel(equip.type);
                heroState.equipment[eqKey] = {
                    level: 1,
                    checked: false,
                    targetLevel: maxLevel
                };
            });

            guestPlayerState.heroes[heroKey] = heroState;
        }
    });
}
