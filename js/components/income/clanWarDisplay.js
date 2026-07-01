import { dom } from '../../dom/domElements.js';

import { updateCalculatedValue } from '../../utils/numberFormatter.js';
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

    updateCalculatedValue(displayElements.perWar?.shiny, fullClanWarIncome.perEvent?.shiny || 0);
    updateCalculatedValue(displayElements.perWar?.glowy, fullClanWarIncome.perEvent?.glowy || 0);
    updateCalculatedValue(displayElements.perWar?.starry, fullClanWarIncome.perEvent?.starry || 0);
    
    updateCalculatedValue(displayElements.monthly?.shiny, fullClanWarIncome.monthly?.shiny || 0);
    updateCalculatedValue(displayElements.monthly?.glowy, fullClanWarIncome.monthly?.glowy || 0);
    updateCalculatedValue(displayElements.monthly?.starry, fullClanWarIncome.monthly?.starry || 0);
}