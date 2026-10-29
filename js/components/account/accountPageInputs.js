/**
 * Interaction bindings for Account & Security Page operations.
 * Tier 4: Interaction Engine.
 */

import { translate } from '../../i18n/translator.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';
import { showToast } from '../../ui/toast.js';
import {
    getAuthenticatedUser,
    logout,
    updateAvatar
} from '../../services/authClientService.js';
import {
    addPasskey,
    deletePasskey,
    fetchPasskeys,
    getSuggestedPasskeyName
} from '../../services/authPasskeyClientService.js';
import { saveUserData } from '../../services/apiService.js';
import { initializeState, state } from '../../core/state.js';
import { saveState, setResettingState } from '../../core/localStorageManager.js';
import { openAuthModal, resolveErrorMessage } from '../auth/authModalInputs.js';
import { logger } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { syncPlayerTagToUrl } from '../../core/playerUrlRouter.js';
import { getActiveUserId } from '../../core/storageKeys.js';
import { isValidUUID } from '../../utils/uuidGenerator.js';
import { importUserData } from '../../services/cloudSaveService.js';
import { enhanceClipboardInput, triggerAutoPaste } from '../common/clipboardInputController.js';
import {
    hasRealPlayerProfile,
    highlightActiveAvatarInTray,
    renderPasskeysInlineList,
    toggleAvatarTray
} from './accountPageDisplay.js';
import { renderPasswordSection } from './accountPagePasswordDisplay.js';
import {
    renderAccountGuestPairingCard,
    setGuestPairingActiveTab,
    toggleGuestPairingDrawer
} from './accountPageSessionsDisplay.js';
import { initAccountErasure } from './accountPageErasure.js';
import { initAccountPasswordModule } from './accountPagePassword.js';
import { initAccountSessionsModule } from './accountPageSessions.js';

/** @type {Array<{ credentialID: string, deviceName: string, createdAt: number }>} */
let cachedPasskeys = [];
let isPasskeySubmitting = false;
let isAccountInputsInitialized = false;

/**
 * Handles signing out the active user session with user confirmation.
 */
async function handleSignOut() {
    const confirmed = await showConfirm(translate('auth.signOutConfirm'));
    if (confirmed) {
        setResettingState(true);
        syncPlayerTagToUrl(null);
        logout();
        if (typeof window !== 'undefined' && window.location) {
            if (window.location.hash || window.location.search) {
                history.replaceState(null, '', window.location.pathname);
            }
            window.location.href = window.location.origin + window.location.pathname;
        }
    }
}

/**
 * Serializes application state and downloads an offline JSON backup archive.
 */
