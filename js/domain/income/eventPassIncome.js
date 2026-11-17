import { calculateBimonthlyIncome, getPriceForTier } from '../../utils/incomeUtils.js';
import { eventPassData } from '../../data/incomeSources/eventPass.js';
import { currencyData } from '../../data/pricingData.js';
import { DAYS_IN_MONTH, DAYS_IN_WEEK } from '../../data/timeConstants.js';

/**
 * Calculates ore and event medal income from free and paid Supercell Event Passes.
 *
 * @param {import('../../core/types.js').EventPassIncomeState} [eventPassState={}] - Event pass settings.
 * @returns {import('../../core/types.js').IncomeResult} Composite event pass income rates and available medals.
 */
export function calculateEventPassIncome(eventPassState = {}) {
    const { eventPass = false, includeEquipment = false, bonusTrackMedals = 0, purchasedMedals = 0 } = eventPassState;
    const type = eventPass ? 'event' : 'free';
    const passData = eventPassData[type];
    let bimonthlyOres = { shiny: passData.shiny || 0, glowy: passData.glowy || 0, starry: passData.starry || 0 };
    let bimonthlyEventMedals = passData.eventMedals || 0;
    const bimonthlyCosts = {};
    const monthlyCosts = {};
    const weeklyCosts = {};
    const dailyCosts = {};

    for (const currencyCode in currencyData) {
        const fullCost = passData.priceTier ? getPriceForTier(passData.priceTier, currencyCode) : 0;
        bimonthlyCosts[currencyCode] = fullCost;
        monthlyCosts[currencyCode] = fullCost / 2;
        dailyCosts[currencyCode] = (fullCost / 2) / DAYS_IN_MONTH;
        weeklyCosts[currencyCode] = dailyCosts[currencyCode] * DAYS_IN_WEEK;
    }

    bimonthlyEventMedals += (bonusTrackMedals || 0);
    bimonthlyEventMedals += (purchasedMedals || 0);

    if (includeEquipment) {
        bimonthlyEventMedals -= passData.equipmentCost || eventPassData.free.equipmentCost;
    }

    const income = calculateBimonthlyIncome(bimonthlyOres);
    income.availableMedals = bimonthlyEventMedals;
    income.bimonthly = { ...income.bimonthly, ...bimonthlyCosts };
    income.monthly = { ...income.monthly, ...monthlyCosts };
    income.weekly = { ...income.weekly, ...weeklyCosts };
    income.daily = { ...income.daily, ...dailyCosts };
    income.type = type;
    income.eventPass = eventPass;
    return income;
}
