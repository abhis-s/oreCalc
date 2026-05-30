import { dom } from '../../dom/domElements.js';

import { formatCurrency, formatNumber } from '../../utils/numberFormatter.js';

import { translate } from '../../i18n/translator.js';

export function renderEventPassIncomeTabDisplay(eventPassIncome) {
    const incomeTabDisplayElements = dom.income.eventPass.display;
    if (!incomeTabDisplayElements) return;

    if (incomeTabDisplayElements.monthly?.shiny) incomeTabDisplayElements.monthly.shiny.textContent = formatNumber(Math.round(eventPassIncome.monthly?.shiny || 0));
    if (incomeTabDisplayElements.monthly?.glowy) incomeTabDisplayElements.monthly.glowy.textContent = formatNumber(Math.round(eventPassIncome.monthly?.glowy || 0));
    if (incomeTabDisplayElements.monthly?.starry) incomeTabDisplayElements.monthly.starry.textContent = formatNumber(Math.round(eventPassIncome.monthly?.starry || 0));

    if (incomeTabDisplayElements.bimonthly?.shiny) incomeTabDisplayElements.bimonthly.shiny.textContent = formatNumber(Math.round(eventPassIncome.bimonthly?.shiny || 0));
    if (incomeTabDisplayElements.bimonthly?.glowy) incomeTabDisplayElements.bimonthly.glowy.textContent = formatNumber(Math.round(eventPassIncome.bimonthly?.glowy || 0));
    if (incomeTabDisplayElements.bimonthly?.starry) incomeTabDisplayElements.bimonthly.starry.textContent = formatNumber(Math.round(eventPassIncome.bimonthly?.starry || 0));
}