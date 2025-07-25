import { dom } from '../../dom/domElements.js';

export function renderEventTraderHomeDisplay(eventTraderIncome, timeframe) {
    const homeElements = dom.income.home.incomeCard.table.eventTrader;
    const incomeTabDisplayElements = dom.income.eventTrader.display;
    const incomeTabSummaryElements = dom.income.eventTrader;
    if (!homeElements || !incomeTabDisplayElements || !incomeTabSummaryElements) return;

    const timeframeIncome = eventTraderIncome[timeframe] || {};

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
        homeElements.resource.textContent = `${eventTraderIncome.cost || 0} Event Medals`;
    }

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.eventMedals) {
        homeResourceElements.eventMedals.textContent = `Event Medals: ${eventTraderIncome.cost || 0}`;
    }

    if (incomeTabDisplayElements.monthly?.shiny) incomeTabDisplayElements.monthly.shiny.textContent = Math.round(eventTraderIncome.monthly?.shiny || 0).toLocaleString();
    if (incomeTabDisplayElements.monthly?.glowy) incomeTabDisplayElements.monthly.glowy.textContent = Math.round(eventTraderIncome.monthly?.glowy || 0).toLocaleString();
    if (incomeTabDisplayElements.monthly?.starry) incomeTabDisplayElements.monthly.starry.textContent = Math.round(eventTraderIncome.monthly?.starry || 0).toLocaleString();

    if (incomeTabDisplayElements.bimonthly?.shiny) incomeTabDisplayElements.bimonthly.shiny.textContent = Math.round(eventTraderIncome.bimonthly?.shiny || 0).toLocaleString();
    if (incomeTabDisplayElements.bimonthly?.glowy) incomeTabDisplayElements.bimonthly.glowy.textContent = Math.round(eventTraderIncome.bimonthly?.glowy || 0).toLocaleString();
    if (incomeTabDisplayElements.bimonthly?.starry) incomeTabDisplayElements.bimonthly.starry.textContent = Math.round(eventTraderIncome.bimonthly?.starry || 0).toLocaleString();

    if (incomeTabSummaryElements.total) {
        incomeTabSummaryElements.total.textContent = Math.round(eventTraderIncome.totalMedalsEarned || 0).toLocaleString();
    }

    if (incomeTabSummaryElements.remaining) {
        incomeTabSummaryElements.remaining.textContent = Math.round(eventTraderIncome.remaining || 0).toLocaleString();
        incomeTabSummaryElements.remaining.classList.toggle("negative-medals", eventTraderIncome.remaining < 0);
    }
}