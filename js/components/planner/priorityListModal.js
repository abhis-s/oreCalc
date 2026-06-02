import { formatDate } from '../../utils/dateFormatter.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getMinDate, getMaxDate } from '../../utils/dateUtils.js';
import { heroData } from '../../data/heroData.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { openLevelSelectModal } from './levelSelectModal.js';
import { calculateCompletionDates } from '../../utils/predictionCalculator.js';
import { autoPlaceIncomeChipsForRange } from '../../utils/autoPlaceChips.js';
import { translate } from '../../i18n/translator.js';
import { getSVG } from '../../utils/svgManager.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { addValidation } from '../../utils/inputValidator.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { logger } from '../../utils/logger.js';

function autoPlaceChipsForDateRange() {
    const startTime = new Date();

    const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
    const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();

    autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR);

    const endTime = new Date();
    const timeTaken = (endTime - startTime) / 1000;
    logger.log(`Finished auto-placing chips for all months in the range. Total time: ${timeTaken} seconds.`);
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

    const { predictions, suggestions } = calculateCompletionDates(globalPriorityList);
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
            item.oresPreCompletion = prediction.oresPreCompletion;
            item.oresPostCompletion = prediction.oresPostCompletion;
            item.requiredOres = prediction.requiredOres;
            item.bottleneckOre = prediction.bottleneckOre;
        }
    });

    return { globalPriorityList, suggestions };
}

function renderPriorityEditor() {
    const modalBody = document.getElementById('priority-list-modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="priority-editor-container">
            <div id="priority-list-message-container" class="priority-list-message-box"></div>
            <div class="equipment-chip-container">
                <h3 data-i18n="planner.addPlan">${translate('planner.addPlan')}</h3>
                <div class="hero-equipment-grid"></div>
            </div>
            <div id="priority-list-editor" class="priority-list-editor">
                <!-- Draggable items will be rendered here -->
            </div>
        </div>
    `;

    const gridContainer = modalBody.querySelector('.hero-equipment-grid');
    const { globalPriorityList, suggestions } = getGlobalPriorityList();

    for (const heroKey in heroData) {
        const hero = heroData[heroKey];

        const row = document.createElement('div');
        row.classList.add('hero-row');

        const heroColumn = document.createElement('div');
        heroColumn.classList.add('hero-chip-column');
        const heroChip = document.createElement('div');
        heroChip.classList.add('hero-chip');
        heroChip.innerHTML = `
            <orecalc-assets-image src="${hero.image}" alt="${translate('heroes.' + toCamelCase(hero.name))}" class="hero-chip-icon" size="thumbnail"></orecalc-assets-image>
            <span>${translate('heroes.' + toCamelCase(hero.name))}</span>
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
                    <orecalc-assets-image src="${equip.image}" alt="${translate('equipment.' + toCamelCase(equip.name))}" class="chip-icon" size="thumbnail"></orecalc-assets-image>
                    <span>${translate('equipment.' + toCamelCase(equip.name))}</span>
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

                const customMaxLevel = state.planner.customMaxLevel?.[equip.type] || (equip.type === 'epic' ? 27 : 18);
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

    renderDraggableList(globalPriorityList, suggestions);
}

export function getStepOrderErrors(globalPriorityList) {
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
                errorItems.add(`${items[i + 1].name}-${items[i + 1].step}`);
            }
        }
    }
    return { hasError, errorItems };
}

let suggestionsHidden = false;

