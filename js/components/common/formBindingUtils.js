import { handleStateUpdate } from '../../core/stateManager.js';

import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';

/**
 * Binds a numeric input element with optional validation, popover features,
 * and automatic state management via handleStateUpdate.
 *
 * @param {HTMLInputElement|HTMLElement|null} inputElement
 * @param {Object} options
 * @param {string} [options.inputName='value'] - Input name for validation toast messages.
 * @param {Object} [options.popover] - Popover configuration for registerInputPopover.
 * @param {boolean} [options.validation=true] - Whether to attach addValidation.
 * @param {boolean} [options.silent=false] - Whether state update should skip UI recalculation/rendering.
 * @param {Function} [options.onUpdate] - Callback (value, event) executed inside handleStateUpdate.
 * @param {Function} [options.afterUpdate] - Callback (value, event) executed after state update.
 */
export function bindNumericInput(inputElement, options = {}) {
    if (!inputElement) return;

    const {
        inputName = 'value',
        popover,
        validation = true,
        silent = false,
        onUpdate,
        afterUpdate
    } = options;

    if (validation) {
        addValidation(inputElement, { inputName });
    } else {
        inputElement.addEventListener('wheel', () => {
            if (document.activeElement === inputElement && typeof inputElement.blur === 'function') {
                inputElement.blur();
            }
        }, { passive: true });
    }

    if (popover) {
        registerInputPopover(inputElement, popover);
    }

    const eventName = validation ? 'validated-input' : 'change';

    inputElement.addEventListener(eventName, (e) => {
        const value = (validation && e.detail && e.detail.value !== undefined)
            ? e.detail.value
            : (parseInt(e.target.value, 10) || 0);

        if (typeof onUpdate === 'function') {
            handleStateUpdate(() => {
                onUpdate(value, e);
            }, silent);
        }

        if (typeof afterUpdate === 'function') {
            afterUpdate(value, e);
        }
    });
}

/**
 * Binds a checkbox or toggle input to state management.
 *
 * @param {HTMLInputElement|HTMLElement|null} toggleElement
 * @param {Object} options
 * @param {boolean} [options.silent=false] - Whether state update should skip UI recalculation/rendering.
 * @param {Function} [options.onUpdate] - Callback (checked, event) executed inside handleStateUpdate.
 * @param {Function} [options.afterUpdate] - Callback (checked, event) executed after state update.
 */
export function bindToggleInput(toggleElement, options = {}) {
    if (!toggleElement) return;

    const { silent = false, onUpdate, afterUpdate } = options;

    toggleElement.addEventListener('change', (e) => {
        const checked = e.target.checked;

        if (typeof onUpdate === 'function') {
            handleStateUpdate(() => {
                onUpdate(checked, e);
            }, silent);
        }

        if (typeof afterUpdate === 'function') {
            afterUpdate(checked, e);
        }
    });
}

/**
 * Binds a select dropdown element to state management.
 *
 * @param {HTMLSelectElement|HTMLElement|null} selectElement
 * @param {Object} options
 * @param {boolean} [options.numeric=false] - If true, parses value as base-10 integer.
 * @param {boolean} [options.silent=false] - Whether state update should skip UI recalculation/rendering.
 * @param {Function} [options.onUpdate] - Callback (value, event) executed inside handleStateUpdate.
 * @param {Function} [options.afterUpdate] - Callback (value, event) executed after state update.
 */
export function bindSelectInput(selectElement, options = {}) {
    if (!selectElement) return;

    const { numeric = false, silent = false, onUpdate, afterUpdate } = options;

    selectElement.addEventListener('change', (e) => {
        const value = numeric ? (parseInt(e.target.value, 10) || 0) : e.target.value;

        if (typeof onUpdate === 'function') {
            handleStateUpdate(() => {
                onUpdate(value, e);
            }, silent);
        }

        if (typeof afterUpdate === 'function') {
            afterUpdate(value, e);
        }
    });
}
