import { translate } from '../../i18n/translator.js';

import { removePlayerTag, saveState } from '../../core/localStorageManager.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';

import { openPrivacyModal, openTermsOfUseModal } from '../appSettings/settingsModals.js';
import { navigateToTab } from '../layout/tabs.js';
import {
    getForcedVerification,
    renderPlayerModal,
    resetModalState,
    setForcedVerification,
    updateLoadButtonState
} from './playerModalDisplay.js';
import { dom } from '../../dom/domElements.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';
import { showConfirm } from '../../ui/noticeModal.js';

let isPlayerModalInitialized = false;

async function checkAndPromptCloudSync() {
    if (state.uiSettings?.cloudSync === false) {
        const shouldEnable = await showConfirm(
            translate('alerts.enableCloudSyncPrompt'),
            'status.info',
            'actions.enable',
            'actions.cancel'
        );
        if (shouldEnable) {
            handleStateUpdate(() => {
                state.uiSettings.cloudSync = true;
            });
            saveState(state, true);
            const { triggerCloudSave } = await import('../../utils/cloudSaveHandler.js');
            triggerCloudSave();
        }
    }
}

/**
 * Initializes Add Player modal event listeners, form inputs, and verification bindings.
 */
export function initializePlayerModal() {
    if (isPlayerModalInitialized) return;
    isPlayerModalInitialized = true;

    const modal = dom.player?.addPlayerModal;
    const cancelButton = dom.player?.cancelAddPlayerButton;
    const loadButton = dom.player?.loadPlayerModalButton;
    const verifyButton = dom.player?.verifyPlayerModalButton;
    const guidedSetupButton = dom.player?.guidedSetupButton;
    const playerTagInput = dom.player?.playerTagInputModal;
    const tokenInput = dom.player?.addPlayerTokenInput;
    const errorMessageElement = dom.player?.playerTagErrorMessage;
    const closeBtn = dom.player?.closeAddPlayerModalBtn;

    if (modal && cancelButton && loadButton && playerTagInput) {
        updateLoadButtonState(playerTagInput, loadButton);

        const closeHandler = () => {
            if (getForcedVerification()) {
                const tag = playerTagInput.value.trim();
                if (state.savedPlayerTags.filter(t => t !== 'DEFAULT0').length > 1) {
                    removePlayerTag(tag);
                    window.location.reload();
                } else {
                    setForcedVerification(false);
                    renderPlayerModal(false, '', '', false);
                }
            } else {
                renderPlayerModal(false, '', '', false);
            }
        };

        cancelButton.addEventListener('click', closeHandler);
        closeBtn?.addEventListener('click', closeHandler);

        guidedSetupButton?.addEventListener('click', () => {
            renderPlayerModal(false, '', '', false);
            import('../welcome/welcomeModal.js').then(({ showWelcomeModal }) => {
                showWelcomeModal(true, { startPage: 2, entrySource: 'playerModal' });
            });
        });

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
                        navigateToTab('home', { resetScroll: true });
                        await checkAndPromptCloudSync();
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
            const token = tokenInput ? tokenInput.value.trim() : '';

            if (!token) {
                if (errorMessageElement) {
                    errorMessageElement.textContent = translate('errors.tokenRequired');
                    errorMessageElement.classList.add('show');
                }

                // Visual Feedback: Shake
                if (tokenInput) {
                    tokenInput.classList.remove('shake');
                    void tokenInput.offsetWidth; // Force reflow
                    tokenInput.classList.add('shake');
                }
                return;
            }

            const originalText = verifyButton.textContent;
            try {
                verifyButton.disabled = true;
                verifyButton.textContent = translate('actions.processing');

                // Directly attempt to load with the token. The server will verify it.
                const loadResult = await loadAndProcessPlayerData(tag, { verifyToken: token });

                if (loadResult.success) {
                    setForcedVerification(false); // Reset before closing
                    renderPlayerModal(false, '', '', false);
                    navigateToTab('home', { resetScroll: true });
                    await checkAndPromptCloudSync();
                } else {

                    if (errorMessageElement) {
                        errorMessageElement.textContent = loadResult.message;
                        errorMessageElement.classList.add('show');
                    }
                    if (tokenInput) {
                        tokenInput.classList.add('input-error');
                        tokenInput.classList.remove('shake');
                        void tokenInput.offsetWidth; // Force reflow
                        tokenInput.classList.add('shake');
                    }
                }
            } catch (err) {
                if (errorMessageElement) {
                    errorMessageElement.textContent = translate('errors.verificationFailed');
                    errorMessageElement.classList.add('show');
                }
                if (tokenInput) {
                    tokenInput.classList.add('input-error');
                    tokenInput.classList.remove('shake');
                    void tokenInput.offsetWidth; // Force reflow
                    tokenInput.classList.add('shake');
                }
            } finally {
                verifyButton.disabled = false;
                verifyButton.textContent = originalText;
            }
        });

        playerTagInput?.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
            updateLoadButtonState(playerTagInput, loadButton);
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

        playerTagInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (loadButton && loadButton.style.display !== 'none') {
                    loadButton.click();
                } else if (verifyButton && verifyButton.style.display !== 'none') {
                    verifyButton.click();
                }
            }
        });

        playerTagInput?.addEventListener('input', () => {
            validatePlayerTagInput(playerTagInput, errorMessageElement);
            updateLoadButtonState(playerTagInput, loadButton);
        });
    }

    if (modal) {
        modal.addEventListener('click', (event) => {
            const termsLink = event.target.closest('#add-player-terms-link');
            const privacyLink = event.target.closest('#add-player-privacy-link');

            if (termsLink) {
                event.preventDefault();
                const termsModal = document.getElementById('terms-modal');
                if (termsModal) termsModal.classList.add('modal-top');
                openTermsOfUseModal();
                return;
            }

            if (privacyLink) {
                event.preventDefault();
                const privacyModal = document.getElementById('privacy-modal');
                if (privacyModal) privacyModal.classList.add('modal-top');
                openPrivacyModal();
                return;
            }

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
}

/**
 * Opens the Add Player modal with optional pre-filled tag and forced verification mode.
 * @param {string} [tag=''] - Pre-filled player tag.
 * @param {boolean} [forced=false] - True if API token verification is required.
 */
export function showAddPlayerModal(tag = '', forced = false) {
    setForcedVerification(forced);
    if (tag) {
        // Force verification mode for a specific tag
        renderPlayerModal(true, tag, translate('apiErrors.protectedTag'), true, 'apiErrors.protectedTag');
    } else {
        // Normal add mode
        resetModalState();
        renderPlayerModal(true, '', '', false);
    }
}
