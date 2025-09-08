import { getPlannerDOMElements } from '../../dom/plannerDom.js';
import { incomeData } from '../../data/incomeChipData.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { renderCalendar } from '../planner/calendar.js';
import { getDaysInMonth, getWeeklyOccurrences, getMonthlyOccurrences, getBimonthlyOccurrences } from '../../utils/dateUtils.js';
import { createIncomeChip, renderIncomeChipsLegend, createOverflowChip } from '../../utils/chipFactory.js';
import { reindexCalendarChips } from '../../utils/chipManager.js';

function calculateIncomeChips(year, month) {
    const daysInCurrentMonth = getDaysInMonth(year, month);
    const groupedChips = {};

    for (const key in incomeData) {
        const incomeSource = incomeData[key];
        if (incomeSource.type === 'starBonus') {
            continue;
        }
        const income = incomeSource.getIncome(state);

        let count = 0;
        if (incomeSource.schedule && incomeSource.schedule.type === 'custom') {
            count = incomeSource.getCount(state);
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
            const chip = createIncomeChip(incomeSource.name, incomeSource.className, { type: incomeSource.type, instance: i + 1, ...roundedIncome }, month, year, null);

            if (!groupedChips[incomeSource.type]) {
                groupedChips[incomeSource.type] = [];
            }
            groupedChips[incomeSource.type].push(chip);
        }
    }
    return groupedChips;
}

function getPlacedChipIds() {
    const placedChipOriginalIds = new Set();
    for (const monthYearKey in state.planner.calendar.dates) {
        const days = state.planner.calendar.dates[monthYearKey];
        for (const dayKey in days) {
            const chipIds = days[dayKey];
            chipIds.forEach(chipId => {
                const originalId = chipId.split('-cal')[0];
                if (!originalId.startsWith('starBonus')) {
                    placedChipOriginalIds.add(originalId);
                }
            });
        }
    }
    return placedChipOriginalIds;
}

function renderUnplacedChips(incomeChipsContainer, groupedChips, placedChipOriginalIds) {
    for (const type in groupedChips) {
        const chips = groupedChips[type];
        const incomeSource = incomeData[type];

        const unplacedChips = chips.filter(chip => {
            return !placedChipOriginalIds.has(chip.id);
        });

        if (unplacedChips.length > 0) {
            incomeChipsContainer.appendChild(unplacedChips[0]);

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
                incomeChipsContainer.appendChild(overflowChip);
            }
        }
    }
}

export function initializeIncomeChipsEventListeners() {
    const plannerDOMElements = getPlannerDOMElements();
    const incomeChipsContainer = plannerDOMElements.incomeChipsContainer;

    if (!incomeChipsContainer) {
        console.error('Income chips container not found.');
        return;
    }

    incomeChipsContainer.addEventListener('dragover', handleDragOverForChipContainer);
    incomeChipsContainer.addEventListener('dragleave', handleDragLeaveForChipContainer);
    incomeChipsContainer.addEventListener('drop', handleDropToChipContainer);
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

    if (incomeChipsContainer.children.length === 0) {
        const note = document.createElement('p');
        note.textContent = 'All chips for this month have already been placed on the calendar.';
        note.classList.add('placeholder-text');
        incomeChipsContainer.appendChild(note);
    }

    renderIncomeChipsLegend(incomeChipsLegend);
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

    handleStateUpdate(() => {
        for (const monthYearKey in state.planner.calendar.dates) {
            const days = state.planner.calendar.dates[monthYearKey];
            for (const dayKey in days) {
                const chipIds = days[dayKey];
                const originalId = incomeChipData.id.split('-cal')[0];
                const indexToRemove = chipIds.findIndex(id => id.split('-cal')[0] === originalId);
                if (indexToRemove > -1) {
                    chipIds.splice(indexToRemove, 1);
                    if (chipIds.length === 0) {
                        delete days[dayKey];
                    }
                    if (Object.keys(days).length === 0) {
                        delete state.planner.calendar.dates[monthYearKey];
                    }
                }
            }
        }
    });

    reindexCalendarChips(incomeChipData.type);
    renderCalendar(state.planner);
    renderIncomeChips(state.planner.calendar.view.month.split('-')[1], parseInt(state.planner.calendar.view.month.split('-')[0], 10) - 1);
}
