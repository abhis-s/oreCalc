import { gemTraderData } from '../data/appData.js';
import { calculateWeeklyIncome } from '../utils/incomeUtils.js';

export function calculateGemTraderIncome(gemTraderState) {
    let weeklyShiny = 0, weeklyGlowy = 0, weeklyStarry = 0, totalCost = 0;
    const { packs } = gemTraderState;

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