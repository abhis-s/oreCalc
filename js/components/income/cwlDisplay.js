import { dom } from '../../dom/domElements.js';

import { formatNumber } from '../../utils/numberFormatter.js';
import { translate } from '../../i18n/translator.js';

export function renderCwlIncomeTabDisplay(fullCwlIncome, cwlState) {
    const displayElements = dom.income?.cwl?.display;
    const resultsElements = dom.income?.cwl?.warResults;
    if (!displayElements || !resultsElements) return;

    if (resultsElements.lossRateValue) {
        const winRate = cwlState.winRate ?? 50;
        const lossRate = 100 - winRate - (cwlState.drawRate || 0);
        resultsElements.lossRateValue.value = Math.max(0, lossRate).toFixed(0);
    }

    if(displayElements.perHit?.shiny) displayElements.perHit.shiny.textContent = formatNumber(Math.round(fullCwlIncome.perEvent?.shiny || 0));
    if(displayElements.perHit?.glowy) displayElements.perHit.glowy.textContent = formatNumber(Math.round(fullCwlIncome.perEvent?.glowy || 0));
    if(displayElements.perHit?.starry) displayElements.perHit.starry.textContent = formatNumber(Math.round(fullCwlIncome.perEvent?.starry || 0));
    
    if(displayElements.monthly?.shiny) displayElements.monthly.shiny.textContent = formatNumber(Math.round(fullCwlIncome.monthly?.shiny || 0));
    if(displayElements.monthly?.glowy) displayElements.monthly.glowy.textContent = formatNumber(Math.round(fullCwlIncome.monthly?.glowy || 0));
    if(displayElements.monthly?.starry) displayElements.monthly.starry.textContent = formatNumber(Math.round(fullCwlIncome.monthly?.starry || 0));
}