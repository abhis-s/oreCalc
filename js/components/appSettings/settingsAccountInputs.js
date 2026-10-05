/**
 * Interaction bindings for Account Card in Settings, Header Account Button, and Account Management Modal.
 * Tier 4: Interaction Engine.
 */

import { translate } from '../../i18n/translator.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';
import { deleteAccount, getAuthenticatedUser, logout, updateAvatar } from '../../services/authClientService.js';
import { deleteUserData, saveUserData } from '../../services/apiService.js';
import { initializeState, state } from '../../core/state.js';
import { resetState, saveState, setResettingState } from '../../core/localStorageManager.js';
import { openAuthModal } from '../auth/authModalInputs.js';
import { openPasskeysModal } from '../auth/passkeysModalInputs.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';
import { logger } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { isClashCalcHost } from '../../core/storageKeys.js';
import { syncPlayerTagToUrl } from '../../core/playerUrlRouter.js';
import { highlightActiveAvatar, updateAccountUI } from './settingsAccountDisplay.js';

/**
 * Opens the Avatar selection modal and highlights the current avatar.
 */
export function openAvatarModal() {
    const user = getAuthenticatedUser();
    const activeAvatar = user?.avatar || 'archer';
    highlightActiveAvatar(activeAvatar);
    openModal('avatar-modal');
    const activeBtn = document.querySelector(`.avatar-option-btn[data-avatar="${activeAvatar}"]`);
    activeBtn?.focus();
}

let activeAccountDismissListener = null;
let activeAccountEscapeListener = null;

/**
 * Toggles or sets the open state of the header account popover.
 * @param {boolean} [forceState]
 */
function toggleAccountPopover(forceState) {
    const popover = /** @type {HTMLElement | null} */ (document.getElementById('app-account-popover'));
    const btn = /** @type {HTMLElement | null} */ (document.getElementById('header-account-btn'));
    if (!popover || !btn) return;

    const isOpen = forceState !== undefined ? forceState : !popover.classList.contains('is-open');

    if (isOpen) {
        popover.removeAttribute('hidden');
        popover.style.display = 'flex';
        void popover.offsetHeight;
        popover.classList.add('is-open');
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');

        if (!activeAccountDismissListener) {
            activeAccountDismissListener = (e) => {
                const target = /** @type {HTMLElement} */ (e.target);
                if (!popover.contains(target) && !btn.contains(target)) {
                    toggleAccountPopover(false);
                }
            };
            document.addEventListener('pointerdown', activeAccountDismissListener, { passive: true });
        }

        if (!activeAccountEscapeListener) {
            activeAccountEscapeListener = (e) => {
                if (e.key === 'Escape') {
                    toggleAccountPopover(false);
                    btn.focus();
                }
            };
            document.addEventListener('keydown', activeAccountEscapeListener);
        }
    } else {
        popover.classList.remove('is-open');
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');

        setTimeout(() => {
            if (!popover.classList.contains('is-open')) {
                popover.setAttribute('hidden', '');
                popover.style.display = 'none';
            }
        }, 150);

        if (activeAccountDismissListener) {
            document.removeEventListener('pointerdown', activeAccountDismissListener);
            activeAccountDismissListener = null;
        }
        if (activeAccountEscapeListener) {
            document.removeEventListener('keydown', activeAccountEscapeListener);
            activeAccountEscapeListener = null;
        }
    }
}

/**
 * Initializes account card buttons, header button, backup/restore, and account lifecycle listeners.
 */
