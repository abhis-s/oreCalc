import { raidMedalTraderData } from '../../data/incomeSources/traders.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { bindNumericInput } from '../common/formBindingUtils.js';
import { initializeOfferGrid } from '../common/offerGrid.js';
import { dom } from '../../dom/domElements.js';
import { renderRaidMedalTraderRow } from './raidMedalTraderDisplay.js';

function updateRaidMedalTraderState(offerId, oreType, count) {
    handleStateUpdate(() => {
        if (!state.income.raidMedals) state.income.raidMedals = { packs: {} };
        if (!state.income.raidMedals.packs) state.income.raidMedals.packs = {};

        if (count > 0) {
            state.income.raidMedals.packs[oreType] = count;
        } else {
            delete state.income.raidMedals.packs[oreType];
        }
    });
}

function calculateRequiredRaidMedalsCost() {
    let totalCost = 0;
    const packs = state.income.raidMedals?.packs || {};
    raidMedalTraderData.forEach(offer => {
        if (offer.shiny > 0 && packs.shiny) {
            totalCost += offer.cost * packs.shiny;
        }
        if (offer.glowy > 0 && packs.glowy) {
            totalCost += offer.cost * packs.glowy;
        }
        if (offer.starry > 0 && packs.starry) {
            totalCost += offer.cost * packs.starry;
        }
    });
    return totalCost;
}

/**
 * Initializes Raid Medal Trader offer checkboxes and earned medals input validation.
 */
export function initializeRaidMedalTrader() {
    const container = dom.income?.raids?.offersContainer;
    const earnedInput = dom.income?.raids?.earned;
    if (!container || !earnedInput) return;

    initializeOfferGrid({
        container,
        offers: raidMedalTraderData,
        onStateChange: updateRaidMedalTraderState,
        renderRow: renderRaidMedalTraderRow
    });

    bindNumericInput(earnedInput, {
        inputName: translate('views.income.ores.raidMedal'),
        popover: {
            title: () => translate('views.income.ores.raidMedal'),
            min: 0,
            max: 1970,
            showRecommended: () => calculateRequiredRaidMedalsCost() > 0,
            recommended: () => calculateRequiredRaidMedalsCost(),
            recommendedLabel: () => translate('views.income.ores.requiredShort'),
            hideRecommendedIfHigher: true,
            clickToFill: {
                min: true,
                max: true,
                recommended: true
            }
        },
        onUpdate: (value) => {
            if (!state.income.raidMedals) state.income.raidMedals = { packs: {} };
            state.income.raidMedals.earned = value;
        }
    });
}
