import {
    addDays,
    formatDate,
    formatDateRange,
    getDefaultDateLocale,
    getDaysInMonth
} from '../../utils/dateUtils.js';

/**
 * Finds the last occurrence of a day of the week in a month.
 *
 * @param {number} year - 4-digit calendar year.
 * @param {number} month - 0-indexed calendar month (0-11).
 * @param {number} dayOfWeek - Day of week (0=Sun, 1=Mon...).
 * @returns {Date | null} Matching date or null.
 */
function findLastDayOfWeek(year, month, dayOfWeek) {
    const lastDay = getDaysInMonth(year, month);
    for (let day = lastDay; day >= 1; day--) {
        const date = new Date(Date.UTC(year, month, day));
        if (date.getUTCDay() === dayOfWeek) {
            return date;
        }
    }
    return null;
}

/**
 * Formats a date range for Supercell Events in a localized way.
 *
 * @param {Date} startDate - Event start UTC date.
 * @param {Date} endDate - Event end UTC date.
 * @param {string} [locale] - UI language locale.
 * @returns {string} Formatted range string.
 */
export function formatSupercellEventsDate(startDate, endDate, locale = getDefaultDateLocale()) {
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return 'TBD';
    }

    // Check if it's a full month event (like World Finals often are in the schedule)
    const isFullMonth = startDate.getUTCDate() === 1 &&
        (endDate.getUTCDate() >= 28 || (endDate.getUTCMonth() !== startDate.getUTCMonth()));

    if (isFullMonth) {
        return formatDate(startDate, { month: 'long', timeZone: 'UTC' }, locale);
    }

    return formatDateRange(startDate, endDate, { month: 'short', day: 'numeric', timeZone: 'UTC' }, locale);
}

/**
 * Determines whether a Supercell tournament event represents a placeholder range without specific dates.
 *
 * @param {any} event - Event object with potential start/end date strings and flags.
 * @returns {boolean} True if the event is a placeholder, false if specific dates are provided.
 */
export function isEventPlaceholder(event) {
    if (!event || typeof event !== 'object') {
        return true;
    }
    if (event.isPlaceholder === true || event.hasSpecificDates === false) {
        return true;
    }
    if (!event.start || !event.end) {
        return true;
    }

    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return true;
    }

    // Check if event spans an entire month without specific days (e.g. 1st 00:00:00 UTC to last day 23:59:59 UTC)
    const isFullMonth = startDate.getUTCDate() === 1 &&
        (endDate.getUTCDate() >= 28 || endDate.getUTCMonth() !== startDate.getUTCMonth()) &&
        startDate.getUTCHours() === 0 && startDate.getUTCMinutes() === 0 &&
        endDate.getUTCHours() >= 23 && endDate.getUTCMinutes() >= 59;

    return isFullMonth;
}

/**
 * Determines whether a Supercell tournament event is currently live based on daily broadcast windows.
 *
 * @param {any} event - Event object with start, end, and optional broadcast windows.
 * @param {Date} [now=new Date()] - Evaluation timestamp.
 * @returns {boolean} True if the event is currently actively broadcasting.
 */
export function isSupercellEventLive(event, now = new Date()) {
    if (isEventPlaceholder(event)) {
        return false;
    }

    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const nowTime = now.getTime();

    // Check overall tournament boundary
    if (nowTime < startDate.getTime() || nowTime > endDate.getTime()) {
        return false;
    }

    // Explicit custom broadcast windows array
    if (Array.isArray(event.broadcastWindows) && event.broadcastWindows.length > 0) {
        return event.broadcastWindows.some(broadcastWindow => {
            const wStart = new Date(broadcastWindow.start).getTime();
            const wEnd = new Date(broadcastWindow.end).getTime();
            return nowTime >= wStart && nowTime <= wEnd;
        });
    }

    // Extract start and end time of day in UTC minutes
    let startDailyMinutes;
    let endDailyMinutes;

    if (typeof event.dailyStartTime === 'string' && typeof event.dailyEndTime === 'string') {
        const [sh, sm = 0] = event.dailyStartTime.split(':').map(Number);
        const [eh, em = 0] = event.dailyEndTime.split(':').map(Number);
        startDailyMinutes = sh * 60 + sm;
        endDailyMinutes = eh * 60 + em;
    } else {
        startDailyMinutes = startDate.getUTCHours() * 60 + startDate.getUTCMinutes();
        endDailyMinutes = endDate.getUTCHours() * 60 + endDate.getUTCMinutes();
    }

    // Full 24-hour day coverage when specific hours are not yet public (e.g. 00:00 to 23:59 UTC)
    if (startDailyMinutes === 0 && endDailyMinutes >= 1439) {
        return true;
    }

    const nowDailyMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    // Standard daily broadcast hours check (e.g. 16:00 to 23:00 UTC)
    if (startDailyMinutes <= endDailyMinutes) {
        return nowDailyMinutes >= startDailyMinutes && nowDailyMinutes <= endDailyMinutes;
    }

    // Overnight daily broadcast hours crossing UTC midnight
    return nowDailyMinutes >= startDailyMinutes || nowDailyMinutes <= endDailyMinutes;
}

