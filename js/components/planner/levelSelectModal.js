import { handleStateUpdate } from '../../core/stateManager.js';
import { state } from '../../core/state.js';

import { addValidation } from '../../utils/inputValidator.js';
import { getSVG } from '../../utils/svgManager.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { translate } from '../../i18n/translator.js';

let currentEquipment = null;
let currentHero = null;

function getDefaultLevels(currentLevel, minLevel, maxLevel, type) {
    let defaultLevel1 = Math.ceil((currentLevel + 1) / 3) * 3;
    if (defaultLevel1 > maxLevel) {
        defaultLevel1 = maxLevel;
    }
    defaultLevel1 = Math.max(defaultLevel1, 9);
    defaultLevel1 = Math.max(defaultLevel1, minLevel); 

    let defaultLevel2 = defaultLevel1 + 3;
    if (defaultLevel2 > maxLevel) {
        defaultLevel2 = maxLevel;
    }
    defaultLevel2 = Math.max(defaultLevel2, type === 'epic' ? 18 : 12);
    defaultLevel2 = Math.max(defaultLevel2, minLevel); 

    let defaultLevel3 = maxLevel;
    defaultLevel3 = Math.max(defaultLevel3, minLevel); 

    return { defaultLevel1, defaultLevel2, defaultLevel3 };
}

