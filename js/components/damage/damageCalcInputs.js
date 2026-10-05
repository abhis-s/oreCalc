/**
 * Event Listeners & User Input Controller for Equipment Damage & ZapQuake Calculator.
 * Tier 4: User Inputs (Dedicated exclusively to event listener attachments and state dispatching).
 */

import {
    damageCalcState,
    persistState,
    getActiveModifier,
    setGlobalSuperchargeTier,
    setPlayerTownHall,
    pruneDefenseOverrides,
    getShownTownHall
} from './damageCalcState.js';
import { getDefensesData } from '../../data/defenseTargetsData.js';
import {
    renderEditLevelsModal
} from './damageCalcModalsDisplay.js';
import { renderTargetCombosModal } from './damageCalcTargetCombosModalDisplay.js';
import { attachDamageCalcPopoverListeners } from './damageCalcPopoversInputs.js';
import {
    pruneAdjacentPairsOnRemove,
    pruneEquipmentSharingOnRemove,
    attachClusterPlannerListeners,
    resetMobileDockScrollState
} from './damageCalcClusterInputs.js';
import { translate } from '../../i18n/translator.js';
import { updateClusterBuildingGridForSearch } from './damageCalcDefenseBoardDisplay.js';
import { openModal, closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { showToast } from '../../ui/toast.js';
import {
    getDefaultSuperchargeTier,
    getMaxDefenseLevelForTownHall
} from '../../domain/damage/defenseProgressionDomain.js';
import { renderBattleModifierSwitcher } from '../common/battleModifierSwitcher.js';
import { state as appGlobalState } from '../../core/state.js';
import { saveState } from '../../core/localStorageManager.js';
import {
    attachEditLevelsModalListeners
} from './damageCalcModalsInputs.js';
import {
    resetBuildingEditorSuperchargeMemory
} from './damageCalcBuildingEditorModalInputs.js';
import {
    attachTargetCombosModalListeners,
    resetTargetCombosSuperchargeMemory
} from './damageCalcTargetCombosModalInputs.js';

let isSourcesThOutsideClickBound = false;
/** @type {number | null} */
let _searchRafId = null;

/**
 * Initializes outside-click and Escape key listeners for the sources grid Town Hall dropdown.
 */
function initSourcesThOutsideClick() {
    if (isSourcesThOutsideClickBound || typeof document === 'undefined') return;
    isSourcesThOutsideClickBound = true;
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('calc-sources-th-dropdown');
        const menu = document.getElementById('calc-sources-th-dropdown-menu');
        const trigger = document.getElementById('calc-sources-th-dropdown-trigger');
        if (dropdown && menu && trigger && menu.style.display !== 'none' && !dropdown.contains(/** @type {Node} */ (e.target))) {
            menu.style.display = 'none';
            trigger.setAttribute('aria-expanded', 'false');
            dropdown.classList.remove('is-open');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const dropdown = document.getElementById('calc-sources-th-dropdown');
            const menu = document.getElementById('calc-sources-th-dropdown-menu');
            const trigger = document.getElementById('calc-sources-th-dropdown-trigger');
            if (dropdown && menu && trigger && menu.style.display !== 'none') {
                menu.style.display = 'none';
                trigger.setAttribute('aria-expanded', 'false');
                dropdown.classList.remove('is-open');
                trigger.focus();
            }
        }
    });
}

/**
 * Attaches event listeners to the active damage calculator view and shell components.
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} rootContainer - Root container element.
 * @param {() => void} onStateChange - Re-render callback.
 */
