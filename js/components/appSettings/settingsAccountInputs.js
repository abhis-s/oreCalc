/**
 * Interaction bindings for Header Account Button, Modular Account Popover, and Account Modals.
 * Tier 4: Interaction Engine.
 */

import { translate } from '../../i18n/translator.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { getAuthenticatedUser, logout } from '../../services/authClientService.js';
import { setResettingState } from '../../core/localStorageManager.js';
import { openAuthModal } from '../auth/authModalInputs.js';
import { syncPlayerTagToUrl } from '../../core/playerUrlRouter.js';
import { updateAccountUI, configureAccountPopover, togglePopoverPanel } from './settingsAccountDisplay.js';
import { promptPwaInstall } from '../../services/pwaService.js';

let activeAccountDismissListener = null;
let activeAccountEscapeListener = null;

/**
 * Toggles or sets the open state of the header account popover.
 * @param {boolean} [forceState]
 */
function toggleAccountPopover(forceState) {
    const popover = /** @type {HTMLElement | null} */ (document.getElementById('app-account-popover'));
    const btn = /** @type {HTMLElement | null} */ (document.getElementById('header-account-btn'));
    if (!popover || !btn) return;

    const isOpen = forceState !== undefined ? forceState : !popover.classList.contains('is-open');

    if (isOpen) {
        popover.removeAttribute('hidden');
        popover.style.display = 'flex';
        void popover.offsetHeight;
        popover.classList.add('is-open');
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');

        if (!activeAccountDismissListener) {
            activeAccountDismissListener = (e) => {
                const target = /** @type {HTMLElement} */ (e.target);
                if (!popover.contains(target) && !btn.contains(target)) {
                    toggleAccountPopover(false);
                }
            };
            document.addEventListener('pointerdown', activeAccountDismissListener, { passive: true });
        }

        if (!activeAccountEscapeListener) {
            activeAccountEscapeListener = (e) => {
                if (e.key === 'Escape') {
                    toggleAccountPopover(false);
                    btn.focus();
                }
            };
            document.addEventListener('keydown', activeAccountEscapeListener);
        }
    } else {
        popover.classList.remove('is-open');
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');

        setTimeout(() => {
            if (!popover.classList.contains('is-open')) {
                popover.setAttribute('hidden', '');
                popover.style.display = 'none';
            }
        }, 150);

        if (activeAccountDismissListener) {
            document.removeEventListener('pointerdown', activeAccountDismissListener);
            activeAccountDismissListener = null;
        }
        if (activeAccountEscapeListener) {
            document.removeEventListener('keydown', activeAccountEscapeListener);
            activeAccountEscapeListener = null;
        }
    }
}

/**
 * Initializes account card buttons, header button, backup/restore, and account lifecycle listeners.
 * @param {import('./settingsAccountDisplay.js').AccountPopoverOptions} [options={}]
 */
export function initializeSettingsAccount(options = {}) {
    configureAccountPopover(options);
    updateAccountUI(getAuthenticatedUser());
    toggleAccountPopover(false);

    const headerBtn = document.getElementById('header-account-btn');
    if (headerBtn?.getAttribute?.('data-account-initialized') === 'true' || headerBtn?.dataset?.accountInitialized === 'true') {
        return;
    }
    headerBtn?.setAttribute?.('data-account-initialized', 'true');
    if (headerBtn?.dataset) {
        headerBtn.dataset.accountInitialized = 'true';
    }

    document.addEventListener('auth:state-change', () => {
        updateAccountUI(getAuthenticatedUser());
    });

    document.addEventListener('languageChanged', () => {
        updateAccountUI(getAuthenticatedUser());
    });

    document.addEventListener('pwa:installable', () => {
        updateAccountUI(getAuthenticatedUser());
    });

    document.addEventListener('pwa:installed', () => {
        updateAccountUI(getAuthenticatedUser());
    });

    const handleLogout = async () => {
        toggleAccountPopover(false);
        const confirmed = await showConfirm(translate('auth.signOutConfirm'));
        if (confirmed) {
            setResettingState(true);
            syncPlayerTagToUrl(null);
            logout();
            if (typeof window !== 'undefined' && window.location) {
                if (window.location.hash || window.location.search) {
                    history.replaceState(null, '', window.location.pathname);
                }
                window.location.href = window.location.origin + window.location.pathname;
            }
        }
    };

    const popoverLogoutBtn = document.getElementById('account-popover-logout-btn');
    popoverLogoutBtn?.addEventListener('click', handleLogout);

    headerBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAccountPopover();
    });

    const popoverAvatarBtn = document.getElementById('account-popover-avatar-btn');
    popoverAvatarBtn?.addEventListener('click', (e) => {
        if (popoverAvatarBtn.classList.contains('is-static') || popoverAvatarBtn.getAttribute('aria-disabled') === 'true') {
            e.preventDefault();
            return;
        }
        toggleAccountPopover(false);
    });

    const popoverManageBtn = document.getElementById('account-popover-manage-btn');
    popoverManageBtn?.addEventListener('click', () => {
        toggleAccountPopover(false);
    });

    const panelsContainer = document.getElementById('account-popover-panels');
    panelsContainer?.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const summaryBtn = target.closest('.account-popover-panel-summary');
        if (!summaryBtn) return;
        const panel = summaryBtn.closest('[data-popover-panel]');
        if (!panel) return;
        const panelId = panel.getAttribute('data-popover-panel');
        if (panelId) togglePopoverPanel(panelId);
    });

    const popoverSignInBtn = document.getElementById('account-popover-signin-btn');
    popoverSignInBtn?.addEventListener('click', () => {
        toggleAccountPopover(false);
        openAuthModal('signin');
    });

    const popoverGuestAvatarBtn = document.getElementById('account-popover-guest-avatar-btn');
    popoverGuestAvatarBtn?.addEventListener('click', () => {
        toggleAccountPopover(false);
    });

    const popoverGuestManageBtn = document.getElementById('account-popover-guest-manage-btn');
    popoverGuestManageBtn?.addEventListener('click', () => {
        toggleAccountPopover(false);
    });

    const handleInstallClick = async () => {
        toggleAccountPopover(false);
        await promptPwaInstall();
    };

    const popoverInstallBtn = document.getElementById('account-popover-install-btn');
    popoverInstallBtn?.addEventListener('click', handleInstallClick);

    const popoverGuestInstallBtn = document.getElementById('account-popover-guest-install-btn');
    popoverGuestInstallBtn?.addEventListener('click', handleInstallClick);
}
