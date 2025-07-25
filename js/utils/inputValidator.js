export function addValidation(inputElement, { inputName = 'value' }) {
    if (!inputElement) return;

    const min = parseInt(inputElement.min, 10);
    const max = parseInt(inputElement.max, 10);
    const maxLength = parseInt(inputElement.maxLength, 10) || Infinity;

    inputElement.dataset.lastValidValue = inputElement.value;
    const dialog = document.createElement('div');
    dialog.classList.add('input-dialog');
    inputElement.parentNode.insertBefore(dialog, inputElement.nextSibling);

    const showDialog = (message, type) => {
        dialog.textContent = message;
        dialog.classList.add('show', `${type}-border`);
        inputElement.classList.add(`${type}-border`);
        setTimeout(() => {
            dialog.classList.remove('show');
            inputElement.classList.remove(`${type}-border`);
        }, 3000);
    };

    inputElement.addEventListener('keydown', (event) => {
        const currentValue = parseInt(event.target.value, 10);
        if (event.key === 'ArrowUp') {
            if (currentValue >= max) {
                event.preventDefault();
                showDialog(`Max: ${max}`, 'warning');
            }
        } else if (event.key === 'ArrowDown') {
            if (currentValue <= min) {
                event.preventDefault();
                showDialog(`Min: ${min}`, 'warning');
            }
        } else {
            event.target.classList.remove('warning-border', 'error-border');
            dialog.classList.remove('show');
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
            showDialog(`Max length is ${maxLength} digits.`, 'warning');
        }
        
        event.target.value = value;

        event.target.classList.remove('warning-border', 'error-border');
        dialog.classList.remove('show');
    });

    inputElement.addEventListener('change', (event) => {
        let value = event.target.value.trim();
        if (value === '') value = min.toString();

        let currentValue = parseInt(value, 10);

        if (isNaN(currentValue) || currentValue < min || currentValue > max) {
            showDialog(`Invalid. Reverting to last valid value.`, 'error');
            currentValue = parseInt(inputElement.dataset.lastValidValue, 10);
        } else {
            event.target.classList.remove('warning-border', 'error-border');
            dialog.classList.remove('show');
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