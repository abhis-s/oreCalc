import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { addValidation } from '../../utils/inputValidator.js';

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
                const oldPlan = equipmentInState.upgradePlan[stepKey];

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
            const disabledSteps = uiSteps.filter(step => !step.enabled);

            enabledSteps.sort((a, b) => a.level - b.level);

            const sortedSteps = [...enabledSteps, ...disabledSteps];

            sortedSteps.forEach((step, index) => {
                const plan = equipmentInState.upgradePlan[(index + 1).toString()];
                if (plan) {
                    const isNowEnabled = step.enabled;
                    const wasEnabled = step.wasEnabled;

                    plan.level = step.level;
                    plan.target = step.level;
                    plan.enabled = isNowEnabled;

                    if (isNowEnabled && !wasEnabled) {
                        maxPriority++;
                        plan.priorityIndex = maxPriority;
                    } else if (!isNowEnabled && wasEnabled) {
                        plan.priorityIndex = 0;
                    } else if (isNowEnabled && wasEnabled) {
                        plan.priorityIndex = step.priorityIndex;
                    }
                }
            });

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
                        <input type="checkbox" class="enable-switch" checked>
                        <span class="slider round"></span>
                    </label>
                </td>
                <td>#${i}</td>
                <td><input type="number" class="level-input" placeholder="e.g., 18" maxlength="2"></td>
                <td class="trash-cell">
                    <button class="trash-btn icon-button"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg></button>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', row);
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
                    <h2>Set Target Levels for <span id="level-select-modal-equip-name"></span></h2>
                    <button id="close-level-select-modal-btn" class="close-button">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Current level: <span id="current-equipment-level"></span></p>
                    <table id="level-select-table">
                        <thead>
                            <tr>
                                <th>Enable</th>
                                <th>Step</th>
                                <th>Level</th>
                                <th>Trash</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Rows will be inserted here by JavaScript -->
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button id="level-select-modal-save-btn" class="btn btn-primary">Save</button>
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

    equipNameSpan.textContent = equipment.name;
    const currentLevelSpan = document.getElementById('current-equipment-level');

    const rows = document.querySelectorAll('#level-select-table tbody tr');
    const maxLevel = equipment.type === 'epic' ? 27 : 18;
    const currentLevel = state.heroes[hero.name]?.equipment[equipment.name]?.level || 1;
    currentLevelSpan.textContent = currentLevel;

    const equipmentUpgradePlan = state.heroes[hero.name]?.equipment[equipment.name]?.upgradePlan;

    const minLevel = currentLevel + 1;

    rows.forEach((row, index) => {
        const levelInput = row.querySelector('.level-input');
        const enableSwitch = row.querySelector('.enable-switch');
        const stepKey = (index + 1).toString(); 
        const savedStep = equipmentUpgradePlan ? equipmentUpgradePlan[stepKey] : null;

        levelInput.setAttribute('min', minLevel); 
        levelInput.setAttribute('max', maxLevel); 

        if (savedStep && savedStep.enabled) { 
            levelInput.value = savedStep.level; 
            enableSwitch.checked = true;
            if (savedStep.level <= currentLevel) {
                levelInput.disabled = true;
                enableSwitch.checked = false;
            }
        } else {
            levelInput.value = '';
            enableSwitch.checked = false;
        }
        addValidation(levelInput, { inputName: 'Level', rules: { max: maxLevel, min: minLevel } });
    });

    const allStepsDisabled = Array.from(rows).every((row, index) => {
        const enableSwitch = row.querySelector('.enable-switch');
        return !enableSwitch.checked;
    });

    if (allStepsDisabled) {
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
                if (defaultLevel1 >= maxLevel) {
                    rows[1].querySelector('.enable-switch').checked = false;
                    rows[2].querySelector('.enable-switch').checked = false;
                }
            } else if (index === 1) { 
                levelInput.value = defaultLevel2;
                currentDefaultLevel = defaultLevel2;
                if (defaultLevel2 >= maxLevel) {
                    rows[2].querySelector('.enable-switch').checked = false;
                }
            } else if (index === 2) { 
                levelInput.value = defaultLevel3;
                currentDefaultLevel = defaultLevel3;
            }

            if (currentDefaultLevel <= currentLevel) {
                levelInput.disabled = true;
                enableSwitch.checked = false;
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
