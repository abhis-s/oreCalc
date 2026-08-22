import { CANONICAL_CHIP_PRIORITY_ORDER, getSourceById, incomeData } from '../../data/incomeSourceRegistry.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { createIncomeChip, createOverflowChip, renderIncomeChipsLegend } from '../../utils/chipFactory.js';
import { getBimonthlyOccurrences, getDaysInMonth, getMonthlyOccurrences, getWeeklyOccurrences } from '../../utils/dateUtils.js';

import { getPlannerDOMElements } from '../../dom/plannerDom.js';

function getChipTypePriority(type) {
    if (!type) return 999;
    let idx = CANONICAL_CHIP_PRIORITY_ORDER.indexOf(type);
    if (idx !== -1) return idx;
    if (type.startsWith('starBonus')) return 0;
    if (type === 'custom' || type === 'extras' || type.startsWith('custom-') || type.startsWith('extras')) return 999;
    return 900;
}

/**
 * Calculates draggable income chips for a given month and year.
 * @param {number} year
 * @param {number} month 0-based month index
 * @returns {Record<string, Array<HTMLElement>>}
 */
export function calculateIncomeChips(year, month) {
    const daysInCurrentMonth = getDaysInMonth(year, month);
    const groupedChips = {};

    const processSource = (incomeSource, sourceId) => {
        // Skip default daily/auto sources from appearing as DRAGGABLE chips
        if (incomeSource.autoGenerateInCalendar) {
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
                    count = getWeeklyOccurrences(year, month, incomeSource.schedule.dateStart);
                    break;
                case 'monthly':
                    count = getMonthlyOccurrences();
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

        if (incomeSource.subCategories) {
            incomeSource.subCategories.forEach(sub => processSource(sub, sub.id));
        }
    };

    for (const key in incomeData) {
        processSource(incomeData[key], key);
    }
    return groupedChips;
}

/**
 * Returns a Set of IDs for chips already placed on calendar day cells.
 * @returns {Set<string>}
 */
export function getPlacedChipIds() {
    const placedChipOriginalIds = new Set();

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
                    return;
                }

                placedChipOriginalIds.add(originalId);

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
        const [year, month] = monthYearKey.split('-');
        const count = typePlacedCounts[countKey];
        for (let i = 0; i < count; i++) {
            const instanceStr = String(i + 1).padStart(2, '0');
            const standardId = `${baseType}-${instanceStr}-${year}-${month}`;
            placedChipOriginalIds.add(standardId);
        }

    }

    return placedChipOriginalIds;
}

/**
 * Creates unplaced income chip groups with overflow badges.
 * @param {HTMLElement|null} incomeChipsContainer
 * @param {Record<string, Array<HTMLElement>>} groupedChips
 * @param {Set<string>} placedChipOriginalIds
 * @returns {Array<{ type: string, element: HTMLElement }>}
 */
export function renderUnplacedChips(incomeChipsContainer, groupedChips, placedChipOriginalIds) {
    const chipGroups = [];

    for (const type in groupedChips) {
        const chips = groupedChips[type];
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
                    aggregatedIncome.shiny += Math.round(parseFloat(chip.dataset.shiny || '0'));
                    aggregatedIncome.glowy += Math.round(parseFloat(chip.dataset.glowy || '0'));
                    aggregatedIncome.starry += Math.round(parseFloat(chip.dataset.starry || '0'));
                }

                const overflowChip = createOverflowChip(
                    remainingCount,
                    aggregatedIncome,
                    type,
                    incomeSource.className
                );
                chipGroup.appendChild(overflowChip);
            }
            chipGroups.push({ type, element: chipGroup });
            if (incomeChipsContainer) {
                incomeChipsContainer.appendChild(chipGroup);
            }
        }
    }

    return chipGroups;
}

