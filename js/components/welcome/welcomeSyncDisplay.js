import { translate } from '../../i18n/translator.js';

import { STORAGE_KEYS } from '../../core/constants.js';
import { state } from '../../core/state.js';

import { renderSyncQRCode } from '../../utils/qrCodeHelper.js';
import { generateUUID } from '../../utils/uuidGenerator.js';

import { welcomeState } from './welcomeModalState.js';

/**
 * Synchronizes the Welcome Modal Page 4 sync overlays based on guest vs real profile availability
 * and whether the user explicitly entered via the "Link to another device" shortcut.
 * - When in guest mode: Cloud Sync is disabled/off (blur), QR Code is disabled (blur), Paste section is open.
 * - When linking with real profiles: Cloud Sync is forced ON (blur with notice), QR Code is active/expandable, Paste section is open.
 * - When in standard view with real profiles: Cloud Sync is toggleable, QR Code is active.
 */
export function updateWelcomeSyncState() {
    const hasRealProfiles = state.savedPlayerTags && state.savedPlayerTags.some(tag => tag !== 'DEFAULT0');
    const isLinkingFromShortcut = welcomeState.cameFromSyncStartBtn === true;
    const cloudSyncGuestOverlay = document.getElementById('welcome-cloud-sync-guest-overlay');
    const cloudSyncOverlayText = document.getElementById('welcome-cloud-sync-overlay-text');
    const qrGuestOverlay = document.getElementById('welcome-sync-qr-guest-overlay');
    const qrWrapper = document.getElementById('welcome-your-sync-code-wrapper');
    const deviceSyncOverlay = document.getElementById('welcome-device-sync-overlay');
    const cloudSyncPref = /** @type {HTMLInputElement|null} */ (document.getElementById('welcome-pref-cloud-sync'));
    const deviceSyncSection = document.querySelector('.welcome-device-sync-section');
    const linkDeviceDetails = /** @type {HTMLDetailsElement|null} */ (document.getElementById('welcome-link-device-details'));

    if (!hasRealProfiles) {
        if (cloudSyncGuestOverlay) cloudSyncGuestOverlay.style.display = 'flex';
        if (cloudSyncOverlayText) {
            cloudSyncOverlayText.textContent = translate('views.welcome.cloudSyncPlayerTagRequired');
            cloudSyncOverlayText.setAttribute('data-i18n', 'views.welcome.cloudSyncPlayerTagRequired');
        }
        if (qrGuestOverlay) qrGuestOverlay.style.display = 'flex';
        if (qrWrapper) qrWrapper.classList.add('sync-disabled');
        if (cloudSyncPref) {
            cloudSyncPref.disabled = true;
            cloudSyncPref.checked = false;
        }

        if (deviceSyncOverlay) deviceSyncOverlay.style.display = 'none';
        if (deviceSyncSection) deviceSyncSection.classList.remove('sync-disabled');

        const qrDetails = /** @type {HTMLDetailsElement|null} */ (document.getElementById('welcome-your-sync-code-details'));
        if (qrDetails && qrDetails.open) {
            if (/** @type {any} */ (qrDetails)._welcomeAccordion) {
                /** @type {any} */ (qrDetails)._welcomeAccordion.shrink();
            } else {
                qrDetails.open = false;
            }
        }

        if (linkDeviceDetails && !linkDeviceDetails.open) {
            if (/** @type {any} */ (linkDeviceDetails)._welcomeAccordion) {
                /** @type {any} */ (linkDeviceDetails)._welcomeAccordion.open();
            } else {
                linkDeviceDetails.open = true;
            }
        }
    } else if (isLinkingFromShortcut) {
        if (cloudSyncGuestOverlay) cloudSyncGuestOverlay.style.display = 'flex';
        if (cloudSyncOverlayText) {
            cloudSyncOverlayText.textContent = translate('views.welcome.cloudSyncRequiredForDeviceLink');
            cloudSyncOverlayText.setAttribute('data-i18n', 'views.welcome.cloudSyncRequiredForDeviceLink');
        }
        if (cloudSyncPref) {
            cloudSyncPref.disabled = true;
            cloudSyncPref.checked = true;
        }

        if (qrGuestOverlay) qrGuestOverlay.style.display = 'none';
        if (qrWrapper) qrWrapper.classList.remove('sync-disabled');

        if (deviceSyncOverlay) deviceSyncOverlay.style.display = 'none';
        if (deviceSyncSection) deviceSyncSection.classList.remove('sync-disabled');

        if (linkDeviceDetails && !linkDeviceDetails.open) {
            if (/** @type {any} */ (linkDeviceDetails)._welcomeAccordion) {
                /** @type {any} */ (linkDeviceDetails)._welcomeAccordion.open();
            } else {
                linkDeviceDetails.open = true;
            }
        }
    } else {
        if (cloudSyncGuestOverlay) cloudSyncGuestOverlay.style.display = 'none';
        if (qrGuestOverlay) qrGuestOverlay.style.display = 'none';
        if (qrWrapper) qrWrapper.classList.remove('sync-disabled');
        if (cloudSyncPref) {
            cloudSyncPref.disabled = false;
            cloudSyncPref.checked = state.uiSettings?.cloudSync !== false;
        }

        const isCloudSyncActive = cloudSyncPref ? cloudSyncPref.checked : (state.uiSettings?.cloudSync !== false);
        if (isCloudSyncActive) {
            if (deviceSyncOverlay) deviceSyncOverlay.style.display = 'none';
            if (deviceSyncSection) deviceSyncSection.classList.remove('sync-disabled');
        } else {
            if (deviceSyncOverlay) deviceSyncOverlay.style.display = 'flex';
            if (deviceSyncSection) deviceSyncSection.classList.add('sync-disabled');
        }
    }
}

/**
 * Populates the Welcome Modal Page 4 device sync elements (#welcome-sync-user-id and #welcome-sync-qr-container).
 * Retrieves or generates the user ID and initializes the QR Code container.
 *
 * @returns {{ userId: string, userIdDisplay: HTMLElement|null, qrContainer: HTMLElement|null }} Result object.
 */
export function renderWelcomeSyncQr() {
    const userIdDisplay = document.getElementById('welcome-sync-user-id');
    const qrContainer = document.getElementById('welcome-sync-qr-container');

    let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
    if (!userId) {
        userId = generateUUID();
        localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
    }

    if (userIdDisplay) {
        userIdDisplay.textContent = userId;
        userIdDisplay.dataset.fullId = userId;
    }

    if (qrContainer) {
        renderSyncQRCode(qrContainer, userId, 250);
    }

    updateWelcomeSyncState();

    return { userId, userIdDisplay, qrContainer };
}
