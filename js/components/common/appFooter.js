/**
 * @fileoverview Centralized application footer controller.
 * Manages runtime version display, perpetual dynamic copyright years,
 * in-app legal modal interception, localized href updates, and reversible active link state.
 */

import { openLicensesModal, openPrivacyModal, openTermsOfUseModal } from '../appSettings/settingsLegalModals.js';
import { openRunningCostsModal } from '../appSettings/settingsRunningCostsModal.js';
import { openBugReportModal, openContactModal } from '../appSettings/settingsSupportModals.js';
import { translate } from '../../i18n/translator.js';
import {
    getLanguageFromPath,
    normalizeRoutePath,
    buildLocalizedRouteHref
} from '../../core/languageRouter.js';
import { getPlayerTagFromUrl } from '../../core/playerUrlRouter.js';
import { state } from '../../core/state.js';

const DEFAULT_FOOTER_SELECTOR = '.app-footer__list, .app-footer__links, .navigation-drawer__footer-links, .footer__links';

/**
 * Checks whether an href points to an external origin, anchor fragment, or non-HTTP scheme.
 *
 * @param {string} href
 * @returns {boolean}
 */
function isExternalOrHashHref(href) {
    return !href || /^(?:https?:\/\/|mailto:|tel:|javascript:|#)/i.test(href.trim());
}

/**
 * Normalizes URL path by stripping language prefixes and trailing slashes.
 * @param {string} path
 * @returns {string}
 */
export function normalizePath(path) {
    if (!path || typeof path !== 'string') return '/';
    const normalized = normalizeRoutePath(path);
    return normalized === '/' ? '/' : normalized.replace(/\/+$/, '');
}

/**
 * Resolves active player tag for link propagation across tools.
 *
 * @returns {string}
 */
function resolveActivePlayerTag() {
    const urlTag = getPlayerTagFromUrl();
    if (urlTag) return urlTag;
    if (state.currentPlayerTag && state.currentPlayerTag !== 'DEFAULT0') {
        return state.currentPlayerTag;
    }
    return '';
}

/**
 * Closes an open navigation drawer when launching a modal from a drawer footer link.
 */
function closeOpenDrawer() {
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
    const btn = document.querySelector('#hamburger-btn, #hamburger-button, .app-header__hamburger, .hamburger');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
    }
}

/**
 * Handles legal and support link clicks by opening corresponding in-app dialog modals.
 * Suppresses native navigation when clicking an already-active footer route link.
 * Falls back gracefully to standard navigation when modifier keys are used or modals are absent.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleLegalLinkClick(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
    }

    const target = /** @type {HTMLElement | null} */ (event.target);
    if (!target) return;

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
        return;
    }

    const activeFooterLink = /** @type {HTMLAnchorElement | null} */ (target.closest('a[aria-current="page"]'));
    if (activeFooterLink) {
        event.preventDefault();
    }
}

/**
 * Stateful singleton controller managing footer hydration, reversible active states,
 * localized link generation, and responsive wrap-separator observers.
 */
class AppFooterController {
    /** @type {WeakMap<Element, string>} */
    #canonicalBasePaths = new WeakMap();

    /** @type {WeakSet<Element>} */
    #boundLinkLists = new WeakSet();

    /** @type {WeakMap<Element, () => void>} */
    #separatorCleanups = new WeakMap();

    /** @type {WeakSet<Document>} */
    #boundDocuments = new WeakSet();

    /**
     * Reconciles active indicators and localized href attributes across footer and header brand links.
     *
     * @param {string} [containerSelector=DEFAULT_FOOTER_SELECTOR]
     */
    syncLinks(containerSelector = DEFAULT_FOOTER_SELECTOR) {
        if (typeof document === 'undefined') return;

        const currentNormalizedPath = normalizeRoutePath(typeof window !== 'undefined' ? window.location?.pathname || '/' : '/');
        const currentLang = getLanguageFromPath() || 'en';
        const playerTag = resolveActivePlayerTag();

        if (typeof document.querySelectorAll === 'function') {
            const brandLinks = document.querySelectorAll('.brand-title-link, .landing-brand');
            const localizedHubHref = buildLocalizedRouteHref('/', { lang: currentLang });
            brandLinks.forEach(brandLink => {
                brandLink.setAttribute?.('href', localizedHubHref);
            });
        }

        const containers = document.querySelectorAll?.(containerSelector) || [];
        containers.forEach(container => {
            let links = Array.from(container.querySelectorAll?.('a') || []);
            if (links.length === 0 && typeof container.querySelectorAll === 'function') {
                links = Array.from(container.querySelectorAll('a[href]') || []);
            }

            links.forEach(link => {
                let canonicalPath = this.#canonicalBasePaths.get(link)
                    || link.getAttribute?.('data-footer-href')
                    || null;

                if (!canonicalPath) {
                    const initialHref = link.getAttribute?.('href') || '';
                    if (isExternalOrHashHref(initialHref)) return;
                    canonicalPath = normalizeRoutePath(initialHref);
                    this.#canonicalBasePaths.set(link, canonicalPath);
                    link.setAttribute?.('data-footer-href', canonicalPath);
                }

                if (isExternalOrHashHref(canonicalPath)) return;

                const localizedHref = buildLocalizedRouteHref(canonicalPath, {
                    lang: currentLang,
                    playerTag
                });
                link.setAttribute?.('href', localizedHref);

                if (currentNormalizedPath === canonicalPath) {
                    link.classList?.add?.('is-active');
                    link.setAttribute?.('aria-current', 'page');
                } else {
                    link.classList?.remove?.('is-active');
                    link.removeAttribute?.('aria-current');
                }
            });
        });
    }

