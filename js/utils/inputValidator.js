import { state } from '../core/state.js';

import { translate } from '../i18n/translator.js';

import { formatCurrency } from './numberFormatter.js';

import { showToast } from '../ui/toast.js';

export function addCurrencyValidation(inputElement) {
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
            event.target.value = formatCurrency(floatValue);
            inputElement.classList.remove('input-status-error', 'soft-shake');
        } else {
            inputElement.classList.remove('soft-shake');
            void inputElement.offsetWidth; // Force reflow
            inputElement.classList.add('input-status-error', 'soft-shake');
            showToast(translate('validation.invalidCurrency') || "Invalid currency format", 'error');
        }
    });

    inputElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.target.blur();
        }
    });
}

export function addValidation(inputElement, { inputName = 'value' }) {
    if (!inputElement) return;

    const maxLength = parseInt(inputElement.maxLength, 10) || Infinity;

    const minRaw = parseInt(inputElement.min, 10);
    const maxRaw = parseInt(inputElement.max, 10);
    const min = isNaN(minRaw) ? 0 : minRaw;
    const max = isNaN(maxRaw) ? Number.MAX_SAFE_INTEGER : maxRaw;

    inputElement.dataset.lastValidValue = inputElement.value.trim() === '' ? min.toString() : inputElement.value;

    let warningTimeout = null;
    let errorTimeout = null;

    const setInputStatus = (status, duration = 2000) => {
        inputElement.classList.remove('input-status-warning', 'input-status-error', 'input-status-success', 'success-glow-pulse', 'soft-shake');
        
        // Force reflow
        void inputElement.offsetWidth;

        if (status === 'warning') {
            inputElement.classList.add('input-status-warning');
            if (warningTimeout) clearTimeout(warningTimeout);
            warningTimeout = setTimeout(() => {
                inputElement.classList.remove('input-status-warning');
            }, duration);
        } else if (status === 'error') {
            inputElement.classList.add('input-status-error');
            inputElement.classList.add('soft-shake');
            if (errorTimeout) clearTimeout(errorTimeout);
            errorTimeout = setTimeout(() => {
                inputElement.classList.remove('input-status-error', 'soft-shake');
            }, duration);
        } else if (status === 'success') {
            inputElement.classList.add('input-status-success');
            inputElement.classList.add('success-glow-pulse');
            setTimeout(() => {
                inputElement.classList.remove('input-status-success', 'success-glow-pulse');
            }, 600);
        }
    };

    inputElement.addEventListener('keydown', (event) => {
        // 1. Block non-numeric characters (allow control keys and shortcut combos)
        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        const isShortcut = (event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key.toLowerCase());

        if (!allowedKeys.includes(event.key) && !isShortcut && !/^[0-9]$/.test(event.key)) {
            event.preventDefault();
            return;
        }

        // 2. Bounds validation for ArrowUp and ArrowDown
        const minRaw = parseInt(inputElement.min, 10);
        const maxRaw = parseInt(inputElement.max, 10);
        const min = isNaN(minRaw) ? 0 : minRaw;
        const max = isNaN(maxRaw) ? Number.MAX_SAFE_INTEGER : maxRaw;
        const rawValue = parseInt(event.target.value, 10);
        const currentValue = isNaN(rawValue) ? min : rawValue;
        
        if (event.key === 'ArrowUp') {
            if (currentValue >= max) {
                event.preventDefault();
                setInputStatus('warning');
                showToast(translate('validation.maxValue', { max: max }), 'warning');
            }
        } else if (event.key === 'ArrowDown') {
            if (currentValue <= min) {
                event.preventDefault();
                setInputStatus('warning');
                showToast(translate('validation.minValue', { min: min }), 'warning');
            }
        } else {
            inputElement.classList.remove('input-status-warning', 'input-status-error');
        }
    });

    inputElement.addEventListener('paste', (event) => {
        const pasteData = (event.clipboardData || window.clipboardData).getData('text');
        if (!/^\d+$/.test(pasteData)) {
            event.preventDefault();
            setInputStatus('error');
            showToast(translate('validation.invalidNumber') || "Only numbers are allowed", 'error');
        }
    });

    inputElement.addEventListener('input', (event) => {
        let value = event.target.value;
        const maxLength = parseInt(inputElement.maxLength, 10) || Infinity;

        if (value.length > 1 && value.startsWith('0')) {
            value = parseInt(value, 10).toString();
        }

        if (maxLength > 0 && value.length > maxLength) {
            value = value.slice(0, maxLength);
            setInputStatus('warning');
            showToast(translate('validation.maxLength', { maxLength: maxLength }), 'warning');
        }

        event.target.value = value;
        inputElement.classList.remove('input-status-warning', 'input-status-error');
    });

    inputElement.addEventListener('change', (event) => {
        const minRaw = parseInt(inputElement.min, 10);
        const maxRaw = parseInt(inputElement.max, 10);
        const min = isNaN(minRaw) ? 0 : minRaw;
        const max = isNaN(maxRaw) ? Number.MAX_SAFE_INTEGER : maxRaw;
        let value = event.target.value.trim();
        if (value === '') value = min.toString();

        let currentValue = parseInt(value, 10);

        if (isNaN(currentValue) || currentValue < min || currentValue > max) {
            setInputStatus('error');
            showToast(translate('validation.invalidRevert'), 'error');
            let lastValid = parseInt(inputElement.dataset.lastValidValue, 10);
            if (isNaN(lastValid) || lastValid < min) {
                currentValue = min;
            } else if (lastValid > max) {
                currentValue = max;
            } else {
                currentValue = lastValid;
            }
        } else {
            setInputStatus('success');
        }

        inputElement.value = currentValue;
        inputElement.dataset.lastValidValue = currentValue;

        inputElement.dispatchEvent(new CustomEvent('validated-input', {
            detail: { value: currentValue },
            bubbles: true,
            composed: true
        }));
    });

    inputElement.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.target.blur();
        }
    });
}


export function validateAllInputs(inputFields) {
    const inputs = inputFields || document.querySelectorAll('input.updatable');
    inputs.forEach(inputElement => {
        if (!inputElement) return;

        const minRaw = parseInt(inputElement.min, 10);
        const maxRaw = parseInt(inputElement.max, 10);
        const min = isNaN(minRaw) ? 0 : minRaw;
        const max = isNaN(maxRaw) ? Number.MAX_SAFE_INTEGER : maxRaw;
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