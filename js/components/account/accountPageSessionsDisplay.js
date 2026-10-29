/**
 * Account Page Sessions & Mobile Pairing Display Controller.
 * Manages active sessions list rendering, session revocation UI, and QR pairing drawers.
 * Tier 4: Account Sub-Panel Display Module.
 */

import { getActiveUserId } from '../../core/storageKeys.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';
import { formatDate, getDefaultDateLocale } from '../../utils/dateUtils.js';
import { renderSyncQRCode } from '../../utils/qrCodeHelper.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { setAnimatedButtonContent } from './accountDisplayUtils.js';

const NEW_SESSION_AGE_LIMIT_MS = 10 * 60 * 1000;

/**
 * Toggles the cross-device pairing drawer.
 *
 * @param {boolean} [forceState] - Explicit open/closed state.
 * @returns {boolean} Current open state after toggle.
 */
export function togglePairingDrawer(forceState) {
    const drawer = document.getElementById('account-pairing-drawer');
    const toggleBtn = document.getElementById('account-btn-toggle-pairing');
    if (!drawer) return false;

    const isOpen = forceState !== undefined ? forceState : drawer.hasAttribute('hidden');
    const key = isOpen ? 'actions.dismiss' : 'actions.link';
    const icon = isOpen ? 'close' : 'link';

    if (isOpen) {
        drawer.removeAttribute('hidden');
        drawer.setAttribute('aria-expanded', 'true');
    } else {
        drawer.setAttribute('hidden', '');
        drawer.setAttribute('aria-expanded', 'false');
    }
    if (toggleBtn) {
        toggleBtn.setAttribute('data-i18n', key);
        setAnimatedButtonContent(toggleBtn, translate(key) || (isOpen ? 'Dismiss' : 'Link'), icon);
    }
    return isOpen;
}

/**
 * Toggles the guest in-card mobile device pairing drawer.
 *
 * @param {boolean} [forceState] - Explicit open/closed state.
 * @returns {boolean} Current open state after toggle.
 */
export function toggleGuestPairingDrawer(forceState) {
    const drawer = document.getElementById('account-guest-pairing-drawer');
    const toggleBtn = document.getElementById('account-guest-btn-toggle-pairing');
    if (!drawer) return false;

    const isOpen = forceState !== undefined ? forceState : drawer.hasAttribute('hidden');
    const key = isOpen ? 'actions.dismiss' : 'actions.link';
    const icon = isOpen ? 'close' : 'link';

    if (isOpen) {
        drawer.removeAttribute('hidden');
        drawer.setAttribute('aria-expanded', 'true');
    } else {
        drawer.setAttribute('hidden', '');
        drawer.setAttribute('aria-expanded', 'false');
    }
    if (toggleBtn) {
        toggleBtn.setAttribute('data-i18n', key);
        setAnimatedButtonContent(toggleBtn, translate(key) || (isOpen ? 'Dismiss' : 'Link'), icon);
    }
    return isOpen;
}

/**
 * Activates the specified tab in the guest pairing drawer.
 *
 * @param {'qr' | 'input'} tab - Target tab to activate ('qr' for Your Sync Code, 'input' for Enter Sync Code).
 */
export function setGuestPairingActiveTab(tab) {
    const tabQr = document.getElementById('account-guest-tab-qr');
    const tabInput = document.getElementById('account-guest-tab-input');
    const paneQr = document.getElementById('account-guest-pane-qr');
    const paneInput = document.getElementById('account-guest-pane-input');

    const isQr = tab === 'qr';
    if (tabQr) {
        tabQr.classList.toggle('active', isQr);
        tabQr.classList.toggle('is-active', isQr);
        tabQr.setAttribute('aria-selected', String(isQr));
    }
    if (tabInput) {
        tabInput.classList.toggle('active', !isQr);
        tabInput.classList.toggle('is-active', !isQr);
        tabInput.setAttribute('aria-selected', String(!isQr));
    }
    if (paneQr) {
        if (isQr) {
            paneQr.removeAttribute('hidden');
            paneQr.classList.remove('is-hidden');
        } else {
            paneQr.setAttribute('hidden', '');
            paneQr.classList.add('is-hidden');
        }
    }
    if (paneInput) {
        if (!isQr) {
            paneInput.removeAttribute('hidden');
            paneInput.classList.remove('is-hidden');
        } else {
            paneInput.setAttribute('hidden', '');
            paneInput.classList.add('is-hidden');
        }
    }
}

/**
 * Renders the state-aware content for the guest mobile device pairing card.
 *
 * @param {boolean} hasRealPlayer - Whether a non-default player profile exists on this device.
 */