    /**
     * Binds document-level reactive synchronization listeners once per Document instance.
     */
    #bindDocumentSyncListeners() {
        if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
        if (this.#boundDocuments.has(document)) return;
        this.#boundDocuments.add(document);

        const refreshLinks = () => this.syncLinks();
        document.addEventListener('languageChanged', refreshLinks);
        document.addEventListener('app:playerDropdownSync', refreshLinks);
    }

    /**
     * Hydrates copyright/version metadata, delegated click handlers, wrap observers, and active links.
     *
     * @param {{ version?: string }} [options={}]
     */
    init(options = {}) {
        const rawVersion = (typeof window !== 'undefined' && window.__ENV__?.APP_VERSION) || options.version || '3.1.0';
        const formattedVersion = 'v' + String(rawVersion).replace(/^v/, '');

        const versionDisplays = document.querySelectorAll('#app-version-display, .navigation-drawer__app-version, #support-sw-version-text');
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
            if (this.#boundLinkLists.has(htmlList) || htmlList.dataset?.footerInitialized) return;
            this.#boundLinkLists.add(htmlList);
            if (htmlList.dataset) {
                htmlList.dataset.footerInitialized = 'true';
            }
            htmlList.addEventListener?.('click', handleLegalLinkClick);
        });

        const wrapSeparatedLists = document.querySelectorAll('.app-footer__col--legal .app-footer__list, .footer__links');
        wrapSeparatedLists.forEach(list => {
            const htmlList = /** @type {HTMLElement} */ (list);
            if (this.#separatorCleanups.has(htmlList) || htmlList.dataset?.separatorsObserved) return;
            if (htmlList.dataset) {
                htmlList.dataset.separatorsObserved = 'true';
            }
            this.#separatorCleanups.set(htmlList, observeWrappedSeparators(htmlList));
        });

        if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.ready?.then === 'function') {
            document.fonts.ready.then(() => {
                wrapSeparatedLists.forEach(list => {
                    updateWrappedSeparators(/** @type {HTMLElement} */ (list));
                });
            }).catch(() => {});
        }

        this.#bindDocumentSyncListeners();
        this.syncLinks();
    }
}

const footerController = new AppFooterController();

/**
 * Reconciles active indicators and localized href attributes across footer and header brand links.
 * @param {string} [containerSelector=DEFAULT_FOOTER_SELECTOR]
 */
export function syncActiveFooterLinks(containerSelector = DEFAULT_FOOTER_SELECTOR) {
    footerController.syncLinks(containerSelector);
}

/**
 * Initializes and hydrates all application footer nodes across the DOM.
 * @param {{ version?: string }} [options={}]
 */
export function initAppFooter(options = {}) {
    footerController.init(options);
}

/**
 * Detects wrapped items in a flex-wrap container and marks row-starting elements
 * with the `is-row-start` class so that leading/trailing separators are cleanly suppressed.
 * @param {HTMLElement} [container]
 * @returns {void}
 */
export function updateWrappedSeparators(container) {
    if (!container || !container.children) return;

    /** @type {Array<{ item: HTMLElement, top: number }>} */
    const visibleEntries = [];
    const childrenCount = container.children.length;
    for (let i = 0; i < childrenCount; i++) {
        const item = /** @type {HTMLElement} */ (container.children[i]);
        if (item.offsetParent === null && item.offsetWidth === 0 && item.offsetHeight === 0) {
            continue;
        }
        visibleEntries.push({ item, top: item.offsetTop });
    }

    let lastTop = -1;
    for (let i = 0; i < visibleEntries.length; i++) {
        const { item, top } = visibleEntries[i];
        if (lastTop === -1 || Math.abs(top - lastTop) > 2) {
            item.classList.add('is-row-start');
            lastTop = top;
        } else {
            item.classList.remove('is-row-start');
        }
    }
}

/**
 * Observes container width changes via ResizeObserver and updates wrapped separators.
 * @param {HTMLElement} [container]
 * @returns {() => void} Cleanup disconnect callback
 */
export function observeWrappedSeparators(container) {
    if (!container) return () => {};

    updateWrappedSeparators(container);

    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
        return () => {};
    }

    let rafId = null;
    const observer = new ResizeObserver(() => {
        if (typeof cancelAnimationFrame === 'function' && rafId) {
            cancelAnimationFrame(rafId);
        }
        if (typeof requestAnimationFrame === 'function') {
            rafId = requestAnimationFrame(() => {
                updateWrappedSeparators(container);
            });
        } else {
            updateWrappedSeparators(container);
        }
    });

    observer.observe(container);
    return () => {
        if (typeof cancelAnimationFrame === 'function' && rafId) {
            cancelAnimationFrame(rafId);
        }
        observer.disconnect();
    };
}
