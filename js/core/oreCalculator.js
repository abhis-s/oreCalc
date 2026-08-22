import { getEquipmentMaxLevel, upgradeCosts } from '../data/equipmentCommonData.js';
import { heroData } from '../data/heroData.js';

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

            const equipData = getEquipmentData(heroName, equipName, plannerMaxLevels);
            if (!equipData) continue;

            const currentLevel = equip.level || 1;
            for (let i = currentLevel + 1; i <= equipData.maxLevel; i++) {
                if (upgradeCosts[i]) {
                    totalRequired.shiny += upgradeCosts[i].shiny || 0;
                    totalRequired.glowy += upgradeCosts[i].glowy || 0;
                    if (equipData.type === 'epic') {
                        totalRequired.starry += upgradeCosts[i].starry || 0;
                    }
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
 * @returns {{ type: string, maxLevel: number } | null} Equipment data or null.
 */
function getEquipmentData(heroName, equipName, plannerMaxLevels = {}) {
    const customMaxLevel = plannerMaxLevels?.customMaxLevel;
    const hero = Object.values(heroData).find(h => h.name === heroName || h.key === heroName);
    const equipment = hero?.equipment?.find(e => e.name === equipName || e.key === equipName);
    if (!equipment) return null;

    const maxLevel = customMaxLevel?.[equipment.type] || getEquipmentMaxLevel(equipment.type);
    return { type: equipment.type, maxLevel: maxLevel };
}
