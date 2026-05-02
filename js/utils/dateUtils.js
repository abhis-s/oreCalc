import { state } from '../core/state.js';

export function isDateInRange(day, month, year, schedule) {
    const targetDate = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
    const { startDate, endDate } = getScheduleDates(year, month - 1, schedule);

    const formatDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}-${month}-${year}`;
    };

    return getDatesInRange({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        isDateInRange: targetDate,
        month: month,
        year: year
    });
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
        const [day, month, year] = dateStr.split('-').map(Number);
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
            dates.push(`${day}-${monthStr}-${yearStr}`);
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

export function getChampionshipEventsForYear(year, championshipData) {
    if (championshipData.events && championshipData.events[year]) {
        return championshipData.events[year];
    }

    // Fallback logic
    const availableYears = Object.keys(championshipData.events).map(Number).sort((a, b) => b - a);
    const lastYear = availableYears.find(y => y < year) || availableYears[0];
    if (!lastYear) return [];

    const lastYearEvents = championshipData.events[lastYear];
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
                const label = `${lastSaturday.toLocaleString('default', { month: 'short', timeZone: 'UTC' })} ${lastSaturday.getUTCDate()}, ${lastSunday.getUTCDate()}`;
                
                generatedEvents.push({ name: 'Monthly Finals', start: startStr, end: endStr, label: label });
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
        const label = `${lcqSaturday.toLocaleString('default', { month: 'short', timeZone: 'UTC' })} ${lcqSaturday.getUTCDate()}, ${lcqSunday.getUTCDate()}`;
        
        generatedEvents.push({ name: 'Last Chance Qualifier', start: startStr, end: endStr, label: label });
    }

    // 3. World Finals: Next month of LCQ, dates mostly undecided
    if (eventTemplates['World Finals'] && lastMonthlyFinalsDate) {
        // Find the LCQ month or just the next month after lastMonthlyFinals
        const lastEvent = generatedEvents[generatedEvents.length - 1];
        const lastEventDate = lastEvent ? new Date(lastEvent.end) : lastMonthlyFinalsDate;
        const wfMonth = lastEventDate.getUTCMonth() + 1;
        const wfYear = lastEventDate.getUTCFullYear() + (wfMonth > 11 ? 1 : 0);
        const actualWfMonth = wfMonth % 12;

        const startStr = `${wfYear}-${String(actualWfMonth + 1).padStart(2, '0')}-01T00:00:00Z`;
        const endStr = `${wfYear}-${String(actualWfMonth + 1).padStart(2, '0')}-30T23:59:59Z`; // Approximation
        const label = new Date(wfYear, actualWfMonth).toLocaleString('default', { month: 'long', timeZone: 'UTC' });

        generatedEvents.push({ name: 'World Finals', start: startStr, end: endStr, label: label });
    }

    return generatedEvents;
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