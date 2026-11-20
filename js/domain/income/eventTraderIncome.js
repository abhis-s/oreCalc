import { calculateBimonthlyTraderOfferIncome } from '../../utils/incomeUtils.js';
import { eventTraderData } from '../../data/incomeSources/traders.js';

/**
 * Calculates ore income and medal expenditure from Event Trader purchases.
 *
 * @param {import('../../core/types.js').EventTraderIncomeState} [eventTraderState={}] - Event trader state with purchased packs.
 * @param {number} [availableMedals=0] - Total event medals available for spending.
 * @returns {import('../../core/types.js').IncomeResult} Composite event trader income rates, costs, and remaining medals.
 */
export function calculateEventTraderIncome(eventTraderState = {}, availableMedals = 0) {
    return calculateBimonthlyTraderOfferIncome(eventTraderData, eventTraderState, availableMedals);
}
