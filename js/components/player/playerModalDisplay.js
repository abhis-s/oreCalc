import { translate } from '../../i18n/translator.js';

import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';

import { dom } from '../../dom/domElements.js';
import { sanitizeHTML } from '../../ui/noticeModal.js';

let errorTimeout;
let isForcedVerification = false;

/**
 * Returns whether API token verification is currently enforced for player loading.
 * @returns {boolean} True if token verification is required.
 */
export function getForcedVerification() {
    return isForcedVerification;
}

/**
 * Sets whether API token verification is enforced for player loading.
 * @param {boolean} value - True to require API token verification.
 */
export function setForcedVerification(value) {
    isForcedVerification = Boolean(value);
}

/**
 * Updates disabled state of Load Player modal button based on tag input length.
 * @param {HTMLInputElement} playerTagInput - Input element for player tag.
 * @param {HTMLButtonElement} loadButton - Button element to load player.
 */
export function updateLoadButtonState(playerTagInput, loadButton) {
    if (!playerTagInput || !loadButton) return;
    loadButton.disabled = playerTagInput.value.trim().length === 0;
}

/**
 * Resets Player Modal input fields, validation error classes, and button states to initial defaults.
 */
export function resetModalState() {
    const playerTagInput = dom.player?.playerTagInputModal;
    const loadButton = dom.player?.loadPlayerModalButton;
    const verifyButton = dom.player?.verifyPlayerModalButton;
    const tokenContainer = dom.player?.addPlayerTokenContainer;
    const tokenInput = dom.player?.addPlayerTokenInput;
    const errorMessageElement = dom.player?.playerTagErrorMessage;

    if (playerTagInput) {
        playerTagInput.disabled = false;
        playerTagInput.classList.remove('input-error');
    }
    if (loadButton) {
        loadButton.style.display = 'block';
        loadButton.textContent = translate('actions.load');
    }
    if (verifyButton) {
        verifyButton.style.display = 'none';
        verifyButton.disabled = false;
        verifyButton.textContent = translate('actions.verify');
    }
    if (tokenContainer) tokenContainer.style.display = 'none';
    if (tokenInput) {
        tokenInput.value = '';
        tokenInput.classList.remove('input-error');
    }
    if (errorMessageElement) {
        errorMessageElement.textContent = '';
        errorMessageElement.classList.remove('show');
    }
    isForcedVerification = false;
}

/**
 * Renders and displays the Add Player modal with current tag, error state, or verification prompts.
 * @param {boolean} isVisible - True to open modal, false to close.
 * @param {string} [currentTag] - Pre-filled player tag value.
 * @param {string} [message] - Status or error message string.
 * @param {boolean} [isError=false] - True if message represents an error.
 * @param {string} [errorType=null] - Specific API error type code.
 */
export function renderPlayerModal(isVisible, currentTag, message, isError, errorType = null) {
    const modal = dom.player?.addPlayerModal;
    const playerTagInput = dom.player?.playerTagInputModal;
    const errorMessageElement = dom.player?.playerTagErrorMessage;
    const loadButton = dom.player?.loadPlayerModalButton;
    const verifyButton = dom.player?.verifyPlayerModalButton;
    const tokenContainer = dom.player?.addPlayerTokenContainer;

    if (!modal || !playerTagInput || !errorMessageElement || !loadButton) {
        console.error('Modal DOM elements not found for rendering.');
        return;
    }

    if (isVisible) {
        openModal(modal);
        playerTagInput.focus();
    } else {
        if (modal.classList.contains('show') || modal.open) {
            closeModalAnimated(modal);
        } else {
            modal.classList.remove('show');
            if (typeof modal.close === 'function' && modal.open) {
                try { modal.close(); } catch (err) {}
            }
        }
        resetModalState();
    }

    if (currentTag !== undefined && currentTag !== null) {
        playerTagInput.value = currentTag;
    }

    if (!isError) {
        if (errorMessageElement) {
            errorMessageElement.textContent = '';
            errorMessageElement.classList.remove('show');
        }
        if (playerTagInput) {
            playerTagInput.classList.remove('input-error');
        }
        const tokenInput = dom.player?.addPlayerTokenInput;
        if (tokenInput) {
            tokenInput.classList.remove('input-error');
        }
    }

    // Only run local validation if we don't already have a server error to display
    if (!isError && (currentTag || playerTagInput.value.length > 0)) {
        validatePlayerTagInput(playerTagInput, errorMessageElement);
    }

    updateLoadButtonState(playerTagInput, loadButton);

    if (isError) {
        let displayMessage = message;

        // Special handling for protected tags
        if (errorType === 'apiErrors.protectedTag' || errorType === 'apiErrors.invalidToken') {
            playerTagInput.disabled = true;
            loadButton.style.display = 'none';
            if (verifyButton) verifyButton.style.display = 'block';
            if (tokenContainer) tokenContainer.style.display = 'block';

            if (isForcedVerification) {
                displayMessage = `${message}\n\n${translate('player.protectedTagNote')}`;
            }

            const sanitizedMsg = sanitizeHTML(displayMessage.replace(/\n/g, '<br>'));
            errorMessageElement.innerHTML = sanitizedMsg;
            errorMessageElement.classList.add('show');
            playerTagInput.classList.add('input-error');

            // Visual Feedback: Shake the modal content or input
            playerTagInput.classList.remove('shake');
            void playerTagInput.offsetWidth;
            playerTagInput.classList.add('shake');

            // Don't auto-clear the error if it's a protection warning,
            // the user needs time to see it and provide a token.
            if (errorTimeout) clearTimeout(errorTimeout);
            return;
        }

        const sanitizedMsg = sanitizeHTML(displayMessage.replace(/\n/g, '<br>'));
        errorMessageElement.innerHTML = sanitizedMsg;
        errorMessageElement.classList.add('show');
        playerTagInput.classList.add('input-error');

        // Visual Feedback: Shake
        playerTagInput.classList.remove('shake');
        void playerTagInput.offsetWidth;
        playerTagInput.classList.add('shake');

        if (errorTimeout) {
            clearTimeout(errorTimeout);
        }

        errorTimeout = setTimeout(() => {
            if (modal.classList.contains('show')) {
                errorMessageElement.classList.remove('show');
                playerTagInput.classList.remove('input-error');
            }
        }, 5000);
    }
}
