/**
 * Interaction bindings and step-up verification for Account Erasure operations.
 * Tier 4: Interaction Engine.
 */

import { translate } from '../../i18n/translator.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';
import { showToast } from '../../ui/toast.js';
import { deleteAccount, getAuthenticatedUser } from '../../services/authClientService.js';
import { deleteUserData, saveUserData } from '../../services/apiService.js';
import { initializeState, state } from '../../core/state.js';
import { setResettingState } from '../../core/localStorageManager.js';
import { logger } from '../../utils/logger.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';
import { isClashCalcHost, rotateActiveUserId } from '../../core/storageKeys.js';
import { getResetVillageDataCopy, hasRealPlayerProfile, renderAccountErasureCard, toggleDeleteStepUp } from './accountPageDisplay.js';

/**
 * Resets village calculation and progress data both locally and in cloud storage.
 */
async function handleResetVillageData() {
    const user = getAuthenticatedUser();
    const isAuthed = user !== null;
    const hasRealPlayer = hasRealPlayerProfile();
    const { confirmMessage } = getResetVillageDataCopy(isAuthed, hasRealPlayer);

    if (await showConfirm(confirmMessage, 'actions.confirm', 'actions.reset')) {
        const currentUserId = localStorage.getItem('clashCalc_userId') || localStorage.getItem('oreCalc_userId');
        const nowEpoch = Date.now();

        if (user) {
            if (currentUserId && hasRealPlayer) {
                try {
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
                } catch (error) {
                    logger.error('[Account] Failed to reset cloud village data:', error);
                    await showAlert(translate('alerts.saveFailed', { error: error.message || error }));
                }
            }

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
            if (currentUserId && hasRealPlayer) {
                try {
                    await deleteUserData(currentUserId);
                } catch (error) {
                    logger.warn('[Account] Failed to delete cloud user data:', error);
                }
            }
            rotateActiveUserId();
            if (typeof window.resetApplication === 'function') {
                window.resetApplication();
            } else {
                localStorage.clear();
                location.reload();
            }
        }
    }
}

/**
 * Validates step-up input to enable or disable the destructive delete button.
 */
function handleDeleteStepUpInput() {
    const user = getAuthenticatedUser();
    const input = /** @type {HTMLInputElement | null} */ (document.getElementById('account-delete-confirm-input'));
    const executeBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('account-delete-execute-btn'));

    if (!user || !input || !executeBtn) return;
    executeBtn.disabled = input.value.trim() !== user.username;
}

/**
 * Executes permanent account deletion following verified step-up username typing.
 */
async function handleExecuteDeleteAccount() {
    const user = getAuthenticatedUser();
    const input = /** @type {HTMLInputElement | null} */ (document.getElementById('account-delete-confirm-input'));
    const executeBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('account-delete-execute-btn'));

    if (!user || !input || input.value.trim() !== user.username) return;

    if (executeBtn) executeBtn.disabled = true;

    try {
        await deleteAccount();
        toggleDeleteStepUp(false);
        if (typeof window.resetApplication === 'function') {
            window.resetApplication();
        } else {
            localStorage.clear();
            location.reload();
        }
    } catch (err) {
        logger.error('[Account] Failed to delete account:', err);
        showToast(err.message || translate('alerts.deleteAccountFailed'), 'error');
        if (executeBtn) executeBtn.disabled = false;
    }
}

/**
 * Binds all interactive listeners for account and data erasure actions and step-up deletion.
 */
export function initAccountErasure() {
    const resetDataBtn = document.getElementById('account-btn-reset-data');
    resetDataBtn?.addEventListener('click', handleResetVillageData);

    const guestResetDataBtn = document.getElementById('account-guest-reset-data-btn');
    guestResetDataBtn?.addEventListener('click', handleResetVillageData);

    const deleteAccountBtn = document.getElementById('account-btn-delete-account');
    deleteAccountBtn?.addEventListener('click', () => {
        const user = getAuthenticatedUser();
        toggleDeleteStepUp(true, user?.username || '');
    });

    const deleteCancelBtn = document.getElementById('account-delete-cancel-btn');
    deleteCancelBtn?.addEventListener('click', () => toggleDeleteStepUp(false));

    const deleteConfirmInput = document.getElementById('account-delete-confirm-input');
    deleteConfirmInput?.addEventListener('input', handleDeleteStepUpInput);

    const deleteExecuteBtn = document.getElementById('account-delete-execute-btn');
    deleteExecuteBtn?.addEventListener('click', handleExecuteDeleteAccount);

    const user = getAuthenticatedUser();
    renderAccountErasureCard(user !== null);
}
