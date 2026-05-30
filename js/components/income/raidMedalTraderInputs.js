import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { raidMedalTraderData } from '../../data/appData.js';
import { dom } from '../../dom/domElements.js';

import { initializeOfferGrid } from '../common/offerGrid.js';
import { renderRaidMedalTraderRow } from './raidMedalTraderDisplay.js';

import { addValidation } from '../../utils/inputValidator.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';

import { translate } from '../../i18n/translator.js';

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
    addValidation(earnedInput, { inputName: translate('ores.raidMedal') });
    registerInputPopover(earnedInput, {
        title: translate('ores.raidMedal'),
        min: 0,
        max: 1970,
        showRecommended: () => {
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
            return totalCost > 0;
        },
        recommended: () => {
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
        },
        recommendedLabel: () => translate('ores.requiredShort') || 'Required',
        hideRecommendedIfHigher: true,
        clickToFill: {
            min: true,
            max: true,
            recommended: true
        }
    });
    earnedInput.addEventListener('validated-input', (e) => {
        handleStateUpdate(() => { 
            if (!state.income.raidMedals) state.income.raidMedals = { packs: {} };
            state.income.raidMedals.earned = e.detail.value; 
        });
    });
}
