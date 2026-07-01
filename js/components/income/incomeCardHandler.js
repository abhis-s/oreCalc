import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';

import { currencyData } from '../../data/appData.js';
import { formatNumber, formatCurrency, updateCalculatedValue } from '../../utils/numberFormatter.js';

export function initializeIncomeCardHandler() {
    // 1. Card Help Popover Setup
    let helpPopover = document.getElementById('card-help-popover');
    if (!helpPopover) {
        helpPopover = document.createElement('div');
        helpPopover.id = 'card-help-popover';
        helpPopover.className = 'card-help-popover';
        document.body.appendChild(helpPopover);
    }

    let activeHelpBtn = null;

    const hideHelpPopover = () => {
        if (helpPopover) {
            helpPopover.classList.remove('show');
        }
        activeHelpBtn = null;
    };

    const showHelpPopover = (btn, text) => {
        if (activeHelpBtn === btn) {
            hideHelpPopover();
            return;
        }

        activeHelpBtn = btn;
        helpPopover.innerHTML = text;
        helpPopover.classList.add('show');

        const positionPopover = () => {
            if (activeHelpBtn !== btn) return;
            const popoverRect = helpPopover.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();

            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            const spaceAbove = btnRect.top;
            const spaceBelow = viewportHeight - btnRect.bottom;

            const placeBelow = spaceAbove < popoverRect.height + 10;

            let top = 0;
            if (placeBelow) {
                top = btnRect.bottom + 6;
            } else {
                top = btnRect.top - popoverRect.height - 6;
            }

            let left = btnRect.left + (btnRect.width / 2) - (popoverRect.width / 2);

            if (left < 12) {
                left = 12;
            } else if (left + popoverRect.width > viewportWidth - 12) {
                left = viewportWidth - popoverRect.width - 12;
            }

            helpPopover.style.top = `${top}px`;
            helpPopover.style.left = `${left}px`;
        };

        positionPopover();
        setTimeout(positionPopover, 0);
    };

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.info-btn');
        if (btn) {
            e.stopPropagation();
            const infoKey = btn.getAttribute('data-info');
            const text = translate(infoKey);
            showHelpPopover(btn, text);
        } else {
            hideHelpPopover();
        }
    });

    window.addEventListener('scroll', hideHelpPopover, { capture: true, passive: true });
    window.addEventListener('resize', hideHelpPopover, { passive: true });

    // 2. Timeframe Selection Setup
    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;

    if (!timeframeSelect) return;

    timeframeSelect.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.uiSettings.summaryTimeframe = e.target.value;
        });
    });
}

export function renderIncomeCard(totalIncome, uiSettings, totalMoneyCost) {
    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;

    if (!timeframeSelect) return;

    const timeframe = uiSettings.summaryTimeframe || 'monthly';
    timeframeSelect.value = timeframe;

    const footerShiny = dom.income?.home?.incomeCard?.table?.totalRow?.shiny;
    const footerGlowy = dom.income?.home?.incomeCard?.table?.totalRow?.glowy;
    const footerStarry = dom.income?.home?.incomeCard?.table?.totalRow?.starry;

    updateCalculatedValue(footerShiny, totalIncome.shiny || 0);
    updateCalculatedValue(footerGlowy, totalIncome.glowy || 0);
    updateCalculatedValue(footerStarry, totalIncome.starry || 0);

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.moneyValue) {
        const selectedCurrencyKey = uiSettings.currency.code.toUpperCase();
        const moneyValue = totalMoneyCost?.[selectedCurrencyKey] || totalMoneyCost?.USD || 0;
        const symbol = currencyData[uiSettings.currency.code]?.symbol || '';
        homeResourceElements.moneyValue.textContent = formatCurrency(moneyValue);
        homeResourceElements.moneySymbol.textContent = symbol;
    }
}
