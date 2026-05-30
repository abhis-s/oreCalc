import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { eventTraderData } from '../../data/appData.js';
import { dom } from '../../dom/domElements.js';

import { initializeOfferGrid } from '../common/offerGrid.js';
import { renderEventTraderRow } from './eventTraderDisplay.js';

export function initializeEventTrader() {
    const offersContainer = dom.income?.eventTrader?.offersContainer;
    if (!offersContainer) return;

    initializeOfferGrid({
        container: offersContainer,
        offers: eventTraderData,
        onStateChange: (offerId, oreType, count) => {
            handleStateUpdate(() => {
                if (!state.income.eventTrader) state.income.eventTrader = { packs: {} };
                if (!state.income.eventTrader.packs) state.income.eventTrader.packs = {};

                if (count > 0) {
                    state.income.eventTrader.packs[oreType] = count;
                } else {
                    delete state.income.eventTrader.packs[oreType];
                }
            });
        },
        renderRow: renderEventTraderRow
    });
}