function handleExportBackup() {
    const user = getAuthenticatedUser();
    const currentUserId = localStorage.getItem('clashCalc_userId') || localStorage.getItem('oreCalc_userId') || 'account';
    const dataToExport = {
        ...state,
        ...(user ? { account: { username: user.username, exportedAt: new Date().toISOString() } } : {}),
        userId: currentUserId
    };
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = user
        ? `ClashCalc-Backup_${user.username}_${dateStr}.json`
        : `ClashCalc-Data_${currentUserId}.json`;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

/**
 * Validates, confirms, and restores application state from a JSON backup file.
 *
 * @param {File} file - Selected JSON backup file.
 */
async function handleRestoreBackupFile(file) {
    if (!file) return;

    try {
        const text = await file.text();
        const importedData = safeJsonParse(text, null);

        const hasValidStructure = importedData && typeof importedData === 'object' &&
            (Array.isArray(importedData.savedPlayerTags) || importedData.allPlayersData || importedData.heroes);

        if (!hasValidStructure) {
            await showAlert(translate('alerts.restoreBackupInvalid'));
            return;
        }

        const confirmed = await showConfirm(translate('confirms.restoreBackup'));
        if (!confirmed) return;

        initializeState(importedData);
        saveState(state, true);

        const currentUserId = localStorage.getItem('clashCalc_userId') || localStorage.getItem('oreCalc_userId');
        if (currentUserId) {
            await saveUserData(currentUserId, state);
        }

        await showAlert(translate('alerts.restoreBackupSuccess'));
        if (typeof window !== 'undefined' && window.location) {
            window.location.href = window.location.origin + window.location.pathname;
        }
    } catch (err) {
        logger.error('[Account] Failed to restore backup:', err);
        await showAlert(translate('alerts.restoreBackupInvalid'));
    }
}

/**
 * Loads registered passkey authenticators from server and updates the inline view.
 */
async function refreshInlinePasskeys() {
    try {
        const passkeys = await fetchPasskeys();
        cachedPasskeys = Array.isArray(passkeys) ? passkeys : [];
        renderPasskeysInlineList(cachedPasskeys);
    } catch {
        cachedPasskeys = [];
        renderPasskeysInlineList([]);
    }

    const user = getAuthenticatedUser();
    renderPasswordSection(user?.hasPassword !== false, cachedPasskeys.length);

    const nameInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-add-passkey-name'));
    if (nameInput) {
        const suggested = getSuggestedPasskeyName();
        if (suggested) {
            nameInput.placeholder = suggested;
        }
    }
}

/**
 * Handles adding an additional passkey credential directly from the in-page form.
 */
async function handleAddPasskeySubmit() {
    if (isPasskeySubmitting) return;

    const input = /** @type {HTMLInputElement | null} */ (document.getElementById('account-add-passkey-name'));
    const manualName = input?.value?.trim() || '';

    if (manualName) {
        const isDuplicate = cachedPasskeys.some(
            (pk) => (pk.deviceName || '').trim().toLowerCase() === manualName.toLowerCase()
        );
        if (isDuplicate) {
            showToast(translate('apiErrors.duplicateDeviceName'), 'error');
            return;
        }
    }

    isPasskeySubmitting = true;

    try {
        await addPasskey(manualName, cachedPasskeys);
        if (input) input.value = '';
        await refreshInlinePasskeys();
        showToast(translate('auth.passkeyAddedSuccess'), 'success');
    } catch (err) {
        if (err.message !== 'passkeyCancelled') {
            showToast(resolveErrorMessage(err), 'error');
        }
    } finally {
        isPasskeySubmitting = false;
    }
}

/**
 * Handles deleting a registered passkey credential from the inline list.
 *
 * @param {string} credentialId - Target credential identifier to purge.
 */
async function handleDeletePasskey(credentialId) {
    if (!credentialId || isPasskeySubmitting) return;

    const confirmed = await showConfirm(
        translate('auth.confirmDeletePasskey'),
        'actions.confirm',
        'actions.delete',
        'actions.cancel'
    );
    if (!confirmed) return;

    isPasskeySubmitting = true;

    try {
        await deletePasskey(credentialId);
        await refreshInlinePasskeys();
        showToast(translate('auth.passkeyRemovedSuccess'), 'success');
    } catch (err) {
        if (err?.message === 'passkeyNotFound' || err?.message?.includes('passkeyNotFound')) {
            await refreshInlinePasskeys();
        } else {
            showToast(resolveErrorMessage(err), 'error');
        }
    } finally {
        isPasskeySubmitting = false;
    }
}

/**
 * Selects and persists a new avatar image for the authenticated user.
 *
 * @param {string} avatar - Desired avatar identifier ('archer', 'builder', etc.).
 */
async function handleSelectAvatar(avatar) {
    if (!avatar) return;

    highlightActiveAvatarInTray(avatar);
    try {
        await updateAvatar(avatar);
    } catch (err) {
        logger.error('[Account] Failed to update avatar:', err);
    }
}

/**
 * Handles keyboard navigation within the avatar options grid.
 *
 * @param {KeyboardEvent} e - Keyboard interaction event.
 */
function handleAvatarGridKeyDown(e) {
    const activeBtn = document.activeElement?.closest('.avatar-option-btn');
    if (!activeBtn) return;

    const tray = document.getElementById('account-avatar-tray');
    if (!tray) return;

    const btns = Array.from(tray.querySelectorAll('.avatar-option-btn'));
    const index = btns.indexOf(/** @type {HTMLButtonElement} */ (activeBtn));
    if (index === -1) return;

    let targetIndex = -1;
    if (e.key === 'ArrowRight') targetIndex = (index + 1) % btns.length;
    else if (e.key === 'ArrowLeft') targetIndex = (index - 1 + btns.length) % btns.length;
    else if (e.key === 'ArrowDown') targetIndex = (index + 4) % btns.length;
    else if (e.key === 'ArrowUp') targetIndex = (index - 4 + btns.length) % btns.length;
    else if (e.key === 'Escape') {
        toggleAvatarTray(false);
        document.getElementById('account-profile-avatar-btn')?.focus();
        return;
    }

    if (targetIndex !== -1) {
        e.preventDefault();
        btns[targetIndex].focus();
    }
}

/**
 * Initializes all event listeners for the Account & Security page.
 */
export function initAccountPageInputs() {
    const guestSignInBtn = document.getElementById('account-guest-signin-btn');
    guestSignInBtn?.addEventListener('click', () => openAuthModal('signin'));

    const guestCreateBtn = document.getElementById('account-guest-create-btn');
    guestCreateBtn?.addEventListener('click', () => openAuthModal('register'));

    // Profile & Avatar Tray
    const toggleAvatar = () => {
        const user = getAuthenticatedUser();
        const isOpen = toggleAvatarTray();
        if (isOpen && user?.avatar) {
            highlightActiveAvatarInTray(user.avatar);
            const activeBtn = document.querySelector(`.avatar-option-btn[data-avatar="${user.avatar}"]`);
            /** @type {HTMLElement | null} */ (activeBtn)?.focus();
        }
    };

    const avatarBtn = document.getElementById('account-profile-avatar-btn');
    avatarBtn?.addEventListener('click', toggleAvatar);

    const avatarDoneBtn = document.getElementById('account-btn-avatar-done');
    avatarDoneBtn?.addEventListener('click', () => {
        toggleAvatarTray(false);
        document.getElementById('account-profile-avatar-btn')?.focus();
    });

    const avatarTray = document.getElementById('account-avatar-tray');
    avatarTray?.addEventListener('keydown', handleAvatarGridKeyDown);
    avatarTray?.addEventListener('click', (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('.avatar-option-btn');
        if (btn) {
            const avatar = btn.getAttribute('data-avatar');
            if (avatar) handleSelectAvatar(avatar);
        }
    });

    const signOutBtn = document.getElementById('account-btn-signout');
    signOutBtn?.addEventListener('click', handleSignOut);

    // In-Page Passkeys Form & List
    const addPasskeyBtn = document.getElementById('account-btn-add-passkey');
    addPasskeyBtn?.addEventListener('click', handleAddPasskeySubmit);

    const addPasskeyInput = document.getElementById('account-add-passkey-name');
    addPasskeyInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddPasskeySubmit();
        }
    });

    const passkeysListEl = document.getElementById('account-passkeys-items-list');
    passkeysListEl?.addEventListener('click', (e) => {
        const delBtn = /** @type {HTMLElement} */ (e.target).closest('.account-passkey-item__delete-btn');
        if (delBtn) {
            const credentialId = delBtn.getAttribute('data-credential-id') || '';
            handleDeletePasskey(credentialId);
        }
    });

    const exportBackupBtn = document.getElementById('account-btn-export-backup');
    exportBackupBtn?.addEventListener('click', handleExportBackup);

    const guestExportBackupBtn = document.getElementById('account-guest-export-backup');
    guestExportBackupBtn?.addEventListener('click', handleExportBackup);

    const restoreFileInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-restore-file-input'));
    const restoreBackupBtn = document.getElementById('account-btn-restore-backup');
    restoreBackupBtn?.addEventListener('click', () => {
        restoreFileInput?.click();
    });

    restoreFileInput?.addEventListener('change', (e) => {
        const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
        if (file) {
            handleRestoreBackupFile(file).finally(() => {
                if (restoreFileInput) restoreFileInput.value = '';
            });
        }
    });

    const guestRestoreFileInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-guest-restore-file-input'));
    const guestRestoreBackupBtn = document.getElementById('account-guest-restore-backup');
    guestRestoreBackupBtn?.addEventListener('click', () => {
        guestRestoreFileInput?.click();
    });

    guestRestoreFileInput?.addEventListener('change', (e) => {
        const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
        if (file) {
            handleRestoreBackupFile(file).finally(() => {
                if (guestRestoreFileInput) guestRestoreFileInput.value = '';
            });
        }
    });