/**
 * Generates and formats official Supercell Championship events for a given year.
 *
 * @param {number} year - Year to evaluate.
 * @param {any} supercellEventsData - Source tournament schedule metadata.
 * @param {string} [locale] - UI language code.
 * @returns {any[]} List of event objects with dates and localized labels.
 */
export function getSupercellEventsForYear(year, supercellEventsData, locale = getDefaultDateLocale()) {
    let events = [];
    if (supercellEventsData.events && supercellEventsData.events[year]) {
        events = supercellEventsData.events[year];
    } else {
        // Fallback logic
        const availableYears = Object.keys(supercellEventsData.events).map(Number).sort((a, b) => b - a);
        const lastYear = availableYears.find(y => y < year) || availableYears[0];
        if (!lastYear) return [];

        const lastYearEvents = supercellEventsData.events[lastYear];
        const generatedEvents = [];

        // Get the unique months and names from the previous year's schedule
        const eventTemplates = lastYearEvents.reduce((acc, event) => {
            const start = new Date(event.start);
            if (!acc[event.name]) acc[event.name] = [];
            const month = start.getUTCMonth();
            if (!acc[event.name].includes(month)) {
                acc[event.name].push(month);
            }
            return acc;
        }, {});

        /** @type {Date | null} */
        let lastMonthlyFinalsDate = null;

        if (eventTemplates['Monthly Finals']) {
            for (const month of eventTemplates['Monthly Finals']) {
                const lastSunday = findLastDayOfWeek(year, month, 0); // 0 = Sunday
                if (lastSunday) {
                    const lastSaturday = addDays(lastSunday, -1);
                    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastSaturday.getUTCDate()).padStart(2, '0')}T16:00:00Z`;
                    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastSunday.getUTCDate()).padStart(2, '0')}T23:00:00Z`;

                    generatedEvents.push({ name: 'Monthly Finals', start: startStr, end: endStr });
                    lastMonthlyFinalsDate = lastSunday;
                }
            }
        }

        if (eventTemplates['Last Chance Qualifier'] && lastMonthlyFinalsDate) {
            const lcqSaturday = addDays(lastMonthlyFinalsDate, 13); // 2 weeks after (Sat is 13 days after the previous Sun)
            const lcqSunday = addDays(lcqSaturday, 1);
            const startStr = `${lcqSaturday.getUTCFullYear()}-${String(lcqSaturday.getUTCMonth() + 1).padStart(2, '0')}-${String(lcqSaturday.getUTCDate()).padStart(2, '0')}T16:00:00Z`;
            const endStr = `${lcqSunday.getUTCFullYear()}-${String(lcqSunday.getUTCMonth() + 1).padStart(2, '0')}-${String(lcqSunday.getUTCDate()).padStart(2, '0')}T23:00:00Z`;

            generatedEvents.push({ name: 'Last Chance Qualifier', start: startStr, end: endStr });
        }

        if (eventTemplates['World Finals'] && lastMonthlyFinalsDate) {
            const lcqMonth = lastMonthlyFinalsDate.getUTCMonth();
            const lcqYear = lastMonthlyFinalsDate.getUTCFullYear();
            const targetDate = new Date(Date.UTC(lcqYear, lcqMonth + 2, 1, 0, 0, 0));
            const wfYear = targetDate.getUTCFullYear();
            const wfMonth = targetDate.getUTCMonth();
            const lastDayOfWfMonth = new Date(Date.UTC(wfYear, wfMonth + 1, 0)).getUTCDate();
            const wfStart = `${wfYear}-${String(wfMonth + 1).padStart(2, '0')}-01T00:00:00Z`;
            const wfEnd = `${wfYear}-${String(wfMonth + 1).padStart(2, '0')}-${String(lastDayOfWfMonth).padStart(2, '0')}T23:59:59Z`;
            generatedEvents.push({ name: 'World Finals', start: wfStart, end: wfEnd, isPlaceholder: true });
        }

        events = generatedEvents;
    }

    // Ensure all labels are translated/localized based on current language
    return events.map(event => {
        const hasDates = Boolean(event.start && event.end);
        const startDate = hasDates ? new Date(event.start) : null;
        const endDate = hasDates ? new Date(event.end) : null;
        return {
            ...event,
            label: (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()))
                ? formatSupercellEventsDate(startDate, endDate, locale)
                : (event.label || 'TBD')
        };
    });
}
