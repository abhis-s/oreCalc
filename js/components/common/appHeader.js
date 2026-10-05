import { initNavigationDrawer } from './navigationDrawer.js';
import {
    HEADER_BREAKPOINT_DESKTOP,
    HEADER_DROPDOWN_COMFORTABLE_WIDTH,
    HEADER_DROPDOWN_MIN_WIDTH
} from '../../core/constants.js';

/**
 * @typedef {Object} AppHeaderOptions
 * @property {HTMLElement | string | null} [headerElement] - Target header container element or selector.
 * @property {boolean} [hasTabs=false] - Whether the header includes tab bar navigation.
 * @property {boolean} [hasPlayerDropdown=false] - Whether the header includes a player selector dropdown.
 * @property {boolean} [hasPill=true] - Whether the brand lockup includes a tool page pill.
 * @property {boolean} [bindDrawer=false] - Whether to automatically bind navigation drawer to hamburger button.
 * @property {number} [dropdownComfortableWidth=140] - Minimum width reserved for dropdown before pill collapse.
 * @property {number} [dropdownMin=76] - Absolute minimum dropdown width before minimal brand mode.
 * @property {(tag: string) => void} [onPlayerSelect] - Callback when a player is selected from the dropdown.
 * @property {(tag: string) => void} [onPlayerDelete] - Callback when a player is deleted from the dropdown.
 * @property {() => void} [onPlayerAdd] - Callback when the add player button is clicked.
 */

/**
 * Sets up an off-main-thread IntersectionObserver scroll sentinel for sticky header elevation.
 * @param {HTMLElement} header
 * @returns {() => void} Cleanup function to disconnect the observer.
 */
export function initAppHeaderScrollObserver(header) {
    if (!header || typeof document === 'undefined') return () => {};

    let sentinel = document.querySelector('.app-header-sentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.className = 'app-header-sentinel';
        sentinel.style.cssText = 'position: absolute; top: 5px; left: 0; width: 1px; height: 1px; pointer-events: none; opacity: 0; z-index: -1;';
        if (typeof document.body?.prepend === 'function') {
            document.body.prepend(sentinel);
        } else if (typeof document.body?.appendChild === 'function') {
            document.body.appendChild(sentinel);
        }
    }

    if (typeof IntersectionObserver === 'undefined') return () => {};

    const observer = new IntersectionObserver(([entry]) => {
        header.classList.toggle('is-scrolled', !entry.isIntersecting);
    });

    observer.observe(sentinel);

    return () => {
        observer.disconnect();
    };
}

/**
 * Binds universal hover, focus, and scroll dismissal behaviors to a player dropdown container.
 * @param {HTMLElement} dropdownContainer
 * @returns {() => void} Cleanup function to remove event listeners.
 */
export function initAppHeaderPlayerDropdownInteractions(dropdownContainer) {
    if (!dropdownContainer) return () => {};

    const dropdownButton = dropdownContainer.querySelector('.player-dropdown-button, #player-dropdown-button');
    const dropdownList = dropdownContainer.querySelector('.player-dropdown-list, #player-dropdown-list');
    const chevron = dropdownContainer.querySelector('.dropdown-arrow');

    if (!dropdownButton || !dropdownList) return () => {};

    let closeTimer = null;

    const openDropdown = () => {
        if (closeTimer) clearTimeout(closeTimer);
        dropdownList.classList.add('show');
        dropdownButton.classList.add('open');
        dropdownButton.setAttribute('aria-expanded', 'true');
        if (chevron) {
            const useEl = chevron.querySelector('use');
            if (useEl) {
                useEl.setAttribute('href', '#icon-chevron-up');
                useEl.setAttribute('xlink:href', '#icon-chevron-up');
            }
        }
    };

    const closeDropdown = () => {
        dropdownList.classList.remove('show');
        dropdownButton.classList.remove('open');
        dropdownButton.setAttribute('aria-expanded', 'false');
        if (chevron) {
            const useEl = chevron.querySelector('use');
            if (useEl) {
                useEl.setAttribute('href', '#icon-chevron-down');
                useEl.setAttribute('xlink:href', '#icon-chevron-down');
            }
        }
    };

    const scheduleClose = () => {
        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(closeDropdown, 120);
    };

    const onMouseEnter = () => {
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
            openDropdown();
        }
    };

    const onMouseLeave = () => {
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover)').matches) {
            scheduleClose();
        }
    };

    const onFocusIn = () => {
        openDropdown();
    };

    const onFocusOut = (e) => {
        if (!dropdownContainer.contains(/** @type {Node} */ (e.relatedTarget))) {
            closeDropdown();
        }
    };

    const onScroll = () => {
        if (dropdownList.classList.contains('show')) {
            closeDropdown();
        }
    };

    dropdownContainer.addEventListener('mouseenter', onMouseEnter);
    dropdownContainer.addEventListener('mouseleave', onMouseLeave);
    dropdownContainer.addEventListener('focusin', onFocusIn);
    dropdownContainer.addEventListener('focusout', onFocusOut);

    if (typeof window !== 'undefined') {
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
        if (closeTimer) clearTimeout(closeTimer);
        dropdownContainer.removeEventListener('mouseenter', onMouseEnter);
        dropdownContainer.removeEventListener('mouseleave', onMouseLeave);
        dropdownContainer.removeEventListener('focusin', onFocusIn);
        dropdownContainer.removeEventListener('focusout', onFocusOut);
        if (typeof window !== 'undefined') {
            window.removeEventListener('scroll', onScroll);
        }
    };
}

