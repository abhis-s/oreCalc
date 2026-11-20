import { incomeData } from '../../data/incomeSourceRegistry.js';
import { translate } from '../../i18n/translator.js';
import { selectActivePlayerTag } from '../../core/selectors.js';

import { updateCalculatedValue } from '../../utils/numberFormatter.js';

import { dom } from '../../dom/domElements.js';

/**
 * Determines whether a specific income table row should be visible in the Home tab summary table
 * based on user inputs and active player identity.
 * All rows remain visible for guest (DEFAULT0) users.
 *
 * @param {string} sourceKey - Income source registry key.
 * @param {import('../../core/types.js').AppState | null | undefined} state - Global application state.
 * @returns {boolean} True if the row should be displayed in the summary table.
 */
export function isHomeTableRowVisible(sourceKey, state) {
    if (!state) return false;
    const sourceConfig = incomeData[sourceKey];
    if (!sourceConfig?.showInHomeTable) return false;

    const rawTag = selectActivePlayerTag(state);
    const cleanTag = rawTag ? String(rawTag).replace(/^#/, '').trim() : '';
    const isGuest = !cleanTag || cleanTag === 'DEFAULT0';
    if (isGuest) {
        return true;
    }

    const income = state.income || {};

    switch (sourceKey) {
        case 'shopOffers': {
            const selectedSet = income.shopOffers?.selectedSet;
            if (!selectedSet || String(selectedSet) === '0' || String(selectedSet).toLowerCase() === 'none') {
                return false;
            }
            return true;
        }
        case 'gemTrader': {
            const packs = income.gems?.packs || {};
            return Object.values(packs).some(count => Number(count) > 0);
        }
        case 'supercellEvents': {
            return Boolean(income.supercellEvents?.worldChampionship);
        }
        case 'prospector': {
            return Boolean(income.prospector?.goldPass);
        }
        case 'clanWar': {
            return Number(income.clanWar?.warsPerMonth || 0) > 0;
        }
        case 'cwl': {
            return Number(income.cwl?.hitsPerSeason || 0) > 0;
        }
        default:
            return true;
    }
}

/**
 * Synchronizes persistent DOM rows for the Home tab income table from the income source registry.
 * Rebuilds rows only when missing or when registry order/visibility changes.
 * @param {HTMLElement} tableBody - Container element.
 * @param {import('../../core/types.js').AppState | null | undefined} state - Current global application state.
 */
function ensureTableRows(tableBody, state) {
    const expectedKeys = Object.keys(incomeData).filter(key => isHomeTableRowVisible(key, state));
    const existingRows = tableBody.querySelectorAll ? Array.from(tableBody.querySelectorAll('.income-table-row')) : [];
    const existingKeys = existingRows.map(row => row.dataset?.source || row.getAttribute?.('data-source') || '');
    const isSynced = existingKeys.length === expectedKeys.length && existingKeys.every((key, i) => key === expectedKeys[i]);
    if (isSynced) return;

    tableBody.innerHTML = '';
    for (const key of expectedKeys) {
        const sourceConfig = incomeData[key];

        const row = document.createElement('div');
        row.className = 'income-table-row';
        row.dataset.source = key;
        row.setAttribute('data-source', key);

        const nameCell = document.createElement('div');
        nameCell.className = 'income-table-cell';
        nameCell.dataset.i18n = sourceConfig.nameI18nKey;
        nameCell.setAttribute('data-i18n', sourceConfig.nameI18nKey);
        nameCell.textContent = translate(sourceConfig.nameI18nKey);

        const shinyCell = document.createElement('div');
        shinyCell.className = 'income-table-cell income-table-value calculated';
        shinyCell.dataset.ore = 'shiny';
        shinyCell.setAttribute('data-ore', 'shiny');
        shinyCell.textContent = '0';

        const glowyCell = document.createElement('div');
        glowyCell.className = 'income-table-cell income-table-value calculated';
        glowyCell.dataset.ore = 'glowy';
        glowyCell.setAttribute('data-ore', 'glowy');
        glowyCell.textContent = '0';

        const starryCell = document.createElement('div');
        starryCell.className = 'income-table-cell income-table-value calculated';
        starryCell.dataset.ore = 'starry';
        starryCell.setAttribute('data-ore', 'starry');
        starryCell.textContent = '0';

        const resourceCell = document.createElement('div');
        resourceCell.className = 'income-table-cell income-table-resource calculated';

        const content = document.createElement('div');
        content.className = 'resource-cell-content';

        const icon = document.createElement('clashcalc-assets-image');
        icon.className = 'resource-cell-icon';
        icon.setAttribute('size', 'thumbnail');

        const text = document.createElement('span');
        text.className = 'resource-cell-text';

        content.appendChild(icon);
        content.appendChild(text);
        resourceCell.appendChild(content);

        row.appendChild(nameCell);
        row.appendChild(shinyCell);
        row.appendChild(glowyCell);
        row.appendChild(starryCell);
        row.appendChild(resourceCell);

        tableBody.appendChild(row);
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

    ensureTableRows(tableBody, state);

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

    for (const key in incomeData) {
        if (!isHomeTableRowVisible(key, state)) continue;

        const sourceConfig = incomeData[key];
        const row = rowMap.get(key);
        if (!row) continue;

        const income = sources[key] || {};
        const timeframeIncome = income[timeframe] || {};

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

        if (resourceCell) {
            const meta = sourceConfig.getResourceMeta
                ? sourceConfig.getResourceMeta(state)
                : { icon: '', text: sourceConfig.getResourceString ? sourceConfig.getResourceString(state) : '' };

            let content = (resourceCell.querySelector && resourceCell.querySelector('.resource-cell-content'))
                || (resourceCell.children && resourceCell.children[0]);

            if (!content || (content.classList && !content.classList.contains('resource-cell-content'))) {
                resourceCell.innerHTML = '';
                content = document.createElement('div');
                content.className = 'resource-cell-content';
                const icon = document.createElement('clashcalc-assets-image');
                icon.className = 'resource-cell-icon';
                icon.setAttribute('size', 'thumbnail');
                const text = document.createElement('span');
                text.className = 'resource-cell-text';
                content.appendChild(icon);
                content.appendChild(text);
                resourceCell.appendChild(content);
            }

            const iconEl = (content.querySelector && content.querySelector('.resource-cell-icon'))
                || (content.children && content.children[0]);
            const textEl = (content.querySelector && content.querySelector('.resource-cell-text'))
                || (content.children && content.children[1]);

            if (iconEl) {
                if (meta.icon) {
                    if (iconEl.getAttribute && iconEl.getAttribute('src') !== meta.icon) {
                        iconEl.setAttribute('src', meta.icon);
                    }
                    if (iconEl.style && iconEl.style.display === 'none') {
                        iconEl.style.display = '';
                    }
                } else {
                    if (iconEl.removeAttribute) {
                        iconEl.removeAttribute('src');
                    }
                    if (iconEl.style) {
                        iconEl.style.display = 'none';
                    }
                }
            }

            if (textEl) {
                if (textEl.textContent !== meta.text) {
                    textEl.textContent = meta.text;
                }
            } else if (resourceCell.textContent !== meta.text) {
                resourceCell.textContent = meta.text;
            }
        }
    }
}
