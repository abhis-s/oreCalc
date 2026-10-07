import { translate } from '../i18n/translator.js';

import { logger } from '../utils/logger.js';
import { closeModalAnimated } from '../utils/modalHistoryManager.js';

import { showChangelogModal } from '../components/changelog/changelogModal.js';
import { showCommitsModal } from '../components/changelog/commitsModal.js';
import { showAlert } from '../ui/noticeModal.js';
import { showToast } from '../ui/toast.js';
import { initExternalLinkCatcher } from '../components/common/externalLinkCatcher.js';
import '../services/hapticService.js';

/**
 * Handles module dynamic chunk loading errors with self-healing reload.
 * @param {any} err
 * @returns {boolean}
 */
function handleDynamicImportError(err) {
    const errorMsg = String(err?.message || err?.reason?.message || err?.reason || err || '');
    if (errorMsg.includes('dynamically imported module') || errorMsg.includes('Importing a module script failed')) {
        logger.warn('Dynamic import chunk missing due to app update. Triggering self-healing reload...');
        if (!sessionStorage.getItem('orecalc_module_reload_triggered')) {
            sessionStorage.setItem('orecalc_module_reload_triggered', 'true');
            window.location.reload();
            return true;
        }
    }
    return false;
}

/**
 * Returns true for errors originating from browser-injected scripts (crypto wallets,
 * content scripts, browser extensions) rather than the app codebase.
 * Detection is purely structural — no message content scanning.
 *
 * @param {ErrorEvent | PromiseRejectionEvent} event
 * @returns {boolean}
 */
