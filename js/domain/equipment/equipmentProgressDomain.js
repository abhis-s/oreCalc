/**
 * Equipment Progress & Ore Investment Calculation Engine.
 * Tier 2: Pure Domain Math
 */

import { getEquipmentMaxLevel, upgradeCosts } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';

/**
 * @typedef {Object} OreProgressDetails
 * @property {number} shiny - Shiny ore percentage (0-100).
 * @property {number} glowy - Glowy ore percentage (0-100).
 * @property {number} [starry] - Starry ore percentage (0-100, epic only).
 * @property {number} avg - Combined average percentage (0-100).
 * @property {{ shiny: number, glowy: number, starry?: number }} spent - Raw ores spent.
 * @property {{ shiny: number, glowy: number, starry?: number }} total - Total ores required.
 */

/**
 * @typedef {Object} EquipmentProgressResult
 * @property {number} overall - Overall ore percentage completed (0-100).
 * @property {number} shiny - Shiny ore completion percentage (0-100).
 * @property {number} glowy - Glowy ore completion percentage (0-100).
 * @property {number} starry - Starry ore completion percentage (0-100).
 * @property {number} shinySpent - Total shiny ore invested.
 * @property {number} shinyTotal - Total shiny ore capacity for maxed equipment.
 * @property {number} glowySpent - Total glowy ore invested.
 * @property {number} glowyTotal - Total glowy ore capacity for maxed equipment.
 * @property {number} starrySpent - Total starry ore invested.
 * @property {number} starryTotal - Total starry ore capacity for maxed equipment.
 * @property {OreProgressDetails} common - Common equipment breakdown.
 * @property {OreProgressDetails} epic - Epic equipment breakdown.
 */

/**
 * Calculates overall ore-cost-based progress percentage for common and epic equipment.
 * Supports both explicit equipment/heroes maps and full player profile objects.
 *
 * @param {Record<string, number> | { ownedEquipment?: Record<string, number>, ownedHeroes?: Record<string, any> }} ownedEquipmentOrPlayerData
 * @param {Record<string, any> | null} [ownedHeroes=null]
 * @returns {EquipmentProgressResult} Progress statistics across all ore types.
 */
