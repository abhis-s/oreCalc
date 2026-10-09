import { translate } from '../i18n/translator.js';

import { loadState, saveState } from '../core/localStorageManager.js';
import { getActiveUserId, isClashCalcHost, normalizePlayerTag } from '../core/storageKeys.js';
import { initializeState, state } from '../core/state.js';

import { logger } from '../utils/logger.js';
import { escapeHTML } from '../utils/stringUtils.js';
import { compareVersions } from '../utils/versionUtils.js';
import { sanitizePlayerProfile, stripAutoPlacedCalendarChips } from '../core/playerStorageSanitizer.js';

import { loadUserData, markUserMigrated, saveSinglePlayerData, saveUserData, saveUserPreferences } from './apiService.js';
import { isAuthenticated, purgeAccountDataOnLogout } from './authClientService.js';
import { showAlert, showConfirm } from '../ui/noticeModal.js';

/**
 * Emits saving status event to decoupled UI listeners.
 * @param {'saving' | 'success' | 'error' | 'idle'} status
 */
function emitSavingStatus(status) {
    if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
        document.dispatchEvent(new CustomEvent('app:savingState', { detail: { status } }));
    }
}

let justSyncedFromQr = false;

/**
 * Sets whether the current runtime session was initiated via QR / URL sync.
 * @param {boolean} value - True if initiated via QR sync.
 */
export function setJustSyncedFromQr(value) {
    justSyncedFromQr = Boolean(value);
}

/**
 * Checks whether the current runtime session was initiated via QR / URL sync.
 * @returns {boolean} True if initiated via QR sync.
 */
export function isJustSyncedFromQr() {
    return justSyncedFromQr;
}

/**
 * Initializes application data from local storage and cloud, prompting user on conflicts.
 *
 * @returns {Promise<any>} Restored cloud payload or null.
 */
