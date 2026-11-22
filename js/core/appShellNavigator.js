/**
 * ClashCalc Persistent App Shell Navigator.
 * Orchestrates seamless client-side view transitions, persistent header/drawer/footer stability,
 * and lifecycle contracts (mount/destroy) across primary tool routes.
 * Tier 3: Core Routing & Lifecycle Engine.
 */

import { isModalHistoryPopping, dismissModalsForNavigation } from '../utils/modalHistoryManager.js';
import { APP_ROUTES } from '../data/appRoutesData.js';
import { findRouteByPath, registerLanguageUrlSyncHandler } from './languageRouter.js';
import {
    computeSynchronizedBodyClasses,
    ensureStylesheets,
    syncRouteStylesheets,
    syncHeadForRoute,
    syncHeaderForRoute,
    syncModalsForRoute
} from './appShellDomSync.js';

/**
 * @typedef {Object} NavigatorUiHooks
 * @property {() => void} [onResetPlayerDropdown]
 * @property {() => void} [onResetPlayerModal]
 * @property {(mainEl: HTMLElement) => void} [onShowLoader]
 * @property {(options: { activeTool: AppRouteId }) => void} [onUpdateDrawer]
 * @property {(drawerEl: HTMLElement | null) => void} [onCloseDrawer]
 * @property {(routeId: AppRouteId) => void} [onAfterRouteSwap]
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
 * @typedef {'hub' | 'ore-calculator' | 'hero-journey' | 'damage-calculator' | 'account' | 'app-management'} AppRouteId
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

/** @type {string} */
let lastCommittedPathname = '';

/** @type {boolean} */
let isTransitioning = false;

/** @type {{ targetUrl: string, options: { isPopState?: boolean, fromDrawer?: boolean, replaceHistory?: boolean } } | null} */
let pendingNavigation = null;

const boundNavigatorDocs = new WeakSet();

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
export const ROUTE_SCRIPT_MAP = /** @type {Record<AppRouteId, string>} */ (
    Object.freeze(Object.fromEntries(APP_ROUTES.map(route => [route.id, route.script])))
);

/**
 * Resolves canonical tool route identifier from a URL pathname.
 * Strips language prefixes and trailing slashes. Rejects external or legal routes.
 *
 * @param {string} pathname
 * @returns {AppRouteId | null}
 */