export function attachDamageCalcListeners(state, rootContainer, onStateChange) {
    if (!rootContainer || typeof onStateChange !== 'function') return;
    attachDamageCalcPopoverListeners(rootContainer, state);

    // Offense Bar modifier tabs
    const modifierTabs = /** @type {HTMLElement | null} */ (rootContainer.querySelector('.calc-modifier-tabs'));
    if (modifierTabs && !modifierTabs.dataset.hasListener) {
        modifierTabs.dataset.hasListener = 'true';
        modifierTabs.addEventListener('click', (e) => {
            const btn = /** @type {HTMLElement | null} */ (e.target)?.closest('.mod-tab-btn');
            if (!btn) return;
            const modKey = btn.getAttribute('data-mod-key');
            const currentMod = getActiveModifier(state);
            if (modKey && currentMod !== modKey) {
                state.modifier = modKey;
                state.isModifierExplicit = true;
                if (appGlobalState.uiSettings) {
                    appGlobalState.uiSettings.leagueModifier = modKey;
                    saveState(appGlobalState);
                }
                persistState();
                renderBattleModifierSwitcher(modifierTabs, modKey, {
                    includePercentages: true,
                    customClass: 'calc-modifier-tabs'
                });
                onStateChange();
            }
        });
    }

    let isOffenseModalDirty = false;
    const handleOffenseModalStateChange = () => {
        isOffenseModalDirty = true;
        onStateChange();
    };

    // Offense Edit Levels modal trigger
    const editOffenseBtns = rootContainer.querySelectorAll('#calc-edit-offense-btn, .calc-sources-section__edit-btn');
    editOffenseBtns.forEach(btn => {
        const editEl = /** @type {HTMLElement} */ (btn);
        if (!editEl.dataset.hasListener) {
            editEl.dataset.hasListener = 'true';
            editEl.addEventListener('click', () => {
                const modal = document.getElementById('calc-offense-modal');
                const modalBody = document.getElementById('calc-offense-modal-body');
                if (modal && modalBody) {
                    isOffenseModalDirty = false;
                    modalBody.dataset.isDirty = 'false';
                    renderEditLevelsModal(state, modalBody);
                    attachEditLevelsModalListeners(state, modalBody, handleOffenseModalStateChange);
                    openModal(modal);
                }
            });
        }
    });

    // Clan Castle donated spells hint trigger
    const ccHintBtn = /** @type {HTMLElement | null} */ (rootContainer.querySelector('#calc-source-cc-hint'));
    if (ccHintBtn && !ccHintBtn.dataset.hasListener) {
        ccHintBtn.dataset.hasListener = 'true';
        ccHintBtn.addEventListener('click', () => {
            const modal = document.getElementById('calc-offense-modal');
            const modalBody = document.getElementById('calc-offense-modal-body');
            if (modal && modalBody) {
                isOffenseModalDirty = false;
                modalBody.dataset.isDirty = 'false';
                state.modalActiveTab = 'offense';
                renderEditLevelsModal(state, modalBody);
                attachEditLevelsModalListeners(state, modalBody, handleOffenseModalStateChange);
                openModal(modal);
            }
        });
    }

    // Offense modal dismissal
    const modal = document.getElementById('calc-offense-modal');
    const closeBtn = document.getElementById('calc-offense-close-btn');

    const closeModal = () => {
        resetBuildingEditorSuperchargeMemory();
        if (modal) {
            const modalBody = document.getElementById('calc-offense-modal-body');
            const shouldReRender = isOffenseModalDirty || modalBody?.dataset?.isDirty === 'true';
            closeModalAnimated(modal, () => {
                if (shouldReRender) {
                    onStateChange();
                }
            });
        }
    };

    if (modal && !modal.dataset.hasCloseListener) {
        modal.dataset.hasCloseListener = 'true';
        closeBtn?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        modal.addEventListener('close', resetBuildingEditorSuperchargeMemory);
        modal.addEventListener('modalClosed', resetBuildingEditorSuperchargeMemory);
    }

    // Target Combos modal dismissal
    const targetCombosModal = document.getElementById('calc-target-combos-modal');
    const targetCombosCloseBtn = document.getElementById('calc-target-combos-close-btn');

    const closeTargetCombosModal = () => {
        resetTargetCombosSuperchargeMemory();
        if (targetCombosModal) {
            closeModalAnimated(targetCombosModal, onStateChange);
        }
    };

    if (targetCombosModal && !targetCombosModal.dataset.hasCloseListener) {
        targetCombosModal.dataset.hasCloseListener = 'true';
        targetCombosCloseBtn?.addEventListener('click', closeTargetCombosModal);
        targetCombosModal.addEventListener('click', (e) => {
            if (e.target === targetCombosModal) {
                closeTargetCombosModal();
            }
        });
        targetCombosModal.addEventListener('close', resetTargetCombosSuperchargeMemory);
        targetCombosModal.addEventListener('modalClosed', resetTargetCombosSuperchargeMemory);
    }

    // Damage Source Toggle Buttons (ZapQuake Solver)
    const sourceToggleBtns = rootContainer.querySelectorAll('.calc-source-toggle-btn');
    sourceToggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sourceKey = /** @type {HTMLElement} */ (e.currentTarget).getAttribute('data-source-key');
            if (!sourceKey) return;
            if (!state.offense) {
                state.offense = { spells: {}, equipment: {}, enabledSources: {} };
            }
            if (!state.offense.enabledSources) {
                state.offense.enabledSources = {};
            }
            const current = state.offense.enabledSources[sourceKey] !== false;
            state.offense.enabledSources[sourceKey] = !current;
            persistState();
            onStateChange();
        });
    });

    // Custom Town Hall Dropdown in Sources Grid
    const sourcesThDropdown = rootContainer.querySelector('#calc-sources-th-dropdown');
    const sourcesThTrigger = /** @type {HTMLButtonElement | null} */ (rootContainer.querySelector('#calc-sources-th-dropdown-trigger'));
    const sourcesThMenu = /** @type {HTMLElement | null} */ (rootContainer.querySelector('#calc-sources-th-dropdown-menu'));
    const sourcesThSelect = /** @type {HTMLSelectElement | null} */ (rootContainer.querySelector('#calc-sources-th-select'));
    const sourcesThItems = rootContainer.querySelectorAll('#calc-sources-th-dropdown .calc-th-dropdown-item');

    if (sourcesThTrigger && sourcesThMenu) {
        sourcesThTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = sourcesThMenu.style.display !== 'none';
            sourcesThMenu.style.display = isOpen ? 'none' : 'block';
            sourcesThTrigger.setAttribute('aria-expanded', String(!isOpen));
            sourcesThDropdown?.classList.toggle('is-open', !isOpen);
        });

        const closeSourcesThMenu = () => {
            sourcesThMenu.style.display = 'none';
            sourcesThTrigger.setAttribute('aria-expanded', 'false');
            sourcesThDropdown?.classList.remove('is-open');
        };

        sourcesThItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                closeSourcesThMenu();
                const selectedTh = Number(item.getAttribute('data-th')) || 18;
                setPlayerTownHall(selectedTh);
                if (state && state !== damageCalcState) {
                    state.playerTownHall = selectedTh;
                }
                if (sourcesThSelect) {
                    sourcesThSelect.value = String(selectedTh);
                }
                pruneDefenseOverrides(state);
                persistState();
                onStateChange();
            });
        });
    }

    if (sourcesThSelect) {
        sourcesThSelect.addEventListener('change', () => {
            const selectedTh = Number(sourcesThSelect.value) || 18;
            setPlayerTownHall(selectedTh);
            if (state && state !== damageCalcState) {
                state.playerTownHall = selectedTh;
            }
            pruneDefenseOverrides(state);
            persistState();
            onStateChange();
        });
    }

    initSourcesThOutsideClick();

    // Target Combos modal trigger on ZapQuake combo defense cards
    const comboDefCards = rootContainer.querySelectorAll('.calc-combo-defense-card');
    comboDefCards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (/** @type {HTMLElement} */ (e.target)?.closest('.calc-combo-defense-card__info-btn, .calc-info-btn, [data-combo-defense-info]')) {
                return;
            }
            hideCardHelpPopover();
            const cardEl = /** @type {HTMLElement} */ (e.currentTarget);
            const buildingKey = cardEl.getAttribute('data-building-key');
            if (!buildingKey || !getDefensesData()[buildingKey]) return;

            const buildingLevel = Number(cardEl.getAttribute('data-building-level')) || state.defenseLevelOverrides?.[buildingKey] || getDefensesData()[buildingKey]?.maxLevel || 1;
            const superchargeTier = cardEl.getAttribute('data-supercharge') !== null
                ? Number(cardEl.getAttribute('data-supercharge'))
                : state.defenseSuperchargeOverrides?.[buildingKey];

            const targetModal = document.getElementById('calc-target-combos-modal');
            const targetModalBody = document.getElementById('calc-target-combos-modal-body');
            if (targetModal && targetModalBody) {
                renderTargetCombosModal(state, targetModalBody, buildingKey, buildingLevel, superchargeTier);
                attachTargetCombosModalListeners(state, targetModalBody, onStateChange);
                openModal(targetModal);
            }
        });
    });

    // Building Card Click Handling
    const buildingCards = rootContainer.querySelectorAll('.calc-building-card');
    buildingCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const btn = /** @type {HTMLElement} */ (e.currentTarget);
            const prefix = btn.getAttribute('data-prefix') || 'zq';
            const buildingKey = btn.getAttribute('data-building-key');
            if (!buildingKey || !getDefensesData()[buildingKey]) return;

            const def = getDefensesData()[buildingKey];
            const activeTh = getShownTownHall(state);
            const maxThLvl = getMaxDefenseLevelForTownHall(buildingKey, activeTh).level;
            const maxLvl = maxThLvl > 0 ? maxThLvl : (def?.maxLevel || 1);
            const effectiveLvl = state.defenseLevelOverrides?.[buildingKey] || maxLvl;
            const defaultTier = getDefaultSuperchargeTier(buildingKey, effectiveLvl, activeTh);
            const effectiveTier = state.defenseSuperchargeOverrides?.[buildingKey] !== undefined
                ? state.defenseSuperchargeOverrides[buildingKey]
                : defaultTier;

            if (prefix === 'zq') {
                if (state.zapQuake.multiSelectMode) {
                    if (!Array.isArray(state.zapQuake.selectedCluster)) {
                        state.zapQuake.selectedCluster = [];
                    }
                    const existingIdx = state.zapQuake.selectedCluster.findIndex(t => t.defenseKey === buildingKey);
                    const existingCraftedIdx = def.subCategory === 'crafted'
                        ? state.zapQuake.selectedCluster.findIndex(t => getDefensesData()[t.defenseKey]?.subCategory === 'crafted')
                        : -1;
                    const existingGuardianIdx = def.category === 'guardian'
                        ? state.zapQuake.selectedCluster.findIndex(t => getDefensesData()[t.defenseKey]?.category === 'guardian')
                        : -1;
                    const heroIndices = [];
                    state.zapQuake.selectedCluster.forEach((t, i) => {
                        if (getDefensesData()[t.defenseKey]?.category === 'hero') {
                            heroIndices.push(i);
                        }
                    });
                    const isHero = def.category === 'hero';
                    const hasMaxHeroes = isHero && heroIndices.length >= 4;

                    if (existingIdx !== -1) {
                        state.zapQuake.selectedCluster.splice(existingIdx, 1);
                        state.zapQuake.adjacentPairs = pruneAdjacentPairsOnRemove(state.zapQuake.adjacentPairs, existingIdx);
                        state.zapQuake.clusterEquipmentSharing = pruneEquipmentSharingOnRemove(
                            state.zapQuake.clusterEquipmentSharing,
                            existingIdx,
                            state.zapQuake.selectedCluster.length
                        );
                        state.zapQuake.selectedClusterComboIndex = 0;
                    } else if (existingCraftedIdx !== -1) {
                        state.zapQuake.selectedCluster[existingCraftedIdx] = {
                            defenseKey: buildingKey,
                            level: effectiveLvl,
                            superchargeTier: effectiveTier
                        };
                        state.zapQuake.selectedClusterComboIndex = 0;
                    } else if (existingGuardianIdx !== -1) {
                        state.zapQuake.selectedCluster[existingGuardianIdx] = {
                            defenseKey: buildingKey,
                            level: effectiveLvl,
                            superchargeTier: effectiveTier
                        };
                        state.zapQuake.selectedClusterComboIndex = 0;
                    } else if (hasMaxHeroes) {
                        const targetHeroIdx = heroIndices.at(-1);
                        state.zapQuake.selectedCluster[targetHeroIdx] = {
                            defenseKey: buildingKey,
                            level: effectiveLvl,
                            superchargeTier: effectiveTier
                        };
                        state.zapQuake.selectedClusterComboIndex = 0;
                    } else if (state.zapQuake.selectedCluster.length < 5) {
                        state.zapQuake.selectedCluster.push({
                            defenseKey: buildingKey,
                            level: effectiveLvl,
                            superchargeTier: effectiveTier
                        });
                        state.zapQuake.selectedClusterComboIndex = 0;
                    } else {
                        showToast(translate('views.damageCalc.clusterPlanner.clusterLimitToast') || 'Cluster limit reached (maximum 5 defenses)', 'warning');
                        return;
                    }
                } else {
                    state.zapQuake.selectedComboIndex = 0;
                    state.zapQuake.selectedCluster = [{
                        defenseKey: buildingKey,
                        level: effectiveLvl,
                        superchargeTier: effectiveTier
                    }];
                }
            }

            persistState();
            onStateChange();
            resetMobileDockScrollState();
        });
    });

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
                            <orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>
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
                btn.innerHTML = '<orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>';
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
                                btn.innerHTML = '<orecalc-assets-svg name="close" width="12" height="12"></orecalc-assets-svg>';
                                sw.appendChild(btn);
                            } else if (!query && existingClearBtn) {
                                existingClearBtn.remove();
                            }
                        }
                        return;
                    }
                    // Tab 1 (ZapQuake): shared DOM filter — handles query + buildingFilter, empty state, clear button
                    applyZqDomFilter(val, state.zapQuake?.buildingFilter || 'all');
                    return;
                }

            });
        });

        // Persist state on blur — no re-render, avoids double-render when clicking clear/reset
        // (mousedown on clear fires blur before click; a full onStateChange here would cause
        // two sequential re-renders and make the clear button feel laggy)
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

    // Cluster Planner and Mobile Spell Dock Listeners
    attachClusterPlannerListeners(state, rootContainer, onStateChange);

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
            return;
        }

    });

    const casualtyCards = rootContainer.querySelectorAll('.calc-casualty-card');
    casualtyCards.forEach(card => {
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                /** @type {HTMLElement} */ (e.currentTarget).click();
            }
        });
        card.addEventListener('click', (e) => {
            if (/** @type {HTMLElement} */ (e.target)?.closest('[data-casualty-info-btn], .calc-info-btn')) {
                return;
            }
            const el = /** @type {HTMLElement} */ (e.currentTarget);
            const buildingKey = el.getAttribute('data-building-key');
            if (!buildingKey || !getDefensesData()[buildingKey]) return;

            // Simulator casualty selection removed

            persistState();
            onStateChange();
        });
    });

    const simHutSelect = rootContainer.querySelector('#sim-builder-hut-level');
    if (simHutSelect) {
        simHutSelect.addEventListener('change', (e) => {
            state.simulator.builderHutLevel = Number(/** @type {HTMLSelectElement} */ (e.target).value) || 8;
            persistState();
            onStateChange();
        });
    }
}
