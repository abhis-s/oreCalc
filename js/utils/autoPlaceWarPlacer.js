import { incomeData } from '../data/incomeSourceRegistry.js';
import { state } from '../core/state.js';
import { addDays, extractScheduleStartDate, getDateFromDayAndMonth, getDaysInMonth, getScheduleDates } from './dateUtils.js';

/**
 * Checks whether a given chip id matches an income type.
 *
 * @param {string} id
 * @param {string} type
 * @returns {boolean}
 */
export function idMatchesType(id, type) {
    const cleanId = id.replace(/^custom-/, '');
    return cleanId.startsWith(type);
}

/**
 * Automatically places unplaced CWL chips for a given month.
 *
 * @param {Array<Object>} cwlChipsToPlaceActual
 * @param {number} currentYear
 * @param {number} currentMonth
 * @param {string} monthYearKey
 * @param {Object} newCalendarDates
 * @param {Set<string>} placedByHistory
 */
export function autoPlaceCwlChips(cwlChipsToPlaceActual, currentYear, currentMonth, monthYearKey, newCalendarDates, placedByHistory) {
    if (cwlChipsToPlaceActual.length === 0) return;

    const cwlSchedule = incomeData.cwl.schedule;
    const idealCwlDates = getScheduleDates(currentYear, currentMonth, cwlSchedule);
    const idealCwlDateStrings = idealCwlDates.map(d => extractScheduleStartDate(d).toISOString().split('T')[0]);

    const placedCwlDates = new Set();
    for (const day in newCalendarDates[monthYearKey]) {
        const chipsOnDay = newCalendarDates[monthYearKey][day];
        if (chipsOnDay.some(id => idMatchesType(id, 'cwl-'))) {
            const dateStr = getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10)).toISOString().split('T')[0];
            placedCwlDates.add(dateStr);
        }
    }

    const gapDates = idealCwlDateStrings.filter(d => !placedCwlDates.has(d));

    let placedCount = 0;
    for (const gapDateStr of gapDates) {
        if (placedCount >= cwlChipsToPlaceActual.length) break;

        const chipToPlace = cwlChipsToPlaceActual[placedCount];
        const targetDate = new Date(gapDateStr);
        const targetDay = targetDate.getUTCDate();
        const paddedTargetDay = String(targetDay).padStart(2, '0');

        const newChipId = `${chipToPlace.type}-${String(chipToPlace.instance).padStart(2, '0')}-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-cal-auto`;

        if (!newCalendarDates[monthYearKey][paddedTargetDay]) {
            newCalendarDates[monthYearKey][paddedTargetDay] = [];
        }

        const hasConflict = newCalendarDates[monthYearKey][paddedTargetDay].some(id => idMatchesType(id, 'cwl-'));
        if (!hasConflict) {
            newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
            placedByHistory.add(chipToPlace.type + '-' + chipToPlace.instance);
            placedCount++;
        }
    }

    if (placedCount < cwlChipsToPlaceActual.length) {
        let lastCwlDate = idealCwlDates.length > 0 ? idealCwlDates[idealCwlDates.length - 1] : new Date(Date.UTC(currentYear, currentMonth, 1));
        for (const day in newCalendarDates[monthYearKey]) {
            if (newCalendarDates[monthYearKey][day].some(id => idMatchesType(id, 'cwl-'))) {
                const date = getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10));
                if (date > lastCwlDate) lastCwlDate = date;
            }
        }

        let appendDate = addDays(lastCwlDate, 1);
        while (placedCount < cwlChipsToPlaceActual.length && appendDate.getUTCMonth() === currentMonth) {
            const chipToPlace = cwlChipsToPlaceActual[placedCount];
            const targetDay = appendDate.getUTCDate();
            const paddedTargetDay = String(targetDay).padStart(2, '0');
            const newChipId = `${chipToPlace.type}-${String(chipToPlace.instance).padStart(2, '0')}-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-cal-auto`;

            if (!newCalendarDates[monthYearKey][paddedTargetDay]) newCalendarDates[monthYearKey][paddedTargetDay] = [];
            const hasConflict = newCalendarDates[monthYearKey][paddedTargetDay].some(id => idMatchesType(id, 'cwl-'));
            if (!hasConflict) {
                newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
                placedByHistory.add(chipToPlace.type + '-' + chipToPlace.instance);
                placedCount++;
            }
            appendDate = addDays(appendDate, 1);
        }
    }
}

/**
 * Automatically places unplaced Clan War chips for a given month.
 * @param {Array<Object>} allClanWarChips
 * @param {number} currentYear
 * @param {number} currentMonth
 * @param {string} monthYearKey
 * @param {Object} newCalendarDates
 * @param {number} historyLookbackMonths
 * @param {Set<string>} placedByHistory
 */
