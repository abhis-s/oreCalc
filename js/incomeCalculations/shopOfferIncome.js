import { shopOfferData, currencySymbols, currencyConversionRates } from "../data/appData.js";

function calculateOfferCosts(baseCostUSD, purchasedCount, regionalPricingEnabled) {
    const costs = {};
    const conversions = currencyConversionRates[baseCostUSD.toFixed(2)] || {};

    for (const currencyCode in conversions) {
        let cost = conversions[currencyCode] * purchasedCount;
        if (regionalPricingEnabled && currencySymbols[currencyCode]?.regionalPricing) {
            cost /= 2;
        }
        costs[currencyCode] = cost;
    }

    if (!costs["USD"]) {
        let cost = baseCostUSD * purchasedCount;
        if (regionalPricingEnabled && currencySymbols["USD"]?.regionalPricing) {
            cost /= 2;
        }
        costs["USD"] = cost;
    }
    return costs;
}

export function calculateShopOfferIncome(shopOfferState, uiSettings) {
    let totalShiny = 0;
    let totalGlowy = 0;
    let totalStarry = 0;
    const totalCosts = {};

    const { selectedSet, sets } = shopOfferState;
    if (selectedSet !== 'none') {
        const currentSetData = shopOfferData[selectedSet];
        const currentSetPurchases = sets[selectedSet] || {};

        for (const offerKey in currentSetPurchases) {
            const purchasedCount = currentSetPurchases[offerKey];
            const offer = currentSetData[offerKey];
            if (purchasedCount > 0 && offer) {
                totalShiny += offer.shiny * purchasedCount;
                totalGlowy += offer.glowy * purchasedCount;
                totalStarry += offer.starry * purchasedCount;

                const offerCosts = calculateOfferCosts(offer.baseCostUSD, purchasedCount, uiSettings.regionalPricingEnabled);
                for (const currencyCode in offerCosts) {
                    totalCosts[currencyCode] = (totalCosts[currencyCode] || 0) + offerCosts[currencyCode];
                }
            }
        }
    }

    const monthly = { shiny: totalShiny, glowy: totalGlowy, starry: totalStarry, ...totalCosts };
    const daily = { shiny: monthly.shiny / 30, glowy: monthly.glowy / 30, starry: monthly.starry / 30 };
    const weekly = { shiny: daily.shiny * 7, glowy: daily.glowy * 7, starry: daily.starry * 7 };
    const bimonthly = { shiny: monthly.shiny * 2, glowy: monthly.glowy * 2, starry: monthly.starry * 2 };

    for (const currencyCode in totalCosts) {
        daily[currencyCode] = monthly[currencyCode] / 30;
        weekly[currencyCode] = daily[currencyCode] * 7;
        bimonthly[currencyCode] = monthly[currencyCode] * 2;
    }

    return { daily, weekly, monthly, bimonthly };
}