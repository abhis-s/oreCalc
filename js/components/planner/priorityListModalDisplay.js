import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { hideCardHelpPopover, showCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { formatDate } from '../../utils/dateUtils.js';
import { formatNumber, updateCalculatedValue } from '../../utils/numberFormatter.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';

import {
    initializePriorityEditorShell,
    renderHeroEquipmentGrid
} from './priorityListGridRenderer.js';
import { getGlobalPriorityList, getStepOrderErrors } from './priorityListScheduler.js';
import {
    getPreviousValidPriorityOrder,
    getSuggestionsHidden,
    renderSuggestionsAndErrors,
    setPreviousValidPriorityOrder,
    setSuggestionsHidden
} from './priorityListSuggestionsRenderer.js';

/**
 * Attaches help and stored ore popovers to a priority list item.
 * @param {HTMLElement} oresEl
 * @param {Object} item
 * @param {string|number} startLevel
 * @param {string} heroName
 * @param {string} equipName
 */
function attachPriorityOresPopover(oresEl, item, startLevel, heroName, equipName) {
    const bottleneckTrans = translate('entities.ores.' + item.bottleneckOre);
    const equipCamel = toCamelCase(item.name || '');
    const equipmentName = translate('entities.equipment.' + equipCamel);

    const popoverContent = {
        header: `
            <orecalc-assets-image src="${item.image}" alt="${equipmentName}" class="popover-img" size="thumbnail"></orecalc-assets-image>
            <div class="popover-title-group">
                <span class="popover-title">${equipmentName} (${startLevel} &rarr; ${item.targetLevel})</span>
                <span class="popover-badge">${translate('views.income.ores.bottleneckLabel')}: <span class="ore-text-${item.bottleneckOre}">${bottleneckTrans}</span></span>
            </div>
        `,
        body: `
            <p>${translate('views.income.ores.tooltipReached')}</p>
            <p>${translate('views.income.prospector.tooltipConsider')}</p>
            <div class="popover-chest-breakdown popover-ores-breakdown">
                <div class="popover-range-label">${translate('views.income.ores.tooltipRequired')}</div>
                <div class="popover-chest-ranges-row popover-ores-ranges-row">
                    <div class="chest-ore-inline-chip popover-ore-inline-chip">
                        <span><strong>${formatNumber(item.requiredOres.shiny)}</strong></span>
                        <orecalc-assets-image src="assets/shiny_ore.png" alt="${translate('entities.ores.shiny')}" class="ore-mini-icon"></orecalc-assets-image>
                    </div>
                    <div class="chest-ore-inline-chip popover-ore-inline-chip">
                        <span><strong>${formatNumber(item.requiredOres.glowy)}</strong></span>
                        <orecalc-assets-image src="assets/glowy_ore.png" alt="${translate('entities.ores.glowy')}" class="ore-mini-icon"></orecalc-assets-image>
                    </div>
                    ${(item.requiredOres.starry > 0 || state.heroes[heroName]?.equipment[equipName]?.type === 'epic') ? `
                    <div class="chest-ore-inline-chip popover-ore-inline-chip">
                        <span><strong>${formatNumber(item.requiredOres.starry)}</strong></span>
                        <orecalc-assets-image src="assets/starry_ore.png" alt="${translate('entities.ores.starry')}" class="ore-mini-icon"></orecalc-assets-image>
                    </div>` : ''}
                </div>
            </div>
        `
    };

    const triggerShow = () => {
        showCardHelpPopover(oresEl, popoverContent, { isToggle: true });
    };

    oresEl.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerShow();
    });

    oresEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            triggerShow();
        }
    });

    oresEl.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'touch') return;
        showCardHelpPopover(oresEl, popoverContent);
    });
    oresEl.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'touch') return;
        hideCardHelpPopover();
    });
}

/**
 * Attaches card details popover to priority item.
 * @param {HTMLElement} itemEl
 * @param {string} heroName
 * @param {string} equipName
 * @param {number} targetLevel
 */
function attachCardHelpPopover(itemEl, heroName, equipName, targetLevel) {
    const handlePointerEnter = (e) => {
        if (e.pointerType === 'touch') return;
        showCardHelpPopover(itemEl, {
            heroName,
            equipName,
            targetLevel
        });
    };

    itemEl.addEventListener('pointerenter', handlePointerEnter);
    itemEl.addEventListener('pointerleave', (e) => {
        if (e.pointerType === 'touch') return;
        hideCardHelpPopover();
    });
}

/**
 * Renders draggable priority cards into the editor container.
 * @param {Array<any>} [globalPriorityList]
 * @param {Array<any>|null} [suggestions]
 */