function renderSuggestionsAndErrors(globalPriorityList, suggestions) {
    const errorContainer = document.getElementById('priority-list-message-container');
    const unhideBtn = document.getElementById('unhide-suggestion-btn');
    const listItems = document.querySelectorAll('.priority-list-editor-item');

    errorContainer.innerHTML = '';
    errorContainer.style.display = 'none';
    errorContainer.classList.remove('suggestion-only', 'error');
    if (unhideBtn) unhideBtn.style.display = 'none';

    listItems.forEach(item => item.classList.remove('error', 'suggestion'));
    document.querySelectorAll('.suggestion-bar').forEach(bar => bar.remove());

    const { hasError, errorItems } = getStepOrderErrors(globalPriorityList);

    if (hasError) {
        errorContainer.classList.add('error');
        errorContainer.innerHTML += `
            <div class="error-messages-wrapper">
                <p class="error-message">
                    ${getSVG('error', 'error-icon', 20, 20, 'currentColor')}
                    <span>${translate('planner.orderError')}</span>
                </p>
            </div>
            <button id="fix-order-btn" class="fix-order-btn success-btn">
                ${getSVG('check', '', 18, 18, 'currentColor')}
                <span>${translate('actions.fix')}</span>
            </button>
        `;

        const fixBtn = document.getElementById('fix-order-btn');
        if (fixBtn) {
            fixBtn.addEventListener('click', () => {
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
                                // Swap priority indices of the two items
                                const itemA = items[i];
                                const itemB = items[i + 1];
                                
                                const planA = state.heroes[itemA.heroName].equipment[itemA.name].upgradePlan[itemA.step];
                                const planB = state.heroes[itemB.heroName].equipment[itemB.name].upgradePlan[itemB.step];
                                
                                const tempIndex = planA.priorityIndex;
                                planA.priorityIndex = planB.priorityIndex;
                                planB.priorityIndex = tempIndex;
                                
                                return; // Fix one pair per click
                            }
                        }
                    }
                });
                renderDraggableList();
            });
        }

        listItems.forEach(item => {
            const key = `${item.dataset.equipName}-${item.dataset.step}`;
            if (errorItems.has(key)) {
                item.classList.add('error');
            }
        });
    }

    const hasSuggestions = suggestions && suggestions.length > 0;

    // Only show suggestions if there's no error
    if (hasSuggestions && !hasError) {
        if (!suggestionsHidden) {
            let suggestionsHtml = `<div class="suggestion-messages-wrapper">`;
            suggestionsHtml += suggestions.map(s => `
                <p class="suggestion-message">
                    ${getSVG('suggestion', 'suggestion-icon', 16, 16, 'currentColor')}
                    <span>${s.message}</span>
                </p>
            `).join('');
            suggestionsHtml += `</div>`;

            errorContainer.classList.add('suggestion-only');
            suggestionsHtml += `<button class="hide-suggestion-btn" id="hide-suggestion-btn">${translate('actions.hide')}</button>`;

            errorContainer.innerHTML += suggestionsHtml;

            suggestions.forEach(suggestion => {
                const { itemToMove, itemsToMove, moveBefore } = suggestion;
                const items = itemsToMove || (itemToMove ? [itemToMove] : []);

                items.forEach(itm => {
                    const itemToMoveElement = Array.from(listItems).find(el =>
                        el.dataset.heroName === itm.heroName &&
                        el.dataset.equipName === itm.name &&
                        el.dataset.step == itm.step
                    );
                    if (itemToMoveElement) {
                        itemToMoveElement.classList.add('suggestion');
                    }
                });

                if (moveBefore) {
                    const moveBeforeElement = Array.from(listItems).find(el =>
                        el.dataset.heroName === moveBefore.heroName &&
                        el.dataset.equipName === moveBefore.name &&
                        el.dataset.step == moveBefore.step
                    );
                    if (moveBeforeElement) {
                        // Avoid adding multiple bars for the same move-before target
                        if (!moveBeforeElement.previousElementSibling?.classList.contains('suggestion-bar')) {
                            const suggestionBar = document.createElement('div');
                            suggestionBar.className = 'suggestion-bar';
                            moveBeforeElement.parentNode.insertBefore(suggestionBar, moveBeforeElement);
                        }
                    }
                }
            });

            if (!hasError) {
                const hideBtn = errorContainer.querySelector('#hide-suggestion-btn');
                if (hideBtn) {
                    hideBtn.addEventListener('click', () => {
                        suggestionsHidden = true;
                        renderSuggestionsAndErrors(globalPriorityList, suggestions);
                    });
                }
            }
        } else if (!hasError && suggestionsHidden) {
            if (unhideBtn) {
                unhideBtn.style.display = 'flex';
                const badge = unhideBtn.querySelector('#suggestion-badge');
                if (badge) badge.textContent = suggestions.length;
            }
        }
    }

    if (hasError || (hasSuggestions && !suggestionsHidden)) {
        errorContainer.style.display = 'flex';
    }
}

