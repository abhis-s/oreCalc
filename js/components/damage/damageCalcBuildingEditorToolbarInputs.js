/**
 * Toolbar & Filter Input Controller for Damage Calculator Building Level Editor.
 * Manages Town Hall dropdowns, global supercharges, search filters, and group toggles.
 * Tier 4: User Inputs (Dedicated exclusively to event listener attachments inside modal dialogs).
 */

import {
    damageCalcState,
    persistState,
    setPlayerTownHall,
    applyTownHallPreset,
    resetDefenseOverrides,
    pruneDefenseOverrides,
    setGlobalSuperchargeTier,
    getBuildingGroupSessionPreferences,
    setBuildingGroupSessionPreference,
    isBuildingGroupEnabled,
    getShownTownHall
} from './damageCalcState.js';
import { getDefensesData } from '../../data/defenseTargetsData.js';
import { renderBuildingEditModal } from './damageCalcBuildingEditorModalDisplay.js';
import {
    getMaxSuperchargeTier,
    getMinDefenseLevel
} from '../../domain/damage/defenseProgressionDomain.js';

/**
 * Attaches event listeners for the building editor toolbar (TH preset, reset, group toggles, search).
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} modalBody - Modal body DOM container.
 * @param {() => void} onStateChange - Re-render callback.
 * @param {(state: Object, modalBody: HTMLElement, onStateChange: () => void) => void} onReattach - Rebuild/reattach callback.
 * @param {Map<string, number>} buildingEditSuperchargeMemory - Session supercharge cache.
 */
