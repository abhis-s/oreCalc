import { raidMedalTraderData } from '../../data/incomeSources/traders.js';
import { calculateWeeklyIncome } from '../../utils/incomeUtils.js';

/**
 * Calculates weekly and monthly ore income and remaining raid medals from Raid Medal Trader purchases.
 *
 * @param {import('../../core/types.js').RaidMedalTraderIncomeState} [raidMedalState={}] - Raid medal trader state.
 * @returns {import('../../core/types.js').IncomeResult} Composite raid medal trader income rates, costs, and remaining balance.
 */
export function calculateRaidMedalTraderIncome(raidMedalState = {}) {
    let weeklyShiny = 0, weeklyGlowy = 0, weeklyStarry = 0, totalCost = 0;
    const { earned = 0, packs = {} } = raidMedalState;

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
    income.remaining = (earned || 0) - totalCost;
    return income;
}
