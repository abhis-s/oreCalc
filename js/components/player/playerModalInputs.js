import { translate } from '../../i18n/translator.js';

import { saveState } from '../../core/localStorageManager.js';
import { removePlayerTag } from '../../core/playerStorage.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';

import {
    getForcedVerification,
    renderPlayerModal,
    resetModalState,
    setForcedVerification,
    updateLoadButtonState
} from './playerModalDisplay.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';
import { triggerCloudSave } from '../../services/cloudSaveService.js';
import { showConfirm } from '../../ui/noticeModal.js';

let isPlayerModalInitialized = false;

/**
 * Programmatically switches to the Home tab if tab navigation exists in current DOM.
 */
function navigateToHomeTab() {
    if (typeof document === 'undefined') return;
    const homeTabButton = /** @type {HTMLElement | null} */ (
        document.querySelector('.tab-button[data-tab="home"], .nav-button[data-tab="home"]')
    );
    if (homeTabButton) {
        homeTabButton.click();
    }
}

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

    const modal = document.getElementById('add-player-modal');
    const cancelButton = document.getElementById('cancel-add-player-button');
    const loadButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('load-player-modal-btn'));
    const verifyButton = /** @type {HTMLButtonElement | null} */ (document.getElementById('verify-player-modal-btn'));
    const guidedSetupButton = document.getElementById('add-player-guided-setup-btn');
    const playerTagInput = /** @type {HTMLInputElement | null} */ (document.getElementById('player-tag-input-modal'));
    const tokenInput = /** @type {HTMLInputElement | null} */ (document.getElementById('add-player-token-input'));
    const errorMessageElement = document.getElementById('player-tag-error-message');
    const closeBtn = document.getElementById('close-add-player-modal-btn');

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
            const currentTag = playerTagInput.value.trim();
            renderPlayerModal(false, '', '', false);
            import('../guidedSetup/guidedSetupModal.js').then(({ openGuidedSetupModal }) => {
                openGuidedSetupModal({ initialTag: currentTag });
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
                        navigateToHomeTab();
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
                    setForcedVerification(false);
                    renderPlayerModal(false, '', '', false);
                    navigateToHomeTab();
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
            validatePlayerTagInput(playerTagInput, errorMessageElement);
            updateLoadButtonState(playerTagInput, loadButton);
        });

        tokenInput?.addEventListener('input', (e) => {
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
    }

    if (modal) {
        modal.addEventListener('click', (event) => {
            const target = /** @type {HTMLElement | null} */ (event.target);
            const termsLink = target?.closest('#add-player-terms-link');
            const privacyLink = target?.closest('#add-player-privacy-link');

            if (termsLink) {
                event.preventDefault();
                import('../appSettings/settingsLegalModals.js').then(m => m.openTermsOfUseModal());
                return;
            }

            if (privacyLink) {
                event.preventDefault();
                import('../appSettings/settingsLegalModals.js').then(m => m.openPrivacyModal());
                return;
            }

            if (event.target === modal) {
                renderPlayerModal(false, '', '', false);
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('show')) {
                const openModals = Array.from(document.querySelectorAll('.modal.show, dialog.modal[open]'));
                if (openModals.length > 0 && openModals.at(-1) !== modal) return;
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
        renderPlayerModal(true, tag, translate('apiErrors.protectedTag'), true, 'apiErrors.protectedTag');
    } else {
        resetModalState();
        renderPlayerModal(true, '', '', false);
    }
}
