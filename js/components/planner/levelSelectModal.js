/**
 * Controller & Input Bindings for Planner Level Selection Modal.
 * Tier 4: UI Controller (Orchestrates modal lifecycle, interactions, and state mutations).
 */

import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { translate } from '../../i18n/translator.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';
import {
    calculateStepRecommendation,
    getDefaultLevels,
    calculateUpgradePlanPriorities
} from '../../domain/planner/stepRecommendationDomain.js';
import {
    ensureLevelSelectModalInDOM,
    populateTableRows,
    updateModalHeaderDisplay,
    syncTableRecommendationsAndBounds
} from './levelSelectModalDisplay.js';

let currentEquipment = null;
let currentHero = null;
let isInitialized = false;

/**
 * Resolves the effective preceding level lower bound for a given step index from DOM rows.
 *
 * @param {number} stepIndex - 1-based step index (1, 2, or 3).
 * @param {number} currentLevel - Current equipment level.
 * @returns {number} Preceding level lower bound.
 */
function getPrecedingLevelLowerBound(stepIndex, currentLevel) {
    if (stepIndex <= 1) return currentLevel;

    const row1Input = /** @type {HTMLInputElement | null} */ (document.getElementById('level-input-1'));
    const val1 = parseInt(row1Input?.value || '', 10);

    if (stepIndex === 2) {
        if (!isNaN(val1) && val1 > 0) return val1;
        const rec1 = getEquipmentRecommendedLevel(1);
        return rec1 > 0 ? rec1 : currentLevel;
    }

    if (stepIndex === 3) {
        const row2Input = /** @type {HTMLInputElement | null} */ (document.getElementById('level-input-2'));
        const val2 = parseInt(row2Input?.value || '', 10);
        if (!isNaN(val2) && val2 > 0) return val2;

        if (!isNaN(val1) && val1 > 0) {
            const rec2 = getEquipmentRecommendedLevel(2);
            return rec2 > 0 ? rec2 : val1;
        }

        const rec2 = getEquipmentRecommendedLevel(2);
        return rec2 > 0 ? rec2 : currentLevel;
    }

    return currentLevel;
}

/**
 * Resolves the dynamically calculated recommended upgrade level for a given step.
 *
 * @param {number} stepIndex - 1-based step index (1, 2, or 3).
 * @returns {number} The recommended level, or 0 if options are exhausted.
 */
export function getEquipmentRecommendedLevel(stepIndex) {
    if (!currentEquipment || !currentHero) return 0;

    const maxLevel = getEquipmentMaxLevel(currentEquipment.type);
    const currentLevel = state.heroes[currentHero.name]?.equipment[currentEquipment.name]?.level || 1;
    const lowerBound = getPrecedingLevelLowerBound(stepIndex, currentLevel);

    return calculateStepRecommendation(stepIndex, lowerBound, currentLevel, maxLevel, currentEquipment.type);
}

/**
 * Refreshes all table rows' recommendation placeholders and bounds.
 */
function syncRows() {
    syncTableRecommendationsAndBounds(
        currentEquipment,
        currentHero,
        currentHero ? state.heroes[currentHero.name] : null,
        getEquipmentRecommendedLevel
    );
}

/**
 * Shifts step rows up when a step is deleted.
 *
 * @param {number} stepId - 1-based step ID to delete.
 */
function trashStep(stepId) {
    const rows = Array.from(document.querySelectorAll('#level-select-table tbody tr'));
    const stepIndex = stepId - 1;

    for (let i = stepIndex; i < rows.length - 1; i++) {
        const currentStepRow = rows[i];
        const nextStepRow = rows[i + 1];

        const nextLevelInput = /** @type {HTMLInputElement} */ (nextStepRow.querySelector('.level-input'));
        const currentLevelInput = /** @type {HTMLInputElement} */ (currentStepRow.querySelector('.level-input'));
        currentLevelInput.value = nextLevelInput.value;

        const nextEnableSwitch = /** @type {HTMLInputElement} */ (nextStepRow.querySelector('.enable-switch'));
        const currentEnableSwitch = /** @type {HTMLInputElement} */ (currentStepRow.querySelector('.enable-switch'));
        currentEnableSwitch.checked = nextEnableSwitch.checked;
    }

    const lastStepRow = rows.at(-1);
    const lastLevelInput = /** @type {HTMLInputElement} */ (lastStepRow.querySelector('.level-input'));
    const lastEnableSwitch = /** @type {HTMLInputElement} */ (lastStepRow.querySelector('.enable-switch'));

    lastLevelInput.value = '';
    lastEnableSwitch.checked = false;
    syncRows();
}

