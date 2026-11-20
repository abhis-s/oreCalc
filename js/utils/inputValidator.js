import { translate } from '../i18n/translator.js';

import { formatCurrency } from './numberFormatter.js';

/**
 * Emits a validation notification event from the target input element.
 * @param {HTMLInputElement|any} inputElement
 * @param {string} message
 * @param {'warning'|'error'|'info'|'success'} [type='warning']
 */
function notifyValidation(inputElement, message, type = 'warning') {
    if (inputElement && typeof inputElement.dispatchEvent === 'function') {
        inputElement.dispatchEvent(new CustomEvent('input-validation-message', {
            bubbles: true,
            composed: true,
            detail: { message, type }
        }));
    }
}

function getNumericBounds(inputElement) {
    const minRaw = parseInt(inputElement.min, 10);
    const maxRaw = parseInt(inputElement.max, 10);
    return {
        min: isNaN(minRaw) ? 0 : minRaw,
        max: isNaN(maxRaw) ? Number.MAX_SAFE_INTEGER : maxRaw
    };
}

/**
 * Attaches real-time currency sanitization, decimal parsing, and formatted blur events to an input.
 * @param {HTMLInputElement} inputElement - Target input element.
 * @param {string} [currencyCode='USD'] - ISO currency code for decimal formatting.
 */
export function addCurrencyValidation(inputElement, currencyCode = 'USD') {
    if (!inputElement) return;

    inputElement.addEventListener('input', (event) => {
        let value = event.target.value;
        value = value.replace(/[^0-9.,]/g, '');
        event.target.value = value;
    });

    inputElement.addEventListener('blur', (event) => {
        let value = event.target.value.trim();
        if (value === '') return;

        let normalized = value;

        if (value.includes(',') && value.includes('.')) {
            const commaIndex = value.lastIndexOf(',');
            const dotIndex = value.lastIndexOf('.');

            if (commaIndex > dotIndex) {
                normalized = value.replace(/\./g, '').replace(',', '.');
            } else {
                normalized = value.replace(/,/g, '');
            }
        } else if (value.includes(',')) {
            normalized = value.replace(',', '.');
        }

        const floatValue = parseFloat(normalized);
        if (!isNaN(floatValue)) {
            event.target.value = formatCurrency(floatValue, currencyCode);
            inputElement.classList.remove('input-status-error', 'soft-shake');
        } else {
            inputElement.classList.remove('soft-shake');
            void inputElement.offsetWidth; // Force reflow
            inputElement.classList.add('input-status-error', 'soft-shake');
            notifyValidation(inputElement, translate('validation.invalidCurrency'), 'error');
        }
    });

    inputElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.target.blur();
        }
    });
}

/**
 * Attaches numeric validation and event listeners to an input element.
 * @param {HTMLInputElement | any} inputElement - Target input element.
 * @param {Record<string, any>} [options={}] - Optional configuration options.
 */
