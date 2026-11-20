import { translate } from '../../i18n/translator.js';
import { selectActivePlayerTag } from '../../core/selectors.js';
import { getTownHallIconUrl } from '../../domain/townHall/townHallSchedule.js';

import { animateValue, updateCalculatedValue } from '../../utils/numberFormatter.js';

import { dom } from '../../dom/domElements.js';

/**
 * Toggles the hidden attribute on the parent resource item container.
 * @param {HTMLElement|null|undefined} element
 * @param {boolean} isVisible
 */
const setItemVisibility = (element, isVisible) => {
    const item = element?.closest?.('.resource-item') || element?.parentElement;
    if (item) {
        item.hidden = !isVisible;
    }
};

/**
 * Renders resource requirements and participation counts in the Home tab income summary footer.
 * Conditionally conceals zero-value items for tagged players while keeping all visible for guests.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 */
export function renderHomeResourcesFooter(state) {
    if (!state) return;
    const homeResourceElements = dom.income?.home?.incomeCard?.resources;
    if (!homeResourceElements) return;

    const rawTag = selectActivePlayerTag(state);
    const cleanTag = rawTag ? String(rawTag).replace(/^#/, '').trim() : '';
    const isGuest = !cleanTag || cleanTag === 'DEFAULT0';

    // Star Bonus Town Hall Requirement (always visible)
    const thLevel = Math.max(1, Number(state.playerProfile?.townHallLevel) || 1);
    const targetIconSrc = getTownHallIconUrl(thLevel);

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
        setItemVisibility(homeResourceElements.leagueRequirement, true);
    }

    // CWL Participations
    const cwlHits = Number(state.income?.cwl?.hitsPerSeason ?? 0);
    if (homeResourceElements.cwlParticipations) {
        homeResourceElements.cwlParticipations.dataset.i18n = 'views.income.cwl.hitsCount';
        homeResourceElements.cwlParticipations.dataset.i18nArgs = JSON.stringify({ count: cwlHits });
        const cleanText = String(homeResourceElements.cwlParticipations.textContent || '').replace(/[^0-9-]/g, '');
        const prevVal = typeof homeResourceElements.cwlParticipations._currentNumericValue === 'number'
            ? Math.round(homeResourceElements.cwlParticipations._currentNumericValue)
            : (parseInt(cleanText, 10) || 0);
        homeResourceElements.cwlParticipations._currentNumericValue = cwlHits;
        if (homeResourceElements.cwlParticipations.textContent && prevVal !== cwlHits) {
            animateValue(
                homeResourceElements.cwlParticipations,
                prevVal,
                cwlHits,
                500,
                val => translate('views.income.cwl.hitsCount', { count: Math.round(val) })
            );
        } else {
            homeResourceElements.cwlParticipations.textContent = translate('views.income.cwl.hitsCount', { count: cwlHits });
        }
        setItemVisibility(homeResourceElements.cwlParticipations, isGuest || cwlHits > 0);
    }

    // Clan War Participations
    const warCount = Number(state.income?.clanWar?.warsPerMonth ?? 0);
    if (homeResourceElements.clanWarParticipations) {
        homeResourceElements.clanWarParticipations.dataset.i18n = 'views.income.clanWar.warsCount';
        homeResourceElements.clanWarParticipations.dataset.i18nArgs = JSON.stringify({ count: warCount });
        const cleanText = String(homeResourceElements.clanWarParticipations.textContent || '').replace(/[^0-9-]/g, '');
        const prevVal = typeof homeResourceElements.clanWarParticipations._currentNumericValue === 'number'
            ? Math.round(homeResourceElements.clanWarParticipations._currentNumericValue)
            : (parseInt(cleanText, 10) || 0);
        homeResourceElements.clanWarParticipations._currentNumericValue = warCount;
        if (homeResourceElements.clanWarParticipations.textContent && prevVal !== warCount) {
            animateValue(
                homeResourceElements.clanWarParticipations,
                prevVal,
                warCount,
                500,
                val => translate('views.income.clanWar.warsCount', { count: Math.round(val) })
            );
        } else {
            homeResourceElements.clanWarParticipations.textContent = translate('views.income.clanWar.warsCount', { count: warCount });
        }
        setItemVisibility(homeResourceElements.clanWarParticipations, isGuest || warCount > 0);
    }
    if (homeResourceElements.clanWarIcon) {
        const clanIconSrc = 'assets/resources/clanWar.png';
        if (homeResourceElements.clanWarIcon.src !== clanIconSrc) {
            homeResourceElements.clanWarIcon.src = clanIconSrc;
        }
    }

    // Raid Medals
    const raidMedalsCost = Number(state.derived?.incomeSources?.raidMedalTrader?.cost ?? 0);
    if (homeResourceElements.raidMedals) {
        updateCalculatedValue(homeResourceElements.raidMedals, raidMedalsCost);
        setItemVisibility(homeResourceElements.raidMedals, isGuest || raidMedalsCost > 0);
    }

    // Event Medals
    const eventMedalsCost = Number(state.derived?.incomeSources?.eventTrader?.cost ?? 0);
    if (homeResourceElements.eventMedals) {
        updateCalculatedValue(homeResourceElements.eventMedals, eventMedalsCost);
        setItemVisibility(homeResourceElements.eventMedals, isGuest || eventMedalsCost > 0);
    }

    // Gems
    const gemTraderCost = Number(state.derived?.incomeSources?.gemTrader?.cost ?? 0);
    if (homeResourceElements.gems) {
        updateCalculatedValue(homeResourceElements.gems, gemTraderCost);
        setItemVisibility(homeResourceElements.gems, isGuest || gemTraderCost > 0);
    }

    // Money
    if (homeResourceElements.moneyValue) {
        const currencyCode = state.uiSettings?.currency?.code || 'USD';
        const selectedCurrencyKey = currencyCode.toUpperCase();
        const moneyValue = state.derived?.totalMoneyCost?.[selectedCurrencyKey] ?? state.derived?.totalMoneyCost?.USD ?? 0;
        setItemVisibility(homeResourceElements.moneyValue, isGuest || moneyValue > 0);
    }
}