/**
 * Saves priority step configuration to global application state.
 */
function savePrioritySteps() {
    const rows = document.querySelectorAll('#level-select-table tbody tr');

    let heroNameForCurrentEquipment = null;
    for (const heroKey in state.heroes) {
        if (state.heroes[heroKey].equipment && Object.hasOwn(state.heroes[heroKey].equipment, currentEquipment.name)) {
            heroNameForCurrentEquipment = heroKey;
            break;
        }
    }

    if (heroNameForCurrentEquipment) {
        handleStateUpdate(() => {
            const equipmentInState = state.heroes[heroNameForCurrentEquipment].equipment[currentEquipment.name];
            const oldUpgradePlan = equipmentInState.upgradePlan || {};

            let maxPriority = 0;
            for (const hKey in state.heroes) {
                for (const eName in state.heroes[hKey].equipment) {
                    const eq = state.heroes[hKey].equipment[eName];
                    if (eq.upgradePlan) {
                        for (const sNum in eq.upgradePlan) {
                            if (eq.upgradePlan[sNum].priorityIndex > maxPriority) {
                                maxPriority = eq.upgradePlan[sNum].priorityIndex;
                            }
                        }
                    }
                }
            }

            const rawUiSteps = Array.from(rows).map(row => {
                const enableSwitch = /** @type {HTMLInputElement} */ (row.querySelector('.enable-switch'));
                const levelInput = /** @type {HTMLInputElement} */ (row.querySelector('.level-input'));
                const level = parseInt(levelInput.value, 10);
                return {
                    stepKey: row.getAttribute('data-step-id') || '',
                    level,
                    enabled: enableSwitch.checked
                };
            });

            const newPlan = calculateUpgradePlanPriorities(oldUpgradePlan, rawUiSteps, maxPriority);
            if (newPlan === null) {
                delete equipmentInState.upgradePlan;
            } else {
                equipmentInState.upgradePlan = newPlan;
            }

            // Re-normalize global priorities sequentially 1..N
            const globalPriorityList = [];
            for (const heroKey in state.heroes) {
                for (const equipName in state.heroes[heroKey].equipment) {
                    const equipment = state.heroes[heroKey].equipment[equipName];
                    if (equipment.upgradePlan) {
                        for (const stepNum in equipment.upgradePlan) {
                            const stepData = equipment.upgradePlan[stepNum];
                            if (stepData.enabled && stepData.priorityIndex > 0) {
                                globalPriorityList.push({
                                    heroName: heroKey,
                                    equipName,
                                    step: stepNum,
                                    priorityIndex: stepData.priorityIndex
                                });
                            }
                        }
                    }
                }
            }
            globalPriorityList.sort((a, b) => a.priorityIndex - b.priorityIndex);
            globalPriorityList.forEach((item, index) => {
                state.heroes[item.heroName].equipment[item.equipName].upgradePlan[item.step].priorityIndex = index + 1;
            });
        });
    }

    document.dispatchEvent(new CustomEvent('priorityListUpdated'));
    closeLevelSelectModal();
}

/**
 * Initializes table event listeners for row manipulation, switch toggling, and input syncing.
 */
