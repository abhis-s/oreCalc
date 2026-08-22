import { getEquipmentMaxLevel, upgradeCosts } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';

/**
 * Formats a clan role string into localized text.
 * @param {string} role
 * @returns {string}
 */
export function formatClanRole(role) {
    if (!role) return '';
    const key = `player.roles.${role.toLowerCase()}`;
    const translated = translate(key);
    return translated !== key ? translated : role;
}

/**
 * Calculates percentage completion of Common and Epic equipment upgrades for a player.
 * @param {Object} playerData
 * @returns {{ common: { shiny: number, glowy: number, avg: number }, epic: { shiny: number, glowy: number, starry: number, avg: number } }}
 */
export function calculateEquipmentProgress(playerData) {
    let commonSpent = { shiny: 0, glowy: 0 };
    let commonTotal = { shiny: 0, glowy: 0 };
    let epicSpent = { shiny: 0, glowy: 0, starry: 0 };
    let epicTotal = { shiny: 0, glowy: 0, starry: 0 };

    const ownedEquip = playerData.ownedEquipment || {};

    for (const heroKey in heroData) {
        const heroInfo = heroData[heroKey];
        for (const equip of heroInfo.equipment) {
            const isEpic = equip.type === 'epic';
            const currentLevel = ownedEquip[equip.name] !== undefined ? ownedEquip[equip.name] : 1;
            const maxLevel = getEquipmentMaxLevel(equip.type);

            for (let lvl = 2; lvl <= currentLevel; lvl++) {
                if (upgradeCosts[lvl]) {
                    if (isEpic) {
                        epicSpent.shiny += upgradeCosts[lvl].shiny || 0;
                        epicSpent.glowy += upgradeCosts[lvl].glowy || 0;
                        epicSpent.starry += upgradeCosts[lvl].starry || 0;
                    } else {
                        commonSpent.shiny += upgradeCosts[lvl].shiny || 0;
                        commonSpent.glowy += upgradeCosts[lvl].glowy || 0;
                    }
                }
            }

            for (let lvl = 2; lvl <= maxLevel; lvl++) {
                if (upgradeCosts[lvl]) {
                    if (isEpic) {
                        epicTotal.shiny += upgradeCosts[lvl].shiny || 0;
                        epicTotal.glowy += upgradeCosts[lvl].glowy || 0;
                        epicTotal.starry += upgradeCosts[lvl].starry || 0;
                    } else {
                        commonTotal.shiny += upgradeCosts[lvl].shiny || 0;
                        commonTotal.glowy += upgradeCosts[lvl].glowy || 0;
                    }
                }
            }
        }
    }

    const commonShinyPct = commonTotal.shiny > 0 ? Math.round((commonSpent.shiny / commonTotal.shiny) * 100) : 0;
    const commonGlowyPct = commonTotal.glowy > 0 ? Math.round((commonSpent.glowy / commonTotal.glowy) * 100) : 0;
    const commonAvgPct = Math.round((commonShinyPct + commonGlowyPct) / 2);

    const epicShinyPct = epicTotal.shiny > 0 ? Math.round((epicSpent.shiny / epicTotal.shiny) * 100) : 0;
    const epicGlowyPct = epicTotal.glowy > 0 ? Math.round((epicSpent.glowy / epicTotal.glowy) * 100) : 0;
    const epicStarryPct = epicTotal.starry > 0 ? Math.round((epicSpent.starry / epicTotal.starry) * 100) : 0;
    const epicAvgPct = Math.round((epicShinyPct + epicGlowyPct + epicStarryPct) / 3);

    return {
        common: {
            shiny: commonShinyPct,
            glowy: commonGlowyPct,
            avg: commonAvgPct
        },
        epic: {
            shiny: epicShinyPct,
            glowy: epicGlowyPct,
            starry: epicStarryPct,
            avg: epicAvgPct
        }
    };
}