/**
 * Queries the first matching selector safely across environments.
 * @param {ParentNode | null} parent
 * @param {string[]} selectors
 * @returns {Element | null}
 */
function queryFirst(parent, selectors) {
    if (!parent || typeof parent.querySelector !== 'function') return null;
    for (const selector of selectors) {
        try {
            const el = parent.querySelector(selector);
            if (el) return el;
        } catch (_) {}
    }
    return null;
}

/**
 * Initializes universal responsive geometry calculation and ResizeObserver on an application header.
 *
 * @param {HTMLElement} header
 * @param {AppHeaderOptions} [options={}]
 * @returns {{ updateLayout: () => void, resetCache: () => void, disconnect: () => void }}
 */
function observeAppHeaderLayout(header, options = {}) {
    const inner = queryFirst(header, ['.app-header__inner', '.header-inner', '.hero-journey-page__header-inner', '.landing-header__inner']) || header;
    const brand = queryFirst(inner, ['.app-header__brand', '.header-brand', '.hero-journey-page__brand', '.landing-header__brand-group'])
        || queryFirst(header, ['.app-header__brand', '.header-brand', '.hero-journey-page__brand', '.landing-header__brand-group']);
    const tabBar = queryFirst(inner, ['.app-header__tabs', '.tab-bar-container'])
        || queryFirst(header, ['.app-header__tabs', '.tab-bar-container']);
    const playerDropdown = queryFirst(inner, ['.app-header__player-dropdown', '.player-dropdown-container'])
        || queryFirst(header, ['.app-header__player-dropdown', '.player-dropdown-container']);
    const actions = queryFirst(inner, ['.app-header__actions', '.data-buttons-container', '.hero-journey-page__header-actions', '.landing-header__actions'])
        || queryFirst(header, ['.app-header__actions', '.data-buttons-container', '.hero-journey-page__header-actions', '.landing-header__actions']);
    const hamburger = queryFirst(brand, ['.app-header__hamburger', '.hamburger', '.hj-hamburger'])
        || queryFirst(inner, ['.app-header__hamburger', '.hamburger', '.hj-hamburger'])
        || queryFirst(header, ['.app-header__hamburger', '.hamburger', '.hj-hamburger']);

    let cachedBrandTitleWidth = 0;
    let cachedSeparatorWidth = 0;
    let cachedPillWidth = 0;
    let cachedActionsWidth = 0;
    let cachedNormalTabsWidth = 0;
    let cachedCompactTabsWidth = 0;

    const dropdownComfortable = options.dropdownComfortableWidth || HEADER_DROPDOWN_COMFORTABLE_WIDTH;
    const dropdownMin = options.dropdownMin || HEADER_DROPDOWN_MIN_WIDTH;
    const hasTabs = Boolean(options.hasTabs || tabBar);
    const hasPill = options.hasPill !== false;

    const resetCache = () => {
        cachedBrandTitleWidth = 0;
        cachedSeparatorWidth = 0;
        cachedPillWidth = 0;
        cachedActionsWidth = 0;
        cachedNormalTabsWidth = 0;
        cachedCompactTabsWidth = 0;
    };

    const updateLayout = () => {
        if (!inner || !brand) return;

        let containerWidth = inner.clientWidth;
        if (inner === header && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            const s = window.getComputedStyle(header);
            const pl = parseFloat(s.paddingLeft) || 0;
            const pr = parseFloat(s.paddingRight) || 0;
            if (pl + pr > 0) {
                containerWidth = Math.max(0, containerWidth - pl - pr);
            }
        }
        if (containerWidth <= 0) return;

        const brandTitle = brand.querySelector('.brand-title-link');
        const separator = brand.querySelector('.brand-separator');
        const pill = brand.querySelector('.brand-page-pill');

        if (brandTitle && brandTitle.offsetWidth > 0) cachedBrandTitleWidth = brandTitle.offsetWidth;
        if (separator && separator.offsetWidth > 0) cachedSeparatorWidth = separator.offsetWidth;
        if (pill && pill.offsetWidth > 0) cachedPillWidth = pill.offsetWidth;
        if (actions && actions.offsetWidth > 0) cachedActionsWidth = actions.offsetWidth;

        const isCompactTabsActive = tabBar?.classList.contains('is-compact') || false;
        if (tabBar && tabBar.offsetWidth > 0) {
            if (isCompactTabsActive) {
                if (!cachedNormalTabsWidth || tabBar.offsetWidth < cachedNormalTabsWidth) {
                    cachedCompactTabsWidth = tabBar.offsetWidth;
                }
            } else {
                cachedNormalTabsWidth = tabBar.offsetWidth;
            }
        }

        const isMobile = (typeof window !== 'undefined' && window.matchMedia)
            ? window.matchMedia(`(max-width: ${HEADER_BREAKPOINT_DESKTOP - 1}px)`).matches
            : false;

        const isHamburgerVisible = Boolean(hamburger && (!hasTabs || isMobile) && (typeof window.getComputedStyle === 'function' ? window.getComputedStyle(hamburger).display !== 'none' : true));
        const hamburgerWidth = isHamburgerVisible ? 40 : 0;

        const brandTitleWidth = cachedBrandTitleWidth || 83;
        const separatorWidth = (hasPill && separator) ? (cachedSeparatorWidth || 5) : 0;
        const pillWidth = (hasPill && pill) ? (cachedPillWidth || 64) : 0;
        const actionsWidth = cachedActionsWidth || 36;

        const fullBrandWidth = hamburgerWidth + brandTitleWidth + separatorWidth + pillWidth + (isHamburgerVisible ? 24 : 16);
        const compactBrandWidth = hamburgerWidth + brandTitleWidth + (isHamburgerVisible ? 8 : 0);

        if (hasTabs && tabBar && !isMobile) {
            const isGerman = typeof document !== 'undefined' && document.documentElement?.lang === 'de';
            const tabDelta = isGerman ? 112 : 80;
            const fallbackNormal = isGerman ? 509 : 408;
            const fallbackCompact = isGerman ? 397 : 328;
            const normalTabsWidth = cachedNormalTabsWidth || (cachedCompactTabsWidth ? cachedCompactTabsWidth + tabDelta : fallbackNormal);
            const compactTabsWidth = cachedCompactTabsWidth || (cachedNormalTabsWidth ? Math.max(0, cachedNormalTabsWidth - tabDelta) : fallbackCompact);
            const dropdownWidth = playerDropdown?.offsetWidth || dropdownComfortable;
            const rightControlsWidth = dropdownWidth + actionsWidth + 24;
            const desktopMargin = 16;
            const minCompactMargin = 8;

            const requiredFullBrandFullTabs = fullBrandWidth + normalTabsWidth + rightControlsWidth + (2 * desktopMargin);
            const requiredCompactBrandFullTabs = compactBrandWidth + normalTabsWidth + rightControlsWidth + (2 * desktopMargin);
            const requiredCompactBrandCompactTabs = compactBrandWidth + compactTabsWidth + rightControlsWidth + (2 * minCompactMargin);

            if (containerWidth >= requiredFullBrandFullTabs) {
                brand.classList.remove('is-compact', 'is-minimal');
                tabBar.classList.remove('is-compact');
            } else if (containerWidth >= requiredCompactBrandFullTabs) {
                brand.classList.add('is-compact');
                brand.classList.remove('is-minimal');
                tabBar.classList.remove('is-compact');
            } else if (containerWidth >= requiredCompactBrandCompactTabs) {
                brand.classList.add('is-compact');
                brand.classList.remove('is-minimal');
                tabBar.classList.add('is-compact');
            } else {
                brand.classList.add('is-compact', 'is-minimal');
                tabBar.classList.add('is-compact');
            }
        } else {
            const gap = 12;
            const singleRowFullWidth = fullBrandWidth + dropdownComfortable + actionsWidth + (2 * gap);
            const singleRowCompactWidth = compactBrandWidth + dropdownMin + actionsWidth + (2 * gap);

            const nextCompact = containerWidth < singleRowFullWidth;
            const nextMinimal = containerWidth < singleRowCompactWidth;

            brand.classList.toggle('is-compact', nextCompact);
            brand.classList.toggle('is-minimal', nextMinimal);
        }
    };

    let resizeObserver = null;
    let lastWidth = inner.clientWidth;

    if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver((entries) => {
            const width = entries[0]?.contentRect?.width;
            if (typeof width === 'number' && Math.abs(width - lastWidth) > 1) {
                lastWidth = width;
                if (typeof window !== 'undefined' && window.requestAnimationFrame) {
                    window.requestAnimationFrame(updateLayout);
                } else {
                    updateLayout();
                }
            }
        });
        resizeObserver.observe(inner);
    }

    updateLayout();

    return {
        updateLayout,
        resetCache,
        disconnect: () => {
            if (resizeObserver) resizeObserver.disconnect();
        }
    };
}

