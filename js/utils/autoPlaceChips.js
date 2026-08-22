import { getSourceById, incomeData } from '../data/incomeSourceRegistry.js';

import { state } from '../core/state.js';
import { handleStateUpdate } from '../core/stateManager.js';

import { autoPlaceChipsByHistory, findFirstAvailableValidDateForAutoPlacer } from './autoPlaceHistoryPlacer.js';
import { autoPlaceClanWarChips, autoPlaceCwlChips, idMatchesType } from './autoPlaceWarPlacer.js';
import { isWeeklyCycleSatisfied } from './autoPlaceWeeklyPlacer.js';
import { reindexCalendarChips } from './chipManager.js';
import { addDays, extractScheduleStartDate, getDaysInMonth, getMaxDate, getMinDate, getScheduleDates } from './dateUtils.js';

/**
 * Reindexes all non-auto income types to ensure calendar chip numbering is consistent.
 */
export function reindexNonAutoChips() {
    const reindexTypes = new Set();
    const findReindexTypes = (source, id) => {
        if (!source.autoGenerateInCalendar && id !== 'raidMedalTrader' && id !== 'gemTrader') {
            reindexTypes.add(id);
        }
        if (source.subCategories) {
            source.subCategories.forEach(sub => findReindexTypes(sub, sub.id));
        }
    };
    for (const key in incomeData) {
        findReindexTypes(incomeData[key], key);
    }
    reindexTypes.forEach(type => reindexCalendarChips(type));
}

/**
 * Automatically places calendar income chips for current month or through view range.
 * @param {string} currentMonthStr
 * @param {string} currentYearStr
 */
export function autoPlaceIncomeChips(currentMonthStr, currentYearStr) {
    const scope = state.planner?.calendar?.settings?.autoPlaceScope || 'tillEnd';
    const newCalendarDates = { ...state.planner.calendar.dates };

    if (scope === 'tillEnd') {
        const minBound = getMinDate();
        const maxBound = getMaxDate();
        let m = minBound.month;
        let y = minBound.year;

        while (y < maxBound.year || (y === maxBound.year && m <= maxBound.month)) {
            const monthStr = String(m).padStart(2, '0');
            const yearStr = String(y);
            performAutoPlacementForMonth(monthStr, yearStr, newCalendarDates);

            m++;
            if (m > 12) {
                m = 1;
                y++;
            }
        }
    } else {
        performAutoPlacementForMonth(currentMonthStr, currentYearStr, newCalendarDates);
    }

    state.planner.calendar.dates = newCalendarDates;
    reindexNonAutoChips();

    const currentMonth = parseInt(currentMonthStr, 10) - 1;
    const currentYear = parseInt(currentYearStr, 10);

    handleStateUpdate(() => {}, true);
    document.dispatchEvent(new CustomEvent('calendarChipsPlaced', { detail: { year: currentYear, month: currentMonth } }));
    document.dispatchEvent(new CustomEvent('priorityListUpdated'));
}

/**
 * Automatically places income chips across a specified month/year range.
 * @param {number} startMonth
 * @param {number} startYear
 * @param {number} endMonth
 * @param {number} endYear
 * @param {boolean} [skipRender=false]
 */
export function autoPlaceIncomeChipsForRange(startMonth, startYear, endMonth, endYear, skipRender = false) {
    const newCalendarDates = { ...state.planner.calendar.dates };

    let currentYear = startYear;
    let currentMonth = startMonth;

    while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const monthStr = String(currentMonth).padStart(2, '0');
        const yearStr = String(currentYear);
        performAutoPlacementForMonth(monthStr, yearStr, newCalendarDates);

        currentMonth++;
        if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
        }
    }

    state.planner.calendar.dates = newCalendarDates;
    state.planner.calendar.isDirty = false;
    reindexNonAutoChips();

    if (skipRender) {
        return;
    }

    if (state.planner?.calendar?.view?.month) {
        const [viewYearStr, viewMonthStr] = state.planner.calendar.view.month.split('-');
        const viewMonth = parseInt(viewMonthStr, 10) - 1;
        const viewYear = parseInt(viewYearStr, 10);

        handleStateUpdate(() => {}, true);
        document.dispatchEvent(new CustomEvent('calendarChipsPlaced', { detail: { year: viewYear, month: viewMonth } }));
    }

    document.dispatchEvent(new CustomEvent('priorityListUpdated'));
}

/**
 * Synchronizes auto-placed chips for the given month based on current manual and custom placements.
 * @param {string} monthStr - Month in MM format (1-12).
 * @param {string} yearStr - Year in YYYY format.
 */
