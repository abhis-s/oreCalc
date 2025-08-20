import { getPlannerDOMElements } from '../../dom/plannerDom.js';
import { incomeData } from '../../data/incomeChipData.js';
import { state } from '../../core/state.js';
import { getWeeklyOccurrences, getMonthlyOccurrences, getBimonthlyOccurrences } from '../../utils/dateUtils.js';
import { createIncomeChip, renderIncomeChipsLegend } from '../../utils/chipFactory.js';

export function renderIncomeChips(year, month) {
    const plannerDOMElements = getPlannerDOMElements();
    const incomeChipsContainer = plannerDOMElements.incomeChipsContainer;
    const incomeChipsLegend = document.getElementById('income-chips-legend');

    if (!incomeChipsContainer) {
        console.error('Income chips container not found.');
        return;
    }

    incomeChipsContainer.innerHTML = '';

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getUTCDate();
    };
    const daysInCurrentMonth = getDaysInMonth(year, month);

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
            incomeChipsContainer.appendChild(chip);
        }
    }

    // After rendering all chips, check the calendar state and remove chips that are already in the calendar
    for (const monthYearKey in state.planner.calendar.dates) {
        const days = state.planner.calendar.dates[monthYearKey];
        for (const dayKey in days) {
            const chipIds = days[dayKey];
            chipIds.forEach(chipId => {
                const originalChipId = chipId.split('-cal')[0];
                const chipToRemove = incomeChipsContainer.querySelector(`#${originalChipId}`);
                if (chipToRemove) {
                    chipToRemove.remove();
                }
            });
        }
    }

    renderIncomeChipsLegend(incomeChipsLegend);
}
