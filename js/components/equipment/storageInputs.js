import { translate } from '../../i18n/translator.js';

import { STORAGE_LIMITS } from '../../core/constants.js';
import { state } from '../../core/state.js';

import { bindNumericInput } from '../common/formBindingUtils.js';
import { dom } from '../../dom/domElements.js';

/**
 * Initializes stored ores numeric input listeners with form binding utils and popovers.
 */
export function initializeStorageInputs() {
    const ores = /** @type {Array<'shiny' | 'glowy' | 'starry'>} */ (['shiny', 'glowy', 'starry']);
    ores.forEach(oreType => {
        const input = dom.equipment?.storage?.quantity?.[oreType];
        if (!input) return;

        bindNumericInput(input, {
            inputName: translate(`entities.ores.${oreType}`),
            popover: {
                title: () => translate(`entities.ores.${oreType}`),
                min: 0,
                max: STORAGE_LIMITS[oreType],
                placement: 'prefer-below',
                clickToFill: {
                    max: true
                }
            },
            onUpdate: (value) => {
                state.storedOres[oreType] = value;
                state.storedOres.lastUpdated = Date.now();
            }
        });
    });
}

/**
 * Renders stored ores input values in equipment tab with DOM layout protection.
 *
 * @param {Object} storedOres
 */
export function renderStorageInputs(storedOres) {
    const inputs = dom.equipment?.storage?.quantity;
    if (!inputs) return;

    if (inputs.shiny && inputs.shiny.value !== String(storedOres.shiny || 0)) inputs.shiny.value = storedOres.shiny || 0;
    if (inputs.glowy && inputs.glowy.value !== String(storedOres.glowy || 0)) inputs.glowy.value = storedOres.glowy || 0;
    if (inputs.starry && inputs.starry.value !== String(storedOres.starry || 0)) inputs.starry.value = storedOres.starry || 0;
}
