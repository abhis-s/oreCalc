import { dom } from '../../dom/domElements.js';

import { formatNumber } from '../../utils/numberFormatter.js';
import { translate } from '../../i18n/translator.js';

export function renderClanWarIncomeTabDisplay(fullClanWarIncome, clanWarState) {
    const displayElements = dom.income?.clanWar?.display;
    const resultsElements = dom.income?.clanWar?.warResults;
    if (!displayElements || !resultsElements) return;
    
    if (resultsElements.lossRateValue) {
        const winRate = clanWarState.winRate ?? 50;
        const lossRate = 100 - winRate - (clanWarState.drawRate || 0);
        resultsElements.lossRateValue.value = Math.max(0, lossRate).toFixed(0);
    }

    if(displayElements.perWar?.shiny) displayElements.perWar.shiny.textContent = formatNumber(Math.round(fullClanWarIncome.perEvent?.shiny || 0));
    if(displayElements.perWar?.glowy) displayElements.perWar.glowy.textContent = formatNumber(Math.round(fullClanWarIncome.perEvent?.glowy || 0));
    if(displayElements.perWar?.starry) displayElements.perWar.starry.textContent = formatNumber(Math.round(fullClanWarIncome.perEvent?.starry || 0));
    
    if(displayElements.monthly?.shiny) displayElements.monthly.shiny.textContent = formatNumber(Math.round(fullClanWarIncome.monthly?.shiny || 0));
    if(displayElements.monthly?.glowy) displayElements.monthly.glowy.textContent = formatNumber(Math.round(fullClanWarIncome.monthly?.glowy || 0));
    if(displayElements.monthly?.starry) displayElements.monthly.starry.textContent = formatNumber(Math.round(fullClanWarIncome.monthly?.starry || 0));
}