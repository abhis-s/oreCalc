import { navigationRegistry } from '../../data/navigationRegistry.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { closeFabMenu } from '../fab/fab.js';
import { showUpdateModal } from '../modals/updateModal.js';
import { setAnimateNextRender } from '../planner/calendar.js';
import { openStoredOresModal } from '../planner/priorityListModal.js';

function checkPlannerTabStoredOres() {
    const storedOres = state.storedOres || {};
    const lastUpdated = storedOres.lastUpdated || 0;
    const timeDiff = Date.now() - lastUpdated;

    const isMoreThan48HoursOld = timeDiff > (48 * 60 * 60 * 1000);
    const isMoreThan12HoursOld = timeDiff > (12 * 60 * 60 * 1000);

    const shiny = storedOres.shiny !== undefined ? storedOres.shiny : 0;
    const glowy = storedOres.glowy !== undefined ? storedOres.glowy : 0;
    const starry = storedOres.starry !== undefined ? storedOres.starry : 0;
    const hasAtLeastOneZero = shiny === 0 || glowy === 0 || starry === 0;

    if (isMoreThan48HoursOld || (isMoreThan12HoursOld && hasAtLeastOneZero)) {
        openStoredOresModal();
    }
}

const tabScrollPositions = {
    'home-tab': 0,
    'equipment-tab': 0,
    'income-tab': 0,
    'planner-tab': 0,
    'settings-tab': 0
};

/**
 * Constructs the canonical URL for a given tab, preserving pathname and search parameters.
 *
 * @param {string} tabKey - Tab key or ID (e.g. 'home', 'equipment', 'income', 'planner', 'settings', or 'home-tab').
 * @param {string} [pathname] - Pathname override (defaults to window.location.pathname).
 * @param {string} [search] - Search query override (defaults to window.location.search).
 * @param {string} [hash] - Hash override (defaults to empty string).
 * @returns {string} Relative URL with preserved pathname, query params, and optional hash.
 */
export function constructTabUrl(tabKey, pathname, search, hash = '') {
    const basePath = pathname !== undefined
        ? pathname
        : (typeof window !== 'undefined' && window.location ? window.location.pathname : '/');
    const baseSearch = search !== undefined
        ? search
        : (typeof window !== 'undefined' && window.location ? window.location.search : '');

    const cleanTab = tabKey ? tabKey.replace(/-tab$/, '') : '';
    const searchParams = new URLSearchParams(baseSearch.startsWith('?') ? baseSearch.substring(1) : baseSearch);

    if (!cleanTab || cleanTab === 'home') {
        searchParams.delete('tab');
    } else {
        searchParams.set('tab', cleanTab);
    }

    const query = searchParams.toString();
    const queryPart = query ? `?${query}` : '';
    const cleanHash = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
    return `${basePath}${queryPart}${cleanHash}`;
}

/**
 * Resolves active tab from URL search parameters and legacy hash.
 *
 * @param {string} [search] - URL search query override (defaults to window.location.search).
 * @param {string} [hash] - URL hash override (defaults to window.location.hash).
 * @returns {string} Canonical tab ID (e.g. 'equipment-tab').
 */