export async function initializeAppData() {
    let userId = getActiveUserId(true);
    const isAuthed = isAuthenticated();
    const localData = loadState();
    const hasRealPlayer = Boolean(localData && Array.isArray(localData.savedPlayerTags) && localData.savedPlayerTags.some(t => t && t !== 'DEFAULT0'));

    if (isClashCalcHost() && userId && (isAuthed || hasRealPlayer || justSyncedFromQr)) {
        markUserMigrated(userId).catch(() => {});
    }

    if (!isAuthed && state.uiSettings?.cloudSync === false) {
        logger.log("Cloud sync is disabled in settings. Skipping initialization sync.");
        return null;
    }

    if (!isAuthed && !justSyncedFromQr && !hasRealPlayer) {
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
        if (error.message === 'apiErrors.unauthorizedAccess') {
            if (!isAuthenticated()) {
                logger.warn('Unauthenticated client holding protected account userId. Purging unauthorized account data.');
                purgeAccountDataOnLogout();
                if (typeof window !== 'undefined' && window.location) {
                    if (window.location.search || window.location.hash) {
                        try {
                            history.replaceState(null, '', window.location.pathname || '/');
                        } catch (_) {}
                    }
                    if (typeof window.location.reload === 'function') {
                        window.location.reload();
                    }
                }
                return null;
            }
            await showAlert(translate('apiErrors.unauthorizedAccess'));
            return null;
        }
    }

    if (cloudData) {
        // Version Check: Prevent syncing if cloud data was saved by a newer version than current running client
        const runningAppVersion = window.__ENV__?.APP_VERSION || '2.0.0';
        const cloudAppVersion = cloudData.appVersion || '1.0.0';

        if (compareVersions(cloudAppVersion, runningAppVersion) > 0) {
            logger.warn(`Cloud data version (${cloudAppVersion}) is newer than running app version (${runningAppVersion}). Skipping sync until client updates.`);
            if (window.__WB__) {
                window.__WB__.update().catch(err => logger.error('Forced SW update check failed:', err));
            }
            return null;
        }

        const hasOnlyDefaultLocal = localData && Array.isArray(localData.savedPlayerTags) && !localData.savedPlayerTags.some(t => t && t !== 'DEFAULT0');
        if (!localData || hasOnlyDefaultLocal) {
            logger.log("Fresh local install or empty cache detected. Restoring data from cloud.");
            return cloudData;
        }

        // Intercept server state reset epoch: if server was pruned/reset, adopt cloud state and discard stale local partitions
        const localResetEpoch = Number(localData?.uiSettings?.stateResetEpoch || 0);
        const cloudResetEpoch = Number(cloudData.stateResetEpoch || cloudData.uiSettings?.stateResetEpoch || 0);
        if (cloudResetEpoch > localResetEpoch) {
            logger.log("Server state reset detected. Discarding stale local data and adopting cloud state.");
            if (!cloudData.uiSettings) cloudData.uiSettings = {};
            cloudData.uiSettings.stateResetEpoch = cloudResetEpoch;
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
                const setupModal = document.getElementById('guided-setup-modal');
                const setupWasVisible = setupModal && (setupModal.classList.contains('show') || /** @type {HTMLDialogElement} */ (setupModal).open);
                if (setupWasVisible) {
                    setupModal.classList.remove('show');
                }

                const confirmed = await showConfirm(translate('confirms.cloudSync'));

                if (setupWasVisible && !confirmed) {
                    setupModal.classList.add('show');
                }

                if (confirmed) {
                    logger.log("User chose to sync. Using cloud data.");
                    return cloudData;
                } else {
                    logger.log("User chose not to sync. Using local data and pushing to cloud.");
                    if (userId) {
                         try {
                             const localToSave = { ...localData };
                             if (Array.isArray(localToSave.savedPlayerTags)) {
                                 localToSave.savedPlayerTags = localToSave.savedPlayerTags
                                     .map(normalizePlayerTag)
                                     .filter(t => t && t !== 'DEFAULT0');
                             }
                             if (!isAuthed && (!Array.isArray(localToSave.savedPlayerTags) || localToSave.savedPlayerTags.length === 0)) {
                                 return null;
                             }
                             await saveUserData(userId, localToSave);
                             logger.log("Local data pushed to cloud.");
                         } catch (error) {
                             logger.error("Failed to push local data to cloud:", error);
                         }
                    }
                    return null;
                }
            } else if (localTimestamp > cloudTimestamp) {
                logger.log("Local data is newer. Automatically pushing to cloud.");
                const userId = getActiveUserId();
                if (userId) {
                    try {
                        const localToSave = { ...localData };
                        if (Array.isArray(localToSave.savedPlayerTags)) {
                            localToSave.savedPlayerTags = localToSave.savedPlayerTags
                                .map(normalizePlayerTag)
                                .filter(t => t && t !== 'DEFAULT0');
                        }
                        if (!isAuthed && (!Array.isArray(localToSave.savedPlayerTags) || localToSave.savedPlayerTags.length === 0)) {
                            return null;
                        }
                        await saveUserData(userId, localToSave);
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
        const currentUserId = getActiveUserId();
        const safeImportId = escapeHTML(importId);
        const userIdHtml = `<code class="user-id-code">${safeImportId}</code>`;

        const setupModal = document.getElementById('guided-setup-modal');
        const setupWasVisible = setupModal && (setupModal.classList.contains('show') || /** @type {HTMLDialogElement} */ (setupModal).open);
        if (setupWasVisible) {
            setupModal.classList.remove('show');
        }

        let confirmed = false;
        if (importId === currentUserId) {
            confirmed = await showConfirm(translate('confirms.importSameId', { userId: userIdHtml }), 'status.notice', 'actions.loadAnyway');
        } else {
            confirmed = await showConfirm(translate('confirms.importOverwrite', { userId: userIdHtml }));
        }

        if (setupWasVisible && !confirmed) {
            setupModal.classList.add('show');
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
                if (compareVersions(importedVersion, runningAppVersion) > 0) {
                    await showAlert(translate('alerts.importNewerVersionRequired'));
                    if (window.__WB__) {
                        window.__WB__.update().catch(err => logger.error('Forced SW update check failed:', err));
                    }
                    if (setupWasVisible) {
                        setupModal.classList.add('show');
                    }
                    return;
                }

                if (!importedData.uiSettings) {
                    importedData.uiSettings = {};
                }
                importedData.uiSettings.cloudSync = true;
                const targetUserIdKey = isClashCalcHost() ? 'clashCalc_userId' : 'oreCalc_userId';
                localStorage.setItem(targetUserIdKey, importId);
                if (!isClashCalcHost()) {
                    localStorage.setItem('oreCalc_userId', importId);
                }
                if (isClashCalcHost()) {
                    markUserMigrated(importId).catch(() => {});
                }
                initializeState(importedData);
                saveState(state, true);
                localStorage.removeItem('oreCalculatorState');
                localStorage.removeItem('OreCalculatorState');
                await showAlert(translate('alerts.importSuccess'));
                location.reload();
            } else {
                await showAlert(translate('alerts.importNoData'));
                if (setupWasVisible) {
                    setupModal.classList.add('show');
                }
            }
        } catch (error) {
            logger.error('Error importing data:', error);
            await showAlert(translate('alerts.importFailed', { error: translate(error.message) }));
            if (setupWasVisible) {
                setupModal.classList.add('show');
            }
        }
    } else {
        await showAlert(translate('alerts.importEmpty'));
    }
}

let preferencesSaveTimeout = null;

/**
 * Cancels any active pending debounced preferences save timer.
 */
export function cancelPreferencesSaveTimer() {
    if (preferencesSaveTimeout) {
        clearTimeout(preferencesSaveTimeout);
        preferencesSaveTimeout = null;
    }
}

/**
 * Pushes decoupled user preferences to cloud without serializing or pushing player data.
 * Respects strict invariant: non-signed in users with only DEFAULT0 never touch the network.
 *
 * @param {{ silent?: boolean }} [options={}]
 * @returns {Promise<boolean>}
 */
export async function triggerPreferencesSave(options = {}) {
    const { silent = true } = options;

    if (typeof localStorage === 'undefined') return false;

    const isAuthed = isAuthenticated();
    const hasRealPlayer = Array.isArray(state.savedPlayerTags) && state.savedPlayerTags.some(t => t && t !== 'DEFAULT0');
    const cloudSyncEnabled = state.uiSettings?.cloudSync !== false;

    // Invariant: Non-signed in users without a real player profile or with cloudSync off never touch the network
    if (!isAuthed && (!hasRealPlayer || !cloudSyncEnabled)) {
        return false;
    }

    const currentUserId = getActiveUserId();
    if (!currentUserId) return false;

    if (preferencesSaveTimeout) {
        clearTimeout(preferencesSaveTimeout);
    }

    return new Promise((resolve) => {
        preferencesSaveTimeout = setTimeout(async () => {
            preferencesSaveTimeout = null;
            try {
                if (!silent) emitSavingStatus('saving');
                const preferences = { ...(state.uiSettings || {}) };
                delete preferences.saveError;

                await saveUserPreferences(currentUserId, preferences);
                if (!silent) emitSavingStatus('success');
                resolve(true);
            } catch (error) {
                logger.error('Failed to save decoupled user preferences:', error);
                if (!silent) emitSavingStatus('error');
                resolve(false);
            }
        }, 500);
    });
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

    const isAuthed = isAuthenticated();
    if (!isAuthed && state.uiSettings?.cloudSync === false) {
        logger.log("Cloud sync is disabled in settings. Skipping save.");
        return false;
    }

    if (!Array.isArray(state.savedPlayerTags) || !state.allPlayersData) {
        logger.log("Skipping cloud save: Player state is not loaded or initialized.");
        return false;
    }

    const currentUserId = getActiveUserId();
    if (currentUserId) {
        if (!silent) emitSavingStatus('saving');
        try {
            saveState(state, true);

            const hasRealPlayer = state.savedPlayerTags.some(t => t && t !== 'DEFAULT0');
            if (!hasRealPlayer && !isAuthed) {
                if (!silent) {
                    emitSavingStatus('error');
                    await showAlert(translate('alerts.saveDefaultOnly'));
                }
                logger.log("Skipping cloud save: Only default or guest player tag exists.");
                return false;
            }

            if (targetTag && state.allPlayersData[targetTag]) {
                const rawPlayer = state.allPlayersData[targetTag];
                const sanitizedPlayer = { ...rawPlayer };
                if (sanitizedPlayer.playerProfile) {
                    sanitizedPlayer.playerProfile = sanitizePlayerProfile(sanitizedPlayer.playerProfile);
                }
                if (sanitizedPlayer.planner?.calendar?.dates) {
                    sanitizedPlayer.planner = {
                        ...sanitizedPlayer.planner,
                        calendar: {
                            ...sanitizedPlayer.planner.calendar,
                            dates: stripAutoPlacedCalendarChips(sanitizedPlayer.planner.calendar.dates)
                        }
                    };
                }
                await saveSinglePlayerData(currentUserId, targetTag, sanitizedPlayer);
            } else {
                const sanitizedAllPlayers = {};
                for (const [tag, pData] of Object.entries(state.allPlayersData)) {
                    if (!tag || normalizePlayerTag(tag) === 'DEFAULT0') continue;
                    if (!pData || typeof pData !== 'object') {
                        sanitizedAllPlayers[tag] = pData;
                        continue;
                    }
                    const cleanP = { ...pData };
                    if (cleanP.playerProfile) {
                        cleanP.playerProfile = sanitizePlayerProfile(cleanP.playerProfile);
                    }
                    if (cleanP.planner?.calendar?.dates) {
                        cleanP.planner = {
                            ...cleanP.planner,
                            calendar: {
                                ...cleanP.planner.calendar,
                                dates: stripAutoPlacedCalendarChips(cleanP.planner.calendar.dates)
                            }
                        };
                    }
                    sanitizedAllPlayers[tag] = cleanP;
                }

                const uiSettingsToSave = { ...(state.uiSettings || {}) };
                delete uiSettingsToSave.saveError;

                const cleanTags = (state.savedPlayerTags || [])
                    .map(normalizePlayerTag)
                    .filter(t => t && t !== 'DEFAULT0');

                const stateToSave = {
                    appVersion: state.appVersion,
                    savedPlayerTags: cleanTags,
                    uiSettings: uiSettingsToSave,
                    allPlayersData: sanitizedAllPlayers,
                    timestamp: state.timestamp,
                };
                await saveUserData(currentUserId, stateToSave);
            }

            if (!silent) emitSavingStatus('success');
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
            if (error.message === 'apiErrors.unauthorizedAccess' && !isAuthenticated()) {
                logger.warn('Unauthenticated client holding protected account userId during save. Purging unauthorized account data.');
                purgeAccountDataOnLogout();
                if (typeof window !== 'undefined' && window.location) {
                    if (window.location.search || window.location.hash) {
                        try {
                            history.replaceState(null, '', window.location.pathname || '/');
                        } catch (_) {}
                    }
                    if (typeof window.location.reload === 'function') {
                        window.location.reload();
                    }
                }
                return false;
            }
            if (!silent) {
                emitSavingStatus('error');
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
    const floatingSaveBtn = document.getElementById('floating-save-btn');
    const fabSaveDataPill = document.getElementById('fab-save-data-pill');

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
                    const main = document.getElementById('main-fab');
                    const menu = document.querySelector('.fab-menu');
                    const overlay = document.getElementById('overlay') || document.querySelector('.overlay');
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
