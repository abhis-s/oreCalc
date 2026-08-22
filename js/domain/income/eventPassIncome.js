import { calculateBimonthlyIncome, getPriceForTier } from '../../utils/incomeUtils.js';
import { eventPassData } from '../../data/incomeSources/eventPass.js';
import { currencyData } from '../../data/pricingData.js';

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
    const costs = {};

    for (const currencyCode in currencyData) {
        costs[currencyCode] = passData.priceTier ? getPriceForTier(passData.priceTier, currencyCode) : 0;
    }

    bimonthlyEventMedals += (bonusTrackMedals || 0);
    bimonthlyEventMedals += (purchasedMedals || 0);

    if (includeEquipment) {
        bimonthlyEventMedals -= passData.equipmentCost || eventPassData.free.equipmentCost;
    }

    const income = calculateBimonthlyIncome(bimonthlyOres);
    income.availableMedals = bimonthlyEventMedals;
    income.monthly = { ...income.monthly, ...costs };
    income.type = type;
    income.eventPass = eventPass;
    return income;

}
