/**
 * ClashCalc App Shell DOM Synchronization Helpers.
 * Handles head metadata, stylesheet lifecycle management, header tabs/dropdowns,
 * and modal synchronization during soft view transitions across primary tool routes.
 * Tier 3: Core Routing & Lifecycle Engine.
 */

import { APP_ROUTES, APP_SHELL_STYLESHEET, APP_PERSISTENT_MODAL_IDS } from '../data/appRoutesData.js';
import { findRouteById } from './languageRouter.js';

const ROUTE_STYLESHEET_PATHS = new Set(APP_ROUTES.flatMap(route => route.stylesheets));
const PERSISTENT_MODAL_ID_SET = new Set(APP_PERSISTENT_MODAL_IDS);

/**
 * Normalizes a stylesheet href to its pathname without query/hash parameters.
 *
 * @param {string} href
 * @returns {string}
 */
function normalizeStylesheetPath(href) {
    if (!href || typeof href !== 'string') return '';
    try {
        const origin = (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null')
            ? window.location.origin
            : 'https://clashcalc.com';
        const pathname = new URL(href, origin).pathname;
        return pathname.replace(/\.min\.css$/, '.css');
    } catch (_) {
        const stripped = href.split(/[?#]/)[0];
        return stripped.replace(/\.min\.css$/, '.css');
    }
}

/**
 * Manages route-scoped stylesheet preloading, cached re-activation, and disabling on exit.
 */
class ShellStylesheetManager {
    /**
     * Collects normalized stylesheet pathnames declared on a document.
     *
     * @param {Document} targetDoc
     * @returns {Set<string>}
     */
    #collectNormalizedPaths(targetDoc) {
        const links = Array.from(targetDoc.querySelectorAll?.('link[rel="stylesheet"]') || []);
        const paths = new Set();
        for (const link of links) {
            const rawHref = link.getAttribute?.('href');
            const normalized = normalizeStylesheetPath(rawHref || '');
            if (normalized) paths.add(normalized);
        }
        return paths;
    }

    /**
     * Preloads destination stylesheets missing from document.head and re-enables cached route sheets.
     *
     * @param {Document} newDoc
     * @returns {Promise<void>}
     */
    async preloadForDestination(newDoc) {
        if (typeof document === 'undefined' || !document.head) return;

        const newStylesheets = Array.from(newDoc.querySelectorAll?.('link[rel="stylesheet"]') || []);
        const pendingPromises = [];
        /** @type {Map<string, HTMLLinkElement>} */
        const existingByPath = new Map();

        const headLinks = Array.from(document.head.querySelectorAll?.('link[rel="stylesheet"]') || []);
        for (const link of headLinks) {
            const normalized = normalizeStylesheetPath(link.getAttribute?.('href') || '');
            if (normalized && !existingByPath.has(normalized)) {
                existingByPath.set(normalized, /** @type {HTMLLinkElement} */ (link));
            }
        }

        for (const link of newStylesheets) {
            const rawHref = link.getAttribute?.('href');
            if (!rawHref) continue;

            const normalized = normalizeStylesheetPath(rawHref);
            if (!normalized) continue;

            const existingLink = existingByPath.get(normalized);
            if (existingLink) {
                existingLink.disabled = false;
                continue;
            }

            const newLink = /** @type {HTMLLinkElement} */ (document.createElement('link'));
            newLink.rel = 'stylesheet';
            newLink.href = rawHref;
            newLink.disabled = false;
            if (ROUTE_STYLESHEET_PATHS.has(normalized)) {
                newLink.setAttribute?.('data-route-stylesheet', 'true');
            }

            const loadPromise = new Promise((resolve) => {
                let timer;
                const done = () => {
                    clearTimeout(timer);
                    resolve(undefined);
                };
                newLink.onload = done;
                newLink.onerror = done;
                // Timeout safeguard prevents hanging on slow connections
                timer = setTimeout(done, 250);
            });

            pendingPromises.push(loadPromise);
            existingByPath.set(normalized, newLink);
            document.head.appendChild(newLink);
        }

        if (pendingPromises.length > 0) {
            await Promise.all(pendingPromises);
        }
    }

    /**
     * Disables exited route stylesheets no longer referenced by the destination document
     * while permanently preserving the core shell stylesheet.
     *
     * @param {Document} newDoc
     */
    deactivateExited(newDoc) {
        if (typeof document === 'undefined' || !document.head) return;

        const desiredPaths = this.#collectNormalizedPaths(newDoc);
        const headLinks = Array.from(document.head.querySelectorAll?.('link[rel="stylesheet"]') || []);

        for (const link of headLinks) {
            const stylesheet = /** @type {HTMLLinkElement} */ (link);
            const normalized = normalizeStylesheetPath(stylesheet.getAttribute?.('href') || '');
            if (!normalized) continue;

            if (normalized === APP_SHELL_STYLESHEET) {
                stylesheet.disabled = false;
                continue;
            }

            const isRouteOwned = ROUTE_STYLESHEET_PATHS.has(normalized)
                || stylesheet.getAttribute?.('data-route-stylesheet') === 'true'
                || stylesheet.dataset?.routeStylesheet === 'true';

            if (!isRouteOwned) continue;

            stylesheet.disabled = !desiredPaths.has(normalized);
        }
    }
}

/**
 * Reconciles top-level route dialogs across soft navigations while keeping persistent shell dialogs intact.
 */
class ShellModalManager {
    /**
     * Synchronizes dialogs from the destination document and closes/removes exited route dialogs.
     *
     * @param {Document} newDoc
     * @param {import('./appShellNavigator.js').NavigatorUiHooks} [uiHooks={}]
     */
    sync(newDoc, uiHooks = {}) {
        if (typeof document === 'undefined') return;

        const destinationModalIds = new Set();
        const newModals = Array.from(newDoc.querySelectorAll?.('dialog.modal, .modal[id]') || []);

        for (const newModal of newModals) {
            if (!newModal.id) continue;
            if (typeof newModal.closest === 'function' && newModal.closest('#tool-extras')) continue;

            destinationModalIds.add(newModal.id);
            const currentModal = document.getElementById(newModal.id);
            if (!currentModal) {
                const clone = /** @type {HTMLElement} */ (newModal.cloneNode(true));
                if (!PERSISTENT_MODAL_ID_SET.has(newModal.id)) {
                    clone.setAttribute?.('data-route-modal', 'true');
                }
                document.body.appendChild(clone);
            } else if (newModal.id === 'add-player-modal') {
                currentModal.replaceWith(newModal.cloneNode(true));
            }
        }

        const mountedModals = Array.from(document.querySelectorAll?.('dialog.modal, .modal[id]') || []);
        for (const existingModal of mountedModals) {
            if (!existingModal.id) continue;
            if (typeof existingModal.closest === 'function' && existingModal.closest('#tool-extras')) continue;
            if (PERSISTENT_MODAL_ID_SET.has(existingModal.id)) continue;
            if (destinationModalIds.has(existingModal.id)) continue;

            const dialog = /** @type {HTMLDialogElement} */ (existingModal);
            if (dialog.open && typeof dialog.close === 'function') {
                try { dialog.close(); } catch (_) {}
            }
            dialog.remove?.();
        }

        uiHooks.onResetPlayerModal?.();
    }
}

const stylesheetManager = new ShellStylesheetManager();
const modalManager = new ShellModalManager();

/**
 * Computes synchronized document.body className across view transitions.
 * Preserves theme mode (dark-mode / light-mode) and active has-player state.
 *
 * @param {string} currentClassName
 * @param {import('./appShellNavigator.js').AppRouteId} nextRoute
 * @param {boolean} [hasPlayer=false]
 * @returns {string}
 */
export function computeSynchronizedBodyClasses(currentClassName, nextRoute, hasPlayer = false) {
    const isLight = currentClassName.includes('light-mode');
    const classes = [isLight ? 'light-mode' : 'dark-mode'];

    const routeBodyClass = findRouteById(nextRoute)?.bodyClass;
    if (routeBodyClass) {
        classes.push(routeBodyClass);
    }

    if (hasPlayer) {
        classes.push('has-player');
    }

    return classes.join(' ');
}

/**
 * Injects and preloads any destination stylesheets missing from the current document head,
 * and re-enables cached destination route stylesheets.
 *
 * @param {Document} newDoc
 * @returns {Promise<void>}
 */
export async function ensureStylesheets(newDoc) {
    await stylesheetManager.preloadForDestination(newDoc);
}

/**
 * Disables exited route stylesheets no longer used by the destination document.
 *
 * @param {Document} newDoc
 */
export function syncRouteStylesheets(newDoc) {
    stylesheetManager.deactivateExited(newDoc);
}

/**
 * Synchronizes title, description, and canonical tags in document head across tools.
 * Ensures data-i18n attributes on head elements match destination page for dynamic translation.
 *
 * @param {Document} newDoc
 */
export function syncHeadForRoute(newDoc) {
    if (typeof document === 'undefined') return;

    const currentTitle = document.querySelector('title');
    const newTitle = newDoc.querySelector('title');
    if (newTitle) {
        if (currentTitle) {
            currentTitle.replaceWith(newTitle.cloneNode(true));
        } else {
            document.head.appendChild(newTitle.cloneNode(true));
        }
        document.title = newDoc.title;
    }

    const metaSelectors = [
        'meta[name="description"]',
        'meta[property="og:title"]',
        'meta[property="og:description"]',
        'meta[property="og:url"]',
        'meta[property="og:image"]',
        'meta[name="twitter:title"]',
        'meta[name="twitter:description"]',
        'meta[name="twitter:url"]',
        'meta[name="twitter:image"]'
    ];
    for (const selector of metaSelectors) {
        const currentEl = document.querySelector(selector);
        const newEl = newDoc.querySelector(selector);
        if (currentEl && newEl) {
            currentEl.replaceWith(newEl.cloneNode(true));
        }
    }

    const linkSelectors = ['link[rel="canonical"]', 'link[rel="icon"]'];
    for (const selector of linkSelectors) {
        const currentEl = document.querySelector(selector);
        const newEl = newDoc.querySelector(selector);
        if (currentEl && newEl) {
            currentEl.replaceWith(newEl.cloneNode(true));
        }
    }
}

/**
 * Synchronizes header brand pill, tab bars, and player dropdown across tools.
 *
 * @param {Document} newDoc
 * @param {import('./appShellNavigator.js').NavigatorUiHooks} [uiHooks={}]
 */
export function syncHeaderForRoute(newDoc, uiHooks = {}) {
    const currentHeader = document.querySelector('.app-header');
    const newHeader = newDoc.querySelector('.app-header');
    if (!currentHeader || !newHeader) return;

    currentHeader.className = newHeader.className;

    const currentInner = currentHeader.querySelector('.app-header__inner');
    const newInner = newHeader.querySelector('.app-header__inner');
    if (currentInner && newInner) {
        currentInner.className = newInner.className;
    }

    const currentBrand = currentHeader.querySelector('.app-header__brand');
    const newBrand = newHeader.querySelector('.app-header__brand');
    if (currentBrand && newBrand) {
        currentBrand.className = newBrand.className;
    }

    const currentActions = currentHeader.querySelector('.app-header__actions');
    const newActions = newHeader.querySelector('.app-header__actions');
    if (currentActions && newActions) {
        currentActions.className = newActions.className;
    }

    const currentPlaceholder = document.querySelector('.app-header-placeholder, .header-placeholder');
    const newPlaceholder = newDoc.querySelector('.app-header-placeholder, .header-placeholder');
    if (currentPlaceholder && newPlaceholder) {
        currentPlaceholder.className = newPlaceholder.className;
    }

    const currentPill = currentHeader.querySelector('.brand-page-pill');
    const newPill = newHeader.querySelector('.brand-page-pill');
    if (currentPill && newPill) {
        const currentLabel = currentPill.querySelector('.brand-page-pill__label') || currentPill;
        const newLabel = newPill.querySelector('.brand-page-pill__label') || newPill;
        currentLabel.textContent = newLabel.textContent;
        const i18nKey = newLabel.getAttribute('data-i18n') || newPill.getAttribute('data-i18n');
        if (i18nKey) currentLabel.setAttribute('data-i18n', i18nKey);
        else currentLabel.removeAttribute('data-i18n');
        currentPill.setAttribute('aria-expanded', 'false');
        currentPill.classList.remove('is-active');
    }

    const toolsDropdown = currentHeader.querySelector('#brand-tools-dropdown');
    if (toolsDropdown) {
        toolsDropdown.hidden = true;
        toolsDropdown.classList.remove('is-open');
    }

    const accountPopover = currentHeader.querySelector('#app-account-popover');
    if (accountPopover) {
        accountPopover.hidden = true;
        accountPopover.classList.remove('is-open');
    }

    const accountBtn = currentHeader.querySelector('#header-account-btn');
    if (accountBtn) {
        accountBtn.setAttribute('aria-expanded', 'false');
        accountBtn.classList.remove('is-open');
    }

    const currentTabs = currentHeader.querySelector('.app-header__tabs, .tab-bar-container, .damage-calc-page__tabs');
    const newTabs = newHeader.querySelector('.app-header__tabs, .tab-bar-container, .damage-calc-page__tabs');
    if (newTabs) {
        if (currentTabs) {
            currentTabs.replaceWith(newTabs.cloneNode(true));
        } else {
            const anchor = currentHeader.querySelector('.player-dropdown-container, .app-header__actions');
            anchor?.before(newTabs.cloneNode(true));
        }
    } else if (currentTabs) {
        currentTabs.remove();
    }

    const currentDropdown = currentHeader.querySelector('.player-dropdown-container');
    const newDropdown = newHeader.querySelector('.player-dropdown-container');
    if (newDropdown) {
        if (currentDropdown) {
            currentDropdown.replaceWith(newDropdown.cloneNode(true));
        } else {
            const actions = currentHeader.querySelector('.app-header__actions');
            actions?.before(newDropdown.cloneNode(true));
        }
        uiHooks.onResetPlayerDropdown?.();
    } else if (currentDropdown) {
        currentDropdown.remove();
        uiHooks.onResetPlayerDropdown?.();
    }

    const currentHamburger = currentHeader.querySelector('#hamburger-btn, #hamburger-button, .hamburger, .app-header__hamburger');
    const newHamburger = newHeader.querySelector('#hamburger-btn, #hamburger-button, .hamburger, .app-header__hamburger');
    if (currentHamburger) {
        if (newHamburger) {
            currentHamburger.className = newHamburger.className;
        }
        currentHamburger.id = newHamburger?.id || 'hamburger-btn';
        currentHamburger.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.remove('open-drawer');
}

/**
 * Synchronizes modal dialog elements from destination document into active DOM.
 * Appends new dialogs (such as #add-player-modal) and replaces existing matching dialogs.
 *
 * @param {Document} newDoc
 * @param {import('./appShellNavigator.js').NavigatorUiHooks} [uiHooks={}]
 */
export function syncModalsForRoute(newDoc, uiHooks = {}) {
    modalManager.sync(newDoc, uiHooks);
}
