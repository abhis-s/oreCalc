/**
 * Pure DOM rendering for Header Account Button and Modular Account Popover.
 * Tier 4: UI Renderer.
 */

import { getLanguageFromPath } from '../../core/languageRouter.js';
import { state } from '../../core/state.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { isPwaInstallSupported } from '../../services/pwaService.js';

/**
 * Returns localized route prefix based on active URL path or uiSettings.
 * @returns {string}
 */
function getActiveRoutePrefix() {
    const lang = getLanguageFromPath() || state.uiSettings?.language || 'en';
    return lang === 'en' ? '' : `/${lang}`;
}

/**
 * Updates an anchor tag href to preserve the current language prefix.
 * @param {HTMLElement|null} el
 * @param {string} subPath - Subpath starting with '/' (e.g. '/account/').
 */
function updateLocalizedHref(el, subPath) {
    if (!el || typeof el.setAttribute !== 'function') return;
    const prefix = getActiveRoutePrefix();
    el.setAttribute('href', `${prefix}${subPath}`);
}

/**
 * @typedef {Object} AccountPopoverCustomPanel
 * @property {string} id - Unique panel identifier.
 * @property {string} [title] - Fallback title string.
 * @property {string} [i18nKey] - Translation key for summary title.
 * @property {string} [icon] - SVG asset name.
 * @property {string} [contentHtml] - HTML string to render in panel body.
 * @property {(bodyEl: HTMLElement) => void} [onRender] - Custom lifecycle hook.
 */

/**
 * @typedef {Object} AccountPopoverOptions
 * @property {boolean} [hasAccountSync=true] - Whether "Account & Cloud Sync" menu option is present.
 * @property {boolean} [hasClickableAvatar=true] - Whether avatar links to /account/ or is non-clickable.
 * @property {boolean} [hasSettingsPanel=true] - Whether the built-in settings panel is present.
 * @property {string[]} [expandedPanels=[]] - Panel IDs explicitly requested to start expanded.
 * @property {AccountPopoverCustomPanel[]} [customPanels=[]] - Extra panels provided by the page.
 */

/** @type {AccountPopoverOptions} */
let currentPopoverOptions = {
    hasAccountSync: true,
    hasClickableAvatar: true,
    hasSettingsPanel: true,
    expandedPanels: [],
    customPanels: []
};

/**
 * Toggles a popover panel's expanded state.
 * @param {string} panelId
 * @param {boolean} [forceState]
 */
export function togglePopoverPanel(panelId, forceState) {
    const panel = document.querySelector(`[data-popover-panel="${panelId}"]`);
    if (!panel) return;

    const summaryBtn = panel.querySelector('.account-popover-panel-summary');
    const isExpanded = forceState !== undefined ? forceState : !panel.classList.contains('is-expanded');

    panel.classList.toggle('is-expanded', isExpanded);
    if (summaryBtn) {
        summaryBtn.setAttribute('aria-expanded', String(isExpanded));
    }
}

/**
 * Configures the modular account popover based on page-provided options.
 * @param {AccountPopoverOptions} [options={}]
 */
export function configureAccountPopover(options = {}) {
    currentPopoverOptions = {
        hasAccountSync: options.hasAccountSync !== false,
        hasClickableAvatar: options.hasClickableAvatar !== false,
        hasSettingsPanel: options.hasSettingsPanel !== false,
        expandedPanels: Array.isArray(options.expandedPanels) ? [...options.expandedPanels] : [],
        customPanels: Array.isArray(options.customPanels) ? [...options.customPanels] : []
    };

    applyPopoverConfiguration();
}

/**
 * Applies the current popover configuration to the DOM.
 */