export function calculateEquipmentProgress(ownedEquipmentOrPlayerData = {}, ownedHeroes = null) {
    let ownedEquip = {};
    let heroesFilter = ownedHeroes;

    if (ownedEquipmentOrPlayerData && typeof ownedEquipmentOrPlayerData === 'object') {
        const dataObj = /** @type {any} */ (ownedEquipmentOrPlayerData);
        if ('ownedEquipment' in dataObj || 'ownedHeroes' in dataObj) {
            ownedEquip = dataObj.ownedEquipment || {};
            if (heroesFilter === null) {
                heroesFilter = dataObj.ownedHeroes || null;
            }
        } else {
            ownedEquip = /** @type {Record<string, number>} */ (ownedEquipmentOrPlayerData);
        }
    }

    const commonSpent = { shiny: 0, glowy: 0 };
    const commonTotal = { shiny: 0, glowy: 0 };
    const epicSpent = { shiny: 0, glowy: 0, starry: 0 };
    const epicTotal = { shiny: 0, glowy: 0, starry: 0 };

    for (const heroKey in heroData) {
        const heroInfo = heroData[heroKey];

        // If explicit ownedHeroes object is passed, filter to only unlocked heroes.
        // If ownedHeroes is null/undefined, evaluate across all heroes in heroData.
        if (heroesFilter !== null) {
            if (!heroesFilter[heroInfo.name]) continue;
        }

        for (const equip of heroInfo.equipment) {
            const isEpic = equip.type === 'epic';
            const currentLevel = ownedEquip[equip.name] !== undefined ? ownedEquip[equip.name] : 1;
            const maxLevel = getEquipmentMaxLevel(equip.type);

            if (ownedEquip[equip.name] !== undefined || heroesFilter === null) {
                for (let lvl = 2; lvl <= currentLevel; lvl++) {
                    const cost = upgradeCosts[lvl];
                    if (cost) {
                        if (isEpic) {
                            epicSpent.shiny += cost.shiny || 0;
                            epicSpent.glowy += cost.glowy || 0;
                            epicSpent.starry += cost.starry || 0;
                        } else {
                            commonSpent.shiny += cost.shiny || 0;
                            commonSpent.glowy += cost.glowy || 0;
                        }
                    }
                }
            }

            for (let lvl = 2; lvl <= maxLevel; lvl++) {
                const cost = upgradeCosts[lvl];
                if (cost) {
                    if (isEpic) {
                        epicTotal.shiny += cost.shiny || 0;
                        epicTotal.glowy += cost.glowy || 0;
                        epicTotal.starry += cost.starry || 0;
                    } else {
                        commonTotal.shiny += cost.shiny || 0;
                        commonTotal.glowy += cost.glowy || 0;
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

    const shinySpent = commonSpent.shiny + epicSpent.shiny;
    const shinyTotal = commonTotal.shiny + epicTotal.shiny;
    const shiny = shinyTotal > 0 ? Math.round((shinySpent / shinyTotal) * 100) : 0;

    const glowySpent = commonSpent.glowy + epicSpent.glowy;
    const glowyTotal = commonTotal.glowy + epicTotal.glowy;
    const glowy = glowyTotal > 0 ? Math.round((glowySpent / glowyTotal) * 100) : 0;

    const starrySpent = epicSpent.starry;
    const starryTotal = epicTotal.starry;
    const starry = starryTotal > 0 ? Math.round((starrySpent / starryTotal) * 100) : 0;

    const orePcts = [];
    if (shinyTotal > 0) orePcts.push(shiny);
    if (glowyTotal > 0) orePcts.push(glowy);
    if (starryTotal > 0) orePcts.push(starry);

    const overall = orePcts.length > 0
        ? Math.round(orePcts.reduce((sum, val) => sum + val, 0) / orePcts.length)
        : 0;

    return {
        overall,
        shiny,
        glowy,
        starry,
        shinySpent,
        shinyTotal,
        glowySpent,
        glowyTotal,
        starrySpent,
        starryTotal,
        common: {
            shiny: commonShinyPct,
            glowy: commonGlowyPct,
            avg: commonAvgPct,
            spent: commonSpent,
            total: commonTotal
        },
        epic: {
            shiny: epicShinyPct,
            glowy: epicGlowyPct,
            starry: epicStarryPct,
            avg: epicAvgPct,
            spent: epicSpent,
            total: epicTotal
        }
    };
}

/**
 * Generates the mathematical gradient background for the overall progress bar,
 * dynamically adapting color stops to reflect active ore progress.
 *
 * @param {{ overall: number, shiny: number, glowy: number, starry: number }} progress - Equipment progress numbers.
 * @returns {string} CSS background gradient string.
 */
export function getOverallGradient(progress) {
    if (progress.overall >= 100) {
        return '';
    }
    const s = Math.max(0, progress.shiny || 0);
    const g = Math.max(0, progress.glowy || 0);
    const st = Math.max(0, progress.starry || 0);
    const total = s + g + st;
    if (total === 0) {
        return 'linear-gradient(90deg, #00b0ff 0%, #aa00ff 50%, #ffd700 100%)';
    }

    const hasS = s > 0;
    const hasG = g > 0;
    const hasSt = st > 0;

    // Single active ore: use cohesive tonal palettes matching individual ore fills
    if (hasS && !hasG && !hasSt) {
        return 'linear-gradient(90deg, #0091ea 0%, #00b0ff 50%, #80d8ff 100%)';
    }
    if (hasG && !hasS && !hasSt) {
        return 'linear-gradient(90deg, #7b1fa2 0%, #aa00ff 50%, #e040fb 100%)';
    }
    if (hasSt && !hasS && !hasG) {
        return 'linear-gradient(90deg, #ff8f00 0%, #ffab00 50%, #ffd700 100%)';
    }

    // Two active ores: drop the inactive ore and blend the active pair with proportional runway
    if (hasS && hasG && !hasSt) {
        const ratio = Math.round((s / (s + g)) * 100);
        const stop = Math.min(85, Math.max(15, ratio));
        return `linear-gradient(90deg, #00b0ff 0%, #00b0ff ${Math.max(0, stop - 15)}%, #aa00ff ${Math.min(100, stop + 15)}%, #e040fb 100%)`;
    }
    if (hasS && hasSt && !hasG) {
        const ratio = Math.round((s / (s + st)) * 100);
        const stop = Math.min(85, Math.max(15, ratio));
        return `linear-gradient(90deg, #00b0ff 0%, #00b0ff ${Math.max(0, stop - 15)}%, #ffab00 ${Math.min(100, stop + 15)}%, #ffd700 100%)`;
    }
    if (hasG && hasSt && !hasS) {
        const ratio = Math.round((g / (g + st)) * 100);
        const stop = Math.min(85, Math.max(15, ratio));
        return `linear-gradient(90deg, #aa00ff 0%, #aa00ff ${Math.max(0, stop - 15)}%, #ffab00 ${Math.min(100, stop + 15)}%, #ffd700 100%)`;
    }

    // All three ores active: dynamically weight the Purple centroid
    const purpleCenter = Math.round(((s + (g / 2)) / total) * 100);
    const stop = Math.min(85, Math.max(15, purpleCenter));
    return `linear-gradient(90deg, #00b0ff 0%, #aa00ff ${stop}%, #ffd700 100%)`;
}
