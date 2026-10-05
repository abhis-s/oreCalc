import { shopOfferData, SHOP_OFFER_ORDER } from '../../data/incomeSources/shopOffers.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { bindSelectInput } from '../common/formBindingUtils.js';
import { initializeOfferGrid } from '../common/offerGrid.js';
import { dom } from '../../dom/domElements.js';
import { renderShopOfferGrid, renderShopOfferRow, renderShopOfferSelectorContent } from './shopOffersDisplay.js';

function updateShopOfferState(offerId, oreType, count) {
    const selector = dom.income?.shopOffers?.dropdown;
    const setKey = selector ? selector.value : '0';
    if (setKey === '0') return;

    handleStateUpdate(() => {
        if (!state.income.shopOffers) {
            state.income.shopOffers = { selectedSet: setKey };
        }
        state.income.shopOffers.selectedSet = setKey;
        if (!state.income.shopOffers[setKey]) {
            state.income.shopOffers[setKey] = {};
        }

        if (count > 0) {
            state.income.shopOffers[setKey][offerId] = count;
        } else {
            delete state.income.shopOffers[setKey][offerId];
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
        numeric: false,
        onUpdate: (newSetKey) => {
            const setKey = String(newSetKey);
            if (!state.income.shopOffers) state.income.shopOffers = {};
            state.income.shopOffers.selectedSet = setKey;
            if (!state.income.shopOffers[setKey]) {
                state.income.shopOffers[setKey] = {};
            }
        },
        afterUpdate: () => {
            renderShopOfferGrid(state.income.shopOffers);
        }
    });

    document.addEventListener('languageChanged', renderShopOfferSelectorContent);

    const getDynamicOffers = () => {
        const sel = selector.value;
        if (sel === '0' || !shopOfferData[sel] || shopOfferData[sel].disabled) return [];
        return Object.entries(shopOfferData[sel])
            .filter(([id]) => id !== 'townHallLevel' && id !== 'disabled' && id !== 'name')
            .sort(([idA], [idB]) => (SHOP_OFFER_ORDER[idA] || 99) - (SHOP_OFFER_ORDER[idB] || 99))
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