export function renderAccountGuestPairingCard(hasRealPlayer) {
    const codeContainer = document.getElementById('account-guest-code-container');
    const instruction = document.getElementById('account-guest-sync-instruction');
    const hintSubcard = document.getElementById('account-guest-hint-subcard');
    const qrCanvas = document.getElementById('account-guest-qr-canvas');
    const overlay = document.getElementById('account-guest-qr-overlay');
    const userIdDisplay = document.getElementById('account-guest-user-id');

    const userId = getActiveUserId(true);
    if (userId && userIdDisplay) {
        userIdDisplay.textContent = userId;
        if (userIdDisplay.dataset) {
            userIdDisplay.dataset.fullId = userId;
        }
        userIdDisplay.setAttribute('data-full-id', userId);
    }

    if (qrCanvas && userId) {
        renderSyncQRCode(qrCanvas, userId, 200);
    }

    if (hasRealPlayer) {
        codeContainer?.classList.remove('is-hidden');
        if (instruction) instruction.hidden = false;
        hintSubcard?.classList.add('is-hidden');
        qrCanvas?.classList.remove('is-blurred');
        overlay?.classList.add('is-hidden');
    } else {
        codeContainer?.classList.add('is-hidden');
        if (instruction) instruction.hidden = true;
        hintSubcard?.classList.remove('is-hidden');
        qrCanvas?.classList.add('is-blurred');
        overlay?.classList.remove('is-hidden');
    }
}

/**
 * Sets the QR code overlay state (expired, success, or hidden).
 *
 * @param {{ type: 'expired' | 'success' | 'hidden', title?: string, desc?: string }} options
 */
export function setPairingQROverlay({ type, title = '', desc = '' }) {
    const canvasWrap = document.getElementById('account-pairing-qr-canvas');
    const overlay = document.getElementById('account-pairing-qr-overlay');
    const titleEl = document.getElementById('account-pairing-qr-overlay-title');
    const descEl = document.getElementById('account-pairing-qr-overlay-desc');
    const iconEl = overlay?.querySelector('.account-pairing-qr-overlay__icon clashcalc-assets-svg');

    if (!overlay || !canvasWrap) return;

    if (type === 'hidden') {
        canvasWrap.classList.remove('is-blurred');
        overlay.classList.add('is-hidden');
        overlay.classList.remove('account-pairing-qr-overlay--expired', 'account-pairing-qr-overlay--success');
        return;
    }

    canvasWrap.classList.add('is-blurred');
    overlay.classList.remove('is-hidden');
    overlay.classList.toggle('account-pairing-qr-overlay--expired', type === 'expired');
    overlay.classList.toggle('account-pairing-qr-overlay--success', type === 'success');

    if (iconEl) {
        iconEl.setAttribute('name', type === 'success' ? 'check-circle-filled' : 'timer');
    }

    if (titleEl) {
        titleEl.textContent = title;
    }
    if (descEl) {
        descEl.textContent = desc;
    }
}

/**
 * Updates the pairing code expiration countdown timer display.
 *
 * @param {number} remainingSeconds - Remaining seconds until token expiration.
 * @param {'normal' | 'expired' | 'claimed'} [state='normal'] - Timer display state.
 */
export function updatePairingTimer(remainingSeconds, state = 'normal') {
    const timerRow = document.querySelector('.account-pairing-timer-row');
    const timerEl = document.getElementById('account-pairing-timer');
    if (!timerEl) return;

    if (timerRow) {
        timerRow.classList.toggle('is-expired', state === 'expired');
        timerRow.classList.toggle('is-success', state === 'claimed');
    }

    const iconEl = timerRow?.querySelector('clashcalc-assets-svg');

    if (state === 'claimed') {
        timerEl.textContent = translate('auth.deviceLinkedSuccess') || 'Device linked successfully';
        if (iconEl) {
            iconEl.setAttribute('name', 'check');
        }
        return;
    }

    if (state === 'expired' || remainingSeconds <= 0) {
        const timeFormatted = '0:00';
        timerEl.textContent = translate('auth.pairingCodeExpires', { time: timeFormatted }) || `Pairing code expires in ${timeFormatted}`;
        if (iconEl) {
            iconEl.setAttribute('name', 'timer');
        }
        return;
    }

    if (iconEl) {
        iconEl.setAttribute('name', 'timer');
    }

    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    timerEl.textContent = translate('auth.pairingCodeExpires', { time: timeFormatted }) || `Pairing code expires in ${timeFormatted}`;
}

/**
 * Resolves appropriate SVG icon name based on client device platform.
 *
 * @param {string} [platform] - Client device platform name.
 * @returns {string} Icon identifier in partials/svg-sprites.html.
 */
