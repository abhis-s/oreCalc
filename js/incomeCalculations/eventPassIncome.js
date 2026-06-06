import { eventPassData, currencyData } from '../data/appData.js';
import { calculateBimonthlyIncome, getPriceForTier } from '../utils/incomeUtils.js';

export function calculateEventPassIncome(eventPassState = {}) {
    const { eventPass = false, includeEquipment = false, bonusTrackMedals = 0, purchasedMedals = 0 } = eventPassState;
    const type = eventPass ? 'event' : 'free';
    const passData = eventPassData[type];
    let bimonthlyOres = { shiny: passData.shiny || 0, glowy: passData.glowy || 0, starry: passData.starry || 0 };
    let bimonthlyEventMedals = passData.eventMedals || 0;
    const costs = {};

    for (const currencyCode in currencyData) {
        costs[currencyCode] = 0;
    }

    if (passData.priceTier) {
        for (const currencyCode in currencyData) {
            costs[currencyCode] = getPriceForTier(passData.priceTier, currencyCode);
        }
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
