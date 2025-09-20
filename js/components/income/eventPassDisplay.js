import { dom } from '../../dom/domElements.js';
import { translate } from '../../i18n/translator.js';
import { formatNumber, formatCurrency } from '../../utils/numberFormatter.js';

export function renderEventPassHomeDisplay(eventPassIncome, timeframe, uiSettings) {
    const homeElements = dom.income.home.incomeCard.table.eventPass;
    const incomeTabDisplayElements = dom.income.eventPass.display;
    if (!homeElements || !incomeTabDisplayElements) return;

    const timeframeIncome = eventPassIncome[timeframe] || {};

    if (homeElements.shiny) {
        homeElements.shiny.textContent = formatNumber(Math.round(timeframeIncome.shiny || 0));
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = formatNumber(Math.round(timeframeIncome.glowy || 0));
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = formatNumber(Math.round(timeframeIncome.starry || 0));
    }
    if (homeElements.resource) {
        if (eventPassIncome.type === 'event') {
            const selectedCurrencyKey = uiSettings.currency.toUpperCase();
            const cost = eventPassIncome.monthly?.[selectedCurrencyKey] || eventPassIncome.monthly?.USD || 0;
            homeElements.resource.textContent = `${uiSettings.currencySymbol} ${formatCurrency(cost)}`;
        } else {
            homeElements.resource.textContent = translate('free_pass');
        }
    }

    if (incomeTabDisplayElements.monthly?.shiny) incomeTabDisplayElements.monthly.shiny.textContent = formatNumber(Math.round(eventPassIncome.monthly?.shiny || 0));
    if (incomeTabDisplayElements.monthly?.glowy) incomeTabDisplayElements.monthly.glowy.textContent = formatNumber(Math.round(eventPassIncome.monthly?.glowy || 0));
    if (incomeTabDisplayElements.monthly?.starry) incomeTabDisplayElements.monthly.starry.textContent = formatNumber(Math.round(eventPassIncome.monthly?.starry || 0));

    if (incomeTabDisplayElements.bimonthly?.shiny) incomeTabDisplayElements.bimonthly.shiny.textContent = formatNumber(Math.round(eventPassIncome.bimonthly?.shiny || 0));
    if (incomeTabDisplayElements.bimonthly?.glowy) incomeTabDisplayElements.bimonthly.glowy.textContent = formatNumber(Math.round(eventPassIncome.bimonthly?.glowy || 0));
    if (incomeTabDisplayElements.bimonthly?.starry) incomeTabDisplayElements.bimonthly.starry.textContent = formatNumber(Math.round(eventPassIncome.bimonthly?.starry || 0));
}