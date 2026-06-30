import { dom } from '../../dom/domElements.js';
import { state } from '../../core/state.js';

import { calculateEventPassIncome } from '../../incomeCalculations/eventPassIncome.js';

import { addValidation } from '../../utils/inputValidator.js';
import { eventTraderData } from '../../data/appData.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { translate } from '../../i18n/translator.js';

import { renderOfferGrid } from '../common/offerGrid.js';

export function renderEventTraderRow(offer, packs) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';

    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
    const oreAmount = offer[oreType];

    const oreName = translate('ores.' + oreType);
    const offerName = `${oreAmount} ${oreName}`;
    const ariaLabel = translate('income.supercellEvents.packInput', { name: offerName });

    row.innerHTML = `
        <div class="offer-cost-display"><orecalc-assets-image src="assets/resources/eventMedal.png" alt="Event Medals" class="ore-image event-medal-icon" size="thumbnail"></orecalc-assets-image> ${offer.cost}</div>
        <div class="offer-ore-display"><span>${oreAmount}</span> <orecalc-assets-image src="assets/${oreType}_ore.png" alt="${oreType.charAt(0).toUpperCase() + oreType.slice(1)} Ore" class="ore-image"></orecalc-assets-image></div>
        <div class="offer-input-instance">
            <div class="popover-wrapper">
                <input type="number" class="updatable offer-input-number" id="event-trader-${offer.id}-input" value="${packs}" min="0" max="${offer.maxPacks}" maxlength="2" data-offer-id="${offer.id}" aria-label="${ariaLabel}">
            </div>
        </div>
    `;

    return row;
}

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
                    addValidation(input, { inputName: translate('ores.' + oreType) });
                    
                    if (oreType === 'shiny') {
                        registerInputPopover(input, {
                            title: () => translate('ores.shiny'),
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
                            title: () => translate('ores.' + oreType),
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

export function renderEventTraderIncomeTabDisplay(eventTraderIncome) {
    const incomeTabDisplayElements = dom.income?.eventTrader?.display;
    const incomeTabSummaryElements = dom.income?.eventTrader;
    if (!incomeTabDisplayElements || !incomeTabSummaryElements) return;

    if (incomeTabDisplayElements.monthly?.shiny) incomeTabDisplayElements.monthly.shiny.textContent = formatNumber(Math.round(eventTraderIncome.monthly?.shiny || 0));
    if (incomeTabDisplayElements.monthly?.glowy) incomeTabDisplayElements.monthly.glowy.textContent = formatNumber(Math.round(eventTraderIncome.monthly?.glowy || 0));
    if (incomeTabDisplayElements.monthly?.starry) incomeTabDisplayElements.monthly.starry.textContent = formatNumber(Math.round(eventTraderIncome.monthly?.starry || 0));

    if (incomeTabDisplayElements.bimonthly?.shiny) incomeTabDisplayElements.bimonthly.shiny.textContent = formatNumber(Math.round(eventTraderIncome.bimonthly?.shiny || 0));
    if (incomeTabDisplayElements.bimonthly?.glowy) incomeTabDisplayElements.bimonthly.glowy.textContent = formatNumber(Math.round(eventTraderIncome.bimonthly?.glowy || 0));
    if (incomeTabDisplayElements.bimonthly?.starry) incomeTabDisplayElements.bimonthly.starry.textContent = formatNumber(Math.round(eventTraderIncome.bimonthly?.starry || 0));

    if (incomeTabSummaryElements.total) {
        incomeTabSummaryElements.total.textContent = formatNumber(Math.round(eventTraderIncome.totalMedalsEarned || 0));
    }

    if (incomeTabSummaryElements.remaining) {
        incomeTabSummaryElements.remaining.textContent = formatNumber(Math.round(eventTraderIncome.remaining || 0));
        incomeTabSummaryElements.remaining.classList.toggle("negative-medals", eventTraderIncome.remaining < 0);
    }
}