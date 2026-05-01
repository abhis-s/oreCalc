import { dom } from '../../dom/domElements.js';
import { state } from '../../core/state.js';
import { formatNumber } from '../../utils/numberFormatter.js';

export function renderProspectorIncomeDisplay(prospectorIncome) {
    const dailyValues = prospectorIncome.daily || { shiny: 0, glowy: 0, starry: 0 };
    const monthlyValues = prospectorIncome.monthly || { shiny: 0, glowy: 0, starry: 0 };

    dom.income.prospector.display.daily.shiny.textContent = formatNumber(dailyValues.shiny);
    dom.income.prospector.display.daily.glowy.textContent = formatNumber(dailyValues.glowy);
    dom.income.prospector.display.daily.starry.textContent = formatNumber(dailyValues.starry);

    dom.income.prospector.display.monthly.shiny.textContent = formatNumber(monthlyValues.shiny);
    dom.income.prospector.display.monthly.glowy.textContent = formatNumber(monthlyValues.glowy);
    dom.income.prospector.display.monthly.starry.textContent = formatNumber(monthlyValues.starry);
}

export function renderProspectorHomeDisplay(prospectorIncome, timeframe) {
    const prospectorRow = dom.income.home.incomeCard.table.prospector;
    if (!prospectorRow) return;

    const timeframeIncome = prospectorIncome[timeframe] || { shiny: 0, glowy: 0, starry: 0 };

    prospectorRow.shiny.textContent = formatNumber(Math.round(timeframeIncome.shiny));
    prospectorRow.glowy.textContent = formatNumber(Math.round(timeframeIncome.glowy));
    prospectorRow.starry.textContent = formatNumber(Math.round(timeframeIncome.starry));

    const prospectorState = state.income.prospector;
    if (prospectorState.goldPass) {
        prospectorRow.resource.textContent = 'Gold Pass';
    } else {
        prospectorRow.resource.textContent = 'Silver Pass';
    }
}
