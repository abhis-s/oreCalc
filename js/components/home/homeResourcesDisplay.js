import { translate } from '../../i18n/translator.js';

import { updateCalculatedValue } from '../../utils/numberFormatter.js';

import { dom } from '../../dom/domElements.js';

/**
 * Renders resource requirements and participation counts in the Home tab income summary footer.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 */
export function renderHomeResourcesFooter(state) {
    if (!state) return;
    const homeResourceElements = dom.income?.home?.incomeCard?.resources;
    if (!homeResourceElements) return;

    // Star Bonus Town Hall Requirement
    const thLevel = Math.max(1, Number(state.playerProfile?.townHallLevel) || 1);
    const targetIconSrc = `assets/th/th${Math.min(thLevel, 18)}.png`;

    if (homeResourceElements.leagueIcon && homeResourceElements.leagueIcon.src !== targetIconSrc) {
        homeResourceElements.leagueIcon.src = targetIconSrc;
    }

    if (homeResourceElements.leagueRequirement) {
        const translatedName = translate('views.equipment.thShort', { level: thLevel });
        if (homeResourceElements.leagueRequirement.textContent !== translatedName) {
            homeResourceElements.leagueRequirement.textContent = translatedName;
        }
        homeResourceElements.leagueRequirement.dataset.i18n = 'views.equipment.thShort';
        homeResourceElements.leagueRequirement.dataset.i18nArgs = JSON.stringify({ level: thLevel });
    }

    // CWL Participations
    if (homeResourceElements.cwlParticipations) {
        updateCalculatedValue(homeResourceElements.cwlParticipations, Number(state.income?.cwl?.hitsPerSeason ?? 0));
    }

    // Clan War Participations
    if (homeResourceElements.clanWarParticipations) {
        updateCalculatedValue(homeResourceElements.clanWarParticipations, Number(state.income?.clanWar?.warsPerMonth ?? 0));
    }
    if (homeResourceElements.clanWarIcon) {
        const clanIconSrc = state.playerProfile?.clanBadgeUrl || 'assets/resources/clanWar.png';
        if (homeResourceElements.clanWarIcon.src !== clanIconSrc) {
            homeResourceElements.clanWarIcon.src = clanIconSrc;
        }
    }

    // Raid Medals
    if (homeResourceElements.raidMedals) {
        updateCalculatedValue(homeResourceElements.raidMedals, Number(state.derived?.incomeSources?.raidMedalTrader?.cost ?? 0));
    }

    // Event Medals
    if (homeResourceElements.eventMedals) {
        updateCalculatedValue(homeResourceElements.eventMedals, Number(state.derived?.incomeSources?.eventTrader?.cost ?? 0));
    }

    // Gems
    if (homeResourceElements.gems) {
        updateCalculatedValue(homeResourceElements.gems, Number(state.derived?.incomeSources?.gemTrader?.cost ?? 0));
    }
}
