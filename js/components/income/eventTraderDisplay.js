import { eventTraderData } from '../../data/incomeSources/traders.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { calculateEventPassIncome } from '../../domain/income/eventPassIncome.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';
import { formatNumber, updateCalculatedValue } from '../../utils/numberFormatter.js';

import { renderOfferGrid } from '../common/offerGrid.js';
import { dom } from '../../dom/domElements.js';

/**
 * Renders a single Event Trader offer row element.
 * @param {any} offer - Offer definition object with costs and limits.
 * @param {number} packs - Number of selected packs.
 * @returns {HTMLDivElement} Rendered offer grid row DOM element.
 */
export function renderEventTraderRow(offer, packs) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';

    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
    const oreAmount = offer[oreType];

    const oreName = translate('entities.ores.' + oreType);
    const offerName = `${oreAmount} ${oreName}`;
    const ariaLabel = translate('views.income.supercellEvents.packInput', { name: offerName });

    row.innerHTML = `
        <div class="offer-cost-display"><orecalc-assets-image src="assets/resources/eventMedal.png" alt="Event Medals" class="ore-image event-medal-icon" size="thumbnail"></orecalc-assets-image> ${offer.cost}</div>
        <div class="offer-ore-display"><span>${oreAmount}</span> <orecalc-assets-image src="assets/${oreType}_ore.png" alt="${oreType.charAt(0).toUpperCase() + oreType.slice(1)} Ore" class="ore-image"></orecalc-assets-image></div>
        <div class="offer-input-instance">
            <div class="popover-wrapper">
                <input type="number" class="updatable offer-input-number" id="event-trader-${offer.id}-input" value="${packs}" min="0" max="${offer.maxPacks}" maxlength="2" data-offer-id="${offer.id}" aria-label="${ariaLabel}" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false">
            </div>
        </div>
    `;

    return row;
}

/**
 * Renders or updates the Event Trader offers grid based on state.
 * @param {import('../../core/types.js').EventTraderIncomeState} [eventTraderState] - Active Event Trader state object.
 */
export function renderEventTraderGrid(eventTraderState) {
    const offersContainer = dom.income?.eventTrader?.offersContainer;
    if (!offersContainer) return;

    const safeState = eventTraderState || { packs: {} };

    const rows = offersContainer.querySelectorAll('.offer-grid-row');
    if (rows.length === 0) {
        renderOfferGrid({
            container: offersContainer,
            offers: eventTraderData,
            stateSelector: (offer) => {
                const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
                return safeState.packs?.[oreType] || 0;
            },
            renderRow: renderEventTraderRow,
            onRowAppended: (rowElement, offer) => {
                const input = rowElement.querySelector('input[type="number"]');
                if (input) {
                    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
                    addValidation(input, { inputName: translate('entities.ores.' + oreType) });

                    if (oreType === 'shiny') {
                        registerInputPopover(input, {
                            title: () => translate('entities.ores.shiny'),
                            min: 0,
                            max: offer.maxPacks,
                            showRecommended: false,
                            clickToFill: { max: true }
                        });
                    } else {
                        const getRecommendedVal = () => {
                            const eventPassIncome = calculateEventPassIncome(state.income.eventPass);
                            const availableMedals = eventPassIncome?.availableMedals || 0;

                            let otherPacksCost = 0;
                            eventTraderData.forEach(o => {
                                const oType = o.shiny ? 'shiny' : o.glowy ? 'glowy' : 'starry';
                                if (oType !== oreType) {
                                    const count = state.income.eventTrader?.packs?.[oType] || 0;
                                    otherPacksCost += count * o.cost;
                                }
                            });

                            const remainingMedalsForThis = availableMedals - otherPacksCost;
                            return Math.max(0, Math.min(offer.maxPacks, Math.floor(remainingMedalsForThis / offer.cost)));
                        };

                        registerInputPopover(input, {
                            title: () => translate('entities.ores.' + oreType),
                            min: 0,
                            max: offer.maxPacks,
                            showRecommended: () => getRecommendedVal() > 0,
                            recommended: getRecommendedVal,
                            clickToFill: { max: true, recommended: true }
                        });
                    }
                }
            }
        });
    } else {
        eventTraderData.forEach(offer => {
            const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
            const input = offersContainer.querySelector(`input[data-offer-id="${offer.id}"]`);
            if (input) {
                const expectedValue = safeState.packs?.[oreType] || 0;
                if (parseInt(input.value, 10) !== expectedValue) {
                    input.value = expectedValue;
                }
            }
        });
    }
}

/**
 * Renders calculated Event Trader ore income and medal summaries.
 * @param {import('../../core/types.js').IncomeResult} eventTraderIncome - Calculated Event Trader income and medal summary object.
 */
export function renderEventTraderIncomeTabDisplay(eventTraderIncome) {
    const incomeTabDisplayElements = dom.income?.eventTrader?.display;
    const incomeTabSummaryElements = dom.income?.eventTrader;
    if (!incomeTabDisplayElements || !incomeTabSummaryElements) return;

    updateCalculatedValue(incomeTabDisplayElements.monthly?.shiny, eventTraderIncome.monthly?.shiny || 0);
    updateCalculatedValue(incomeTabDisplayElements.monthly?.glowy, eventTraderIncome.monthly?.glowy || 0);
    updateCalculatedValue(incomeTabDisplayElements.monthly?.starry, eventTraderIncome.monthly?.starry || 0);

    updateCalculatedValue(incomeTabDisplayElements.bimonthly?.shiny, eventTraderIncome.bimonthly?.shiny || 0);
    updateCalculatedValue(incomeTabDisplayElements.bimonthly?.glowy, eventTraderIncome.bimonthly?.glowy || 0);
    updateCalculatedValue(incomeTabDisplayElements.bimonthly?.starry, eventTraderIncome.bimonthly?.starry || 0);

    if (incomeTabSummaryElements.total) {
        updateCalculatedValue(incomeTabSummaryElements.total, eventTraderIncome.totalMedalsEarned || 0);
    }

    if (incomeTabSummaryElements.remaining) {
        updateCalculatedValue(incomeTabSummaryElements.remaining, eventTraderIncome.remaining || 0);
        incomeTabSummaryElements.remaining.classList.toggle("negative-medals", eventTraderIncome.remaining < 0);
    }
}
