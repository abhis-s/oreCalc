import { gemTraderData } from '../../data/incomeSources/traders.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { renderGemTraderRow } from './gemTraderDisplay.js';
import { initializeOfferGrid } from '../common/offerGrid.js';
import { dom } from '../../dom/domElements.js';

function updateGemTraderState(offerId, oreType, count) {
    handleStateUpdate(() => {
        if (!state.income.gems) state.income.gems = { packs: {} };
        if (!state.income.gems.packs) state.income.gems.packs = {};

        if (count > 0) {
            state.income.gems.packs[oreType] = count;
        } else {
            delete state.income.gems.packs[oreType];
        }
    });
}

/**
 * Initializes Gem Trader offer grid input event listeners and state synchronization.
 */
export function initializeGemTrader() {
    const container = dom.income?.gems?.offersContainer;
    if (!container) return;

    initializeOfferGrid({
        container,
        offers: gemTraderData,
        onStateChange: updateGemTraderState,
        renderRow: renderGemTraderRow
    });
}
