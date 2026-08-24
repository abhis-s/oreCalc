import { translate } from '../../i18n/translator.js';

import { STAR_BONUS_2X_DEFAULTS } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';

import { bindNumericInput, bindSelectInput } from '../common/formBindingUtils.js';
import { dom } from '../../dom/domElements.js';
import {
    renderLastEventOptions as renderLastEventOptionsDisplay,
    renderStarBonusSelectorContent as renderSelectorContentDisplay,
    renderTHPlanningSection as renderTHPlanningSectionDisplay
} from './starBonusDisplay.js';

function renderLastEventOptions() {
    const select = dom.income?.starBonus?.lastEventSelect;
    if (!select) return;

    const frequency = parseInt(dom.income?.starBonus?.frequencyInput?.value || STAR_BONUS_2X_DEFAULTS.frequency, 10);
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    let savedMonth, savedYear;
    const lastEventStr = state.income.starBonus?.["2x"]?.lastEvent;
    if (lastEventStr) {
        const [year, month] = lastEventStr.split('-').map(Number);
        savedYear = year;
        savedMonth = month - 1;
    }

    // Initialize if missing
    if (savedMonth === undefined || savedYear === undefined) {
        savedMonth = currentMonth;
        savedYear = currentYear;
        handleStateUpdate(() => {
            if (!state.income.starBonus) state.income.starBonus = {};
            if (!state.income.starBonus["2x"]) state.income.starBonus["2x"] = {};
            state.income.starBonus["2x"].lastEvent = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        }, true);
    }

    // Check expiration: if diff >= frequency, roll to current month
    const monthDiff = (currentYear - savedYear) * 12 + (currentMonth - savedMonth);
    if (monthDiff >= frequency || monthDiff < 0) {
        savedMonth = currentMonth;
        savedYear = currentYear;
        handleStateUpdate(() => {
            if (!state.income.starBonus) state.income.starBonus = {};
            if (!state.income.starBonus["2x"]) state.income.starBonus["2x"] = {};
            state.income.starBonus["2x"].lastEvent = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        }, true);
    }

    renderLastEventOptionsDisplay(select, frequency, currentYear, currentMonth, savedYear, savedMonth);

    // Final safety check
    if (select.value === "") {
        select.value = "0";
        handleStateUpdate(() => {
            if (!state.income.starBonus) state.income.starBonus = {};
            if (!state.income.starBonus["2x"]) state.income.starBonus["2x"] = {};
            state.income.starBonus["2x"].lastEvent = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        }, true);
    }
}

function handleTHUpgradeChange(th, offset, currentMonthBase, thLimit) {
    handleStateUpdate(() => {
        if (!state.income.starBonus.thUpgrades) state.income.starBonus.thUpgrades = {};
        if (offset === 0) {
            delete state.income.starBonus.thUpgrades[th];
            for (let subsequent = th + 1; subsequent <= thLimit; subsequent++) {
                delete state.income.starBonus.thUpgrades[subsequent];
            }
        } else {
            const targetDate = new Date(currentMonthBase);
            targetDate.setUTCMonth(targetDate.getUTCMonth() + (offset - 1));
            state.income.starBonus.thUpgrades[th] = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}`;

            let currentLimitOffset = offset;
            const currentYear = currentMonthBase.getUTCFullYear();
            const currentMonth = currentMonthBase.getUTCMonth();
            for (let subsequent = th + 1; subsequent <= thLimit; subsequent++) {
                const subPlan = state.income.starBonus.thUpgrades[subsequent];
                if (subPlan) {
                    const [subYear, subMonth] = subPlan.split('-').map(Number);
                    const subOffset = (subYear - currentYear) * 12 + (subMonth - 1 - currentMonth) + 1;
                    if (subOffset <= currentLimitOffset) {
                        const nextDate = new Date(currentMonthBase);
                        nextDate.setUTCMonth(nextDate.getUTCMonth() + currentLimitOffset);
                        state.income.starBonus.thUpgrades[subsequent] = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}`;
                        currentLimitOffset++;
                    } else {
                        currentLimitOffset = subOffset;
                    }
                }
            }
        }
    });
    renderTHPlanningSection();
}

function renderTHPlanningSection() {
    const planningData = state.income.starBonus?.thUpgrades || {};
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    // Roll/Expire logic: remove upgrades that are in the past
    let stateChanged = false;
    for (const th in planningData) {
        const plan = planningData[th];
        if (plan) {
            const [year, month] = plan.split('-').map(Number);
            const diff = (year - currentYear) * 12 + (month - 1 - currentMonth);
            if (diff < 0) {
                delete planningData[th];
                stateChanged = true;
            }
        }
    }
    if (stateChanged) {
        handleStateUpdate(() => {}, true);
    }

    renderTHPlanningSectionDisplay(state, handleTHUpgradeChange);
}

function renderStarBonusSelectorContent() {
    renderSelectorContentDisplay(state);
}

