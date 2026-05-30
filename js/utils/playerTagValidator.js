import { translate } from '../i18n/translator.js';

const tagValidChars = "CGJLOPQRUVY0289"; 
const MAX_TAG_LENGTH = 12;
let validationErrorTimeout;

export function validatePlayerTagInput(inputElement, errorElement) {
    const rawValue = inputElement.value.trim().toUpperCase();
    
    let isValid = true;
    let errorMessage = '';

    if (validationErrorTimeout) {
        clearTimeout(validationErrorTimeout);
        validationErrorTimeout = null;
    }

    // 1. Detect invalid characters
    const invalidCharRegex = new RegExp(`[^${tagValidChars}#]`, 'i');
    const match = rawValue.match(invalidCharRegex);
    
    if (match) {
        errorMessage = translate('errors.invalidChar', { char: match[0], validChars: tagValidChars });
        isValid = false;
    } else if (rawValue === '' || rawValue === '#') {
        errorMessage = translate('errors.playerTagRequired');
        isValid = false;
    }

    // 2. Clean the tag for state/API use (remove # and invalid chars)
    let cleanedTag = rawValue.replace(/#/g, '').replace(new RegExp(`[^${tagValidChars}]`, 'gi'), "");
    
    // 3. Length check
    if (isValid && cleanedTag.length > MAX_TAG_LENGTH) {
        errorMessage = translate('errors.playerTagLength', { max: MAX_TAG_LENGTH });
        isValid = false;
    }

    // Update the input field with the "sanitized" but user-friendly version (preserving one leading # if present)
    let displayValue = rawValue.replace(new RegExp(`[^${tagValidChars}#]`, 'gi'), "");
    if (displayValue.indexOf('#') > 0) {
        // Move any misplaced # to the front or remove them
        displayValue = '#' + displayValue.replace(/#/g, '');
    }
    inputElement.value = displayValue;

    if (!isValid) {
        errorElement.textContent = errorMessage;
        errorElement.classList.add('show');
        inputElement.classList.add('input-error');

        // Visual Feedback: Shake
        inputElement.classList.remove('shake');
        void inputElement.offsetWidth; // Force reflow
        inputElement.classList.add('shake');

        validationErrorTimeout = setTimeout(() => {
            errorElement.textContent = '';
            errorElement.classList.remove('show');
            inputElement.classList.remove('input-error');
        }, 5000);
    } else {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
        inputElement.classList.remove('input-error');
    }

    return { cleanedTag, isValid };
}
