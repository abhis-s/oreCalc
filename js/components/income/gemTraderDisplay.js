import { gemTraderData } from '../../data/appData.js';
import { dom } from '../../dom/domElements.js';

import { renderOfferGrid } from '../common/offerGrid.js';
import { updateGemTraderState } from './gemTraderInputs.js';

import { formatNumber } from '../../utils/numberFormatter.js';

import { translate } from '../../i18n/translator.js';

export function renderGemTraderRow(offer, offerState) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';

    const costDisplay = document.createElement('div');
    costDisplay.className = 'offer-cost-display';
    costDisplay.innerHTML = `<orecalc-assets-image src="assets/resources/gem.png" alt="${translate('ores.gem')}" class="ore-image gem-icon" size="thumbnail"></orecalc-assets-image> ${formatNumber(offer.cost)}`;

    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
    const oreValue = offer.shiny || offer.glowy || offer.starry;
    const oreImage = `assets/${oreType}_ore.png`;
    const oreDisplay = document.createElement('div');
    oreDisplay.className = 'offer-ore-display';
    oreDisplay.innerHTML = `<span>${formatNumber(oreValue)}</span><orecalc-assets-image src="${oreImage}" alt="${translate('ores.' + oreType)}" class="ore-image" size="thumbnail"></orecalc-assets-image>`;

    row.appendChild(costDisplay);
    row.appendChild(oreDisplay);

    if (oreType === 'shiny') {
        // Render BOTH dropdown and checkboxes for Shiny
        const dropdownDiv = document.createElement('div');
        dropdownDiv.className = 'offer-dropdown-instance';
        const select = document.createElement('select');
        select.className = 'offer-input-dropdown dropdown-style';
        select.id = `gem-trader-${offer.id}-dropdown`;
        select.name = `gem-trader-${offer.id}-dropdown`;
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
    }

    // Render checkboxes (up to 5)
    for (let i = 1; i <= 5; i++) {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'offer-checkbox-instance';
        if (i <= offer.maxPacks) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.offerId = offer.id;
            checkbox.dataset.instance = i;
            checkbox.id = `${offer.id}_${i}`;
            checkbox.name = `${offer.id}_${i}`;
            checkbox.checked = i <= offerState;
            checkboxDiv.appendChild(checkbox);
        }
        row.appendChild(checkboxDiv);
    }
    return row;
}

export function renderGemTraderGrid(gemState) {
    const container = dom.income?.gems?.offersContainer;
    if (!container) return;

    const safeState = gemState || { packs: {} };

    const rows = container.querySelectorAll('.offer-grid-row');
    if (rows.length === 0) {
        renderOfferGrid({
            container,
            offers: gemTraderData,
            stateSelector: (offer) => {
                const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
                return safeState.packs?.[oreType] || 0;
            },
            renderRow: renderGemTraderRow
        });
    } else {
        gemTraderData.forEach(offer => {
            const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
            const offerState = safeState.packs?.[oreType] || 0;

            if (oreType === 'shiny') {
                const select = container.querySelector(`select[data-offer-id="${offer.id}"]`);
                if (select && parseInt(select.value, 10) !== offerState) {
                    select.value = offerState;
                }
            }

            for (let i = 1; i <= 5; i++) {
                const checkbox = container.querySelector(`input[type="checkbox"][data-offer-id="${offer.id}"][data-instance="${i}"]`);
                if (checkbox) {
                    const expectedChecked = i <= offerState;
                    if (checkbox.checked !== expectedChecked) {
                        checkbox.checked = expectedChecked;
                    }
                }
            }
        });
    }
}

export function renderGemIncomeTabDisplay(gemIncome) {
    const incomeTabDisplayElements = dom.income?.gems?.display;
    if (!incomeTabDisplayElements) return;

    if (incomeTabDisplayElements.monthly?.shiny) incomeTabDisplayElements.monthly.shiny.textContent = formatNumber(Math.round(gemIncome.monthly?.shiny || 0));
    if (incomeTabDisplayElements.monthly?.glowy) incomeTabDisplayElements.monthly.glowy.textContent = formatNumber(Math.round(gemIncome.monthly?.glowy || 0));
    if (incomeTabDisplayElements.monthly?.starry) incomeTabDisplayElements.monthly.starry.textContent = formatNumber(Math.round(gemIncome.monthly?.starry || 0));

    if (incomeTabDisplayElements.weekly?.shiny) incomeTabDisplayElements.weekly.shiny.textContent = formatNumber(Math.round(gemIncome.weekly?.shiny || 0));
    if (incomeTabDisplayElements.weekly?.glowy) incomeTabDisplayElements.weekly.glowy.textContent = formatNumber(Math.round(gemIncome.weekly?.glowy || 0));
    if (incomeTabDisplayElements.weekly?.starry) incomeTabDisplayElements.weekly.starry.textContent = formatNumber(Math.round(gemIncome.weekly?.starry || 0));
}