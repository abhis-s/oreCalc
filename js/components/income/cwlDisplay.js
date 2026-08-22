import { translate } from '../../i18n/translator.js';
import { updateCalculatedValue } from '../../utils/numberFormatter.js';
import { dom } from '../../dom/domElements.js';

/**
 * Renders the CWL income tab display elements and updates calculated ore totals.
 * @param {import('../../core/types.js').IncomeResult} fullCwlIncome - Calculated CWL income results.
 * @param {import('../../core/types.js').CwlIncomeState} cwlState - Current CWL settings state object.
 */
export function renderCwlIncomeTabDisplay(fullCwlIncome, cwlState) {
    const displayElements = dom.income?.cwl?.display;
    const resultsElements = dom.income?.cwl?.warResults;
    if (!displayElements || !resultsElements) return;

    if (resultsElements.lossRateValue) {
        const winRate = cwlState.winRate ?? 50;
        const lossRate = 100 - winRate - (cwlState.drawRate || 0);
        resultsElements.lossRateValue.value = Math.max(0, lossRate).toFixed(0);
    }

    updateCalculatedValue(displayElements.perHit?.shiny, fullCwlIncome.perEvent?.shiny || 0);
    updateCalculatedValue(displayElements.perHit?.glowy, fullCwlIncome.perEvent?.glowy || 0);
    updateCalculatedValue(displayElements.perHit?.starry, fullCwlIncome.perEvent?.starry || 0);

    updateCalculatedValue(displayElements.monthly?.shiny, fullCwlIncome.monthly?.shiny || 0);
    updateCalculatedValue(displayElements.monthly?.glowy, fullCwlIncome.monthly?.glowy || 0);
    updateCalculatedValue(displayElements.monthly?.starry, fullCwlIncome.monthly?.starry || 0);
}
