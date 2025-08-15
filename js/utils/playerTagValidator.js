const tagValidChars = "CGJLOPQRUVY0289"; 
const MAX_TAG_LENGTH = 12;
let validationErrorTimeout;

export function validatePlayerTagInput(inputElement, errorElement) {
    const rawTag = inputElement.value.trim().toUpperCase();
    let cleanedTag = rawTag.replace("#", "").replace(new RegExp(`[^${tagValidChars}]`, 'gi'), "");
    
    let isValid = true;
    let errorMessage = '';

    if (validationErrorTimeout) {
        clearTimeout(validationErrorTimeout);
        validationErrorTimeout = null;
    }

    const invalidCharRegex = new RegExp(`[^${tagValidChars}#]`, 'i');
    const match = rawTag.match(invalidCharRegex);
    if (match) {
        errorMessage = `Invalid character entered: "${match[0]}". Valid characters are: ${tagValidChars}`;
        isValid = false;
    } else if (rawTag.length === 0) {
        errorMessage = 'Please enter a player tag.';
        isValid = false;
    } else if (cleanedTag.length > MAX_TAG_LENGTH) {
        errorMessage = `Player tag cannot exceed ${MAX_TAG_LENGTH} characters.`;
        isValid = false;
    }

    inputElement.value = cleanedTag;

    if (!isValid) {
        errorElement.textContent = errorMessage;
        errorElement.classList.add('show');
        inputElement.classList.add('input-error');

        validationErrorTimeout = setTimeout(() => {
            errorElement.textContent = '';
            errorElement.classList.remove('show');
            inputElement.classList.remove('input-error');
        }, 3000);
    } else {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
        inputElement.classList.remove('input-error');
    }

    return { cleanedTag, isValid };
}
