/**
 * Controller for Active Sessions Hub and Cross-Device QR Pairing.
 * Tier 4: Interactive Controller (DOM event listeners and API service dispatch).
 */

import { isAuthenticated } from '../../services/authClientService.js';
import {
    cancelPairingToken,
    claimPairingToken,
    createPairingToken,
    fetchPairingStatus,
    fetchSessions,
    revokeOtherSessions,
    revokeSession
} from '../../services/authSessionClientService.js';
import { translate } from '../../i18n/translator.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { showToast } from '../../ui/toast.js';
import { logger } from '../../utils/logger.js';
import { renderPairingQRCode } from '../../utils/qrCodeHelper.js';
import {
    renderActiveSessionsList,
    setPairingQROverlay,
    togglePairingDrawer,
    updatePairingTimer
} from './accountPageSessionsDisplay.js';

/** @type {any} */
let pairingTimerInterval = null;
/** @type {any} */
let pairingStatusPollInterval = null;
let remainingPairingSeconds = 0;
/** @type {string|null} */
let newlyPairedSessionId = null;
/** @type {string|null} */
let currentActivePairingToken = null;
let isSessionsModuleInitialized = false;

/**
 * Loads the user's active sessions from the server and renders them.
 */
export async function loadAndRenderSessions() {
    if (!isAuthenticated()) return;
    try {
        const sessions = await fetchSessions();
        renderActiveSessionsList(sessions, newlyPairedSessionId);
    } catch (err) {
        logger.warn('[Sessions] Failed to fetch sessions:', err);
    }
}

/**
 * Handles individual session revocation.
 *
 * @param {string} sessionId - ID of target session to revoke.
 */
async function handleRevokeSession(sessionId) {
    if (!sessionId) return;
    const confirmed = await showConfirm(translate('auth.confirmRevokeSession') || 'Are you sure you want to sign out this session?');
    if (!confirmed) return;

    try {
        const res = await revokeSession(sessionId);
        if (res.isCurrent) {
            window.location.reload();
            return;
        }
        showToast(translate('auth.sessionRevoked'), 'success');
        await loadAndRenderSessions();
    } catch (err) {
        logger.error('[Sessions] Revoke session failed:', err);
        showToast(translate('apiErrors.default'), 'error');
    }
}

/**
 * Handles bulk revocation of all sessions except the current one.
 */
async function handleRevokeOtherSessions() {
    const confirmed = await showConfirm(translate('auth.confirmSignOutOthers'));
    if (!confirmed) return;

    try {
        await revokeOtherSessions();
        showToast(translate('auth.allOtherSessionsRevoked'), 'success');
        await loadAndRenderSessions();
    } catch (err) {
        logger.error('[Sessions] Revoke other sessions failed:', err);
        showToast(translate('apiErrors.default'), 'error');
    }
}

/**
 * Clears the active countdown and status polling timers if running.
 */
function stopPairingTimers() {
    if (pairingTimerInterval) {
        clearInterval(pairingTimerInterval);
        pairingTimerInterval = null;
    }
    if (pairingStatusPollInterval) {
        clearInterval(pairingStatusPollInterval);
        pairingStatusPollInterval = null;
    }
}

/**
 * Stops pairing timers, clears the QR canvas, and invalidates active token on server immediately.
 */
function stopAndCancelPairing() {
    stopPairingTimers();
    if (currentActivePairingToken) {
        const tokenToCancel = currentActivePairingToken;
        currentActivePairingToken = null;
        cancelPairingToken(tokenToCancel).catch((err) => {
            logger.warn('[Pairing] Cancel token failed:', err);
        });
    }

    const qrContainer = document.getElementById('account-pairing-qr-canvas');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        qrContainer.removeAttribute('data-token');
    }
    setPairingQROverlay({ type: 'hidden' });
}

/**
 * Reacts to a confirmed device pairing claim.
 *
 * @param {{ deviceName?: string, sessionId?: string }} claimData
 */
async function handlePairingClaimed(claimData) {
    stopPairingTimers();
    currentActivePairingToken = null;
    const refreshBtn = document.getElementById('account-btn-refresh-pairing');
    const closeBtn = document.getElementById('account-btn-close-pairing');

    setPairingQROverlay({
        type: 'success',
        title: translate('auth.deviceLinked') || 'Device Linked',
        desc: claimData.deviceName || translate('auth.deviceLinkedSuccess') || 'Device linked successfully'
    });
    updatePairingTimer(0, 'claimed');

    if (refreshBtn) refreshBtn.classList.add('is-hidden');
    if (closeBtn) closeBtn.classList.remove('is-hidden');

    if (claimData.sessionId) {
        newlyPairedSessionId = claimData.sessionId;
        await loadAndRenderSessions();
    }
}

/**
 * Reacts to an expired pairing challenge.
 */
function handlePairingExpired() {
    stopPairingTimers();
    currentActivePairingToken = null;
    updatePairingTimer(0, 'expired');
    setPairingQROverlay({
        type: 'expired',
        title: translate('auth.codeExpired') || 'Code Expired',
        desc: translate('auth.pairingCodeExpired') || 'Pairing code expired. Please generate a new code.'
    });
}

/**
 * Initiates the QR pairing flow, generating a new token, starting the countdown and status polling.
 */
