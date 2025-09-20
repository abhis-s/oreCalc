import { dom } from '../../dom/domElements.js';
import { translate } from '../../i18n/translator.js';
import { formatNumber } from '../../utils/numberFormatter.js';

export function renderCwlHomeDisplay(cwlIncome, cwlState) {
    const homeElements = dom.income?.home?.incomeCard?.table?.cwl;
    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (!homeElements || !homeResourceElements) return;

    if (homeElements.shiny) {
        homeElements.shiny.textContent = formatNumber(Math.round(cwlIncome?.shiny || 0));
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = formatNumber(Math.round(cwlIncome?.glowy || 0));
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = formatNumber(Math.round(cwlIncome?.starry || 0));
    }
    if (homeElements.resource) {
        homeElements.resource.textContent = cwlState.hitsPerSeason > 0 ? translate('cwl_resource', { count: cwlState.hitsPerSeason, winRate: cwlState.winRate }) : translate('no_cwl');
    }

    if (homeResourceElements.cwlParticipations) {
        homeResourceElements.cwlParticipations.textContent = cwlState.hitsPerSeason;
    }
}

export function renderCwlIncomeTabDisplay(fullCwlIncome, cwlState) {
    const displayElements = dom.income?.cwl?.display;
    const resultsElements = dom.income?.cwl?.warResults;
    if (!displayElements || !resultsElements) return;

    if (resultsElements.lossRateValue) {
        const lossRate = 100 - cwlState.winRate - cwlState.drawRate;
        resultsElements.lossRateValue.value = Math.max(0, lossRate).toFixed(0);
    }

    if(displayElements.perHit?.shiny) displayElements.perHit.shiny.textContent = formatNumber(Math.round(fullCwlIncome.perEvent?.shiny || 0));
    if(displayElements.perHit?.glowy) displayElements.perHit.glowy.textContent = formatNumber(Math.round(fullCwlIncome.perEvent?.glowy || 0));
    if(displayElements.perHit?.starry) displayElements.perHit.starry.textContent = formatNumber(Math.round(fullCwlIncome.perEvent?.starry || 0));
    
    if(displayElements.monthly?.shiny) displayElements.monthly.shiny.textContent = formatNumber(Math.round(fullCwlIncome.monthly?.shiny || 0));
    if(displayElements.monthly?.glowy) displayElements.monthly.glowy.textContent = formatNumber(Math.round(fullCwlIncome.monthly?.glowy || 0));
    if(displayElements.monthly?.starry) displayElements.monthly.starry.textContent = formatNumber(Math.round(fullCwlIncome.monthly?.starry || 0));
}