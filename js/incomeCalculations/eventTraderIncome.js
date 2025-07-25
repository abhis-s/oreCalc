import { eventTraderData } from '../data/appData.js';
import { calculateBimonthlyIncome } from '../utils/incomeUtils.js';

export function calculateEventTraderIncome(eventTraderState, availableMedals = 0) {
    let bimonthlyShiny = 0, bimonthlyGlowy = 0, bimonthlyStarry = 0, totalCost = 0;
    const { packs } = eventTraderState;

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