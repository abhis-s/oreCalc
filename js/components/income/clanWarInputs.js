import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { dom } from '../../dom/domElements.js';

import { adjustWarRates } from '../../utils/incomeUtils.js';
import { addValidation } from '../../utils/inputValidator.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';

import { translate } from '../../i18n/translator.js';

import { warOreTownHallValues } from '../../data/incomeSources/warOres.js';

function setupWarInputPopover(oreType, input) {
    registerInputPopover(input, {
        title: translate('validation.amount'),
        min: 0,
        showRecommended: true,
        recommended: () => {
            const playerTH = parseInt(state.playerProfile?.townHallLevel || 16, 10);
            let checkTH = playerTH;
            if (checkTH < 8) checkTH = 8;
            else if (checkTH > 16) checkTH = 16;
            return warOreTownHallValues[oreType][checkTH] !== undefined ? warOreTownHallValues[oreType][checkTH] : 0;
        },
        recommendedLabel: () => {
            const playerTH = parseInt(state.playerProfile?.townHallLevel || 16, 10);
            return `TH ${playerTH}`;
        },
        hideRecommendedIfHigher: false,
        clickToFill: {
            max: true,
            recommended: true
        }
    });
}

function handleInputChange(e, key, oreType = null) {
    const value = e.detail.value;

    handleStateUpdate(() => {
        if (!state.income.clanWar) state.income.clanWar = { oresPerAttack: {} };
        if (!state.income.clanWar.oresPerAttack) state.income.clanWar.oresPerAttack = {};

        if (oreType) {
            state.income.clanWar.oresPerAttack[oreType] = value;
        } else if (key === 'winRate' || key === 'drawRate') {
            const newWinRate = key === 'winRate' ? value : (state.income.clanWar.winRate ?? 50);
            const newDrawRate = key === 'drawRate' ? value : (state.income.clanWar.drawRate || 0);
            const changedRate = key === 'winRate' ? 'win' : 'draw';
            const adjusted = adjustWarRates(newWinRate, newDrawRate, changedRate);
            state.income.clanWar.winRate = adjusted.winRate;
            state.income.clanWar.drawRate = adjusted.drawRate;
        } else {
            state.income.clanWar[key] = value;
        }
    });
}

export function initializeClanWarInputs() {
    const inputs = dom.income?.clanWar;
    if (!inputs) return;

    addValidation(inputs.warsPerMonthInput, { inputName: translate('income.clanWar.warsPerMonth') });
    registerInputPopover(inputs.warsPerMonthInput, {
        title: translate('income.clanWar.warsPerMonth'),
        min: 0,
        max: 15,
        showRecommended: true,
        recommended: 10,
        hideRecommendedIfHigher: true,
        clickToFill: {
            min: true,
            max: true,
            recommended: true
        }
    });
    inputs.warsPerMonthInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'warsPerMonth'));

    addValidation(inputs.warResults.winRateInput, { inputName: translate('income.winRate') });
    registerInputPopover(inputs.warResults.winRateInput, {
        title: translate('income.winRate'),
        min: 0,
        max: 100,
        showRange: true,
        // TODO: Add recommended values for win/draw rates (see task 6gjJmhCMPjhxRwCW)
        showRecommended: false,
        clickToFill: {
            min: true,
            max: true
        }
    });
    inputs.warResults.winRateInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'winRate'));

    addValidation(inputs.warResults.drawRateInput, { inputName: translate('income.drawRate') });
    registerInputPopover(inputs.warResults.drawRateInput, {
        title: translate('income.drawRate'),
        min: 0,
        max: 100,
        showRange: true,
        // TODO: Add recommended values for win/draw rates (see task 6gjJmhCMPjhxRwCW)
        showRecommended: false,
        clickToFill: {
            min: true,
            max: true
        }
    });
    inputs.warResults.drawRateInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'drawRate'));

    addValidation(inputs.oresPerAttack.shinyInput, { inputName: translate('ores.shiny') });
    setupWarInputPopover('shiny', inputs.oresPerAttack.shinyInput);
    inputs.oresPerAttack.shinyInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'shiny'));

    addValidation(inputs.oresPerAttack.glowyInput, { inputName: translate('ores.glowy') });
    setupWarInputPopover('glowy', inputs.oresPerAttack.glowyInput);
    inputs.oresPerAttack.glowyInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'glowy'));

    addValidation(inputs.oresPerAttack.starryInput, { inputName: translate('ores.starry') });
    setupWarInputPopover('starry', inputs.oresPerAttack.starryInput);
    inputs.oresPerAttack.starryInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'starry'));
}

export function renderClanWarInputs(clanWarState) {
    const inputs = dom.income?.clanWar;
    if (!inputs) return;

    const safeState = clanWarState || { oresPerAttack: {} };

    if (inputs.warsPerMonthInput) inputs.warsPerMonthInput.value = safeState.warsPerMonth || 0;
    if (inputs.warResults.winRateInput) inputs.warResults.winRateInput.value = safeState.winRate ?? 50;
    if (inputs.warResults.drawRateInput) inputs.warResults.drawRateInput.value = safeState.drawRate || 0;
    if (inputs.oresPerAttack.shinyInput) inputs.oresPerAttack.shinyInput.value = safeState.oresPerAttack?.shiny || 0;
    if (inputs.oresPerAttack.glowyInput) inputs.oresPerAttack.glowyInput.value = safeState.oresPerAttack?.glowy || 0;
    if (inputs.oresPerAttack.starryInput) inputs.oresPerAttack.starryInput.value = safeState.oresPerAttack?.starry || 0;
}
