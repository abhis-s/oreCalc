import { translate } from '../../i18n/translator.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';
import { dom } from '../../dom/domElements.js';
import { erasePlayerTagFromAllUsers, fetchPlayerData } from '../../services/apiService.js';
import { showAlert } from '../../ui/noticeModal.js';

/**
 * Initializes player deletion and exclusion from service modal.
 */
export function initializeSettingsDataManagement() {
    const {
        deleteModal,
        deleteTokenContainer,
        deleteTagInput,
        deleteTokenInput,
        deleteTagError,
        deleteTokenError,
        deleteModalActionsValidate,
        deleteModalActionsVerify,
        cancelDeletePlayerBtn,
        validateDeletePlayerBtn,
        cancelDeleteVerifyBtn,
        verifyDeletePlayerBtn
    } = dom.appSettings || {};

    if (deleteModal) {
        const closeDeleteModal = () => {
            closeModalAnimated(deleteModal);
            if (deleteTagInput) deleteTagInput.value = '';
            if (deleteTokenInput) deleteTokenInput.value = '';
            if (deleteTagError) deleteTagError.textContent = '';
            if (deleteTokenError) deleteTokenError.textContent = '';
            if (deleteTagInput) deleteTagInput.disabled = false;
            if (deleteTokenContainer) deleteTokenContainer.classList.add('hidden');
            if (deleteModalActionsValidate) deleteModalActionsValidate.classList.remove('hidden');
            if (deleteModalActionsVerify) deleteModalActionsVerify.classList.add('hidden');
            if (validateDeletePlayerBtn) {
                validateDeletePlayerBtn.disabled = false;
                validateDeletePlayerBtn.textContent = translate('actions.validate');
            }
            if (verifyDeletePlayerBtn) {
                verifyDeletePlayerBtn.disabled = false;
                verifyDeletePlayerBtn.textContent = translate('actions.verify');
            }
        };

        cancelDeletePlayerBtn?.addEventListener('click', closeDeleteModal);
        cancelDeleteVerifyBtn?.addEventListener('click', closeDeleteModal);

        validateDeletePlayerBtn?.addEventListener('click', async () => {
            const tag = deleteTagInput ? deleteTagInput.value.trim() : '';
            if (!tag) {
                if (deleteTagError) deleteTagError.textContent = translate('errors.playerTagRequired');

                if (deleteTagInput) {
                    deleteTagInput.classList.remove('shake');
                    void deleteTagInput.offsetWidth;
                    deleteTagInput.classList.add('shake');
                }
                return;
            }
            try {
                validateDeletePlayerBtn.disabled = true;
                const playerData = await fetchPlayerData(tag);

                if (playerData && playerData.tag && deleteTagInput) {
                    const canonicalTag = normalizePlayerTag(playerData.tag);
                    deleteTagInput.value = canonicalTag.toUpperCase();
                }

                if (deleteTagError) deleteTagError.textContent = '';
                if (deleteTagInput) deleteTagInput.disabled = true;
                if (deleteTokenContainer) deleteTokenContainer.classList.remove('hidden');
                if (deleteModalActionsValidate) deleteModalActionsValidate.classList.add('hidden');
                if (deleteModalActionsVerify) deleteModalActionsVerify.classList.remove('hidden');
            } catch (err) {
                if (err.message === 'apiErrors.protectedTag') {
                    if (deleteTagError) deleteTagError.textContent = '';
                    if (deleteTagInput) deleteTagInput.disabled = true;
                    if (deleteTokenContainer) deleteTokenContainer.classList.remove('hidden');
                    if (deleteModalActionsValidate) deleteModalActionsValidate.classList.add('hidden');
                    if (deleteModalActionsVerify) deleteModalActionsVerify.classList.remove('hidden');
                } else {
                    if (deleteTagError) deleteTagError.textContent = translate(err.message);

                    if (deleteTagInput) {
                        deleteTagInput.classList.remove('shake');
                        void deleteTagInput.offsetWidth;
                        deleteTagInput.classList.add('shake');
                    }
                }
            } finally {
                validateDeletePlayerBtn.disabled = false;
            }
        });

        verifyDeletePlayerBtn?.addEventListener('click', async () => {
            const tag = deleteTagInput ? deleteTagInput.value.trim() : '';
            const token = deleteTokenInput ? deleteTokenInput.value.trim() : '';
            if (!token) {
                if (deleteTokenError) deleteTokenError.textContent = translate('errors.tokenRequired');

                if (deleteTokenInput) {
                    deleteTokenInput.classList.remove('shake');
                    void deleteTokenInput.offsetWidth;
                    deleteTokenInput.classList.add('shake');
                }
                return;
            }
            try {
                verifyDeletePlayerBtn.disabled = true;

                await erasePlayerTagFromAllUsers(tag, token);

                closeDeleteModal();
                await showAlert(translate('alerts.globalErasureSuccess'), 'status.success');

                if (window.resetApplication) {
                    window.resetApplication();
                } else {
                    localStorage.clear();
                    window.location.reload();
                }
            } catch (err) {
                if (err.message === 'apiErrors.protectedTag' || err.message === 'apiErrors.invalidToken' || err.message === 'apiErrors.403') {
                    if (deleteTokenError) deleteTokenError.textContent = translate('apiErrors.invalidToken');
                } else {
                    if (deleteTokenError) deleteTokenError.textContent = translate(err.message);
                }

                if (deleteTokenInput) {
                    deleteTokenInput.classList.remove('shake');
                    void deleteTokenInput.offsetWidth;
                    deleteTokenInput.classList.add('shake');
                }
            } finally {
                verifyDeletePlayerBtn.disabled = false;
            }
        });

        deleteTagInput?.addEventListener('input', () => {
            const result = validatePlayerTagInput(deleteTagInput, deleteTagError);
            if (result.isValid) {
                deleteTagInput.value = result.cleanedTag ? '#' + result.cleanedTag : '';
            }
        });

        deleteTokenInput?.addEventListener('input', (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            target.value = target.value.replace(/[^a-z0-9]/gi, '');
        });
    }

    if (dom.appSettings?.closeDeletePlayerModalBtn && deleteModal) {
        dom.appSettings.closeDeletePlayerModalBtn.addEventListener('click', () => {
            closeModalAnimated(deleteModal);
        });
    }
}
