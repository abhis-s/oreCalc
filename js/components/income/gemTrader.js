import { dom } from '../../dom/domElements.js';
import { initializeOfferGrid, renderOfferGrid } from '../common/offerGrid.js';
import { gemTraderData } from '../../data/appData.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';
import { formatNumber } from '../../utils/numberFormatter.js';

let isResponsive = false;

function renderGemTraderRow(offer, offerState) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';

    const costDisplay = document.createElement('div');
    costDisplay.className = 'offer-cost-display';
    costDisplay.innerHTML = `<img src="assets/resources/gem.png" alt="${translate('gem')}" class="ore-image gem-icon"> ${formatNumber(offer.cost)}`;

    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
    const oreValue = offer.shiny || offer.glowy || offer.starry;
    const oreImage = `assets/${oreType}_ore.png`;
    const oreDisplay = document.createElement('div');
    oreDisplay.className = 'offer-ore-display';
    oreDisplay.innerHTML = `<span>${formatNumber(oreValue)}</span><img src="${oreImage}" alt="${translate(`${oreType}_ore`)}" class="ore-image">`;

    row.appendChild(costDisplay);
    row.appendChild(oreDisplay);

    if (oreType === 'shiny' && isResponsive) {
        const dropdownDiv = document.createElement('div');
        dropdownDiv.className = 'offer-dropdown-instance';
        const select = document.createElement('select');
        select.className = 'offer-input-dropdown dropdown-style';
        select.id = `gem-trader-${offer.id}-dropdown`;
        select.dataset.offerId = offer.id;
        for (let i = 0; i <= offer.maxPacks; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            select.appendChild(option);
        }
        select.value = offerState;
        select.addEventListener('change', (e) => {
            const selectedValue = parseInt(e.target.value, 10);
            updateGemTraderState(offer.id, oreType, selectedValue);
        });
        dropdownDiv.appendChild(select);
        row.appendChild(dropdownDiv);
    } else {
        let maxPossiblePacks = 0;
        maxPossiblePacks = isResponsive ? 2 : 5;
        for (let i = 1; i <= maxPossiblePacks; i++) {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'offer-checkbox-instance';
            if (i <= offer.maxPacks) {
                const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.instance = i;
            checkbox.id = `${offer.id}_${i + 1}`;
            checkbox.checked = i <= offerState;
                checkboxDiv.appendChild(checkbox);
            }
            row.appendChild(checkboxDiv);
        }
    }
    return row;
}

function updateGemTraderState(offerId, oreType, count) {
    handleStateUpdate(() => { state.income.gems.packs[oreType] = count; });
}

export function initializeGemTrader() {
    const container = dom.income?.gems?.offersContainer;
    if (!container) return;

    initializeOfferGrid({
        container,
        offers: gemTraderData,
        onStateChange: updateGemTraderState,
        renderRow: renderGemTraderRow
    });

    const incomeCardElement = container.closest('.income-card');
    if (incomeCardElement) {
        incomeCardElement.addEventListener('cardsizechanged', (event) => {
            isResponsive = event.detail.newSize === 1;
            renderGemTraderGrid(state.income.gems);
        });
    }
}

export function renderGemTraderGrid(gemState) {
    const container = dom.income?.gems?.offersContainer;
    if (!container) return;

    renderOfferGrid({
        container,
        offers: gemTraderData,
        stateSelector: (offer) => {
            const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
            return gemState.packs[oreType] || 0;
        },
        renderRow: renderGemTraderRow
    });
}