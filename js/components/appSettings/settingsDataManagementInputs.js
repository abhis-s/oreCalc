import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { logger } from '../../utils/logger.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';

import { dom } from '../../dom/domElements.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';

/**
 * Initializes data management settings: download, import, data erasure, and account reset.
 */
export function initializeSettingsDataManagement() {
    const {
        resetLocalBtn,
        resetCloudBtn,
        completeDeleteBtn,
        downloadUserDataBtn,
        userIdDisplayLabel,
        openDataErasureBtn,
        dataErasureModal,
        closeDataErasureModalBtn,
        importModal,
        deleteModal,
        deleteTagContainer,
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

    const downloadDataModal = dom.appSettings?.downloadDataModal;
    const closeDownloadDataModalBtn = dom.appSettings?.closeDownloadDataModalBtn;
    const confirmDownloadDataBtn = dom.appSettings?.confirmDownloadDataBtn;
    const cancelDownloadDataBtn = dom.appSettings?.cancelDownloadDataBtn;
    const downloadFilenamePreview = dom.appSettings?.downloadFilenamePreview;

    if (downloadUserDataBtn && downloadDataModal) {
        const closeDownloadModal = () => {
            closeModalAnimated(downloadDataModal);
            if (confirmDownloadDataBtn) {
                confirmDownloadDataBtn.disabled = false;
                confirmDownloadDataBtn.textContent = translate('actions.download');
            }
        };

        downloadUserDataBtn.addEventListener('click', () => {
            const currentUserId = localStorage.getItem('oreCalc_userId') || 'unknown';
            if (downloadFilenamePreview) {
                downloadFilenamePreview.innerHTML = translate('views.settings.download.filenameInfo', { uuid: currentUserId });
            }
            downloadDataModal.classList.add('show');
            if (dom.overlay) dom.overlay.classList.add('show');
        });

        closeDownloadDataModalBtn?.addEventListener('click', closeDownloadModal);
        cancelDownloadDataBtn?.addEventListener('click', closeDownloadModal);

        confirmDownloadDataBtn?.addEventListener('click', () => {
            const originalText = confirmDownloadDataBtn.textContent;
            confirmDownloadDataBtn.disabled = true;
            confirmDownloadDataBtn.textContent = translate('actions.processing');

            const currentUserId = localStorage.getItem('oreCalc_userId') || 'unknown';
            const dataToExport = {
                ...state,
                userId: currentUserId
            };
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute('href', dataStr);
            downloadAnchorNode.setAttribute('download', `OreCalc-Data_${currentUserId}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();

            setTimeout(() => {
                confirmDownloadDataBtn.disabled = false;
                confirmDownloadDataBtn.textContent = originalText;
                closeDownloadModal();
            }, 500);
        });
    }

    if (resetLocalBtn) {
        resetLocalBtn.addEventListener('click', async () => {
            if (dom.appSettings?.dataErasureModal) closeModalAnimated(dom.appSettings.dataErasureModal);
            if (await showConfirm(translate('confirms.resetLocal'), 'status.confirm', 'actions.reset')) {
                if (typeof window.resetApplication === 'function') {
                    window.resetApplication();
                }
            } else {
                if (dom.appSettings?.dataErasureModal) dom.appSettings.dataErasureModal.classList.add('show');
                if (dom.overlay) dom.overlay.classList.add('show');
            }
        });
    }

    if (resetCloudBtn) {
        resetCloudBtn.addEventListener('click', async () => {
            if (dom.appSettings?.dataErasureModal) closeModalAnimated(dom.appSettings.dataErasureModal);
            if (await showConfirm(translate('confirms.resetCloud'), 'status.confirm', 'actions.reset')) {
                const currentUserId = localStorage.getItem('oreCalc_userId');
                if (currentUserId) {
                    try {
                        const { deleteUserData } = await import('../../services/apiService.js');
                        await deleteUserData(currentUserId);
                    } catch (error) {
                        logger.error('Failed to delete cloud data:', error);
                        await showAlert(translate('alerts.deleteCloudFailed', { error: error.message || error }));
                    }
                }
                if (typeof window.resetApplication === 'function') {
                    window.resetApplication();
                }
            } else {
                if (dom.appSettings?.dataErasureModal) dom.appSettings.dataErasureModal.classList.add('show');
                if (dom.overlay) dom.overlay.classList.add('show');
            }
        });
    }

    if (completeDeleteBtn && deleteModal) {
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

        completeDeleteBtn.addEventListener('click', () => {
            if (dom.appSettings?.dataErasureModal) {
                closeModalAnimated(dom.appSettings.dataErasureModal);
            }
            deleteModal.classList.add('show');
            if (dom.overlay) dom.overlay.classList.add('show');
        });

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
                const { fetchPlayerData } = await import('../../services/apiService.js');
                const playerData = await fetchPlayerData(tag);

                if (playerData && playerData.tag && deleteTagInput) {
                    const canonicalTag = playerData.tag.startsWith('#') ? playerData.tag.substring(1) : playerData.tag;
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

                const { erasePlayerTagFromAllUsers } = await import('../../services/apiService.js');
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

    if (userIdDisplayLabel) {
        const currentUserId = localStorage.getItem('oreCalc_userId');
        if (currentUserId) {
            const maskedId = currentUserId.length > 8 ? currentUserId.substring(0, 8) + '...' : currentUserId;
            userIdDisplayLabel.textContent = `${translate('player.userId')}: ${maskedId}`;
            userIdDisplayLabel.dataset.fullId = currentUserId;
        }
    }

    if (openDataErasureBtn && dataErasureModal) {
        openDataErasureBtn.addEventListener('click', () => {
            dataErasureModal.classList.add('show');
            if (dom.overlay) dom.overlay.classList.add('show');
        });
    }

    if (closeDataErasureModalBtn && dataErasureModal) {
        closeDataErasureModalBtn.addEventListener('click', () => {
            closeModalAnimated(dataErasureModal);
        });
    }

    if (dom.appSettings?.closeDataErasureHeaderBtn && dataErasureModal) {
        dom.appSettings.closeDataErasureHeaderBtn.addEventListener('click', () => {
            closeModalAnimated(dataErasureModal);
        });
    }

    if (dom.appSettings?.closeDeletePlayerModalBtn && deleteModal) {
        dom.appSettings.closeDeletePlayerModalBtn.addEventListener('click', () => {
            closeModalAnimated(deleteModal);
        });
    }

    if (dom.appSettings?.closeImportDataModalBtn && importModal) {
        dom.appSettings.closeImportDataModalBtn.addEventListener('click', () => {
            closeModalAnimated(importModal);
        });
    }
}
