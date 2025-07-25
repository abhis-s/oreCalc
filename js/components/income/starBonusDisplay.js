import { dom } from '../../dom/domElements.js';

export function renderStarBonusDisplay(starBonusIncome, league, playerData, timeframe) {
    const homeElements = dom.income.home.incomeCard.table.starBonus;
    const incomeTabElements = dom.income.starBonus.display;
    const homeResourceElements = dom.income.home.incomeCard.resources;

    if (!homeElements || !incomeTabElements || !homeResourceElements) return;

    const timeframeIncome = starBonusIncome[timeframe] || {};

    if (homeElements.shiny) {
        homeElements.shiny.textContent = Math.round(timeframeIncome.shiny || 0).toLocaleString();
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = Math.round(timeframeIncome.glowy || 0).toLocaleString();
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = Math.round(timeframeIncome.starry || 0).toLocaleString();
    }
    if (homeElements.resource) {
        let displayLeague = 'Unranked';
        if (league && league !== 'Unranked') {
            displayLeague = league;
            if (!displayLeague.includes('League')) {
                const words = displayLeague.split(' ');
                if (words.length > 1) {
                    words.splice(1, 0, 'League');
                    displayLeague = words.join(' ');
                }
            } else if (playerData?.league?.name && playerData.league.name !== 'Unranked') {
                displayLeague = playerData.league.name;
            }
        }
        homeElements.resource.textContent = displayLeague;
    }

    if (homeResourceElements.leagueIcon) {
        homeResourceElements.leagueIcon.src = playerData?.league?.iconUrls?.medium || 'assets/player_leagues/unranked_league.png';
    }
    if (homeResourceElements.leagueRequirement) {
        homeResourceElements.leagueRequirement.textContent = league || playerData?.league?.name;
    }

    if (incomeTabElements.monthly?.shiny) incomeTabElements.monthly.shiny.textContent = Math.round(starBonusIncome.monthly?.shiny || 0).toLocaleString();
    if (incomeTabElements.monthly?.glowy) incomeTabElements.monthly.glowy.textContent = Math.round(starBonusIncome.monthly?.glowy || 0).toLocaleString();
    if (incomeTabElements.monthly?.starry) incomeTabElements.monthly.starry.textContent = Math.round(starBonusIncome.monthly?.starry || 0).toLocaleString();

    if (incomeTabElements.daily?.shiny) incomeTabElements.daily.shiny.textContent = Math.round(starBonusIncome.daily?.shiny || 0).toLocaleString();
    if (incomeTabElements.daily?.glowy) incomeTabElements.daily.glowy.textContent = Math.round(starBonusIncome.daily?.glowy || 0).toLocaleString();
    if (incomeTabElements.daily?.starry) incomeTabElements.daily.starry.textContent = Math.round(starBonusIncome.daily?.starry || 0).toLocaleString();
}