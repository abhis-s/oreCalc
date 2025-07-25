import { dom } from '../../dom/domElements.js';

export function renderGemHomeDisplay(gemIncome, timeframe) {
    const homeElements = dom.income.home.incomeCard.table.gem;
    const incomeTabDisplayElements = dom.income.gems.display;
    if (!homeElements || !incomeTabDisplayElements) return;

    const timeframeIncome = gemIncome[timeframe] || {};

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
        homeElements.resource.textContent = `${gemIncome.cost || 0} Gems per week`;
    }

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.gems) {
        homeResourceElements.gems.textContent = `Gems: ${gemIncome.cost || 0}`;
    }

    if (incomeTabDisplayElements.monthly?.shiny) incomeTabDisplayElements.monthly.shiny.textContent = Math.round(gemIncome.monthly?.shiny || 0).toLocaleString();
    if (incomeTabDisplayElements.monthly?.glowy) incomeTabDisplayElements.monthly.glowy.textContent = Math.round(gemIncome.monthly?.glowy || 0).toLocaleString();
    if (incomeTabDisplayElements.monthly?.starry) incomeTabDisplayElements.monthly.starry.textContent = Math.round(gemIncome.monthly?.starry || 0).toLocaleString();

    if (incomeTabDisplayElements.weekly?.shiny) incomeTabDisplayElements.weekly.shiny.textContent = Math.round(gemIncome.weekly?.shiny || 0).toLocaleString();
    if (incomeTabDisplayElements.weekly?.glowy) incomeTabDisplayElements.weekly.glowy.textContent = Math.round(gemIncome.weekly?.glowy || 0).toLocaleString();
    if (incomeTabDisplayElements.weekly?.starry) incomeTabDisplayElements.weekly.starry.textContent = Math.round(gemIncome.weekly?.starry || 0).toLocaleString();
}