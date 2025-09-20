import { dom } from '../../dom/domElements.js';
import { eventTraderData } from '../../data/appData.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { addValidation } from '../../utils/inputValidator.js';
import { translate } from '../../i18n/translator.js';

function updateEventTraderState(e) {
    const offerId = e.target.dataset.offerId;
    const oreType = eventTraderData.find(o => o.id === offerId)?.id.split('_')[1];
    const value = e.detail.value;
    handleStateUpdate(() => { state.income.eventTrader.packs[oreType] = value; });
}

export function initializeEventTrader() {
    const offersContainer = dom.income?.eventTrader?.offersContainer;
    if (!offersContainer) return;

    const inputs = offersContainer.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        addValidation(input, { inputName: `${input.dataset.offerId} ${translate('packs')}` });
        input.addEventListener('validated-input', (e) => updateEventTraderState(e));
    });
}

export function renderEventTraderGrid(eventTraderState) {
    const offersContainer = dom.income?.eventTrader?.offersContainer;
    if (!offersContainer) return;

    eventTraderData.forEach(offer => {
        const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
        const input = offersContainer.querySelector(`input[data-offer-id="${offer.id}"]`);
        if (input) {
            input.value = eventTraderState.packs[oreType] || 0;
        }
    });
}