export function autoPlaceClanWarChips(allClanWarChips, currentYear, currentMonth, monthYearKey, newCalendarDates, historyLookbackMonths, placedByHistory) {
    const warsToPlaceCount = allClanWarChips.length;
    if (warsToPlaceCount === 0) return;

    let currentEarliestStartDate = null;
    let earliestStartDateCandidate = null;
    const totalClanWar = incomeData.clanWar.getCount(state);

    if (totalClanWar < 12) {
        let historicalStartDateFound = false;
        for (let m = 1; m <= historyLookbackMonths && !historicalStartDateFound; m++) {
            const lookbackDate = new Date(Date.UTC(currentYear, currentMonth - m, 1));
            const lookbackMonth = lookbackDate.getUTCMonth();
            const lookbackYear = lookbackDate.getUTCFullYear();
            const lbKey = `${lookbackYear}-${String(lookbackMonth + 1).padStart(2, '0')}`;
            const searchDates = newCalendarDates[lbKey] || state.planner.calendar.dates[lbKey];

            if (searchDates) {
                for (const day in searchDates) {
                    if (searchDates[day].some(id => idMatchesType(id, 'clanWar-01-'))) {
                        earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10));
                        historicalStartDateFound = true;
                        break;
                    }
                }
            }
        }
    }

    if (!earliestStartDateCandidate) {
        if (totalClanWar >= 12) {
            earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, 4);
        } else {
            let firstCwlChipDate = null;
            const placedCwlDatesInMonth = [];
            for (const day in newCalendarDates[monthYearKey]) {
                newCalendarDates[monthYearKey][day].forEach(chipId => {
                    if (idMatchesType(chipId, 'cwl-')) placedCwlDatesInMonth.push(getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10)));
                });
            }
            if (placedCwlDatesInMonth.length > 0) {
                placedCwlDatesInMonth.sort((a, b) => a.getTime() - b.getTime());
                firstCwlChipDate = placedCwlDatesInMonth[0];
            }
            if (firstCwlChipDate) {
                const cwlStartPlus8 = incomeData.cwl.schedule.dateStart + 8;
                const cwlEndPlus1 = incomeData.cwl.schedule.dateEnd + 1;
                const lastCwlInstanceDate = placedCwlDatesInMonth[placedCwlDatesInMonth.length - 1];
                const lastCwlPlus2 = lastCwlInstanceDate.getUTCDate() + 2;
                let calculatedDay = lastCwlPlus2 <= cwlStartPlus8 ? cwlStartPlus8 : cwlEndPlus1;
                earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, calculatedDay);
            } else {
                earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, incomeData.clanWar.schedule.dateStart);
            }
        }
    }
    currentEarliestStartDate = earliestStartDateCandidate;

    const blockedDates = new Set();
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const minSpacing = incomeData.clanWar.minReoccurrenceDays;
    for (let i = 1; i < currentEarliestStartDate.getUTCDate(); i++) blockedDates.add(i);

    const currentManuallyPlacedWarDates = [];
    if (newCalendarDates[monthYearKey]) {
        for (const day in newCalendarDates[monthYearKey]) {
            if (newCalendarDates[monthYearKey][day].some(id => idMatchesType(id, 'clanWar-'))) currentManuallyPlacedWarDates.push(getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10)));
        }
    }
    currentManuallyPlacedWarDates.forEach(date => {
        const day = date.getUTCDate();
        blockedDates.add(day);
        for (let i = 1; i < minSpacing; i++) {
            if (day - i > 0) blockedDates.add(day - i);
            if (day + i <= daysInMonth) blockedDates.add(day + i);
        }
    });

    let placedCount = 0;
    let searchStartDate = currentEarliestStartDate.getUTCDate();
    while (placedCount < warsToPlaceCount && searchStartDate <= daysInMonth) {
        let placementDay = -1;
        for (let d = searchStartDate; d <= daysInMonth; d++) {
            if (!blockedDates.has(d)) {
                placementDay = d;
                break;
            }
        }
        if (placementDay === -1) break;

        const chipToPlace = allClanWarChips[placedCount];
        const newChipId = `${chipToPlace.type}-${String(chipToPlace.instance).padStart(2, '0')}-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-cal-auto`;
        const paddedDay = String(placementDay).padStart(2, '0');
        if (!newCalendarDates[monthYearKey][paddedDay]) newCalendarDates[monthYearKey][paddedDay] = [];
        newCalendarDates[monthYearKey][paddedDay].push(newChipId);
        placedCount++;

        blockedDates.add(placementDay);
        for (let i = 1; i < minSpacing; i++) {
            if (placementDay - i > 0) blockedDates.add(placementDay - i);
            if (placementDay + i <= daysInMonth) blockedDates.add(placementDay + i);
        }
        const remainingWars = warsToPlaceCount - placedCount;
        if (remainingWars > 0) {
            let availableDays = 0;
            for (let d = placementDay + 1; d <= daysInMonth; d++) if (!blockedDates.has(d)) availableDays++;
            searchStartDate = placementDay + (availableDays > 0 ? Math.max(minSpacing, Math.ceil(availableDays / remainingWars)) : daysInMonth + 1);
        } else {
            searchStartDate = daysInMonth + 1;
        }
    }
}