export function renderDraggableList(globalPriorityList, suggestions) {
    const editor = document.getElementById('priority-list-editor');
    if (!editor) return;

    const prevValues = {};
    const oldItems = editor.querySelectorAll('.priority-list-editor-item');
    oldItems.forEach(item => {
        const htmlItem = /** @type {HTMLElement} */ (item);
        const { heroName, equipName, step } = htmlItem.dataset;
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

    const resetButton = /** @type {HTMLElement|null} */ (document.getElementById('reset-priority-list-modal-btn'));
    const infoButton = /** @type {HTMLElement|null} */ (document.getElementById('priority-list-modal-info-btn'));
    if (resetButton) {
        resetButton.style.display = globalPriorityList.length === 0 ? 'none' : 'flex';
    }
    if (infoButton) {
        infoButton.style.display = globalPriorityList.length === 0 ? 'flex' : 'none';
    }

    if (globalPriorityList.length === 0) {
        editor.innerHTML = `<p class="placeholder-text" data-i18n="views.planner.priorityPlaceholder">${translate('views.planner.priorityPlaceholder')}</p>`;
        renderSuggestionsAndErrors([], [], renderDraggableList);
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
            completionDateText = `${translate('views.planner.completeByColon')} ${formatDate(item.completionDate, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            completionDateText = translate('views.planner.notEnoughIncome');
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

        listItem.setAttribute('draggable', 'false');
        listItem.dataset.draggable = isDraggingAllowed ? 'true' : 'false';
        listItem.dataset.index = String(index);

        listItem.dataset.heroName = heroName;
        listItem.dataset.equipName = equipName;
        listItem.dataset.step = item.step;

        const key = `${heroName}-${equipName}-${item.step}`;
        const prev = prevValues[key];

        let oresHtml = '';
        if (!item.error && !hasOrderError && item.oresPreCompletion && item.requiredOres && item.bottleneckOre) {
            const initialShiny = prev ? prev.shiny : (item.oresPreCompletion.shiny || 0);
            const initialGlowy = prev ? prev.glowy : (item.oresPreCompletion.glowy || 0);
            const initialStarry = prev ? prev.starry : (item.oresPreCompletion.starry || 0);

            oresHtml = `
                <div class="priority-item-ores" role="button" tabindex="0" aria-label="${translate('views.income.ores.storedTitle')}">
                    <span><span class="shiny-val">${formatNumber(initialShiny)}</span> <orecalc-assets-image src="assets/shiny_ore.png" class="ore-icon-small"></orecalc-assets-image></span>
                    <span><span class="glowy-val">${formatNumber(initialGlowy)}</span> <orecalc-assets-image src="assets/glowy_ore.png" class="ore-icon-small"></orecalc-assets-image></span>
                    <span><span class="starry-val">${formatNumber(initialStarry)}</span> <orecalc-assets-image src="assets/starry_ore.png" class="ore-icon-small"></orecalc-assets-image></span>
                </div>
            `;
        }

        listItem.innerHTML = `
            <div class="drag-handle">${getSVG('drag-handle', '', 24, 24, 'currentColor')}</div>
            <orecalc-assets-image src="${item.image}" alt="${translate('entities.equipment.' + toCamelCase(item.name))}" class="item-image" size="thumbnail"></orecalc-assets-image>
            <div class="item-details">
                <span class="item-name">${translate('views.planner.stepLevelRange', { n: item.step, x: startLevel, y: item.targetLevel })}</span>
                ${oresHtml}
                <div class="priority-item-date">${completionDateText}</div>
            </div>
            <button class="delete-item-btn">${getSVG('close', '', 24, 24, 'currentColor')}</button>
        `;

        const oresEl = /** @type {HTMLElement|null} */ (listItem.querySelector('.priority-item-ores'));
        if (oresEl && !item.error && !hasOrderError && item.oresPreCompletion && item.requiredOres && item.bottleneckOre) {
            attachPriorityOresPopover(oresEl, item, startLevel, heroName, equipName);
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

    renderSuggestionsAndErrors(globalPriorityList, suggestions, renderDraggableList);
}

/**
 * Updates priority item values in place without rebuilding the DOM.
 */
export function updateDraggableListValues() {
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
            completionDateText = `${translate('views.planner.completeByColon')} ${formatDate(item.completionDate, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            completionDateText = translate('views.planner.notEnoughIncome');
        }

        const dateEl = domItem.querySelector('.priority-item-date');
        if (dateEl) dateEl.textContent = completionDateText;

        const nameEl = domItem.querySelector('.item-name');
        if (nameEl) {
            nameEl.textContent = translate('views.planner.stepLevelRange', { n: item.step, x: startLevel, y: item.targetLevel });
        }

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

    renderSuggestionsAndErrors(globalPriorityList, suggestions, renderDraggableList);
}

/**
 * Full render for priority editor container, hero equipment grid, and draggable list.
 */
export function renderPriorityEditor() {
    const modalBody = document.getElementById('priority-list-modal-body');
    if (!modalBody) return;

    const { gridContainer } = initializePriorityEditorShell(modalBody);
    const { globalPriorityList, suggestions } = getGlobalPriorityList();

    if (gridContainer) {
        renderHeroEquipmentGrid(gridContainer, globalPriorityList);
    }

    renderDraggableList(globalPriorityList, suggestions);
}
