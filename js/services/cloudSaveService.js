import { translate } from '../i18n/translator.js';

import { loadState, saveState } from '../core/localStorageManager.js';
import { state } from '../core/state.js';

import { logger } from '../utils/logger.js';
import { escapeHTML } from '../utils/stringUtils.js';
import { generateUUID } from '../utils/uuidGenerator.js';

import { dom } from '../dom/domElements.js';
import { loadUserData, saveSinglePlayerData, saveUserData } from './apiService.js';
import { showAlert, showConfirm } from '../ui/noticeModal.js';
import { showSaveErrorIndicator, showSaveSuccessIndicator, showSavingIndicator } from '../ui/savingIndicator.js';

/**
 * Initializes application data from local storage and cloud, prompting user on conflicts.
 *
 * @returns {Promise<any>} Restored cloud payload or null.
 */
export async function initializeAppData() {
    let userId = localStorage.getItem('oreCalc_userId');
    if (!userId) {
        userId = generateUUID();
        localStorage.setItem('oreCalc_userId', userId);
    }

    if (state.uiSettings.cloudSync === false) {
        logger.log("Cloud sync is disabled in settings. Skipping initialization sync.");
        return null;
    }

    const localData = loadState();
    const justSyncedFromQr = sessionStorage.getItem('oreCalc_justSyncedFromQr') === 'true';
    if (!justSyncedFromQr && localData && localData.savedPlayerTags.length === 1 && localData.savedPlayerTags[0] === 'DEFAULT0') {
        logger.log("Skipping cloud sync: Only default player tag exists locally.");
        return null;
    }

    let cloudData = null;
    try {
        cloudData = await loadUserData(userId);
    } catch (error) {
        logger.error('Failed to load data from cloud, falling back to local storage:', error);
        if (error.message === 'apiErrors.deletedUser') {
            await showAlert(translate('apiErrors.deletedUser'));
            if (window.resetApplication) {
                window.resetApplication();
            } else {
                localStorage.clear();
                location.reload();
            }
            return;
        }
    }

    if (cloudData) {
        // Version Check: Prevent syncing if cloud data was saved by a newer version than current running client
        const runningAppVersion = window.__ENV__?.APP_VERSION || '2.0.0';
        const cloudAppVersion = cloudData.appVersion || '1.0.0';
        const { compareVersions } = await import('../utils/versionUtils.js');

        if (compareVersions(cloudAppVersion, runningAppVersion) > 0) {
            logger.warn(`Cloud data version (${cloudAppVersion}) is newer than running app version (${runningAppVersion}). Skipping sync until client updates.`);
            if (window.__WB__) {
                window.__WB__.update().catch(err => logger.error('Forced SW update check failed:', err));
            }
            return null;
        }

        const hasOnlyDefaultLocal = localData && (localData.savedPlayerTags.length === 1 && localData.savedPlayerTags[0] === 'DEFAULT0');
        if (hasOnlyDefaultLocal) {
            logger.log("Fresh local install detected. Restoring data from cloud.");
            return cloudData;
        }

        if (localData) {
            const cloudTimestamp = new Date(cloudData.timestamp || 0);
            const localTimestamp = new Date(localData.timestamp || 0);
            const timeDifference = Math.abs(cloudTimestamp.getTime() - localTimestamp.getTime());
            const timeTolerance = 5 * 1000;

            if (timeDifference < timeTolerance) {
                logger.log("Local and cloud data are within 5 seconds discrepancy. Considering them in sync.");
                return null;
            } else if (cloudTimestamp > localTimestamp) {
                const welcomeModal = document.getElementById('welcome-modal');
                const welcomeWasVisible = welcomeModal && welcomeModal.classList.contains('show');
                if (welcomeWasVisible) {
                    welcomeModal.classList.remove('show');
                }

                const confirmed = await showConfirm(translate('confirms.cloudSync'));

                if (welcomeWasVisible && !confirmed) {
                    welcomeModal.classList.add('show');
                }

                if (confirmed) {
                    logger.log("User chose to sync. Using cloud data.");
                    return cloudData;
                } else {
                    logger.log("User chose not to sync. Using local data and pushing to cloud.");
                    if (userId) {
                         try {
                             await saveUserData(userId, localData);
                             logger.log("Local data pushed to cloud.");
                         } catch (error) {
                             logger.error("Failed to push local data to cloud:", error);
                         }
                    }
                    return null;
                }
            } else if (localTimestamp > cloudTimestamp) {
                logger.log("Local data is newer. Automatically pushing to cloud.");
                const userId = localStorage.getItem('oreCalc_userId');
                if (userId) {
                    try {
                        await saveUserData(userId, localData);
                        logger.log("Local data pushed to cloud.");
                    } catch (error) {
                        logger.error("Failed to push local data to cloud:", error);
                    }
                }
                return null;
            }
        }
    } else {
        logger.log("No cloud data found.");
        return null;
    }
}

/**
 * Imports remote user account data given a user ID string.
 *
 * @param {string} importId - Target user UUID.
 * @returns {Promise<void>}
 */
