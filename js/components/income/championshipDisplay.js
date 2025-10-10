import { dom } from '../../dom/domElements.js';
import { formatNumber } from '../../utils/numberFormatter.js';

export function renderChampionshipDisplay(championshipIncome, timeframe) {
    const championshipElements = dom.income.championship.display;

    if (!championshipElements) return;

    const timeframeIncome = championshipIncome[timeframe] || {};

    if (championshipElements.perEvent?.shiny) championshipElements.perEvent.shiny.textContent = formatNumber(Math.round(championshipIncome.perEvent?.shiny || 0));
    if (championshipElements.perEvent?.glowy) championshipElements.perEvent.glowy.textContent = formatNumber(Math.round(championshipIncome.perEvent?.glowy || 0));
    if (championshipElements.perEvent?.starry) championshipElements.perEvent.starry.textContent = formatNumber(Math.round(championshipIncome.perEvent?.starry || 0));

    if (championshipElements.monthly?.shiny) championshipElements.monthly.shiny.textContent = formatNumber(Math.round(championshipIncome.monthly?.shiny || 0));
    if (championshipElements.monthly?.glowy) championshipElements.monthly.glowy.textContent = formatNumber(Math.round(championshipIncome.monthly?.glowy || 0));
    if (championshipElements.monthly?.starry) championshipElements.monthly.starry.textContent = formatNumber(Math.round(championshipIncome.monthly?.starry || 0));
}

export function renderChampionshipHomeDisplay(championshipIncome, timeframe) {
    const homeElements = dom.income.home.incomeCard.table.championship;

    if (!homeElements) return;

    const timeframeIncome = championshipIncome[timeframe] || {};

    if (homeElements.shiny) {
        homeElements.shiny.textContent = formatNumber(Math.round(timeframeIncome.shiny || 0));
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = formatNumber(Math.round(timeframeIncome.glowy || 0));
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = formatNumber(Math.round(timeframeIncome.starry || 0));
    }

}
