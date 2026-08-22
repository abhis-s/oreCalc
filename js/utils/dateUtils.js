import { getLocale, getWeekStart } from '../data/languagesData.js';

const dateTimeFormatCache = new Map();

/**
 * Retrieves a cached Intl.DateTimeFormat instance.
 *
 * @param {string} locale - Locale identifier.
 * @param {Intl.DateTimeFormatOptions} [options] - Formatting options.
 * @returns {Intl.DateTimeFormat} Formatter instance.
 */
function getCachedDateTimeFormat(locale, options) {
    const key = options ? `${locale}|${JSON.stringify(options)}` : locale;
    let formatter = dateTimeFormatCache.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, options);
        dateTimeFormatCache.set(key, formatter);
    }
    return formatter;
}

/**
 * Formats a date using localized formatting options.
 *
 * @param {Date} date - Date to format.
 * @param {Intl.DateTimeFormatOptions} [options] - Formatting options.
 * @param {string} [locale='en'] - UI language locale.
 * @returns {string} Formatted date string.
 */
export function formatDate(date, options, locale = 'en') {
    const effectiveLocale = getLocale(locale);
    return getCachedDateTimeFormat(effectiveLocale, options).format(date);
}

/**
 * Returns localized short day names starting on the configured first day of week.
 *
 * @param {string} [startDaySetting='auto'] - First day preference ('auto' | 'monday' | 'sunday' | etc.).
 * @param {string} [locale='en'] - UI language code.
 * @returns {string[]} Ordered list of 7 short weekday names.
 */
export function getShortDayNames(startDaySetting = 'auto', locale = 'en') {
    const effectiveLocale = getLocale(locale);
    const formatter = getCachedDateTimeFormat(effectiveLocale, { weekday: 'short' });

    let effectiveStartDay = startDaySetting;
    if (effectiveStartDay === 'auto') {
        effectiveStartDay = getWeekStart(locale);
    }

    let startDayIndex = 0;
    if (effectiveStartDay === 'monday') startDayIndex = 1;
    else if (effectiveStartDay === 'tuesday') startDayIndex = 2;
    else if (effectiveStartDay === 'friday') startDayIndex = 5;
    else if (effectiveStartDay === 'saturday') startDayIndex = 6;

    const days = [];
    for (let i = 0; i < 7; i++) {
        // Jan 2, 2000 was a Sunday
        const date = new Date(Date.UTC(2000, 0, 2 + startDayIndex + i));
        days.push(formatter.format(date));
    }
    return days;
}

/**
 * Returns minimum allowable calendar date bounds.
 *
 * @returns {{ year: number, month: number }} Minimum year and month (1-12).
 */
export function getMinDate() {
    const now = new Date();
    const currentMonthNow = now.getMonth() + 1;
    const currentYearNow = now.getFullYear();

    const FLOOR_YEAR = 2026;
    const FLOOR_MONTH = 7;

    const minYear = Math.max(FLOOR_YEAR, currentYearNow);
    const minMonth = (currentYearNow > FLOOR_YEAR) ? currentMonthNow : Math.max(FLOOR_MONTH, currentMonthNow);

    return { year: minYear, month: minMonth };
}

/**
 * Returns maximum allowable calendar date bounds.
 *
 * @returns {{ year: number, month: number }} Maximum year and month (1-12).
 */
export function getMaxDate() {
    const now = new Date();
    return { year: now.getFullYear() + 2, month: 12 };
}

/**
 * Calculates ISO 8601 week number and ISO year for a given date.
 *
 * @param {Date} d - Date to inspect.
 * @returns {[number, number]} [isoYear, isoWeekNumber].
 */
export function getISOWeekNumber(d) {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);

    const isoYear = date.getUTCFullYear();
    const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
    const firstThursdayDay = firstThursday.getUTCDay() || 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() + 4 - firstThursdayDay);

    const weekNo = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));

    return [isoYear, weekNo];
}

/**
 * Returns the UTC Date for Monday of a given ISO week number and year.
 *
 * @param {number} week - ISO week number (1-53).
 * @param {number} year - ISO week year.
 * @returns {Date} Date instance set to UTC midnight on Monday of the specified ISO week.
 */
export function getDateOfWeek(week, year) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = (jan4.getUTCDay() + 6) % 7;
    const mondayWeek1Time = jan4.getTime() - dayOfWeek * 86400000;
    return new Date(mondayWeek1Time + (week - 1) * 7 * 86400000);
}

/**
 * Calculates the current maximum Town Hall level based on the date.
 * Supercell releases a new TH every 12 months in November.
 * Nov 2024: TH 17
 * Nov 2025: TH 18
 * Nov 2026: TH 19
 *
 * @param {Date} [date=new Date()] - Date to evaluate.
 * @returns {number} Maximum Town Hall level.
 */
export function getMaxTownHall(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1; // 1-12
    let maxTH = 17 + (year - 2024);
    if (month < 11) maxTH -= 1;
    return maxTH;
}

/**
 * Returns the predicted release year for a given Town Hall level.
 *
 * @param {number} thLevel - Town Hall level.
 * @returns {number} Release year.
 */