function applyPopoverConfiguration() {
    const popover = document.getElementById('app-account-popover');
    if (!popover) return;

    const manageBtn = document.getElementById('account-popover-manage-btn');
    if (manageBtn) {
        if (currentPopoverOptions.hasAccountSync) {
            manageBtn.classList.remove('is-hidden');
            manageBtn.removeAttribute('hidden');
        } else {
            manageBtn.classList.add('is-hidden');
            manageBtn.setAttribute('hidden', '');
        }
    }

    const canInstall = isPwaInstallSupported();
    const installBtn = document.getElementById('account-popover-install-btn');
    if (installBtn) {
        if (canInstall) {
            installBtn.classList.remove('is-hidden');
            installBtn.removeAttribute('hidden');
        } else {
            installBtn.classList.add('is-hidden');
            installBtn.setAttribute('hidden', '');
        }
    }
    const guestInstallBtn = document.getElementById('account-popover-guest-install-btn');
    if (guestInstallBtn) {
        if (canInstall) {
            guestInstallBtn.classList.remove('is-hidden');
            guestInstallBtn.removeAttribute('hidden');
        } else {
            guestInstallBtn.classList.add('is-hidden');
            guestInstallBtn.setAttribute('hidden', '');
        }
    }

    const avatarBtn = document.getElementById('account-popover-avatar-btn');
    if (avatarBtn) {
        if (currentPopoverOptions.hasClickableAvatar) {
            updateLocalizedHref(avatarBtn, '/account/');
            avatarBtn.removeAttribute('role');
            avatarBtn.removeAttribute('tabindex');
            avatarBtn.removeAttribute('aria-disabled');
            avatarBtn.classList.remove('is-static');
        } else {
            avatarBtn.removeAttribute('href');
            avatarBtn.setAttribute('role', 'img');
            avatarBtn.setAttribute('tabindex', '-1');
            avatarBtn.setAttribute('aria-disabled', 'true');
            avatarBtn.classList.add('is-static');
        }
    }

    const settingsPanel = document.querySelector('[data-popover-panel="settings"]');
    if (settingsPanel) {
        if (currentPopoverOptions.hasSettingsPanel) {
            settingsPanel.classList.remove('is-hidden');
            settingsPanel.removeAttribute('hidden');
            if (!Object.hasOwn(settingsPanel, 'open')) {
                Object.defineProperty(settingsPanel, 'open', {
                    get() { return settingsPanel.classList.contains('is-expanded'); },
                    set(val) { togglePopoverPanel('settings', Boolean(val)); },
                    configurable: true
                });
            }
        } else {
            settingsPanel.classList.add('is-hidden');
            settingsPanel.setAttribute('hidden', '');
        }
    }

    const panelsContainer = document.getElementById('account-popover-panels');
    if (panelsContainer && currentPopoverOptions.customPanels.length > 0) {
        for (const customDef of currentPopoverOptions.customPanels) {
            let customPanel = panelsContainer.querySelector(`[data-popover-panel="${customDef.id}"]`);
            if (!customPanel) {
                customPanel = document.createElement('div');
                customPanel.className = 'account-popover-panel';
                customPanel.setAttribute('data-popover-panel', customDef.id);
                customPanel.id = `account-popover-panel-${customDef.id}`;

                const icon = customDef.icon || 'settings-filled';
                const i18nAttr = customDef.i18nKey ? ` data-i18n="${customDef.i18nKey}"` : '';
                const titleText = escapeHTML(customDef.title || customDef.id);

                customPanel.innerHTML = `
                    <button type="button" class="account-popover-panel-summary" id="account-popover-panel-${customDef.id}-summary"
                        aria-expanded="false" aria-controls="account-popover-panel-${customDef.id}-body">
                        <span class="account-popover-prefs-title">
                            <clashcalc-assets-svg name="${icon}" width="16" height="16" class="pref-label-icon"></clashcalc-assets-svg>
                            <span${i18nAttr}>${titleText}</span>
                        </span>
                        <clashcalc-assets-svg name="chevron-down" width="14" height="14" class="account-popover-prefs-chevron"></clashcalc-assets-svg>
                    </button>
                    <div id="account-popover-panel-${customDef.id}-body" class="account-popover-panel-body" role="region" aria-labelledby="account-popover-panel-${customDef.id}-summary">
                        <div class="account-popover-panel-inner">
                            ${customDef.contentHtml || ''}
                        </div>
                    </div>
                `;
                panelsContainer.appendChild(customPanel);

                if (typeof customDef.onRender === 'function') {
                    const bodyInner = customPanel.querySelector('.account-popover-panel-inner');
                    if (bodyInner) customDef.onRender(/** @type {HTMLElement} */ (bodyInner));
                }
            }
        }
    }

    const allPanels = popover.querySelectorAll('[data-popover-panel]');
    let hasVisiblePanels = false;
    allPanels.forEach(p => {
        const pId = p.getAttribute('data-popover-panel');
        const isHidden = p.classList.contains('is-hidden') || p.hasAttribute('hidden');
        if (!isHidden) hasVisiblePanels = true;
        if (pId) {
            const shouldExpand = currentPopoverOptions.expandedPanels.includes(pId);
            togglePopoverPanel(pId, shouldExpand);
        }
    });

    const divider = document.getElementById('account-popover-panel-divider');
    if (divider) {
        if (hasVisiblePanels) {
            divider.classList.remove('is-hidden');
            divider.removeAttribute('hidden');
        } else {
            divider.classList.add('is-hidden');
            divider.setAttribute('hidden', '');
        }
    }
}

