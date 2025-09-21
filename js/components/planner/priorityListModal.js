import { formatDate } from '../../utils/dateFormatter.js';
import { heroData } from '../../data/heroData.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { openLevelSelectModal } from './levelSelectModal.js';
import { calculateCompletionDates } from '../../utils/predictionCalculator.js';
import { autoPlaceIncomeChips } from '../../utils/autoPlaceChips.js';
import { translate } from '../../i18n/translator.js';

let isAutoPlacing = false;
let autoPlaceTimeoutId = null;

function autoPlaceChipsForDateRange() {
    if (isAutoPlacing) {
        console.log("Auto-placement is already in progress.");
        return;
    }

    const startTime = new Date();

    const MIN_MONTH = 9; 
    const MIN_YEAR = 2025;
    const MAX_MONTH = 12;
    const MAX_YEAR = 2027;

    isAutoPlacing = true;
    let currentYear = MIN_YEAR;
    let currentMonth = MIN_MONTH;

    function placeNextMonth() {
        if (!isAutoPlacing || (currentYear > MAX_YEAR || (currentYear === MAX_YEAR && currentMonth > MAX_MONTH))) {
            isAutoPlacing = false;
            const endTime = new Date();
            const timeTaken = (endTime - startTime) / 1000;
            setTimeout(() => {
                console.log(`Finished auto-placing chips for all months in the range. Total time: ${timeTaken} seconds.`);
            }, 5000);
            handleStateUpdate(() => {}, false);
            return;
        }

        const monthStr = String(currentMonth).padStart(2, '0');
        const yearStr = String(currentYear);

        autoPlaceIncomeChips(monthStr, yearStr);

        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }

        autoPlaceTimeoutId = setTimeout(placeNextMonth, 0);
    }

    placeNextMonth();
}

export function getGlobalPriorityList() {
    const globalPriorityList = [];
    const heroNameMap = Object.fromEntries(Object.entries(heroData).map(([key, val]) => [val.name, key]));

    for (const heroKey in state.heroes) {
        const hero = state.heroes[heroKey];
        for (const equipName in hero.equipment) {
            const equipment = hero.equipment[equipName];
            if (equipment.upgradePlan) {
                for (const stepNum in equipment.upgradePlan) {
                    const stepData = equipment.upgradePlan[stepNum];
                    const currentLevel = state.heroes[heroKey]?.equipment[equipName]?.level || 1;
                    if (stepData.enabled && stepData.target > currentLevel) {
                        const heroDataKey = heroNameMap[heroKey];
                        if (!heroDataKey) continue;

                        globalPriorityList.push({
                            name: equipName,
                            image: heroData[heroDataKey].equipment.find(e => e.name === equipName)?.image,
                            targetLevel: stepData.target,
                            step: parseInt(stepNum, 10),
                            priorityIndex: stepData.priorityIndex,
                            heroName: heroKey
                        });
                    }
                }
            }
        }
    }
    globalPriorityList.sort((a, b) => a.priorityIndex - b.priorityIndex);

    const predictions = calculateCompletionDates(globalPriorityList);
    globalPriorityList.forEach(item => {
        const prediction = predictions.find(p =>
            p.item.heroName === item.heroName &&
            p.item.name === item.name &&
            p.item.step === item.step
        );
        if (prediction) {
            item.completionDate = prediction.completionDate;
            item.error = prediction.error;
            item.message = prediction.message;
        }
    });

    return globalPriorityList;
}