async function startPairingFlow() {
    stopPairingTimers();
    if (currentActivePairingToken) {
        const tokenToCancel = currentActivePairingToken;
        currentActivePairingToken = null;
        cancelPairingToken(tokenToCancel).catch(() => {});
    }

    setPairingQROverlay({ type: 'hidden' });
    updatePairingTimer(90, 'normal');

    const refreshBtn = document.getElementById('account-btn-refresh-pairing');
    const closeBtn = document.getElementById('account-btn-close-pairing');
    if (refreshBtn) refreshBtn.classList.remove('is-hidden');
    if (closeBtn) closeBtn.classList.add('is-hidden');

    const qrContainer = document.getElementById('account-pairing-qr-canvas');
    if (qrContainer) {
        qrContainer.innerHTML = '<div class="account-pairing-loading"><div class="button-loader"><span></span><span></span><span></span></div></div>';
    }

    try {
        const data = await createPairingToken();
        const activeToken = data.pairingToken;
        currentActivePairingToken = activeToken;
        remainingPairingSeconds = data.expiresIn || 90;
        updatePairingTimer(remainingPairingSeconds, 'normal');

        if (qrContainer) {
            qrContainer.setAttribute('data-token', activeToken);
            renderPairingQRCode(qrContainer, activeToken, 200);
        }

        pairingTimerInterval = setInterval(async () => {
            remainingPairingSeconds -= 1;
            if (remainingPairingSeconds <= 0) {
                stopPairingTimers();
                currentActivePairingToken = null;

                // Final status check safeguard: inspect whether the token was claimed right at the cutoff
                try {
                    const finalStatus = await fetchPairingStatus(activeToken);
                    if (finalStatus.status === 'claimed') {
                        await handlePairingClaimed(finalStatus);
                        return;
                    }
                } catch (err) {
                    logger.warn('[Pairing] Final status check failed:', err);
                }

                handlePairingExpired();
            } else {
                updatePairingTimer(remainingPairingSeconds, 'normal');
            }
        }, 1000);

        pairingStatusPollInterval = setInterval(async () => {
            try {
                const statusRes = await fetchPairingStatus(activeToken);
                if (statusRes.status === 'claimed') {
                    await handlePairingClaimed(statusRes);
                } else if (statusRes.status === 'expired') {
                    handlePairingExpired();
                }
            } catch (pollErr) {
                logger.warn('[Pairing] Poll status failed:', pollErr);
            }
        }, 5000);
    } catch (err) {
        logger.error('[Pairing] Create token failed:', err);
        currentActivePairingToken = null;
        if (qrContainer) {
            qrContainer.innerHTML = '';
        }
        showToast(translate('apiErrors.default'), 'error');
    }
}

/**
 * Checks URL query parameters for ?pair=<token> on page load.
 */
async function checkAndHandlePairingParam() {
    if (typeof window === 'undefined' || !window.location) return;
    const urlParams = new URLSearchParams(window.location.search);
    const pairToken = urlParams.get('pair');
    if (!pairToken) return;

    // Clean up query parameter from address bar immediately
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    try {
        await claimPairingToken(pairToken);
        showToast(translate('auth.devicePairedSuccess'), 'success');
    } catch (err) {
        logger.warn('[Pairing] Claim failed:', err);
        showToast(translate('auth.pairingCodeExpired'), 'warning');
    }
}

/**
 * Initializes interaction listeners for Active Sessions and Cross-Device Pairing.
 */
export function initAccountSessionsModule() {
    checkAndHandlePairingParam();

    const revokeOtherBtn = document.getElementById('account-btn-revoke-other-sessions');
    revokeOtherBtn?.addEventListener('click', handleRevokeOtherSessions);

    const sessionsListEl = document.getElementById('account-sessions-list');
    sessionsListEl?.addEventListener('click', (e) => {
        const btn = /** @type {HTMLElement} */ (e.target).closest('.account-session-revoke-btn');
        if (btn) {
            const sid = btn.getAttribute('data-session-id');
            if (sid) handleRevokeSession(sid);
        }
    });

    const togglePairingBtn = document.getElementById('account-btn-toggle-pairing');
    togglePairingBtn?.addEventListener('click', () => {
        const isOpen = togglePairingDrawer();
        if (isOpen) {
            startPairingFlow();
        } else {
            stopAndCancelPairing();
        }
    });

    const refreshPairingBtn = document.getElementById('account-btn-refresh-pairing');
    refreshPairingBtn?.addEventListener('click', startPairingFlow);

    const closePairingBtn = document.getElementById('account-btn-close-pairing');
    closePairingBtn?.addEventListener('click', () => {
        togglePairingDrawer(false);
        stopAndCancelPairing();
        const refreshBtn = document.getElementById('account-btn-refresh-pairing');
        if (refreshBtn) refreshBtn.classList.remove('is-hidden');
        closePairingBtn?.classList.add('is-hidden');
    });

    if (isAuthenticated()) {
        loadAndRenderSessions();
    }

    if (!isSessionsModuleInitialized) {
        isSessionsModuleInitialized = true;
        document.addEventListener('auth:state-change', () => {
            if (isAuthenticated()) {
                loadAndRenderSessions();
            } else {
                stopPairingTimers();
                setPairingQROverlay({ type: 'hidden' });
            }
        });
    }
}
