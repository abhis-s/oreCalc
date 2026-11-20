import { state } from '../../core/state.js';
import { syncCraftPassPreleveling } from '../../domain/equipment/craftPassPrelevelDomain.js';
import { bindToggleInput } from '../common/formBindingUtils.js';
import { dom } from '../../dom/domElements.js';

function ensureCraftPassState() {
    if (!state.income.craftPass) state.income.craftPass = { craftPass: false };
    return state.income.craftPass;
}

/**
 * Initializes Craft Pass input event listeners and state synchronization.
 */
export function initializeCraftPassInputs() {
    const passToggle = dom.income?.craftPass?.passToggle;

    bindToggleInput(passToggle, {
        onUpdate: (checked) => {
            ensureCraftPassState().craftPass = checked;
            syncCraftPassPreleveling(state.heroes, checked, state);
        }
    });
}

/**
 * Populates Craft Pass switch checked state.
 * @param {import('../../core/types.js').CraftPassIncomeState} [craftPassState]
 */
export function renderCraftPassInputs(craftPassState) {
    const passToggle = dom.income?.craftPass?.passToggle;
    if (passToggle) {
        passToggle.checked = Boolean(craftPassState?.craftPass);
    }
}
