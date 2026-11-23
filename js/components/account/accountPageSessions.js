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
    revokeSession,
    validateAndRenewSession
} from '../../services/authSessionClientService.js';
import { translate } from '../../i18n/translator.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { showToast } from '../../ui/toast.js';
import { logger } from '../../utils/logger.js';
import { renderPairingQRCode } from '../../utils/qrCodeHelper.js';
import {
    renderActiveSessionsList,
    setPairingQRLoading,
    setPairingQROverlay,
    togglePairingDrawer,
    updatePairingTimer
} from './accountPageSessionsDisplay.js';

const DEFAULT_VISIBLE_SESSIONS = 5;

/** @type {any} */
let pairingTimerInterval = null;
/** @type {any} */
let pairingStatusPollInterval = null;
let remainingPairingSeconds = 0;
/** @type {string|null} */
let newlyPairedSessionId = null;
/** @type {string|null} */
let currentActivePairingToken = null;
let pairingFlowGeneration = 0;
/** @type {Array<{ sessionId: string, platform: string, browser: string, createdAt: number, lastActiveAt: number, isCurrent: boolean }>} */
let cachedSessions = [];
let isSessionsListExpanded = false;
let isSessionsModuleInitialized = false;

/**
 * Loads the user's active sessions from the server and renders them.
 */
