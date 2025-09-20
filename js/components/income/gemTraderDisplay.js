import { dom } from '../../dom/domElements.js';
import { translate } from '../../i18n/translator.js';
import { formatNumber } from '../../utils/numberFormatter.js';

export function renderGemHomeDisplay(gemIncome, timeframe) {
    const homeElements = dom.income.home.incomeCard.table.gem;
    const incomeTabDisplayElements = dom.income.gems.display;
    if (!homeElements || !incomeTabDisplayElements) return;

    const timeframeIncome = gemIncome[timeframe] || {};

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
        homeElements.resource.textContent = translate('gems_per_week', { count: gemIncome.cost || 0 });
    }

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.gems) {
        homeResourceElements.gems.textContent = gemIncome.cost || 0;
    }

    if (incomeTabDisplayElements.monthly?.shiny) incomeTabDisplayElements.monthly.shiny.textContent = formatNumber(Math.round(gemIncome.monthly?.shiny || 0));
    if (incomeTabDisplayElements.monthly?.glowy) incomeTabDisplayElements.monthly.glowy.textContent = formatNumber(Math.round(gemIncome.monthly?.glowy || 0));
    if (incomeTabDisplayElements.monthly?.starry) incomeTabDisplayElements.monthly.starry.textContent = formatNumber(Math.round(gemIncome.monthly?.starry || 0));

    if (incomeTabDisplayElements.weekly?.shiny) incomeTabDisplayElements.weekly.shiny.textContent = formatNumber(Math.round(gemIncome.weekly?.shiny || 0));
    if (incomeTabDisplayElements.weekly?.glowy) incomeTabDisplayElements.weekly.glowy.textContent = formatNumber(Math.round(gemIncome.weekly?.glowy || 0));
    if (incomeTabDisplayElements.weekly?.starry) incomeTabDisplayElements.weekly.starry.textContent = formatNumber(Math.round(gemIncome.weekly?.starry || 0));
}