import { dom } from '../dom/domElements.js';
import { state } from '../core/state.js';
import { saveState } from '../core/localStorageManager.js';
import { loadUserData, saveUserData } from '../services/apiService.js';
import { generateUUID } from './uuidGenerator.js';
import { checkAppVersion } from './versioning.js';
import { translate } from '../i18n/translator.js';
import { showAlert, showConfirm } from '../ui/noticeModal.js';
import { escapeHTML } from './stringUtils.js';
import { logger } from './logger.js';
import { closeFabMenu } from '../components/fab/fab.js';

export async function initializeAppData() {
    let userId = localStorage.getItem('oreCalcUserId');
    if (!userId) {
        userId = generateUUID();
        localStorage.setItem('oreCalcUserId', userId);
    }

    if (state.uiSettings.cloudSync === false) {
        logger.log("Cloud sync is disabled in settings. Skipping initialization sync.");
        return await checkAppVersion();
    }

    const localData = await checkAppVersion();
    if (localData && localData.savedPlayerTags.length === 1 && localData.savedPlayerTags[0] === 'DEFAULT0') {
        logger.log("Skipping cloud sync: Only default player tag exists locally.");
        return localData;
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

    if (cloudData && localData) {
        const cloudTimestamp = new Date(cloudData.timestamp || 0);
        const localTimestamp = new Date(localData.timestamp || 0);
        const timeDifference = Math.abs(cloudTimestamp.getTime() - localTimestamp.getTime());
        const timeTolerance = 5 * 1000; 

        if (timeDifference < timeTolerance) {
            logger.log("Local and cloud data are within 5 seconds discrepancy. Considering them in sync.");
            return localData;
        } else if (cloudTimestamp > localTimestamp) {
            if (await showConfirm(translate('confirms.cloudSync'))) {
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
                return localData;
            }
        } else if (localTimestamp > cloudTimestamp) {
            logger.log("Local data is newer. Automatically pushing to cloud.");
            const userId = localStorage.getItem('oreCalcUserId');
            if (userId) {
                try {
                    await saveUserData(userId, localData);
                    logger.log("Local data pushed to cloud.");
                } catch (error) {
                    logger.error("Failed to push local data to cloud:", error);
                }
            }
            return localData;
        }
    } else if (cloudData) {
        logger.log("Only cloud data found. Using cloud data.");
        return cloudData;
    } else {
        logger.log("Only local data found. Using local data.");
        return localData;
    }
}

export async function importUserData(importId) {
    if (importId) {
        const currentUserId = localStorage.getItem('oreCalcUserId');
        const safeImportId = escapeHTML(importId);
        const userIdHtml = `<code class="user-id-code">${safeImportId}</code>`;

        if (importId === currentUserId) {
            if (!(await showConfirm(translate('confirms.importSameId', { userId: userIdHtml }), 'status.notice', 'actions.loadAnyway'))) {
                return;
            }
        } else {
            if (!(await showConfirm(translate('confirms.importOverwrite', { userId: userIdHtml })))) {
                return;
            }
        }

        try {
            const importedData = await loadUserData(importId);
            if (importedData) {
                localStorage.setItem('oreCalculatorState', JSON.stringify(importedData));
                localStorage.setItem('oreCalcUserId', importId);
                await showAlert(translate('alerts.importSuccess'));
                location.reload();
            } else {
                await showAlert(translate('alerts.importNoData'));
            }
        } catch (error) {
            logger.error('Error importing data:', error);
            await showAlert(translate('alerts.importFailed', { error: translate(error.message) }));
        }
    } else {
        await showAlert(translate('alerts.importEmpty'));
    }
}

import { showSavingIndicator, showSaveSuccessIndicator, showSaveErrorIndicator } from '../ui/savingIndicator.js';

export async function triggerCloudSave(options = {}) {
    const { silent = false } = options;

    if (state.uiSettings.cloudSync === false) {
        logger.log("Cloud sync is disabled in settings. Skipping save.");
        return false;
    }

    const currentUserId = localStorage.getItem('oreCalcUserId');
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