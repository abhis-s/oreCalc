import { translate } from '../../i18n/translator.js';
import { formatCurrency, formatNumber, updateCalculatedValue } from '../../utils/numberFormatter.js';
import { dom } from '../../dom/domElements.js';

/**
 * Renders Event Pass income tab display elements and updates calculated ore values.
 * @param {import('../../core/types.js').IncomeResult} eventPassIncome - Calculated Event Pass income results.
 */
export function renderEventPassIncomeTabDisplay(eventPassIncome) {
    const incomeTabDisplayElements = dom.income.eventPass.display;
    if (!incomeTabDisplayElements) return;

    updateCalculatedValue(incomeTabDisplayElements.monthly?.shiny, eventPassIncome.monthly?.shiny || 0);
    updateCalculatedValue(incomeTabDisplayElements.monthly?.glowy, eventPassIncome.monthly?.glowy || 0);
    updateCalculatedValue(incomeTabDisplayElements.monthly?.starry, eventPassIncome.monthly?.starry || 0);

    updateCalculatedValue(incomeTabDisplayElements.bimonthly?.shiny, eventPassIncome.bimonthly?.shiny || 0);
    updateCalculatedValue(incomeTabDisplayElements.bimonthly?.glowy, eventPassIncome.bimonthly?.glowy || 0);
    updateCalculatedValue(incomeTabDisplayElements.bimonthly?.starry, eventPassIncome.bimonthly?.starry || 0);
}
