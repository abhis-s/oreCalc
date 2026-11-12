/**
 * Event Listeners & User Input Controller for Equipment Damage & ZapQuake Calculator.
 * Tier 4: User Inputs (Dedicated exclusively to event listener attachments and state dispatching).
 */

import {
    damageCalcState,
    persistState,
    getActiveModifier,
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
import { attachDamageCalcFilterListeners } from './damageCalcFilterInputs.js';
import { translate } from '../../i18n/translator.js';
import { openModal, closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { showToast } from '../../ui/toast.js';
import {
    getDefaultSuperchargeTier,
    getMaxDefenseLevelForTownHall
} from '../../domain/damage/defenseProgressionDomain.js';
import { renderBattleModifierSwitcher } from '../common/battleModifierSwitcher.js';
import { state as appGlobalState } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
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
 * @param {any} state - Damage calculator state.
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
                handleStateUpdate(() => {
                    if (appGlobalState.uiSettings) {
                        appGlobalState.uiSettings.leagueModifier = modKey;
                    }
                }, true, { preferencesOnly: true });
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
    const closeBtn = document.getElementById('close-calc-offense-modal-btn') || document.getElementById('calc-offense-close-btn');

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
    const targetCombosCloseBtn = document.getElementById('close-calc-target-combos-modal-btn') || document.getElementById('calc-target-combos-close-btn');

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
        let lastSourcesThTimestamp = 0;
        const TH_COOLDOWN_MS = 400;

        sourcesThTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const now = Date.now();
            if (now - lastSourcesThTimestamp < TH_COOLDOWN_MS) {
                return;
            }
            lastSourcesThTimestamp = now;

            const isOpen = !sourcesThMenu.hidden;
            sourcesThMenu.hidden = isOpen;
            sourcesThMenu.style.display = isOpen ? 'none' : 'block';
            sourcesThTrigger.setAttribute('aria-expanded', String(!isOpen));
            sourcesThDropdown?.classList.toggle('is-open', !isOpen);
        });

        const closeSourcesThMenu = () => {
            sourcesThMenu.hidden = true;
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
            if (/** @type {HTMLElement} */ (e.target)?.closest('.calc-combo-defense-card__info-btn, .info-btn, [data-combo-defense-info]')) {
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

    attachDamageCalcFilterListeners(state, rootContainer, onStateChange);
    attachClusterPlannerListeners(state, rootContainer, onStateChange);
}