function getEquipmentRecommendedLevel(stepIndex) {
    if (!currentEquipment || !currentHero) return 0;
    
    const maxLevel = currentEquipment.type === 'epic' ? 27 : 18;
    const currentLevel = state.heroes[currentHero.name]?.equipment[currentEquipment.name]?.level || 1;
    const minLevel = currentLevel + 1;
    
    const { defaultLevel1, defaultLevel2, defaultLevel3 } = getDefaultLevels(
        currentLevel,
        minLevel,
        maxLevel,
        currentEquipment.type
    );

    if (stepIndex === 1) return defaultLevel1;
    if (stepIndex === 2) {
        if (defaultLevel2 <= defaultLevel1) return 0;
        return defaultLevel2;
    }
    if (stepIndex === 3) {
        if (defaultLevel3 <= defaultLevel2 || defaultLevel3 <= defaultLevel1) return 0;
        return defaultLevel3;
    }

    return 0;
}

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

            const oldSteps = [];
            for (const stepKey in oldUpgradePlan) {
                const step = oldUpgradePlan[stepKey];
                if (step.enabled && step.priorityIndex > 0) {
                    oldSteps.push({
                        stepKey: stepKey,
                        level: step.level,
                        priorityIndex: step.priorityIndex
                    });
                }
            }
            oldSteps.sort((a, b) => a.level - b.level);

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

            const N_new = enabledSteps.length;
            const N_old = oldSteps.length;

            if (enabledSteps.length === 0) {
                delete equipmentInState.upgradePlan;
            } else {
                equipmentInState.upgradePlan = {};

                if (N_old === 0) {
                    enabledSteps.forEach((step, index) => {
                        step.priorityIndex = maxPriority + 1 + index;
                    });
                } else if (N_new <= N_old) {
                    enabledSteps.forEach((step, index) => {
                        step.priorityIndex = oldSteps[index].priorityIndex;
                    });
                } else {
                    const newHighest = enabledSteps[N_new - 1];
                    const oldHighest = oldSteps[N_old - 1];

                    if (newHighest.level > oldHighest.level) {
                        newHighest.priorityIndex = maxPriority + 1;
                    } else {
                        newHighest.priorityIndex = oldHighest.priorityIndex;
                    }

                    if (N_old === 1) {
                        const anchor = oldHighest.priorityIndex;
                        for (let i = 0; i < N_new - 1; i++) {
                            enabledSteps[i].priorityIndex = anchor - 0.002 + (i * 0.001);
                        }
                    } else if (N_old === 2) {
                        const S_low = enabledSteps[0];
                        const S_mid = enabledSteps[1];
                        const O_low = oldSteps[0];

                        if (S_mid.level > O_low.level) {
                            S_mid.priorityIndex = O_low.priorityIndex + 0.001;
                            if (S_low.level === O_low.level) {
                                S_low.priorityIndex = O_low.priorityIndex;
                            } else {
                                S_low.priorityIndex = O_low.priorityIndex - 0.001;
                            }
                        } else {
                            S_low.priorityIndex = O_low.priorityIndex;
                            S_mid.priorityIndex = O_low.priorityIndex + 0.001;
                        }
                    } else if (N_old >= 3) {
                        enabledSteps.forEach((step, index) => {
                            step.priorityIndex = oldSteps[index].priorityIndex;
                        });
                    }
                }

                enabledSteps.forEach((step, index) => {
                    const stepKey = (index + 1).toString();
                    
                    const plan = {
                        level: step.level,
                        target: step.level,
                        enabled: true,
                        priorityIndex: step.priorityIndex
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
                    <div class="switch">
                        <input type="checkbox" id="enable-switch-${i}" class="enable-switch" checked>
                        <span class="slider round"></span>
                    </div>
                </td>
                <td>#${i}</td>
                <td class="level-input-cell">
                    <div class="popover-wrapper">
                        <input type="number" id="level-input-${i}" class="level-input" placeholder="${translate('planner.placeholderLevel')}" maxlength="2" data-allow-empty="true">
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
            showRecommended: () => {
                if (!currentEquipment) return false;
                const recVal = getEquipmentRecommendedLevel(i);
                const minVal = parseInt(input.getAttribute('min')) || 1;
                return recVal >= minVal;
            },
            recommended: () => {
                if (!currentEquipment) return 0;
                return getEquipmentRecommendedLevel(i);
            },
            recommendedLabel: () => {
                return translate('planner.recommended') || 'Recommended';
            },
            clickToFill: {
                max: true,
                recommended: true
            }
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

    table.addEventListener('change', (event) => {
        if (event.target.classList.contains('enable-switch')) {
            const row = event.target.closest('tr');
            const levelInput = row.querySelector('.level-input');
            const stepId = parseInt(row.dataset.stepId, 10);
            if (!event.target.checked) {
                levelInput.value = '';
                levelInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                if (levelInput.value === '') {
                    const recVal = getEquipmentRecommendedLevel(stepId);
                    const minVal = parseInt(levelInput.getAttribute('min')) || 1;
                    const maxVal = parseInt(levelInput.getAttribute('max')) || 18;
                    levelInput.value = (recVal && recVal >= minVal) ? recVal : maxVal;
                    levelInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    });

    table.addEventListener('input', (event) => {
        if (event.target.classList.contains('level-input')) {
            const row = event.target.closest('tr');
            const enableSwitch = row.querySelector('.enable-switch');
            if (event.target.value === '') {
                enableSwitch.checked = false;
            } else {
                enableSwitch.checked = true;
            }
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
                    <h2><span class="set-target-text">${translate('planner.setTargetFor')}</span> <span id="level-select-modal-equip-name"></span></h2>
                    <div class="modal-header-actions">
                        <button id="level-select-modal-info-btn" class="info-button info-btn" data-info="planner.levelSelectModalHelp" data-i18n-aria-label="actions.showInfo" aria-label="Show Information">
                            ${getSVG('info', 'info-icon', 24, 24, 'currentColor')}
                        </button>
                        <button id="close-level-select-modal-btn" class="close-button">${getSVG('close', '', 24, 24, 'currentColor')}</button>
                    </div>
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
    currentHero = hero;
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

    const minLevel = Math.max(9, currentLevel + 1);

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

        const stepNum = index + 1;
        const recVal = getEquipmentRecommendedLevel(stepNum);
        const defaultMaxPlaceholder = equipment.type === 'epic' ? 27 : 18;
        const displayVal = (recVal && recVal >= minLevel) ? recVal : defaultMaxPlaceholder;

        const basePlaceholderText = translate('planner.placeholderLevel') || 'e.g., 18';
        const prefix = basePlaceholderText.includes('18') ? basePlaceholderText.split('18')[0] : 'e.g., ';
        levelInput.setAttribute('placeholder', `${prefix}${displayVal}`);

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
        const { defaultLevel1, defaultLevel2, defaultLevel3 } = getDefaultLevels(
            currentLevel,
            minLevel,
            maxLevel,
            equipment.type
        ); 
        
        let maxAssignedLevel = currentLevel;

        rows.forEach((row, index) => {
            const levelInput = row.querySelector('.level-input');
            const enableSwitch = row.querySelector('.enable-switch');

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

            if (currentDefaultLevel > maxLevel || currentDefaultLevel <= maxAssignedLevel) {
                levelInput.value = '';
                enableSwitch.checked = false;
            } else {
                levelInput.value = currentDefaultLevel;
                enableSwitch.checked = true;
                maxAssignedLevel = currentDefaultLevel;
            }

            // If a previous step reached max level or was disabled, disable subsequent ones
            if (index > 0) {
                const prevValStr = rows[index-1].querySelector('.level-input').value;
                if (prevValStr) {
                    const prevLevel = parseInt(prevValStr, 10);
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

    modal.classList.add('show');
    rows[0].querySelector('.level-input').focus();
}

export function closeLevelSelectModal() {
    const modal = document.getElementById('level-select-modal');
    modal.classList.remove('show');
    currentEquipment = null;
    currentHero = null;
}