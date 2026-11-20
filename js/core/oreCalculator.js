import { getEquipmentMaxLevel, getEquipmentUpgradeCost, usesStarryOre } from '../data/equipmentCommonData.js';
import { heroData } from '../data/heroData.js';
import { findHeroEquipment } from '../domain/equipment/comingSoonEquipmentDomain.js';

/**
 * Calculates remaining ores needed across all selected equipment upgrades,
 * deducting currently stored inventory and upcoming Hero Journey rewards.
 *
 * @param {Record<string, import('./types.js').HeroItem>} heroesState - Hero and equipment level states.
 * @param {import('./types.js').OreQuantity} [storedOres] - Currently stored inventory ores.
 * @param {import('./types.js').PlannerState} [plannerMaxLevels] - Planner configuration containing custom max caps.
 * @param {Partial<import('./types.js').OreQuantity>} [heroJourneyUpcomingOres={}] - Upcoming rewards from Hero Journey.
 * @returns {import('./types.js').OreQuantity} Remaining required shiny, glowy, and starry ores.
 */
export function calculateRequiredOres(heroesState, storedOres, plannerMaxLevels, heroJourneyUpcomingOres = {}) {
    let totalRequired = { shiny: 0, glowy: 0, starry: 0 };

    for (const heroName in heroesState) {
        const hero = heroesState[heroName];
        if (hero.enabled === false) continue;

        for (const equipName in hero.equipment) {
            const equip = hero.equipment[equipName];
            if (equip.checked === false) continue;

            const equipData = getEquipmentData(heroName, equipName, plannerMaxLevels, equip);
            if (!equipData) continue;

            const equipMax = getEquipmentMaxLevel(equipData.type);
            const currentLevel = Math.max(1, Math.min(equipMax, Number(equip.level) || 1));
            const targetLevel = Math.max(currentLevel, Math.min(equipMax, equipData.maxLevel));

            for (let i = currentLevel + 1; i <= targetLevel; i++) {
                const stepCost = getEquipmentUpgradeCost(i, equipData.type, equipData.costSchedule);
                totalRequired.shiny += stepCost.shiny || 0;
                totalRequired.glowy += stepCost.glowy || 0;
                if (usesStarryOre(equipData.type)) {
                    totalRequired.starry += stepCost.starry || 0;
                }
            }
        }
    }

    const storedShiny = storedOres?.shiny || 0;
    const storedGlowy = storedOres?.glowy || 0;
    const storedStarry = storedOres?.starry || 0;

    const upcomingShiny = heroJourneyUpcomingOres?.shiny || 0;
    const upcomingGlowy = heroJourneyUpcomingOres?.glowy || 0;
    const upcomingStarry = heroJourneyUpcomingOres?.starry || 0;

    return {
        shiny: Math.max(0, totalRequired.shiny - storedShiny - upcomingShiny),
        glowy: Math.max(0, totalRequired.glowy - storedGlowy - upcomingGlowy),
        starry: Math.max(0, totalRequired.starry - storedStarry - upcomingStarry),
    };
}

/**
 * Resolves equipment metadata and active max level cap.
 *
 * @param {string} heroName - Canonical or localized hero name.
 * @param {string} equipName - Equipment name.
 * @param {import('./types.js').PlannerState} [plannerMaxLevels={}] - Planner configuration.
 * @param {any} [equipState=null] - Equipment state slice.
 * @returns {{ type: string, maxLevel: number, costSchedule?: import('./types.js').CostSchedule } | null} Equipment data or null.
 */
function getEquipmentData(heroName, equipName, plannerMaxLevels = {}, equipState = null) {
    const hero = Object.values(heroData).find(h => h.name === heroName || h.key === heroName);
    const equipment = findHeroEquipment(hero, equipName, equipState);
    if (!equipment) return null;

    const equipMaxCap = getEquipmentMaxLevel(equipment.type);
    const customMaxLevel = plannerMaxLevels?.customMaxLevel;

    let targetMax = customMaxLevel?.[equipment.type] ??
                    customMaxLevel?.[equipName] ??
                    plannerMaxLevels?.[equipment.type] ??
                    plannerMaxLevels?.[equipName] ??
                    equipMaxCap;

    if (typeof targetMax === 'number' && Number.isFinite(targetMax)) {
        targetMax = Math.max(1, Math.min(equipMaxCap, targetMax));
    } else {
        targetMax = equipMaxCap;
    }

    return {
        type: equipment.type,
        maxLevel: targetMax,
        costSchedule: /** @type {import('./types.js').CostSchedule} */ (equipment.costSchedule || equipState?.costSchedule || 'classic')
    };
}