export async function importUserData(importId) {
    if (importId) {
        const currentUserId = localStorage.getItem('oreCalc_userId');
        const safeImportId = escapeHTML(importId);
        const userIdHtml = `<code class="user-id-code">${safeImportId}</code>`;

        const welcomeModal = document.getElementById('welcome-modal');
        const welcomeWasVisible = welcomeModal && welcomeModal.classList.contains('show');
        if (welcomeWasVisible) {
            welcomeModal.classList.remove('show');
        }

        let confirmed = false;
        if (importId === currentUserId) {
            confirmed = await showConfirm(translate('confirms.importSameId', { userId: userIdHtml }), 'status.notice', 'actions.loadAnyway');
        } else {
            confirmed = await showConfirm(translate('confirms.importOverwrite', { userId: userIdHtml }));
        }

        if (welcomeWasVisible && !confirmed) {
            welcomeModal.classList.add('show');
        }

        if (!confirmed) {
            return;
        }

        try {
            const importedData = await loadUserData(importId);
            if (importedData) {
                // Version Check: Prevent importing if data was saved by a newer version than current running client
                const runningAppVersion = window.__ENV__?.APP_VERSION || '2.0.0';
                const importedVersion = importedData.appVersion || '1.0.0';
                const { compareVersions } = await import('../utils/versionUtils.js');
                if (compareVersions(importedVersion, runningAppVersion) > 0) {
                    await showAlert(translate('alerts.importNewerVersionRequired'));
                    if (window.__WB__) {
                        window.__WB__.update().catch(err => logger.error('Forced SW update check failed:', err));
                    }
                    if (welcomeWasVisible) {
                        welcomeModal.classList.add('show');
                    }
                    return;
                }

                if (!importedData.uiSettings) {
                    importedData.uiSettings = {};
                }
                importedData.uiSettings.cloudSync = true;
                localStorage.setItem('oreCalculatorState', JSON.stringify(importedData));
                localStorage.setItem('oreCalc_userId', importId);
                await showAlert(translate('alerts.importSuccess'));
                location.reload();
            } else {
                await showAlert(translate('alerts.importNoData'));
                if (welcomeWasVisible) {
                    welcomeModal.classList.add('show');
                }
            }
        } catch (error) {
            logger.error('Error importing data:', error);
            await showAlert(translate('alerts.importFailed', { error: translate(error.message) }));
            if (welcomeWasVisible) {
                welcomeModal.classList.add('show');
            }
        }
    } else {
        await showAlert(translate('alerts.importEmpty'));
    }
}

/**
 * Pushes application state or single player state to cloud Firestore database.
 *
 * @param {{ silent?: boolean, targetTag?: string | null }} [options={}] - Options.
 * @returns {Promise<boolean>} Whether save succeeded.
 */
export async function triggerCloudSave(options = {}) {
    const { silent = false, targetTag = null } = options;

    if (typeof localStorage === 'undefined') return false;

    if (state.uiSettings.cloudSync === false) {
        logger.log("Cloud sync is disabled in settings. Skipping save.");
        return false;
    }

    const currentUserId = localStorage.getItem('oreCalc_userId');
    if (currentUserId) {
        if (!silent) showSavingIndicator();
        try {
            saveState(state, true);

            if (state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0') {
                if (!silent) {
                    showSaveErrorIndicator();
                    await showAlert(translate('alerts.saveDefaultOnly'));
                }
                logger.log("Skipping cloud save: Only default player tag exists.");
                return false;
            }

            if (targetTag && state.allPlayersData[targetTag]) {
                await saveSinglePlayerData(currentUserId, targetTag, state.allPlayersData[targetTag]);
            } else {
                const stateToSave = {
                    appVersion: state.appVersion,
                    savedPlayerTags: state.savedPlayerTags,
                    uiSettings: state.uiSettings,
                    allPlayersData: state.allPlayersData,
                    timestamp: state.timestamp,
                };
                await saveUserData(currentUserId, stateToSave);
            }

            if (!silent) showSaveSuccessIndicator();
            return true;
        } catch (error) {
            logger.error('Failed to save data to cloud:', error);
            if (error.message === 'apiErrors.deletedUser') {
                await showAlert(translate('apiErrors.deletedUser'));
                if (window.resetApplication) {
                    window.resetApplication();
                } else {
                    localStorage.clear();
                    location.reload();
                }
                return false;
            }
            if (!silent) {
                showSaveErrorIndicator();
                await showAlert(translate('alerts.saveFailed', { error: translate(error.message) }));
            }
            return false;
        }
    }
    return false;
}

/**
 * Initializes floating action button and shortcut bindings for manual cloud sync.
 */
export function initializeCloudSaveButtons() {
    const floatingSaveBtn = dom.controls?.saveButton;
    const fabSaveDataPill = dom.fab?.pills?.saveData;

    if (floatingSaveBtn) {
        floatingSaveBtn.addEventListener('click', () => {
            saveState(state);
            triggerCloudSave();
        });
    }
    if (fabSaveDataPill) {
        fabSaveDataPill.addEventListener('click', async () => {
            saveState(state);
            const success = await triggerCloudSave();
            if (success) {
                setTimeout(() => {
                    const { main, menu } = dom.fab || {};
                    const overlay = dom.overlay;
                    if (main && menu && overlay && main.classList.contains('active')) {
                        main.classList.remove('active');
                        menu.classList.remove('show');
                        overlay.classList.remove('show');
                        document.body.classList.remove('open-fab');
                    }
                }, 2000);
            }
        });
    }

    // Automatically flush pending offline edits when network connectivity is restored
    window.addEventListener('online', () => {
        logger.log('Network connection restored. Syncing offline state to cloud...');
        triggerCloudSave({ silent: true });
    });
}
