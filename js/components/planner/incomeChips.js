import { getPlannerDOMElements } from '../../dom/plannerDom.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import { state } from '../../core/state.js';

import { addValidation } from '../../utils/inputValidator.js';
import { createIncomeChip, renderIncomeChipsLegend, createOverflowChip } from '../../utils/chipFactory.js';
import { getDaysInMonth, getWeeklyOccurrences, getMonthlyOccurrences, getBimonthlyOccurrences } from '../../utils/dateUtils.js';
import { incomeData, getSourceById } from '../../data/incomeSourceRegistry.js';
import { reindexCalendarChips } from '../../utils/chipManager.js';
import { translate } from '../../i18n/translator.js';

import { openCreateCustomChipsModal, initializeCreateCustomChipsModalListeners } from './createCustomChipsModal.js';

import { renderCalendar } from '../planner/calendar.js';
import { showAlert } from '../../ui/noticeModal.js';

function calculateIncomeChips(year, month) {
    const daysInCurrentMonth = getDaysInMonth(year, month);
    const groupedChips = {};

    const processSource = (incomeSource, sourceId) => {
        // Skip default daily/auto sources from appearing as DRAGGABLE chips
        if (incomeSource.autoGenerateInCalendar) {
            // But we still want to process their subcategories if they have any
            if (incomeSource.subCategories) {
                incomeSource.subCategories.forEach(sub => processSource(sub, sub.id));
            }
            return;
        }

        const income = incomeSource.getIncome(state);

        let count = 0;
        if (incomeSource.schedule && incomeSource.schedule.type === 'custom') {
            count = incomeSource.getCount(state, month, year);
        } else {
            switch (incomeSource.schedule.type) {
                case 'daily':
                    count = daysInCurrentMonth;
                    break;
                case 'weekly':
                    count = getWeeklyOccurrences(year, month, incomeSource.schedule.dateStart, incomeSource.schedule.dateEnd);
                    break;
                case 'monthly':
                    count = getMonthlyOccurrences(year, month, incomeSource.schedule.dateStart, incomeSource.schedule.dateEnd);
                    break;
                case 'bimonthly':
                    count = getBimonthlyOccurrences(year, month, incomeSource.schedule.availableMonths);
                    break;
            }
        }

        for (let i = 0; i < count; i++) {
            const roundedIncome = {
                shiny: Math.round(income.shiny),
                glowy: Math.round(income.glowy),
                starry: Math.round(income.starry),
            };
            const translatedName = translate(incomeSource.nameI18nKey);
            const chip = createIncomeChip(translatedName, incomeSource.className, { type: sourceId, instance: i + 1, ...roundedIncome }, month, year, null);

            if (!groupedChips[sourceId]) {
                groupedChips[sourceId] = [];
            }
            groupedChips[sourceId].push(chip);
        }

        // Process subcategories if any
        if (incomeSource.subCategories) {
            incomeSource.subCategories.forEach(sub => processSource(sub, sub.id));
        }
    };

    for (const key in incomeData) {
        processSource(incomeData[key], key);
    }
    return groupedChips;
}

