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
        case 'bimonthly':
        case 'custom':
            if (schedule.dateStart) {
                let endDate = schedule.dateEnd || (schedule.availableTillEndOfMonth ? daysInMonth : schedule.dateStart);
                for (let day = schedule.dateStart; day <= endDate; day++) {
                    dates.push(new Date(Date.UTC(year, month, day)));
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