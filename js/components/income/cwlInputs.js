import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { adjustWarRates } from '../../utils/incomeUtils.js';
import { addValidation } from '../../utils/inputValidator.js';
import { translate } from '../../i18n/translator.js';

function handleInputChange(e, key, oreType = null) {
    const value = e.detail.value;

    handleStateUpdate(() => {
        if (oreType) {
            state.income.cwl.oresPerAttack[oreType] = value;
        } else if (key === 'winRate' || key === 'drawRate') {
            const newWinRate = key === 'winRate' ? value : state.income.cwl.winRate;
            const newDrawRate = key === 'drawRate' ? value : state.income.cwl.drawRate;
            const changedRate = key === 'winRate' ? 'win' : 'draw';
            const adjusted = adjustWarRates(newWinRate, newDrawRate, changedRate);
            state.income.cwl.winRate = adjusted.winRate;
            state.income.cwl.drawRate = adjusted.drawRate;
        } else {
            state.income.cwl[key] = value;
        }
    });
}

export function initializeCwlInputs() {
    const inputs = dom.income?.cwl;
    if (!inputs) return;

    addValidation(inputs.hitsPerSeasonInput, { inputName: translate('hits_per_season') });
    inputs.hitsPerSeasonInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'hitsPerSeason'));

    addValidation(inputs.warResults.winRateInput, { inputName: translate('win_rate') });
    inputs.warResults.winRateInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'winRate'));

    addValidation(inputs.warResults.drawRateInput, { inputName: translate('draw_rate') });
    inputs.warResults.drawRateInput?.addEventListener('validated-input', (e) => handleInputChange(e, 'drawRate'));

    addValidation(inputs.oresPerAttack.shinyInput, { inputName: translate('shiny_ore') });
    inputs.oresPerAttack.shinyInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'shiny'));

    addValidation(inputs.oresPerAttack.glowyInput, { inputName: translate('glowy_ore') });
    inputs.oresPerAttack.glowyInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'glowy'));

    addValidation(inputs.oresPerAttack.starryInput, { inputName: translate('starry_ore') });
    inputs.oresPerAttack.starryInput?.addEventListener('validated-input', (e) => handleInputChange(e, null, 'starry'));
}

export function renderCwlInputs(cwlState) {
    const inputs = dom.income?.cwl;
    if (!inputs) return;

    if (inputs.hitsPerSeasonInput) inputs.hitsPerSeasonInput.value = cwlState.hitsPerSeason;
    if (inputs.warResults.winRateInput) inputs.warResults.winRateInput.value = cwlState.winRate;
    if (inputs.warResults.drawRateInput) inputs.warResults.drawRateInput.value = cwlState.drawRate;
    if (inputs.oresPerAttack.shinyInput) inputs.oresPerAttack.shinyInput.value = cwlState.oresPerAttack.shiny;
    if (inputs.oresPerAttack.glowyInput) inputs.oresPerAttack.glowyInput.value = cwlState.oresPerAttack.glowy;
    if (inputs.oresPerAttack.starryInput) inputs.oresPerAttack.starryInput.value = cwlState.oresPerAttack.starry;
}