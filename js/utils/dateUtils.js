import { getLocale, getWeekStart } from '../data/languagesData.js';

const dateTimeFormatCache = new Map();
let defaultDateLocale = 'en';

/**
 * Sets the default date locale for formatting throughout the application.
 *
 * @param {string} locale - UI language or locale identifier.
 */
export function setDefaultDateLocale(locale) {
    if (typeof locale === 'string' && locale.trim()) {
        defaultDateLocale = locale.trim();
    }
}

/**
 * Returns the current default date locale.
 *
 * @returns {string} Current default date locale code.
 */
export function getDefaultDateLocale() {
    return defaultDateLocale;
}

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

const DEFAULT_DATE_FORMAT_OPTIONS = Object.freeze({
    day: 'numeric',
    month: 'short',
    year: 'numeric'
});

/**
 * Normalizes DateTimeFormat options to enforce unambiguous textual month formatting
 * and strictly prevent numeric MM-DD or DD-MM representations.
 *
 * @param {Intl.DateTimeFormatOptions} [options] - Input formatting options.
 * @returns {Intl.DateTimeFormatOptions} Normalized formatting options.
 */
function normalizeDateOptions(options) {
    if (!options) {
        return DEFAULT_DATE_FORMAT_OPTIONS;
    }

    const normalized = { ...options };

    // Prevent locale-specific numeric dateStyle (e.g. de-DE outputting 25.09.2026 for medium)
    if (normalized.dateStyle === 'short' || normalized.dateStyle === 'medium') {
        const isShort = normalized.dateStyle === 'short';
        delete normalized.dateStyle;
        if (!normalized.month) normalized.month = 'short';
        if (!normalized.day) normalized.day = 'numeric';
        if (!normalized.year) normalized.year = isShort ? '2-digit' : 'numeric';
    }

    // If day is displayed, enforce textual month (short or long), never numeric or omitted
    if (normalized.day) {
        if (!normalized.month || normalized.month === 'numeric' || normalized.month === '2-digit') {
            normalized.month = 'short';
        }
    }

    return normalized;
}

/**
 * Formats a date using localized formatting options.
 *
 * @param {Date} date - Date to format.
 * @param {Intl.DateTimeFormatOptions} [options] - Formatting options.
 * @param {string} [locale=defaultDateLocale] - UI language locale.
 * @returns {string} Formatted date string.
 */
export function formatDate(date, options, locale = defaultDateLocale) {
    const effectiveLocale = getLocale(locale || defaultDateLocale);
    const effectiveOptions = normalizeDateOptions(options);
    return getCachedDateTimeFormat(effectiveLocale, effectiveOptions).format(date);
}

/**
 * Formats a date range using localized formatting options.
 *
 * @param {Date} startDate - Range start date.
 * @param {Date} endDate - Range end date.
 * @param {Intl.DateTimeFormatOptions} [options] - Formatting options.
 * @param {string} [locale=defaultDateLocale] - UI language locale.
 * @returns {string} Formatted date range string.
 */
export function formatDateRange(startDate, endDate, options, locale = defaultDateLocale) {
    const effectiveLocale = getLocale(locale || defaultDateLocale);
    const effectiveOptions = normalizeDateOptions(options);
    const formatter = getCachedDateTimeFormat(effectiveLocale, effectiveOptions);
    if (typeof formatter.formatRange === 'function') {
        return formatter.formatRange(startDate, endDate);
    }
    return formatter.format(startDate);
}

/**
 * Returns localized short day names starting on the configured first day of week.
 *
 * @param {string} [startDaySetting='auto'] - First day preference ('auto' | 'monday' | 'sunday' | etc.).
 * @param {string} [locale=defaultDateLocale] - UI language code.
 * @returns {string[]} Ordered list of 7 short weekday names.
 */
export function getShortDayNames(startDaySetting = 'auto', locale = defaultDateLocale) {
    const effectiveLocale = getLocale(locale || defaultDateLocale);
    const formatter = getCachedDateTimeFormat(effectiveLocale, { weekday: 'short' });

    let effectiveStartDay = startDaySetting;
    if (effectiveStartDay === 'auto') {
        effectiveStartDay = getWeekStart(locale || defaultDateLocale);
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

/**
 * Formats an ISO date string (YYYY-MM-DD) into a localized UTC date representation.
 *
 * @param {string} isoDateStr - ISO date string.
 * @param {string} [language] - UI language locale code (defaults to current date locale).
 * @returns {string} Formatted localized date string.
 */
export function formatRegionalDate(isoDateStr, language = defaultDateLocale) {
    if (!isoDateStr) return '';
    try {
        const parts = isoDateStr.split('-');
        if (parts.length !== 3) return isoDateStr;
        const [year, month, day] = parts.map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return getCachedDateTimeFormat(language || defaultDateLocale || 'en', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC'
        }).format(date);
    } catch {
        return isoDateStr;
    }
}

/**
 * Formats the application build or deployment timestamp according to the specified locale.
 *
 * @param {string} [locale=defaultDateLocale] - UI language or locale identifier.
 * @returns {string} Formatted localized date string.
 */
export function getAppLastUpdatedDateFormatted(locale = defaultDateLocale) {
    let dateObj;
    const swUpdateTime = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('oreCalc_SWUpdatedTime') || localStorage.getItem('oreCalcSWUpdatedTime'))
        : null;
    if (swUpdateTime) {
        dateObj = new Date(swUpdateTime);
    }
    if (!dateObj || isNaN(dateObj.getTime())) {
        const buildTime = typeof window !== 'undefined'
            ? window.__ENV__?.BUILD_TIME
            : (typeof __ENV__ !== 'undefined' ? __ENV__.BUILD_TIME : null);
        if (buildTime) {
            dateObj = new Date(buildTime);
        }
    }
    if (!dateObj || isNaN(dateObj.getTime())) {
        dateObj = new Date();
    }
    return formatDate(dateObj, {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }, locale || defaultDateLocale || 'en');
}
