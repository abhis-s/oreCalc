export function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

export function getWeeklyOccurrences(year, month, dateStart, dateEnd) {
    let count = 0;
    const daysInMonth = getDaysInMonth(year, month);

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(Date.UTC(year, month, day));
        const dayOfWeek = date.getUTCDay(); // 0 for Sunday, 1 for Monday, etc.
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

    // Temporarily ignore start and end dates for rendering purposes
    if (year === currentYear && month === currentMonth) {
        return 1;
    }
    return 1;
}

export function getBimonthlyOccurrences(year, month, availableMonths) {
    const today = new Date(Date.UTC());
    const currentMonth = today.getUTCMonth();
    const currentYear = today.getUTCFullYear();

    // Temporarily ignore availableMonths for rendering purposes
    if (year === currentYear && month === currentMonth) {
        return 1;
    }

    return availableMonths[year] && availableMonths[year].includes(month + 1) ? 1 : 0;
}

export function getDatesInRange(options = {}) {
    const { startDate: start, endDate: end, isDateInRange: targetDate, month, year } = options;

    // Helper to parse DD-MM-YYYY
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

export function getScheduleDates(year, month, schedule, instance = 1) {
    const result = { startDate: null, endDate: null };
    const daysInMonth = getDaysInMonth(year, month);

    switch (schedule.type) {
        case 'daily':
            result.startDate = new Date(Date.UTC(year, month, 1));
            result.endDate = new Date(Date.UTC(year, month, daysInMonth));
            break;
        case 'monthly':
        case 'bimonthly':
        case 'custom':
            if (schedule.dateStart) {
                result.startDate = new Date(Date.UTC(year, month, schedule.dateStart));
                if (schedule.dateEnd) {
                    result.endDate = new Date(Date.UTC(year, month, schedule.dateEnd));
                } else if (schedule.availableTillEndOfMonth) {
                    result.endDate = new Date(Date.UTC(year, month, daysInMonth));
                }
            }
            break;
        case 'weekly':
            let occurrenceCount = 0;
            let currentDay = 1;
            let foundStartDate = null;

            while (currentDay <= daysInMonth) {
                const date = new Date(Date.UTC(year, month, currentDay));
                if (date.getUTCDay() === schedule.dateStart) {
                    occurrenceCount++;
                    if (occurrenceCount === instance) {
                        foundStartDate = date;
                        break;
                    }
                }
                currentDay++;
            }

            if (foundStartDate) {
                result.startDate = foundStartDate;
                const endDate = new Date(Date.UTC(foundStartDate.getUTCFullYear(), foundStartDate.getUTCMonth(), foundStartDate.getUTCDate()));
                if (schedule.dateStart <= schedule.dateEnd) {
                    endDate.setUTCDate(foundStartDate.getUTCDate() + (schedule.dateEnd - schedule.dateStart));
                } else {
                    endDate.setUTCDate(foundStartDate.getUTCDate() + (7 - schedule.dateStart + schedule.dateEnd));
                }
                result.endDate = endDate;
            } else {
                console.log(`Weekly - Instance ${instance} not found for schedule.dateStart: ${schedule.dateStart} in month ${month}`);
            }
            break;
    }
    return result;
}