import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { addValidation } from '../../utils/inputValidator.js';
import { translate } from '../../i18n/translator.js';
import { getSVG } from '../../utils/svgManager.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';

let currentEquipment = null;

function savePrioritySteps() {
    const rows = document.querySelectorAll('#level-select-table tbody tr');

    let heroNameForCurrentEquipment = null;
    for (const heroKey in state.heroes) {
        if (state.heroes[heroKey].equipment && state.heroes[heroKey].equipment.hasOwnProperty(currentEquipment.name)) {
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

            const uiSteps = Array.from(rows).map((row, index) => {
                const enableSwitch = row.querySelector('.enable-switch');
                const levelInput = row.querySelector('.level-input');
                const level = parseInt(levelInput.value, 10);
                const isEnabled = enableSwitch.checked && !isNaN(level) && level > 0;
                const stepKey = row.dataset.stepId;
                const oldPlan = oldUpgradePlan[stepKey];

                return {
                    stepKey: stepKey,
                    level: isEnabled ? level : 0,
                    enabled: isEnabled,
                    priorityIndex: oldPlan ? oldPlan.priorityIndex : 0,
                    wasEnabled: oldPlan ? oldPlan.enabled && oldPlan.priorityIndex > 0 : false
                };
            });

            const uniqueLevels = new Set();
            uiSteps.forEach(step => {
                if (!step.enabled) return;
                if (uniqueLevels.has(step.level)) {
                    step.enabled = false; 
                }
                uniqueLevels.add(step.level);
            });

            const enabledSteps = uiSteps.filter(step => step.enabled);
            enabledSteps.sort((a, b) => a.level - b.level);

            if (enabledSteps.length === 0) {
                delete equipmentInState.upgradePlan;
            } else {
                // Find existing priority anchor for this equipment
                let anchorPriority = Infinity;
                enabledSteps.forEach(step => {
                    if (step.wasEnabled && step.priorityIndex > 0) {
                        anchorPriority = Math.min(anchorPriority, step.priorityIndex);
                    }
                });

                if (anchorPriority === Infinity) {
                    anchorPriority = maxPriority + 1;
                }

                equipmentInState.upgradePlan = {};
                enabledSteps.forEach((step, index) => {
                    const stepKey = (index + 1).toString();
                    
                    // Assign a priority index that keeps steps together and ordered
                    // Using a small offset for ordering within the group
                    const plan = {
                        level: step.level,
                        target: step.level,
                        enabled: true,
                        priorityIndex: anchorPriority + (index * 0.001)
                    };
                    
                    equipmentInState.upgradePlan[stepKey] = plan;
                });
            }

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
                                    equipName: equipName,
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


function renderTableRows() {
    const tbody = document.querySelector('#level-select-table tbody');
    tbody.innerHTML = ''; 

    for (let i = 1; i <= 3; i++) {
        const row = `
            <tr data-step-id="${i}">
                <td>
                    <label class="switch">
                        <input type="checkbox" id="enable-switch-${i}" class="enable-switch" checked>
                        <span class="slider round"></span>
                    </label>
                </td>
                <td>#${i}</td>
                <td class="level-input-cell">
                    <div class="popover-wrapper">
                        <input type="number" id="level-input-${i}" class="level-input" placeholder="${translate('planner.placeholderLevel')}" maxlength="2">
                    </div>
                </td>
                <td class="trash-cell">
                    <button class="trash-btn icon-button">${getSVG('trash', '', 24, 24, 'currentColor')}</button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);

        const input = tbody.querySelector(`#level-input-${i}`);
        registerInputPopover(input, {
            title: translate('planner.level'),
            min: () => parseInt(input.getAttribute('min')) || 1,
            max: () => parseInt(input.getAttribute('max')) || 18,
            showRange: true,
            clickToFill: { max: true }
        });
    }
}

function addTableEventListeners() {
    const table = document.getElementById('level-select-table');
    table.addEventListener('click', (event) => {
        if (event.target.classList.contains('trash-btn') || event.target.closest('.trash-btn')) {
            const row = event.target.closest('tr');
            const stepId = parseInt(row.dataset.stepId, 10);
            trashStep(stepId);
        }
    });
}

function trashStep(stepId) {
    const rows = Array.from(document.querySelectorAll('#level-select-table tbody tr'));
    const stepIndex = stepId - 1;

    for (let i = stepIndex; i < rows.length - 1; i++) {
        const currentStepRow = rows[i];
        const nextStepRow = rows[i + 1];

        const nextLevelInput = nextStepRow.querySelector('.level-input');
        const currentLevelInput = currentStepRow.querySelector('.level-input');
        currentLevelInput.value = nextLevelInput.value;

        const nextEnableSwitch = nextStepRow.querySelector('.enable-switch');
        const currentEnableSwitch = currentStepRow.querySelector('.enable-switch');
        currentEnableSwitch.checked = nextEnableSwitch.checked;
    }

    const lastStepRow = rows[rows.length - 1];
    const lastLevelInput = lastStepRow.querySelector('.level-input');
    const lastEnableSwitch = lastStepRow.querySelector('.enable-switch');

    lastLevelInput.value = '';
    lastEnableSwitch.checked = false;
}

export function createLevelSelectModal() {
    if (document.getElementById('level-select-modal')) return;

    const modalHtml = `
        <div id="level-select-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${translate('planner.setTargetFor')} <span id="level-select-modal-equip-name"></span></h2>
                    <button id="close-level-select-modal-btn" class="close-button">${getSVG('close', '', 24, 24, 'currentColor')}</button>
                </div>
                <div class="modal-body">
                    <p>${translate('planner.currentLevel')} <span id="current-equipment-level"></span></p>
                    <table id="level-select-table">
                        <thead>
                            <tr>
                                <th>${translate('actions.enable')}</th>
                                <th>${translate('planner.step')}</th>
                                <th>${translate('planner.level')}</th>
                                <th>${translate('actions.trash')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Rows will be inserted here by JavaScript -->
                        </tbody>
                    </table>
                </div>
                <div class="modal-actions">
                    <button id="level-select-modal-save-btn" class="accept-button">${translate('actions.save')}</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('level-select-modal');
    const closeBtn = document.getElementById('close-level-select-modal-btn');
    const saveBtn = document.getElementById('level-select-modal-save-btn');

    closeBtn.addEventListener('click', closeLevelSelectModal);
    saveBtn.addEventListener('click', savePrioritySteps);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeLevelSelectModal();
        }
    });

    renderTableRows();
    addTableEventListeners();
}

export function openLevelSelectModal(hero, equipment) {
    currentEquipment = equipment;
    createLevelSelectModal(); 

    const modal = document.getElementById('level-select-modal');
    const equipNameSpan = document.getElementById('level-select-modal-equip-name');

    equipNameSpan.textContent = translate('equipment.' + toCamelCase(equipment.name));
    const currentLevelSpan = document.getElementById('current-equipment-level');

    const rows = document.querySelectorAll('#level-select-table tbody tr');
    const maxLevel = equipment.type === 'epic' ? 27 : 18;
    const currentLevel = state.heroes[hero.name]?.equipment[equipment.name]?.level || 1;
    currentLevelSpan.textContent = currentLevel;

    const equipmentUpgradePlan = state.heroes[hero.name]?.equipment[equipment.name]?.upgradePlan || {};

    const minLevel = currentLevel + 1;

    let stepsToFill = [];
    for (const key in equipmentUpgradePlan) {
        if (equipmentUpgradePlan[key].enabled && equipmentUpgradePlan[key].level > currentLevel) {
            stepsToFill.push(equipmentUpgradePlan[key]);
        }
    }
    stepsToFill.sort((a, b) => a.level - b.level);

    rows.forEach((row, index) => {
        const levelInput = row.querySelector('.level-input');
        const enableSwitch = row.querySelector('.enable-switch');

        levelInput.setAttribute('min', minLevel); 
        levelInput.setAttribute('max', maxLevel); 

        const savedStep = stepsToFill[index];

        if (savedStep) { 
            levelInput.value = savedStep.level; 
            enableSwitch.checked = true;
            levelInput.disabled = false;
        } else {
            levelInput.value = '';
            enableSwitch.checked = false;
            levelInput.disabled = false;
        }
        addValidation(levelInput, { inputName: translate('validation.level'), rules: { max: maxLevel, min: minLevel } });
    });

    if (currentLevel < maxLevel && stepsToFill.length === 0) {
        let defaultLevel1, defaultLevel2, defaultLevel3;

        defaultLevel1 = Math.ceil((currentLevel + 1) / 3) * 3;
        if (defaultLevel1 > maxLevel) {
            defaultLevel1 = maxLevel;
        }
        defaultLevel1 = Math.max(defaultLevel1, 9);
        defaultLevel1 = Math.max(defaultLevel1, minLevel); 

        defaultLevel2 = defaultLevel1 + 3;
        if (defaultLevel2 > maxLevel) {
            defaultLevel2 = maxLevel;
        }
        defaultLevel2 = Math.max(defaultLevel2, equipment.type === 'epic' ? 18 : 12);
        defaultLevel2 = Math.max(defaultLevel2, minLevel); 

        defaultLevel3 = maxLevel;
        defaultLevel3 = Math.max(defaultLevel3, minLevel); 
        
        rows.forEach((row, index) => {
            const levelInput = row.querySelector('.level-input');
            const enableSwitch = row.querySelector('.enable-switch');

            levelInput.value = ''; 
            enableSwitch.checked = true; 

            let currentDefaultLevel;

            if (index === 0) { 
                levelInput.value = defaultLevel1;
                currentDefaultLevel = defaultLevel1;
            } else if (index === 1) { 
                levelInput.value = defaultLevel2;
                currentDefaultLevel = defaultLevel2;
            } else if (index === 2) { 
                levelInput.value = defaultLevel3;
                currentDefaultLevel = defaultLevel3;
            }

            if (currentDefaultLevel > maxLevel || currentDefaultLevel <= currentLevel) {
                levelInput.value = '';
                enableSwitch.checked = false;
            }

            // If a previous step reached max level, disable subsequent ones
            if (index > 0) {
                const prevLevel = parseInt(rows[index-1].querySelector('.level-input').value, 10);
                if (prevLevel >= maxLevel) {
                    levelInput.value = '';
                    enableSwitch.checked = false;
                }
            }
        });
    }

    modal.classList.add('show');
    rows[0].querySelector('.level-input').focus();
}

export function closeLevelSelectModal() {
    const modal = document.getElementById('level-select-modal');
    modal.classList.remove('show');
    currentEquipment = null;
}