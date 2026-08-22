import { gemTraderData } from '../../data/incomeSources/traders.js';
import { translate } from '../../i18n/translator.js';

import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';
import { formatNumber, updateCalculatedValue } from '../../utils/numberFormatter.js';

import { renderOfferGrid } from '../common/offerGrid.js';
import { dom } from '../../dom/domElements.js';

/**
 * Renders a single Gem Trader offer row element.
 * @param {any} offer - Gem Trader offer configuration.
 * @param {number} offerState - Current pack count selected.
 * @returns {HTMLDivElement} Rendered offer grid row DOM element.
 */
export function renderGemTraderRow(offer, offerState) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';

    const costDisplay = document.createElement('div');
    costDisplay.className = 'offer-cost-display';
    costDisplay.innerHTML = `<orecalc-assets-image src="assets/resources/gem.png" alt="${translate('views.income.ores.gem')}" class="ore-image gem-icon" size="thumbnail"></orecalc-assets-image> ${formatNumber(offer.cost)}`;

    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
    const oreValue = offer.shiny || offer.glowy || offer.starry;
    const oreImage = `assets/${oreType}_ore.png`;
    const oreDisplay = document.createElement('div');
    oreDisplay.className = 'offer-ore-display';
    oreDisplay.innerHTML = `<span>${formatNumber(oreValue)}</span><orecalc-assets-image src="${oreImage}" alt="${translate('entities.ores.' + oreType)}" class="ore-image" size="thumbnail"></orecalc-assets-image>`;

    const oreName = translate('entities.ores.' + oreType);
    const offerName = `${formatNumber(oreValue)} ${oreName}`;
    const ariaLabel = translate('views.income.supercellEvents.packInput', { name: offerName });

    const inputDiv = document.createElement('div');
    inputDiv.className = 'offer-input-instance';
    inputDiv.innerHTML = `
        <div class="popover-wrapper">
            <input type="number" class="updatable offer-input-number" id="gem-trader-${offer.id}-input" value="${offerState || 0}" min="0" max="${offer.maxPacks || 10}" maxlength="2" data-offer-id="${offer.id}" aria-label="${ariaLabel}" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false">
        </div>
    `;

    row.appendChild(costDisplay);
    row.appendChild(oreDisplay);
    row.appendChild(inputDiv);

    return row;
}

/**
 * Renders or updates the Gem Trader offers grid based on state.
 * @param {import('../../core/types.js').GemTraderIncomeState} [gemState] - Active Gem Trader state object.
 */
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
            renderRow: renderGemTraderRow,
            onRowAppended: (rowElement, offer) => {
                const input = rowElement.querySelector('input[type="number"]');
                if (input) {
                    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
                    const maxPacks = offer.maxPacks || 10;
                    addValidation(input, { inputName: translate('entities.ores.' + oreType) });
                    registerInputPopover(input, {
                        title: () => translate('entities.ores.' + oreType),
                        min: 0,
                        max: maxPacks,
                        step: 1,
                        clickToFill: { max: true }
                    });
                }
            }
        });
    } else {
        gemTraderData.forEach(offer => {
            const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
            const input = container.querySelector(`input[data-offer-id="${offer.id}"]`);
            if (input && document.activeElement !== input) {
                const expectedValue = safeState.packs?.[oreType] || 0;
                if (parseInt(input.value, 10) !== expectedValue) {
                    input.value = expectedValue;
                }
            }
        });
    }
}

/**
 * Renders calculated Gem Trader ore income values to DOM elements.
 * @param {import('../../core/types.js').IncomeResult} gemIncome - Calculated Gem Trader income results.
 */
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