function renderPriorityEditor() {
    const modalBody = document.getElementById('priority-list-modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="priority-editor-container">
            <div id="priority-list-error-container" class="priority-list-error-message"></div>
            <div class="equipment-chip-container">
                <h3 data-i18n="add_an_upgrade_plan">${translate('add_an_upgrade_plan')}</h3>
                <div class="hero-equipment-grid"></div>
            </div>
            <div id="priority-list-editor" class="priority-list-editor">
                <!-- Draggable items will be rendered here -->
            </div>
        </div>
    `;

    const gridContainer = modalBody.querySelector('.hero-equipment-grid');
    const globalPriorityList = getGlobalPriorityList();

    for (const heroKey in heroData) {
        const hero = heroData[heroKey];

        const row = document.createElement('div');
        row.classList.add('hero-row');

        const heroColumn = document.createElement('div');
        heroColumn.classList.add('hero-chip-column');
        const heroChip = document.createElement('div');
        heroChip.classList.add('hero-chip');
        heroChip.innerHTML = `
            <img src="${hero.image}" alt="${translate(hero.name.toLowerCase().replace(/\s/g, '_'))}" class="hero-chip-icon">
            <span>${translate(hero.name.toLowerCase().replace(/\s/g, '_'))}</span>
        `;
        heroColumn.appendChild(heroChip);

        const equipmentColumn = document.createElement('div');
        equipmentColumn.classList.add('equipment-chips-column');

        hero.equipment.forEach(equip => {
            const currentLevel = state.heroes[hero.name]?.equipment[equip.name]?.level || 1;
            const maxLevel = equip.type === 'epic' ? 27 : 18;

            if (currentLevel < maxLevel) {
                const chip = document.createElement('div');
                chip.classList.add('equipment-chip');
                chip.dataset.equipName = equip.name;
                chip.innerHTML = `
                    <img src="${equip.image}" alt="${translate(equip.name.toLowerCase().replace(/\s/g, '_'))}" class="chip-icon">
                    <span>${translate(equip.name.toLowerCase().replace(/\s/g, '_'))}</span>
                `;
                chip.addEventListener('click', () => openLevelSelectModal(hero, equip));

                const isMaxedInPlan = globalPriorityList.some(item =>
                    item.heroName === hero.name &&
                    item.name === equip.name &&
                    item.targetLevel === maxLevel
                );
                if (isMaxedInPlan) {
                    chip.classList.add('maxed-in-plan');
                }
                
                const customMaxLevel = state.planner.customMaxLevel[equip.type];
                const isCustomMaxedInPlan = globalPriorityList.some(item =>
                    item.heroName === hero.name &&
                    item.name === equip.name &&
                    item.targetLevel >= customMaxLevel
                );
                const isAlreadyCustomMaxed = currentLevel >= customMaxLevel;
                if (isCustomMaxedInPlan || isAlreadyCustomMaxed) {
                    chip.classList.add('custom-maxed-in-plan');
                }

                equipmentColumn.appendChild(chip);
            }
        });

        if (equipmentColumn.hasChildNodes()) {
            row.appendChild(heroColumn);
            row.appendChild(equipmentColumn);
            gridContainer.appendChild(row);
        }
    }

    renderDraggableList(globalPriorityList);
}

function renderDraggableList(globalPriorityList) {
    const editor = document.getElementById('priority-list-editor');
    if (!editor) return;

    editor.innerHTML = '';

    if (!globalPriorityList) {
        globalPriorityList = getGlobalPriorityList();
    }

    if (globalPriorityList.length === 0) {
        editor.innerHTML = `<p class="placeholder-text" data-i18n="priority_list_placeholder">${translate('priority_list_placeholder')}</p>`;
        return;
    }

    const effectiveLevels = {};

    globalPriorityList.forEach((item, index) => {
        const heroName = item.heroName;
        const equipName = item.name;

        let startLevel;
        if (!effectiveLevels[equipName]) {
            startLevel = state.heroes[heroName]?.equipment[equipName]?.level || 1;
        } else {
            startLevel = effectiveLevels[equipName];
        }

        let completionDateText;
        if (item.error) {
            completionDateText = item.message;
        } else if (item.completionDate) {
            completionDateText = `${translate('complete_by_colon')} ${formatDate(item.completionDate, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            completionDateText = translate('not_enough_income');
        }

        const listItem = document.createElement('div');
        listItem.classList.add('priority-list-editor-item');
        if (item.error) {
            listItem.classList.add('error');
        }
        listItem.setAttribute('draggable', 'true');
        listItem.dataset.index = index;
        listItem.dataset.heroName = heroName;
        listItem.dataset.equipName = equipName;
        listItem.dataset.step = item.step;

        listItem.innerHTML = `
            <div class="drag-handle"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M160-360v-80h640v80H160Zm0-160v-80h640v80H160Z"/></svg></div>
            <img src="${item.image}" alt="${item.name}" class="item-image">
            <div class="item-details">
                <span class="item-name">${translate('equipment_upgrade_step_level_range', { n: item.step, x: startLevel, y: item.targetLevel })}</span>
                <div class="priority-item-date">${completionDateText}</div>
            </div>
            <button class="delete-item-btn">&times;</button>
        `;

        const deleteBtn = listItem.querySelector('.delete-item-btn');
        deleteBtn.addEventListener('click', () => {
            handleStateUpdate(() => {
                const plan = state.heroes[heroName]?.equipment[equipName]?.upgradePlan[item.step];
                if (plan) {
                    plan.enabled = false;
                    plan.priorityIndex = 0;
                }

                const reorderedGlobalPriorityList = getGlobalPriorityList();

                if (!reorderedGlobalPriorityList.error) {
                    reorderedGlobalPriorityList.forEach((reorderedItem, reorderedIndex) => {
                        state.heroes[reorderedItem.heroName].equipment[reorderedItem.name].upgradePlan[reorderedItem.step].priorityIndex = reorderedIndex + 1;
                    });
                }
            });
            renderDraggableList();
        });

        editor.appendChild(listItem);

        effectiveLevels[equipName] = item.targetLevel;
    });
    checkForStepOrderErrors(globalPriorityList);
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.priority-list-editor-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function checkForStepOrderErrors(globalPriorityList) {
    if (!globalPriorityList) {
        globalPriorityList = getGlobalPriorityList();
    }
    const equipmentGroups = {};

    globalPriorityList.forEach(item => {
        if (!equipmentGroups[item.name]) {
            equipmentGroups[item.name] = [];
        }
        equipmentGroups[item.name].push(item);
    });

    let hasError = false;
    const errorItems = new Set();

    for (const equipName in equipmentGroups) {
        const items = equipmentGroups[equipName];
        for (let i = 0; i < items.length - 1; i++) {
            if (items[i].step > items[i + 1].step) {
                hasError = true;
                errorItems.add(`${items[i].name}-${items[i].step}`);
                errorItems.add(`${items[i+1].name}-${items[i+1].step}`);
            }
        }
    }

    const errorContainer = document.getElementById('priority-list-error-container');
    const listItems = document.querySelectorAll('.priority-list-editor-item');

    listItems.forEach(item => item.classList.remove('error'));

    if (hasError) {
        errorContainer.textContent = translate('warn_steps_not_in_order');
        errorContainer.style.display = 'block';

        listItems.forEach(item => {
            const key = `${item.dataset.equipName}-${item.dataset.step}`;
            if (errorItems.has(key)) {
                item.classList.add('error');
            }
        });
    } else {
        errorContainer.style.display = 'none';
    }
}

export function initializePriorityListModal() {
    const modal = document.getElementById('priority-list-modal');
    const closeBtn = document.getElementById('close-priority-list-modal-btn');
    const resetButton = document.getElementById('reset-priority-list-modal-btn');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            handleStateUpdate(() => {
                for (const heroKey in state.heroes) {
                    const hero = state.heroes[heroKey];
                    for (const equipName in hero.equipment) {
                        hero.equipment[equipName].upgradePlan = {};
                    }
                }
            });
            renderPriorityEditor();
            window.location.reload();
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.classList.remove('show');
        }
    });

    document.addEventListener('priorityListUpdated', () => {
        renderDraggableList();
    });

    const modalBody = document.getElementById('priority-list-modal-body');
    if (modalBody) {
        let draggedItem = null;

        modalBody.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('priority-list-editor-item')) {
                draggedItem = e.target;
                setTimeout(() => {
                    draggedItem.classList.add('dragging');
                }, 0);
            }
        });

        modalBody.addEventListener('dragend', (e) => {
            if (draggedItem) {
                draggedItem.classList.remove('dragging');
                draggedItem = null;
            }
        });

        modalBody.addEventListener('dragover', (e) => {
            e.preventDefault();
            const editor = document.getElementById('priority-list-editor');
            if (editor) {
                const afterElement = getDragAfterElement(editor, e.clientY);
                const dragging = document.querySelector('.dragging');
                if (dragging) {
                    if (afterElement == null) {
                        editor.appendChild(dragging);
                    } else {
                        editor.insertBefore(dragging, afterElement);
                    }
                }
            }
        });

        modalBody.addEventListener('drop', (e) => {
            e.preventDefault();
            if (draggedItem) {
                const editor = document.getElementById('priority-list-editor');
                const newOrderedItems = [...editor.querySelectorAll('.priority-list-editor-item')];

                handleStateUpdate(() => {
                    newOrderedItems.forEach((domItem, index) => {
                        const { heroName, equipName, step } = domItem.dataset;
                        if (heroName && equipName && step) {
                            const plan = state.heroes[heroName]?.equipment[equipName]?.upgradePlan[step];
                            if (plan) {
                                plan.priorityIndex = index + 1;
                            }
                        }
                    });
                });
                
                renderDraggableList();
            }
        });
    }
}

export function openPriorityListModal() {
    const modal = document.getElementById('priority-list-modal');
    const title = document.getElementById('priority-list-modal-title');

    if (modal && title) {
        title.setAttribute('data-i18n', 'edit_priority_list');
        title.textContent = translate('edit_priority_list');
        renderPriorityEditor();
        modal.classList.add('show');
        autoPlaceChipsForDateRange();
    }
}

export function renderPriorityListModal(state) {
   const modal = document.getElementById('priority-list-modal');
   if (modal && modal.classList.contains('show')) {
       renderPriorityEditor();
   }
}
