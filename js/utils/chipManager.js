import { state } from '../core/state.js';
import { incomeData } from '../data/incomeChipData.js';

export function calculateCumulativeOres(targetDate, initialOres) {
    let cumulativeOres = { ...initialOres };
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    let currentDate = new Date(todayUTC); 

    while (currentDate.getTime() <= targetDate.getTime()) {
        const monthYearKey = `${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${currentDate.getUTCFullYear()}`;
        const dayKey = String(currentDate.getUTCDate()).padStart(2, '0');

        const starBonusSource = incomeData.starBonus;
        const starBonusIncome = starBonusSource.getIncome(state);
        cumulativeOres.shiny += Math.round(starBonusIncome.shiny);
        cumulativeOres.glowy += Math.round(starBonusIncome.glowy);
        cumulativeOres.starry += Math.round(starBonusIncome.starry);

        const chipsForThisDay = state.planner.calendar.dates[monthYearKey]?.[dayKey] || [];
        chipsForThisDay.forEach(chipId => {
            const parts = chipId.split('-');
            const type = parts[0];
            if (type === 'starBonus') {
                return;
            }
            const incomeSource = incomeData[type];

            if (incomeSource) {
                const income = incomeSource.getIncome(state);
                cumulativeOres.shiny += Math.round(income.shiny);
                cumulativeOres.glowy += Math.round(income.glowy);
                cumulativeOres.starry += Math.round(income.starry);
            }
        });

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return cumulativeOres;
}

export function reindexCalendarChips(chipType) {
    let changed = false;

    for (const monthYearKey in state.planner.calendar.dates) {
        const chipsToReindexThisMonth = [];
        const daysInMonth = state.planner.calendar.dates[monthYearKey];

        for (const dayStr in daysInMonth) {
            const chipIds = daysInMonth[dayStr];
            const chipsOnThisDay = chipIds.filter(id => id.startsWith(`${chipType}-`));

            chipsOnThisDay.forEach(chipId => {
                const parts = chipId.split('-');
                const type = parts[0];
                const instance = parseInt(parts[1], 10);
                const month = parseInt(parts[2], 10) - 1;
                const year = parseInt(parts[3], 10);
                const date = new Date(Date.UTC(year, month, parseInt(dayStr, 10)));

                const incomeSource = incomeData[type];
                if (incomeSource && incomeSource.schedule && incomeSource.schedule.type === 'weekly') {
                    return;
                }

                chipsToReindexThisMonth.push({
                    originalId: chipId,
                    type: type,
                    instance: instance,
                    date: date,
                    monthYearKey: monthYearKey,
                    dayKey: dayStr,
                });
            });
        }

        // Sort chips chronologically for the current month
        chipsToReindexThisMonth.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Re-assign sequential instance IDs for the current month
        chipsToReindexThisMonth.forEach((chip, index) => {
            const newInstance = index + 1;
            const wasAuto = chip.originalId.endsWith('-auto');

            if (chip.instance !== newInstance) {
                changed = true;

                // Remove old chipId from calendar
                const oldChipIds = state.planner.calendar.dates[chip.monthYearKey][chip.dayKey];
                const oldIndex = oldChipIds.indexOf(chip.originalId);
                if (oldIndex > -1) {
                    oldChipIds.splice(oldIndex, 1);
                }

                // Create new chipId with updated instance, preserving -auto flag
                const newInstanceStr = String(newInstance).padStart(2, '0');
                const newMonthStr = String(parseInt(chip.monthYearKey.split('-')[0], 10)).padStart(2, '0');
                let newChipId = `${chip.type}-${newInstanceStr}-${newMonthStr}-${chip.monthYearKey.split('-')[1]}-cal`;
                if (wasAuto) {
                    newChipId += '-auto';
                }

                // Add new chipId to calendar
                if (!state.planner.calendar.dates[chip.monthYearKey][chip.dayKey]) {
                    state.planner.calendar.dates[chip.monthYearKey][chip.dayKey] = [];
                }
                state.planner.calendar.dates[chip.monthYearKey][chip.dayKey].push(newChipId);
            }
        });
    }

    return changed;
}