export async function loadAndRenderSessions() {
    if (!isAuthenticated()) return;
    try {
        const sessions = await fetchSessions();
        cachedSessions = sessions;
        if (sessions.length <= DEFAULT_VISIBLE_SESSIONS) {
            isSessionsListExpanded = false;
        }
        renderActiveSessionsList(cachedSessions, newlyPairedSessionId, isSessionsListExpanded);
    } catch (err) {
        logger.warn('[Sessions] Failed to fetch sessions:', err);
        if (err?.message === 'sessionRevoked' || err?.message === 'unauthenticated') {
            await validateAndRenewSession({ force: true });
        }
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
    pairingFlowGeneration += 1;
    stopPairingTimers();
    setPairingQRLoading(false);

    const refreshBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('account-btn-refresh-pairing'));
    if (refreshBtn) refreshBtn.disabled = false;

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
 * @param {{ deviceName?: string, sessionId?: string, alreadyLinked?: boolean }} claimData
 */
async function handlePairingClaimed(claimData) {
    stopPairingTimers();
    setPairingQRLoading(false);
    currentActivePairingToken = null;
    const refreshBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('account-btn-refresh-pairing'));
    const closeBtn = document.getElementById('account-btn-close-pairing');

    if (claimData.alreadyLinked) {
        setPairingQROverlay({
            type: 'success',
            title: translate('auth.deviceAlreadyLinkedTitle') || 'Already Linked',
            desc: claimData.deviceName || translate('auth.deviceAlreadyLinked') || 'This device is already linked to your account.'
        });
        updatePairingTimer(0, 'alreadyLinked');

        if (refreshBtn) {
            refreshBtn.classList.remove('is-hidden');
            refreshBtn.disabled = false;
        }
        if (closeBtn) closeBtn.classList.remove('is-hidden');

        await loadAndRenderSessions();
        return;
    }

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
    setPairingQRLoading(false);
    currentActivePairingToken = null;
    const refreshBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('account-btn-refresh-pairing'));
    if (refreshBtn) refreshBtn.disabled = false;
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
    const flowId = ++pairingFlowGeneration;
    stopPairingTimers();
    if (currentActivePairingToken) {
        const tokenToCancel = currentActivePairingToken;
        currentActivePairingToken = null;
        cancelPairingToken(tokenToCancel).catch(() => {});
    }

    setPairingQROverlay({ type: 'hidden' });
    setPairingQRLoading(true);
    updatePairingTimer(0, 'loading');

    const refreshBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('account-btn-refresh-pairing'));
    const closeBtn = document.getElementById('account-btn-close-pairing');
    if (refreshBtn) {
        refreshBtn.classList.remove('is-hidden');
        refreshBtn.disabled = true;
    }
    if (closeBtn) closeBtn.classList.add('is-hidden');

    const qrContainer = document.getElementById('account-pairing-qr-canvas');
    if (qrContainer) {
        qrContainer.innerHTML = '';
        qrContainer.removeAttribute('data-token');
    }

    try {
        const data = await createPairingToken();
        const activeToken = data.pairingToken;
        if (flowId !== pairingFlowGeneration) {
            cancelPairingToken(activeToken).catch(() => {});
            return;
        }

        currentActivePairingToken = activeToken;
        remainingPairingSeconds = data.expiresIn || 90;

        let qrInstance = null;
        if (qrContainer) {
            qrContainer.setAttribute('data-token', activeToken);
            qrInstance = renderPairingQRCode(qrContainer, activeToken, 200);
        }

        const drawPromise = qrInstance?._canvasDrawingPromise || qrInstance?._svgDrawingPromise;
        if (drawPromise && typeof drawPromise.then === 'function') {
            await drawPromise.catch(() => {});
        }

        if (flowId !== pairingFlowGeneration) {
            if (currentActivePairingToken === activeToken) {
                currentActivePairingToken = null;
                cancelPairingToken(activeToken).catch(() => {});
            }
            return;
        }

        setPairingQRLoading(false);
        if (refreshBtn) refreshBtn.disabled = false;
        updatePairingTimer(remainingPairingSeconds, 'normal');

        pairingTimerInterval = setInterval(async () => {
            if (flowId !== pairingFlowGeneration) {
                stopPairingTimers();
                return;
            }
            remainingPairingSeconds -= 1;
            if (remainingPairingSeconds <= 0) {
                stopPairingTimers();
                currentActivePairingToken = null;

                // Final status check safeguard: inspect whether the token was claimed right at the cutoff
                try {
                    const finalStatus = await fetchPairingStatus(activeToken);
                    if (flowId !== pairingFlowGeneration) return;
                    if (finalStatus.status === 'claimed') {
                        await handlePairingClaimed(finalStatus);
                        return;
                    }
                } catch (err) {
                    logger.warn('[Pairing] Final status check failed:', err);
                }

                if (flowId === pairingFlowGeneration) {
                    handlePairingExpired();
                }
            } else {
                updatePairingTimer(remainingPairingSeconds, 'normal');
            }
        }, 1000);

        pairingStatusPollInterval = setInterval(async () => {
            if (flowId !== pairingFlowGeneration) {
                stopPairingTimers();
                return;
            }
            try {
                const statusRes = await fetchPairingStatus(activeToken);
                if (flowId !== pairingFlowGeneration) return;
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
        if (flowId !== pairingFlowGeneration) return;
        logger.error('[Pairing] Create token failed:', err);
        currentActivePairingToken = null;
        setPairingQRLoading(false);
        if (refreshBtn) refreshBtn.disabled = false;
        if (qrContainer) {
            qrContainer.innerHTML = '';
            qrContainer.removeAttribute('data-token');
        }
        updatePairingTimer(0, 'expired');
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
        const result = await claimPairingToken(pairToken);
        if (result?.alreadyLinked) {
            showToast(translate('auth.deviceAlreadyLinked') || 'This device is already linked to your account.', 'info');
        } else {
            showToast(translate('auth.devicePairedSuccess'), 'success');
        }
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

    const expandSessionsBtn = document.getElementById('account-btn-toggle-sessions-expand');
    expandSessionsBtn?.addEventListener('click', () => {
        isSessionsListExpanded = !isSessionsListExpanded;
        renderActiveSessionsList(cachedSessions, newlyPairedSessionId, isSessionsListExpanded);
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
        const refreshBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('account-btn-refresh-pairing'));
        if (refreshBtn) {
            refreshBtn.classList.remove('is-hidden');
            refreshBtn.disabled = false;
        }
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
                pairingFlowGeneration += 1;
                currentActivePairingToken = null;
                cachedSessions = [];
                isSessionsListExpanded = false;
                stopPairingTimers();
                setPairingQRLoading(false);
                setPairingQROverlay({ type: 'hidden' });
            }
        });
    }
}
