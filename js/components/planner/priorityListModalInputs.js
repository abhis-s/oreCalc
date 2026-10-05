/**
 * User Inputs & Modal Controller for Priority List Modal.
 * Tier 4: User Inputs (Handles modal lifecycle, actions, delete dialogs, and delegates drag gestures).
 */

import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import {
    renderDraggableList,
    renderPriorityEditor
} from './priorityListModalDisplay.js';
import {
    autoPlaceChipsForDateRange,
    getGlobalPriorityList
} from './priorityListScheduler.js';
import {
    getPreviousValidPriorityOrder,
    renderSuggestionsAndErrors,
    setPreviousValidPriorityOrder,
    setSuggestionsHidden
} from './priorityListSuggestionsRenderer.js';
import { initializeStoredOresModal, openStoredOresModal } from './storedOresModal.js';
import { openLevelSelectModal } from './levelSelectModal.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { initPriorityDragAndDrop } from './priorityListDragDropController.js';

let isPriorityModalInitialized = false;

/**
 * Handles deleting a specific upgrade step from the priority queue.
 * @param {string} heroName
 * @param {string} equipName
 * @param {number|string} stepNum
 */
function deletePriorityStep(heroName, equipName, stepNum) {
    handleStateUpdate(() => {
        const equipmentInState = state.heroes[heroName]?.equipment[equipName];
        if (!equipmentInState || !equipmentInState.upgradePlan) return;

        const deletedPriorityIndex = equipmentInState.upgradePlan[stepNum]?.priorityIndex;
        delete equipmentInState.upgradePlan[stepNum];

        if (deletedPriorityIndex !== undefined) {
            for (const h in state.heroes) {
                const hero = state.heroes[h];
                for (const eq in hero.equipment) {
                    const eqObj = hero.equipment[eq];
                    for (const step in eqObj.upgradePlan) {
                        const plan = eqObj.upgradePlan[step];
                        if (plan.priorityIndex > deletedPriorityIndex) {
                            plan.priorityIndex -= 1;
                        }
                    }
                }
            }
        }
    });

    renderPriorityEditor();
    document.dispatchEvent(new CustomEvent('priorityListUpdated'));
}

/**
 * Initializes DOM event listeners for the priority list modal.
 */
