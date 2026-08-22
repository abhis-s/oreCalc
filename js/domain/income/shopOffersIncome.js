import { shopOfferData } from '../../data/incomeSources/shopOffers.js';
import { currencyData } from '../../data/pricingData.js';
import { getPriceForTier } from '../../utils/incomeUtils.js';

/**
 * Calculates multi-currency costs for a specific price tier given a purchase count.
 *
 * @param {string} priceTier - Price tier registry identifier (e.g. 'tier1').
 * @param {number} purchasedCount - Number of offer packs purchased.
 * @returns {Record<string, number>} Currency costs keyed by ISO currency code.
 */
function calculateOfferCosts(priceTier, purchasedCount) {
    const costs = {};

    for (const currencyCode in currencyData) {
        costs[currencyCode] = getPriceForTier(priceTier, currencyCode) * purchasedCount;
    }

    return costs;
}

/**
 * Calculates ore income and multi-currency costs for Town Hall specific shop offer bundles.
 *
 * @param {import('../../core/types.js').ShopOffersIncomeState | Record<string, any>} [shopOfferState={ selectedSet: 0, '0': {} }] - Shop offers state.
 * @returns {{ daily: import('../../core/types.js').IncomeTimeframeRates, weekly: import('../../core/types.js').IncomeTimeframeRates, monthly: import('../../core/types.js').IncomeTimeframeRates, bimonthly: import('../../core/types.js').IncomeTimeframeRates }} Breakdown of rates across timeframes.
 */
export function calculateShopOfferIncome(shopOfferState = { selectedSet: 0, '0': {} }) {
    let totalShiny = 0;
    let totalGlowy = 0;
    let totalStarry = 0;
    const totalCosts = {};

    let selected = shopOfferState.selectedSet;
    if (selected === undefined || selected === null) {
        const firstKey = Object.keys(shopOfferState).find(k => k !== 'selectedSet');
        selected = firstKey ? parseInt(firstKey, 10) : 0;
    }

    if (selected && selected !== 0) {
        const currentSetData = shopOfferData[selected];
        const currentSetPurchases = shopOfferState[selected] || {};

        for (const offerKey in currentSetPurchases) {
            const purchasedCount = currentSetPurchases[offerKey];
            const offer = currentSetData ? currentSetData[offerKey] : null;
            if (purchasedCount > 0 && offer) {
                totalShiny += (offer.shiny || 0) * purchasedCount;
                totalGlowy += (offer.glowy || 0) * purchasedCount;
                totalStarry += (offer.starry || 0) * purchasedCount;

                if (offer.priceTier) {
                    const offerCosts = calculateOfferCosts(offer.priceTier, purchasedCount);
                    for (const currencyCode in offerCosts) {
                        totalCosts[currencyCode] = (totalCosts[currencyCode] || 0) + offerCosts[currencyCode];
                    }
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
