import { dom } from '../../dom/domElements.js';

export function renderEventPassHomeDisplay(eventPassIncome, timeframe, uiSettings) {
    const homeElements = dom.income.home.incomeCard.table.eventPass;
    const incomeTabDisplayElements = dom.income.eventPass.display;
    if (!homeElements || !incomeTabDisplayElements) return;

    const timeframeIncome = eventPassIncome[timeframe] || {};

    if (homeElements.shiny) {
        homeElements.shiny.textContent = Math.round(timeframeIncome.shiny || 0).toLocaleString();
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = Math.round(timeframeIncome.glowy || 0).toLocaleString();
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = Math.round(timeframeIncome.starry || 0).toLocaleString();
    }
    if (homeElements.resource) {
        if (eventPassIncome.type === 'event') {
            const selectedCurrencyKey = uiSettings.currency.toUpperCase();
            const cost = eventPassIncome.monthly?.[selectedCurrencyKey] || eventPassIncome.monthly?.USD || 0;
            homeElements.resource.textContent = `${uiSettings.currencySymbol} ${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
            homeElements.resource.textContent = 'Free Pass';
        }
    }

    if (incomeTabDisplayElements.monthly?.shiny) incomeTabDisplayElements.monthly.shiny.textContent = Math.round(eventPassIncome.monthly?.shiny || 0).toLocaleString();
    if (incomeTabDisplayElements.monthly?.glowy) incomeTabDisplayElements.monthly.glowy.textContent = Math.round(eventPassIncome.monthly?.glowy || 0).toLocaleString();
    if (incomeTabDisplayElements.monthly?.starry) incomeTabDisplayElements.monthly.starry.textContent = Math.round(eventPassIncome.monthly?.starry || 0).toLocaleString();

    if (incomeTabDisplayElements.bimonthly?.shiny) incomeTabDisplayElements.bimonthly.shiny.textContent = Math.round(eventPassIncome.bimonthly?.shiny || 0).toLocaleString();
    if (incomeTabDisplayElements.bimonthly?.glowy) incomeTabDisplayElements.bimonthly.glowy.textContent = Math.round(eventPassIncome.bimonthly?.glowy || 0).toLocaleString();
    if (incomeTabDisplayElements.bimonthly?.starry) incomeTabDisplayElements.bimonthly.starry.textContent = Math.round(eventPassIncome.bimonthly?.starry || 0).toLocaleString();
}