export function getTHReleaseDate(thLevel) {
    if (thLevel <= 17) return 2024;
    return 2024 + (thLevel - 17);
}

/**
 * Checks if a month is a valid event month for the 2x Star Bonus.
 * @param {number} month - 1-indexed calendar month (1-12).
 * @param {number} year - 4-digit calendar year.
 * @param {number} frequency - Event periodicity in months.
 * @param {number} lastMonth - Anchor month (1-12).
 * @param {number} lastYear - Anchor year.
 * @returns {boolean} Whether event occurs in the given month.
 */
export function isStarBonusEventMonth(month, year, frequency, lastMonth, lastYear) {
    if (frequency === 1) return true;
    if (lastMonth === undefined || lastYear === undefined) return false;

    const monthDiff = (year - lastYear) * 12 + (month - lastMonth);
    return monthDiff >= 0 && monthDiff % frequency === 0;
}

/**
 * Returns the valid placement window for the 2x Star Bonus event.
 * Window: First full week (starts on first Monday) to the end of the month.
 * @param {number} month - 0-indexed calendar month (0-11).
 * @param {number} year - 4-digit calendar year.
 * @returns {{ start: Date, end: Date }} Start and end date window.
 */
export function getStarBonus2xWindow(month, year) {
    // First Monday of the month
    let firstMonday = 1;
    const firstDay = new Date(Date.UTC(year, month, 1));
    const firstDayOfWeek = firstDay.getUTCDay(); // 0=Sun, 1=Mon...

    if (firstDayOfWeek === 0) { // Sunday
        firstMonday = 2;
    } else if (firstDayOfWeek > 1) { // Tue-Sat
        firstMonday = 1 + (8 - firstDayOfWeek);
    }

    const start = new Date(Date.UTC(year, month, firstMonday));
    const end = new Date(Date.UTC(year, month, getDaysInMonth(year, month)));

    return { start, end };
}

/**
 * Returns the total days count in a month.
 * @param {number} year - 4-digit calendar year.
 * @param {number} month - 0-indexed calendar month (0-11).
 * @returns {number} Days in month (28-31).
 */
export function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Counts weekly day occurrences in a month.
 * @param {number} year - 4-digit calendar year.
 * @param {number} month - 0-indexed calendar month (0-11).
 * @param {number} dateStart - Target day of week (0=Sun, 1=Mon...).
 * @returns {number} Occurrence count.
 */
export function getWeeklyOccurrences(year, month, dateStart) {
    let count = 0;
    const daysInMonth = getDaysInMonth(year, month);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month, day));
        const dayOfWeek = date.getUTCDay();
        if (dayOfWeek === dateStart) {
            count++;
        }
    }
    return count;
}

/**
 * Returns monthly occurrences multiplier.
 * @returns {number} 1.
 */
export function getMonthlyOccurrences() {
    return 1;
}

/**
 * Checks bimonthly schedule occurrence in a month.
 * @param {number} year - 4-digit calendar year.
 * @param {number} month - 0-indexed calendar month (0-11).
 * @param {Record<string, number[]>} [availableMonths] - Map of years to active month arrays.
 * @returns {number} 1 if active, 0 otherwise.
 */
export function getBimonthlyOccurrences(year, month, availableMonths) {
    if (!availableMonths) return 0;
    return availableMonths[year] && availableMonths[year].includes(month + 1) ? 1 : 0;
}

/**
 * Adds an offset in days to a Date object.
 * @param {Date | string | number} date - Base date.
 * @param {number} days - Days to add.
 * @returns {Date} Resulting date.
 */
export function addDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

/**
 * Finds the nth occurrence of a day of the week in a month.
 * @param {number} year - 4-digit calendar year.
 * @param {number} month - 0-indexed calendar month (0-11).
 * @param {number} dayOfWeek - Day of week (0=Sun, 1=Mon...).
 * @param {number} n - Nth occurrence index (1-based).
 * @returns {Date | null} Matching date or null.
 */
export function findNthDayOfWeek(year, month, dayOfWeek, n) {
    let occurrenceCount = 0;
    const daysInMonth = getDaysInMonth(year, month);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month, day));
        if (date.getUTCDay() === dayOfWeek) {
            occurrenceCount++;
            if (occurrenceCount === n) {
                return date;
            }
        }
    }
    return null;
}

/**
 * Creates a UTC Date from year, month, and day components.
 * @param {number} year - 4-digit calendar year.
 * @param {number} month - 0-indexed calendar month (0-11).
 * @param {number} day - Day of month (1-31).
 * @returns {Date} UTC Date.
 */
export function getDateFromDayAndMonth(year, month, day) {
    return new Date(Date.UTC(year, month, day));
}

/**
 * Finds the last occurrence of a day of the week in a month.
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
 * @param {Date} startDate - Event start UTC date.
 * @param {Date} endDate - Event end UTC date.
 * @param {string} [locale='en'] - UI language locale.
 * @returns {string} Formatted range string.
 */