/**
 * Updates all account identity UI elements across header and modular popover.
 *
 * @param {{ username: string, avatar?: string }|null} authUser
 */
export function updateAccountUI(authUser) {
    const headerBtn = document.getElementById('header-account-btn');
    const headerIconWrapper = document.getElementById('header-account-icon-wrapper');
    const headerAvatarImg = document.getElementById('header-account-avatar-img');

    const popoverAuthSection = document.getElementById('account-popover-auth-section');
    const popoverGuestSection = document.getElementById('account-popover-guest-section');
    const popoverUsername = document.getElementById('account-popover-username');
    const popoverAvatarImg = document.getElementById('account-popover-avatar-img');

    updateLocalizedHref(document.getElementById('account-popover-avatar-btn'), '/account/');
    updateLocalizedHref(document.getElementById('account-popover-manage-btn'), '/account/');
    updateLocalizedHref(document.getElementById('account-popover-guest-data-btn'), '/account/');

    if (authUser && authUser.username) {
        const safeName = escapeHTML(authUser.username);
        const avatar = authUser.avatar || 'archer';

        if (popoverUsername) {
            popoverUsername.textContent = safeName;
        }
        if (popoverAvatarImg) {
            popoverAvatarImg.setAttribute('src', `assets/avatars/${avatar}.png`);
        }
        popoverGuestSection?.classList.add('is-hidden');
        if (popoverGuestSection) popoverGuestSection.style.display = 'none';
        popoverAuthSection?.classList.remove('is-hidden');
        if (popoverAuthSection) popoverAuthSection.style.display = '';

        headerBtn?.classList.add('is-authenticated');
        if (headerAvatarImg) {
            headerAvatarImg.setAttribute('src', `assets/avatars/${avatar}.png`);
            headerAvatarImg.classList.remove('is-hidden');
        }
        headerIconWrapper?.classList.add('is-hidden');
    } else {
        if (popoverUsername) {
            popoverUsername.textContent = '';
        }
        popoverAuthSection?.classList.add('is-hidden');
        if (popoverAuthSection) popoverAuthSection.style.display = 'none';
        popoverGuestSection?.classList.remove('is-hidden');
        if (popoverGuestSection) popoverGuestSection.style.display = '';

        headerBtn?.classList.remove('is-authenticated');
        headerAvatarImg?.classList.add('is-hidden');
        headerIconWrapper?.classList.remove('is-hidden');
    }

    applyPopoverConfiguration();
}