/**
 * Main render function for income chips container and legend.
 * @param {number} year
 * @param {number} month 0-based month index
 */
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

    // Collect standard unplaced chip groups (do not append immediately to container)
    const allChipGroups = renderUnplacedChips(null, groupedChips, placedChipOriginalIds);

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
        const incomeSource = isCustomType ? { nameI18nKey: 'views.planner.createCustomChipsModal.typeExtras', className: 'custom-chip' } : getSourceById(data.type);
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
            allChipGroups.push({ type: data.type, element: chipGroup });
        }
    }

    // Sort all chip groups according to canonical priority order
    allChipGroups.sort((a, b) => {
        return getChipTypePriority(a.type) - getChipTypePriority(b.type);
    });

    allChipGroups.forEach(group => {
        incomeChipsContainer.appendChild(group.element);
    });

    if (incomeChipsContainer.children.length === 0) {
        const note = document.createElement('p');
        note.textContent = translate('views.planner.noMoreChips');
        note.classList.add('placeholder-text');
        incomeChipsContainer.appendChild(note);

        const btn = document.createElement('button');
        btn.className = 'animated-btn btn-accent create-custom-chips-btn';
        btn.textContent = translate('views.planner.createCustomChips');
        btn.dataset.i18n = 'views.planner.createCustomChips';
        incomeChipsContainer.appendChild(btn);
    }

    renderIncomeChipsLegend(incomeChipsLegend);
    requestAnimationFrame(packIncomeChips);
    requestAnimationFrame(packLegendItems);
}

/**
 * Bin-packing layout optimizer for unplaced income chip groups.
 * Strict Read/Write DOM phase separation.
 */
export function packIncomeChips() {
    const container = document.getElementById('income-chips-container');
    if (!container) return;

    const groups = Array.from(container.querySelectorAll('.income-chip-group'));
    if (groups.length === 0) return;

    groups.forEach(g => {
        /** @type {HTMLElement} */ (g).style.order = '';
    });

    // Read Phase: batch measuring
    const items = groups.map(g => ({
        element: /** @type {HTMLElement} */ (g),
        width: /** @type {HTMLElement} */ (g).offsetWidth
    }));

    const totalWidth = items.reduce((sum, item) => sum + item.width, 0);
    if (totalWidth === 0) {
        requestAnimationFrame(packIncomeChips);
        return;
    }

    const gap = 8;
    const containerWidth = container.clientWidth - 20;
    if (containerWidth <= 0) return;

    // Computation Phase: First-Fit bin packing
    const bins = [];

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

    // Write Phase: batch apply style updates
    let currentOrder = 1;
    bins.forEach((bin) => {
        bin.elements.forEach(el => {
            el.style.order = String(currentOrder);
        });
        currentOrder++;
    });
}

/**
 * Bin-packing layout optimizer for income chips legend items.
 * Strict Read/Write DOM phase separation.
 */
export function packLegendItems() {
    const container = document.getElementById('income-chips-legend');
    if (!container) return;

    const items = Array.from(container.querySelectorAll('.legend-item'));
    if (items.length === 0) return;

    items.forEach(el => { /** @type {HTMLElement} */ (el).style.order = ''; });

    const gap = window.innerWidth <= 425 ? 2 : 8;
    const containerWidth = container.clientWidth - 30;
    if (containerWidth <= 0) return;

    // Read Phase: batch measuring
    const measuredItems = items.map(el => ({ element: /** @type {HTMLElement} */ (el), width: /** @type {HTMLElement} */ (el).offsetWidth }));

    const totalWidth = measuredItems.reduce((sum, item) => sum + item.width, 0);
    if (totalWidth === 0) {
        requestAnimationFrame(packLegendItems);
        return;
    }

    // Computation Phase
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

    // Write Phase: batch apply style updates
    let currentOrder = 1;
    bins.forEach((bin) => {
        bin.elements.forEach(el => { el.style.order = String(currentOrder); });
        currentOrder++;
    });
}