function getPlacedChipIds() {
    const placedChipOriginalIds = new Set();

    // Build a set of all auto-generated source IDs (including subcategories)
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

    const typePlacedCounts = {}; // Key: `${baseType}|${monthYearKey}`, value: count

    for (const monthYearKey in state.planner.calendar.dates) {
        const days = state.planner.calendar.dates[monthYearKey];
        for (const dayKey in days) {
            const chipIds = days[dayKey];
            chipIds.forEach(chipId => {
                const originalId = chipId.split('-cal')[0];
                if (autoSourceIds.has(originalId)) {
                    // Auto-generated source IDs are not tracked in container
                    return;
                }

                placedChipOriginalIds.add(originalId);

                // Determine the base type (e.g. 'clanWar' or 'cwl')
                let baseType = null;
                if (chipId.startsWith('custom-')) {
                    const parts = chipId.split('-');
                    baseType = parts[1];
                } else {
                    const parts = originalId.split('-');
                    if (parts.length >= 4) {
                        baseType = parts[0];
                    }
                }

                if (baseType) {
                    const countKey = `${baseType}|${monthYearKey}`;
                    typePlacedCounts[countKey] = (typePlacedCounts[countKey] || 0) + 1;
                }
            });
        }
    }

    for (const countKey in typePlacedCounts) {
        const [baseType, monthYearKey] = countKey.split('|');
        const count = typePlacedCounts[countKey];
        for (let i = 0; i < count; i++) {
            const instanceStr = String(i + 1).padStart(2, '0');
            const standardId = `${baseType}-${instanceStr}-${monthYearKey}`;
            placedChipOriginalIds.add(standardId);
        }
    }

    return placedChipOriginalIds;
}

function renderUnplacedChips(incomeChipsContainer, groupedChips, placedChipOriginalIds) {
    for (const type in groupedChips) {
        const chips = groupedChips[type];

        // Find the source (it might be a subcategory)
        const incomeSource = getSourceById(type);

        if (!incomeSource) {
            console.error(`[Planner] Could not find income source data for type: ${type}`);
            continue;
        }

        const unplacedChips = chips.filter(chip => {
            return !placedChipOriginalIds.has(chip.id);
        });

        if (unplacedChips.length > 0) {
            const chipGroup = document.createElement('div');
            chipGroup.className = 'income-chip-group';
            chipGroup.appendChild(unplacedChips[0]);

            if (unplacedChips.length > 1) {
                const remainingCount = unplacedChips.length - 1;
                const aggregatedIncome = { shiny: 0, glowy: 0, starry: 0 };

                for (let i = 1; i < unplacedChips.length; i++) {
                    const chip = unplacedChips[i];
                    aggregatedIncome.shiny += Math.round(chip.dataset.shiny);
                    aggregatedIncome.glowy += Math.round(chip.dataset.glowy);
                    aggregatedIncome.starry += Math.round(chip.dataset.starry);
                }

                const overflowChip = createOverflowChip(
                    remainingCount,
                    aggregatedIncome,
                    type,
                    incomeSource.className
                );
                chipGroup.appendChild(overflowChip);
            }
            incomeChipsContainer.appendChild(chipGroup);
        }
    }
}

let isInitialized = false;

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

    // Event delegation for custom chips button click (handles both header and container buttons)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.create-custom-chips-btn');
        if (btn) {
            openCreateCustomChipsModal();
        }
    });

    // Wire up modal events
    initializeCreateCustomChipsModalListeners();

    // Use ResizeObserver for robust layout packing (covers visibility transitions)
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

