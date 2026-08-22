import { gemTraderData } from '../../data/incomeSources/traders.js';
import { FREE_WEEKLY_GLOWY } from '../../core/constants.js';
import { calculateWeeklyIncome } from '../../utils/incomeUtils.js';

/**
 * Calculates weekly and monthly ore income from the Gem Trader (including free weekly glowy ore).
 *
 * @param {import('../../core/types.js').GemTraderIncomeState} [gemTraderState={}] - Gem trader state with purchased packs.
 * @returns {import('../../core/types.js').IncomeResult} Composite gem trader income rates and gem costs.
 */
export function calculateGemTraderIncome(gemTraderState = {}) {
    let weeklyShiny = 0, weeklyGlowy = FREE_WEEKLY_GLOWY, weeklyStarry = 0, totalCost = 0;
    const { packs = {} } = gemTraderState;

    gemTraderData.forEach(offer => {
        const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
        const packCount = packs[oreType] || 0;

        if (packCount > 0) {
            const oreValue = offer.shiny || offer.glowy || offer.starry;
            if (oreType === 'shiny') weeklyShiny += oreValue * packCount;
            if (oreType === 'glowy') weeklyGlowy += oreValue * packCount;
            if (oreType === 'starry') weeklyStarry += oreValue * packCount;
            totalCost += offer.cost * packCount;
        }
    });

    const income = calculateWeeklyIncome({ shiny: weeklyShiny, glowy: weeklyGlowy, starry: weeklyStarry });
    income.cost = totalCost;
    return income;
}
