import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

import { currencyData } from '../../data/appData.js';
import { formatNumber, formatCurrency } from '../../utils/numberFormatter.js';

export function initializeIncomeCardHandler() {
    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;

    if (!timeframeSelect) return;

    timeframeSelect.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            if (!state.uiSettings.incomeCard) {
                state.uiSettings.incomeCard = { timeframe: 'monthly' };
            }
            state.uiSettings.incomeCard.timeframe = e.target.value;
        });
    });
}

export function renderIncomeCard(totalIncome, uiSettings, totalMoneyCost) {
    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;

    if (!timeframeSelect) return;

    const timeframe = uiSettings.incomeCard?.timeframe || 'monthly';
    timeframeSelect.value = timeframe;

    const footerShiny = dom.income?.home?.incomeCard?.table?.totalRow?.shiny;
    const footerGlowy = dom.income?.home?.incomeCard?.table?.totalRow?.glowy;
    const footerStarry = dom.income?.home?.incomeCard?.table?.totalRow?.starry;

    if (footerShiny) footerShiny.textContent = formatNumber(Math.round(totalIncome.shiny || 0));
    if (footerGlowy) footerGlowy.textContent = formatNumber(Math.round(totalIncome.glowy || 0));
    if (footerStarry) footerStarry.textContent = formatNumber(Math.round(totalIncome.starry || 0));

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.moneyValue) {
        const selectedCurrencyKey = uiSettings.currency.code.toUpperCase();
        const moneyValue = totalMoneyCost?.[selectedCurrencyKey] || totalMoneyCost?.USD || 0;
        const symbol = currencyData[uiSettings.currency.code]?.symbol || '';
        homeResourceElements.moneyValue.textContent = formatCurrency(moneyValue);
        homeResourceElements.moneySymbol.textContent = symbol;
    }
}
