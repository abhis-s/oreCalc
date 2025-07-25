import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { adjustWarRates } from '../../utils/incomeUtils.js';
import { addValidation } from '../../utils/inputValidator.js';

function handleInputChange(e, key, oreType = null) {
    const value = e.detail.value;

    handleStateUpdate(() => {
        if (oreType) {
            state.income.clanWar.oresPerAttack[oreType] = value;
        } else if (key === 'winRate' || key === 'drawRate') {
            const newWinRate = key === 'winRate' ? value : state.income.clanWar.winRate;
            const newDrawRate = key === 'drawRate' ? value : state.income.clanWar.drawRate;
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

    addValidation(inputs.warsPerMonthInput, { inputName: 'Wars per Month' });
    inputs.warsPerMonthInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'warsPerMonth'));

    addValidation(inputs.warResults.winRateInput, { inputName: 'Win Rate' });
    inputs.warResults.winRateInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'winRate'));

    addValidation(inputs.warResults.drawRateInput, { inputName: 'Draw Rate' });
    inputs.warResults.drawRateInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'drawRate'));

    addValidation(inputs.oresPerAttack.shinyInput, { inputName: 'Shiny Ore' });
    inputs.oresPerAttack.shinyInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'shiny'));

    addValidation(inputs.oresPerAttack.glowyInput, { inputName: 'Glowy Ore' });
    inputs.oresPerAttack.glowyInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'glowy'));

    addValidation(inputs.oresPerAttack.starryInput, { inputName: 'Starry Ore' });
    inputs.oresPerAttack.starryInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'starry'));
}

export function renderClanWarInputs(clanWarState) {
    const inputs = dom.income?.clanWar;
    if (!inputs) return;

    if (inputs.warsPerMonthInput) inputs.warsPerMonthInput.value = clanWarState.warsPerMonth;
    if (inputs.warResults.winRateInput) inputs.warResults.winRateInput.value = clanWarState.winRate;
    if (inputs.warResults.drawRateInput) inputs.warResults.drawRateInput.value = clanWarState.drawRate;
    if (inputs.oresPerAttack.shinyInput) inputs.oresPerAttack.shinyInput.value = clanWarState.oresPerAttack.shiny;
    if (inputs.oresPerAttack.glowyInput) inputs.oresPerAttack.glowyInput.value = clanWarState.oresPerAttack.glowy;
    if (inputs.oresPerAttack.starryInput) inputs.oresPerAttack.starryInput.value = clanWarState.oresPerAttack.starry;
}