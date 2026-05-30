import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { dom } from '../../dom/domElements.js';

import { addValidation } from '../../utils/inputValidator.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';

import { translate } from '../../i18n/translator.js';

export function initializeEventPassInputs() {
    const passToggle = dom.income?.eventPass?.passToggle;
    const includeEquipmentSelect = dom.income?.eventPass?.includeEquipment;
    const passClaimableMedalsInput = dom.income?.eventPass?.claimableMedals;
    const passBonusTrackMedalsInput = dom.income?.eventPass?.bonusTrackMedals;

    if (passClaimableMedalsInput) {
        addValidation(passClaimableMedalsInput, { inputName: translate('income.eventPass.claimableMedals') });
        registerInputPopover(passClaimableMedalsInput, {
            title: translate('income.eventPass.claimableMedals'),
            min: 0,
            max: 1000,
            showRecommended: false,
            clickToFill: {
                min: true,
                max: true
            }
        });
    }
    if (passBonusTrackMedalsInput) {
        addValidation(passBonusTrackMedalsInput, { inputName: translate('income.eventPass.bonusTrackMedals') });
        registerInputPopover(passBonusTrackMedalsInput, {
            title: translate('income.eventPass.bonusTrackMedals'),
            min: 0,
            max: 1000,
            showRecommended: false,
            clickToFill: {
                min: true,
                max: true
            }
        });
    }

    passToggle?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.eventPass = e.target.checked;
        });
    });

    passClaimableMedalsInput?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.claimableMedals = parseInt(e.target.value, 10) || 0;
        });
    });

    passClaimableMedalsInput?.addEventListener('validated-input', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.claimableMedals = e.detail.value;
        });
    });

    passBonusTrackMedalsInput?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.bonusTrackMedals = parseInt(e.target.value, 10) || 0;
        });
    });

    passBonusTrackMedalsInput?.addEventListener('validated-input', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.bonusTrackMedals = e.detail.value;
        });
    });

    includeEquipmentSelect?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.includeEquipment = e.target.checked;
        });
    });
}

export function renderEventPassInputs(eventPassState) {
    const passToggle = dom.income?.eventPass?.passToggle;
    const includeEquipmentSelect = dom.income?.eventPass?.includeEquipment;
    const passClaimableMedalsInput = dom.income?.eventPass?.claimableMedals;
    const passBonusTrackMedalsInput = dom.income?.eventPass?.bonusTrackMedals;

    const safeState = eventPassState || {};

    if (passToggle) {
        passToggle.checked = safeState.eventPass || false;
    }
    if (passClaimableMedalsInput) {
        passClaimableMedalsInput.value = safeState.claimableMedals || 0;
    }
    if (passBonusTrackMedalsInput) {
        passBonusTrackMedalsInput.value = safeState.bonusTrackMedals || 0;
    }
    if (includeEquipmentSelect) {
        includeEquipmentSelect.checked = safeState.includeEquipment || false;
    }
}
