import { getPlannerDOMElements } from '../../dom/plannerDom.js';
import { incomeData } from '../../data/incomeChipData.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { renderCalendar } from '../planner/calendar.js';
import { getWeeklyOccurrences, getMonthlyOccurrences, getBimonthlyOccurrences } from '../../utils/dateUtils.js';
import { createIncomeChip, renderIncomeChipsLegend, createOverflowChip } from '../../utils/chipFactory.js';
import { reindexCalendarChips } from '../../utils/chipManager.js';

export function renderIncomeChips(year, month) {
    const plannerDOMElements = getPlannerDOMElements();
    const incomeChipsContainer = plannerDOMElements.incomeChipsContainer;
    const incomeChipsLegend = document.getElementById('income-chips-legend');

    if (!incomeChipsContainer) {
        console.error('Income chips container not found.');
        return;
    }

    incomeChipsContainer.innerHTML = '';

    incomeChipsContainer.addEventListener('dragover', handleDragOverForChipContainer);
    incomeChipsContainer.addEventListener('dragleave', handleDragLeaveForChipContainer);
    incomeChipsContainer.addEventListener('drop', handleDropToChipContainer);

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getUTCDate();
    };
    const daysInCurrentMonth = getDaysInMonth(year, month);

    const groupedChips = {};

    for (const key in incomeData) {
        const incomeSource = incomeData[key];
        // Skip starBonus as it's automatically placed on the calendar
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

    // Filter out chips already on the calendar and render grouped chips
    const chipsOnCalendar = {};
    for (const monthYearKey in state.planner.calendar.dates) {
        const days = state.planner.calendar.dates[monthYearKey];
        for (const dayKey in days) {
            const chipIds = days[dayKey];
            chipIds.forEach(chipId => {
                const originalChipId = chipId.split('-cal')[0];
                const type = originalChipId.split('-')[0];
                if (!chipsOnCalendar[type]) {
                    chipsOnCalendar[type] = 0;
                }
                chipsOnCalendar[type]++;
            });
        }
    }

    for (const type in groupedChips) {
        let chips = groupedChips[type];
        let remainingCount = chips.length - (chipsOnCalendar[type] || 0);

        if (remainingCount > 0) {
            // Always show the first available chip
            const firstChip = chips.find(chip => {
                const originalChipId = chip.id.split('-cal')[0];
                return !Object.values(state.planner.calendar.dates).some(days => 
                    Object.values(days).some(chipIds => 
                        chipIds.includes(`${originalChipId}-cal`)
                    )
                );
            });

            if (firstChip) {
                incomeChipsContainer.appendChild(firstChip);
                remainingCount--;
            }

            // If there are more chips, show the overflow chip
            if (remainingCount > 0) {
                const incomeSource = incomeData[type];
                const aggregatedIncome = { shiny: 0, glowy: 0, starry: 0 };
                // Aggregate income for remaining chips (this is a simplification, might need more precise aggregation)
                for (let i = 0; i < remainingCount; i++) {
                    const income = incomeSource.getIncome(state);
                    aggregatedIncome.shiny += Math.round(income.shiny);
                    aggregatedIncome.glowy += Math.round(income.glowy);
                    aggregatedIncome.starry += Math.round(income.starry);
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
    renderIncomeChips(state.planner.calendar.month.split('-')[1], parseInt(state.planner.calendar.month.split('-')[0], 10) - 1);
}
