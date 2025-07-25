import { dom } from '../../dom/domElements.js';

export function renderClanWarHomeDisplay(clanWarIncome, clanWarState, playerData) {
    const homeElements = dom.income?.home?.incomeCard?.table?.clanWar;
    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (!homeElements || !homeResourceElements) return;

    if (homeElements.shiny) {
        homeElements.shiny.textContent = Math.round(clanWarIncome?.shiny || 0).toLocaleString();
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = Math.round(clanWarIncome?.glowy || 0).toLocaleString();
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = Math.round(clanWarIncome?.starry || 0).toLocaleString();
    }
    if (homeElements.resource) {
        homeElements.resource.textContent = clanWarState.warsPerMonth > 0 ? `${clanWarState.warsPerMonth} Wars (${clanWarState.winRate}% Win Rate)` : "No Clan Wars";
    }

    if (homeResourceElements.clanWarParticipations) {
        homeResourceElements.clanWarParticipations.textContent = `Clan War Participations: ${clanWarState.warsPerMonth}`;
    }
    if (homeResourceElements.clanWarIcon) {
        homeResourceElements.clanWarIcon.src = playerData?.clan?.badgeUrls?.small || 'assets/resources/clan_war.png';
    }
}

export function renderClanWarIncomeTabDisplay(fullClanWarIncome, clanWarState) {
    const displayElements = dom.income?.clanWar?.display;
    const resultsElements = dom.income?.clanWar?.warResults;
    if (!displayElements || !resultsElements) return;
    
    if (resultsElements.lossRateValue) {
        const lossRate = 100 - clanWarState.winRate - clanWarState.drawRate;
        resultsElements.lossRateValue.value = Math.max(0, lossRate).toFixed(0);
    }

    if(displayElements.perWar?.shiny) displayElements.perWar.shiny.textContent = Math.round(fullClanWarIncome.perEvent?.shiny || 0).toLocaleString();
    if(displayElements.perWar?.glowy) displayElements.perWar.glowy.textContent = Math.round(fullClanWarIncome.perEvent?.glowy || 0).toLocaleString();
    if(displayElements.perWar?.starry) displayElements.perWar.starry.textContent = Math.round(fullClanWarIncome.perEvent?.starry || 0).toLocaleString();
    
    if(displayElements.monthly?.shiny) displayElements.monthly.shiny.textContent = Math.round(fullClanWarIncome.monthly?.shiny || 0).toLocaleString();
    if(displayElements.monthly?.glowy) displayElements.monthly.glowy.textContent = Math.round(fullClanWarIncome.monthly?.glowy || 0).toLocaleString();
    if(displayElements.monthly?.starry) displayElements.monthly.starry.textContent = Math.round(fullClanWarIncome.monthly?.starry || 0).toLocaleString();
}