import { state } from '../core/state.js';
import { incomeData } from '../data/incomeChipData.js';
import { handleStateUpdate } from '../app.js';
import { renderCalendar } from '../components/planner/calendar.js';
import { renderIncomeChips } from '../components/planner/incomeChips.js';
import { getDaysInMonth, addDays, findNthDayOfWeek, getDateFromDayAndMonth, getScheduleDates } from './dateUtils.js';
import { createIncomeChip } from './chipFactory.js';
import { reindexCalendarChips } from './chipManager.js';

export function autoPlaceIncomeChips(currentMonthStr, currentYearStr) {
    const currentMonth = parseInt(currentMonthStr, 10) - 1;
    const currentYear = parseInt(currentYearStr, 10);
    const monthYearKey = `${String(currentMonth + 1).padStart(2, '0')}-${currentYear}`;

    console.log(`[AutoPlace] Starting auto-placement for ${currentMonth + 1}/${currentYear}`);

    const newCalendarDates = { ...state.planner.calendar.dates };
    if (!newCalendarDates[monthYearKey]) {
        newCalendarDates[monthYearKey] = {};
    }

    // 1. Identify all potential chips for the current month
    const allPotentialChips = [];
    for (const key in incomeData) {
        const incomeSource = incomeData[key];
        if (incomeSource.type === 'starBonus') {
            continue;
        }

        let datesToPlace = [];
        if (incomeSource.schedule && incomeSource.schedule.type === 'custom') {
            const count = incomeSource.getCount(state);
            for (let i = 0; i < count; i++) {
                datesToPlace.push({ instance: i + 1, date: null });
            }
        } else {
            const scheduledDates = getScheduleDates(currentYear, currentMonth, incomeSource.schedule);
            if (incomeSource.isSingleEvent) {
                datesToPlace = [{ instance: 1, date: null }];
            }
            else {
                datesToPlace = scheduledDates.map((date, index) => ({ instance: index + 1, date }));
            }
        }

        for (const { instance, date } of datesToPlace) {
            allPotentialChips.push({
                type: incomeSource.type,
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
    }
    console.log(`[AutoPlace] Identified ${allPotentialChips.length} potential chips for the current month.`);

    // 2. Clear previously auto-placed chips for the current month
    let autoPlacedChipsRemovedCount = 0;
    if (newCalendarDates[monthYearKey]) {
        for (const day in newCalendarDates[monthYearKey]) {
            const originalCount = newCalendarDates[monthYearKey][day].length;
            newCalendarDates[monthYearKey][day] = newCalendarDates[monthYearKey][day].filter(chipId => !chipId.endsWith('-auto'));
            const removedCount = originalCount - newCalendarDates[monthYearKey][day].length;
            autoPlacedChipsRemovedCount += removedCount;

            // Clean up empty day arrays
            if (newCalendarDates[monthYearKey][day].length === 0) {
                delete newCalendarDates[monthYearKey][day];
            }
        }
    }
    console.log(`[AutoPlace] Cleared ${autoPlacedChipsRemovedCount} previously auto-placed chips for the current month.`);

    // Process existing manually placed chips in the current month (lock them)
    const placedChipIdsInCurrentMonth = new Set();
    for (const day in newCalendarDates[monthYearKey]) {
        newCalendarDates[monthYearKey][day].forEach(chipId => {
            // Remove the "-cal" suffix to get the base ID for comparison
            placedChipIdsInCurrentMonth.add(chipId.split('-cal')[0]);
        });
    }
    console.log(`[AutoPlace] ${placedChipIdsInCurrentMonth.size} manually placed chips found in current month (locked).`);

    // Filter out already placed chips from allPotentialChips
    const unplacedChips = allPotentialChips.filter(chip => {
        const chipId = `${chip.type}-${String(chip.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}`;
        return !placedChipIdsInCurrentMonth.has(chipId);
    });
    console.log(`[AutoPlace] ${unplacedChips.length} chips remain to be placed.`);

    // 3. Process historical placements (copy from previous months)
    const placedByHistory = new Set();
    const historyLookbackMonths = 12;

    for (let i = 0; i < unplacedChips.length; i++) {
        const chip = unplacedChips[i];
        if (placedByHistory.has(chip.type + '-' + chip.instance)) continue;

        // Check if the chip is available in the current month before looking at history
        const schedule = incomeData[chip.type].schedule;
        if (schedule && schedule.availableMonths && schedule.availableMonths[currentYear] && !schedule.availableMonths[currentYear].includes(currentMonth + 1)) {
            console.log(`[AutoPlace] Skipping historical placement for ${chip.name} as it is not available in ${currentMonth + 1}/${currentYear}.`);
            continue;
        }

        let foundHistoricalPlacement = false;
        for (let m = 1; m <= historyLookbackMonths; m++) {
            const lookbackDate = new Date(Date.UTC(currentYear, currentMonth - m, 1));
            const lookbackMonth = lookbackDate.getUTCMonth();
            const lookbackYear = lookbackDate.getUTCFullYear();
            const lookbackMonthYearKey = `${String(lookbackMonth + 1).padStart(2, '0')}-${lookbackYear}`;

            if (newCalendarDates[lookbackMonthYearKey]) {
                for (const day in newCalendarDates[lookbackMonthYearKey]) {
                    const chipsOnDay = newCalendarDates[lookbackMonthYearKey][day];
                    for (const historicalChipId of chipsOnDay) {
                        const [type, instanceStr, monthStr, yearStr] = historicalChipId.split('-');
                        if (type === chip.type && parseInt(instanceStr, 10) === chip.instance) {
                            let targetDay = null;
                            const historicalDay = parseInt(day, 10);

                            switch (chip.type) {
                                case 'shopOffers':
                                case 'cwl':
                                    targetDay = historicalDay;
                                    break;
                                case 'raidMedalTrader':
                                case 'gemTrader':
                                    // Day of week copy
                                    const historicalDate = getDateFromDayAndMonth(lookbackYear, lookbackMonth, historicalDay);
                                    const dayOfWeek = historicalDate.getUTCDay();
                                    const nthOccurrence = chip.instance;
                                    const targetDateObj = findNthDayOfWeek(currentYear, currentMonth, dayOfWeek, nthOccurrence);
                                    if (targetDateObj) {
                                        targetDay = targetDateObj.getUTCDate();
                                    }
                                    break;
                                case 'eventPass':
                                    const eventPassScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                                    const eventPassStartDate = eventPassScheduledDates.length > 0 ? eventPassScheduledDates[0] : null;
                                    if (eventPassStartDate) {
                                        targetDay = addDays(eventPassStartDate, 5).getUTCDate();
                                    }
                                    break;
                                case 'eventTrader':
                                    const eventTraderScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                                    const eventTraderStartDate = eventTraderScheduledDates.length > 0 ? eventTraderScheduledDates[0] : null;
                                    if (eventTraderStartDate) {
                                        targetDay = addDays(eventTraderStartDate, 7).getUTCDate();
                                    }
                                    break;
                            }

                            if (targetDay !== null) {
                                // Consistently format the new chip ID with padding and the "-cal" suffix
                                const newChipId = `${chip.type}-${String(chip.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;
                                const paddedTargetDay = String(targetDay).padStart(2, '0');
                                if (!newCalendarDates[monthYearKey][paddedTargetDay]) {
                                    newCalendarDates[monthYearKey][paddedTargetDay] = [];
                                }
                                const hasConflict = newCalendarDates[monthYearKey][paddedTargetDay].some(id => id.startsWith(chip.type));
                                if (!hasConflict) {
                                    newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
                                    placedByHistory.add(chip.type + '-' + chip.instance);
                                    foundHistoricalPlacement = true;
                                    console.log(`[AutoPlace] Placed historical chip: ${chip.name} (Instance ${chip.instance}) from ${historicalDay}/${String(lookbackMonth + 1).padStart(2, '0')}/${lookbackYear} to ${paddedTargetDay}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`);
                                } else {
                                    console.log(`[AutoPlace] Conflict: Could not place historical chip ${chip.name} (Instance ${chip.instance}) on ${paddedTargetDay}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear} due to existing chip of same type.`);
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

    // 4. Process CWL placements (gap-filling)
    const finalUnplacedChips = unplacedChips.filter(chip => !placedByHistory.has(chip.type + '-' + chip.instance));
    const cwlChipsToPlace = finalUnplacedChips.filter(chip => chip.type === 'cwl');
    if (cwlChipsToPlace.length > 0) {
        console.log(`[AutoPlace] Attempting to place ${cwlChipsToPlace.length} CWL chips with gap-filling.`);

        const cwlSchedule = incomeData.cwl.schedule;
        const idealCwlDates = getScheduleDates(currentYear, currentMonth, cwlSchedule);
        const idealCwlDateStrings = idealCwlDates.map(d => d.toISOString().split('T')[0]);

        const placedCwlDates = new Set();
        for (const day in newCalendarDates[monthYearKey]) {
            const chipsOnDay = newCalendarDates[monthYearKey][day];
            if (chipsOnDay.some(id => id.startsWith('cwl-'))) {
                const dateStr = getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10)).toISOString().split('T')[0];
                placedCwlDates.add(dateStr);
            }
        }

        const gapDates = idealCwlDateStrings.filter(d => !placedCwlDates.has(d));

        console.log(`[AutoPlace] Found ${gapDates.length} gaps for CWL chips.`);

        let placedCount = 0;
        for (const gapDateStr of gapDates) {
            if (placedCount >= cwlChipsToPlace.length) break;

            const chipToPlace = cwlChipsToPlace[placedCount];
            const targetDate = new Date(gapDateStr);
            const targetDay = targetDate.getUTCDate();
            const paddedTargetDay = String(targetDay).padStart(2, '0');

            const newChipId = `${chipToPlace.type}-${String(chipToPlace.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;

            if (!newCalendarDates[monthYearKey][paddedTargetDay]) {
                newCalendarDates[monthYearKey][paddedTargetDay] = [];
            }

            const hasConflict = newCalendarDates[monthYearKey][paddedTargetDay].some(id => id.startsWith('cwl-'));
            if (!hasConflict) {
                newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
                placedByHistory.add(chipToPlace.type + '-' + chipToPlace.instance);
                placedCount++;
                console.log(`[AutoPlace] Placed CWL chip (Instance ${chipToPlace.instance}) in gap on ${paddedTargetDay}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`);
            }
        }

        if (placedCount < cwlChipsToPlace.length) {
            let lastCwlDate = idealCwlDates.length > 0 ? idealCwlDates[idealCwlDates.length - 1] : new Date(Date.UTC(currentYear, currentMonth, 1));
            for (const day in newCalendarDates[monthYearKey]) {
                if (newCalendarDates[monthYearKey][day].some(id => id.startsWith('cwl-'))) {
                    const date = getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10));
                    if (date > lastCwlDate) {
                        lastCwlDate = date;
                    }
                }
            }

            let appendDate = addDays(lastCwlDate, 1);
            while (placedCount < cwlChipsToPlace.length && appendDate.getUTCMonth() === currentMonth) {
                const chipToPlace = cwlChipsToPlace[placedCount];
                const targetDay = appendDate.getUTCDate();
                const paddedTargetDay = String(targetDay).padStart(2, '0');

                const newChipId = `${chipToPlace.type}-${String(chipToPlace.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;

                if (!newCalendarDates[monthYearKey][paddedTargetDay]) {
                    newCalendarDates[monthYearKey][paddedTargetDay] = [];
                }

                const hasConflict = newCalendarDates[monthYearKey][paddedTargetDay].some(id => id.startsWith('cwl-'));
                if (!hasConflict) {
                    newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
                    placedByHistory.add(chipToPlace.type + '-' + chipToPlace.instance);
                    placedCount++;
                    console.log(`[AutoPlace] Appended CWL chip (Instance ${chipToPlace.instance}) on ${paddedTargetDay}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`);
                }
                appendDate = addDays(appendDate, 1);
            }
        }
    }

    // 5. Process fallback placements (for remaining unplaced chips)
    const remainingUnplacedChips = finalUnplacedChips.filter(chip => !placedByHistory.has(chip.type + '-' + chip.instance));
    console.log(`[AutoPlace] ${remainingUnplacedChips.length} chips remaining for fallback placement.`);

    for (let i = 0; i < remainingUnplacedChips.length; i++) {
        const chip = remainingUnplacedChips[i];
        let targetDay = null;

        const schedule = incomeData[chip.type].schedule;
        if (schedule && schedule.availableMonths && schedule.availableMonths[currentYear] && !schedule.availableMonths[currentYear].includes(currentMonth + 1)) {
            console.log(`[AutoPlace] Skipping fallback placement for ${chip.name} as it is not available in ${currentMonth + 1}/${currentYear}.`);
            continue;
        }

        if (chip.date) {
            if (chip.date.startDate) {
                targetDay = chip.date.startDate.getUTCDate();
            } else {
                targetDay = chip.date.getUTCDate();
            }
        } else {
            switch (chip.type) {
                case 'shopOffers':
                    const shopOffersScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    if (shopOffersScheduledDates.length > 0) {
                        targetDay = shopOffersScheduledDates[0].getUTCDate();
                    }
                    break;
                case 'raidMedalTrader':
                case 'gemTrader':
                    const scheduleDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    if (scheduleDates[chip.instance - 1] && scheduleDates[chip.instance - 1].startDate) {
                        targetDay = scheduleDates[chip.instance - 1].startDate.getUTCDate();
                    }
                    break;
                case 'eventPass':
                    const eventPassScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    const eventPassStartDate = eventPassScheduledDates.length > 0 ? eventPassScheduledDates[0] : null;
                    if (eventPassStartDate) {
                        targetDay = addDays(eventPassStartDate, 5).getUTCDate();
                    }
                    break;
                case 'eventTrader':
                    const eventTraderScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    const eventTraderStartDate = eventTraderScheduledDates.length > 0 ? eventTraderScheduledDates[0] : null;
                    if (eventTraderStartDate) {
                        targetDay = addDays(eventTraderStartDate, 7).getUTCDate();
                    }
                    break;
                case 'clanWar':
                    continue;
            }
        }

        if (targetDay !== null) {
            const newChipId = `${chip.type}-${String(chip.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;
            const paddedTargetDay = String(targetDay).padStart(2, '0');

            if (!newCalendarDates[monthYearKey][paddedTargetDay]) {
                newCalendarDates[monthYearKey][paddedTargetDay] = [];
            }
            const hasConflict = newCalendarDates[monthYearKey][paddedTargetDay].some(id => id.startsWith(chip.type));
            if (!hasConflict) {
                newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
                console.log(`[AutoPlace] Placed fallback chip: ${chip.name} (Instance ${chip.instance}) on ${paddedTargetDay}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`);
            } else {
                console.log(`[AutoPlace] Conflict: Could not place fallback chip ${chip.name} (Instance ${chip.instance}) on ${paddedTargetDay}/${String(currentMonth + 1).padStart(2, '0')}/${currentYear} due to existing chip of same type.`);
            }
        }
    }

    // Final Clan War placement
    const allClanWarChips = finalUnplacedChips.filter(chip => chip.type === 'clanWar');
    const totalClanWars = incomeData.clanWar.getCount(state);
    const manuallyPlacedWarDates = [];

    // Find manually placed clan wars in the current month
    if (newCalendarDates[monthYearKey]) {
        for (const day in newCalendarDates[monthYearKey]) {
            if (newCalendarDates[monthYearKey][day].some(id => id.startsWith('clanWar-'))) {
                manuallyPlacedWarDates.push(getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10)));
            }
        }
    }

    const warsToPlaceCount = allClanWarChips.length;

    if (warsToPlaceCount > 0) {
        console.log(`[AutoPlace] Attempting to place ${warsToPlaceCount} Clan War chips.`);

        // Start of the re-evaluation loop
        let previousEarliestStartDate = null;
        let currentEarliestStartDate = null;
        for (let iteration = 0; iteration < 2; iteration++) {
            previousEarliestStartDate = currentEarliestStartDate;

            // Clear all Clan War chips for re-evaluation (including manual ones if needed)
            for (const day in newCalendarDates[monthYearKey]) {
                newCalendarDates[monthYearKey][day] = newCalendarDates[monthYearKey][day].filter(chipId => !chipId.startsWith('clanWar-'));
                if (newCalendarDates[monthYearKey][day].length === 0) {
                    delete newCalendarDates[monthYearKey][day];
                }
            }

            // 1. Determine the earliest start date for placement
            let earliestStartDateCandidate = null;

            if (totalClanWars < 12) {
                let historicalStartDateFound = false;
                for (let m = 1; m <= historyLookbackMonths && !historicalStartDateFound; m++) {
                    const lookbackDate = new Date(Date.UTC(currentYear, currentMonth - m, 1));
                    const lookbackMonth = lookbackDate.getUTCMonth();
                    const lookbackYear = lookbackDate.getUTCFullYear();
                    const lookbackMonthYearKey = `${String(lookbackMonth + 1).padStart(2, '0')}-${lookbackYear}`;

                    if (state.planner.calendar.dates[lookbackMonthYearKey]) {
                        for (const day in state.planner.calendar.dates[lookbackMonthYearKey]) {
                            const chipsOnDay = state.planner.calendar.dates[lookbackMonthYearKey][day];
                            if (chipsOnDay.some(id => id.startsWith('clanWar-01-'))) {
                                const historicalDay = parseInt(day, 10);
                                earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, historicalDay);
                                historicalStartDateFound = true;
                                console.log(`[AutoPlace] Found historical start date for Clan War on day ${historicalDay} from ${lookbackMonth + 1}/${lookbackYear}`);
                                break;
                            }
                        }
                    }
                }
            }

            if (!earliestStartDateCandidate) {
                if (totalClanWars >= 12) {
                    earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, 4);
                } else {
                    let firstCwlChipDate = null;
                    const placedCwlDatesInMonth = [];
                    for (const day in newCalendarDates[monthYearKey]) {
                        newCalendarDates[monthYearKey][day].forEach(chipId => {
                            if (chipId.startsWith('cwl-')) {
                                placedCwlDatesInMonth.push(getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10)));
                            }
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

                        let calculatedDay = 0;
                        if (lastCwlPlus2 <= cwlStartPlus8) {
                            calculatedDay = cwlStartPlus8;
                        } else if (lastCwlPlus2 < cwlEndPlus1) {
                            calculatedDay = lastCwlPlus2;
                        } else {
                            calculatedDay = cwlEndPlus1;
                        }
                        earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, calculatedDay);
                        console.log(`[AutoPlace] Calculated earliestStartDateCandidate from CWL: ${earliestStartDateCandidate.getUTCDate()}`);
                    } else {
                        // Fallback
                        earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, 1);
                        console.log(`[AutoPlace] No CWL chip found. Defaulting Clan War start window.`);
                    }
                }
            }
            currentEarliestStartDate = earliestStartDateCandidate;

            console.log(`[AutoPlace] Clan War placement window starts on: ${currentEarliestStartDate.getUTCDate()}/${currentMonth + 1}`);

            // 2. Create the initial "No-Go Zone"
            const blockedDates = new Set();
            const daysInMonth = getDaysInMonth(currentYear, currentMonth);
            const minSpacing = incomeData.clanWar.minReoccurrenceDays;

            for (let i = 1; i < currentEarliestStartDate.getUTCDate(); i++) {
                blockedDates.add(i);
            }

            // Re-find manually placed clan wars after clearing for this iteration
            const currentManuallyPlacedWarDates = [];
            if (newCalendarDates[monthYearKey]) {
                for (const day in newCalendarDates[monthYearKey]) {
                    if (newCalendarDates[monthYearKey][day].some(id => id.startsWith('clanWar-'))) {
                        currentManuallyPlacedWarDates.push(getDateFromDayAndMonth(currentYear, currentMonth, parseInt(day, 10)));
                    }
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
            console.log(`[AutoPlace] Initial blocked dates (no-go zone) calculated:`, Array.from(blockedDates).sort((a, b) => a - b));

            // 3. Adaptive Placement Loop
            let placedCount = 0;
            let searchStartDate = currentEarliestStartDate.getUTCDate();

            while (placedCount < warsToPlaceCount && searchStartDate <= daysInMonth) {
                // Find the next available day
                let placementDay = -1;
                for (let d = searchStartDate; d <= daysInMonth; d++) {
                    if (!blockedDates.has(d)) {
                        placementDay = d;
                        break;
                    }
                }

                if (placementDay === -1) {
                    console.log(`[AutoPlace] No more available slots for Clan War chips.`);
                    break;
                }

                // Place the chip
                const chipToPlace = allClanWarChips[placedCount];
                const newChipId = `${chipToPlace.type}-${String(chipToPlace.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;
                const paddedTargetDay = String(placementDay).padStart(2, '0');

                if (!newCalendarDates[monthYearKey][paddedTargetDay]) {
                    newCalendarDates[monthYearKey][paddedTargetDay] = [];
                }
                newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
                placedCount++;
                console.log(`[AutoPlace] Placed Clan War chip (Instance ${chipToPlace.instance}) on day ${placementDay}`);

                // Update blockedDates with the new chip's no-go zone
                blockedDates.add(placementDay);
                for (let i = 1; i < minSpacing; i++) {
                    if (placementDay - i > 0) blockedDates.add(placementDay - i);
                    if (placementDay + i <= daysInMonth) blockedDates.add(placementDay + i);
                }

                // Determine next search start date using division algorithm
                const remainingWars = warsToPlaceCount - placedCount;
                if (remainingWars > 0) {
                    let availableDays = 0;
                    for (let d = placementDay + 1; d <= daysInMonth; d++) {
                        if (!blockedDates.has(d)) {
                            availableDays++;
                        }
                    }

                    if (availableDays > 0) {
                        const averageSpacing = Math.ceil(availableDays / remainingWars);
                        searchStartDate = placementDay + Math.max(minSpacing, averageSpacing);
                    } else {
                        searchStartDate = daysInMonth + 1; // No more available days
                    }
                } else {
                    searchStartDate = daysInMonth + 1; // All wars placed
                }
            }

            if (placedCount < warsToPlaceCount) {
                console.log(`[AutoPlace] ${warsToPlaceCount - placedCount} Clan War chips could not be placed due to lack of available space.`);
            }

            // Break condition: if currentEarliestStartDate has stabilized
            if (
                (previousEarliestStartDate !== null && currentEarliestStartDate !== null && previousEarliestStartDate.getTime() === currentEarliestStartDate.getTime()) ||
                (previousEarliestStartDate === null && currentEarliestStartDate === null)
            ) {
                break;
            }
        }
        console.log(`[AutoPlace] Clan War re-evaluation loop exited.`);

    } else {
        console.log(`[AutoPlace] No Clan War chips to place.`);
    }

    state.planner.calendar.dates = newCalendarDates;

    reindexCalendarChips('clanWar');
    reindexCalendarChips('cwl');

    handleStateUpdate(() => {
        renderCalendar(state.planner);
        renderIncomeChips(currentYear, currentMonth);
    });
    console.log(`[AutoPlace] Auto-placement complete.`);
}