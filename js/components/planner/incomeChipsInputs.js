import { incomeData } from '../../data/incomeSourceRegistry.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { syncAutoPlacedChipsForMonth } from '../../utils/autoPlaceChips.js';
import { reindexCalendarChips } from '../../utils/chipManager.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';

import { renderCalendar } from './calendarDisplay.js';
import { openCreateCustomChipsModal } from './createCustomChipsModalDisplay.js';
import { initializeCreateCustomChipsModalListeners } from './createCustomChipsModalInputs.js';
import { packIncomeChips, packLegendItems, renderIncomeChips } from './incomeChipsDisplay.js';
import { getPlannerDOMElements } from '../../dom/plannerDom.js';

let isInitialized = false;

/**
 * Handles HTML5 dragover events over the unplaced income chips container.
 * @param {DragEvent} e - Native dragover event object.
 */
export function handleDragOverForChipContainer(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('valid-drop-target');
}

/**
 * Handles HTML5 dragleave events over the unplaced income chips container to remove highlight.
 * @param {DragEvent} e - Native dragleave event object.
 */
export function handleDragLeaveForChipContainer(e) {
    e.currentTarget.classList.remove('valid-drop-target');
}

/**
 * Handles HTML5 drop events onto the unplaced income chips container to return placed chips back to tray.
 * @param {DragEvent} e - Native drop event object.
 */
export function handleDropToChipContainer(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('valid-drop-target');
    if (!e.dataTransfer) return;

    const raw = e.dataTransfer.getData('text/plain');
    const incomeChipData = safeJsonParse(raw, null);
    if (incomeChipData && incomeChipData.id) {
        handleChipDropOnContainer(incomeChipData);
    }
}

/**
 * Handles removing a chip from calendar day cells back into unplaced chips container.
 * @param {Object} incomeChipData
 */
export function handleChipDropOnContainer(incomeChipData) {
    const autoSourceIds = new Set();
    const findAutoSources = (source, id) => {
        if (source.autoGenerateInCalendar) {
            autoSourceIds.add(id);
        }
        if (source.subCategories) {
            source.subCategories.forEach(sub => findAutoSources(sub, sub.id));
        }
    };
    for (const key in incomeData) {
        findAutoSources(incomeData[key], key);
    }

    handleStateUpdate(() => {
        for (const monthYearKey in state.planner.calendar.dates) {
            const days = state.planner.calendar.dates[monthYearKey];
            for (const dayKey in days) {
                const chipIds = days[dayKey];
                const originalId = incomeChipData.id.split('-cal')[0];

                if (autoSourceIds.has(originalId)) {
                    continue;
                }
                const indexToRemove = chipIds.findIndex(id => id.split('-cal')[0] === originalId);
                if (indexToRemove > -1) {
                    const removedChipId = chipIds.splice(indexToRemove, 1)[0];
                    if (chipIds.length === 0) {
                        delete days[dayKey];
                    }
                    if (Object.keys(days).length === 0) {
                        delete state.planner.calendar.dates[monthYearKey];
                    }

                    // If it was a custom chip, put it back in customChips list
                    if (removedChipId.startsWith('custom-')) {
                        const customData = state.planner.calendar.customChipData?.[removedChipId] || {};
                        const [, , timestamp, index] = removedChipId.split('-');
                        const customChipData = {
                            id: removedChipId.split('-cal')[0],
                            type: incomeChipData.type,
                            isCustom: true,
                            customType: customData.customType || incomeChipData.customType || '',
                            instance: parseInt(index, 10) + 1,
                            shiny: customData.shiny || parseInt(incomeChipData.shiny, 10) || 0,
                            glowy: customData.glowy || parseInt(incomeChipData.glowy, 10) || 0,
                            starry: customData.starry || parseInt(incomeChipData.starry, 10) || 0,
                            multiplier: customData.multiplier,
                            result: customData.result
                        };
                        if (!state.planner.calendar.customChips) state.planner.calendar.customChips = [];
                        state.planner.calendar.customChips.push(customChipData);
                        if (state.planner.calendar.customChipData) delete state.planner.calendar.customChipData[removedChipId];
                    }
                }
            }
        }
        if (state.planner?.calendar?.view?.month) {
            const [viewYear, viewMonth] = state.planner.calendar.view.month.split('-');
            syncAutoPlacedChipsForMonth(viewMonth, viewYear);
        }
    });

    reindexCalendarChips(incomeChipData.type);

    setTimeout(() => {
        renderCalendar(state.planner);
        if (state.planner?.calendar?.view?.month) {
            renderIncomeChips(parseInt(state.planner.calendar.view.month.split('-')[0], 10), parseInt(state.planner.calendar.view.month.split('-')[1], 10) - 1);
        }
    }, 0);
}

/**
 * Initializes income chips container event listeners and ResizeObserver layout triggers.
 */
export function initializeIncomeChipsEventListeners() {
    if (isInitialized) return;
    isInitialized = true;

    const plannerDOMElements = getPlannerDOMElements();
    const incomeChipsContainer = plannerDOMElements.incomeChipsContainer;

    if (!incomeChipsContainer) {
        console.error('Income chips container not found.');
        return;
    }

    incomeChipsContainer.addEventListener('dragover', handleDragOverForChipContainer);
    incomeChipsContainer.addEventListener('dragleave', handleDragLeaveForChipContainer);
    incomeChipsContainer.addEventListener('drop', handleDropToChipContainer);

    // Event delegation for custom chips button click
    document.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const btn = target.closest('.create-custom-chips-btn');
        if (btn) {
            openCreateCustomChipsModal();
        }
    });

    // Wire up modal events
    initializeCreateCustomChipsModalListeners();

    // Use ResizeObserver for layout packing
    const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            if (entry.contentRect.width > 0) {
                if (entry.target === incomeChipsContainer) {
                    requestAnimationFrame(packIncomeChips);
                } else if (entry.target === document.getElementById('income-chips-legend')) {
                    requestAnimationFrame(packLegendItems);
                }
            }
        }
    });
    resizeObserver.observe(incomeChipsContainer);
    const legendEl = document.getElementById('income-chips-legend');
    if (legendEl) {
        resizeObserver.observe(legendEl);
    }
}

document.addEventListener('chipDropOnContainer', (e) => {
    const customEv = /** @type {CustomEvent} */ (e);
    const { incomeChipData } = customEv.detail || {};
    if (incomeChipData) {
        handleChipDropOnContainer(incomeChipData);
    }
});

document.addEventListener('calendarChipsPlaced', (e) => {
    const customEv = /** @type {CustomEvent} */ (e);
    const { year, month } = customEv.detail || {};
    if (year !== undefined && month !== undefined) {
        renderIncomeChips(year, month);
    }
});
