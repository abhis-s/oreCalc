/**
 * UI Event Listeners and Interaction Handlers for Cluster Planner & Mobile Spell Dock.
 * Tier 4: UI Presentation / Input Controller.
 */

import { getClusterPresetsForTownHall } from '../../data/clusterPresetsData.js';
import { getDefensesData } from '../../data/defenseTargetsData.js';
import {
    getMaxDefenseLevelForTownHall,
    getDefaultSuperchargeTier
} from '../../domain/damage/defenseProgressionDomain.js';
import { isValidHeroEquipmentCombo } from '../../domain/damage/damageFormulas.js';
import { showToast } from '../../ui/toast.js';
import { translate } from '../../i18n/translator.js';
import {
    persistState,
    getShownTownHall
} from './damageCalcState.js';

/**
 * Prunes and re-indexes adjacent pairs when a cluster target is removed.
 *
 * @param {Array<string | [number, number]>} pairs - Active adjacent pairs.
 * @param {number} removedIdx - Index of removed target.
 * @returns {Array<string>} Updated pairs array.
 */
export function pruneAdjacentPairsOnRemove(pairs, removedIdx) {
    if (!Array.isArray(pairs)) return [];
    const updated = [];
    for (const pair of pairs) {
        let u, v;
        if (Array.isArray(pair)) {
            [u, v] = pair;
        } else if (typeof pair === 'string') {
            [u, v] = pair.split('-').map(Number);
        }
        if (typeof u !== 'number' || typeof v !== 'number' || isNaN(u) || isNaN(v)) continue;
        if (u === removedIdx || v === removedIdx) continue;
        const newU = u > removedIdx ? u - 1 : u;
        const newV = v > removedIdx ? v - 1 : v;
        if (newU !== newV) {
            updated.push(`${Math.min(newU, newV)}-${Math.max(newU, newV)}`);
        }
    }
    return Array.from(new Set(updated));
}

/**
 * Prunes and re-indexes cluster equipment target sharing when a cluster target is removed.
 *
 * @param {Record<string, number[]>} sharing - Active equipment sharing map.
 * @param {number} removedIdx - Index of removed target.
 * @param {number} newClusterLength - Length of cluster after removal.
 * @returns {Record<string, number[]>} Updated sharing map.
 */
export function pruneEquipmentSharingOnRemove(sharing, removedIdx, newClusterLength) {
    if (!sharing || typeof sharing !== 'object') return {};
    const updated = {};
    for (const [key, targets] of Object.entries(sharing)) {
        if (!Array.isArray(targets)) continue;
        const reindexed = [];
        for (const t of targets) {
            if (t === removedIdx) continue;
            reindexed.push(t > removedIdx ? t - 1 : t);
        }
        if (reindexed.length > 0 && reindexed.length < newClusterLength) {
            updated[key] = Array.from(new Set(reindexed)).sort((a, b) => a - b);
        }
    }
    return updated;
}

let isMobileDockScrollBound = false;
let lastDockScrollY = 0;

/**
 * Initializes passive window scroll listener to auto-hide mobile dock when scrolling down
 * and reveal it when scrolling up or near the top of the viewport.
 *
 * @param {Object} state - Damage calculator reactive state.
 */
function initMobileDockScrollListener(state) {
    if (isMobileDockScrollBound || typeof window === 'undefined') return;
    isMobileDockScrollBound = true;
    lastDockScrollY = window.scrollY || 0;

    window.addEventListener('scroll', () => {
        const dock = document.getElementById('calc-mobile-spell-dock');
        if (!dock) return;

        // Invariant: Do not auto-hide while the drawer modal is expanded
        if (state.zapQuake?.mobileDockExpanded || dock.classList.contains('is-expanded')) {
            return;
        }

        const currentScrollY = window.scrollY || 0;
        const delta = currentScrollY - lastDockScrollY;

        if (delta > 12 && currentScrollY > 80) {
            dock.classList.add('is-scrolled-down');
        } else if (delta < -10 || currentScrollY < 40) {
            dock.classList.remove('is-scrolled-down');
        }
        lastDockScrollY = currentScrollY;
    }, { passive: true });
}