export function initializePriorityListModal() {
    if (isPriorityModalInitialized) return;
    isPriorityModalInitialized = true;

    initializeStoredOresModal();
    const modal = document.getElementById('priority-list-modal');
    const closeBtn = document.getElementById('close-priority-list-modal-btn');
    const resetButton = document.getElementById('reset-priority-list-modal-btn');
    const unhideBtn = document.getElementById('unhide-suggestion-btn');
    const storedOresBtn = document.getElementById('priority-list-stored-ores-btn');

    if (storedOresBtn) {
        storedOresBtn.addEventListener('click', () => {
            openStoredOresModal();
        });
    }

    if (unhideBtn) {
        unhideBtn.addEventListener('click', () => {
            setSuggestionsHidden(false);
            const { globalPriorityList, suggestions } = getGlobalPriorityList();
            renderSuggestionsAndErrors(globalPriorityList, suggestions);
        });
    }

    if (modal) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class' && !modal.classList.contains('show')) {
                    const prevOrder = getPreviousValidPriorityOrder();
                    if (prevOrder !== null && prevOrder.length > 0) {
                        handleStateUpdate(() => {
                            prevOrder.forEach((savedItem) => {
                                const plan = state.heroes[savedItem.heroName]?.equipment[savedItem.equipName]?.upgradePlan[savedItem.step];
                                if (plan) {
                                    plan.priorityIndex = savedItem.priorityIndex;
                                }
                            });
                        });
                        setPreviousValidPriorityOrder(null);
                    }
                }
            });
        });
        observer.observe(modal, { attributes: true });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) closeModalAnimated(modal);
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', async () => {
            const confirmed = await showConfirm(
                translate('views.planner.confirmResetList'),
                'actions.confirm'
            );
            if (!confirmed) return;

            handleStateUpdate(() => {
                for (const heroKey in state.heroes) {
                    const hero = state.heroes[heroKey];
                    for (const equipName in hero.equipment) {
                        hero.equipment[equipName].upgradePlan = {};
                    }
                }
            });
            renderPriorityEditor();
            document.dispatchEvent(new CustomEvent('priorityListUpdated'));
        });
    }

    document.addEventListener('priorityListUpdated', () => {
        renderDraggableList();
    });

    /**
     * @param {HTMLElement} chip
     */
    const handleChipSelect = (chip) => {
        const heroKey = chip.dataset.heroKey;
        const equipKey = chip.dataset.equipKey;
        const equipName = chip.dataset.equipName;
        if (!heroKey) return;
        const hero = heroData[heroKey];
        if (hero) {
            const equip = hero.equipment.find(e => (e.key && e.key === equipKey) || e.name === equipName || toCamelCase(e.name || '') === equipKey);
            if (equip) {
                openLevelSelectModal(hero, equip);
            }
        }
    };

    const modalBody = document.getElementById('priority-list-modal-body');
    if (modalBody) {
        // Initialize GPU drag-and-drop gesture engine
        initPriorityDragAndDrop(modalBody);

        modalBody.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement | null} */ (e.target);
            if (!target) return;

            const chip = target.closest('.equipment-chip, .hero-equipment-chip');
            if (chip && modalBody.contains(chip)) {
                handleChipSelect(/** @type {HTMLElement} */ (chip));
                return;
            }

            const deleteBtn = target.closest('.delete-item-btn');
            if (deleteBtn && modalBody.contains(deleteBtn)) {
                const item = target.closest('.priority-list-editor-item');
                if (item) {
                    const heroName = /** @type {HTMLElement} */ (item).dataset.heroName;
                    const equipName = /** @type {HTMLElement} */ (item).dataset.equipName;
                    const step = /** @type {HTMLElement} */ (item).dataset.step;
                    if (heroName && equipName && step) {
                        deletePriorityStep(heroName, equipName, step);
                    }
                }
                return;
            }

            const fixBtn = target.closest('#fix-order-btn, .fix-order-btn');
            if (fixBtn && modalBody.contains(fixBtn)) {
                const prevOrder = getPreviousValidPriorityOrder();
                const canUndo = prevOrder !== null && prevOrder.length > 0;
                if (canUndo) {
                    handleStateUpdate(() => {
                        prevOrder.forEach((savedItem) => {
                            const plan = state.heroes[savedItem.heroName]?.equipment[savedItem.equipName]?.upgradePlan[savedItem.step];
                            if (plan) {
                                plan.priorityIndex = savedItem.priorityIndex;
                            }
                        });
                    });
                    setPreviousValidPriorityOrder(null);
                } else {
                    const { globalPriorityList } = getGlobalPriorityList();
                    handleStateUpdate(() => {
                        const equipmentGroups = {};
                        globalPriorityList.forEach(item => {
                            if (!equipmentGroups[item.name]) {
                                equipmentGroups[item.name] = [];
                            }
                            equipmentGroups[item.name].push(item);
                        });

                        for (const equipName in equipmentGroups) {
                            const items = equipmentGroups[equipName];
                            for (let i = 0; i < items.length - 1; i++) {
                                if (items[i].step > items[i + 1].step) {
                                    const itemA = items[i];
                                    const itemB = items[i + 1];

                                    const planA = state.heroes[itemA.heroName]?.equipment[itemA.name]?.upgradePlan[itemA.step];
                                    const planB = state.heroes[itemB.heroName]?.equipment[itemB.name]?.upgradePlan[itemB.step];

                                    if (planA && planB) {
                                        const tempIndex = planA.priorityIndex;
                                        planA.priorityIndex = planB.priorityIndex;
                                        planB.priorityIndex = tempIndex;
                                    }
                                    return;
                                }
                            }
                        }
                    });
                    setPreviousValidPriorityOrder(null);
                }
                renderDraggableList();
                document.dispatchEvent(new CustomEvent('priorityListUpdated'));
                return;
            }

            const hideBtn = target.closest('#hide-suggestion-btn, .hide-suggestion-btn');
            if (hideBtn && modalBody.contains(hideBtn)) {
                setSuggestionsHidden(true);
                const { globalPriorityList, suggestions } = getGlobalPriorityList();
                renderSuggestionsAndErrors(globalPriorityList, suggestions);
                return;
            }
        });

        modalBody.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const target = /** @type {HTMLElement | null} */ (e.target);
                const chip = target?.closest('.equipment-chip, .hero-equipment-chip');
                if (chip && modalBody.contains(chip)) {
                    e.preventDefault();
                    handleChipSelect(/** @type {HTMLElement} */ (chip));
                }
            }
        });
    }
}

/**
 * Opens the Priority List editor modal and renders draggable priority item cards and suggestions.
 */
export function openPriorityListModal() {
    const modal = document.getElementById('priority-list-modal');
    const title = document.getElementById('priority-list-modal-title');

    if (modal && title) {
        title.setAttribute('data-i18n', 'views.planner.editPriorityList');
        title.textContent = translate('views.planner.editPriorityList');
        if (state.planner?.calendar?.isDirty !== false) {
            autoPlaceChipsForDateRange();
        }
        renderPriorityEditor();
        openModal(modal);
    }
}

/**
 * Re-renders the Priority List modal editor when open and not actively undergoing reordering.
 * @param {any} [renderState] - State configuration object.
 */
export function renderPriorityListModal(renderState) {
    if (window.__IS_REORDERING__) return;
    const modal = document.getElementById('priority-list-modal');
    if (modal && modal.classList.contains('show')) {
        renderPriorityEditor();
    }
}
