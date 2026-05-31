import { dom } from '../../dom/domElements.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';
import { translate } from '../../i18n/translator.js';
import { removePlayerTag } from '../../core/localStorageManager.js';

let errorTimeout;
let isForcedVerification = false;

function updateLoadButtonState(playerTagInput, loadButton) {
    loadButton.disabled = playerTagInput.value.trim().length === 0;
}

function resetModalState() {
    const playerTagInput = dom.player.playerTagInputModal;
    const loadButton = dom.player.loadPlayerModalButton;
    const verifyButton = dom.player.verifyPlayerModalButton;
    const tokenContainer = dom.player.addPlayerTokenContainer;
    const tokenInput = dom.player.addPlayerTokenInput;
    const errorMessageElement = dom.player.playerTagErrorMessage;

    if (playerTagInput) {
        playerTagInput.disabled = false;
        playerTagInput.classList.remove('input-error');
    }
    if (loadButton) loadButton.style.display = 'block';
    if (verifyButton) verifyButton.style.display = 'none';
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

export function renderPlayerModal(isVisible, currentTag, message, isError, errorType = null) {
    const modal = dom.player.addPlayerModal;
    const playerTagInput = dom.player.playerTagInputModal;
    const errorMessageElement = dom.player.playerTagErrorMessage;
    const loadButton = dom.player.loadPlayerModalButton;
    const verifyButton = dom.player.verifyPlayerModalButton;
    const tokenContainer = dom.player.addPlayerTokenContainer;

    if (!modal || !playerTagInput || !errorMessageElement || !loadButton) {
        console.error('Modal DOM elements not found for rendering.');
        return;
    }

    if (isVisible) {
        modal.classList.add('show');
        playerTagInput.focus();
    } else {
        modal.classList.remove('show');
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
        const tokenInput = dom.player.addPlayerTokenInput;
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
            
            errorMessageElement.innerText = displayMessage; // Use innerText for newlines
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

        errorMessageElement.textContent = displayMessage;
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

export function initializePlayerModal() {
    const modal = dom.player.addPlayerModal;
    const cancelButton = dom.player.cancelAddPlayerButton;
    const loadButton = dom.player.loadPlayerModalButton;
    const verifyButton = dom.player.verifyPlayerModalButton;
    const playerTagInput = dom.player.playerTagInputModal;
    const tokenInput = dom.player.addPlayerTokenInput;
    const errorMessageElement = dom.player.playerTagErrorMessage;
    const closeBtn = dom.player.closeAddPlayerModalBtn;

    if (modal && cancelButton && loadButton && playerTagInput) {
        updateLoadButtonState(playerTagInput, loadButton);

        const closeHandler = () => {
            if (isForcedVerification) {
                const tag = playerTagInput.value.trim();
                removePlayerTag(tag);
                window.location.reload();
            } else {
                renderPlayerModal(false, '', '', false);
            }
        };

        cancelButton.addEventListener('click', closeHandler);
        closeBtn?.addEventListener('click', closeHandler);

        loadButton.addEventListener('click', async () => {
            const { cleanedTag, isValid } = validatePlayerTagInput(playerTagInput, errorMessageElement);
            
            if (isValid && cleanedTag) {
                const originalText = loadButton.textContent;
                try {
                    loadButton.disabled = true;
                    loadButton.textContent = translate('actions.loading');
                    
                    const result = await loadAndProcessPlayerData(cleanedTag);
                    
                    if (result.success) {
                        renderPlayerModal(false, '', '', false);
                    } else {
                        renderPlayerModal(true, cleanedTag, result.message, true, result.errorType);
                    }
                } catch (err) {
                    renderPlayerModal(true, cleanedTag, translate('errors.fetchPlayerFailed', { error: err.message }), true);
                } finally {
                    loadButton.disabled = false;
                    loadButton.textContent = originalText;
                }
            } else if (!cleanedTag) {
                renderPlayerModal(true, '', translate('errors.playerTagRequired'), true);
            }
        });

        verifyButton?.addEventListener('click', async () => {
            const tag = playerTagInput.value.trim();
            const token = tokenInput.value.trim();

            if (!token) {
                errorMessageElement.textContent = translate('errors.tokenRequired');
                errorMessageElement.classList.add('show');
                
                // Visual Feedback: Shake
                tokenInput.classList.remove('shake');
                void tokenInput.offsetWidth; // Force reflow
                tokenInput.classList.add('shake');
                return;
            }

            const originalText = verifyButton.textContent;
            try {
                verifyButton.disabled = true;
                verifyButton.textContent = translate('actions.processing');
                
                // Directly attempt to load with the token. The server will verify it.
                const loadResult = await loadAndProcessPlayerData(tag, { verifyToken: token });
                
                if (loadResult.success) {
                    isForcedVerification = false; // Reset before closing
                    renderPlayerModal(false, '', '', false);
                } else {
                    errorMessageElement.textContent = loadResult.message;
                    errorMessageElement.classList.add('show');
                    tokenInput.classList.add('input-error');
                    
                    // Visual Feedback: Shake
                    tokenInput.classList.remove('shake');
                    void tokenInput.offsetWidth; // Force reflow
                    tokenInput.classList.add('shake');
                }
            } catch (err) {
                errorMessageElement.textContent = translate('errors.verificationFailed');
                errorMessageElement.classList.add('show');
                tokenInput.classList.add('input-error');
                
                // Visual Feedback: Shake
                tokenInput.classList.remove('shake');
                void tokenInput.offsetWidth; // Force reflow
                tokenInput.classList.add('shake');
            } finally {
                verifyButton.disabled = false;
                verifyButton.textContent = originalText;
            }
        });

        tokenInput?.addEventListener('input', (e) => {
            // Only allow alphanumeric characters
            e.target.value = e.target.value.replace(/[^a-z0-9]/gi, '');
            tokenInput.classList.remove('input-error');
            if (errorMessageElement) {
                errorMessageElement.textContent = '';
                errorMessageElement.classList.remove('show');
            }
        });

        playerTagInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (loadButton.style.display !== 'none') {
                    loadButton.click();
                } else if (verifyButton.style.display !== 'none') {
                    verifyButton.click();
                }
            }
        });

        playerTagInput.addEventListener('input', () => {
            validatePlayerTagInput(playerTagInput, errorMessageElement);
            updateLoadButtonState(playerTagInput, loadButton);
        });
    }

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            renderPlayerModal(false, '', '', false);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal.classList.contains('show')) {
            renderPlayerModal(false, '', '', false);
        }
    });

    renderPlayerModal(false, '', '', false);
}

export function showAddPlayerModal(tag = '', forced = false) {
    isForcedVerification = forced;
    if (tag) {
        // Force verification mode for a specific tag
        renderPlayerModal(true, tag, translate('apiErrors.protectedTag'), true, 'apiErrors.protectedTag');
    } else {
        // Normal add mode
        resetModalState();
        renderPlayerModal(true, '', '', false);
    }
}
