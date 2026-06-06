import { dom } from '../../dom/domElements.js';

import { formatNumber } from '../../utils/numberFormatter.js';
import { leagueTiers } from '../../data/appData.js';

export function renderStarBonusDisplay(starBonusIncome, league, playerData, timeframe) {
    const incomeTabElements = dom.income.starBonus.display;

    if (!incomeTabElements) return;

    if (incomeTabElements.monthly?.shiny) incomeTabElements.monthly.shiny.textContent = formatNumber(Math.round(starBonusIncome.monthly?.shiny || 0));
    if (incomeTabElements.monthly?.glowy) incomeTabElements.monthly.glowy.textContent = formatNumber(Math.round(starBonusIncome.monthly?.glowy || 0));
    if (incomeTabElements.monthly?.starry) incomeTabElements.monthly.starry.textContent = formatNumber(Math.round(starBonusIncome.monthly?.starry || 0));

    if (incomeTabElements.daily?.shiny) incomeTabElements.daily.shiny.textContent = formatNumber(Math.round(starBonusIncome.daily?.shiny || 0));
    if (incomeTabElements.daily?.glowy) incomeTabElements.daily.glowy.textContent = formatNumber(Math.round(starBonusIncome.daily?.glowy || 0));
    if (incomeTabElements.daily?.starry) incomeTabElements.daily.starry.textContent = formatNumber(Math.round(starBonusIncome.daily?.starry || 0));
}