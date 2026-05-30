import { dom } from '../../dom/domElements.js';
import { translate } from '../../i18n/translator.js';
import { leagueTiers } from '../../data/appData.js';

export function renderHomeResourcesFooter(state) {
    const homeResourceElements = dom.income?.home?.incomeCard?.resources;
    if (!homeResourceElements) return;

    // League Requirement
    const leagueId = parseInt(state.income.starBonus?.league || 105000000, 10);
    const leagueData = leagueTiers.items.find(l => l.id === leagueId);
    const unrankedLeague = leagueTiers.items.find(l => l.id === 105000000);
    const unrankedIcon = unrankedLeague?.iconUrls?.large || '';
    
    if (homeResourceElements.leagueIcon) {
        homeResourceElements.leagueIcon.src = leagueData?.iconUrls?.large || unrankedIcon;
    }
    if (homeResourceElements.leagueRequirement) {
        const leagueName = leagueData ? leagueData.name : 'Unranked';
        const leagueKey = 'leagues.' + leagueName.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        homeResourceElements.leagueRequirement.textContent = translate(leagueKey);
        homeResourceElements.leagueRequirement.dataset.i18n = leagueKey;
    }

    // CWL Participations
    if (homeResourceElements.cwlParticipations) {
        homeResourceElements.cwlParticipations.textContent = state.income.cwl.hitsPerSeason || 0;
    }

    // Clan War Participations
    if (homeResourceElements.clanWarParticipations) {
        homeResourceElements.clanWarParticipations.textContent = state.income.clanWar.warsPerMonth || 0;
    }
    if (homeResourceElements.clanWarIcon) {
        homeResourceElements.clanWarIcon.src = state.playerProfile?.clanBadgeUrl || 'assets/resources/clanWar.png';
    }

    // Raid Medals
    if (homeResourceElements.raidMedals) {
        homeResourceElements.raidMedals.textContent = state.derived.incomeSources.raidMedalTrader?.cost || 0;
    }

    // Event Medals
    if (homeResourceElements.eventMedals) {
        homeResourceElements.eventMedals.textContent = state.derived.incomeSources.eventTrader?.cost || 0;
    }

    // Gems
    if (homeResourceElements.gems) {
        homeResourceElements.gems.textContent = state.derived.incomeSources.gemTrader?.cost || 0;
    }
}
