import { getSourceById } from '../data/incomeSourceRegistry.js';

import { state } from '../core/state.js';

import { idMatchesType } from './autoPlaceWarPlacer.js';
import { isWeeklyCycleSatisfied } from './autoPlaceWeeklyPlacer.js';
import { addDays, extractScheduleStartDate, findNthDayOfWeek, getDateFromDayAndMonth, getScheduleDates } from './dateUtils.js';

/**
 * Finds the first available valid date for an income chip within a month.
 *
 * @param {Object} chip
 * @param {number} month
 * @param {number} year
 * @param {Object} monthDates
 * @returns {number|null}
 */
export function findFirstAvailableValidDateForAutoPlacer(chip, month, year, monthDates) {
    const incomeSource = getSourceById(chip.type);
    if (!incomeSource || !incomeSource.schedule) return null;
    const scheduledDates = getScheduleDates(year, month, incomeSource.schedule);
    for (const rawDate of scheduledDates) {
        const date = extractScheduleStartDate(rawDate);
        if (!date || typeof date.getUTCDate !== 'function') continue;
        const d = date.getUTCDate();
        const paddedDay = String(d).padStart(2, '0');
        const existing = monthDates[paddedDay] || [];
        const hasConflict = existing.some(id => {
            const cleanId = id.replace(/^custom-/, '');
            return cleanId.startsWith(chip.type);
        });
        if (!hasConflict) {
            return d;
        }
    }
    return null;
}

/**
 * Robustly parses a historical chip ID to extract base type and 1-based instance number.
 * Supports standard, '-cal-auto', '-cal', and 'custom-' prefixed formats.
 *
 * @param {string} id
 * @returns {{ type: string, instance: number }}
 */
function parseHistoricalChipId(id) {
    const cleanId = id.replace(/^custom-/, '');
    const parts = cleanId.split('-');
    const type = parts[0];
    let instance = parseInt(parts[1], 10);
    if (isNaN(instance) && parts.length > 2) {
        const lastPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastPart)) {
            instance = lastPart + 1;
        }
    }
    return { type, instance };
}

/**
 * Places chips based on historical placement lookback.
 * @param {Array<Object>} filteredUnplacedChips
 * @param {number} currentYear
 * @param {number} currentMonth
 * @param {string} monthYearKey
 * @param {Object} newCalendarDates
 * @param {number} historyLookbackMonths
 * @param {Set<string>} placedByHistory
 */
export function autoPlaceChipsByHistory(filteredUnplacedChips, currentYear, currentMonth, monthYearKey, newCalendarDates, historyLookbackMonths, placedByHistory) {
    for (let i = 0; i < filteredUnplacedChips.length; i++) {
        const chip = filteredUnplacedChips[i];
        if (placedByHistory.has(chip.type + '-' + chip.instance)) continue;

        const source = getSourceById(chip.type);
        const schedule = source ? source.schedule : null;
        if (schedule && schedule.availableMonths && schedule.availableMonths[currentYear] && !schedule.availableMonths[currentYear].includes(currentMonth + 1)) {
            continue;
        }

        let foundHistoricalPlacement = false;
        for (let m = 1; m <= historyLookbackMonths; m++) {
            const lookbackDate = new Date(Date.UTC(currentYear, currentMonth - m, 1));
            const lookbackMonth = lookbackDate.getUTCMonth();
            const lookbackYear = lookbackDate.getUTCFullYear();
            const lookbackMonthYearKey = `${lookbackYear}-${String(lookbackMonth + 1).padStart(2, '0')}`;

            const searchDates = newCalendarDates[lookbackMonthYearKey] || state.planner.calendar.dates[lookbackMonthYearKey];

            if (searchDates) {
                for (const day in searchDates) {
                    const chipsOnDay = searchDates[day];
                    for (const historicalChipId of chipsOnDay) {
                        const { type, instance } = parseHistoricalChipId(historicalChipId);
                        if (type === chip.type && instance === chip.instance) {

                            let targetDay = null;
                            const historicalDay = parseInt(day, 10);

                            switch (chip.type) {
                                case 'shopOffers':
                                case 'cwl':
                                    targetDay = historicalDay;
                                    break;
                                case 'raidMedalTrader':
                                case 'gemTrader': {
                                    if (isWeeklyCycleSatisfied(chip.type, currentYear, currentMonth, chip.instance, newCalendarDates)) {
                                        placedByHistory.add(chip.type + '-' + chip.instance);
                                        foundHistoricalPlacement = true;
                                        targetDay = null;
                                        break;
                                    }
                                    const historicalDate = getDateFromDayAndMonth(lookbackYear, lookbackMonth, historicalDay);
                                    const dayOfWeek = historicalDate.getUTCDay();
                                    const nthOccurrence = chip.instance;
                                    const targetDateObj = findNthDayOfWeek(currentYear, currentMonth, dayOfWeek, nthOccurrence);
                                    if (targetDateObj) {
                                        targetDay = targetDateObj.getUTCDate();
                                    }
                                    break;
                                }

                                case 'eventPass': {
                                    const eventPassScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                                    const eventPassStartDate = eventPassScheduledDates.length > 0 ? extractScheduleStartDate(eventPassScheduledDates[0]) : null;
                                    if (eventPassStartDate) {
                                        targetDay = addDays(eventPassStartDate, 5).getUTCDate();
                                    }
                                    break;
                                }
                                case 'eventTrader': {
                                    const eventTraderScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                                    const eventTraderStartDate = eventTraderScheduledDates.length > 0 ? extractScheduleStartDate(eventTraderScheduledDates[0]) : null;
                                    if (eventTraderStartDate) {
                                        targetDay = addDays(eventTraderStartDate, 7).getUTCDate();
                                    }
                                    break;
                                }
                            }

                            if (targetDay !== null) {
                                const newChipId = `${chip.type}-${String(chip.instance).padStart(2, '0')}-${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-cal-auto`;
                                const paddedTargetDay = String(targetDay).padStart(2, '0');
                                if (!newCalendarDates[monthYearKey][paddedTargetDay]) {
                                    newCalendarDates[monthYearKey][paddedTargetDay] = [];
                                }

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
                                            placedByHistory.add(chip.type + '-' + chip.instance);
                                            foundHistoricalPlacement = true;
                                            canPlace = false;
                                        } else {
                                            canPlace = false;
                                        }
                                    } else {
                                        const hasAutoConflict = existingChips.some(id => idMatchesType(id, chip.type));
                                        if (hasAutoConflict) canPlace = false;
                                    }
                                }

                                if (canPlace) {
                                    newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
                                    placedByHistory.add(chip.type + '-' + chip.instance);
                                    foundHistoricalPlacement = true;
                                }
                            }
                        }
                    }
                    if (foundHistoricalPlacement) break;
                }
            }
            if (foundHistoricalPlacement) break;
        }
    }
}