function isInjectedScriptError(event) {
    // "Script error." is the browser's sanitized form of any cross-origin script error.
    // It always indicates an external script — never app bundle code.
    const msg = String(
        /** @type {ErrorEvent} */ (event).message ||
        /** @type {PromiseRejectionEvent} */ (event).reason?.message ||
        /** @type {PromiseRejectionEvent} */ (event).reason ||
        ''
    );
    if (msg === 'Script error.' || msg === 'Script error') return true;

    // For ErrorEvent only — PromiseRejectionEvent has no filename/lineno.
    if (event instanceof ErrorEvent) {
        const src = event.filename || '';

        // Browser extension scripts (Chrome, Firefox, Safari)
        if (/^(chrome|moz|safari|webkit)-extension:\/\//i.test(src)) return true;

        // No source file — injected anonymous/inline code. App bundles always have a filename.
        if (!src) return true;

        // Line 1 of the page document itself — browser-injected code (crypto wallets,
        // native app bridges, __gCrWeb, etc.) runs at document scope with the page URL as filename.
        // App bundles are always loaded as separate JS files and never fire from line 1 of the page.
        if (event.lineno === 1 && (src === window.location.href || src === window.location.origin + '/')) return true;
    }

    return false;
}

/**
 * Registers window error and unhandled rejection event boundaries.
 */
export function registerGlobalErrorBoundaries() {
    if (window.__APP_INITIALIZED__) return;
    window.__APP_INITIALIZED__ = true;
    window.isAppStartingUp = true;

    try {
        sessionStorage.removeItem('orecalc_module_reload_triggered');
    } catch (_) {}

    window.addEventListener('error', (event) => {
        if (isInjectedScriptError(event)) return;
        logger.error('Uncaught error:', event.error || event.message);
        if (handleDynamicImportError(event.error || event.message)) return;
        if (!window.__APP_LOADED_STATUS__) return;
        showAlert(translate('errors.unexpectedError'), 'status.error');
    });

    window.addEventListener('unhandledrejection', (event) => {
        if (isInjectedScriptError(event)) return;
        logger.error('Unhandled promise rejection:', event.reason);
        if (handleDynamicImportError(event.reason)) return;
        if (!window.__APP_LOADED_STATUS__) return;
        showAlert(translate('errors.unexpectedError'), 'status.error');
    });
}

/**
 * Checks if dialog interruptions should be suppressed.
 * @returns {boolean}
 */
export function isInterruptionRestricted() {
    if (window.isAppStartingUp) {
        return true;
    }
    const guidedSetupModal = document.getElementById('guided-setup-modal');
    if (guidedSetupModal && (guidedSetupModal.classList.contains('show') || /** @type {HTMLDialogElement} */ (guidedSetupModal).open)) {
        return true;
    }
    const tourTooltip = document.querySelector('.tour-tooltip');
    if (tourTooltip && /** @type {HTMLElement} */ (tourTooltip).style.display !== 'none' && /** @type {HTMLElement} */ (tourTooltip).style.opacity !== '0') {
        return true;
    }
    if (window.isTourPending || window.isTourRunning) {
        return true;
    }
    return false;
}

/**
 * Displays queued changelog or commit modals once interruptions are allowed.
 */
export function triggerPendingModals() {
    if (isInterruptionRestricted()) {
        return;
    }
    if (window.pendingChangelogContent) {
        const content = window.pendingChangelogContent;
        window.pendingChangelogContent = null;
        showChangelogModal(content);
    } else if (window.pendingCommits) {
        const commits = window.pendingCommits;
        window.pendingCommits = null;
        showCommitsModal(commits);
    }
}

/**
 * Attaches global modal backdrop dismissals, Escape key handler, and external link confirmations.
 */
export function initializeGlobalInterceptors() {
    document.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        if (target.closest('#close-update-modal-btn')) {
            const modal = document.getElementById('update-available-modal');
            if (modal) {
                closeModalAnimated(modal);
            }
            return;
        }

        if (target.classList.contains('modal') || target.id === 'overlay' || (target.tagName === 'DIALOG' && target.classList.contains('modal'))) {
            const openModals = Array.from(document.querySelectorAll('.modal.show, dialog.modal[open]'));

            if (target.id === 'guided-setup-modal') {
                return;
            }
            if (target.id === 'overlay' && openModals.some(m => m.id === 'guided-setup-modal')) {
                return;
            }

            if (target.classList.contains('modal') || target.tagName === 'DIALOG') {
                closeModalAnimated(target);
            } else if (target.id === 'overlay') {
                openModals.forEach(m => closeModalAnimated(m));
            }
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
            const activeModal = document.querySelector('.modal.show:not(#guided-setup-modal), dialog.modal[open]:not(#guided-setup-modal)');
            if (activeModal && !activeModal.classList.contains('closing')) {
                closeModalAnimated(activeModal);
                return;
            }

            const drawer = document.querySelector('.navigation-drawer, #navigation-drawer, #nav-drawer');
            if (drawer && (drawer.classList.contains('open') || /** @type {HTMLDialogElement} */ (drawer).open || (typeof drawer.hasAttribute === 'function' && drawer.hasAttribute('open')))) {
                const hamburger = /** @type {HTMLElement|null} */ (document.querySelector('.hamburger, [data-drawer-trigger], .app-header__hamburger'));
                if (hamburger) {
                    hamburger.click();
                    hamburger.focus();
                } else {
                    const closeBtn = drawer.querySelector('.drawer-close, [data-action="close"], .navigation-drawer__close');
                    if (closeBtn) {
                        /** @type {HTMLElement} */ (closeBtn).click();
                    } else {
                        drawer.classList.remove('open');
                        const overlay = document.querySelector('.drawer-overlay, #drawer-overlay, .navigation-drawer__overlay');
                        if (overlay) overlay.classList.remove('show');
                        document.body?.classList.remove('open-drawer');
                        if (typeof /** @type {HTMLDialogElement} */ (drawer).close === 'function' && /** @type {HTMLDialogElement} */ (drawer).open) {
                            try { /** @type {HTMLDialogElement} */ (drawer).close(); } catch (e) {}
                        }
                    }
                }
                return;
            }

            const mainFab = document.getElementById('main-fab');
            if (mainFab && mainFab.classList.contains('active')) {
                mainFab.click();
                mainFab.focus();
            }
        }
    });

    document.addEventListener('input-validation-message', (event) => {
        const customEvent = /** @type {CustomEvent} */ (event);
        const { message, type } = customEvent.detail || {};
        if (message) {
            showToast(message, type || 'warning');
        }
    });

    initExternalLinkCatcher(document.body);
}
