import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { shopOfferData } from '../../data/appData.js';
import { dom } from '../../dom/domElements.js';

import { initializeOfferGrid } from '../common/offerGrid.js';
import { renderShopOfferSelectorContent, renderShopOfferRow, renderShopOfferGrid } from './shopOffersDisplay.js';

export function updateShopOfferState(offerId, oreType, count) {
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

export function initializeShopOffers() {
    const selector = dom.income?.shopOffers?.dropdown;
    const container = dom.income?.shopOffers?.checkboxes;
    if (!selector || !container) return;

    renderShopOfferSelectorContent();

    selector.addEventListener('change', (e) => {
        const newTh = parseInt(e.target.value, 10);
        handleStateUpdate(() => { 
            if (!state.income.shopOffers) state.income.shopOffers = {};
            state.income.shopOffers.selectedSet = newTh;
            if (!state.income.shopOffers[newTh]) {
                state.income.shopOffers[newTh] = {};
            }
        });
        renderShopOfferGrid(state.income.shopOffers);
    });

    document.addEventListener('languageChanged', renderShopOfferSelectorContent);

    const getDynamicOffers = () => {
        const sel = selector.value; // The selector value is still a string
        if (sel === '0' || !shopOfferData[sel]) return [];
        return Object.entries(shopOfferData[sel])
            .filter(([id]) => id !== 'townHallLevel')
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