export function resolveTabFromUrl(search, hash) {
    const validTabKeys = ['home', 'equipment', 'income', 'planner', 'settings'];
    const currentSearch = search !== undefined
        ? search
        : (typeof window !== 'undefined' && window.location ? window.location.search : '');
    const currentHash = hash !== undefined
        ? hash
        : (typeof window !== 'undefined' && window.location ? window.location.hash : '');

    if (currentSearch) {
        try {
            const params = new URLSearchParams(currentSearch.startsWith('?') ? currentSearch.substring(1) : currentSearch);
            const tabParam = params.get('tab')?.trim().toLowerCase().replace(/-tab$/, '');
            if (tabParam && validTabKeys.includes(tabParam)) {
                return `${tabParam}-tab`;
            }
        } catch {}
    }

    const cleanHash = currentHash ? currentHash.replace(/^#/, '').trim() : '';
    if (cleanHash.startsWith('equip-') || cleanHash.startsWith('hero-')) {
        return 'equipment-tab';
    }

    const lowerHash = cleanHash.toLowerCase().replace(/-tab$/, '');
    if (validTabKeys.includes(lowerHash)) {
        return `${lowerHash}-tab`;
    }

    return 'home-tab';
}

/**
 * Initializes query/hash routing, tab switching click listeners, popstate listeners, and scroll state preservation.
 */
export function initializeTabs() {
    const validTabs = ['home-tab', 'planner-tab', 'equipment-tab', 'income-tab', 'settings-tab'];
    let initialTab = resolveTabFromUrl();

    if (typeof window !== 'undefined' && window.location?.hash) {
        const cleanHash = window.location.hash.replace(/^#/, '').trim().toLowerCase().replace(/-tab$/, '');
        if (['home', 'equipment', 'income', 'planner', 'settings'].includes(cleanHash)) {
            history.replaceState(null, '', constructTabUrl(cleanHash));
        }
    }

    if (!validTabs.includes(initialTab)) {
        history.replaceState(null, '', constructTabUrl('home'));
        initialTab = 'home-tab';
    }
    handleStateUpdate(() => {
        state.activeTab = initialTab;
    }, false, { skipSave: true, skipRecalculate: true, isTabSwitch: true });

    if (initialTab === 'planner-tab') {
        setTimeout(checkPlannerTabStoredOres, 100);
    }

    window.addEventListener('popstate', () => {
        let tabId = resolveTabFromUrl();
        if (typeof window !== 'undefined' && window.location?.hash) {
            const cleanHash = window.location.hash.replace(/^#/, '').trim().toLowerCase().replace(/-tab$/, '');
            if (['home', 'equipment', 'income', 'planner', 'settings'].includes(cleanHash)) {
                history.replaceState(null, '', constructTabUrl(cleanHash));
            }
        }
        if (tabId === state.activeTab) return;

        const tabOrder = navigationRegistry.map(item => `${item.id}-tab`);
        if (!tabOrder.includes(tabId)) {
            history.replaceState(null, '', constructTabUrl('home'));
            tabId = 'home-tab';
        }

        // Save scroll position of current tab
        if (state.activeTab) {
            tabScrollPositions[state.activeTab] = window.scrollY;
        }

        if (tabId === 'planner-tab' && state.activeTab !== 'planner-tab') {
            setAnimateNextRender('all');
            setTimeout(() => {
                checkPlannerTabStoredOres();
            }, 100);
        }
        handleStateUpdate(() => {
            state.activeTab = tabId;
        }, false, { skipSave: true, skipRecalculate: true, isTabSwitch: true });
        window.scrollTo({ top: tabScrollPositions[tabId] || 0, behavior: 'instant' });
    });

    document.body.addEventListener('click', (event) => {
        const button = event.target.closest('[data-tab]');
        if (!button) return;

        closeFabMenu();

        // If clicking on Settings with update pending, trigger the update modal
        if (button.dataset.tab === 'settings' && button.classList.contains('update-pending') && window.__WB__) {
            showUpdateModal(window.__WB__);
        }

        const tabId = `${button.dataset.tab}-tab`;
        if (tabId === state.activeTab) {
            // Re-tapping active tab smoothly scrolls to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            tabScrollPositions[tabId] = 0;
            return;
        }

        // Save scroll position of current tab before switching
        if (state.activeTab) {
            tabScrollPositions[state.activeTab] = window.scrollY;
        }

        if (tabId === 'planner-tab' && state.activeTab !== 'planner-tab') {
            setAnimateNextRender('all');
            setTimeout(() => {
                checkPlannerTabStoredOres();
            }, 100);
        }

        const targetUrl = constructTabUrl(button.dataset.tab);
        history.pushState(null, '', targetUrl);
        handleStateUpdate(() => {
            state.activeTab = tabId;
        }, false, { skipSave: true, skipRecalculate: true, isTabSwitch: true });
        window.scrollTo({ top: tabScrollPositions[tabId] || 0, behavior: 'instant' });
    });
}

/**
 * Resets the cached scroll position for a tab.
 * @param {string} [tabId='home-tab']
 */
export function resetTabScrollPosition(tabId = 'home-tab') {
    if (tabScrollPositions[tabId] !== undefined) {
        tabScrollPositions[tabId] = 0;
    }
}

/**
 * Programmatically navigates to a tab with optional scroll reset.
 * @param {string} tabName
 * @param {Object} [options={}]
 * @param {boolean} [options.resetScroll=false]
 */
export function navigateToTab(tabName, { resetScroll = false } = {}) {
    const tabId = `${tabName}-tab`;
    if (resetScroll) {
        resetTabScrollPosition(tabId);
    }
    const button = document.querySelector(`.tab-button[data-tab="${tabName}"], .nav-button[data-tab="${tabName}"]`);
    if (button) {
        button.click();
    }
}
