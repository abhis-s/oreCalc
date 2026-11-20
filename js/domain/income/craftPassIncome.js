import { calculateBimonthlyIncome, calculateBimonthlyTraderOfferIncome, getPriceForTier } from '../../utils/incomeUtils.js';
import { craftPassData } from '../../data/incomeSources/craftPass.js';
import { craftPassTraderData } from '../../data/incomeSources/traders.js';
import { currencyData } from '../../data/pricingData.js';
import { DAYS_IN_MONTH, DAYS_IN_WEEK } from '../../data/timeConstants.js';

/**
 * Calculates ore income and costs for seasonal Craft Pass.
 *
 * @param {import('../../core/types.js').CraftPassIncomeState} [craftPassState={}]
 * @returns {import('../../core/types.js').IncomeResult}
 */
export function calculateCraftPassIncome(craftPassState = {}) {
    const isBought = Boolean(craftPassState?.craftPass);
    const passConfig = isBought ? craftPassData.paid : craftPassData.free;
    const bimonthlyOres = { shiny: passConfig.shiny, glowy: passConfig.glowy, starry: passConfig.starry };

    const bimonthlyCosts = {};
    const monthlyCosts = {};
    const weeklyCosts = {};
    const dailyCosts = {};

    for (const currencyCode in currencyData) {
        const fullCost = passConfig.priceTier ? getPriceForTier(passConfig.priceTier, currencyCode) : 0;
        bimonthlyCosts[currencyCode] = fullCost;
        monthlyCosts[currencyCode] = Math.round(fullCost / 2);
        dailyCosts[currencyCode] = (fullCost / 2) / DAYS_IN_MONTH;
        weeklyCosts[currencyCode] = dailyCosts[currencyCode] * DAYS_IN_WEEK;
    }

    const income = calculateBimonthlyIncome(bimonthlyOres);
    income.bimonthly = { ...income.bimonthly, ...bimonthlyCosts };
    income.monthly = { ...income.monthly, ...monthlyCosts };
    income.weekly = { ...income.weekly, ...weeklyCosts };
    income.daily = { ...income.daily, ...dailyCosts };
    income.type = isBought ? 'paid' : 'free';
    income.craftPass = isBought;
    return income;
}

/**
 * Calculates ore income and currency expenditure from Craft Pass Trader purchases.
 *
 * @param {import('../../core/types.js').CraftPassTraderIncomeState} [craftPassTraderState={}] - Craft Pass trader state.
 * @param {number} [availableCurrency=0] - Available seasonal Craft Currency.
 * @returns {import('../../core/types.js').IncomeResult} Composite Craft Pass trader income rates and summary.
 */
export function calculateCraftPassTraderIncome(craftPassTraderState = {}, availableCurrency = 0) {
    return calculateBimonthlyTraderOfferIncome(craftPassTraderData, craftPassTraderState, availableCurrency);
}
