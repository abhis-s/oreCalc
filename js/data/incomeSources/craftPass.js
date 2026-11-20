import { deepFreeze } from '../../utils/objectUtils.js';

export const CRAFT_PASS_PRELEVEL = 15;

export const craftPassData = deepFreeze({
    free: { shiny: 0, glowy: 0, starry: 0, priceTier: null },
    paid: { shiny: 0, glowy: 0, starry: 0, priceTier: 'tier10' }
});

export const craftPassScheduleData = deepFreeze({
    type: 'bimonthly',
    dateStart: 8,
    dateEnd: 28,
    availableMonths: {
        2026: [12],
        2027: [],
        2028: [],
        2029: [],
        2030: []
    }
});
