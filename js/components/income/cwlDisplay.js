import { dom } from '../../dom/domElements.js';

export function renderCwlHomeDisplay(cwlIncome, cwlState) {
    const homeElements = dom.income?.home?.incomeCard?.table?.cwl;
    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (!homeElements || !homeResourceElements) return;

    if (homeElements.shiny) {
        homeElements.shiny.textContent = Math.round(cwlIncome?.shiny || 0).toLocaleString();
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = Math.round(cwlIncome?.glowy || 0).toLocaleString();
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = Math.round(cwlIncome?.starry || 0).toLocaleString();
    }
    if (homeElements.resource) {
        homeElements.resource.textContent = cwlState.hitsPerSeason > 0 ? `${cwlState.hitsPerSeason} Hits (${cwlState.winRate}% Win Rate)` : "No CWL";
    }

    if (homeResourceElements.cwlParticipations) {
        homeResourceElements.cwlParticipations.textContent = `CWL Participations: ${cwlState.hitsPerSeason}`;
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

    if(displayElements.perHit?.shiny) displayElements.perHit.shiny.textContent = Math.round(fullCwlIncome.perEvent?.shiny || 0).toLocaleString();
    if(displayElements.perHit?.glowy) displayElements.perHit.glowy.textContent = Math.round(fullCwlIncome.perEvent?.glowy || 0).toLocaleString();
    if(displayElements.perHit?.starry) displayElements.perHit.starry.textContent = Math.round(fullCwlIncome.perEvent?.starry || 0).toLocaleString();
    
    if(displayElements.monthly?.shiny) displayElements.monthly.shiny.textContent = Math.round(fullCwlIncome.monthly?.shiny || 0).toLocaleString();
    if(displayElements.monthly?.glowy) displayElements.monthly.glowy.textContent = Math.round(fullCwlIncome.monthly?.glowy || 0).toLocaleString();
    if(displayElements.monthly?.starry) displayElements.monthly.starry.textContent = Math.round(fullCwlIncome.monthly?.starry || 0).toLocaleString();
}