function ensureStarBonus2xState() {
    if (!state.income.starBonus) state.income.starBonus = {};
    if (!state.income.starBonus["2x"]) state.income.starBonus["2x"] = {};
    return state.income.starBonus["2x"];
}

/**
 * Initializes Star Bonus league selector, 2x event multiplier modal, and input bindings.
 */
export function initializeStarBonusSelector() {
    const selectElement = dom.income?.starBonus?.league;
    const frequencyInput = dom.income?.starBonus?.frequencyInput;
    const durationInput = dom.income?.starBonus?.durationInput;
    const lastEventSelect = dom.income?.starBonus?.lastEventSelect;
    const openMultiplierBtn = dom.income?.starBonus?.openMultiplierBtn;
    const multiplierModal = dom.income?.starBonus?.multiplierModal;
    const closeMultiplierHeaderBtn = dom.income?.starBonus?.closeMultiplierHeaderBtn;
    const closeMultiplierFooterBtn = dom.income?.starBonus?.closeMultiplierFooterBtn;

    bindSelectInput(selectElement, {
        numeric: true,
        onUpdate: (value) => {
            if (!state.income.starBonus) state.income.starBonus = {};
            state.income.starBonus.league = value;
        }
    });

    if (openMultiplierBtn && multiplierModal) {
        openMultiplierBtn.addEventListener('click', () => {
            openModal(multiplierModal);
        });
    }

    const closeMultiplierModal = () => {
        if (multiplierModal) closeModalAnimated(multiplierModal);
    };

    if (closeMultiplierHeaderBtn) closeMultiplierHeaderBtn.addEventListener('click', closeMultiplierModal);
    if (closeMultiplierFooterBtn) closeMultiplierFooterBtn.addEventListener('click', closeMultiplierModal);

    bindNumericInput(frequencyInput, {
        inputName: translate('views.income.starBonus.eventFrequency'),
        popover: {
            title: () => translate('views.income.starBonus.eventFrequency'),
            min: STAR_BONUS_2X_DEFAULTS.minFrequency,
            max: STAR_BONUS_2X_DEFAULTS.maxFrequency,
            showRange: true,
            showRecommended: true,
            recommended: STAR_BONUS_2X_DEFAULTS.frequency,
            clickToFill: {
                recommended: true
            }
        },
        onUpdate: (value) => {
            ensureStarBonus2xState().frequency = value;
        },
        afterUpdate: () => {
            renderLastEventOptions();
        }
    });

    bindNumericInput(durationInput, {
        inputName: translate('views.income.starBonus.eventDuration'),
        popover: {
            title: () => translate('views.income.starBonus.eventDuration'),
            min: STAR_BONUS_2X_DEFAULTS.minDuration,
            max: STAR_BONUS_2X_DEFAULTS.maxDuration,
            showMin: true,
            minLabel: () => translate('actions.disable'),
            showMax: false,
            showRecommended: true,
            recommended: STAR_BONUS_2X_DEFAULTS.duration,
            clickToFill: {
                min: true,
                recommended: true
            }
        },
        onUpdate: (value) => {
            ensureStarBonus2xState().duration = value;
        }
    });

    bindSelectInput(lastEventSelect, {
        numeric: true,
        onUpdate: (offset) => {
            const now = new Date();
            let year = now.getUTCFullYear();
            let month = now.getUTCMonth() + offset;

            while (month < 0) {
                month += 12;
                year -= 1;
            }

            ensureStarBonus2xState().lastEvent = `${year}-${String(month + 1).padStart(2, '0')}`;
        }
    });

    document.addEventListener('languageChanged', () => {
        renderStarBonusSelectorContent();
        renderTHPlanningSection();
        renderLastEventOptions();
    });
    renderStarBonusSelectorContent();
    renderTHPlanningSection();
    renderLastEventOptions();
}

/**
 * Populates and synchronizes Star Bonus league selection and 2x event control values.
 * @param {import('../../core/types.js').IncomeSourcesState} incomeState - Global income state object containing starBonus settings.
 */
export function renderStarBonusControls(incomeState) {
    renderStarBonusSelectorContent();
    renderTHPlanningSection();
    renderLastEventOptions();

    const selectElement = dom.income?.starBonus?.league;
    const safeState = incomeState.starBonus || {};
    if (selectElement) {
        selectElement.value = safeState.league || 105000000;
    }

    const frequencyInput = dom.income?.starBonus?.frequencyInput;
    const durationInput = dom.income?.starBonus?.durationInput;
    const lastEventSelect = dom.income?.starBonus?.lastEventSelect;

    if (frequencyInput) {
        frequencyInput.value = safeState["2x"]?.frequency || STAR_BONUS_2X_DEFAULTS.frequency;
    }
    if (durationInput) {
        durationInput.value = safeState["2x"]?.duration !== undefined ? safeState["2x"].duration : STAR_BONUS_2X_DEFAULTS.duration;
    }
}
