import { getISOWeekNumber } from '../../utils/dateUtils.js';
import { getGlobalPriorityList } from './priorityListScheduler.js';

let currentView = 'monthly';

/**
 * Returns the current calendar view mode ('monthly' or 'weekly').
 * @returns {string}
 */
export function getCurrentView() {
    return currentView;
}

/**
 * Sets the calendar view mode ('monthly' or 'weekly').
 * @param {string} view
 */
export function setCurrentView(view) {
    currentView = view;
}

/**
 * Normalizes a date to UTC midnight timestamp.
 * @param {Date} d
 * @returns {number} UTC timestamp in milliseconds.
 */
export function getMidnightUTCTime(d) {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Returns the theme color associated with a hero.
 * @param {string} heroName
 * @returns {string} Hex color string.
 */
export function getHeroColor(heroName) {
    if (!heroName) return '#7f8c8d';
    const lower = heroName.toLowerCase();
    if (lower.includes('king')) return '#d4af37';    // Gold
    if (lower.includes('queen')) return '#a020f0';   // Purple
    if (lower.includes('warden')) return '#00bfff';  // Sky Blue
    if (lower.includes('champion')) return '#e74c3c'; // Red
    if (lower.includes('prince')) return '#27ae60';   // Green
    return '#7f8c8d';
}

/**
 * Calculates equipment completion milestones and upgrade accumulation ranges.
 * @returns {{ milestones: Record<string, Array<any>>, ranges: Array<{ start: number, end: number, item: any }> }}
 */
export function getEquipmentSchedule() {
    const { globalPriorityList } = getGlobalPriorityList();
    const milestones = {};
    const ranges = [];

    if (!globalPriorityList || globalPriorityList.length === 0) {
        return { milestones, ranges };
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayUTC = getMidnightUTCTime(today);

    let lastCompletionTime = todayUTC;

    globalPriorityList.forEach((item, idx) => {
        if (!item.completionDate) return;

        const compDate = new Date(item.completionDate);
        const compTime = getMidnightUTCTime(compDate);

        // Milestone
        const year = compDate.getUTCFullYear();
        const month = String(compDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(compDate.getUTCDate()).padStart(2, '0');
        const compDateStr = `${year}-${month}-${day}`;

        if (!milestones[compDateStr]) {
            milestones[compDateStr] = [];
        }
        milestones[compDateStr].push(item);

        // Range
        let rangeStartTime = lastCompletionTime;
        if (idx > 0) {
            // Start the day after the previous completion
            const prevCompDate = new Date(lastCompletionTime);
            prevCompDate.setUTCDate(prevCompDate.getUTCDate() + 1);
            rangeStartTime = getMidnightUTCTime(prevCompDate);
        }

        if (rangeStartTime <= compTime) {
            ranges.push({
                start: rangeStartTime,
                end: compTime,
                item: item
            });
        }

        lastCompletionTime = compTime;
    });

    return { milestones, ranges };
}

/**
 * Calculates all unique ISO week entries within a given month.
 * @param {number} year
 * @param {number} month 1-based month index
 * @returns {Array<{ key: string, number: number, year: number }>}
 */
export function getWeeksInMonth(year, month) {
    const weeks = [];
    const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0));

    let currentDay = new Date(firstDayOfMonth);
    while (currentDay <= lastDayOfMonth) {
        const [weekYear, weekNumber] = getISOWeekNumber(currentDay);
        const weekKey = `${weekYear}-${String(weekNumber).padStart(2, '0')}`;
        if (!weeks.some(w => w.key === weekKey)) {
            weeks.push({ key: weekKey, number: weekNumber, year: weekYear });
        }

        currentDay.setUTCDate(currentDay.getUTCDate() + 7);
    }
    return weeks;
}