/**
 * Wires up interactive controls for the guest mobile device pairing drawer.
 */
function initGuestDeviceSync() {
    const toggleBtn = document.getElementById('account-guest-btn-toggle-pairing');
    const tabQr = document.getElementById('account-guest-tab-qr');
    const tabInput = document.getElementById('account-guest-tab-input');
    const gotoInputBtn = document.getElementById('account-guest-btn-goto-input');
    const cancelInputBtn = document.getElementById('account-guest-btn-cancel-input');
    const copyBtn = document.getElementById('account-guest-copy-btn');
    const userIdDisplay = document.getElementById('account-guest-user-id');
    const syncInput = /** @type {HTMLInputElement | null} */ (document.getElementById('account-guest-sync-input'));
    const statusMsg = document.getElementById('account-guest-sync-status');
    const confirmBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('account-guest-btn-confirm-sync'));

    if (syncInput) {
        enhanceClipboardInput(syncInput);
    }

    toggleBtn?.addEventListener('click', () => {
        toggleGuestPairingDrawer();
    });

    tabQr?.addEventListener('click', () => {
        setGuestPairingActiveTab('qr');
    });

    tabInput?.addEventListener('click', () => {
        setGuestPairingActiveTab('input');
        if (syncInput) void triggerAutoPaste(syncInput);
    });

    gotoInputBtn?.addEventListener('click', () => {
        setGuestPairingActiveTab('input');
        if (syncInput) void triggerAutoPaste(syncInput);
    });

    cancelInputBtn?.addEventListener('click', () => {
        setGuestPairingActiveTab('qr');
    });

    const handleCopy = async () => {
        const userId = getActiveUserId(true);
        if (!userId) return;
        try {
            await navigator.clipboard.writeText(userId);
            showToast(translate('alerts.copySuccess') || 'User ID copied!', 'info');
        } catch {
            showToast(translate('alerts.copiedFailed') || 'Failed to copy User ID.', 'error');
        }
    };

    copyBtn?.addEventListener('click', handleCopy);
    userIdDisplay?.addEventListener('click', handleCopy);

    const validateSyncInput = () => {
        if (!syncInput) return;
        let val = syncInput.value.trim();

        let extractedFromUrl = false;
        if (val.includes('userId=')) {
            try {
                const url = new URL(val);
                const extractedId = url.searchParams.get('userId');
                if (extractedId) {
                    val = extractedId;
                    syncInput.value = val;
                    extractedFromUrl = true;
                }
            } catch {
                const match = val.match(/userId=([a-f0-9-]+)/i);
                if (match && match[1]) {
                    val = match[1];
                    syncInput.value = val;
                    extractedFromUrl = true;
                }
            }
        }

        const currentUserId = getActiveUserId();

        if (!val) {
            if (statusMsg) {
                statusMsg.textContent = '';
                statusMsg.className = 'account-input-status-pill is-hidden';
            }
            syncInput.classList.remove('input-error');
            if (confirmBtn) confirmBtn.disabled = true;
        } else if (isValidUUID(val)) {
            if (val === currentUserId) {
                if (statusMsg) {
                    statusMsg.textContent = translate('alerts.sameUserId');
                    statusMsg.className = 'account-input-status-pill show error';
                }
                syncInput.classList.add('input-error');
                if (confirmBtn) confirmBtn.disabled = true;
            } else {
                if (statusMsg) {
                    statusMsg.textContent = extractedFromUrl ? translate('alerts.uuidDetected') : translate('alerts.validUserId');
                    statusMsg.className = 'account-input-status-pill show success';
                }
                syncInput.classList.remove('input-error');
                if (confirmBtn) confirmBtn.disabled = false;
            }
        } else {
            if (statusMsg) {
                statusMsg.textContent = translate('alerts.invalidUserId');
                statusMsg.className = 'account-input-status-pill show error';
            }
            syncInput.classList.add('input-error');
            if (confirmBtn) confirmBtn.disabled = true;
        }
    };

    syncInput?.addEventListener('input', validateSyncInput);

    confirmBtn?.addEventListener('click', async () => {
        if (!syncInput) return;
        const val = syncInput.value.trim();
        if (!isValidUUID(val)) return;

        const originalText = confirmBtn.textContent;
        try {
            confirmBtn.disabled = true;
            confirmBtn.textContent = translate('actions.processing');
            await importUserData(val);
        } catch (err) {
            logger.error('[GuestSync] Import failed:', err);
            showToast(translate('apiErrors.default'), 'error');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
        }
    });

    if (!isAccountInputsInitialized) {
        isAccountInputsInitialized = true;
        document.addEventListener('app:playerDropdownSync', () => {
            if (!getAuthenticatedUser()) {
                const hasRealPlayer = hasRealPlayerProfile();
                renderAccountGuestPairingCard(hasRealPlayer);
            }
        });
    }
}

    initAccountErasure();
    initGuestDeviceSync();
    initAccountPasswordModule();
    initAccountSessionsModule();
}
