/**
 * Search, Filter, View-Mode, and Supercharge Input Listeners for Damage Calculator.
 * Tier 4: User Inputs (Dedicated exclusively to event listener attachments and state dispatching).
 */

import {
    damageCalcState,
    persistState,
    setGlobalSuperchargeTier
} from './damageCalcState.js';
import { translate } from '../../i18n/translator.js';
import { updateClusterBuildingGridForSearch } from './damageCalcDefenseBoardDisplay.js';

/** @type {number | null} */
let _searchRafId = null;

/**
 * Attaches search, building filter tab, view mode, supercharge, and remaining-targets listeners.
 *
 * @param {any} state - Damage calculator state.
 * @param {HTMLElement} rootContainer - Root container element.
 * @param {() => void} onStateChange - Re-render callback.
 */
export function attachDamageCalcFilterListeners(state, rootContainer, onStateChange) {
    // Applies buildingFilter + searchQuery as a pure DOM show/hide on existing Tab 1 combo cards.
    // Never recalculates combo damage math — only runs when filter/search changes, not on data changes.
    const applyZqDomFilter = (query, buildingFilter) => {
        const layout = /** @type {HTMLElement | null} */ (rootContainer.querySelector('.calc-view-combos-layout'));
        if (!layout) return;
        const q = (query || '').trim().toLowerCase();
        const bf = buildingFilter || 'all';
        const tierMap = { defenses: 1, heroes: 2, guardians: 3, other: 4 };
        const requiredTier = tierMap[bf] || null;

        let anyComboVisible = false;
        layout.querySelectorAll('.calc-combo-card').forEach((comboCard) => {
            const defCards = comboCard.querySelectorAll('.calc-combo-defense-card[data-building-key]');
            let anyVisible = false;
            defCards.forEach((defCard) => {
                const key = defCard.getAttribute('data-building-key') || '';
                const title = defCard.getAttribute('title') || '';
                const cardTier = Number(defCard.getAttribute('data-tier') || 0);
                const tierOk = !requiredTier || cardTier === requiredTier;
                const queryOk = !q || key.includes(q) || title.toLowerCase().includes(q);
                const visible = tierOk && queryOk;
                /** @type {HTMLElement} */ (defCard).style.display = visible ? '' : 'none';
                if (visible) anyVisible = true;
            });
            const comboVisible = !defCards.length || anyVisible;
            /** @type {HTMLElement} */ (comboCard).style.display = comboVisible ? '' : 'none';
            if (comboVisible) anyComboVisible = true;
        });

        // Remaining section: filter independently
        layout.querySelectorAll('.calc-remaining-container .calc-combo-defense-card[data-building-key]').forEach((defCard) => {
            const key = defCard.getAttribute('data-building-key') || '';
            const title = defCard.getAttribute('title') || '';
            const cardTier = Number(defCard.getAttribute('data-tier') || 0);
            const tierOk = !requiredTier || cardTier === requiredTier;
            const queryOk = !q || key.includes(q) || title.toLowerCase().includes(q);
            /** @type {HTMLElement} */ (defCard).style.display = (tierOk && queryOk) ? '' : 'none';
        });

        // Empty state: show notice when all combo cards are hidden
        const combosContainer = /** @type {HTMLElement | null} */ (layout.querySelector('.calc-combos-container'));
        if (combosContainer) {
            let notice = combosContainer.querySelector('.calc-empty-notice');
            if (!anyComboVisible) {
                if (!notice) {
                    notice = document.createElement('div');
                    notice.className = 'calc-empty-notice';
                    notice.innerHTML = `
                        <p class="calc-empty-notice__text">${translate('views.damageCalc.filters.noTargetsMatchFilter')}</p>
                        <button type="button" class="btn-secondary calc-empty-notice__btn" data-action="reset-zq-filters">
                            <clashcalc-assets-svg name="close" width="12" height="12"></clashcalc-assets-svg>
                            <span>${translate('views.damageCalc.filters.resetFiltersBtn')}</span>
                        </button>
                    `;
                    combosContainer.appendChild(notice);
                }
            } else if (notice) {
                notice.remove();
            }
        }

        // Sync clear button
        const sw = layout.querySelector('.calc-view-search-wrapper');
        if (sw) {
            const existingClearBtn = sw.querySelector('[data-action="clear-zq-search"]');
            if (q && !existingClearBtn) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'calc-search-clear-btn';
                btn.setAttribute('data-action', 'clear-zq-search');
                btn.setAttribute('aria-label', translate('views.heroJourney.page.clearSearch'));
                btn.innerHTML = '<clashcalc-assets-svg name="close" width="12" height="12"></clashcalc-assets-svg>';
                sw.appendChild(btn);
            } else if (!q && existingClearBtn) {
                existingClearBtn.remove();
            }
        }

        // Sync filter tab active state
        layout.querySelectorAll('.calc-filter-tab[data-zq-filter]').forEach((tab) => {
            const tabFilter = tab.getAttribute('data-zq-filter') || 'all';
            const isActive = tabFilter === bf;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
        });
    };

    // Search inputs — targeted DOM update per tab (no onStateChange/persistState per keystroke)
    const bindSearchInput = (inputId, setVal) => {
        const input = /** @type {HTMLInputElement | null} */ (rootContainer.querySelector(`#${inputId}`));
        if (!input || input.dataset.hasListener) return;
        input.dataset.hasListener = 'true';
        input.addEventListener('input', (e) => {
            const val = /** @type {HTMLInputElement} */ (e.target).value;
            setVal(val);
            // Coalesce rapid keystrokes — cancel any pending frame before scheduling a new one
            if (_searchRafId !== null) cancelAnimationFrame(_searchRafId);
            _searchRafId = requestAnimationFrame(() => {
                _searchRafId = null;
                if (inputId === 'zq-search-input') {
                    const query = val.trim().toLowerCase();
                    // Tab 2 (Cluster Planner): update only .calc-building-grid
                    const clusterView = /** @type {HTMLElement | null} */ (rootContainer.querySelector('.calc-view--cluster'));
                    if (clusterView) {
                        updateClusterBuildingGridForSearch(state, rootContainer);
                        const sw = clusterView.querySelector('.calc-view-search-wrapper');
                        if (sw) {
                            const existingClearBtn = sw.querySelector('[data-action="clear-zq-search"]');
                            if (query && !existingClearBtn) {
                                const btn = document.createElement('button');
                                btn.type = 'button';
                                btn.className = 'calc-search-clear-btn';
                                btn.setAttribute('data-action', 'clear-zq-search');
                                btn.setAttribute('aria-label', translate('views.heroJourney.page.clearSearch'));
                                btn.innerHTML = '<clashcalc-assets-svg name="close" width="12" height="12"></clashcalc-assets-svg>';
                                sw.appendChild(btn);
                            } else if (!query && existingClearBtn) {
                                existingClearBtn.remove();
                            }
                        }
                        return;
                    }
                    // Tab 1 (ZapQuake): shared DOM filter — handles query + buildingFilter, empty state, clear button
                    applyZqDomFilter(val, state.zapQuake?.buildingFilter || 'all');
                }
            });
        });

        // Persist state on blur — no re-render, avoids double-render when clicking clear/reset
        input.addEventListener('blur', () => {
            persistState();
        });

        if (inputId === 'zq-search-input') {
            input.addEventListener('focus', () => {
                const dock = document.getElementById('calc-mobile-spell-dock');
                if (dock && !state.zapQuake?.mobileDockExpanded) {
                    dock.classList.add('is-hidden');
                }
            });
            input.addEventListener('blur', () => {
                const dock = document.getElementById('calc-mobile-spell-dock');
                if (dock) {
                    dock.classList.remove('is-hidden');
                }
            });
        }
    };

    bindSearchInput('zq-search-input', (v) => { state.zapQuake.searchQuery = v; });

    const superchargePills = rootContainer.querySelectorAll('.calc-supercharge-pill[data-prefix="zq_combo"]');
    superchargePills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            const tier = Number(/** @type {HTMLElement} */ (e.currentTarget).dataset.tier) || 0;
            setGlobalSuperchargeTier(tier);
            if (state && state !== damageCalcState) {
                state.globalSuperchargeTier = tier;
            }
            onStateChange();
        });
    });

    const superchargeSelect = rootContainer.querySelector('#zq_combo-supercharge-select');
    if (superchargeSelect) {
        superchargeSelect.addEventListener('change', (e) => {
            const tier = Number(/** @type {HTMLSelectElement} */ (e.target).value) || 0;
            setGlobalSuperchargeTier(tier);
            if (state && state !== damageCalcState) {
                state.globalSuperchargeTier = tier;
            }
            onStateChange();
        });
    }

    // ZapQuake & Defense Board building filter tabs
    const zqFilterTabs = rootContainer.querySelectorAll('.calc-filter-tab[data-zq-filter]');
    zqFilterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const filter = /** @type {HTMLElement} */ (e.currentTarget).getAttribute('data-zq-filter');
            if (filter && state.zapQuake.buildingFilter !== filter) {
                state.zapQuake.buildingFilter = filter;
                persistState();
                if (rootContainer.querySelector('.calc-view--cluster')) {
                    // Tab 2: rebuild the building grid with new filter — no re-render of whole panel
                    updateClusterBuildingGridForSearch(state, rootContainer);
                    rootContainer.querySelectorAll('.calc-filter-tab[data-zq-filter]').forEach((t) => {
                        const tf = t.getAttribute('data-zq-filter') || 'all';
                        t.classList.toggle('is-active', tf === filter);
                        t.setAttribute('aria-selected', String(tf === filter));
                    });
                } else {
                    // Tab 1: DOM-only show/hide via data-tier — no combo recalculation
                    applyZqDomFilter(state.zapQuake.searchQuery || '', filter);
                }
            }
        });
    });

    // ZapQuake view mode switch (Compact vs Detailed)
    const zqViewModeBtns = rootContainer.querySelectorAll('[data-zq-view-mode]');
    zqViewModeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = /** @type {HTMLElement} */ (e.currentTarget).getAttribute('data-zq-view-mode');
            if (mode && (mode === 'compact' || mode === 'detailed') && state.zapQuake.viewMode !== mode) {
                state.zapQuake.viewMode = mode;
                persistState();
                onStateChange();
            }
        });
    });

    const toggleRemainingBtn = rootContainer.querySelector('[data-action="toggle-remaining"]');
    if (toggleRemainingBtn) {
        toggleRemainingBtn.addEventListener('click', () => {
            state.zapQuake.isRemainingExpanded = !state.zapQuake.isRemainingExpanded;
            persistState();
            onStateChange();
        });
    }

    // Delegated reset filters and clear search triggers
    rootContainer.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement | null} */ (e.target);
        if (!target) return;

        if (target.closest('[data-action="reset-zq-filters"]')) {
            state.zapQuake.searchQuery = '';
            state.zapQuake.buildingFilter = 'all';
            persistState();
            // DOM-only reset — no combo recalculation
            applyZqDomFilter('', 'all');
            const input = /** @type {HTMLInputElement | null} */ (document.getElementById('zq-search-input'));
            if (input) input.value = '';
            return;
        }

        if (target.closest('[data-action="clear-zq-search"]')) {
            state.zapQuake.searchQuery = '';
            persistState();
            const zqInput = /** @type {HTMLInputElement | null} */ (document.getElementById('zq-search-input'));
            if (rootContainer.querySelector('.calc-view--cluster')) {
                // Tab 2: rebuild grid with cleared query — no re-render of whole panel
                updateClusterBuildingGridForSearch(state, rootContainer);
                const sw = rootContainer.querySelector('.calc-view--cluster .calc-view-search-wrapper');
                sw?.querySelector('[data-action="clear-zq-search"]')?.remove();
            } else {
                // Tab 1: DOM-only clear — respects current buildingFilter, no combo recalculation
                applyZqDomFilter('', state.zapQuake.buildingFilter || 'all');
            }
            if (zqInput) {
                zqInput.value = '';
                zqInput.focus();
            }
            return;
        }

        if (target.closest('[data-action="reset-cluster-filters"]')) {
            state.zapQuake.searchQuery = '';
            state.zapQuake.buildingFilter = 'all';
            persistState();
            // Tab 2: rebuild grid with cleared query + filter — no re-render of whole panel
            updateClusterBuildingGridForSearch(state, rootContainer);
            rootContainer.querySelectorAll('.calc-filter-tab[data-zq-filter]').forEach((t) => {
                const tf = t.getAttribute('data-zq-filter') || 'all';
                t.classList.toggle('is-active', tf === 'all');
                t.setAttribute('aria-selected', String(tf === 'all'));
            });
            const input = /** @type {HTMLInputElement | null} */ (document.getElementById('zq-search-input'));
            if (input) input.value = '';
        }
    });
}
