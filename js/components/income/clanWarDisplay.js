import { translate } from '../../i18n/translator.js';
import { updateCalculatedValue } from '../../utils/numberFormatter.js';
import { dom } from '../../dom/domElements.js';

/**
 * Renders the Clan War income tab display elements and updates calculated ore totals.
 * @param {import('../../core/types.js').IncomeResult} fullClanWarIncome - Calculated clan war income results.
 * @param {import('../../core/types.js').ClanWarIncomeState} clanWarState - Current clan war settings state object.
 */
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
