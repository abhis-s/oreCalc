/**
 * @fileoverview Centralized application footer controller.
 * Manages runtime version display, perpetual dynamic copyright years,
 * in-app legal modal interception, and active link state synchronization.
 */

import { openLicensesModal, openPrivacyModal, openTermsOfUseModal } from '../appSettings/settingsLegalModals.js';
import { openBugReportModal, openContactModal, openRunningCostsModal } from '../appSettings/settingsSupportModals.js';
import { translate } from '../../i18n/translator.js';

/**
 * Normalizes URL path by stripping language prefixes and trailing slashes.
 * @param {string} path
 * @returns {string}
 */
export function normalizePath(path) {
    if (!path || typeof path !== 'string') return '/';
    return path.replace(/^\/(de|tr|zh)(\/|$)/, '/').replace(/\/+$/, '') || '/';
}

/**
 * Handles legal and support link clicks by opening corresponding in-app dialog modals.
 * Falls back gracefully to standard navigation when modifier keys are used or modals are absent.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleLegalLinkClick(event) {
    // Preserve default browser behavior on auxiliary clicks (middle-click) or keyboard modifiers
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
    }

    const target = /** @type {HTMLElement | null} */ (event.target);
    if (!target) return;

    // Helper to close navigation drawer if currently open
    const closeOpenDrawer = () => {
        const openDrawer = /** @type {HTMLDialogElement | null} */ (document.querySelector('.navigation-drawer'));
        if (!openDrawer) return;
        openDrawer.classList.remove('open');
        const overlay = openDrawer.parentElement?.querySelector('.navigation-drawer__overlay') || document.querySelector('.navigation-drawer__overlay');
        if (overlay) {
            overlay.classList.remove('show', 'closing');
        }
        document.body?.classList.remove('open-drawer');
        if (typeof openDrawer.close === 'function' && openDrawer.open) {
            try { openDrawer.close(); } catch (_) {}
        }
        const btn = document.querySelector('.hamburger, #hj-hamburger-btn, #landing-hamburger-btn, .app-header__hamburger');
        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
        }
    };

    const changelogTrigger = /** @type {HTMLElement | null} */ (target.closest('[data-modal-target="changelog-modal"], [data-action="open-changelog-modal"]'));
    if (changelogTrigger && document.getElementById('changelog-modal')) {
        event.preventDefault();
        closeOpenDrawer();
        import('../../services/changelogService.js').then(async ({ getChangelogHtml }) => {
            const { showChangelogModal } = await import('../changelog/changelogModal.js');
            const html = await getChangelogHtml();
            showChangelogModal(html);
        }).catch(err => {
            console.error('Failed to open in-app changelog modal from footer:', err);
        });
        return;
    }

    const costsTrigger = /** @type {HTMLElement | null} */ (target.closest('[data-modal-target="running-costs-modal"], [data-action="open-costs-modal"]'));
    if (costsTrigger && document.getElementById('running-costs-modal')) {
        event.preventDefault();
        closeOpenDrawer();
        openRunningCostsModal();
        return;
    }

    const bugTrigger = /** @type {HTMLElement | null} */ (target.closest('[data-modal-target="bug-report-modal"], [data-action="open-bug-modal"]'));
    if (bugTrigger && document.getElementById('bug-report-modal')) {
        event.preventDefault();
        closeOpenDrawer();
        openBugReportModal();
        return;
    }

    const contactTrigger = /** @type {HTMLElement | null} */ (target.closest('[data-modal-target="contact-modal"], [data-action="open-contact-modal"]'));
    if (contactTrigger && document.getElementById('contact-modal')) {
        event.preventDefault();
        closeOpenDrawer();
        openContactModal();
        return;
    }

    const privacyLink = /** @type {HTMLAnchorElement | null} */ (target.closest('a[href*="privacy"]'));
    if (privacyLink && document.getElementById('privacy-modal')) {
        event.preventDefault();
        closeOpenDrawer();
        openPrivacyModal();
        return;
    }

    const termsLink = /** @type {HTMLAnchorElement | null} */ (target.closest('a[href*="terms"]'));
    if (termsLink && document.getElementById('terms-modal')) {
        event.preventDefault();
        closeOpenDrawer();
        openTermsOfUseModal();
        return;
    }

    const licensesLink = /** @type {HTMLAnchorElement | null} */ (target.closest('a[href*="licenses"]'));
    if (licensesLink && document.getElementById('licenses-modal')) {
        event.preventDefault();
        closeOpenDrawer();
        openLicensesModal();
    }
}

/**
 * Automatically marks and disables the footer link corresponding to the current URL pathname.
 * @param {string} [containerSelector='.app-footer__list, .app-footer__links, .navigation-drawer__footer-links, .footer__links']
 */
export function syncActiveFooterLinks(containerSelector = '.app-footer__list, .app-footer__links, .navigation-drawer__footer-links, .footer__links') {
    const currentPath = normalizePath(typeof window !== 'undefined' ? window.location?.pathname : '/');
    const containers = document.querySelectorAll(containerSelector);

    containers.forEach(container => {
        const links = container.querySelectorAll('a[href]');
        links.forEach(link => {
            const href = link.getAttribute('href') || '';
            const linkPath = normalizePath(href);
            if (currentPath === linkPath) {
                link.classList.add('is-active');
                link.setAttribute('aria-current', 'page');
                link.removeAttribute('href');
            }
        });
    });
}

/**
 * Initializes and hydrates all application footer nodes across the DOM.
 * @param {{ version?: string }} [options={}]
 */
export function initAppFooter(options = {}) {
    const rawVersion = (typeof window !== 'undefined' && window.__ENV__?.APP_VERSION) || options.version || '3.0.0';
    const formattedVersion = 'v' + String(rawVersion).replace(/^v/, '');

    const versionDisplays = document.querySelectorAll('#app-version-display, .navigation-drawer__app-version');
    versionDisplays.forEach(el => {
        el.textContent = formattedVersion;
    });

    const currentYear = new Date().getFullYear();
    const yearRange = currentYear > 2025 ? `2025-${currentYear}` : '2025';
    const rightsText = translate('app.allRightsReserved');
    const rightsDisplay = rightsText === 'app.allRightsReserved' ? 'All rights reserved.' : rightsText;
    const rightsHtml = `<span data-i18n="app.allRightsReserved">${rightsDisplay}</span>`;
    const copyrightElements = document.querySelectorAll('.app-copyright p, .navigation-drawer__copyright, .footer__copyright');
    copyrightElements.forEach(el => {
        if (el.closest?.('.app-footer__copyright')) {
            el.innerHTML = `&copy; ${yearRange} ClashCalc (formerly OreCalc).<br class="app-footer__copyright-break"> ${rightsHtml}`;
        } else if (el.closest?.('.navigation-drawer__copyright') || el.classList?.contains('navigation-drawer__copyright')) {
            el.innerHTML = `&copy; ${yearRange} ClashCalc (formerly OreCalc).<br class="navigation-drawer__copyright-break"> ${rightsHtml}`;
        } else {
            el.innerHTML = `&copy; ${yearRange} ClashCalc (formerly OreCalc). ${rightsHtml}`;
        }
    });

    const footerLinkLists = document.querySelectorAll('.app-footer, .app-footer__links, .app-footer__meta-row, .navigation-drawer__footer-links');
    footerLinkLists.forEach(list => {
        const htmlList = /** @type {HTMLElement} */ (list);
        if (htmlList.dataset.footerInitialized) return;
        htmlList.dataset.footerInitialized = 'true';
        htmlList.addEventListener('click', handleLegalLinkClick);
    });

    syncActiveFooterLinks();
}