export function renderIncomeChips(year, month) {
    const plannerDOMElements = getPlannerDOMElements();
    const incomeChipsContainer = plannerDOMElements.incomeChipsContainer;
    const incomeChipsLegend = document.getElementById('income-chips-legend');

    if (!incomeChipsContainer) {
        console.error('Income chips container not found.');
        return;
    }

    incomeChipsContainer.innerHTML = '';

    const groupedChips = calculateIncomeChips(year, month);
    const placedChipOriginalIds = getPlacedChipIds();
    renderUnplacedChips(incomeChipsContainer, groupedChips, placedChipOriginalIds);

    // Render Custom Chips from state
    const customChips = state.planner.calendar.customChips || [];
    const unplacedCustomChips = customChips.filter(data => !placedChipOriginalIds.has(data.id));

    const getCustomChipGroupKey = (data) => {
        const parts = [data.type];
        const isCustomType = data.type === 'custom' || data.type === 'extras' || data.type.startsWith('custom-') || data.type.startsWith('custom') || data.type.startsWith('extras');
        if (isCustomType) {
            parts.push((data.customType || '').toLowerCase());
        }
        parts.push(data.shiny ?? 0);
        parts.push(data.glowy ?? 0);
        parts.push(data.starry ?? 0);
        if (data.result) parts.push(data.result);
        if (data.multiplier) parts.push(data.multiplier);
        if (data.isRecurring !== undefined) parts.push(data.isRecurring);
        return parts.join('|');
    };

    const groupedCustomChips = {};
    unplacedCustomChips.forEach(data => {
        const key = getCustomChipGroupKey(data);
        if (!groupedCustomChips[key]) {
            groupedCustomChips[key] = [];
        }
        groupedCustomChips[key].push(data);
    });

    for (const groupKey in groupedCustomChips) {
        const group = groupedCustomChips[groupKey];
        const data = group[0];
        const isCustomType = data.type === 'custom' || data.type === 'extras' || data.type.startsWith('custom-') || data.type.startsWith('custom') || data.type.startsWith('extras');
        const incomeSource = isCustomType ? { nameI18nKey: 'planner.createCustomChipsModal.typeExtras', className: 'custom-chip' } : getSourceById(data.type);
        if (incomeSource) {
            let displayName;
            if (isCustomType) {
                const rawCustom = data.customType || translate(incomeSource.nameI18nKey);
                displayName = rawCustom.toLowerCase() === 'custom' || rawCustom.toLowerCase() === 'extras' ? 'Extras' : rawCustom;
            } else {
                displayName = translate(incomeSource.nameI18nKey);
            }
            const chip = createIncomeChip(displayName, incomeSource.className, data, month, year, data.id);
            chip.classList.add('custom-chip-in-container');

            const chipGroup = document.createElement('div');
            chipGroup.className = 'income-chip-group';
            chipGroup.appendChild(chip);

            if (group.length > 1) {
                const remainingCount = group.length - 1;
                const aggregatedIncome = { shiny: 0, glowy: 0, starry: 0 };
                for (let i = 1; i < group.length; i++) {
                    const item = group[i];
                    aggregatedIncome.shiny += Math.round(item.shiny || 0);
                    aggregatedIncome.glowy += Math.round(item.glowy || 0);
                    aggregatedIncome.starry += Math.round(item.starry || 0);
                }
                const overflowChip = createOverflowChip(
                    remainingCount,
                    aggregatedIncome,
                    data.type,
                    incomeSource.className
                );
                chipGroup.appendChild(overflowChip);
            }
            incomeChipsContainer.appendChild(chipGroup);
        }
    }

    if (incomeChipsContainer.children.length === 0) {
        const note = document.createElement('p');
        note.textContent = translate('planner.noMoreChips');
        note.classList.add('placeholder-text');
        incomeChipsContainer.appendChild(note);

        // Append the create button only when the container is empty
        const btn = document.createElement('button');
        btn.className = 'animated-btn btn-accent create-custom-chips-btn';
        btn.textContent = translate('planner.createCustomChips');
        btn.dataset.i18n = 'planner.createCustomChips';
        incomeChipsContainer.appendChild(btn);
    }

    renderIncomeChipsLegend(incomeChipsLegend);
    requestAnimationFrame(packIncomeChips);
    requestAnimationFrame(packLegendItems);
}

function handleDragOverForChipContainer(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('valid-drop-target');
}

function handleDragLeaveForChipContainer(e) {
    e.currentTarget.classList.remove('valid-drop-target');
}

function handleDropToChipContainer(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('valid-drop-target');

    const incomeChipData = JSON.parse(e.dataTransfer.getData('text/plain'));
    handleChipDropOnContainer(incomeChipData);
}

export function handleChipDropOnContainer(incomeChipData) {
    // Build a set of all auto-generated source IDs (including subcategories)
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
    });

    reindexCalendarChips(incomeChipData.type);
    setTimeout(() => {
        renderCalendar(state.planner);
        if (state.planner?.calendar?.view?.month) {
            renderIncomeChips(state.planner.calendar.view.month.split('-')[0], parseInt(state.planner.calendar.view.month.split('-')[1], 10) - 1);
        }
    }, 0);
}

