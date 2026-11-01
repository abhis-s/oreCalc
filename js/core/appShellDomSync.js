/**
 * ClashCalc App Shell DOM Synchronization Helpers.
 * Handles head metadata, stylesheet preloading, header tabs/dropdowns, and modal synchronization
 * during soft view transitions across primary tool routes.
 * Tier 3: Core Routing & Lifecycle Engine.
 */

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

    if (nextRoute === 'hub') classes.push('landing-page');
    else if (nextRoute === 'hero-journey') classes.push('hero-journey-page');
    else if (nextRoute === 'damage-calculator') classes.push('damage-calc-page');
    else if (nextRoute === 'account') classes.push('account-page');

    if (hasPlayer || currentClassName.includes('has-player')) {
        classes.push('has-player');
    }

    return classes.join(' ');
}

/**
 * Injects and preloads any destination stylesheets missing from the current document head.
 *
 * @param {Document} newDoc
 * @returns {Promise<void>}
 */
export async function ensureStylesheets(newDoc) {
    if (typeof document === 'undefined') return;

    const newStylesheets = Array.from(newDoc.querySelectorAll('link[rel="stylesheet"]'));
    const pendingPromises = [];

    const normalizeHref = (href) => {
        try {
            return new URL(href, window.location.origin).pathname;
        } catch (_) {
            return href;
        }
    };

    const loadedPathnames = new Set(
        Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'))
            .map(link => normalizeHref(link.getAttribute('href') || ''))
            .filter(Boolean)
    );

    for (const link of newStylesheets) {
        const rawHref = link.getAttribute('href');
        if (!rawHref) continue;

        const normalized = normalizeHref(rawHref);
        if (!loadedPathnames.has(normalized)) {
            loadedPathnames.add(normalized);
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = rawHref;

            const loadPromise = new Promise((resolve) => {
                newLink.onload = () => resolve(undefined);
                newLink.onerror = () => resolve(undefined);
                // Timeout safeguard prevents hanging on slow connections
                setTimeout(() => resolve(undefined), 250);
            });

            pendingPromises.push(loadPromise);
            document.head.appendChild(newLink);
        }
    }

    if (pendingPromises.length > 0) {
        await Promise.all(pendingPromises);
    }
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

    const currentPlaceholder = document.querySelector('.header-placeholder');
    const newPlaceholder = newDoc.querySelector('.header-placeholder');
    if (currentPlaceholder && newPlaceholder) {
        currentPlaceholder.className = newPlaceholder.className;
    }

    const currentPill = currentHeader.querySelector('.brand-page-pill');
    const newPill = newHeader.querySelector('.brand-page-pill');
    if (currentPill && newPill) {
        currentPill.textContent = newPill.textContent;
        const i18nKey = newPill.getAttribute('data-i18n');
        if (i18nKey) currentPill.setAttribute('data-i18n', i18nKey);
        else currentPill.removeAttribute('data-i18n');
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

    const currentHamburger = currentHeader.querySelector('#hamburger-button, .hamburger, .app-header__hamburger');
    const newHamburger = newHeader.querySelector('#hamburger-button, .hamburger, .app-header__hamburger');
    if (currentHamburger) {
        if (newHamburger) {
            currentHamburger.className = newHamburger.className;
        }
        currentHamburger.id = 'hamburger-button';
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
    if (typeof document === 'undefined') return;

    const newModals = newDoc.querySelectorAll('dialog.modal, .modal[id]');
    for (const newModal of newModals) {
        if (!newModal.id) continue;
        if (typeof newModal.closest === 'function' && newModal.closest('#tool-extras')) continue;
        const currentModal = document.getElementById(newModal.id);
        if (!currentModal) {
            document.body.appendChild(newModal.cloneNode(true));
        } else if (newModal.id === 'add-player-modal') {
            currentModal.replaceWith(newModal.cloneNode(true));
        }
    }
    uiHooks.onResetPlayerModal?.();
}
