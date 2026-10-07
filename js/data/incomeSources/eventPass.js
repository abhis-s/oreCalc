import { deepFreeze } from '../../utils/objectUtils.js';

export const eventPassData = deepFreeze({
    free: { shiny: 5000, glowy: 400, starry: 0, priceTier: null, eventMedals: 3200, storeMedals: 300, equipmentCost: 3100 },
    event: { shiny: 5000, glowy: 1280, starry: 85, priceTier: 'tier5', eventMedals: 8700, storeMedals: 300, equipmentCost: 3100 },
});