function renderDraggableList(globalPriorityList, suggestions) {
    const editor = document.getElementById('priority-list-editor');
    if (!editor) return;

    editor.innerHTML = '';

    if (!globalPriorityList) {
        const { globalPriorityList: newList, suggestions: newSuggestions } = getGlobalPriorityList();
        globalPriorityList = newList;
        suggestions = newSuggestions;
    }

    const resetButton = document.getElementById('reset-priority-list-modal-btn');
    if (resetButton) {
        resetButton.style.display = globalPriorityList.length === 0 ? 'none' : 'block';
    }

    if (globalPriorityList.length === 0) {
        editor.innerHTML = `<p class="placeholder-text" data-i18n="planner.priorityPlaceholder">${translate('planner.priorityPlaceholder')}</p>`;
        renderSuggestionsAndErrors([], []);
        return;
    }

    const { errorItems } = getStepOrderErrors(globalPriorityList);
    const equipmentsWithErrors = new Set();
    errorItems.forEach(itemKey => {
        const equipName = itemKey.split('-').slice(0, -1).join('-');
        equipmentsWithErrors.add(equipName);
    });

    const effectiveLevels = {};

    globalPriorityList.forEach((item, index) => {
        const heroName = item.heroName;
        const equipName = item.name;

        let startLevel;
        if (equipmentsWithErrors.has(equipName)) {
            startLevel = 'XX';
        } else if (!effectiveLevels[equipName]) {
            startLevel = state.heroes[heroName]?.equipment[equipName]?.level || 1;
        } else {
            startLevel = effectiveLevels[equipName];
        }

        let completionDateText;
        const itemKey = `${item.name}-${item.step}`;
        const hasOrderError = errorItems.has(itemKey);

        if (hasOrderError) {
            completionDateText = translate('errors.fixOrder');
        } else if (item.error) {
            completionDateText = item.message;
        } else if (item.completionDate) {
            completionDateText = `${translate('planner.completeByColon')} ${formatDate(item.completionDate, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            completionDateText = translate('planner.notEnoughIncome');
        }

        const listItem = document.createElement('div');
        listItem.classList.add('priority-list-editor-item');
        
        const isDraggingAllowed = (errorItems.size === 0) || hasOrderError;
        
        if (item.error || hasOrderError) {
            listItem.classList.add('error');
        }

        if (!isDraggingAllowed) {
            listItem.classList.add('disabled-dragging');
        }

        listItem.setAttribute('draggable', isDraggingAllowed ? 'true' : 'false');
        listItem.dataset.index = index;
        listItem.dataset.heroName = heroName;
        listItem.dataset.equipName = equipName;
        listItem.dataset.step = item.step;

        let oresHtml = '';
        if (!item.error && !hasOrderError && item.oresPreCompletion && item.requiredOres && item.bottleneckOre) {
            const bottleneckTrans = translate('ores.' + item.bottleneckOre) || item.bottleneckOre;

            let reqHtml = `<span>${formatNumber(item.requiredOres.shiny)} <orecalc-assets-image src="assets/shiny_ore.png" class="ore-icon-small"></orecalc-assets-image></span>`;
            reqHtml += ` <span>${formatNumber(item.requiredOres.glowy)} <orecalc-assets-image src="assets/glowy_ore.png" class="ore-icon-small"></orecalc-assets-image></span>`;
            if (item.requiredOres.starry > 0 || state.heroes[heroName]?.equipment[equipName]?.type === 'epic') {
                reqHtml += ` <span>${formatNumber(item.requiredOres.starry)} <orecalc-assets-image src="assets/starry_ore.png" class="ore-icon-small"></orecalc-assets-image></span>`;
            }

            oresHtml = `
                <div class="priority-item-ores tooltip-container">
                    <span>${formatNumber(item.oresPreCompletion.shiny)} <orecalc-assets-image src="assets/shiny_ore.png" class="ore-icon-small"></orecalc-assets-image></span>
                    <span>${formatNumber(item.oresPreCompletion.glowy)} <orecalc-assets-image src="assets/glowy_ore.png" class="ore-icon-small"></orecalc-assets-image></span>
                    <span>${formatNumber(item.oresPreCompletion.starry)} <orecalc-assets-image src="assets/starry_ore.png" class="ore-icon-small"></orecalc-assets-image></span>
                    
                    <div class="priority-item-tooltip">
                        <p>${translate('ores.tooltipReached')}</p>
                        <p>${translate('ores.tooltipBottleneck', { bottleneck: bottleneckTrans })}</p>
                        <p>${translate('income.prospector.tooltipConsider')}</p>
                        <div class="tooltip-req-ores">${translate('ores.tooltipRequired')} ${reqHtml}</div>
                    </div>
                </div>
            `;
        }
        listItem.dataset.step = item.step;

        listItem.innerHTML = `
            <div class="drag-handle">${getSVG('drag-handle', '', 24, 24, 'currentColor')}</div>
            <orecalc-assets-image src="${item.image}" alt="${translate('equipment.' + toCamelCase(item.name))}" class="item-image" size="thumbnail"></orecalc-assets-image>
            <div class="item-details">
                <span class="item-name">${translate('planner.stepLevelRange', { n: item.step, x: startLevel, y: item.targetLevel })}</span>
                ${oresHtml}
                <div class="priority-item-date">${completionDateText}</div>
            </div>
            <button class="delete-item-btn">${getSVG('close', '', 24, 24, 'currentColor')}</button>
        `;

        const deleteBtn = listItem.querySelector('.delete-item-btn');
        deleteBtn.addEventListener('click', async () => {
            const confirmed = await showConfirm(
                translate('planner.confirmDeleteStep', { 
                    equipment: translate('equipment.' + toCamelCase(item.name)), 
                    level: item.targetLevel 
                }),
                'status.confirm'
            );
            if (!confirmed) return;

            handleStateUpdate(() => {
                const equipmentInState = state.heroes[heroName]?.equipment[equipName];
                if (!equipmentInState || !equipmentInState.upgradePlan) return;

                // Disable the target step
                const planToDelete = equipmentInState.upgradePlan[item.step];
                if (planToDelete) {
                    planToDelete.enabled = false;
                    planToDelete.priorityIndex = 0;
                }

                // Collect and renumber remaining enabled steps for THIS equipment
                const remainingSteps = [];
                for (const sNum in equipmentInState.upgradePlan) {
                    const step = equipmentInState.upgradePlan[sNum];
                    if (step.enabled) {
                        remainingSteps.push({ ...step });
                    }
                }

                // Recreate upgradePlan with sequential keys
                if (remainingSteps.length === 0) {
                    delete equipmentInState.upgradePlan;
                } else {
                    remainingSteps.sort((a, b) => a.target - b.target);
                    equipmentInState.upgradePlan = {};
                    remainingSteps.forEach((step, idx) => {
                        const newStepKey = (idx + 1).toString();
                        equipmentInState.upgradePlan[newStepKey] = {
                            level: step.level,
                            target: step.target,
                            enabled: true,
                            priorityIndex: step.priorityIndex
                        };
                    });
                }

                // Re-calculate the global priority list to get updated step numbers and re-index priority
                const { globalPriorityList: reorderedGlobalPriorityList } = getGlobalPriorityList();

                if (!reorderedGlobalPriorityList.error) {
                    reorderedGlobalPriorityList.forEach((reorderedItem, reorderedIndex) => {
                        state.heroes[reorderedItem.heroName].equipment[reorderedItem.name].upgradePlan[reorderedItem.step].priorityIndex = reorderedIndex + 1;
                    });
                }
            });
            renderDraggableList();
            document.dispatchEvent(new CustomEvent('priorityListUpdated'));
        });

        const tooltipContainer = listItem.querySelector('.tooltip-container');
        if (tooltipContainer) {
            tooltipContainer.addEventListener('mouseenter', function () {
                const tooltip = this.querySelector('.priority-item-tooltip');
                const editor = document.getElementById('priority-list-editor');
                if (tooltip && editor) {
                    const rect = this.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    const editorRect = editor.getBoundingClientRect();

                    if (rect.top - tooltipRect.height < editorRect.top + 10) {
                        tooltip.classList.add('tooltip-bottom');
                    } else {
                        tooltip.classList.remove('tooltip-bottom');
                    }
                }
            });
        }

        editor.appendChild(listItem);

        effectiveLevels[equipName] = item.targetLevel;
    });
    renderSuggestionsAndErrors(globalPriorityList, suggestions);
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

export function autoPredictStoredOres() {
    // Placeholder function for complex prediction algorithm
    // Currently just predicts the last input amount (from state) as the current amount
    return {
        shiny: state.storedOres.shiny !== undefined ? state.storedOres.shiny : 0,
        glowy: state.storedOres.glowy !== undefined ? state.storedOres.glowy : 0,
        starry: state.storedOres.starry !== undefined ? state.storedOres.starry : 0
    };
}

export function openStoredOresModal() {
    const modal = document.getElementById('stored-ores-modal');
    if (!modal) return;

    // Prefill fields
    document.getElementById('modal-stored-ore-shiny').value = state.storedOres.shiny !== undefined ? state.storedOres.shiny : 0;
    document.getElementById('modal-stored-ore-glowy').value = state.storedOres.glowy !== undefined ? state.storedOres.glowy : 0;
    document.getElementById('modal-stored-ore-starry').value = state.storedOres.starry !== undefined ? state.storedOres.starry : 0;

    const dontAskCheckbox = document.getElementById('modal-stored-ore-dont-ask');
    if (dontAskCheckbox) dontAskCheckbox.checked = false;

    modal.classList.add('show');
}

export function initializeStoredOresModal() {
    const modal = document.getElementById('stored-ores-modal');
    if (!modal) return;

    const shinyInput = document.getElementById('modal-stored-ore-shiny');
    const glowyInput = document.getElementById('modal-stored-ore-glowy');
    const starryInput = document.getElementById('modal-stored-ore-starry');

    if (shinyInput) {
        addValidation(shinyInput, { inputName: 'modal-stored-ore-shiny' });
        registerInputPopover(shinyInput, {
            title: translate('ores.shiny'),
            min: 0,
            max: 50000,
            clickToFill: { max: true }
        });
    }
    if (glowyInput) {
        addValidation(glowyInput, { inputName: 'modal-stored-ore-glowy' });
        registerInputPopover(glowyInput, {
            title: translate('ores.glowy'),
            min: 0,
            max: 5000,
            clickToFill: { max: true }
        });
    }
    if (starryInput) {
        addValidation(starryInput, { inputName: 'modal-stored-ore-starry' });
        registerInputPopover(starryInput, {
            title: translate('ores.starry'),
            min: 0,
            max: 1000,
            clickToFill: { max: true }
        });
    }

    const closeBtn = document.getElementById('close-stored-ores-modal-btn');
    const cancelBtn = document.getElementById('cancel-stored-ores-modal-btn');
    const saveBtn = document.getElementById('save-stored-ores-modal-btn');

    const closeModal = () => {
        modal.classList.remove('show');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const shinyVal = parseInt(shinyInput.value, 10) || 0;
            const glowyVal = parseInt(glowyInput.value, 10) || 0;
            const starryVal = parseInt(starryInput.value, 10) || 0;

            const dontAskCheckbox = document.getElementById('modal-stored-ore-dont-ask');
            const dontAsk = dontAskCheckbox ? dontAskCheckbox.checked : false;

            handleStateUpdate(() => {
                state.storedOres.shiny = shinyVal;
                state.storedOres.glowy = glowyVal;
                state.storedOres.starry = starryVal;
                state.storedOres.lastUpdated = dontAsk ? (Date.now() + 60 * 24 * 60 * 60 * 1000) : Date.now();
            });

            // Keep tab storage inputs synced
            const shinyEqInput = document.getElementById('eq-shiny-ore-storage');
            const glowyEqInput = document.getElementById('eq-glowy-ore-storage');
            const starryEqInput = document.getElementById('eq-starry-ore-storage');

            if (shinyEqInput) {
                shinyEqInput.value = shinyVal;
                shinyEqInput.dataset.lastValidValue = shinyVal.toString();
            }
            if (glowyEqInput) {
                glowyEqInput.value = glowyVal;
                glowyEqInput.dataset.lastValidValue = glowyVal.toString();
            }
            if (starryEqInput) {
                starryEqInput.value = starryVal;
                starryEqInput.dataset.lastValidValue = starryVal.toString();
            }

            closeModal();
            renderPriorityEditor();
        });
    }
}

export function initializePriorityListModal() {
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
            suggestionsHidden = false;
            const { globalPriorityList, suggestions } = getGlobalPriorityList();
            renderSuggestionsAndErrors(globalPriorityList, suggestions);
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', async () => {
            const confirmed = await showConfirm(
                translate('planner.confirmResetList'),
                'status.confirm'
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

    const modalBody = document.getElementById('priority-list-modal-body');
    if (modalBody) {
        let draggedItem = null;

        // Mouse drag events
        modalBody.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('priority-list-editor-item')) {
                draggedItem = e.target;
                const tooltip = draggedItem.querySelector('.priority-item-tooltip');
                if (tooltip) tooltip.style.display = 'none';

                if (e.dataTransfer && typeof e.dataTransfer.setDragImage === 'function') {
                    const rect = draggedItem.getBoundingClientRect();
                    const offsetX = e.clientX - rect.left;
                    const offsetY = e.clientY - rect.top;
                    e.dataTransfer.setDragImage(draggedItem, offsetX, offsetY);
                }

                setTimeout(() => {
                    draggedItem.classList.add('dragging');
                }, 0);
            }
        });

        modalBody.addEventListener('dragend', (e) => {
            if (draggedItem) {
                const tooltip = draggedItem.querySelector('.priority-item-tooltip');
                if (tooltip) tooltip.style.display = '';
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

        // Touch events
        let isTouching = false;

        modalBody.addEventListener('touchstart', (e) => {
            if (e.target.closest('.drag-handle')) {
                draggedItem = e.target.closest('.priority-list-editor-item');
                if (draggedItem) {
                    isTouching = true;
                    draggedItem.classList.add('dragging');
                }
            }
        });

        modalBody.addEventListener('touchmove', (e) => {
            if (isTouching && draggedItem) {
                e.preventDefault();
                const editor = document.getElementById('priority-list-editor');
                const touch = e.touches[0];
                const afterElement = getDragAfterElement(editor, touch.clientY);

                if (afterElement == null) {
                    editor.appendChild(draggedItem);
                } else {
                    editor.insertBefore(draggedItem, afterElement);
                }
            }
        });

        modalBody.addEventListener('touchend', (e) => {
            if (isTouching && draggedItem) {
                draggedItem.classList.remove('dragging');

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
            isTouching = false;
            draggedItem = null;
        });
    }
}

export function openPriorityListModal() {
    const modal = document.getElementById('priority-list-modal');
    const title = document.getElementById('priority-list-modal-title');

    if (modal && title) {
        title.setAttribute('data-i18n', 'editPriorityList');
        title.textContent = translate('planner.editPriorityList');
        if (state.planner?.calendar?.isDirty !== false) {
            autoPlaceChipsForDateRange();
        }
        renderPriorityEditor();
        modal.classList.add('show');
    }
}

export function renderPriorityListModal(state) {
    const modal = document.getElementById('priority-list-modal');
    if (modal && modal.classList.contains('show')) {
        renderPriorityEditor();
    }
}