import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

import { calculateEventPassIncome } from '../../incomeCalculations/eventPassIncome.js';
import { calculateEventTraderIncome } from '../../incomeCalculations/eventTraderIncome.js';

import { addValidation } from '../../utils/inputValidator.js';
import { eventTraderData } from '../../data/appData.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { translate } from '../../i18n/translator.js';

function getRemainingEventMedals() {
    const eventPassIncome = calculateEventPassIncome(state.income.eventPass);
    const eventTraderIncome = calculateEventTraderIncome(state.income.eventTrader, eventPassIncome?.availableMedals || 0);
    return eventTraderIncome.remaining || 0;
}

export function initializeEventPassInputs() {
    const passToggle = dom.income?.eventPass?.passToggle;
    const includeEquipmentSelect = dom.income?.eventPass?.includeEquipment;
    const bonusTrackMedalsInput = dom.income?.eventPass?.bonusTrackMedals;
    const purchasedMedalsInput = dom.income?.eventPass?.purchasedMedals;

    if (bonusTrackMedalsInput) {
        addValidation(bonusTrackMedalsInput, { inputName: translate('income.eventPass.bonusTrackMedals') });
        registerInputPopover(bonusTrackMedalsInput, {
            title: () => translate('income.eventPass.bonusTrackMedals'),
            min: 0,
            max: 2000,
            showRecommended: true,
            recommended: 200,
            recommendedLabel: () => translate('income.eventPass.previous') || 'Previous',
            clickToFill: {
                min: true,
                max: true,
                recommended: true
            }
        });
    }
    if (purchasedMedalsInput) {
        addValidation(purchasedMedalsInput, { inputName: translate('income.eventPass.purchasedMedals') });
        
        const getRecommendedPurchased = () => {
            const remaining = getRemainingEventMedals();
            if (remaining >= 0) return 0;
            const currentPurchased = state.income.eventPass?.purchasedMedals || 0;
            return currentPurchased - remaining;
        };

        registerInputPopover(purchasedMedalsInput, {
            title: () => translate('income.eventPass.purchasedMedals'),
            min: 0,
            max: 30000,
            showRecommended: () => getRecommendedPurchased() > 0,
            recommended: getRecommendedPurchased,
            recommendedLabel: () => translate('actions.recommendPurchase') || 'Recommend Purchase',
            clickToFill: {
                min: true,
                max: true,
                recommended: true
            }
        });
    }

    passToggle?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.eventPass = e.target.checked;
        });
    });

    bonusTrackMedalsInput?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.bonusTrackMedals = parseInt(e.target.value, 10) || 0;
        });
    });

    bonusTrackMedalsInput?.addEventListener('validated-input', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.bonusTrackMedals = e.detail.value;
        });
    });

    purchasedMedalsInput?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.purchasedMedals = parseInt(e.target.value, 10) || 0;
        });
    });

    purchasedMedalsInput?.addEventListener('validated-input', (e) => {
        handleStateUpdate(() => {
            if (!state.income.eventPass) state.income.eventPass = {};
            state.income.eventPass.purchasedMedals = e.detail.value;
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
    const bonusTrackMedalsInput = dom.income?.eventPass?.bonusTrackMedals;
    const purchasedMedalsInput = dom.income?.eventPass?.purchasedMedals;

    const safeState = eventPassState || {};

    if (passToggle) {
        passToggle.checked = safeState.eventPass || false;
    }
    if (bonusTrackMedalsInput) {
        bonusTrackMedalsInput.value = safeState.bonusTrackMedals || 0;
    }
    if (purchasedMedalsInput) {
        purchasedMedalsInput.value = safeState.purchasedMedals || 0;
    }
    if (includeEquipmentSelect) {
        includeEquipmentSelect.checked = safeState.includeEquipment || false;
    }
}
