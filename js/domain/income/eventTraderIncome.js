import { calculateBimonthlyIncome } from '../../utils/incomeUtils.js';
import { eventTraderData } from '../../data/incomeSources/traders.js';

/**
 * Calculates ore income and medal expenditure from Event Trader purchases.
 *
 * @param {import('../../core/types.js').EventTraderIncomeState} [eventTraderState={}] - Event trader state with purchased packs.
 * @param {number} [availableMedals=0] - Total event medals available for spending.
 * @returns {import('../../core/types.js').IncomeResult} Composite event trader income rates, costs, and remaining medals.
 */
export function calculateEventTraderIncome(eventTraderState = {}, availableMedals = 0) {
    let bimonthlyShiny = 0, bimonthlyGlowy = 0, bimonthlyStarry = 0, totalCost = 0;
    const { packs = {} } = eventTraderState;

    eventTraderData.forEach(offer => {
        const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
        const packCount = packs[oreType] || 0;

        if (packCount > 0) {
            if (oreType === 'shiny') bimonthlyShiny += offer.shiny * packCount;
            if (oreType === 'glowy') bimonthlyGlowy += offer.glowy * packCount;
            if (oreType === 'starry') bimonthlyStarry += offer.starry * packCount;
            totalCost += offer.cost * packCount;
        }
    });

    const income = calculateBimonthlyIncome({ shiny: bimonthlyShiny, glowy: bimonthlyGlowy, starry: bimonthlyStarry });
    income.cost = totalCost;
    income.remaining = availableMedals - totalCost;
    income.totalMedalsEarned = availableMedals;
    return income;
}
