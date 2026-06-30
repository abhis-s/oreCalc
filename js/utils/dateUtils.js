import { state } from '../core/state.js';

export function getMinDate() {
    const now = new Date();
    const currentMonthNow = now.getMonth() + 1;
    const currentYearNow = now.getFullYear();

    const FLOOR_YEAR = 2026;
    const FLOOR_MONTH = 3;

    const minYear = Math.max(FLOOR_YEAR, currentYearNow);
    const minMonth = (currentYearNow > FLOOR_YEAR) ? currentMonthNow : Math.max(FLOOR_MONTH, currentMonthNow);
    
    return { year: minYear, month: minMonth };
}

export function getMaxDate() {
    const now = new Date();
    return { year: now.getFullYear() + 2, month: 12 };
}

export function getISOWeekNumber(d) {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);

    const isoYear = date.getUTCFullYear();

    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const yearStartDay = yearStart.getUTCDay() || 7;
    yearStart.setUTCDate(yearStart.getUTCDate() + 4 - yearStartDay);

    const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);

    return [isoYear, weekNo];
}

export function getDateOfWeek(w, y) {
    const d = (1 + (w - 1) * 7);
    return new Date(Date.UTC(y, 0, d));
}

export function isDateInRange(day, month, year, schedule) {
    const targetDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const { startDate, endDate } = getScheduleDates(year, month - 1, schedule);

    const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${year}-${month}-${day}`;
    };

    return getDatesInRange({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        isDateInRange: targetDate,
        month: month,
        year: year
    });
}

/**
 * Calculates the current maximum Town Hall level based on the date.
 * Supercell releases a new TH every 12 months in November.
 * Nov 2024: TH 17
 * Nov 2025: TH 18
 * Nov 2026: TH 19
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
 */
export function getTHReleaseDate(thLevel) {
    if (thLevel <= 17) return 2024;
    return 2024 + (thLevel - 17);
}

/**
 * Checks if a month is a valid event month for the 2x Star Bonus.
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

export function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function getWeeklyOccurrences(year, month, dateStart, dateEnd) {
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

export function getMonthlyOccurrences(year, month = null) {
    const today = new Date(Date.UTC());
    const currentMonth = today.getUTCMonth();
    const currentYear = today.getUTCFullYear();
    
    if (year === currentYear && month === currentMonth) {
        return 1;
    }
    return 1;
}

export function getBimonthlyOccurrences(year, month, availableMonths) {
    const today = new Date(Date.UTC());
    const currentMonth = today.getUTCMonth();
    const currentYear = today.getUTCFullYear();
    
    if (year === currentYear && month === currentMonth) {
        return 1;
    }

    return availableMonths[year] && availableMonths[year].includes(month + 1) ? 1 : 0;
}

export function addDays(date, days) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

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

export function getDateFromDayAndMonth(year, month, day) {
    return new Date(Date.UTC(year, month, day));
}

export function getDatesInRange(options = {}) {
    const { startDate: start, endDate: end, isDateInRange: targetDate, month, year } = options;
    
    const parseDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, day));
    };

    let startDate, endDate;

    if (start) {
        startDate = parseDate(start);
    } else {
        startDate = new Date(Date.UTC(year, month - 1, 1));
    }

    if (end) {
        endDate = parseDate(end);
    } else {
        const lastDay = getDaysInMonth(year, month - 1);
        endDate = new Date(Date.UTC(year, month - 1, lastDay));
    }

    if (targetDate) {
        const checkDate = parseDate(targetDate);
        return checkDate >= startDate && checkDate <= endDate;
    } else {
        const dates = [];
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const day = String(currentDate.getUTCDate()).padStart(2, '0');
            const monthStr = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
            const yearStr = currentDate.getUTCFullYear();
            dates.push(`${yearStr}-${monthStr}-${day}`);
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        return dates;
    }
}

export function findLastDayOfWeek(year, month, dayOfWeek) {
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
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {string}
 */
export function formatSupercellEventsDate(startDate, endDate) {
    const language = state.uiSettings?.language || 'en';
    const lang = language === 'de' ? 'de-DE' : 'en-US';
    const isGerman = language === 'de';
    
    // Check if it's a full month event (like World Finals often are in the schedule)
    const isFullMonth = startDate.getUTCDate() === 1 && 
                       (endDate.getUTCDate() >= 28 || (endDate.getUTCMonth() !== startDate.getUTCMonth()));

    if (isFullMonth) {
        return startDate.toLocaleString(lang, { month: 'long', timeZone: 'UTC' });
    }

    const startMonth = startDate.toLocaleString(lang, { month: 'short', timeZone: 'UTC' });
    const startDay = startDate.getUTCDate();
    const endDay = endDate.getUTCDate();

    if (startDate.getUTCMonth() === endDate.getUTCMonth()) {
        if (startDay === endDay) {
            return isGerman ? `${startDay}. ${startMonth}` : `${startMonth} ${startDay}`;
        }
        // e.g., "Jun 27, 28" or "27., 28. Jun"
        return isGerman ? `${startDay}., ${endDay}. ${startMonth}` : `${startMonth} ${startDay}, ${endDay}`;
    } else {
        const endMonth = endDate.toLocaleString(lang, { month: 'short', timeZone: 'UTC' });
        // e.g., "Oct 31 - Nov 2" or "31. Okt - 2. Nov"
        return isGerman ? 
            `${startDay}. ${startMonth} - ${endDay}. ${endMonth}` : 
            `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
}

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

        // 1. Monthly Finals: Last Sat-Sun pair of each month
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

        // 2. Last Chance Qualifier: Sat-Sun, 2 weeks after the last Monthly Finals
        if (eventTemplates['Last Chance Qualifier'] && lastMonthlyFinalsDate) {
            const lcqSaturday = addDays(lastMonthlyFinalsDate, 13); // 2 weeks after (Sat is 13 days after the previous Sun)
            const lcqSunday = addDays(lcqSaturday, 1);
            const startStr = `${lcqSaturday.getUTCFullYear()}-${String(lcqSaturday.getUTCMonth() + 1).padStart(2, '0')}-${String(lcqSaturday.getUTCDate()).padStart(2, '0')}T16:00:00Z`;
            const endStr = `${lcqSunday.getUTCFullYear()}-${String(lcqSunday.getUTCMonth() + 1).padStart(2, '0')}-${String(lcqSunday.getUTCDate()).padStart(2, '0')}T23:00:00Z`;
            
            generatedEvents.push({ name: 'Last Chance Qualifier', start: startStr, end: endStr });
        }

        // 3. World Finals: Next month of LCQ
        if (eventTemplates['World Finals'] && lastMonthlyFinalsDate) {
            const lcqMonth = lastMonthlyFinalsDate.getUTCMonth() + 1;
            const wfYear = year;
            const wfMonth = (lcqMonth + 1) % 12;
            const wfStart = `${wfYear}-${String(wfMonth + 1).padStart(2, '0')}-01T00:00:00Z`;
            const wfEnd = `${wfYear}-${String(wfMonth + 1).padStart(2, '0')}-30T23:59:59Z`; // Approximation
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

export function getScheduleDates(year, month, schedule, instance = 1) {
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