export function packIncomeChips() {
    const container = document.getElementById('income-chips-container');
    if (!container) return;

    const groups = Array.from(container.querySelectorAll('.income-chip-group'));
    if (groups.length === 0) return;

    // Reset styles/order before measuring so offsetWidth returns raw unplaced values
    groups.forEach(g => {
        g.style.order = '';
    });

    // Measure actual widths of all groups
    const items = groups.map(g => ({
        element: g,
        width: g.offsetWidth
    }));

    // If all measured widths are 0, it means the browser has not performed layout yet.
    // Defer to the next animation frame.
    const totalWidth = items.reduce((sum, item) => sum + item.width, 0);
    if (totalWidth === 0) {
        requestAnimationFrame(packIncomeChips);
        return;
    }

    const gap = 8; // matches the gap in CSS (.income-chips-container gap: 8px)
    const containerWidth = container.clientWidth - 20; // 20px for padding (10px left/right)
    if (containerWidth <= 0) return;

    // Bin-packing (First-Fit)
    const bins = []; // Each bin holds { remainingCapacity: number, elements: [] }

    items.forEach(item => {
        const neededWidth = item.width;
        let foundBinIndex = -1;

        for (let i = 0; i < bins.length; i++) {
            const spaceNeeded = bins[i].elements.length > 0 ? neededWidth + gap : neededWidth;
            if (bins[i].remainingCapacity >= spaceNeeded) {
                foundBinIndex = i;
                break;
            }
        }

        if (foundBinIndex !== -1) {
            bins[foundBinIndex].elements.push(item.element);
            const spaceNeeded = bins[foundBinIndex].elements.length > 1 ? neededWidth + gap : neededWidth;
            bins[foundBinIndex].remainingCapacity -= spaceNeeded;
        } else {
            bins.push({
                remainingCapacity: containerWidth - neededWidth,
                elements: [item.element]
            });
        }
    });

    // Assign CSS order based on bin index to let the browser visually re-order them
    let currentOrder = 1;
    bins.forEach((bin) => {
        bin.elements.forEach(el => {
            el.style.order = currentOrder;
        });
        currentOrder++;
    });
}

export function packLegendItems() {
    const container = document.getElementById('income-chips-legend');
    if (!container) return;

    const items = Array.from(container.querySelectorAll('.legend-item'));
    if (items.length === 0) return;

    // Reset styles/order before measuring
    items.forEach(el => { el.style.order = ''; });

    const gap = window.innerWidth <= 425 ? 2 : 8;
    const containerWidth = container.clientWidth - 30; // 15px padding left/right
    if (containerWidth <= 0) return;

    const measuredItems = items.map(el => ({ element: el, width: el.offsetWidth }));

    const totalWidth = measuredItems.reduce((sum, item) => sum + item.width, 0);
    if (totalWidth === 0) {
        requestAnimationFrame(packLegendItems);
        return;
    }

    const bins = [];
    measuredItems.forEach(item => {
        const neededWidth = item.width;
        let foundBinIndex = -1;

        for (let i = 0; i < bins.length; i++) {
            const spaceNeeded = bins[i].elements.length > 0 ? neededWidth + gap : neededWidth;
            if (bins[i].remainingCapacity >= spaceNeeded) {
                foundBinIndex = i;
                break;
            }
        }

        if (foundBinIndex !== -1) {
            bins[foundBinIndex].elements.push(item.element);
            const spaceNeeded = bins[foundBinIndex].elements.length > 1 ? neededWidth + gap : neededWidth;
            bins[foundBinIndex].remainingCapacity -= spaceNeeded;
        } else {
            bins.push({
                remainingCapacity: containerWidth - neededWidth,
                elements: [item.element]
            });
        }
    });

    let currentOrder = 1;
    bins.forEach((bin) => {
        bin.elements.forEach(el => { el.style.order = currentOrder; });
        currentOrder++;
    });
}