import { dom } from '../../dom/domElements.js';

import { formatNumber, updateCalculatedValue } from '../../utils/numberFormatter.js';
import { gemTraderData } from '../../data/appData.js';
import { translate } from '../../i18n/translator.js';

import { updateGemTraderState } from './gemTraderInputs.js';

import { renderOfferGrid } from '../common/offerGrid.js';

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
        
        const oreName = translate('ores.' + oreType);
        const offerName = `${formatNumber(oreValue)} ${oreName}`;
        select.setAttribute('aria-label', translate('income.supercellEvents.packInput', { name: offerName }));

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
            
            const oreName = translate('ores.' + oreType);
            const offerName = `${formatNumber(oreValue)} ${oreName}`;
            checkbox.setAttribute('aria-label', translate('income.shopOffers.packCheckbox', {
                num: i,
                name: offerName
            }));
            
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

    updateCalculatedValue(incomeTabDisplayElements.monthly?.shiny, gemIncome.monthly?.shiny || 0);
    updateCalculatedValue(incomeTabDisplayElements.monthly?.glowy, gemIncome.monthly?.glowy || 0);
    updateCalculatedValue(incomeTabDisplayElements.monthly?.starry, gemIncome.monthly?.starry || 0);

    updateCalculatedValue(incomeTabDisplayElements.weekly?.shiny, gemIncome.weekly?.shiny || 0);
    updateCalculatedValue(incomeTabDisplayElements.weekly?.glowy, gemIncome.weekly?.glowy || 0);
    updateCalculatedValue(incomeTabDisplayElements.weekly?.starry, gemIncome.weekly?.starry || 0);
}