export function initializeSettingsAccount() {
    if (typeof window !== 'undefined' && !window.resetApplication) {
        window.resetApplication = () => {
            setResettingState(true);
            syncPlayerTagToUrl(null);
            resetState();
            if (window.location.hash || window.location.search) {
                history.replaceState(null, '', window.location.pathname);
            }
            window.location.href = window.location.origin + window.location.pathname;
        };
    }

    // Initial UI state hydration
    updateAccountUI(getAuthenticatedUser());

    // Listen to reactive auth state updates across the app
    document.addEventListener('auth:state-change', () => {
        updateAccountUI(getAuthenticatedUser());
    });

    // Re-hydrate dynamic localized labels when app language changes
    document.addEventListener('languageChanged', () => {
        updateAccountUI(getAuthenticatedUser());
    });

    // Settings open auth modal
    const openAuthBtn = document.getElementById('settings-open-auth-btn');
    openAuthBtn?.addEventListener('click', () => {
        openAuthModal('signin');
    });

    // Settings open avatar selection modal
    const avatarBtn = document.getElementById('account-avatar-btn');
    avatarBtn?.addEventListener('click', () => {
        openAvatarModal();
    });

    // Avatar options in modal
    const avatarOptionBtns = document.querySelectorAll('.avatar-option-btn');
    avatarOptionBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const target = /** @type {HTMLElement} */ (e.currentTarget || e.target);
            const avatar = target.closest('.avatar-option-btn')?.getAttribute('data-avatar');
            if (avatar) {
                highlightActiveAvatar(avatar);
                closeModalAnimated('avatar-modal');
                try {
                    await updateAvatar(avatar);
                } catch (err) {
                    logger.error('[Auth] Failed to update avatar:', err);
                }
            }
        });
    });

    const closeAvatarModalBtn = document.getElementById('close-avatar-modal-btn');
    closeAvatarModalBtn?.addEventListener('click', () => {
        closeModalAnimated('avatar-modal');
    });

    // Settings manage passkeys
    const managePasskeysBtn = document.getElementById('settings-manage-passkeys-btn');
    managePasskeysBtn?.addEventListener('click', () => {
        openPasskeysModal();
    });

    // Logout handlers for Settings Card and Header Popover
    const handleLogout = async () => {
        toggleAccountPopover(false);
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
    };

    const logoutBtn = document.getElementById('settings-logout-btn');
    logoutBtn?.addEventListener('click', handleLogout);

    const popoverLogoutBtn = document.getElementById('account-popover-logout-btn');
    popoverLogoutBtn?.addEventListener('click', handleLogout);

    // Header account button toggles Account & Preferences popover
    const headerBtn = document.getElementById('header-account-btn');
    headerBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAccountPopover();
    });

    // Popover avatar button opens avatar modal
    const popoverAvatarBtn = document.getElementById('account-popover-avatar-btn');
    popoverAvatarBtn?.addEventListener('click', () => {
        toggleAccountPopover(false);
        openAvatarModal();
    });

    // Popover passkeys button opens passkeys modal
    const popoverPasskeysBtn = document.getElementById('account-popover-passkeys-btn');
    popoverPasskeysBtn?.addEventListener('click', () => {
        toggleAccountPopover(false);
        openPasskeysModal();
    });

    // Popover guest sign in button opens auth modal
    const popoverSignInBtn = document.getElementById('account-popover-signin-btn');
    popoverSignInBtn?.addEventListener('click', () => {
        toggleAccountPopover(false);
        openAuthModal('signin');
    });

    // Popover guest device sync button opens device sync modal
    const popoverGuestSyncBtn = document.getElementById('account-popover-guest-sync-btn');
    popoverGuestSyncBtn?.addEventListener('click', async () => {
        toggleAccountPopover(false);
        const { openDeviceSyncModal } = await import('./settingsDeviceSyncInputs.js');
        openDeviceSyncModal();
    });

    // Dedicated Account & Data Management Modal
    const openAccountManagementBtn = document.getElementById('open-account-management-btn');
    const openDataManagementBtn = document.getElementById('open-data-management-btn');
    const popoverDataBtn = document.getElementById('account-popover-data-btn');
    const popoverGuestDataBtn = document.getElementById('account-popover-guest-data-btn');
    const accountDataModal = document.getElementById('account-data-modal');
    const closeAccountDataModalBtn = document.getElementById('close-account-data-modal-btn');
    const closeAccountDataHeaderBtn = document.getElementById('close-account-data-header-btn');

    const openAccDataModal = () => {
        toggleAccountPopover(false);
        if (accountDataModal) openModal(accountDataModal);
    };

    const closeAccDataModal = () => {
        if (accountDataModal) closeModalAnimated(accountDataModal);
    };

    openAccountManagementBtn?.addEventListener('click', openAccDataModal);
    openDataManagementBtn?.addEventListener('click', openAccDataModal);
    popoverDataBtn?.addEventListener('click', openAccDataModal);
    popoverGuestDataBtn?.addEventListener('click', openAccDataModal);
    closeAccountDataModalBtn?.addEventListener('click', closeAccDataModal);
    closeAccountDataHeaderBtn?.addEventListener('click', closeAccDataModal);

    // Guest sign-in callout inside modal
    const guestSignInBtn = document.getElementById('modal-guest-signin-btn');
    guestSignInBtn?.addEventListener('click', () => {
        closeAccDataModal();
        openAuthModal('signin');
    });

    // Backup & Restore (Unified for both Auth and Guest)
    const downloadBackupBtn = document.getElementById('account-data-download-btn');
    downloadBackupBtn?.addEventListener('click', () => {
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
    });

    const restoreBackupBtn = document.getElementById('account-data-restore-btn');
    const restoreFileInput = /** @type {HTMLInputElement|null} */ (document.getElementById('account-data-restore-file-input'));
    restoreBackupBtn?.addEventListener('click', () => {
        restoreFileInput?.click();
    });

    restoreFileInput?.addEventListener('change', async (e) => {
        const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
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
            logger.error('[AccountData] Failed to restore backup:', err);
            await showAlert(translate('alerts.restoreBackupInvalid'));
        } finally {
            if (restoreFileInput) restoreFileInput.value = '';
        }
    });

    // Lifecycle: Clear Cache / On-Device Data
    const clearCacheBtn = document.getElementById('modal-clear-cache-btn');
    clearCacheBtn?.addEventListener('click', async () => {
        closeAccDataModal();
        const user = getAuthenticatedUser();
        const confirmMsg = user ? translate('confirms.clearDeviceCache') : translate('confirms.resetLocal');
        if (await showConfirm(confirmMsg, 'actions.confirm', 'actions.clear')) {
            if (user) {
                setResettingState(true);
                // Wipe local player partitions and cached planner state, PRESERVING session credentials
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && (
                        key.startsWith('clashCalc_player_') ||
                        key.startsWith('oreCalc_player_') ||
                        key.startsWith('clashCalc_planner_') ||
                        key.startsWith('oreCalc_planner_') ||
                        key.startsWith('clashCalc_history_') ||
                        key.startsWith('oreCalc_history_')
                    )) {
                        localStorage.removeItem(key);
                    }
                }
                localStorage.setItem('clashCalc_playerTags', JSON.stringify(['DEFAULT0']));
                localStorage.setItem('oreCalc_playerTags', JSON.stringify(['DEFAULT0']));
                localStorage.removeItem('clashCalc_activePlayerTag');
                localStorage.removeItem('oreCalc_activePlayerTag');

                setResettingState(true);
                syncPlayerTagToUrl(null);

                if (typeof window !== 'undefined' && window.location) {
                    if (window.location.hash || window.location.search) {
                        history.replaceState(null, '', window.location.pathname);
                    }
                    window.location.href = window.location.origin + window.location.pathname;
                }
            } else {
                if (typeof window.resetApplication === 'function') {
                    window.resetApplication();
                } else {
                    localStorage.clear();
                    location.reload();
                }
            }
        } else {
            openAccDataModal();
        }
    });

    // Lifecycle: Reset Village Data / Delete Cloud & On-Device Data
    const resetDataBtn = document.getElementById('modal-reset-data-btn');
    resetDataBtn?.addEventListener('click', async () => {
        closeAccDataModal();
        const user = getAuthenticatedUser();
        const confirmMsg = user ? translate('confirms.resetAccountData') : translate('confirms.resetCloud');
        if (await showConfirm(confirmMsg, 'actions.confirm', 'actions.reset')) {
            const currentUserId = localStorage.getItem('clashCalc_userId') || localStorage.getItem('oreCalc_userId');
            const nowEpoch = Date.now();
            if (currentUserId) {
                try {
                    if (user) {
                        const emptyData = {
                            appVersion: '2.0.0',
                            savedPlayerTags: ['DEFAULT0'],
                            allPlayersData: {},
                            uiSettings: {
                                ...(state.uiSettings || {}),
                                stateResetEpoch: nowEpoch
                            },
                            stateResetEpoch: nowEpoch,
                            timestamp: new Date().toISOString()
                        };
                        await saveUserData(currentUserId, emptyData);
                    } else {
                        await deleteUserData(currentUserId);
                    }
                } catch (error) {
                    logger.error('[AccountData] Failed to reset data:', error);
                    await showAlert(translate('alerts.saveFailed', { error: error.message || error }));
                }
            }
            if (user) {
                setResettingState(true);
                initializeState({
                    savedPlayerTags: ['DEFAULT0'],
                    allPlayersData: {},
                    uiSettings: state.uiSettings || {}
                });
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && (
                        key.startsWith('clashCalc_player_') ||
                        key.startsWith('oreCalc_player_') ||
                        key.startsWith('clashCalc_planner_') ||
                        key.startsWith('oreCalc_planner_') ||
                        key.startsWith('clashCalc_history_') ||
                        key.startsWith('oreCalc_history_')
                    )) {
                        localStorage.removeItem(key);
                    }
                }
                localStorage.setItem('clashCalc_playerTags', JSON.stringify(['DEFAULT0']));
                localStorage.setItem('oreCalc_playerTags', JSON.stringify(['DEFAULT0']));
                localStorage.removeItem('clashCalc_activePlayerTag');
                localStorage.removeItem('oreCalc_activePlayerTag');

                const appSettingsKey = isClashCalcHost() ? 'clashCalc_appSettings' : 'oreCalc_appSettings';
                const currentSettings = safeJsonParse(localStorage.getItem(appSettingsKey) || '{}', {});
                currentSettings.stateResetEpoch = nowEpoch;
                localStorage.setItem(appSettingsKey, JSON.stringify(currentSettings));

                if (typeof window !== 'undefined' && window.location) {
                    window.location.href = window.location.origin + window.location.pathname;
                }
            } else {
                if (typeof window.resetApplication === 'function') {
                    window.resetApplication();
                } else {
                    location.reload();
                }
            }
        } else {
            openAccDataModal();
        }
    });

    // Lifecycle: Delete Account (Auth Only)
    const deleteAccountBtn = document.getElementById('modal-delete-account-btn');
    deleteAccountBtn?.addEventListener('click', async () => {
        closeAccDataModal();
        const confirmed = await showConfirm(translate('confirms.deleteAccount'), 'actions.confirm', 'actions.delete');
        if (confirmed) {
            try {
                await deleteAccount();
            } catch (error) {
                logger.error('[AccountData] Failed to delete account:', error);
                await showAlert(error.message || translate('alerts.deleteAccountFailed'));
            }
            if (typeof window.resetApplication === 'function') {
                window.resetApplication();
            } else {
                localStorage.clear();
                location.reload();
            }
        } else {
            openAccDataModal();
        }
    });
}
