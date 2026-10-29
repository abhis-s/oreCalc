/**
 * ClashCalc Persistent App Shell Navigator.
 * Orchestrates seamless client-side view transitions, persistent header/drawer/footer stability,
 * and lifecycle contracts (mount/destroy) across primary tool routes.
 * Tier 3: Core Routing & Lifecycle Engine.
 */

/**
 * @typedef {Object} NavigatorUiHooks
 * @property {() => void} [onResetPlayerDropdown]
 * @property {() => void} [onResetPlayerModal]
 * @property {(mainEl: HTMLElement) => void} [onShowLoader]
 * @property {(options: { activeTool: AppRouteId }) => void} [onUpdateDrawer]
 * @property {(drawerEl: HTMLElement | null) => void} [onCloseDrawer]
 */

/** @type {NavigatorUiHooks} */
let navigatorUiHooks = {};

/**
 * Registers UI presentation lifecycle hooks into the navigator.
 * Decouples core navigation from direct Tier 4 presentation components.
 *
 * @param {NavigatorUiHooks} hooks
 */
export function registerNavigatorUiHooks(hooks) {
    navigatorUiHooks = { ...navigatorUiHooks, ...hooks };
}

/**
 * @typedef {'hub' | 'ore-calculator' | 'hero-journey' | 'damage-calculator' | 'account'} AppRouteId
 */

/**
 * @typedef {Object} RouteLifecycleHandlers
 * @property {(options?: { force?: boolean }) => Promise<void> | void} mount
 * @property {() => void} [destroy]
 */

/** @type {Map<AppRouteId, RouteLifecycleHandlers>} */
const routeHandlers = new Map();

/** @type {AppRouteId | null} */
let currentActiveRoute = null;

/** @type {boolean} */
let isTransitioning = false;

/** @type {{ targetUrl: string, options: { isPopState?: boolean, fromDrawer?: boolean } } | null} */
let pendingNavigation = null;

/** @type {boolean} */
let isNavigatorInitialized = false;

/**
 * Maximum elapsed time allowed for in-app route transition before aborting to a native page load.
 * Prevents hanging transition states during network stalls or delayed module evaluation.
 * @type {number}
 */
export const NAVIGATION_TIMEOUT_MS = 6000;

/**
 * Registry of entry point script paths mapped to primary tool routes.
 * @type {Record<AppRouteId, string>}
 */
export const ROUTE_SCRIPT_MAP = {
    'hub': '/js/landingApp.js',
    'ore-calculator': '/js/app.js',
    'hero-journey': '/js/heroJourneyApp.js',
    'damage-calculator': '/js/damageApp.js',
    'account': '/js/accountApp.js'
};

/**
 * Resolves canonical tool route identifier from a URL pathname.
 * Strips language prefixes and trailing slashes. Rejects external or legal routes.
 *
 * @param {string} pathname
 * @returns {AppRouteId | null}
 */
export function resolveAppRoute(pathname) {
    if (typeof pathname !== 'string') return null;

    // Normalize path by stripping language prefix (/de, /tr, /zh)
    const normalized = pathname.replace(/^\/(?:de|tr|zh)(?=\/|$)/, '') || '/';
    const clean = normalized.replace(/\/+$/, '') || '/';

    if (clean === '/') return 'hub';
    if (clean === '/ore-calculator' || clean.startsWith('/ore-calculator/')) return 'ore-calculator';
    if (clean === '/hero-journey' || clean.startsWith('/hero-journey/')) return 'hero-journey';
    if (clean === '/damage-calculator' || clean.startsWith('/damage-calculator/')) return 'damage-calculator';
    if (clean === '/account' || clean.startsWith('/account/')) return 'account';

    return null;
}

/**
 * Registers lifecycle mount/destroy handlers for a specific tool route.
 *
 * @param {AppRouteId} route
 * @param {RouteLifecycleHandlers} handlers
 */
export function registerAppRoute(route, handlers) {
    if (route && handlers && typeof handlers.mount === 'function') {
        routeHandlers.set(route, handlers);
    }
}

/**
 * Retrieves registered lifecycle handlers for a route.
 *
 * @param {AppRouteId} route
 * @returns {RouteLifecycleHandlers | undefined}
 */
export function getAppRouteHandler(route) {
    return routeHandlers.get(route);
}

/**
 * Determines whether an anchor element is eligible for soft app shell navigation.
 *
 * @param {HTMLAnchorElement | null} anchor
 * @param {MouseEvent} [event]
 * @returns {{ isNavigable: boolean, route: AppRouteId | null, url: URL | null }}
 */
