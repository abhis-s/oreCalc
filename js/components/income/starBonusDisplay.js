import { dom } from '../../dom/domElements.js';
import { translate } from '../../i18n/translator.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { leagueTiers } from '../../data/appData.js';

export function renderStarBonusDisplay(starBonusIncome, league, playerData, timeframe) {
    const homeElements = dom.income.home.incomeCard.table.starBonus;
    const incomeTabElements = dom.income.starBonus.display;
    const homeResourceElements = dom.income.home.incomeCard.resources;

    if (!homeElements || !incomeTabElements || !homeResourceElements) return;

    const leagueId = parseInt(league, 10);
    const leagueData = leagueTiers.items.find(l => l.id === leagueId);
    const leagueName = leagueData ? leagueData.name : 'Unranked';

    const timeframeIncome = starBonusIncome[timeframe] || {};

    if (homeElements.shiny) {
        homeElements.shiny.textContent = formatNumber(Math.round(timeframeIncome.shiny || 0));
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = formatNumber(Math.round(timeframeIncome.glowy || 0));
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = formatNumber(Math.round(timeframeIncome.starry || 0));
    }
    if (homeElements.resource) {
        const leagueKey = 'league.' + leagueName.toLowerCase().replace(/\./g, '').replace(/\s/g, '_');
        homeElements.resource.textContent = translate(leagueKey);
    }

    const unrankedLeague = leagueTiers.items.find(l => l.id === 105000000);
    const unrankedIcon = unrankedLeague?.iconUrls?.large || '';

    if (homeResourceElements.leagueIcon) {
        homeResourceElements.leagueIcon.src = leagueData?.iconUrls?.large || unrankedIcon;
    }
    if (homeResourceElements.leagueRequirement) {
        const leagueKey = 'league.' + leagueName.toLowerCase().replace(/\./g, '').replace(/\s/g, '_');
        homeResourceElements.leagueRequirement.textContent = translate(leagueKey);
    }

    if (incomeTabElements.monthly?.shiny) incomeTabElements.monthly.shiny.textContent = formatNumber(Math.round(starBonusIncome.monthly?.shiny || 0));
    if (incomeTabElements.monthly?.glowy) incomeTabElements.monthly.glowy.textContent = formatNumber(Math.round(starBonusIncome.monthly?.glowy || 0));
    if (incomeTabElements.monthly?.starry) incomeTabElements.monthly.starry.textContent = formatNumber(Math.round(starBonusIncome.monthly?.starry || 0));

    if (incomeTabElements.daily?.shiny) incomeTabElements.daily.shiny.textContent = formatNumber(Math.round(starBonusIncome.daily?.shiny || 0));
    if (incomeTabElements.daily?.glowy) incomeTabElements.daily.glowy.textContent = formatNumber(Math.round(starBonusIncome.daily?.glowy || 0));
    if (incomeTabElements.daily?.starry) incomeTabElements.daily.starry.textContent = formatNumber(Math.round(starBonusIncome.daily?.starry || 0));
}