function initTableInteractions() {
    const table = document.getElementById('level-select-table');
    if (!table) return;

    table.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement} */ (event.target);
        if (target.classList.contains('trash-btn') || target.closest('.trash-btn')) {
            const row = target.closest('tr');
            if (row) {
                const stepId = parseInt(row.getAttribute('data-step-id') || '0', 10);
                trashStep(stepId);
            }
        }
    });

    table.addEventListener('change', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.target);
        if (target.classList.contains('enable-switch')) {
            const row = target.closest('tr');
            if (!row) return;
            const levelInput = /** @type {HTMLInputElement | null} */ (row.querySelector('.level-input'));
            const stepId = parseInt(row.getAttribute('data-step-id') || '0', 10);
            if (!levelInput) return;

            if (!target.checked) {
                levelInput.value = '';
                levelInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                if (levelInput.value === '') {
                    const recVal = getEquipmentRecommendedLevel(stepId);
                    const minVal = parseInt(levelInput.getAttribute('min') || '1', 10) || 1;
                    const maxVal = parseInt(levelInput.getAttribute('max') || '18', 10) || 18;
                    const prevRow = row.previousElementSibling;
                    const prevInput = /** @type {HTMLInputElement | null} */ (prevRow?.querySelector('.level-input'));
                    const prevVal = parseInt(prevInput?.value || '', 10);

                    if (!isNaN(prevVal) && prevVal >= maxVal) {
                        target.checked = false;
                    } else if (recVal && recVal >= minVal && recVal <= maxVal) {
                        levelInput.value = String(recVal);
                        levelInput.dispatchEvent(new Event('change', { bubbles: true }));
                    } else if (minVal <= maxVal) {
                        levelInput.value = String(maxVal);
                        levelInput.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        target.checked = false;
                    }
                }
            }
            syncRows();
        } else if (target.classList.contains('level-input')) {
            syncRows();
        }
    });

    table.addEventListener('input', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.target);
        if (target.classList.contains('level-input')) {
            const row = target.closest('tr');
            if (!row) return;
            const enableSwitch = /** @type {HTMLInputElement | null} */ (row.querySelector('.enable-switch'));
            if (enableSwitch) {
                enableSwitch.checked = target.value !== '';
            }
            syncRows();
        }
    });
}

/**
 * Registers input popover helpers and validation rules for table row inputs.
 */
function registerRowInputs() {
    const tbody = document.querySelector('#level-select-table tbody');
    if (!tbody) return;

    for (let i = 1; i <= 3; i++) {
        const input = /** @type {HTMLInputElement | null} */ (tbody.querySelector(`#level-input-${i}`));
        if (!input) continue;

        registerInputPopover(input, {
            title: () => translate('validation.level'),
            min: () => parseInt(input.getAttribute('min') || '1', 10) || 1,
            max: () => parseInt(input.getAttribute('max') || '18', 10) || 18,
            showRange: true,
            showRecommended: () => {
                if (!currentEquipment) return false;
                const recVal = getEquipmentRecommendedLevel(i);
                const minVal = parseInt(input.getAttribute('min') || '1', 10) || 1;
                const maxVal = parseInt(input.getAttribute('max') || '18', 10) || 18;
                return recVal >= minVal && recVal <= maxVal && recVal > 0;
            },
            recommended: () => {
                if (!currentEquipment) return 0;
                return getEquipmentRecommendedLevel(i);
            },
            recommendedLabel: () => translate('validation.recommended'),
            clickToFill: {
                max: true,
                recommended: true
            }
        });
    }
}

/**
 * Initializes modal DOM elements and binds top-level click listeners.
 */
function ensureModalInitialized() {
    if (isInitialized && document.getElementById('level-select-modal')) return;

    const modal = ensureLevelSelectModalInDOM();
    const closeBtn = document.getElementById('close-level-select-modal-btn');
    const saveBtn = document.getElementById('level-select-modal-save-btn');
    const tbody = /** @type {HTMLElement | null} */ (document.querySelector('#level-select-table tbody'));

    if (closeBtn) closeBtn.addEventListener('click', closeLevelSelectModal);
    if (saveBtn) saveBtn.addEventListener('click', savePrioritySteps);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeLevelSelectModal();
        }
    });

    if (tbody) populateTableRows(tbody);
    registerRowInputs();
    initTableInteractions();
    isInitialized = true;
}

/**
 * Opens the Level Selection modal for fine-tuning intermediate hero equipment upgrade target steps.
 *
 * @param {any} hero - Hero definition object.
 * @param {any} equipment - Equipment definition object.
 */
