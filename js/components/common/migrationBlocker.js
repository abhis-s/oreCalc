import { STORAGE_KEYS } from '../../core/constants.js';
import { generateUUID } from '../../utils/uuidGenerator.js';
import { buildClashCalcTargetUrl } from '../../utils/clashCalcUrl.js';
import { translate } from '../../i18n/translator.js';

/**
 * Wipes on-device local and session storage, generates a brand new guest UUID,
 * and reloads the clean pathname without legacy query parameters.
 */
export function resetAndSwitchGuestUser() {
    try {
        localStorage.clear();
    } catch (_) {
        // Storage access fallback
    }

    try {
        sessionStorage.clear();
    } catch (_) {
        // Session storage fallback
    }

    const newGuestUserId = generateUUID();
    try {
        localStorage.setItem(STORAGE_KEYS.USER_ID, newGuestUserId);
    } catch (_) {
        // Storage write fallback
    }

    // Direct assignment to clean pathname strips query strings carrying old migrated IDs
    window.location.href = window.location.pathname;
}

/**
 * Displays the un-dismissable migration blocking modal dialog.
 * Configures the target ClashCalc URL and binds the guest reset action.
 *
 * @param {Object} [options={}] - Configuration options.
 * @param {string|null} [options.userId=null] - Overriding user ID.
 * @param {string|null} [options.tag=null] - Overriding player tag.
 * @returns {HTMLDialogElement|null} The displayed modal dialog element.
 */
export function showMigrationBlockerModal(options = {}) {
    if (typeof document === 'undefined') return null;

    const modal = /** @type {HTMLDialogElement|null} */ (document.getElementById('migrated-blocker-modal'));
    if (!modal) return null;

    let targetUserId = options.userId || null;
    if (!targetUserId) {
        try {
            targetUserId = localStorage.getItem(STORAGE_KEYS.MIGRATED_USER_ID) ||
                           localStorage.getItem(STORAGE_KEYS.USER_ID) ||
                           null;
        } catch (_) {
            targetUserId = null;
        }
    }

    const ctaUrl = buildClashCalcTargetUrl({
        currentPath: window.location.pathname,
        currentSearch: window.location.search,
        userId: targetUserId,
        activePlayerTag: options.tag || null
    });

    const ctaBtn = /** @type {HTMLAnchorElement|null} */ (modal.querySelector('#migrated-blocker-cta-btn'));
    if (ctaBtn) {
        ctaBtn.href = ctaUrl;
        if (!ctaBtn.__boundSpaceAction) {
            ctaBtn.__boundSpaceAction = true;
            ctaBtn.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    ctaBtn.click();
                }
            });
        }
    }

    const resetBtn = /** @type {HTMLButtonElement|null} */ (modal.querySelector('#migrated-blocker-reset-btn'));
    if (resetBtn && !resetBtn.__boundResetAction) {
        resetBtn.__boundResetAction = true;
        resetBtn.addEventListener('click', () => {
            resetAndSwitchGuestUser();
        });
    }

    modal.addEventListener('cancel', (e) => {
        e.preventDefault();
    });

    const titleEl = modal.querySelector('#migrated-blocker-title');
    if (titleEl && !titleEl.textContent) {
        titleEl.textContent = translate('views.migrationBlocker.title');
    }
    const descEl = modal.querySelector('#migrated-blocker-desc');
    if (descEl && !descEl.textContent) {
        descEl.textContent = translate('views.migrationBlocker.description');
    }
    const resetTextEl = modal.querySelector('#migrated-blocker-reset-btn');
    if (resetTextEl && !resetTextEl.textContent) {
        resetTextEl.textContent = translate('views.migrationBlocker.resetAction');
    }
    const noticeEl = modal.querySelector('#migrated-blocker-notice');
    if (noticeEl && !noticeEl.textContent) {
        noticeEl.textContent = translate('views.migrationBlocker.infoNotice');
    }
    const ctaTextEl = modal.querySelector('#migrated-blocker-cta-btn');
    if (ctaTextEl && !ctaTextEl.textContent) {
        ctaTextEl.textContent = translate('views.migrationBlocker.cta');
    }

    modal.classList?.add('show');

    if (!modal.open) {
        try {
            modal.showModal();
        } catch (_) {
            modal.setAttribute('open', '');
        }
    }

    try {
        ctaBtn?.focus();
    } catch (_) {
        // Focus fallback
    }

    return modal;
}