/**
 * Resets the mobile dock scroll position memory and un-hides the dock upon building selection.
 */
export function resetMobileDockScrollState() {
    lastDockScrollY = typeof window !== 'undefined' ? (window.scrollY || 0) : 0;
    const activeDock = typeof document !== 'undefined' ? document.getElementById('calc-mobile-spell-dock') : null;
    if (activeDock) {
        activeDock.classList.remove('is-scrolled-down', 'is-hidden');
    }
}

/**
 * Attaches event listeners for the Cluster Planner (multi-select, presets, neighbors,
 * adjacency, equipment toggles, sharing pills, and mobile spell dock).
 *
 * @param {Object} state - Reactive damage calculator state.
 * @param {HTMLElement} rootContainer - Root DOM container for calculator view.
 * @param {Function} onStateChange - State change notification callback.
 */
export function attachClusterPlannerListeners(state, rootContainer, onStateChange) {
    initMobileDockScrollListener(state);

    // Multi-Select Toggle Button (ZapQuake)
    const multiToggleBtn = rootContainer.querySelector('#zq-multi-toggle');
    if (multiToggleBtn) {
        multiToggleBtn.addEventListener('click', () => {
            state.zapQuake.multiSelectMode = !state.zapQuake.multiSelectMode;
            persistState();
            onStateChange();
        });
    }

    const clearClusterBtns = rootContainer.querySelectorAll('#zq-cluster-clear, [data-action="clear-cluster"]');
    clearClusterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            state.zapQuake.selectedCluster = [];
            state.zapQuake.adjacentPairs = [];
            state.zapQuake.clusterEquipmentSharing = {};
            state.zapQuake.selectedClusterComboIndex = 0;
            persistState();
            onStateChange();
        });
    });

    // Popular Cluster Presets (ZapQuake Tab 2)
    const presetBtns = rootContainer.querySelectorAll('[data-action="apply-cluster-preset"]');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const presetId = /** @type {HTMLElement} */ (btn).dataset.presetId;
            const activeTh = getShownTownHall(state);
            const presets = getClusterPresetsForTownHall(activeTh);
            const preset = presets.find(p => p.id === presetId);
            if (!preset || !Array.isArray(preset.targets) || preset.targets.length === 0) return;

            state.zapQuake.selectedCluster = preset.targets.map(key => {
                const maxThLvl = getMaxDefenseLevelForTownHall(key, activeTh).level;
                const level = state.defenseLevelOverrides?.[key] || (maxThLvl > 0 ? maxThLvl : getDefensesData()[key]?.maxLevel || 1);
                const defaultTier = getDefaultSuperchargeTier(key, level, activeTh);
                const superchargeTier = state.defenseSuperchargeOverrides?.[key] !== undefined
                    ? state.defenseSuperchargeOverrides[key]
                    : defaultTier;
                return { defenseKey: key, level, superchargeTier };
            });
            state.zapQuake.clusterEquipment = [...(preset.equipment || [])];
            state.zapQuake.clusterEquipmentSharing = {};
            state.zapQuake.adjacentPairs = [];
            state.zapQuake.selectedClusterComboIndex = 0;
            persistState();
            onStateChange();
        });
    });

    // Suggested Neighbor Quick-Add Buttons (When cluster has 1 target)
    const addNeighborBtns = rootContainer.querySelectorAll('[data-action="add-cluster-neighbor"]');
    addNeighborBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetKey = /** @type {HTMLElement} */ (btn).dataset.targetKey;
            if (!targetKey || !getDefensesData()[targetKey]) return;
            if (!Array.isArray(state.zapQuake.selectedCluster)) {
                state.zapQuake.selectedCluster = [];
            }
            if (state.zapQuake.selectedCluster.length < 5) {
                const activeTh = getShownTownHall(state);
                const maxThLvl = getMaxDefenseLevelForTownHall(targetKey, activeTh).level;
                const level = state.defenseLevelOverrides?.[targetKey] || (maxThLvl > 0 ? maxThLvl : getDefensesData()[targetKey]?.maxLevel || 1);
                const defaultTier = getDefaultSuperchargeTier(targetKey, level, activeTh);
                const superchargeTier = state.defenseSuperchargeOverrides?.[targetKey] !== undefined
                    ? state.defenseSuperchargeOverrides[targetKey]
                    : defaultTier;
                state.zapQuake.selectedCluster.push({ defenseKey: targetKey, level, superchargeTier });
                state.zapQuake.selectedClusterComboIndex = 0;
                persistState();
                onStateChange();
            }
        });
    });

    // Cluster Chip Remove Buttons (ZapQuake)
    const clusterRemoveBtns = rootContainer.querySelectorAll('[data-cluster-remove]');
    clusterRemoveBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = Number(/** @type {HTMLElement} */ (btn).dataset.clusterRemove) || 0;
            if (Array.isArray(state.zapQuake.selectedCluster) && idx >= 0 && idx < state.zapQuake.selectedCluster.length) {
                state.zapQuake.selectedCluster.splice(idx, 1);
                state.zapQuake.adjacentPairs = pruneAdjacentPairsOnRemove(state.zapQuake.adjacentPairs, idx);
                state.zapQuake.clusterEquipmentSharing = pruneEquipmentSharingOnRemove(
                    state.zapQuake.clusterEquipmentSharing,
                    idx,
                    state.zapQuake.selectedCluster.length
                );
                state.zapQuake.selectedClusterComboIndex = 0;
                persistState();
                onStateChange();
            }
        });
    });

    // Adjacency / Shared Lightning Toggle Buttons
    const adjacentToggleBtns = rootContainer.querySelectorAll('[data-action="toggle-adjacent-pair"]');
    adjacentToggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pairKey = /** @type {HTMLElement} */ (btn).dataset.pair;
            if (!pairKey) return;
            if (!Array.isArray(state.zapQuake.adjacentPairs)) {
                state.zapQuake.adjacentPairs = [];
            }
            const existingIdx = state.zapQuake.adjacentPairs.indexOf(pairKey);
            if (existingIdx !== -1) {
                state.zapQuake.adjacentPairs.splice(existingIdx, 1);
            } else {
                state.zapQuake.adjacentPairs.push(pairKey);
            }
            persistState();
            onStateChange();
        });
    });

    // Cluster Trade-off pills
    const clusterTradeoffPills = rootContainer.querySelectorAll('[data-cluster-tradeoff-index]');
    clusterTradeoffPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = /** @type {HTMLElement} */ (e.currentTarget);
            const idx = Number(btn.getAttribute('data-cluster-tradeoff-index')) || 0;
            if (state.zapQuake.selectedClusterComboIndex !== idx) {
                state.zapQuake.selectedClusterComboIndex = idx;
                persistState();
                onStateChange();
            }
        });
    });

    // Cluster Equipment Toggle Buttons
    const clusterEquipBtns = rootContainer.querySelectorAll('[data-action="toggle-cluster-equipment"]');
    clusterEquipBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = /** @type {HTMLElement} */ (btn).dataset.equipmentKey;
            if (!key) return;

            if (!Array.isArray(state.zapQuake.clusterEquipment)) {
                state.zapQuake.clusterEquipment = [];
            }

            const isCurrentlyActive = state.zapQuake.clusterEquipment.includes(key);
            if (isCurrentlyActive) {
                state.zapQuake.clusterEquipment = state.zapQuake.clusterEquipment.filter(k => k !== key);
                if (state.zapQuake.clusterEquipmentSharing) {
                    delete state.zapQuake.clusterEquipmentSharing[key];
                }
            } else {
                const candidateList = [...state.zapQuake.clusterEquipment, key].map(k => ({ id: k }));
                if (!isValidHeroEquipmentCombo(candidateList)) {
                    showToast(translate('views.damageCalc.clusterPlanner.clusterEquipmentHeroLimitToast') || 'Maximum 2 heroes allowed for equipment combinations.', 'warning');
                    return;
                }
                state.zapQuake.clusterEquipment.push(key);
            }

            state.zapQuake.selectedClusterComboIndex = 0;
            persistState();
            onStateChange();
        });
    });

    // Cluster Equipment Target Sharing Pill Toggle
    const clusterShareTargetBtns = rootContainer.querySelectorAll('[data-action="toggle-equipment-target"]');
    clusterShareTargetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const el = /** @type {HTMLElement} */ (btn);
            const key = el.dataset.equipmentKey;
            const targetIdx = Number(el.dataset.targetIndex);
            if (!key || isNaN(targetIdx)) return;

            if (!state.zapQuake.clusterEquipmentSharing) {
                state.zapQuake.clusterEquipmentSharing = {};
            }

            const clusterTargets = state.zapQuake.selectedCluster || [];
            const totalTargets = clusterTargets.length;
            let currentAssigned = state.zapQuake.clusterEquipmentSharing[key];

            if (!Array.isArray(currentAssigned)) {
                currentAssigned = clusterTargets.map((_, i) => i);
            } else {
                currentAssigned = [...currentAssigned];
            }

            const existingIdx = currentAssigned.indexOf(targetIdx);
            if (existingIdx !== -1) {
                currentAssigned.splice(existingIdx, 1);
            } else {
                currentAssigned.push(targetIdx);
            }

            currentAssigned.sort((a, b) => a - b);

            if (currentAssigned.length === totalTargets) {
                delete state.zapQuake.clusterEquipmentSharing[key];
            } else {
                state.zapQuake.clusterEquipmentSharing[key] = currentAssigned;
            }

            state.zapQuake.selectedClusterComboIndex = 0;
            persistState();
            onStateChange();
        });
    });

    // Cluster Equipment All Targets Toggle
    const clusterShareAllBtns = rootContainer.querySelectorAll('[data-action="toggle-equipment-all-targets"]');
    clusterShareAllBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const el = /** @type {HTMLElement} */ (btn);
            const key = el.dataset.equipmentKey;
            if (!key) return;

            if (!state.zapQuake.clusterEquipmentSharing) {
                state.zapQuake.clusterEquipmentSharing = {};
            }

            const clusterTargets = state.zapQuake.selectedCluster || [];
            const currentAssigned = state.zapQuake.clusterEquipmentSharing[key];
            const isAllCurrently = !Array.isArray(currentAssigned) || currentAssigned.length === clusterTargets.length;

            if (isAllCurrently) {
                state.zapQuake.clusterEquipmentSharing[key] = [];
            } else {
                delete state.zapQuake.clusterEquipmentSharing[key];
            }

            state.zapQuake.selectedClusterComboIndex = 0;
            persistState();
            onStateChange();
        });
    });

    // Collapsible Combinations Table Toggle
    const combosToggleBtn = rootContainer.querySelector('#zq-combos-toggle-btn');
    if (combosToggleBtn) {
        combosToggleBtn.addEventListener('click', () => {
            state.zapQuake.combosExpanded = !state.zapQuake.combosExpanded;
            persistState();
            onStateChange();
        });
    }

    // Inline Earthquake Trade-off Pills Click
    const tradeoffPills = rootContainer.querySelectorAll('.calc-tradeoff-pill');
    tradeoffPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            const btn = /** @type {HTMLElement} */ (e.currentTarget);
            const idx = Number(btn.getAttribute('data-tradeoff-index'));
            if (!isNaN(idx) && state.zapQuake.selectedComboIndex !== idx) {
                state.zapQuake.selectedComboIndex = idx;
                persistState();
                onStateChange();
            }
        });
    });

    // Mobile Spell Dock Expand/Collapse Toggle & Backdrop Dismiss
    const mobileDockBar = rootContainer.querySelector('.calc-mobile-spell-dock__bar');
    const mobileDockToggle = rootContainer.querySelector('#calc-mobile-dock-toggle');
    const toggleMobileDock = (e) => {
        if (e && typeof e.stopPropagation === 'function') {
            e.stopPropagation();
        }
        const isExpanded = !state.zapQuake.mobileDockExpanded;
        state.zapQuake.mobileDockExpanded = isExpanded;

        const dock = rootContainer.querySelector('#calc-mobile-spell-dock');
        const drawer = rootContainer.querySelector('#calc-mobile-dock-drawer');
        const backdrop = rootContainer.querySelector('#calc-mobile-dock-backdrop');
        const chevron = rootContainer.querySelector('.calc-mobile-spell-dock__chevron');
        const toggleBtn = rootContainer.querySelector('#calc-mobile-dock-toggle');

        if (dock && drawer && backdrop) {
            dock.classList.toggle('is-expanded', isExpanded);
            drawer.classList.toggle('is-expanded', isExpanded);
            backdrop.classList.toggle('is-active', isExpanded);
            chevron?.classList.toggle('is-expanded', isExpanded);
            toggleBtn?.setAttribute('aria-expanded', String(isExpanded));
            if (isExpanded) {
                drawer.scrollTop = 0;
            }
            const labelText = isExpanded
                ? translate('views.damageCalc.filters.hideDetails')
                : translate('views.damageCalc.filters.showDetails');
            toggleBtn?.setAttribute('aria-label', labelText);
            return;
        }
        onStateChange();
    };

    if (mobileDockBar) {
        if (!mobileDockBar.dataset?.hasToggleListener) {
            if (mobileDockBar.dataset) {
                mobileDockBar.dataset.hasToggleListener = 'true';
            }
            mobileDockBar.addEventListener('click', toggleMobileDock);
        }
    } else if (mobileDockToggle && !mobileDockToggle.dataset?.hasToggleListener) {
        if (mobileDockToggle.dataset) {
            mobileDockToggle.dataset.hasToggleListener = 'true';
        }
        mobileDockToggle.addEventListener('click', toggleMobileDock);
    }

    const mobileDockBackdrop = rootContainer.querySelector('#calc-mobile-dock-backdrop');
    if (mobileDockBackdrop && !mobileDockBackdrop.dataset?.hasClickListener) {
        if (mobileDockBackdrop.dataset) {
            mobileDockBackdrop.dataset.hasClickListener = 'true';
        }
        mobileDockBackdrop.addEventListener('click', () => {
            if (!state.zapQuake.mobileDockExpanded) return;
            state.zapQuake.mobileDockExpanded = false;

            const dock = rootContainer.querySelector('#calc-mobile-spell-dock');
            const drawer = rootContainer.querySelector('#calc-mobile-dock-drawer');
            const chevron = rootContainer.querySelector('.calc-mobile-spell-dock__chevron');
            const toggle = rootContainer.querySelector('#calc-mobile-dock-toggle');

            dock?.classList.remove('is-expanded');
            drawer?.classList.remove('is-expanded');
            mobileDockBackdrop.classList.remove('is-active');
            chevron?.classList.remove('is-expanded');
            toggle?.setAttribute('aria-expanded', 'false');
            const labelText = translate('views.damageCalc.filters.showDetails');
            toggle?.setAttribute('aria-label', labelText);
        });
    }

    // Touch swipe-down gesture to collapse or hide mobile dock
    const mobileDock = rootContainer.querySelector('#calc-mobile-spell-dock');
    if (mobileDock && typeof mobileDock.addEventListener === 'function' && !mobileDock.dataset?.hasSwipeListener) {
        if (mobileDock.dataset) {
            mobileDock.dataset.hasSwipeListener = 'true';
        }
        let touchStartY = 0;
        let touchStartX = 0;
        let isTrackingSwipe = false;

        mobileDock.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
            isTrackingSwipe = true;
        }, { passive: true });

        mobileDock.addEventListener('touchend', (e) => {
            if (!isTrackingSwipe || !e.changedTouches || e.changedTouches.length !== 1) return;
            isTrackingSwipe = false;

            const touchEndY = e.changedTouches[0].clientY;
            const touchEndX = e.changedTouches[0].clientX;
            const deltaY = touchEndY - touchStartY;
            const deltaX = Math.abs(touchEndX - touchStartX);

            if (deltaY > 40 && deltaY > deltaX * 1.5) {
                const drawer = mobileDock.querySelector('#calc-mobile-dock-drawer');
                const isDrawerScrolled = drawer && drawer.scrollTop > 10;

                if (state.zapQuake?.mobileDockExpanded) {
                    if (!isDrawerScrolled) {
                        toggleMobileDock();
                    }
                } else {
                    mobileDock.classList.add('is-scrolled-down');
                }
            }
        }, { passive: true });
    }
}