export function openLevelSelectModal(hero, equipment) {
    currentEquipment = equipment;
    currentHero = hero;
    ensureModalInitialized();

    const modal = document.getElementById('level-select-modal');
    const rows = document.querySelectorAll('#level-select-table tbody tr');
    const maxLevel = getEquipmentMaxLevel(equipment.type);
    const currentLevel = state.heroes[hero.name]?.equipment[equipment.name]?.level || 1;

    updateModalHeaderDisplay(equipment.name, currentLevel);

    const equipmentUpgradePlan = state.heroes[hero.name]?.equipment[equipment.name]?.upgradePlan || {};
    const minLevel = Math.max(9, currentLevel + 1);

    const stepsToFill = [];
    for (const key in equipmentUpgradePlan) {
        if (equipmentUpgradePlan[key].enabled && equipmentUpgradePlan[key].targetLevel > currentLevel) {
            stepsToFill.push(equipmentUpgradePlan[key]);
        }
    }
    stepsToFill.sort((a, b) => a.targetLevel - b.targetLevel);

    rows.forEach((row, index) => {
        const levelInput = /** @type {HTMLInputElement} */ (row.querySelector('.level-input'));
        const enableSwitch = /** @type {HTMLInputElement} */ (row.querySelector('.enable-switch'));

        levelInput.setAttribute('min', String(minLevel));
        levelInput.setAttribute('max', String(maxLevel));

        const savedStep = stepsToFill[index];
        if (savedStep) {
            levelInput.value = String(savedStep.targetLevel);
            enableSwitch.checked = true;
            levelInput.disabled = false;
        } else {
            levelInput.value = '';
            enableSwitch.checked = false;
            levelInput.disabled = false;
        }
        addValidation(levelInput, { inputName: translate('validation.level') });
    });

    if (currentLevel < maxLevel && stepsToFill.length === 0) {
        const { defaultLevel1, defaultLevel2, defaultLevel3 } = getDefaultLevels(
            currentLevel,
            minLevel,
            maxLevel,
            equipment.type
        );

        let maxAssignedLevel = currentLevel;

        rows.forEach((row, index) => {
            const levelInput = /** @type {HTMLInputElement} */ (row.querySelector('.level-input'));
            const enableSwitch = /** @type {HTMLInputElement} */ (row.querySelector('.enable-switch'));

            levelInput.value = '';
            enableSwitch.checked = true;

            let currentDefaultLevel = 0;
            if (index === 0) {
                currentDefaultLevel = defaultLevel1;
            } else if (index === 1) {
                currentDefaultLevel = defaultLevel2;
            } else if (index === 2) {
                currentDefaultLevel = defaultLevel3;
            }

            if (currentDefaultLevel > maxLevel || currentDefaultLevel <= maxAssignedLevel || currentDefaultLevel === 0) {
                levelInput.value = '';
                enableSwitch.checked = false;
            } else {
                levelInput.value = String(currentDefaultLevel);
                enableSwitch.checked = true;
                maxAssignedLevel = currentDefaultLevel;
            }

            // If a previous step reached max level or was disabled, disable subsequent ones
            if (index > 0) {
                const prevInput = /** @type {HTMLInputElement | null} */ (rows[index - 1]?.querySelector('.level-input'));
                const prevValStr = prevInput?.value;
                if (prevValStr) {
                    const prevLevel = Number(prevValStr) || 0;
                    if (prevLevel >= maxLevel) {
                        levelInput.value = '';
                        enableSwitch.checked = false;
                    }
                } else {
                    levelInput.value = '';
                    enableSwitch.checked = false;
                }
            }
        });
    }

    syncRows();
    openModal(modal);

    setTimeout(() => {
        const firstInput = /** @type {HTMLInputElement | null} */ (rows[0]?.querySelector('.level-input'));
        if (firstInput) firstInput.focus();
    }, 100);
}

/**
 * Closes the Level Selection modal and cleans up active references.
 */
function closeLevelSelectModal() {
    const modal = document.getElementById('level-select-modal');
    if (!modal) return;
    closeModalAnimated(modal, () => {
        currentEquipment = null;
        currentHero = null;
    });
}
