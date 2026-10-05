/**
 * Tab Navigation & URL Routing for Equipment Damage & ZapQuake Calculator.
 * Tier 4: UI Navigation Controller.
 */

import { persistState } from './damageCalcState.js';

const damageTabScrollPositions = {
    'zapquake': 0,
    'cluster_planner': 0
};

/**
 * Constructs canonical URL for damage calculator tabs, preserving pathname and search parameters.
 *
 * @param {string} tabKey - Tab key (e.g. 'zapquake', 'cluster_planner').
 * @param {string} [pathname] - Pathname override (defaults to window.location.pathname).
 * @param {string} [search] - Search query override (defaults to window.location.search).
 * @returns {string} Canonical URL with preserved query parameters and appropriate hash.
 */
export function constructDamageTabUrl(tabKey, pathname, search) {
    const basePath = pathname !== undefined
        ? pathname
        : (typeof window !== 'undefined' && window.location ? window.location.pathname : '/damage-calculator/');
    const baseSearch = search !== undefined
        ? search
        : (typeof window !== 'undefined' && window.location ? window.location.search : '');
    const cleanTab = tabKey ? tabKey.replace(/-tab$/, '') : '';
    const hash = (!cleanTab || cleanTab === 'zapquake') ? '' : `#${cleanTab}`;
    return `${basePath}${baseSearch}${hash}`;
}

/**
 * Resolves active tab from URL hash and search query string.
 *
 * @param {string} [hash] - URL hash override (defaults to window.location.hash).
 * @param {string} [search] - URL search override (defaults to window.location.search).
 * @returns {string | null} Canonical tab key ('zapquake', 'cluster_planner') or null.
 */
export function resolveDamageTabFromUrl(hash, search) {
    const currentHash = hash !== undefined
        ? hash
        : (typeof window !== 'undefined' && window.location ? window.location.hash : '');
    const currentSearch = search !== undefined
        ? search
        : (typeof window !== 'undefined' && window.location ? window.location.search : '');

    const cleanHash = currentHash ? currentHash.replace(/^#/, '').trim().toLowerCase() : '';
    if (cleanHash) {
        if (cleanHash === 'cluster_planner') return 'cluster_planner';
        if (cleanHash === 'zapquake') return 'zapquake';
    }

    if (currentSearch) {
        try {
            const params = new URLSearchParams(currentSearch);
            const tabParam = params.get('tab')?.trim().toLowerCase();
            if (tabParam) {
                if (tabParam === 'cluster_planner') return 'cluster_planner';
                if (tabParam === 'zapquake') return 'zapquake';
            }
        } catch {}
    }

    return null;
}

/**
 * Switches the active damage calculator tab, updates URL hash, and handles scroll restoration.
 *
 * @param {string} tabKey - Target tab key.
 * @param {Object} state - Damage calculator state.
 * @param {() => void} [onStateChange] - Re-render callback.
 */
export function switchDamageTab(tabKey, state, onStateChange) {
    const cleanTab = tabKey ? tabKey.replace(/-tab$/, '') : '';
    if (!['zapquake', 'cluster_planner'].includes(cleanTab)) return;

    if (state.activeTab === cleanTab) {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            damageTabScrollPositions[cleanTab] = 0;
        }
        return;
    }

    if (state.activeTab && typeof window !== 'undefined') {
        damageTabScrollPositions[state.activeTab] = window.scrollY;
    }

    const targetUrl = constructDamageTabUrl(cleanTab);
    if (typeof window !== 'undefined' && window.history) {
        window.history.pushState(null, '', targetUrl);
    }

    state.activeTab = cleanTab;
    persistState();
    if (typeof onStateChange === 'function') {
        onStateChange();
    }
    if (typeof window !== 'undefined') {
        window.scrollTo({ top: damageTabScrollPositions[cleanTab] || 0, behavior: 'instant' });
    }
}

/**
 * Initializes tab navigation listeners with event delegation and popstate handling.
 *
 * @param {Object} state - Damage calculator state.
 * @param {() => void} onStateChange - Re-render callback.
 */
export function initDamageCalcTabNav(state, onStateChange) {
    if (typeof document === 'undefined' || document.body.dataset.damageTabNavInit) return;
    document.body.dataset.damageTabNavInit = 'true';

    window.addEventListener('popstate', () => {
        const resolved = resolveDamageTabFromUrl();
        const targetTab = resolved || 'zapquake';
        if (!resolved && typeof window !== 'undefined' && window.location.hash) {
            window.history.replaceState(null, '', constructDamageTabUrl('zapquake'));
        }
        if (targetTab === state.activeTab) return;

        if (state.activeTab && typeof window !== 'undefined') {
            damageTabScrollPositions[state.activeTab] = window.scrollY;
        }

        state.activeTab = targetTab;
        persistState();
        if (typeof onStateChange === 'function') {
            onStateChange();
        }
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: damageTabScrollPositions[targetTab] || 0, behavior: 'instant' });
        }
    });

    document.addEventListener('click', (e) => {
        const btn = /** @type {HTMLElement | null} */ (e.target)?.closest('.tab-button, .calc-tab-nav__btn, .nav-button');
        if (!btn) return;
        const rawTab = btn.getAttribute('data-tab');
        if (!rawTab) return;

        const cleanTab = rawTab.replace(/-tab$/, '');
        if (['zapquake', 'cluster_planner'].includes(cleanTab)) {
            switchDamageTab(cleanTab, state, onStateChange);
        }
    });
}