export function syncAutoPlacedChipsForMonth(monthStr, yearStr) {
    const newCalendarDates = { ...state.planner.calendar.dates };
    performAutoPlacementForMonth(monthStr.padStart(2, '0'), yearStr, newCalendarDates);
    state.planner.calendar.dates = newCalendarDates;
}

/**
 * Executes month-level automatic chip placement for standard and dynamic income sources.
 * @param {string} currentMonthStr
 * @param {string} currentYearStr
 * @param {Object} newCalendarDates
 */
export function performAutoPlacementForMonth(currentMonthStr, currentYearStr, newCalendarDates) {

    const currentMonth = parseInt(currentMonthStr, 10) - 1;
    const currentYear = parseInt(currentYearStr, 10);
    const monthYearKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    if (!newCalendarDates[monthYearKey]) {
        newCalendarDates[monthYearKey] = {};
    }

    const allPotentialChips = [];
    const processSource = (incomeSource, sourceId) => {
        if (incomeSource.autoGenerateInCalendar) {
            if (incomeSource.subCategories) {
                incomeSource.subCategories.forEach(sub => processSource(sub, sub.id));
            }
            return;
        }

        let datesToPlace = [];
        if (incomeSource.schedule && incomeSource.schedule.type === 'custom') {
            const count = incomeSource.getCount(state, currentMonth, currentYear);
            for (let i = 0; i < count; i++) {
                datesToPlace.push({ instance: i + 1, date: null });
            }
        } else {
            const scheduledDates = getScheduleDates(currentYear, currentMonth, incomeSource.schedule);
            if (incomeSource.isSingleEvent) {
                datesToPlace = [{ instance: 1, date: null }];
            } else {
                datesToPlace = scheduledDates.map((date, index) => ({ instance: index + 1, date }));
            }
        }

        for (const { instance, date } of datesToPlace) {
            allPotentialChips.push({
                type: sourceId,
                instance: instance,
                name: incomeSource.name,
                className: incomeSource.className,
                schedule: incomeSource.schedule,
                date: date,
                getIncome: incomeSource.getIncome,
                getCount: incomeSource.getCount,
                minReoccurrenceDays: incomeSource.minReoccurrenceDays || 0,
            });
        }

        if (incomeSource.subCategories) {
            incomeSource.subCategories.forEach(sub => processSource(sub, sub.id));
        }
    };

    for (const key in incomeData) {
        processSource(incomeData[key], key);
    }

    if (newCalendarDates[monthYearKey]) {
        for (const day in newCalendarDates[monthYearKey]) {
            newCalendarDates[monthYearKey][day] = newCalendarDates[monthYearKey][day].filter(chipId => !chipId.endsWith('-auto'));
            if (newCalendarDates[monthYearKey][day].length === 0) {
                delete newCalendarDates[monthYearKey][day];
            }
        }
    }

    const placedChipIdsInCurrentMonth = new Set();
    const manualClanWarChipsInMonth = [];
    const manualCwlChipsInMonth = [];

    if (newCalendarDates[monthYearKey]) {
        for (const day in newCalendarDates[monthYearKey]) {
            newCalendarDates[monthYearKey][day].forEach(chipId => {
                const originalId = chipId.split('-cal')[0];
                placedChipIdsInCurrentMonth.add(originalId);
                if (originalId.includes('clanWar')) manualClanWarChipsInMonth.push(day);
                if (originalId.includes('cwl')) manualCwlChipsInMonth.push(day);
            });
        }
    }

    const unplacedChips = allPotentialChips.filter(chip => {
        const chipId = `${chip.type}-${String(chip.instance).padStart(2, '0')}-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        return !placedChipIdsInCurrentMonth.has(chipId);
    });

    let clanWarToPlace = unplacedChips.filter(c => c.type === 'clanWar');
    if (manualClanWarChipsInMonth.length > 0) {
        clanWarToPlace = clanWarToPlace.slice(0, Math.max(0, clanWarToPlace.length - manualClanWarChipsInMonth.length));
    }

    let cwlToPlace = unplacedChips.filter(c => c.type === 'cwl');
    if (manualCwlChipsInMonth.length > 0) {
        cwlToPlace = cwlToPlace.slice(0, Math.max(0, cwlToPlace.length - manualCwlChipsInMonth.length));
    }

    const otherUnplacedChips = unplacedChips.filter(c => c.type !== 'clanWar' && c.type !== 'cwl');
    const filteredUnplacedChips = [...otherUnplacedChips, ...cwlToPlace];

    const placedByHistory = new Set();
    const historyLookbackMonths = 12;

    autoPlaceChipsByHistory(filteredUnplacedChips, currentYear, currentMonth, monthYearKey, newCalendarDates, historyLookbackMonths, placedByHistory);

    const finalUnplacedChips = filteredUnplacedChips.filter(chip => !placedByHistory.has(chip.type + '-' + chip.instance));

    const cwlChipsToPlaceActual = finalUnplacedChips.filter(chip => chip.type === 'cwl');
    autoPlaceCwlChips(cwlChipsToPlaceActual, currentYear, currentMonth, monthYearKey, newCalendarDates, placedByHistory);

    const remainingUnplacedChips = finalUnplacedChips.filter(chip => !placedByHistory.has(chip.type + '-' + chip.instance));

    for (let i = 0; i < remainingUnplacedChips.length; i++) {
        const chip = remainingUnplacedChips[i];
        let targetDay = null;

        const source = getSourceById(chip.type);
        const schedule = source ? source.schedule : null;
        if (schedule && schedule.availableMonths && schedule.availableMonths[currentYear] && !schedule.availableMonths[currentYear].includes(currentMonth + 1)) {
            continue;
        }

        if (chip.type === 'raidMedalTrader' || chip.type === 'gemTrader') {
            if (isWeeklyCycleSatisfied(chip.type, currentYear, currentMonth, chip.instance, newCalendarDates)) {
                targetDay = null;
            } else {
                const sDate = extractScheduleStartDate(chip.date);
                if (sDate && typeof sDate.getUTCDate === 'function') {
                    targetDay = sDate.getUTCDate();
                } else {
                    const scheduleDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    if (scheduleDates[chip.instance - 1]) {
                        const schedDate = extractScheduleStartDate(scheduleDates[chip.instance - 1]);
                        if (schedDate && typeof schedDate.getUTCDate === 'function') targetDay = schedDate.getUTCDate();
                    }
                }
            }
        } else if (chip.date) {
            const sDate = extractScheduleStartDate(chip.date);
            if (sDate && typeof sDate.getUTCDate === 'function') targetDay = sDate.getUTCDate();
        } else {
            switch (chip.type) {
                case 'shopOffers': {
                    const shopOffersScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    if (shopOffersScheduledDates.length > 0) {
                        const sDate = extractScheduleStartDate(shopOffersScheduledDates[0]);
                        if (sDate && typeof sDate.getUTCDate === 'function') targetDay = sDate.getUTCDate();
                    }
                    break;
                }
                case 'eventPass': {

                    const eventPassScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    const eventPassStartDate = eventPassScheduledDates.length > 0 ? extractScheduleStartDate(eventPassScheduledDates[0]) : null;
                    if (eventPassStartDate && typeof eventPassStartDate.getUTCDate === 'function') targetDay = addDays(eventPassStartDate, 5).getUTCDate();
                    break;
                }
                case 'eventTrader': {
                    const eventTraderScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    const eventTraderStartDate = eventTraderScheduledDates.length > 0 ? extractScheduleStartDate(eventTraderScheduledDates[0]) : null;
                    if (eventTraderStartDate && typeof eventTraderStartDate.getUTCDate === 'function') targetDay = addDays(eventTraderStartDate, 7).getUTCDate();
                    break;
                }
                case 'starBonus2x': {
                    let manual2xDay = null;
                    if (newCalendarDates[monthYearKey]) {
                        for (const day in newCalendarDates[monthYearKey]) {
                            const chips = newCalendarDates[monthYearKey][day];
                            if (chips.some(id => idMatchesType(id, 'starBonus2x-') && !id.endsWith('-auto'))) {
                                manual2xDay = parseInt(day, 10);
                                break;
                            }
                        }
                    }

                    if (manual2xDay !== null) {
                        let manualInstance = 1;
                        const manualChipId = newCalendarDates[monthYearKey][String(manual2xDay).padStart(2, '0')].find(id => idMatchesType(id, 'starBonus2x-') && !id.endsWith('-auto'));
                        if (manualChipId) {
                            if (manualChipId.startsWith('custom-')) {
                                manualInstance = parseInt(manualChipId.split('-')[3], 10) + 1;
                            } else {
                                manualInstance = parseInt(manualChipId.split('-')[1], 10);
                            }
                        }
                        targetDay = manual2xDay + (chip.instance - manualInstance);
                    } else {
                        let historicalWeekNumber = null;
                        let foundHistory = false;
                        for (let m = 1; m <= 12; m++) {
                            const lookbackDate = new Date(Date.UTC(currentYear, currentMonth - m, 1));
                            const lbMonth = lookbackDate.getUTCMonth();
                            const lbYear = lookbackDate.getUTCFullYear();
                            const lbKey = `${lbYear}-${String(lbMonth + 1).padStart(2, '0')}`;
                            const searchDates = newCalendarDates[lbKey] || state.planner.calendar.dates[lbKey];

                            if (searchDates) {
                                for (const day in searchDates) {
                                    if (searchDates[day].some(id => idMatchesType(id, 'starBonus2x-'))) {
                                        historicalWeekNumber = Math.ceil(parseInt(day, 10) / 7);
                                        foundHistory = true;
                                        break;
                                    }
                                }
                            }
                            if (foundHistory) break;
                        }
                        if (foundHistory && historicalWeekNumber !== null) {
                            targetDay = (historicalWeekNumber - 1) * 7 + 1 + (chip.instance - 1);
                        } else {
                            const daysInMonth2x = getDaysInMonth(currentYear, currentMonth);
                            const lastDayDate = new Date(Date.UTC(currentYear, currentMonth, daysInMonth2x));
                            const lastSunday = lastDayDate.getUTCDate() - lastDayDate.getUTCDay();
                            targetDay = Math.max(1, lastSunday - 6) + (chip.instance - 1);
                        }
                    }
                    const daysInMonth2xFinal = getDaysInMonth(currentYear, currentMonth);
                    if (targetDay > daysInMonth2xFinal || targetDay < 1) targetDay = null;
                    break;
                }
                case 'starBonus4x': {
                    const daysInMonth4x = getDaysInMonth(currentYear, currentMonth);
                    const duration4x = 6;
                    let startDay4x = 15;
                    const placed2xDays = [];
                    if (newCalendarDates[monthYearKey]) {
                        for (const day in newCalendarDates[monthYearKey]) {
                            if (newCalendarDates[monthYearKey][day].some(id => idMatchesType(id, 'starBonus2x-'))) {
                                placed2xDays.push(parseInt(day, 10));
                            }
                        }
                    }
                    placed2xDays.sort((a, b) => a - b);
                    if (placed2xDays.length > 0) {
                        const twoXStart = placed2xDays[0];
                        const twoXEnd = placed2xDays[placed2xDays.length - 1];
                        if (!(startDay4x + duration4x - 1 < twoXStart || startDay4x > twoXEnd)) {
                            if (twoXEnd + duration4x <= daysInMonth4x) {
                                startDay4x = twoXEnd + 1;
                            } else if (twoXStart - duration4x >= 1) {
                                startDay4x = twoXStart - duration4x;
                            } else {
                                startDay4x = 1;
                            }
                        }
                    }
                    targetDay = startDay4x + (chip.instance - 1);
                    if (targetDay > daysInMonth4x || targetDay < 1) targetDay = null;
                    break;
                }
                case 'clanWar':
                    continue;
            }
        }

        if (targetDay !== null) {
            const newChipId = `${chip.type}-${String(chip.instance).padStart(2, '0')}-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-cal-auto`;
            const paddedTargetDay = String(targetDay).padStart(2, '0');
            if (!newCalendarDates[monthYearKey][paddedTargetDay]) newCalendarDates[monthYearKey][paddedTargetDay] = [];

            const existingChips = newCalendarDates[monthYearKey][paddedTargetDay];
            let canPlace = true;
            if (chip.type === 'gemTrader') {
                canPlace = true;
            } else {
                const hasManualConflict = existingChips.some(id => !id.endsWith('-auto') && idMatchesType(id, chip.type));
                if (hasManualConflict) {
                    const nextDay = findFirstAvailableValidDateForAutoPlacer(chip, currentMonth, currentYear, newCalendarDates[monthYearKey]);
                    if (nextDay) {
                        const nextPaddedDay = String(nextDay).padStart(2, '0');
                        if (!newCalendarDates[monthYearKey][nextPaddedDay]) newCalendarDates[monthYearKey][nextPaddedDay] = [];
                        newCalendarDates[monthYearKey][nextPaddedDay].push(newChipId);
                        canPlace = false;
                    } else {
                        canPlace = false;
                    }
                } else if (existingChips.some(id => idMatchesType(id, chip.type))) {
                    canPlace = false;
                }
            }
            if (canPlace) newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
        }
    }

    autoPlaceClanWarChips(clanWarToPlace, currentYear, currentMonth, monthYearKey, newCalendarDates, historyLookbackMonths, placedByHistory);
}