export function attachBuildingEditorToolbarListeners(state, modalBody, onStateChange, onReattach, buildingEditSuperchargeMemory) {
    if (!modalBody) return;

    const thSelect = /** @type {HTMLSelectElement | null} */ (modalBody.querySelector('#calc-building-th-select'));
    const applyThBtn = modalBody.querySelector('#calc-building-apply-th-btn');

    // Custom Town Hall Dropdown
    const thDropdown = modalBody.querySelector('#calc-th-dropdown');
    const thTrigger = /** @type {HTMLButtonElement | null} */ (modalBody.querySelector('#calc-th-dropdown-trigger'));
    const thMenu = /** @type {HTMLElement | null} */ (modalBody.querySelector('#calc-th-dropdown-menu'));
    const thItems = modalBody.querySelectorAll('.calc-th-dropdown-item');

    if (thTrigger && thMenu) {
        thTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !thMenu.hidden;
            thMenu.hidden = isOpen;
            thTrigger.setAttribute('aria-expanded', String(!isOpen));
            thDropdown?.classList.toggle('is-open', !isOpen);
        });

        const closeThMenu = () => {
            thMenu.hidden = true;
            thTrigger.setAttribute('aria-expanded', 'false');
            thDropdown?.classList.remove('is-open');
        };

        modalBody.addEventListener('click', (e) => {
            if (!thDropdown?.contains(/** @type {Node} */ (e.target))) {
                closeThMenu();
            }
        });

        thItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                closeThMenu();
                buildingEditSuperchargeMemory.clear();
                const selectedTh = Number(item.getAttribute('data-th')) || 18;
                const prevTh = getShownTownHall(state);
                setPlayerTownHall(selectedTh);
                if (state !== damageCalcState) {
                    state.playerTownHall = selectedTh;
                }
                if (thSelect) {
                    thSelect.value = String(selectedTh);
                }
                if (selectedTh >= 18 && (prevTh < 18 || state.globalSuperchargeTier === undefined || state.globalSuperchargeTier === 0)) {
                    setGlobalSuperchargeTier(2);
                    if (state !== damageCalcState) {
                        state.globalSuperchargeTier = 2;
                    }
                }
                pruneDefenseOverrides(state);
                persistState();
                onStateChange();
                const tabContent = /** @type {HTMLElement} */ (modalBody.querySelector('#calc-modal-tab-content') || modalBody);
                const controlsWrap = /** @type {HTMLElement | null} */ (modalBody.querySelector('#calc-building-sticky-controls'));
                renderBuildingEditModal(state, tabContent, controlsWrap);
                onReattach(state, modalBody, onStateChange);
            });
        });
    }

    if (thSelect) {
        thSelect.addEventListener('change', () => {
            buildingEditSuperchargeMemory.clear();
            const selectedTh = Number(thSelect.value) || 18;
            const prevTh = getShownTownHall(state);
            setPlayerTownHall(selectedTh);
            if (state !== damageCalcState) {
                state.playerTownHall = selectedTh;
            }
            if (selectedTh >= 18 && (prevTh < 18 || state.globalSuperchargeTier === undefined || state.globalSuperchargeTier === 0)) {
                setGlobalSuperchargeTier(2);
                if (state !== damageCalcState) {
                    state.globalSuperchargeTier = 2;
                }
            }
            pruneDefenseOverrides(state);
            persistState();
            onStateChange();
            const tabContent = /** @type {HTMLElement} */ (modalBody.querySelector('#calc-modal-tab-content') || modalBody);
            const controlsWrap = /** @type {HTMLElement | null} */ (modalBody.querySelector('#calc-building-sticky-controls'));
            renderBuildingEditModal(state, tabContent, controlsWrap);
            onReattach(state, modalBody, onStateChange);
        });
    }
    if (applyThBtn && thSelect) {
        applyThBtn.addEventListener('click', () => {
            buildingEditSuperchargeMemory.clear();
            const selectedTh = Number(thSelect.value) || 18;
            applyTownHallPreset(selectedTh);
            if (state !== damageCalcState) {
                state.playerTownHall = selectedTh;
                state.defenseLevelOverrides = {};
                state.defenseSuperchargeOverrides = {};
                state.globalSuperchargeTier = selectedTh >= 18 ? 2 : 0;
            }
            pruneDefenseOverrides(state);
            onStateChange();
            const tabContent = /** @type {HTMLElement} */ (modalBody.querySelector('#calc-modal-tab-content') || modalBody);
            const controlsWrap = /** @type {HTMLElement | null} */ (modalBody.querySelector('#calc-building-sticky-controls'));
            renderBuildingEditModal(state, tabContent, controlsWrap);
            onReattach(state, modalBody, onStateChange);
        });
    }

    // Toolbar Global Supercharge Pills (Max Town Hall only)
    const toolbarScPills = modalBody.querySelectorAll('.calc-supercharge-pill[data-toolbar-supercharge]');
    toolbarScPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const tier = Number(pill.getAttribute('data-toolbar-supercharge')) || 0;
            setGlobalSuperchargeTier(tier);
            if (state && state !== damageCalcState) {
                state.globalSuperchargeTier = tier;
                state.defenseSuperchargeOverrides = { ...(damageCalcState.defenseSuperchargeOverrides || {}) };
            }
            for (const [key, def] of Object.entries(getDefensesData())) {
                const maxTier = getMaxSuperchargeTier(key, def.maxLevel || 1);
                buildingEditSuperchargeMemory.set(key, Math.min(tier, maxTier));
            }
            pruneDefenseOverrides(state);
            persistState();
            onStateChange();
            const tabContent = /** @type {HTMLElement} */ (modalBody.querySelector('#calc-modal-tab-content') || modalBody);
            const controlsWrap = /** @type {HTMLElement | null} */ (modalBody.querySelector('#calc-building-sticky-controls'));
            renderBuildingEditModal(state, tabContent, controlsWrap);
            onReattach(state, modalBody, onStateChange);
        });
    });

    const resetBtn = modalBody.querySelector('#calc-building-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            buildingEditSuperchargeMemory.clear();
            resetDefenseOverrides();
            if (state !== damageCalcState) {
                state.defenseLevelOverrides = {};
                state.defenseSuperchargeOverrides = {};
                if (getShownTownHall(state) >= 18) {
                    state.globalSuperchargeTier = 2;
                }
            }
            onStateChange();
            const tabContent = /** @type {HTMLElement} */ (modalBody.querySelector('#calc-modal-tab-content') || modalBody);
            const controlsWrap = /** @type {HTMLElement | null} */ (modalBody.querySelector('#calc-building-sticky-controls'));
            renderBuildingEditModal(state, tabContent, controlsWrap);
            onReattach(state, modalBody, onStateChange);
        });
    }

    // Collapsible building groups toggle persistence
    const buildingGroups = modalBody.querySelectorAll('.calc-building-group');
    buildingGroups.forEach(groupEl => {
        const details = /** @type {HTMLDetailsElement} */ (groupEl);
        if (details.dataset.hasToggleListener) return;
        details.dataset.hasToggleListener = 'true';
        details.addEventListener('toggle', () => {
            const currentQuery = searchInput ? searchInput.value.trim() : '';
            if (!currentQuery) {
                const groupId = details.getAttribute('data-group-id');
                if (groupId) {
                    setBuildingGroupSessionPreference(groupId, details.open);
                }
            }
        });
    });

    // Building group toggle switches (Show / hide from page)
    const groupSwitches = modalBody.querySelectorAll('[data-group-switch]');
    groupSwitches.forEach(switchEl => {
        const switchBtn = /** @type {HTMLButtonElement} */ (switchEl);
        if (switchBtn.dataset.hasSwitchListener) return;
        switchBtn.dataset.hasSwitchListener = 'true';

        switchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const groupId = switchBtn.getAttribute('data-group-switch');
            if (!groupId || groupId === 'defenses') return;

            const currentVal = isBuildingGroupEnabled(state, groupId);
            const nextVal = !currentVal;

            if (!state.enabledBuildingGroups) {
                state.enabledBuildingGroups = {
                    defenses: true,
                    heroes: true,
                    guardians: true,
                    other: true,
                    unavailable: false
                };
            }
            state.enabledBuildingGroups[groupId] = nextVal;
            if (state !== damageCalcState) {
                if (!damageCalcState.enabledBuildingGroups) {
                    damageCalcState.enabledBuildingGroups = { ...state.enabledBuildingGroups };
                }
                damageCalcState.enabledBuildingGroups[groupId] = nextVal;
            }

            persistState();
            if (typeof onStateChange === 'function') {
                onStateChange();
            }

            switchBtn.classList.toggle('is-active', nextVal);
            switchBtn.setAttribute('aria-checked', String(nextVal));

            // In-place update of rows inside this group
            const groupDetails = switchBtn.closest('.calc-building-group');
            if (groupDetails) {
                const rows = groupDetails.querySelectorAll('.calc-building-modal-row');
                rows.forEach(row => {
                    const isRowUnavailable = row.classList.contains('is-unavailable');
                    const isRestricted = isRowUnavailable || !nextVal;
                    row.classList.toggle('is-restricted', isRestricted);

                    const decBtn = /** @type {HTMLButtonElement | null} */ (row.querySelector('.calc-stepper-btn[data-action="decrement"]'));
                    const incBtn = /** @type {HTMLButtonElement | null} */ (row.querySelector('.calc-stepper-btn[data-action="increment"]'));
                    const slider = /** @type {HTMLInputElement | null} */ (row.querySelector('.building-level-slider'));
                    const scWrap = row.querySelector('.calc-building-supercharge-wrap');
                    const scPills = row.querySelectorAll('.calc-supercharge-pill');

                    const lvlStat = row.querySelector('.calc-building-stat--lvl')?.textContent || '';
                    const match = lvlStat.match(/(\d+)\s*\/\s*(\d+)/);
                    const currentLvl = match ? Number(match[1]) : 1;
                    const maxAllowed = match ? Number(match[2]) : 1;
                    const bKey = row.getAttribute('data-building-key') || '';
                    const minLvl = getMinDefenseLevel(bKey);

                    if (decBtn) decBtn.disabled = isRestricted || currentLvl <= minLvl;
                    if (incBtn) incBtn.disabled = isRestricted || isRowUnavailable || currentLvl >= maxAllowed;
                    if (slider) slider.disabled = isRestricted;
                    if (scWrap) scWrap.classList.toggle('is-disabled', isRestricted);
                    scPills.forEach(p => { /** @type {HTMLButtonElement} */ (p).disabled = isRestricted; });
                });
            }
        });
    });

    // Instant Search Input
    const searchInput = /** @type {HTMLInputElement | null} */ (modalBody.querySelector('#calc-building-search'));
    const clearInputBtn = modalBody.querySelector('#calc-building-search-clear-btn, [data-action="clear-defense-search-input"]');
    const emptyNotice = modalBody.querySelector('#calc-building-empty-search');
    if (searchInput && !searchInput.dataset.hasSearchListener) {
        searchInput.dataset.hasSearchListener = 'true';
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            if (clearInputBtn) {
                clearInputBtn.classList.toggle('is-hidden', !searchInput.value);
            }
            const groups = modalBody.querySelectorAll('.calc-building-group');
            const groupPrefs = getBuildingGroupSessionPreferences();
            let totalVisibleCount = 0;

            if (query) {
                groups.forEach(groupEl => {
                    const details = /** @type {HTMLDetailsElement} */ (groupEl);
                    const rows = details.querySelectorAll('.calc-building-modal-row');
                    let groupVisibleCount = 0;

                    rows.forEach(row => {
                        const name = row.getAttribute('data-building-name') || '';
                        const key = row.getAttribute('data-building-key') || '';
                        const matches = name.includes(query) || key.includes(query);
                        /** @type {HTMLElement} */ (row).style.display = matches ? '' : 'none';
                        if (matches) {
                            groupVisibleCount++;
                            totalVisibleCount++;
                        }
                    });

                    if (groupVisibleCount > 0) {
                        details.style.display = '';
                        details.open = true;
                    } else {
                        details.style.display = 'none';
                    }
                });
            } else {
                groups.forEach(groupEl => {
                    const details = /** @type {HTMLDetailsElement} */ (groupEl);
                    const groupId = details.getAttribute('data-group-id');
                    details.style.display = '';
                    if (groupId) {
                        details.open = Boolean(groupPrefs[groupId]);
                    }

                    const rows = details.querySelectorAll('.calc-building-modal-row');
                    rows.forEach(row => {
                        /** @type {HTMLElement} */ (row).style.display = '';
                        totalVisibleCount++;
                    });
                });
            }

            if (emptyNotice) {
                emptyNotice.classList.toggle('is-hidden', totalVisibleCount > 0);
            }
        });
    }

    if (clearInputBtn && !clearInputBtn.dataset.hasClickListener) {
        clearInputBtn.dataset.hasClickListener = 'true';
        clearInputBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                clearInputBtn.classList.add('is-hidden');
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.focus();
            }
        });
    }

    const clearSearchBtn = modalBody.querySelector('#calc-building-clear-search-btn, [data-action="clear-defense-search"]');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                if (clearInputBtn) {
                    clearInputBtn.classList.add('is-hidden');
                }
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.focus();
            }
        });
    }
}
