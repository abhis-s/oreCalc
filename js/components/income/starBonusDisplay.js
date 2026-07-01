import { dom } from '../../dom/domElements.js';

import { updateCalculatedValue } from '../../utils/numberFormatter.js';
import { leagueTiers } from '../../data/appData.js';

export function renderStarBonusDisplay(starBonusIncome, league, playerData, timeframe) {
    const incomeTabElements = dom.income.starBonus.display;

    if (!incomeTabElements) return;

    updateCalculatedValue(incomeTabElements.monthly?.shiny, starBonusIncome.monthly?.shiny || 0);
    updateCalculatedValue(incomeTabElements.monthly?.glowy, starBonusIncome.monthly?.glowy || 0);
    updateCalculatedValue(incomeTabElements.monthly?.starry, starBonusIncome.monthly?.starry || 0);

    updateCalculatedValue(incomeTabElements.daily?.shiny, starBonusIncome.daily?.shiny || 0);
    updateCalculatedValue(incomeTabElements.daily?.glowy, starBonusIncome.daily?.glowy || 0);
    updateCalculatedValue(incomeTabElements.daily?.starry, starBonusIncome.daily?.starry || 0);
}