export function resolveAppRoute(pathname) {
    return findRouteByPath(pathname)?.id || null;
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
 * Reports whether the persistent app shell navigator is currently executing a route transition.
 * Used by bootstrap lifecycles to suppress duplicate initial mounts during dynamic route imports.
 *
 * @returns {boolean}
 */
export function isNavigatorTransitioning() {
    return isTransitioning;
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

    const hasModalTarget = Boolean(
        (typeof anchor.hasAttribute === 'function' && (
            anchor.hasAttribute('data-modal-target') ||
            anchor.hasAttribute('data-dialog-target') ||
            anchor.hasAttribute('data-modal-dismiss')
        )) ||
        (typeof anchor.closest === 'function' && anchor.closest('[data-modal-target], [data-dialog-target], [data-modal-dismiss]'))
    );
    if ((typeof anchor.hasAttribute === 'function' && anchor.hasAttribute('download')) || hasModalTarget) {
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

        const routeObj = findRouteByPath(url.pathname);
        if (!routeObj || routeObj.requiresStandalone) {
            return { isNavigable: false, route: null, url: null };
        }

        return { isNavigable: true, route: routeObj.id, url };
    } catch (_) {
        return { isNavigable: false, route: null, url: null };
    }
}

/**
 * Executes seamless soft navigation to a target tool URL.
 *
 * @param {string} targetUrl
 * @param {Object} [options]
 * @param {boolean} [options.isPopState=false]
 * @param {boolean} [options.fromDrawer=false]
 * @param {boolean} [options.replaceHistory=false]
 * @returns {Promise<boolean>}
 */
async function navigateTo(targetUrl, options = {}) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;

    const url = new URL(targetUrl, window.location.href);
    const routeObj = findRouteByPath(url.pathname);
    if (!routeObj || routeObj.requiresStandalone) return false;
    const targetRoute = routeObj.id;

    // Guard against redundant navigation when already on target URL and route
    if (options.isPopState) {
        const committedPathname = (new URL(lastCommittedPathname || window.location.href, window.location.origin)).pathname;
        if (targetRoute === currentActiveRoute && url.pathname === committedPathname) {
            lastCommittedPathname = url.pathname + url.search;
            return false;
        }
    } else {
        if (url.pathname === window.location.pathname && url.search === window.location.search && !url.hash) {
            return false;
        }
    }

    if (isTransitioning) {
        pendingNavigation = { targetUrl, options };
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
    let didCommitHistory = false;
    const fallbackHardNavigate = () => {
        if (didCommitHistory) {
            if (typeof window.location.replace === 'function') {
                window.location.replace(url.href);
            }
            if (url.hash && typeof window.location.reload === 'function') {
                window.location.reload();
            }
        } else {
            window.location.href = url.href;
        }
    };
    const timeoutId = setTimeout(() => {
        try {
            abortController.abort();
        } catch (_) {}
        fallbackHardNavigate();
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
            syncHeadForRoute(newDoc);
            syncRouteStylesheets(newDoc);
            document.body.className = computeSynchronizedBodyClasses(
                document.body.className,
                targetRoute,
                document.documentElement.classList.contains('has-player')
            );

            syncHeaderForRoute(newDoc, navigatorUiHooks);
            syncModalsForRoute(newDoc, navigatorUiHooks);

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
            } else if (activeExtras) {
                activeExtras.innerHTML = '';
            }

            // Commit destination URL and route before drawer updates and app mounts read window.location
            if (!options.isPopState) {
                const shouldReplace = Boolean(options.replaceHistory) ||
                    Boolean(typeof window !== 'undefined' && window.history?.state?.modalStateId) ||
                    (typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === false);
                if (shouldReplace && typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function') {
                    window.history.replaceState({}, document.title, url.href);
                    didCommitHistory = true;
                } else if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
                    window.history.pushState({}, document.title, url.href);
                    didCommitHistory = true;
                }
            }

            currentActiveRoute = targetRoute;
            lastCommittedPathname = url.pathname + url.search;

            navigatorUiHooks.onUpdateDrawer?.({ activeTool: targetRoute });
            navigatorUiHooks.onAfterRouteSwap?.(targetRoute);

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
        };

        document.documentElement.dataset.transitionType = 'page-switch';

        const documentWithViewTransition = /** @type {Document & { startViewTransition?: (cb: () => Promise<void>) => { updateCallbackDone?: Promise<void>, finished?: Promise<void>, ready?: Promise<void> } }} */ (document);
        if (typeof documentWithViewTransition.startViewTransition === 'function' && !document.hidden) {
            let updateCallbackFailed = false;
            try {
                const transition = documentWithViewTransition.startViewTransition(async () => {
                    try {
                        await performSwap();
                    } catch (swapErr) {
                        updateCallbackFailed = true;
                        throw swapErr;
                    }
                });
                transition.ready?.catch(() => {});
                transition.finished?.catch(() => {});
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
            } catch (err) {
                if (updateCallbackFailed) {
                    throw err;
                }
                await performSwap();
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
        fallbackHardNavigate();
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
 * Synchronizes the last committed pathname and search string when the URL is updated
 * externally (e.g. by languageRouter.syncLanguageUrl).
 *
 * @param {string} pathAndSearch
 */
export function syncLastCommittedPathname(pathAndSearch) {
    if (typeof pathAndSearch === 'string' && pathAndSearch) {
        lastCommittedPathname = pathAndSearch;
    }
}

// Automatically subscribe to language router URL sync updates
registerLanguageUrlSyncHandler((pathAndSearch) => {
    syncLastCommittedPathname(pathAndSearch);
});

/**
 * Initializes global click and popstate listeners for the persistent app shell navigator.
 */
export function initAppShellNavigator() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    currentActiveRoute = resolveAppRoute(window.location.pathname) || 'hub';
    lastCommittedPathname = (window.location.pathname || '/') + (window.location.search || '');
    if (boundNavigatorDocs.has(document)) return;
    boundNavigatorDocs.add(document);

    document.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement | null} */ (event.target);
        const anchor = target?.closest('a') || null;
        if (!anchor) return;

        const check = isNavigableLink(anchor, event);
        if (!check.isNavigable || !check.url) return;

        event.preventDefault();

        const fromDrawer = Boolean(anchor.closest('.navigation-drawer'));
        const isSamePage = Boolean(
            typeof window !== 'undefined' &&
            check.url.pathname === window.location.pathname &&
            check.url.search === window.location.search &&
            !check.url.hash
        );

        if (isSamePage) {
            if (fromDrawer) {
                const drawerEl = document.getElementById('navigation-drawer');
                navigatorUiHooks.onCloseDrawer?.(drawerEl);
            }
            return;
        }

        if (fromDrawer) {
            const dock = anchor.closest('.navigation-drawer__dock');
            if (dock) {
                dock.querySelectorAll('.navigation-drawer__dock-btn').forEach(btn => {
                    btn.classList.remove('is-active');
                    btn.removeAttribute('aria-current');
                });
                anchor.classList.add('is-active');
                anchor.setAttribute('aria-current', 'page');
            }
        }

        const hadModal = dismissModalsForNavigation();
        const replaceHistory = fromDrawer || hadModal || Boolean(window.history?.state?.modalStateId);

        void navigateTo(check.url.href, { isPopState: false, fromDrawer, replaceHistory });
    });

    window.addEventListener('popstate', (event) => {
        if (typeof isModalHistoryPopping === 'function' && isModalHistoryPopping()) {
            return;
        }
        if (event?.state && event.state.modalStateId) {
            return;
        }

        const targetUrl = new URL(window.location.href);
        const targetRoute = resolveAppRoute(targetUrl.pathname);
        if (!targetRoute) return;

        // If staying on the same active tool route and pathname (e.g. tab/query changes or modal pop),
        // do not trigger a full tool route transition.
        const committedPathname = (new URL(lastCommittedPathname || window.location.href, window.location.origin)).pathname;
        if (targetRoute === currentActiveRoute && targetUrl.pathname === committedPathname) {
            lastCommittedPathname = targetUrl.pathname + targetUrl.search;
            return;
        }

        void navigateTo(window.location.href, { isPopState: true });
    });
}
