import { handleStateUpdate } from '../../core/stateManager.js';
import { state } from '../../core/state.js';

import { addValidation } from '../../utils/inputValidator.js';
import { autoPlaceIncomeChipsForRange } from '../../utils/autoPlaceChips.js';
import { calculateCompletionDates } from '../../utils/predictionCalculator.js';
import { formatDate } from '../../utils/dateFormatter.js';
import { formatNumber, updateCalculatedValue } from '../../utils/numberFormatter.js';
import { getMinDate, getMaxDate } from '../../utils/dateUtils.js';
import { getSVG } from '../../utils/svgManager.js';
import { heroData } from '../../data/heroData.js';
import { logger } from '../../utils/logger.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { translate } from '../../i18n/translator.js';
import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';

import { openLevelSelectModal } from './levelSelectModal.js';

import { showConfirm } from '../../ui/noticeModal.js';

function autoPlaceChipsForDateRange() {
    const startTime = new Date();

    const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
    const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();

    autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR);

    const endTime = new Date();
    const timeTaken = (endTime - startTime) / 1000;
    logger.log(`Finished auto-placing chips for all months in the range. Total time: ${timeTaken} seconds.`);
}

let cachedPriorityList = null;
let cachedSuggestions = null;
let cachedTimestamp = null;

