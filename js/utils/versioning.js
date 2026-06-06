import { compareVersions } from '../core/stateCleanup.js';
import { initializeState } from '../core/state.js';
import { loadState, resetState } from '../core/localStorageManager.js';

import { fetchRequiredClientVersion } from '../services/apiService.js';
import { translate } from '../i18n/translator.js';

import { logger } from './logger.js';

import { showAlert } from '../ui/noticeModal.js';

export async function checkAppVersion() {
    let currentAppVersionFromServer = '0.0.0';
    try {
        currentAppVersionFromServer = await fetchRequiredClientVersion();
    } catch (error) {
        logger.error('Error fetching current app version:', error);
    }

    let savedState = loadState();

    let savedAppVersion = savedState ? savedState.appVersion : undefined;
    const MIN_SUPPORTED_VERSION = '1.0.0'; // Versions older than this will be forced reset

    if (savedState) {
        const isVeryOld = savedAppVersion === undefined || compareVersions(savedAppVersion, MIN_SUPPORTED_VERSION) < 0;

        if (isVeryOld) {
            logger.warn(`Saved data format is too old (${savedAppVersion || 'missing'}). Resetting data without confirmation.`);
            resetState();
            savedState = null;
            await showAlert(translate('alerts.versionOutdatedReset'));
            location.reload();
        } else if (compareVersions(savedAppVersion, currentAppVersionFromServer) < 0) {
            logger.log(`App version update. Migrating from ${savedAppVersion} to ${currentAppVersionFromServer}.`);
            savedState.appVersion = currentAppVersionFromServer;
        }
    }

    if (!savedState) {
        savedState = {
            appVersion: currentAppVersionFromServer,
            savedPlayerTags: ['DEFAULT0']
        };
    }

    return savedState;
}