function getDeviceIconName(platform) {
    const p = (platform || '').toLowerCase();
    if (p.includes('ios') || p.includes('android') || p.includes('mobile') || p.includes('phone')) {
        return 'phone';
    }
    if (p.includes('mac') || p.includes('win') || p.includes('linux') || p.includes('chrome')) {
        return 'laptop';
    }
    return 'devices';
}

/**
 * Renders the active device sessions list.
 *
 * @param {Array<{ sessionId: string, platform: string, browser: string, createdAt: number, lastActiveAt: number, isCurrent: boolean }>} sessions
 * @param {string|null} [newlyPairedSessionId=null] - Session ID of newly linked device to highlight.
 */
export function renderActiveSessionsList(sessions, newlyPairedSessionId = null) {
    const listEl = document.getElementById('account-sessions-list');
    const revokeOtherBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('account-btn-revoke-other-sessions'));
    if (!listEl) return;

    const safeSessions = Array.isArray(sessions) ? sessions : [];
    const currentLang = getLanguageFromPath() || state.uiSettings?.language || getDefaultDateLocale() || 'en';

    const otherSessionsCount = safeSessions.filter(s => !s.isCurrent).length;
    if (revokeOtherBtn) {
        if (otherSessionsCount === 0) {
            revokeOtherBtn.classList.add('is-hidden');
            revokeOtherBtn.setAttribute('hidden', '');
        } else {
            revokeOtherBtn.classList.remove('is-hidden');
            revokeOtherBtn.removeAttribute('hidden');
            revokeOtherBtn.disabled = false;
        }
    }

    const titleEl = document.getElementById('account-sessions-title') || document.querySelector('#account-sessions-card .account-card__title');
    if (titleEl) {
        const baseTitle = translate('views.account.sessions') || 'Active Sessions';
        titleEl.textContent = safeSessions.length >= 2 ? `${baseTitle} (${safeSessions.length})` : baseTitle;
    }

    if (safeSessions.length === 0) {
        listEl.innerHTML = '';
        return;
    }

    listEl.innerHTML = safeSessions.map((sess) => {
        const safePlatform = escapeHTML(sess.platform || 'Other');
        const safeBrowser = escapeHTML(sess.browser || 'Browser');
        const safeId = escapeHTML(sess.sessionId);
        const deviceTitle = `${safeBrowser} on ${safePlatform}`;
        const deviceIcon = getDeviceIconName(sess.platform);
        const isNewlyPaired = Boolean(
            newlyPairedSessionId &&
            sess.sessionId === newlyPairedSessionId &&
            (Date.now() - (sess.createdAt || 0) < NEW_SESSION_AGE_LIMIT_MS)
        );

        let activeMeta = '';
        if (sess.isCurrent) {
            activeMeta = translate('views.account.currentDevice') || 'This Device';
        } else if (sess.lastActiveAt) {
            const date = new Date(sess.lastActiveAt);
            const isCurrentYear = date.getFullYear() === new Date().getFullYear();
            const formatted = formatDate(date, {
                month: 'short',
                day: 'numeric',
                ...(isCurrentYear ? {} : { year: 'numeric' }),
                hour: '2-digit',
                minute: '2-digit'
            }, currentLang);
            activeMeta = translate('views.account.lastActive', { time: formatted }) || `Last active: ${formatted}`;
        }

        let badgeHtml = '';
        if (isNewlyPaired) {
            badgeHtml = `<span class="account-badge account-badge--new" data-i18n="auth.newBadge">${escapeHTML(translate('auth.newBadge') || 'New')}</span>`;
        }

        const actionHtml = sess.isCurrent
            ? ''
            : `<button type="button" class="btn btn-secondary account-session-revoke-btn" data-session-id="${safeId}" data-i18n="actions.remove">${escapeHTML(translate('actions.remove'))}</button>`;

        const itemClasses = [
            'account-session-item',
            sess.isCurrent ? 'account-session-item--current' : '',
            isNewlyPaired ? 'account-session-item--new' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${itemClasses}" data-session-id="${safeId}">
                <div class="account-session-item__main">
                    <div class="account-item-icon-box">
                        <clashcalc-assets-svg name="${deviceIcon}" width="20" height="20"></clashcalc-assets-svg>
                    </div>
                    <div class="account-session-item__info">
                        <div class="account-session-item__title-row">
                            <span class="account-session-item__title">${escapeHTML(deviceTitle)}</span>
                            ${badgeHtml}
                        </div>
                        <span class="account-session-item__meta">${escapeHTML(activeMeta)}</span>
                    </div>
                </div>
                <div class="account-session-item__actions">
                    ${actionHtml}
                </div>
            </div>
        `;
    }).join('');
}
