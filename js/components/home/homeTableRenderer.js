import { incomeData } from '../../data/incomeSourceRegistry.js';
import { translate } from '../../i18n/translator.js';

import { updateCalculatedValue } from '../../utils/numberFormatter.js';

import { dom } from '../../dom/domElements.js';

/**
 * Creates initial persistent HTML rows for the Home tab income table if missing.
 * @param {HTMLElement} tableBody - Container element.
 */
function ensureTableRows(tableBody) {
    const existingRows = tableBody.querySelectorAll ? tableBody.querySelectorAll('.income-table-row') : [];
    if (!existingRows || existingRows.length === 0) {
        let initialHtml = '';
        for (const key in incomeData) {
            const sourceConfig = incomeData[key];
            if (!sourceConfig.showInHomeTable) continue;
            initialHtml += `
            <div class="income-table-row" data-source="${key}">
                <div class="income-table-cell" data-i18n="${sourceConfig.nameI18nKey}">${translate(sourceConfig.nameI18nKey)}</div>
                <div class="income-table-cell income-table-value calculated" data-ore="shiny">0</div>
                <div class="income-table-cell income-table-value calculated" data-ore="glowy">0</div>
                <div class="income-table-cell income-table-value calculated" data-ore="starry">0</div>
                <div class="income-table-cell income-table-resource calculated"></div>
            </div>`;
        }
        tableBody.innerHTML = initialHtml;
    }
}

/**
 * Renders the Home tab income summary breakdown table using persistent DOM rows and granular number animations.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 */
export function renderHomeIncomeTable(state) {
    if (!state) return;
    const tableBody = dom.income?.home?.incomeCard?.table?.body;
    if (!tableBody) return;

    ensureTableRows(tableBody);

    const timeframe = state?.uiSettings?.summaryTimeframe || 'monthly';
    const sources = state?.derived?.incomeSources || {};

    const rows = tableBody.querySelectorAll ? Array.from(tableBody.querySelectorAll('.income-table-row')) : [];
    const rowMap = new Map();
    rows.forEach(row => {
        const sourceKey = row.dataset?.source || (row.getAttribute && row.getAttribute('data-source'));
        if (sourceKey) {
            rowMap.set(sourceKey, row);
        }
    });

    let index = 0;
    for (const key in incomeData) {
        const sourceConfig = incomeData[key];
        if (!sourceConfig.showInHomeTable) continue;

        const row = rowMap.get(key) || rows[index];
        index++;
        if (!row) continue;

        const income = sources[key] || {};
        const timeframeIncome = income[timeframe] || {};

        let resourceString = '';
        if (sourceConfig.getResourceString) {
            resourceString = sourceConfig.getResourceString(state);
        }

        const nameCell = (row.querySelector && row.querySelector('.income-table-cell:first-child')) || (row.children && row.children[0]);
        const shinyCell = (row.querySelector && row.querySelector('.income-table-value[data-ore="shiny"]')) || (row.children && row.children[1]);
        const glowyCell = (row.querySelector && row.querySelector('.income-table-value[data-ore="glowy"]')) || (row.children && row.children[2]);
        const starryCell = (row.querySelector && row.querySelector('.income-table-value[data-ore="starry"]')) || (row.children && row.children[3]);
        const resourceCell = (row.querySelector && row.querySelector('.income-table-resource')) || (row.children && row.children[4]);

        if (nameCell) {
            if (nameCell.dataset) {
                if (nameCell.dataset.i18n !== sourceConfig.nameI18nKey) {
                    nameCell.dataset.i18n = sourceConfig.nameI18nKey;
                }
            } else if (nameCell.setAttribute) {
                nameCell.setAttribute('data-i18n', sourceConfig.nameI18nKey);
            }
            const translatedName = translate(sourceConfig.nameI18nKey);
            if (nameCell.textContent !== translatedName) {
                nameCell.textContent = translatedName;
            }
        }

        if (shinyCell) {
            updateCalculatedValue(shinyCell, Math.round(timeframeIncome.shiny || 0));
        }
        if (glowyCell) {
            updateCalculatedValue(glowyCell, Math.round(timeframeIncome.glowy || 0));
        }
        if (starryCell) {
            updateCalculatedValue(starryCell, Math.round(timeframeIncome.starry || 0));
        }
        if (resourceCell && resourceCell.textContent !== resourceString) {
            resourceCell.textContent = resourceString;
        }
    }
}