export function addValidation(inputElement, options = {}) {
    if (!inputElement) return;

    const { min } = getNumericBounds(inputElement);

    inputElement.dataset.lastValidValue = inputElement.value.trim() === '' ? (inputElement.dataset.allowEmpty === 'true' ? '' : min.toString()) : inputElement.value;

    let warningTimeout = null;
    let errorTimeout = null;
    let hasUncommittedEdit = false;
    let committedOnBlur = false;
    let isDispatchingSyntheticChange = false;

    const setInputStatus = (status, duration = 2000) => {
        if (status === 'warning') {
            if (inputElement.classList.contains('input-status-warning')) {
                return;
            }
            inputElement.classList.remove('input-status-error', 'input-status-success', 'success-glow-pulse', 'soft-shake');
            inputElement.classList.add('input-status-warning');
            if (warningTimeout) clearTimeout(warningTimeout);
            warningTimeout = setTimeout(() => {
                inputElement.classList.remove('input-status-warning');
            }, duration);
        } else if (status === 'error') {
            inputElement.classList.remove('input-status-warning', 'input-status-success', 'success-glow-pulse', 'soft-shake');

            // Force reflow for shake animation
            void inputElement.offsetWidth;

            inputElement.classList.add('input-status-error', 'soft-shake');
            if (errorTimeout) clearTimeout(errorTimeout);
            errorTimeout = setTimeout(() => {
                inputElement.classList.remove('input-status-error', 'soft-shake');
            }, duration);
        } else if (status === 'success') {
            inputElement.classList.remove('input-status-warning', 'input-status-error', 'input-status-success', 'success-glow-pulse', 'soft-shake');

            // Force reflow for success pulse
            void inputElement.offsetWidth;

            inputElement.classList.add('input-status-success', 'success-glow-pulse');
            setTimeout(() => {
                inputElement.classList.remove('input-status-success', 'success-glow-pulse');
            }, 600);
        }
    };

    const dispatchValidatedInput = (val) => {
        inputElement.dispatchEvent(new CustomEvent('validated-input', {
            detail: { value: val },
            bubbles: true,
            composed: true
        }));
    };

    const dispatchSyntheticChange = () => {
        isDispatchingSyntheticChange = true;
        try {
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        } finally {
            isDispatchingSyntheticChange = false;
        }
    };

    const commitValue = (sourceType) => {
        hasUncommittedEdit = false;
        const { min, max } = getNumericBounds(inputElement);
        let value = String(inputElement.value ?? '').trim();

        if (value === '') {
            if (inputElement.dataset.allowEmpty === 'true') {
                const wasAlreadyEmpty = inputElement.dataset.lastValidValue === '';
                inputElement.value = '';
                inputElement.dataset.lastValidValue = '';
                if (sourceType === 'blur' && wasAlreadyEmpty) {
                    return;
                }
                dispatchValidatedInput('');
                if (sourceType === 'blur') {
                    committedOnBlur = true;
                    dispatchSyntheticChange();
                }
                return;
            }
            value = min.toString();
        }

        let currentValue = parseInt(value, 10);

        if (isNaN(currentValue) || currentValue < min || currentValue > max) {
            setInputStatus('error');
            notifyValidation(inputElement, translate('validation.invalidRevert'), 'error');
            const lastValid = Number(inputElement.dataset.lastValidValue);
            currentValue = isNaN(lastValid) ? min : Math.min(Math.max(lastValid, min), max);
        } else {
            const didChange = String(currentValue) !== String(inputElement.dataset.lastValidValue);
            if (sourceType === 'blur' && !didChange) {
                inputElement.value = String(currentValue);
                return;
            }
            setInputStatus('success');
        }

        inputElement.value = String(currentValue);
        inputElement.dataset.lastValidValue = String(currentValue);
        dispatchValidatedInput(currentValue);

        if (sourceType === 'blur') {
            committedOnBlur = true;
            dispatchSyntheticChange();
        }
    };

    inputElement.addEventListener('keydown', (event) => {
        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        const isShortcut = (event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase());

        // Allow Android virtual keyboard and IME composition events without premature cancellation
        if (event.key === 'Unidentified' || event.isComposing) {
            return;
        }

        if (!allowedKeys.includes(event.key) && !isShortcut && !/^[0-9]$/.test(event.key)) {
            event.preventDefault();
            return;
        }

        const { min, max } = getNumericBounds(inputElement);
        const rawValue = parseInt(event.target.value, 10);
        const currentValue = isNaN(rawValue) ? min : rawValue;

        if (event.key === 'ArrowUp') {
            if (currentValue >= max) {
                event.preventDefault();
                setInputStatus('warning');
                notifyValidation(inputElement, translate('validation.maxValue', { max: max }), 'warning');
            }
        } else if (event.key === 'ArrowDown') {
            if (currentValue <= min) {
                event.preventDefault();
                setInputStatus('warning');
                notifyValidation(inputElement, translate('validation.minValue', { min: min }), 'warning');
            }
        } else {
            inputElement.classList.remove('input-status-warning', 'input-status-error');
        }
    });

    inputElement.addEventListener('input', (event) => {
        hasUncommittedEdit = true;
        committedOnBlur = false;

        let value = event.target.value;
        const rawMaxLength = Number(inputElement.maxLength);
        const maxLength = rawMaxLength > 0 ? rawMaxLength : Infinity;

        if (value.length > 1 && value.startsWith('0')) {
            value = parseInt(value, 10).toString();
        }

        if (maxLength > 0 && value.length > maxLength) {
            value = value.slice(0, maxLength);
            setInputStatus('warning');
            notifyValidation(inputElement, translate('validation.maxLength', { maxLength: maxLength }), 'warning');
        } else {
            inputElement.classList.remove('input-status-warning', 'input-status-error');
        }

        if (event.target.value !== value) {
            event.target.value = value;
        }
    });

    inputElement.addEventListener('focus', () => {
        committedOnBlur = false;
    });

    inputElement.addEventListener('change', () => {
        if (isDispatchingSyntheticChange) return;

        const trimmed = String(inputElement.value ?? '').trim();
        const isUnchangedSinceBlur = committedOnBlur && trimmed === String(inputElement.dataset.lastValidValue ?? '');
        committedOnBlur = false;
        if (isUnchangedSinceBlur) {
            return;
        }

        commitValue('change');
    });

    inputElement.addEventListener('blur', () => {
        if (!hasUncommittedEdit) return;
        commitValue('blur');
    });

    inputElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.target.blur();
        }
    });

    inputElement.addEventListener('wheel', () => {
        if (document.activeElement === inputElement && typeof inputElement.blur === 'function') {
            inputElement.blur();
        }
    }, { passive: true });
}

/**
 * Validates and clamps all numeric input fields to their declared min/max boundaries.
 * @param {NodeListOf<HTMLInputElement>|Array<HTMLInputElement>} [inputFields] - Optional elements to validate.
 */
export function validateAllInputs(inputFields) {
    const inputs = inputFields || document.querySelectorAll('input.updatable');
    inputs.forEach(inputElement => {
        if (!inputElement) return;

        const { min, max } = getNumericBounds(inputElement);
        let value = inputElement.value.trim();

        if (value === '') {
            value = min.toString();
        }

        let currentValue = parseInt(value, 10);

        if (isNaN(currentValue) || currentValue < min) {
            currentValue = min;
        } else if (currentValue > max) {
            currentValue = max;
        }

        inputElement.value = currentValue;
        inputElement.dataset.lastValidValue = currentValue;
    });
}

/**
 * Validates that all select dropdown elements have a valid active option value.
 * @param {NodeListOf<HTMLSelectElement>|Array<HTMLSelectElement>} [selectFields] - Optional selects to validate.
 */
export function validateAllSelects(selectFields) {
    const selects = selectFields || document.querySelectorAll('select.updatable');
    selects.forEach(selectElement => {
        if (!selectElement) return;

        const selectedValue = selectElement.value;
        let isValid = false;
        for (const option of selectElement.options) {
            if (option.value === selectedValue) {
                isValid = true;
                break;
            }
        }

        if (!isValid && selectElement.options.length > 0) {
            selectElement.value = selectElement.options[0].value;
        }
    });
}
