import { shopOfferData } from '../../data/incomeSources/shopOffers.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { bindSelectInput } from '../common/formBindingUtils.js';
import { initializeOfferGrid } from '../common/offerGrid.js';
import { dom } from '../../dom/domElements.js';
import { renderShopOfferGrid, renderShopOfferRow, renderShopOfferSelectorContent } from './shopOffersDisplay.js';

function updateShopOfferState(offerId, oreType, count) {
    const selector = dom.income?.shopOffers?.dropdown;
    const thLevel = selector ? parseInt(selector.value, 10) : 0;
    if (thLevel === 0) return;

    handleStateUpdate(() => {
        if (!state.income.shopOffers) {
            state.income.shopOffers = { selectedSet: thLevel };
        }
        state.income.shopOffers.selectedSet = thLevel;
        if (!state.income.shopOffers[thLevel]) {
            state.income.shopOffers[thLevel] = {};
        }

        if (count > 0) {
            state.income.shopOffers[thLevel][offerId] = count;
        } else {
            delete state.income.shopOffers[thLevel][offerId];
        }
    });
}

/**
 * Initializes Shop Offers dropdown bindings, offer grid interactions, and state updates.
 */
export function initializeShopOffers() {
    const selector = dom.income?.shopOffers?.dropdown;
    const container = dom.income?.shopOffers?.checkboxes;
    if (!selector || !container) return;

    renderShopOfferSelectorContent();

    bindSelectInput(selector, {
        numeric: true,
        onUpdate: (newTh) => {
            if (!state.income.shopOffers) state.income.shopOffers = {};
            state.income.shopOffers.selectedSet = newTh;
            if (!state.income.shopOffers[newTh]) {
                state.income.shopOffers[newTh] = {};
            }
        },
        afterUpdate: () => {
            renderShopOfferGrid(state.income.shopOffers);
        }
    });

    document.addEventListener('languageChanged', renderShopOfferSelectorContent);

    const getDynamicOffers = () => {
        const sel = selector.value; // The selector value is still a string
        if (sel === '0' || !shopOfferData[sel]) return [];
        const order = { 'shiny_large': 1, 'glowy': 2, 'starry': 3, 'shiny_small': 4 };
        return Object.entries(shopOfferData[sel])
            .filter(([id]) => id !== 'townHallLevel')
            .sort(([idA], [idB]) => (order[idA] || 99) - (order[idB] || 99))
            .map(([id, data]) => ({ ...data, id }));
    };

    initializeOfferGrid({
        container,
        offers: [],
        onStateChange: updateShopOfferState,
        renderRow: renderShopOfferRow,
        getDynamicOffers
    });
}
