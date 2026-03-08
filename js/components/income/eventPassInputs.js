import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { eventPassData } from '../../data/appData.js';
import { translate } from '../../i18n/translator.js';

import { addValidation } from '../../utils/inputValidator.js';

function renderEventPassSelectorContent() {
    const passTypeSelect = dom.income?.eventPass?.passType;
    if (!passTypeSelect) return;

    const selectedValue = passTypeSelect.value;
    passTypeSelect.innerHTML = '';

    for (const type in eventPassData) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = translate(`${type}_pass`);
        passTypeSelect.appendChild(option);
    }
    passTypeSelect.value = selectedValue;
}

export function initializeEventPassInputs() {
    const passTypeSelect = dom.income?.eventPass?.passType;
    const equipmentBoughtSelect = dom.income?.eventPass?.equipmentBought;
    const passClaimableMedalsInput = dom.income?.eventPass?.claimableMedals;
    const passBonusTrackMedalsInput = dom.income?.eventPass?.bonusTrackMedals;

    renderEventPassSelectorContent();

    addValidation(passClaimableMedalsInput, { inputName: translate('claimable_medals_colon') });
    addValidation(passBonusTrackMedalsInput, { inputName: translate('bonus_track_medals_colon') });

    passTypeSelect?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.type = e.target.value;
        });
    });
    passClaimableMedalsInput?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.claimableMedals = parseInt(e.target.value, 10);
        });
    });
    passBonusTrackMedalsInput?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.bonusTrackMedals = parseInt(e.target.value, 10);
        });
    });
    equipmentBoughtSelect?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.equipmentBought = e.target.value === 'yes';
        });
    });
}

export function renderEventPassInputs(eventPassState) {
    const passTypeSelect = dom.income?.eventPass?.passType;
    const equipmentBoughtSelect = dom.income?.eventPass?.equipmentBought;
    const passClaimableMedalsInput = dom.income?.eventPass?.claimableMedals;
    const passBonusTrackMedalsInput = dom.income?.eventPass?.bonusTrackMedals;

    if (passTypeSelect) {
        passTypeSelect.value = eventPassState.type;
    }
    if (passClaimableMedalsInput) {
        passClaimableMedalsInput.value = eventPassState.claimableMedals;
    }
    if (passBonusTrackMedalsInput) {
        passBonusTrackMedalsInput.value = eventPassState.bonusTrackMedals;
    }
    if (equipmentBoughtSelect) {
        equipmentBoughtSelect.value = eventPassState.equipmentBought ? 'yes' : 'no';
    }
}