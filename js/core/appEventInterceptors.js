import { translate } from '../i18n/translator.js';

import { EFFECTIVE_DATE_PRIVACY, EFFECTIVE_DATE_TERMS, state } from './state.js';

import { logger } from '../utils/logger.js';
import { closeModalAnimated } from '../utils/modalHistoryManager.js';

import { showChangelogModal } from '../components/changelog/changelogModal.js';
import { showCommitsModal } from '../components/changelog/commitsModal.js';
import { showAlert, showConfirm } from '../ui/noticeModal.js';

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
        logger.error('Uncaught error:', event.error || event.message);
        if (handleDynamicImportError(event.error || event.message)) return;
        if (!window.__APP_LOADED_STATUS__) return;
        showAlert(translate('errors.unexpectedError'), 'errors.errorTitle');
    });

    window.addEventListener('unhandledrejection', (event) => {
        logger.error('Unhandled promise rejection:', event.reason);
        if (handleDynamicImportError(event.reason)) return;
        if (!window.__APP_LOADED_STATUS__) return;
        showAlert(translate('errors.unexpectedError'), 'errors.errorTitle');
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
    const welcomeModal = document.getElementById('welcome-modal');
    if (welcomeModal && welcomeModal.classList.contains('show')) {
        return true;
    }
    const consentBanner = document.getElementById('consent-banner');
    if (consentBanner && consentBanner.classList.contains('show')) {
        return true;
    }
    const consentModal = document.getElementById('consent-modal');
    if (consentModal && consentModal.classList.contains('show')) {
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
        sessionStorage.removeItem('oreCalc_showChangelog');
        sessionStorage.removeItem('oreCalc_showChangelogFromVersion');
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

            if (target.id === 'welcome-modal') {
                return;
            }
            if (target.id === 'overlay' && openModals.some(m => m.id === 'welcome-modal')) {
                return;
            }

            let closingConsentModal = false;

            if (target.id === 'consent-modal') {
                closingConsentModal = true;
            } else if (target.id === 'overlay') {
                closingConsentModal = openModals.some(m => m.id === 'consent-modal');
            }

            if (target.classList.contains('modal') || target.tagName === 'DIALOG') {
                closeModalAnimated(target);
            } else if (target.id === 'overlay') {
                openModals.forEach(m => closeModalAnimated(m));
            }

            if (closingConsentModal) {
                const consentBanner = document.getElementById('consent-banner');
                if (consentBanner) {
                    const privacyTimestamp = state.uiSettings?.uiTimestamps?.privacy;
                    const tosTimestamp = state.uiSettings?.uiTimestamps?.tos;
                    const needsConsent = !privacyTimestamp ||
                        privacyTimestamp < EFFECTIVE_DATE_PRIVACY ||
                        !tosTimestamp ||
                        tosTimestamp < EFFECTIVE_DATE_TERMS;
                    if (needsConsent) {
                        consentBanner.classList.add('show');
                    }
                }
            }
        }
    });

    document.addEventListener('keydown', async (event) => {
        if (event.key === 'Escape' || event.key === 'Esc') {
            const activeModal = document.querySelector('.modal.show:not(#welcome-modal), dialog.modal[open]:not(#welcome-modal)');
            if (activeModal && !activeModal.classList.contains('closing')) {
                closeModalAnimated(activeModal);
                return;
            }

            const drawer = document.querySelector('.navigation-drawer, #navigation-drawer, #nav-drawer');
            if (drawer && (drawer.classList.contains('open') || /** @type {HTMLDialogElement} */ (drawer).open || (typeof drawer.hasAttribute === 'function' && drawer.hasAttribute('open')))) {
                const hamburger = /** @type {HTMLElement|null} */ (document.querySelector('.hamburger'));
                if (hamburger) {
                    hamburger.click();
                    hamburger.focus();
                } else {
                    const { closeNavigationDrawer } = await import('../components/layout/navigation.js');
                    closeNavigationDrawer();
                }
                return;
            }

            const mainFab = document.getElementById('main-fab');
            if (mainFab && mainFab.classList.contains('active')) {
                const { closeFabMenu } = await import('../components/fab/fab.js');
                closeFabMenu();
                mainFab.focus();
            }
        }
    });

    document.body.addEventListener('click', async (e) => {
        const link = /** @type {HTMLElement} */ (e.target).closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        if (href.startsWith('#') || href.startsWith('javascript:')) return;

        const isMailto = href.startsWith('mailto:');
        if (isMailto) {
            e.preventDefault();
            const confirmed = await showConfirm(translate('confirms.mailtoLink'));
            if (confirmed) {
                window.location.href = href;
            }
            return;
        }

        const isHttpExternal = (href.startsWith('http://') || href.startsWith('https://')) && !href.includes(window.location.host);

        if (isHttpExternal) {
            e.preventDefault();
            const confirmed = await showConfirm(
                `${translate('confirms.externalLink')}<br><code class="external-link-display">${href}</code><br><br>${translate('confirms.externalLinkConfirm')}`
            );
            if (confirmed) {
                window.open(href, '_blank', 'noopener,noreferrer');
            }
        }
    });
}