export function isNavigableLink(anchor, event) {
    if (!anchor || typeof anchor.getAttribute !== 'function') {
        return { isNavigable: false, route: null, url: null };
    }

    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return { isNavigable: false, route: null, url: null };
    }

    if (anchor.getAttribute('target') && anchor.getAttribute('target') !== '_self') {
        return { isNavigable: false, route: null, url: null };
    }

    if (anchor.hasAttribute('download') || anchor.hasAttribute('data-modal-target')) {
        return { isNavigable: false, route: null, url: null };
    }

    if (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return { isNavigable: false, route: null, url: null };
        }
    }

    try {
        const base = (typeof window !== 'undefined' && window.location) ? window.location.href : 'http://localhost';
        const url = new URL(href, base);

        if (typeof window !== 'undefined' && window.location && url.origin !== window.location.origin) {
            return { isNavigable: false, route: null, url: null };
        }

        // Ignore same-document hash navigation
        if (typeof window !== 'undefined' && window.location && url.pathname === window.location.pathname && url.search === window.location.search && url.hash) {
            return { isNavigable: false, route: null, url };
        }

        const route = resolveAppRoute(url.pathname);
        if (!route) {
            return { isNavigable: false, route: null, url: null };
        }

        return { isNavigable: true, route, url };
    } catch (_) {
        return { isNavigable: false, route: null, url: null };
    }
}

/**
 * Computes synchronized document.body className across view transitions.
 * Preserves theme mode (dark-mode / light-mode) and active has-player state.
 *
 * @param {string} currentClassName
 * @param {AppRouteId} nextRoute
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
async function ensureStylesheets(newDoc) {
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
 * Synchronizes header brand pill, tab bars, and player dropdown across tools.
 *
 * @param {Document} newDoc
 */
function syncHeaderForRoute(newDoc) {
    const currentHeader = document.querySelector('.app-header');
    const newHeader = newDoc.querySelector('.app-header');
    if (!currentHeader || !newHeader) return;

    currentHeader.className = newHeader.className;

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
        navigatorUiHooks.onResetPlayerDropdown?.();
    } else if (currentDropdown) {
        currentDropdown.remove();
        navigatorUiHooks.onResetPlayerDropdown?.();
    }
}

/**
 * Synchronizes modal dialog elements from destination document into active DOM.
 * Appends new dialogs (such as #add-player-modal) and replaces existing matching dialogs.
 *
 * @param {Document} newDoc
 */
function syncModalsForRoute(newDoc) {
    if (typeof document === 'undefined') return;

    const newModals = newDoc.querySelectorAll('dialog.modal, .modal[id]');
    for (const newModal of newModals) {
        if (!newModal.id) continue;
        const currentModal = document.getElementById(newModal.id);
        if (currentModal) {
            currentModal.replaceWith(newModal.cloneNode(true));
        } else {
            document.body.appendChild(newModal.cloneNode(true));
        }
    }
    navigatorUiHooks.onResetPlayerModal?.();
}

/**
 * Executes seamless soft navigation to a target tool URL.
 *
 * @param {string} targetUrl
 * @param {Object} [options]
 * @param {boolean} [options.isPopState=false]
 * @param {boolean} [options.fromDrawer=false]
 * @returns {Promise<boolean>}
 */
