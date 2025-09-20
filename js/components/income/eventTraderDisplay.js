import { dom } from '../../dom/domElements.js';
import { translate } from '../../i18n/translator.js';
import { formatNumber } from '../../utils/numberFormatter.js';

export function renderEventTraderHomeDisplay(eventTraderIncome, timeframe) {
    const homeElements = dom.income.home.incomeCard.table.eventTrader;
    const incomeTabDisplayElements = dom.income.eventTrader.display;
    const incomeTabSummaryElements = dom.income.eventTrader;
    if (!homeElements || !incomeTabDisplayElements || !incomeTabSummaryElements) return;

    const timeframeIncome = eventTraderIncome[timeframe] || {};

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
        homeElements.resource.textContent = translate('event_medals_resource', { count: eventTraderIncome.cost || 0 });
    }

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.eventMedals) {
        homeResourceElements.eventMedals.textContent = eventTraderIncome.cost || 0;
    }

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