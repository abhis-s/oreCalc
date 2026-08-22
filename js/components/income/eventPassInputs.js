import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { calculateEventPassIncome } from '../../domain/income/eventPassIncome.js';
import { calculateEventTraderIncome } from '../../domain/income/eventTraderIncome.js';

import { bindNumericInput, bindToggleInput } from '../common/formBindingUtils.js';
import { dom } from '../../dom/domElements.js';

function getRemainingEventMedals() {
    const eventPassIncome = calculateEventPassIncome(state.income.eventPass);
    const eventTraderIncome = calculateEventTraderIncome(state.income.eventTrader, eventPassIncome?.availableMedals || 0);
    return eventTraderIncome.remaining || 0;
}

function ensureEventPassState() {
    if (!state.income.eventPass) state.income.eventPass = {};
    return state.income.eventPass;
}

/**
 * Initializes Event Pass input event listeners, popovers, and state bindings.
 */
export function initializeEventPassInputs() {
    const passToggle = dom.income?.eventPass?.passToggle;
    const includeEquipmentSelect = dom.income?.eventPass?.includeEquipment;
    const bonusTrackMedalsInput = dom.income?.eventPass?.bonusTrackMedals;
    const purchasedMedalsInput = dom.income?.eventPass?.purchasedMedals;

    bindToggleInput(passToggle, {
        onUpdate: (checked) => {
            ensureEventPassState().eventPass = checked;
        }
    });

    bindToggleInput(includeEquipmentSelect, {
        onUpdate: (checked) => {
            ensureEventPassState().includeEquipment = checked;
        }
    });

    bindNumericInput(bonusTrackMedalsInput, {
        inputName: translate('views.income.eventPass.bonusTrackMedals'),
        popover: {
            title: () => translate('views.income.eventPass.bonusTrackMedals'),
            min: 0,
            max: 2000,
            showRecommended: true,
            recommended: 200,
            recommendedLabel: () => translate('views.income.eventPass.previous'),
            clickToFill: {
                min: true,
                max: true,
                recommended: true
            }
        },
        onUpdate: (value) => {
            ensureEventPassState().bonusTrackMedals = value;
        }
    });

    const getRecommendedPurchased = () => {
        const remaining = getRemainingEventMedals();
        if (remaining >= 0) return 0;
        const currentPurchased = state.income.eventPass?.purchasedMedals || 0;
        return currentPurchased - remaining;
    };

    bindNumericInput(purchasedMedalsInput, {
        inputName: translate('views.income.eventPass.purchasedMedals'),
        popover: {
            title: () => translate('views.income.eventPass.purchasedMedals'),
            min: 0,
            max: 30000,
            showRecommended: () => getRecommendedPurchased() > 0,
            recommended: getRecommendedPurchased,
            recommendedLabel: () => translate('actions.recommendPurchase'),
            clickToFill: {
                min: true,
                max: true,
                recommended: true
            }
        },
        onUpdate: (value) => {
            ensureEventPassState().purchasedMedals = value;
        }
    });
}

/**
 * Populates Event Pass input values and checked states.
 * @param {import('../../core/types.js').EventPassIncomeState} [eventPassState] - Active Event Pass state object.
 */
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
