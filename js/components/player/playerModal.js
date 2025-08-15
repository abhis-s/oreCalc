import { dom } from '../../dom/domElements.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';

let errorTimeout;

function updateLoadButtonState(playerTagInput, loadButton) {
    loadButton.disabled = playerTagInput.value.trim().length === 0;
}

export function renderPlayerModal(isVisible, currentTag, message, isError) {
    const modal = dom.player.addPlayerModal;
    const playerTagInput = dom.player.playerTagInputModal;
    const errorMessageElement = dom.player.playerTagErrorMessage;
    const loadButton = dom.player.loadPlayerModalButton;

    if (!modal || !playerTagInput || !errorMessageElement || !loadButton) {
        console.error('Modal DOM elements not found for rendering.');
        return;
    }

    if (isVisible) {
        modal.classList.add('show');
        playerTagInput.focus();
    } else {
        modal.classList.remove('show');
    }

    if (!isError) {
        playerTagInput.value = currentTag;
    }

    if (currentTag || isError) {
        validatePlayerTagInput(playerTagInput, errorMessageElement);
    }

    updateLoadButtonState(playerTagInput, loadButton);

    if (isError) {
        errorMessageElement.textContent = message;
        errorMessageElement.classList.add('show');
        playerTagInput.classList.add('input-error');

        if (errorTimeout) {
            clearTimeout(errorTimeout);
        }

        errorTimeout = setTimeout(() => {
            renderPlayerModal(isVisible, playerTagInput.value, '', false);
        }, 5000);
    }
}

export function initializePlayerModal() {
    const modal = dom.player.addPlayerModal;
    const cancelButton = dom.player.cancelAddPlayerButton;
    const loadButton = dom.player.loadPlayerModalButton;
    const playerTagInput = dom.player.playerTagInputModal;
    const errorMessageElement = dom.player.playerTagErrorMessage;

    if (modal && cancelButton && loadButton && playerTagInput) {
        updateLoadButtonState(playerTagInput, loadButton);

        cancelButton.addEventListener('click', () => {
            renderPlayerModal(false, '', '', false);
        });

        loadButton.addEventListener('click', async () => {
            const { cleanedTag, isValid } = validatePlayerTagInput(playerTagInput, errorMessageElement);
            
            if (isValid && cleanedTag) {
                const result = await loadAndProcessPlayerData(cleanedTag);
                if (result.success) {
                    renderPlayerModal(false, '', '', false);
                } else {
                    renderPlayerModal(true, cleanedTag, result.message, true);
                }
            } else if (!cleanedTag) {
                renderPlayerModal(true, '', 'Please enter a player tag.', true);
            }
        });

        playerTagInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                loadButton.click();
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

export function showAddPlayerModal() {
    renderPlayerModal(true, '', '', false);
}