export function getGlobalPriorityList() {
    if (cachedPriorityList && cachedTimestamp === state.timestamp) {
        return { globalPriorityList: cachedPriorityList, suggestions: cachedSuggestions };
    }

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
                    if (stepData.enabled && stepData.targetLevel > currentLevel) {
                        const heroDataKey = heroNameMap[heroKey];
                        if (!heroDataKey) continue;

                        globalPriorityList.push({
                            name: equipName,
                            image: heroData[heroDataKey].equipment.find(e => e.name === equipName)?.image,
                            targetLevel: stepData.targetLevel,
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

    cachedPriorityList = globalPriorityList;
    cachedSuggestions = suggestions;
    cachedTimestamp = state.timestamp;

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
            const maxLevel = getEquipmentMaxLevel(equip.type);

            if (currentLevel < maxLevel) {
                const chip = document.createElement('div');
                chip.classList.add('equipment-chip');
                chip.setAttribute('tabindex', '0');
                chip.setAttribute('role', 'button');
                chip.dataset.equipName = equip.name;
                chip.innerHTML = `
                    <orecalc-assets-image src="${equip.image}" alt="${translate('equipment.' + toCamelCase(equip.name))}" class="chip-icon" size="thumbnail"></orecalc-assets-image>
                    <span>${translate('equipment.' + toCamelCase(equip.name))}</span>
                `;
                chip.addEventListener('click', () => openLevelSelectModal(hero, equip));
                chip.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        chip.click();
                    }
                });

                const isMaxedInPlan = globalPriorityList.some(item =>
                    item.heroName === hero.name &&
                    item.name === equip.name &&
                    item.targetLevel === maxLevel
                );
                if (isMaxedInPlan) {
                    chip.classList.add('maxed-in-plan');
                }

                const customMaxLevel = state.planner.customMaxLevel?.[equip.type] || getEquipmentMaxLevel(equip.type);
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
let previousValidPriorityOrder = null;
let wasErrorBeforeDrag = false;
let dragStartSnapshot = null;

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

    if (!hasError) {
        previousValidPriorityOrder = null;
    } else {
        const canUndo = previousValidPriorityOrder !== null && previousValidPriorityOrder.length > 0;
        const iconName = canUndo ? 'undo' : 'check';
        const buttonTextKey = canUndo ? 'actions.undo' : 'actions.fix';

        errorContainer.classList.add('error');
        errorContainer.innerHTML += `
            <div class="error-messages-wrapper">
                <p class="error-message">
                    ${getSVG('error', 'error-icon', 20, 20, 'currentColor')}
                    <span>${translate('planner.orderError')}</span>
                </p>
            </div>
            <button id="fix-order-btn" class="fix-order-btn success-btn">
                ${getSVG(iconName, '', 18, 18, 'currentColor')}
                <span>${translate(buttonTextKey)}</span>
            </button>
        `;

        const fixBtn = document.getElementById('fix-order-btn');
        if (fixBtn) {
            fixBtn.addEventListener('click', () => {
                if (canUndo) {
                    handleStateUpdate(() => {
                        previousValidPriorityOrder.forEach((savedItem) => {
                            const plan = state.heroes[savedItem.heroName]?.equipment[savedItem.equipName]?.upgradePlan[savedItem.step];
                            if (plan) {
                                plan.priorityIndex = savedItem.priorityIndex;
                            }
                        });
                    });
                    previousValidPriorityOrder = null;
                } else {
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
                                    
                                    const planA = state.heroes[itemA.heroName].equipment[itemA.name].upgradePlan[itemA.step];
                                    const planB = state.heroes[itemB.heroName].equipment[itemB.name].upgradePlan[itemB.step];
                                    
                                    const tempIndex = planA.priorityIndex;
                                    planA.priorityIndex = planB.priorityIndex;
                                    planB.priorityIndex = tempIndex;
                                    
                                    return;
                                }
                            }
                        }
                    });
                    previousValidPriorityOrder = null;
                }
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

            errorContainer.classList.add('app-message-box', 'suggestion-only');
            suggestionsHtml += `<button class="hide-suggestion-btn app-message-box-btn" id="hide-suggestion-btn">${translate('actions.hide')}</button>`;

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

    const prevValues = {};
    const oldItems = editor.querySelectorAll('.priority-list-editor-item');
    oldItems.forEach(item => {
        const { heroName, equipName, step } = item.dataset;
        if (heroName && equipName && step) {
            const key = `${heroName}-${equipName}-${step}`;
            const shinySpan = item.querySelector('.shiny-val');
            const glowySpan = item.querySelector('.glowy-val');
            const starrySpan = item.querySelector('.starry-val');
            if (shinySpan && glowySpan && starrySpan) {
                prevValues[key] = {
                    shiny: parseInt(shinySpan.textContent.replace(/[^0-9]/g, ''), 10) || 0,
                    glowy: parseInt(glowySpan.textContent.replace(/[^0-9]/g, ''), 10) || 0,
                    starry: parseInt(starrySpan.textContent.replace(/[^0-9]/g, ''), 10) || 0
                };
            }
        }
    });

    editor.innerHTML = '';

    if (!globalPriorityList) {
        const { globalPriorityList: newList, suggestions: newSuggestions } = getGlobalPriorityList();
        globalPriorityList = newList;
        suggestions = newSuggestions;
    }

    const resetButton = document.getElementById('reset-priority-list-modal-btn');
    const infoButton = document.getElementById('priority-list-modal-info-btn');
    if (resetButton) {
        resetButton.style.display = globalPriorityList.length === 0 ? 'none' : 'flex';
    }
    if (infoButton) {
        infoButton.style.display = globalPriorityList.length === 0 ? 'flex' : 'none';
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

        const key = `${heroName}-${equipName}-${item.step}`;
        const prev = prevValues[key];

        let oresHtml = '';
        if (!item.error && !hasOrderError && item.oresPreCompletion && item.requiredOres && item.bottleneckOre) {
            const bottleneckTrans = translate('ores.' + item.bottleneckOre) || item.bottleneckOre;

            let reqHtml = `<span>${formatNumber(item.requiredOres.shiny)} <orecalc-assets-image src="assets/shiny_ore.png" class="ore-icon-small"></orecalc-assets-image></span>`;
            reqHtml += ` <span>${formatNumber(item.requiredOres.glowy)} <orecalc-assets-image src="assets/glowy_ore.png" class="ore-icon-small"></orecalc-assets-image></span>`;
            if (item.requiredOres.starry > 0 || state.heroes[heroName]?.equipment[equipName]?.type === 'epic') {
                reqHtml += ` <span>${formatNumber(item.requiredOres.starry)} <orecalc-assets-image src="assets/starry_ore.png" class="ore-icon-small"></orecalc-assets-image></span>`;
            }

            const initialShiny = prev ? prev.shiny : (item.oresPreCompletion.shiny || 0);
            const initialGlowy = prev ? prev.glowy : (item.oresPreCompletion.glowy || 0);
            const initialStarry = prev ? prev.starry : (item.oresPreCompletion.starry || 0);

            oresHtml = `
                <div class="priority-item-ores tooltip-container">
                    <span><span class="shiny-val">${formatNumber(initialShiny)}</span> <orecalc-assets-image src="assets/shiny_ore.png" class="ore-icon-small"></orecalc-assets-image></span>
                    <span><span class="glowy-val">${formatNumber(initialGlowy)}</span> <orecalc-assets-image src="assets/glowy_ore.png" class="ore-icon-small"></orecalc-assets-image></span>
                    <span><span class="starry-val">${formatNumber(initialStarry)}</span> <orecalc-assets-image src="assets/starry_ore.png" class="ore-icon-small"></orecalc-assets-image></span>
                    
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
        deleteBtn.addEventListener('click', () => {
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
                    remainingSteps.sort((a, b) => a.targetLevel - b.targetLevel);
                    equipmentInState.upgradePlan = {};
                    remainingSteps.forEach((step, idx) => {
                        const newStepKey = (idx + 1).toString();
                        equipmentInState.upgradePlan[newStepKey] = {
                            targetLevel: step.targetLevel,
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

        if (prev) {
            const shinyEl = listItem.querySelector('.shiny-val');
            const glowyEl = listItem.querySelector('.glowy-val');
            const starryEl = listItem.querySelector('.starry-val');
            
            const ores = item.oresPreCompletion || {};
            updateCalculatedValue(shinyEl, ores.shiny || 0);
            updateCalculatedValue(glowyEl, ores.glowy || 0);
            updateCalculatedValue(starryEl, ores.starry || 0);
        }

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

function animateShiftingElements(editor, action) {
    const children = Array.from(editor.querySelectorAll('.priority-list-editor-item'));
    
    // 1. Record starting positions
    const positions = children.map(child => {
        return {
            element: child,
            rect: child.getBoundingClientRect()
        };
    });
    
    // 2. Perform the DOM insertion
    action();
    
    // 3. Record new positions, calculate deltas, and apply instant inverse transform
    positions.forEach(pos => {
        const newRect = pos.element.getBoundingClientRect();
        const deltaY = pos.rect.top - newRect.top;
        const deltaX = pos.rect.left - newRect.left;
        
        if (deltaY !== 0 || deltaX !== 0) {
            // Cancel any ongoing shift timeout
            if (pos.element.__shiftTimeout) {
                clearTimeout(pos.element.__shiftTimeout);
            }
            
            // Disable transitions momentarily
            pos.element.style.transition = 'none';
            pos.element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            
            // Force a repaint
            pos.element.offsetHeight;
            
            // Enable transition and animate back to normal
            pos.element.style.transition = 'transform 0.25s cubic-bezier(0.2, 1, 0.2, 1)';
            pos.element.style.transform = 'translate(0px, 0px)';
            
            // Clean up inline styles after transition finishes
            pos.element.__shiftTimeout = setTimeout(() => {
                pos.element.style.transition = '';
                pos.element.style.transform = '';
                pos.element.__shiftTimeout = null;
            }, 250);
        }
    });
}

function updateDraggableListValues() {
    const editor = document.getElementById('priority-list-editor');
    if (!editor) return;

    const { globalPriorityList, suggestions } = getGlobalPriorityList();
    const { errorItems } = getStepOrderErrors(globalPriorityList);
    const equipmentsWithErrors = new Set();
    errorItems.forEach(itemKey => {
        const equipName = itemKey.split('-').slice(0, -1).join('-');
        equipmentsWithErrors.add(equipName);
    });

    const effectiveLevels = {};
    const domItems = editor.querySelectorAll('.priority-list-editor-item');

    globalPriorityList.forEach((item, index) => {
        const domItem = domItems[index];
        if (!domItem) return;

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

        // 1. Update completion date text
        const dateEl = domItem.querySelector('.priority-item-date');
        if (dateEl) dateEl.textContent = completionDateText;

        // 2. Update item name with start/target level range
        const nameEl = domItem.querySelector('.item-name');
        if (nameEl) {
            nameEl.textContent = translate('planner.stepLevelRange', { n: item.step, x: startLevel, y: item.targetLevel });
        }

        // 3. Animate accumulated ore values
        const shinyEl = domItem.querySelector('.shiny-val');
        const glowyEl = domItem.querySelector('.glowy-val');
        const starryEl = domItem.querySelector('.starry-val');

        if (item.oresPreCompletion) {
            updateCalculatedValue(shinyEl, item.oresPreCompletion.shiny || 0);
            updateCalculatedValue(glowyEl, item.oresPreCompletion.glowy || 0);
            updateCalculatedValue(starryEl, item.oresPreCompletion.starry || 0);
        }

        effectiveLevels[equipName] = item.targetLevel;
    });

    renderSuggestionsAndErrors(globalPriorityList, suggestions);
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

function isInterruptionRestricted() {
    const welcomeModal = document.getElementById('welcome-modal');
    if (welcomeModal && welcomeModal.classList.contains('show')) {
        return true;
    }
    const consentBanner = document.getElementById('consent-banner');
    if (consentBanner && consentBanner.classList.contains('show')) {
        return true;
    }
    const consentModal = document.getElementById('consent-modal');
    if (consentModal && consentModal.classList.contains('show')) {
        return true;
    }
    const tourTooltip = document.querySelector('.tour-tooltip');
    if (tourTooltip && tourTooltip.style.display !== 'none' && tourTooltip.style.opacity !== '0') {
        return true;
    }
    return false;
}

export function openStoredOresModal() {
    if (isInterruptionRestricted()) return;

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

export function closeStoredOresModal() {
    const modal = document.getElementById('stored-ores-modal');
    if (modal) modal.classList.remove('show');
}

export function initializeStoredOresModal() {
    const modal = document.getElementById('stored-ores-modal');
    if (!modal) return;

    // Observer to stamp lastUpdated when the modal is dismissed/hidden
    let isModalOpen = modal.classList.contains('show');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const isOpenNow = modal.classList.contains('show');
                if (isModalOpen && !isOpenNow) {
                    // Modal was dismissed (closed)
                    handleStateUpdate(() => {
                        if (!state.storedOres) state.storedOres = {};
                        const lastUpdated = state.storedOres.lastUpdated || 0;
                        // Only update if it's not already bumped into the future (e.g. dontAsk)
                        if (lastUpdated <= Date.now()) {
                            state.storedOres.lastUpdated = Date.now();
                        }
                    });
                }
                isModalOpen = isOpenNow;
            }
        });
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

    const shinyInput = document.getElementById('modal-stored-ore-shiny');
    const glowyInput = document.getElementById('modal-stored-ore-glowy');
    const starryInput = document.getElementById('modal-stored-ore-starry');

    if (shinyInput) {
        addValidation(shinyInput, { inputName: 'modal-stored-ore-shiny' });
        registerInputPopover(shinyInput, {
            title: () => translate('ores.shiny'),
            min: 0,
            max: 50000,
            clickToFill: { max: true }
        });
    }
    if (glowyInput) {
        addValidation(glowyInput, { inputName: 'modal-stored-ore-glowy' });
        registerInputPopover(glowyInput, {
            title: () => translate('ores.glowy'),
            min: 0,
            max: 5000,
            clickToFill: { max: true }
        });
    }
    if (starryInput) {
        addValidation(starryInput, { inputName: 'modal-stored-ore-starry' });
        registerInputPopover(starryInput, {
            title: () => translate('ores.starry'),
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

    if (modal) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class' && !modal.classList.contains('show')) {
                    if (previousValidPriorityOrder !== null && previousValidPriorityOrder.length > 0) {
                        handleStateUpdate(() => {
                            previousValidPriorityOrder.forEach((savedItem) => {
                                const plan = state.heroes[savedItem.heroName]?.equipment[savedItem.equipName]?.upgradePlan[savedItem.step];
                                if (plan) {
                                    plan.priorityIndex = savedItem.priorityIndex;
                                }
                            });
                        });
                        previousValidPriorityOrder = null;
                    }
                }
            });
        });
        observer.observe(modal, { attributes: true });
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
        let activePriorityDragItem = null;
        let activePriorityDragIndex = -1;
        let currentPriorityDropIndex = -1;
        let priorityOriginalList = [];
        let priorityInitialRects = [];
        let priorityDragImage = null;
        let priorityTouchId = null;
        let priorityDragPointerOffsetY = 0;
        let autoScrollFrame = null;
        let lastPointerClientY = 0;
        let initialScrollTop = 0;

        function stopAutoScroll() {
            if (autoScrollFrame) {
                cancelAnimationFrame(autoScrollFrame);
                autoScrollFrame = null;
            }
        }

        function checkAndAutoScroll(clientY) {
            lastPointerClientY = clientY;
            const editor = document.getElementById('priority-list-editor');
            if (!editor || !activePriorityDragItem) {
                stopAutoScroll();
                return;
            }

            const editorRect = editor.getBoundingClientRect();
            const threshold = 65;
            const topEdge = editorRect.top;
            const bottomEdge = editorRect.bottom;

            let speed = 0;
            if (clientY < topEdge + threshold) {
                const diff = (topEdge + threshold) - clientY;
                speed = -Math.min(22, Math.max(3, diff * 0.4));
            } else if (clientY > bottomEdge - threshold) {
                const diff = clientY - (bottomEdge - threshold);
                speed = Math.min(22, Math.max(3, diff * 0.4));
            }

            if (speed !== 0) {
                if (!autoScrollFrame) {
                    const scrollLoop = () => {
                        if (!activePriorityDragItem) {
                            stopAutoScroll();
                            return;
                        }
                        const curEditor = document.getElementById('priority-list-editor');
                        if (!curEditor) {
                            stopAutoScroll();
                            return;
                        }

                        const curRect = curEditor.getBoundingClientRect();
                        let curSpeed = 0;
                        if (lastPointerClientY < curRect.top + threshold) {
                            const diff = (curRect.top + threshold) - lastPointerClientY;
                            curSpeed = -Math.min(22, Math.max(3, diff * 0.4));
                        } else if (lastPointerClientY > curRect.bottom - threshold) {
                            const diff = lastPointerClientY - (curRect.bottom - threshold);
                            curSpeed = Math.min(22, Math.max(3, diff * 0.4));
                        }

                        if (curSpeed !== 0) {
                            curEditor.scrollTop += curSpeed;
                            updatePriorityGPUTransforms(lastPointerClientY);
                            autoScrollFrame = requestAnimationFrame(scrollLoop);
                        } else {
                            stopAutoScroll();
                        }
                    };
                    autoScrollFrame = requestAnimationFrame(scrollLoop);
                }
            } else {
                stopAutoScroll();
            }
        }

        function startPriorityDrag(item, clientX, clientY) {
            const editor = document.getElementById('priority-list-editor');
            if (!editor) return;

            const { globalPriorityList: currentList } = getGlobalPriorityList();
            wasErrorBeforeDrag = getStepOrderErrors(currentList).hasError;
            dragStartSnapshot = currentList.map(i => ({
                heroName: i.heroName,
                equipName: i.name,
                step: i.step,
                priorityIndex: i.priorityIndex
            }));

            initialScrollTop = editor.scrollTop;
            priorityOriginalList = Array.from(editor.querySelectorAll('.priority-list-editor-item'));
            activePriorityDragIndex = priorityOriginalList.indexOf(item);
            if (activePriorityDragIndex === -1) return;

            activePriorityDragItem = item;
            currentPriorityDropIndex = activePriorityDragIndex;

            priorityInitialRects = priorityOriginalList.map(el => el.getBoundingClientRect());

            const itemRect = priorityInitialRects[activePriorityDragIndex];
            priorityDragPointerOffsetY = clientY - itemRect.top;

            // Create floating GPU-accelerated clone
            priorityDragImage = item.cloneNode(true);
            const tooltip = priorityDragImage.querySelector('.priority-item-tooltip');
            if (tooltip) tooltip.remove();

            priorityDragImage.classList.add('dragging-clone');
            priorityDragImage.style.position = 'fixed';
            priorityDragImage.style.pointerEvents = 'none';
            priorityDragImage.style.zIndex = '99999';
            priorityDragImage.style.width = `${itemRect.width}px`;
            priorityDragImage.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.35)';
            priorityDragImage.style.transform = 'scale(1.02)';
            priorityDragImage.style.transition = 'transform 0.1s ease, box-shadow 0.1s ease';
            priorityDragImage.style.left = `${itemRect.left}px`;
            priorityDragImage.style.top = `${clientY - priorityDragPointerOffsetY}px`;
            document.body.appendChild(priorityDragImage);

            // Render horizontal dotted line at static editor scope (positioned at exact seam midpoint)
            const sourceLine = document.createElement('div');
            sourceLine.className = 'drag-source-line';
            sourceLine.style.opacity = '0';
            editor.appendChild(sourceLine);

            item.classList.add('dragging');
        }

        function updatePriorityGPUTransforms(clientY) {
            if (!activePriorityDragItem || activePriorityDragIndex === -1 || priorityOriginalList.length === 0) return;

            checkAndAutoScroll(clientY);

            if (priorityDragImage) {
                priorityDragImage.style.top = `${clientY - priorityDragPointerOffsetY}px`;
            }

            const editor = document.getElementById('priority-list-editor');
            if (!editor) return;

            const scrollDelta = editor.scrollTop - initialScrollTop;

            // Calculate real-time target slot index using scrollDelta-adjusted midpoints
            let targetIndex = 0;
            for (let i = 0; i < priorityOriginalList.length; i++) {
                const rect = priorityInitialRects[i];
                const realtimeMidY = (rect.top - scrollDelta) + (rect.height / 2);
                if (clientY > realtimeMidY) {
                    targetIndex = i;
                }
            }

            currentPriorityDropIndex = targetIndex;

            const src = activePriorityDragIndex;
            const dst = currentPriorityDropIndex;

            // Measure outer height (bounding height + margins) for each original item
            const itemOuterHeights = priorityOriginalList.map((el, i) => {
                const rect = priorityInitialRects[i];
                const style = window.getComputedStyle(el);
                const marginTop = parseFloat(style.marginTop) || 5;
                const marginBottom = parseFloat(style.marginBottom) || 5;
                return rect.height + marginTop + marginBottom;
            });

            // Construct the virtual sequence of item indices [0...N-1] with src moved to dst
            const virtualOrder = priorityOriginalList.map((_, i) => i);
            virtualOrder.splice(src, 1);
            virtualOrder.splice(dst, 0, src);

            // Compute exact target Y positions for every item in the virtual layout sequence
            let currentY = priorityInitialRects[0].top;
            const desiredTopMap = new Map();
            for (let k = 0; k < virtualOrder.length; k++) {
                const itemIndex = virtualOrder[k];
                desiredTopMap.set(itemIndex, currentY);
                currentY += itemOuterHeights[itemIndex];
            }

            // Apply precise shift to each item so slot openings match dragged item height 100%
            const shiftMap = new Map();
            priorityOriginalList.forEach((el, index) => {
                const initialTop = priorityInitialRects[index].top;
                const desiredTop = desiredTopMap.get(index);
                const shiftY = desiredTop - initialTop;
                shiftMap.set(index, shiftY);

                el.style.transition = 'transform 0.2s cubic-bezier(0.2, 1, 0.2, 1)';
                el.style.transform = `translate3d(0, ${shiftY}px, 0)`;
            });

            // Calculate exact geometric midpoint between surrounding cards at the vacated origin slot
            const sourceLine = editor.querySelector('.drag-source-line');
            const editorRect = editor.getBoundingClientRect();
            if (sourceLine) {
                if (dst === src) {
                    sourceLine.style.opacity = '0';
                } else {
                    sourceLine.style.opacity = '0.85';

                    let seamContentTop = 0;
                    const cardAboveIndex = src > 0 ? src - 1 : null;
                    const cardBelowIndex = src < priorityOriginalList.length - 1 ? src + 1 : null;

                    if (cardAboveIndex !== null && cardBelowIndex !== null) {
                        const rectAbove = priorityInitialRects[cardAboveIndex];
                        const shiftAbove = shiftMap.get(cardAboveIndex) || 0;
                        const contentBottomAbove = (rectAbove.bottom - editorRect.top + initialScrollTop) + shiftAbove;

                        const rectBelow = priorityInitialRects[cardBelowIndex];
                        const shiftBelow = shiftMap.get(cardBelowIndex) || 0;
                        const contentTopBelow = (rectBelow.top - editorRect.top + initialScrollTop) + shiftBelow;

                        seamContentTop = (contentBottomAbove + contentTopBelow) / 2;
                    } else if (cardBelowIndex !== null) {
                        const rectBelow = priorityInitialRects[cardBelowIndex];
                        const shiftBelow = shiftMap.get(cardBelowIndex) || 0;
                        const contentTopBelow = (rectBelow.top - editorRect.top + initialScrollTop) + shiftBelow;
                        seamContentTop = contentTopBelow - 5;
                    } else if (cardAboveIndex !== null) {
                        const rectAbove = priorityInitialRects[cardAboveIndex];
                        const shiftAbove = shiftMap.get(cardAboveIndex) || 0;
                        const contentBottomAbove = (rectAbove.bottom - editorRect.top + initialScrollTop) + shiftAbove;
                        seamContentTop = contentBottomAbove + 5;
                    }

                    sourceLine.style.top = `${seamContentTop}px`;
                }
            }
        }

        function commitPriorityDrop() {
            stopAutoScroll();
            if (!activePriorityDragItem || activePriorityDragIndex === -1) return;

            const editor = document.getElementById('priority-list-editor');

            if (editor) {
                const sourceLines = editor.querySelectorAll('.drag-source-line');
                sourceLines.forEach(line => line.remove());
            }

            if (priorityDragImage && document.body.contains(priorityDragImage)) {
                document.body.removeChild(priorityDragImage);
            }
            priorityDragImage = null;

            priorityOriginalList.forEach(el => {
                el.style.transition = 'none';
                el.style.transform = '';
                el.classList.remove('dragging');
            });

            if (editor && currentPriorityDropIndex !== activePriorityDragIndex) {
                const targetElement = priorityOriginalList[currentPriorityDropIndex];
                if (currentPriorityDropIndex > activePriorityDragIndex) {
                    editor.insertBefore(activePriorityDragItem, targetElement.nextSibling);
                } else {
                    editor.insertBefore(activePriorityDragItem, targetElement);
                }

                const newOrderedItems = [...editor.querySelectorAll('.priority-list-editor-item')];
                window.__IS_REORDERING__ = true;
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
                window.__IS_REORDERING__ = false;

                const { globalPriorityList: updatedList } = getGlobalPriorityList();
                const hasErrorAfter = getStepOrderErrors(updatedList).hasError;

                if (!wasErrorBeforeDrag && hasErrorAfter) {
                    previousValidPriorityOrder = dragStartSnapshot;
                } else {
                    previousValidPriorityOrder = null;
                }

                updateDraggableListValues();
            }

            activePriorityDragItem = null;
            activePriorityDragIndex = -1;
            currentPriorityDropIndex = -1;
            priorityOriginalList = [];
            priorityInitialRects = [];
            priorityTouchId = null;
        }

        // Prevent native HTML5 drag interference
        modalBody.addEventListener('dragstart', (e) => e.preventDefault());

        const HOLD_DELAY = 220;
        const MOVE_THRESHOLD = 8;

        function setupPriorityHoldToDrag(e, item) {
            const touchOrPointer = (e.type === 'touchstart') ? e.touches[0] : e;
            const touchId = (e.type === 'touchstart') ? e.touches[0].identifier : null;
            const startX = touchOrPointer.clientX;
            const startY = touchOrPointer.clientY;
            let priorityHoldTimer = null;

            const cancelHold = () => {
                if (priorityHoldTimer) {
                    clearTimeout(priorityHoldTimer);
                    priorityHoldTimer = null;
                }
                window.removeEventListener('touchmove', onPointerMove, { passive: false });
                window.removeEventListener('mousemove', onPointerMove);
                window.removeEventListener('touchend', onPointerUp, { passive: false });
                window.removeEventListener('mouseup', onPointerUp);
                window.removeEventListener('touchcancel', onPointerUp, { passive: false });
            };

            const onPointerMove = (moveEv) => {
                const pt = (moveEv.type === 'touchmove')
                    ? Array.from(moveEv.touches).find(t => t.identifier === touchId) || moveEv.touches[0]
                    : moveEv;
                if (pt) {
                    const dist = Math.hypot(pt.clientX - startX, pt.clientY - startY);
                    if (dist > MOVE_THRESHOLD) {
                        cancelHold();
                    }
                }
            };

            const onPointerUp = () => {
                cancelHold();
            };

            priorityHoldTimer = setTimeout(() => {
                cancelHold();
                if (navigator.vibrate) {
                    try { navigator.vibrate(20); } catch (_) {}
                }
                priorityTouchId = touchId;
                startPriorityDrag(item, touchOrPointer.clientX, touchOrPointer.clientY);
            }, HOLD_DELAY);

            if (e.type === 'touchstart') {
                if (e.cancelable) e.preventDefault();
                window.addEventListener('touchmove', onPointerMove, { passive: false });
                window.addEventListener('touchend', onPointerUp, { passive: false });
                window.addEventListener('touchcancel', onPointerUp, { passive: false });
            } else {
                window.addEventListener('mousemove', onPointerMove);
                window.addEventListener('mouseup', onPointerUp);
            }
        }

        // Touch Drag Handlers
        modalBody.addEventListener('touchstart', (e) => {
            const handle = e.target.closest('.drag-handle');
            if (handle) {
                const item = handle.closest('.priority-list-editor-item');
                if (item && !item.classList.contains('disabled-dragging')) {
                    setupPriorityHoldToDrag(e, item);
                }
            }
        }, { passive: false });

        modalBody.addEventListener('touchmove', (e) => {
            if (activePriorityDragItem && priorityTouchId !== null) {
                let touch = null;
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === priorityTouchId) {
                        touch = e.touches[i];
                        break;
                    }
                }
                if (touch) {
                    if (e.cancelable) e.preventDefault();
                    updatePriorityGPUTransforms(touch.clientY);
                }
            }
        }, { passive: false });

        modalBody.addEventListener('touchend', () => {
            if (activePriorityDragItem) {
                commitPriorityDrop();
            }
        });

        modalBody.addEventListener('touchcancel', () => {
            if (activePriorityDragItem) {
                commitPriorityDrop();
            }
        });

        // Mouse Drag Handlers
        modalBody.addEventListener('mousedown', (e) => {
            const handle = e.target.closest('.drag-handle');
            if (handle && e.button === 0) {
                const item = handle.closest('.priority-list-editor-item');
                if (item && !item.classList.contains('disabled-dragging')) {
                    setupPriorityHoldToDrag(e, item);

                    const onMouseMove = (moveEv) => {
                        updatePriorityGPUTransforms(moveEv.clientY);
                    };

                    const onMouseUp = () => {
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                        commitPriorityDrop();
                    };

                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                }
            }
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
    if (window.__IS_REORDERING__) return;
    const modal = document.getElementById('priority-list-modal');
    if (modal && modal.classList.contains('show')) {
        renderPriorityEditor();
    }
}