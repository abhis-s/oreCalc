import { eventPassData, currencySymbols, currencyConversionRates } from '../data/appData.js';
import { calculateBimonthlyIncome } from '../utils/incomeUtils.js';

export function calculateEventPassIncome(eventPassState, regionalPricingEnabled) {
    const { type, equipmentBought } = eventPassState;
    const passData = eventPassData[type];
    let bimonthlyOres = { shiny: passData.shiny || 0, glowy: passData.glowy || 0, starry: passData.starry || 0 };
    let bimonthlyEventMedals = passData.eventMedals || 0;
    const costs = {};

    for (const currencyCode in currencySymbols) {
        costs[currencyCode] = 0;
    }

    if (passData.baseCostUSD && passData.baseCostUSD > 0) {
        const baseCostUSD = passData.baseCostUSD;
        for (const currencyCode in currencySymbols) {
            let cost = (currencyConversionRates[baseCostUSD.toFixed(2)]?.[currencyCode] || baseCostUSD);
            if (regionalPricingEnabled && currencySymbols[currencyCode]?.regionalPricing) {
                cost /= 2;
            }
            costs[currencyCode] = (costs[currencyCode] || 0) + cost;
        }
    }

    if (equipmentBought) {
        bimonthlyEventMedals -= passData.equipmentCost || eventPassData.free.equipmentCost;
    }

    const income = calculateBimonthlyIncome(bimonthlyOres);
    income.availableMedals = bimonthlyEventMedals;
    income.monthly = { ...income.monthly, ...costs };
    income.type = type;
    return income;

}