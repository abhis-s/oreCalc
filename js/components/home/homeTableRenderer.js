import { dom } from '../../dom/domElements.js';

import { formatNumber } from '../../utils/numberFormatter.js';
import { incomeData } from '../../data/incomeSourceRegistry.js';
import { translate } from '../../i18n/translator.js';

export function renderHomeIncomeTable(state) {
    const tableBody = dom.income?.home?.incomeCard?.table?.body;
    if (!tableBody) return;

    const timeframe = state.uiSettings.incomeCard?.timeframe || 'monthly';
    const sources = state.derived.incomeSources;
    
    let html = '';

    for (const key in incomeData) {
        const sourceConfig = incomeData[key];
        if (!sourceConfig.showInHomeTable) continue;

        const income = sources[key] || {};
        const timeframeIncome = income[timeframe] || {};
        
        let resourceString = '';
        if (sourceConfig.getResourceString) {
            resourceString = sourceConfig.getResourceString(state);
        }

        const shinyValue = formatNumber(Math.round(timeframeIncome.shiny || 0));
        const glowyValue = formatNumber(Math.round(timeframeIncome.glowy || 0));
        const starryValue = formatNumber(Math.round(timeframeIncome.starry || 0));

        html += `
        <div class="income-table-row">
            <div class="income-table-cell" data-i18n="${sourceConfig.nameI18nKey}">${translate(sourceConfig.nameI18nKey)}</div>
            <div class="income-table-cell income-table-value calculated">${shinyValue}</div>
            <div class="income-table-cell income-table-value calculated">${glowyValue}</div>
            <div class="income-table-cell income-table-value calculated">${starryValue}</div>
            <div class="income-table-cell income-table-resource calculated">${resourceString}</div>
        </div>
        `;
    }

    tableBody.innerHTML = html;
}
