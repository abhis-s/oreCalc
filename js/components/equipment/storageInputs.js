import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { bindNumericInput } from '../common/formBindingUtils.js';
import { dom } from '../../dom/domElements.js';
import { buildStorageInputPopoverOptions } from '../common/storageControlsHelper.js';

/**
 * Initializes stored ores numeric input listeners with form binding utils and popovers.
 */
export function initializeStorageInputs() {
    const allowOverflowSwitch = dom.equipment?.allowOverflowToggle;
    if (allowOverflowSwitch) {
        allowOverflowSwitch.checked = Boolean(state.storedOres?.allowOverflow);
        allowOverflowSwitch.addEventListener('change', () => {
            handleStateUpdate(() => {
                state.storedOres.allowOverflow = Boolean(allowOverflowSwitch.checked);
            });
        });
    }

    const ores = /** @type {Array<'shiny' | 'glowy' | 'starry'>} */ (['shiny', 'glowy', 'starry']);
    ores.forEach(oreType => {
        const input = dom.equipment?.storage?.quantity?.[oreType];
        if (!input) return;

        bindNumericInput(input, {
            inputName: translate(`entities.ores.${oreType}`),
            popover: buildStorageInputPopoverOptions(oreType, () => Boolean(state.storedOres?.allowOverflow)),
            onUpdate: (value) => {
                state.storedOres[oreType] = value;
                state.storedOres.lastUpdated = Date.now();
            }
        });
    });
}
