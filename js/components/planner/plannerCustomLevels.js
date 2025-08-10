import { dom } from '../../dom/domElements.js';
import { addValidation } from '../../utils/inputValidator.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

export function initializePlannerCustomLevels() {
    const commonMaxLevelInput = dom.planner?.customMaxLevel?.common;
    const epicMaxLevelInput = dom.planner?.customMaxLevel?.epic;

    if (commonMaxLevelInput) {
        addValidation(commonMaxLevelInput, { inputName: 'commonMaxLevel' });
        commonMaxLevelInput.addEventListener('validated-input', (event) => {
            handleStateUpdate(() => {
                state.planner.customMaxLevel.common = event.detail.value;
            });
        });
    }
    if (epicMaxLevelInput) {
        addValidation(epicMaxLevelInput, { inputName: 'epicMaxLevel' });
        epicMaxLevelInput.addEventListener('validated-input', (event) => {
            handleStateUpdate(() => {
                state.planner.customMaxLevel.epic = event.detail.value;
            });
        });
    }
}

export function renderPlannerCustomLevels(plannerState) {
    if (!plannerState) {
        console.error('Planner state is not available. Cannot update DOM.');
        return;
    }
    const commonMaxLevelInput = dom.planner?.customMaxLevel?.common;
    const epicMaxLevelInput = dom.planner?.customMaxLevel?.epic;

    if (commonMaxLevelInput) {
        commonMaxLevelInput.value = plannerState.customMaxLevel.common;
    }
    if (epicMaxLevelInput) {
        epicMaxLevelInput.value = plannerState.customMaxLevel.epic;
    }
}