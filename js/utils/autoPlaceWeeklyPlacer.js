import { getSourceById } from '../data/incomeSourceRegistry.js';
import { state } from '../core/state.js';
import { addDays, extractScheduleStartDate, getScheduleDates } from './dateUtils.js';

/**
 * Checks whether a weekly cycle (Tuesday to next Monday) is already satisfied by a manual or custom chip.
 *
 * @param {string} chipType
 * @param {number} currentYear
 * @param {number} currentMonth
 * @param {number} instance
 * @param {Object} newCalendarDates
 * @returns {boolean}
 */
export function isWeeklyCycleSatisfied(chipType, currentYear, currentMonth, instance, newCalendarDates) {
    const source = getSourceById(chipType);
    if (!source || !source.schedule) return false;
    const scheduleDates = getScheduleDates(currentYear, currentMonth, source.schedule);
    if (!scheduleDates[instance - 1]) return false;
    const sDate = extractScheduleStartDate(scheduleDates[instance - 1]);
    if (!sDate || typeof sDate.getUTCDate !== 'function') return false;

    const tuesdayDay = sDate.getUTCDate();
    const weekStartDate = new Date(Date.UTC(currentYear, currentMonth, tuesdayDay));
    const weekEndDate = addDays(weekStartDate, 6);

    let curDate = new Date(weekStartDate);
    while (curDate <= weekEndDate) {
        const curMYKey = `${curDate.getUTCFullYear()}-${String(curDate.getUTCMonth() + 1).padStart(2, '0')}`;
        const curDayKey = String(curDate.getUTCDate()).padStart(2, '0');
        const dayChips = newCalendarDates[curMYKey]?.[curDayKey] || [];
        if (dayChips.some(id => {
            if (id.endsWith('-auto')) return false;
            const cleanId = id.replace(/^custom-/, '');
            const storedCustomType = state.planner?.calendar?.customChipData?.[id]?.customType || '';
            return cleanId.startsWith(chipType) || storedCustomType === chipType || id.startsWith(chipType);
        })) {
            return true;
        }
        curDate = addDays(curDate, 1);
    }
    return false;
}