function formatSupercellEventsDate(startDate, endDate, locale = 'en') {
    const effectiveLocale = getLocale(locale);
    const isDayFirst = locale !== 'en';

    // Check if it's a full month event (like World Finals often are in the schedule)
    const isFullMonth = startDate.getUTCDate() === 1 &&
                       (endDate.getUTCDate() >= 28 || (endDate.getUTCMonth() !== startDate.getUTCMonth()));

    if (isFullMonth) {
        return startDate.toLocaleString(locale, { month: 'long', timeZone: 'UTC' });
    }

    const startMonth = startDate.toLocaleString(locale, { month: 'short', timeZone: 'UTC' });
    const startDay = startDate.getUTCDate();
    const endDay = endDate.getUTCDate();

    if (startDate.getUTCMonth() === endDate.getUTCMonth()) {
        if (startDay === endDay) {
            return isDayFirst ? `${startDay} ${startMonth}` : `${startMonth} ${startDay}`;
        }
        // e.g., "Jun 27, 28" or "27-28 Jun"
        return isDayFirst ? `${startDay}-${endDay} ${startMonth}` : `${startMonth} ${startDay}, ${endDay}`;
    } else {
        const endMonth = endDate.toLocaleString(locale, { month: 'short', timeZone: 'UTC' });
        // e.g., "Oct 31 - Nov 2" or "31. Okt - 2. Nov"
        return isDayFirst ?
            `${startDay} ${startMonth} - ${endDay} ${endMonth}` :
            `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
}

/**
 * Generates and formats official Supercell Championship events for a given year.
 *
 * @param {number} year - Year to evaluate.
 * @param {any} supercellEventsData - Source tournament schedule metadata.
 * @returns {any[]} List of event objects with dates and localized labels.
 */
export function getSupercellEventsForYear(year, supercellEventsData) {
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

        let lastMonthlyFinalsDate = null;

        if (eventTemplates['Monthly Finals']) {
            eventTemplates['Monthly Finals'].forEach(month => {
                const lastSunday = findLastDayOfWeek(year, month, 0); // 0 = Sunday
                if (lastSunday) {
                    const lastSaturday = addDays(lastSunday, -1);
                    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastSaturday.getUTCDate()).padStart(2, '0')}T16:00:00Z`;
                    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastSunday.getUTCDate()).padStart(2, '0')}T23:00:00Z`;

                    generatedEvents.push({ name: 'Monthly Finals', start: startStr, end: endStr });
                    lastMonthlyFinalsDate = lastSunday;
                }
            });
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
            generatedEvents.push({ name: 'World Finals', start: wfStart, end: wfEnd });
        }

        events = generatedEvents;
    }

    // Ensure all labels are translated/localized based on current language
    return events.map(event => ({
        ...event,
        label: formatSupercellEventsDate(new Date(event.start), new Date(event.end))
    }));
}

/**
 * Resolves dates or date ranges matching an income schedule pattern within a given month.
 * @param {number} year - 4-digit calendar year.
 * @param {number} month - 0-indexed calendar month (0-11).
 * @param {any} schedule - Schedule configuration object.
 * @returns {any[]} Array of Date instances or date range pairs.
 */
export function getScheduleDates(year, month, schedule) {
    const dates = [];
    const daysInMonth = getDaysInMonth(year, month);

    switch (schedule.type) {
        case 'daily':
            for (let day = 1; day <= daysInMonth; day++) {
                dates.push(new Date(Date.UTC(year, month, day)));
            }
            break;
        case 'monthly':
        case 'custom':
            if (schedule.dateStart) {
                let endDate = schedule.dateEnd || (schedule.availableTillEndOfMonth ? daysInMonth : schedule.dateStart);
                for (let day = schedule.dateStart; day <= endDate; day++) {
                    dates.push(new Date(Date.UTC(year, month, day)));
                }
            }
            break;
        case 'bimonthly':
            if (schedule.availableMonths && schedule.availableMonths[year] && schedule.availableMonths[year].includes(month + 1)) {
                if (schedule.dateStart) {
                    let endDate = schedule.dateEnd || (schedule.availableTillEndOfMonth ? daysInMonth : schedule.dateStart);
                    for (let day = schedule.dateStart; day <= endDate; day++) {
                        dates.push(new Date(Date.UTC(year, month, day)));
                    }
                }
            }
            break;
        case 'weekly':
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(Date.UTC(year, month, day));
                if (date.getUTCDay() === schedule.dateStart) {
                    const startDate = date;
                    const endDate = addDays(startDate, (schedule.dateEnd - schedule.dateStart + 7) % 7);
                    dates.push({ startDate, endDate });
                }
            }
            break;
    }
    return dates;
}

/**
 * Extracts the start Date instance from a schedule date entry or date range object.
 * Returns dateOrRange.startDate if present, otherwise returns dateOrRange directly.
 *
 * @param {Date | { startDate: Date, endDate: Date } | any} dateOrRange - Date instance or schedule date range object.
 * @returns {Date | any} The extracted start Date instance or original object.
 */
export function extractScheduleStartDate(dateOrRange) {
    if (!dateOrRange) return dateOrRange;
    if (dateOrRange.startDate) {
        return dateOrRange.startDate;
    }
    return dateOrRange;
}
