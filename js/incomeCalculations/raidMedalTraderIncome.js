import { raidMedalTraderData } from '../data/appData.js';
import { calculateWeeklyIncome } from '../utils/incomeUtils.js';

export function calculateRaidMedalTraderIncome(raidMedalState) {
    let weeklyShiny = 0, weeklyGlowy = 0, weeklyStarry = 0, totalCost = 0;
    const { earned, packs } = raidMedalState;

    raidMedalTraderData.forEach(offer => {
        if (offer.shiny > 0 && packs.shiny) {
            weeklyShiny += offer.shiny * packs.shiny;
            totalCost += offer.cost * packs.shiny;
        }
        if (offer.glowy > 0 && packs.glowy) {
            weeklyGlowy += offer.glowy * packs.glowy;
            totalCost += offer.cost * packs.glowy;
        }
        if (offer.starry > 0 && packs.starry) {
            weeklyStarry += offer.starry * packs.starry;
            totalCost += offer.cost * packs.starry;
        }
    });

    const income = calculateWeeklyIncome({ shiny: weeklyShiny, glowy: weeklyGlowy, starry: weeklyStarry });
    income.cost = totalCost;
    income.remaining = earned - totalCost;
    return income;
}