/**
 * Master initialization entry point for the modular application header.
 *
 * @param {AppHeaderOptions} [options={}]
 * @returns {{
 *   destroy: () => void,
 *   updateLayout: () => void,
 *   resetCache: () => void
 * }}
 */
export function initAppHeader(options = {}) {
    if (typeof document === 'undefined') {
        return { destroy: () => {}, updateLayout: () => {}, resetCache: () => {} };
    }

    const header = (typeof options.headerElement === 'string')
        ? document.querySelector(options.headerElement)
        : (options.headerElement || queryFirst(document, ['.app-header', '.header-container', '.hero-journey-page__header', '.landing-header']));

    if (!header) {
        return { destroy: () => {}, updateLayout: () => {}, resetCache: () => {} };
    }

    const cleanups = [];

    // Off-main-thread scroll sentinel elevation
    const cleanupScroll = initAppHeaderScrollObserver(/** @type {HTMLElement} */ (header));
    cleanups.push(cleanupScroll);

    // Responsive geometry observer
    const geometry = observeAppHeaderLayout(/** @type {HTMLElement} */ (header), options);
    cleanups.push(geometry.disconnect);

    // Player dropdown interaction lifecycle
    const dropdown = queryFirst(header, ['.app-header__player-dropdown', '.player-dropdown-container']);
    if (dropdown && options.hasPlayerDropdown !== false) {
        const cleanupDropdown = initAppHeaderPlayerDropdownInteractions(/** @type {HTMLElement} */ (dropdown));
        cleanups.push(cleanupDropdown);
    }

    // Hamburger drawer binding
    if (options.bindDrawer === true) {
        const hamburger = queryFirst(header, ['.app-header__hamburger', '.hamburger', '.hj-hamburger']);
        if (hamburger) {
            const drawerInstance = initNavigationDrawer({ buttonEl: /** @type {HTMLElement} */ (hamburger) });
            cleanups.push(() => drawerInstance.destroy());
        }
    }

    const instance = {
        updateLayout: geometry.updateLayout,
        resetCache: geometry.resetCache,
        destroy: () => {
            cleanups.forEach(fn => {
                try { fn(); } catch (_) {}
            });
        }
    };

    return instance;
}