async function navigateTo(targetUrl, options = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    if (isTransitioning) {
        pendingNavigation = { targetUrl, options };
        return false;
    }

    const url = new URL(targetUrl, window.location.href);
    const targetRoute = resolveAppRoute(url.pathname);
    if (!targetRoute) return false;

    // Guard against redundant forward navigation when already on target URL
    if (!options.isPopState && url.pathname === window.location.pathname && url.search === window.location.search && !url.hash) {
        return false;
    }

    isTransitioning = true;

    // Display route transition loader inside main content and tear down previous route extras
    const currentMain = document.getElementById('main-content');
    if (currentMain) {
        navigatorUiHooks.onShowLoader?.(currentMain);
    }
    const currentExtras = document.getElementById('tool-extras');
    if (currentExtras) {
        currentExtras.replaceChildren();
    }
    if (!options.isPopState && !url.hash) {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    if (currentActiveRoute) {
        const activeHandler = routeHandlers.get(currentActiveRoute);
        if (activeHandler && typeof activeHandler.destroy === 'function') {
            try { activeHandler.destroy(); } catch (_) {}
        }
        currentActiveRoute = null;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
        try {
            abortController.abort();
        } catch (_) {}
        window.location.href = url.href;
    }, NAVIGATION_TIMEOUT_MS);

    try {
        const response = await fetch(url.href, { signal: abortController.signal });
        if (!response.ok) {
            clearTimeout(timeoutId);
            window.location.href = url.href;
            return false;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, 'text/html');

        await ensureStylesheets(newDoc);

        const performSwap = async () => {
            document.title = newDoc.title;
            document.body.className = computeSynchronizedBodyClasses(
                document.body.className,
                targetRoute,
                document.documentElement.classList.contains('has-player')
            );

            syncHeaderForRoute(newDoc);
            syncModalsForRoute(newDoc);

            const activeMain = document.getElementById('main-content');
            const newMain = newDoc.getElementById('main-content');
            if (activeMain && newMain) {
                activeMain.replaceWith(newMain.cloneNode(true));
            }

            const activeExtras = document.getElementById('tool-extras');
            const newExtras = newDoc.getElementById('tool-extras');
            if (activeExtras && newExtras) {
                activeExtras.replaceWith(newExtras.cloneNode(true));
            } else if (newExtras) {
                document.body.appendChild(newExtras.cloneNode(true));
            }

            navigatorUiHooks.onUpdateDrawer?.({ activeTool: targetRoute });

            if (!options.isPopState) {
                window.history.pushState({}, document.title, url.href);
            }

            // Mount destination application against the newly swapped DOM
            const registeredHandler = routeHandlers.get(targetRoute);
            if (registeredHandler && typeof registeredHandler.mount === 'function') {
                await registeredHandler.mount({ force: true });
            } else {
                const scriptPath = ROUTE_SCRIPT_MAP[targetRoute];
                if (scriptPath) {
                    const mod = await import(scriptPath);
                    const handler = routeHandlers.get(targetRoute);
                    if (handler && typeof handler.mount === 'function') {
                        await handler.mount({ force: true });
                    } else if (mod && typeof mod.mount === 'function') {
                        await mod.mount({ force: true });
                    }
                }
            }

            currentActiveRoute = targetRoute;
        };

        document.documentElement.dataset.transitionType = 'page-switch';

        const documentWithViewTransition = /** @type {Document & { startViewTransition?: (cb: () => Promise<void>) => { updateCallbackDone?: Promise<void>, finished?: Promise<void> } }} */ (document);
        if (typeof documentWithViewTransition.startViewTransition === 'function') {
            const transition = documentWithViewTransition.startViewTransition(performSwap);
            if (transition.updateCallbackDone) {
                await transition.updateCallbackDone;
            }
            if (transition.finished) {
                try {
                    await transition.finished;
                } catch (_) {
                    // Visual transition animation was skipped by browser engine; DOM swap in performSwap already completed.
                }
            }
        } else {
            await performSwap();
        }

        document.documentElement.removeAttribute('data-transition-type');
        clearTimeout(timeoutId);

        // Manage accessibility focus and scrolling
        if (url.hash) {
            const hashTarget = document.getElementById(url.hash.substring(1));
            if (hashTarget) hashTarget.scrollIntoView({ behavior: 'smooth' });
        } else if (!options.isPopState) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }

        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.setAttribute('tabindex', '-1');
            mainContent.focus({ preventScroll: true });
            mainContent.addEventListener('blur', () => {
                mainContent.removeAttribute('tabindex');
            }, { once: true });
        }

        const announcer = document.getElementById('a11y-announcer');
        if (announcer) {
            announcer.textContent = document.title;
        }

        return true;
    } catch (_) {
        clearTimeout(timeoutId);
        window.location.href = url.href;
        return false;
    } finally {
        isTransitioning = false;
        if (pendingNavigation) {
            const next = pendingNavigation;
            pendingNavigation = null;
            void navigateTo(next.targetUrl, next.options);
        }
    }
}

/**
 * Initializes global click and popstate listeners for the persistent app shell navigator.
 */
export function initAppShellNavigator() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (isNavigatorInitialized) return;
    isNavigatorInitialized = true;

    currentActiveRoute = resolveAppRoute(window.location.pathname) || 'hub';

    document.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement | null} */ (event.target);
        const anchor = target?.closest('a') || null;
        if (!anchor) return;

        const check = isNavigableLink(anchor, event);
        if (!check.isNavigable || !check.url) return;

        event.preventDefault();

        const fromDrawer = Boolean(anchor.closest('.navigation-drawer'));
        if (fromDrawer) {
            const dock = anchor.closest('.navigation-drawer__dock');
            if (dock) {
                dock.querySelectorAll('.navigation-drawer__dock-btn').forEach(btn => {
                    btn.classList.remove('active');
                    btn.removeAttribute('aria-current');
                });
                anchor.classList.add('active');
                anchor.setAttribute('aria-current', 'page');
            }
            const drawerEl = document.getElementById('navigation-drawer');
            navigatorUiHooks.onCloseDrawer?.(drawerEl);
        }

        void navigateTo(check.url.href, { isPopState: false, fromDrawer });
    });

    window.addEventListener('popstate', () => {
        void navigateTo(window.location.href, { isPopState: true });
    });
}
