import { dom } from '../dom/domElements.js';
import { saveState } from '../core/localStorageManager.js';
import { state } from '../core/state.js';

import { closeFabMenu } from '../components/fab/fab.js';

import { loadUserData, saveUserData } from '../services/apiService.js';
import { translate } from '../i18n/translator.js';

import { checkAppVersion } from './versioning.js';
import { escapeHTML } from './stringUtils.js';
import { generateUUID } from './uuidGenerator.js';
import { logger } from './logger.js';

import { showAlert, showConfirm } from '../ui/noticeModal.js';
import { showSavingIndicator, showSaveSuccessIndicator, showSaveErrorIndicator } from '../ui/savingIndicator.js';

export async function initializeAppData() {
    let userId = localStorage.getItem('oreCalc_userId');
    if (!userId) {
        userId = generateUUID();
        localStorage.setItem('oreCalc_userId', userId);
    }

    if (state.uiSettings.cloudSync === false) {
        logger.log("Cloud sync is disabled in settings. Skipping initialization sync.");
        await checkAppVersion();
        return null;
    }

    const localData = await checkAppVersion();
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
                let welcomeModalModule = null;
                if (welcomeWasVisible) {
                    welcomeModalModule = await import('../components/welcome/welcomeModal.js');
                    welcomeModalModule.showWelcomeModal(false);
                }

                const confirmed = await showConfirm(translate('confirms.cloudSync'));

                if (welcomeWasVisible && welcomeModalModule && !confirmed) {
                    welcomeModalModule.showWelcomeModal(true);
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

export async function importUserData(importId) {
    if (importId) {
        const currentUserId = localStorage.getItem('oreCalc_userId');
        const safeImportId = escapeHTML(importId);
        const userIdHtml = `<code class="user-id-code">${safeImportId}</code>`;

        const welcomeModal = document.getElementById('welcome-modal');
        const welcomeWasVisible = welcomeModal && welcomeModal.classList.contains('show');
        let welcomeModalModule = null;
        if (welcomeWasVisible) {
            welcomeModalModule = await import('../components/welcome/welcomeModal.js');
            welcomeModalModule.showWelcomeModal(false);
        }

        let confirmed = false;
        if (importId === currentUserId) {
            confirmed = await showConfirm(translate('confirms.importSameId', { userId: userIdHtml }), 'status.notice', 'actions.loadAnyway');
        } else {
            confirmed = await showConfirm(translate('confirms.importOverwrite', { userId: userIdHtml }));
        }

        if (welcomeWasVisible && welcomeModalModule && !confirmed) {
            welcomeModalModule.showWelcomeModal(true);
        }

        if (!confirmed) {
            return;
        }

        try {
            const importedData = await loadUserData(importId);
            if (importedData) {
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
                if (welcomeWasVisible && welcomeModalModule) {
                    welcomeModalModule.showWelcomeModal(true);
                }
            }
        } catch (error) {
            logger.error('Error importing data:', error);
            await showAlert(translate('alerts.importFailed', { error: translate(error.message) }));
            if (welcomeWasVisible && welcomeModalModule) {
                welcomeModalModule.showWelcomeModal(true);
            }
        }
    } else {
        await showAlert(translate('alerts.importEmpty'));
    }
}


export async function triggerCloudSave(options = {}) {
    const { silent = false } = options;

    if (state.uiSettings.cloudSync === false) {
        logger.log("Cloud sync is disabled in settings. Skipping save.");
        return false;
    }

    const currentUserId = localStorage.getItem('oreCalc_userId');
    if (currentUserId) {
        if (!silent) showSavingIndicator();
        try {            
            const currentPlayerTag = state.savedPlayerTags[0];
            if (currentPlayerTag) {
                state.allPlayersData[currentPlayerTag] = {
                    heroes: state.heroes,
                    storedOres: state.storedOres,
                    income: state.income,
                    planner: state.planner,
                    playerProfile: state.playerProfile,
                    currency: {
                        code: state.uiSettings.currency.code,
                        globalPricing: state.allPlayersData[currentPlayerTag]?.currency?.globalPricing || {}
                    }
                };
            }

            const stateToSave = {
                appVersion: state.appVersion,
                savedPlayerTags: state.savedPlayerTags,
                uiSettings: state.uiSettings,
                allPlayersData: state.allPlayersData,
                timestamp: state.timestamp,
            };

            if (state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0') {
                if (!silent) {
                    showSaveErrorIndicator();
                    await showAlert(translate('alerts.saveDefaultOnly'));
                }
                logger.log("Skipping cloud save: Only default player tag exists.");
                return false;
            }

            await saveUserData(currentUserId, stateToSave);
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
                    closeFabMenu();
                }, 2000);
            }
        });
    }
}