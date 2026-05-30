import { state } from '../core/state.js';
import { incomeData, getSourceById } from '../data/incomeSourceRegistry.js';
import { handleStateUpdate } from '../app.js';
import { renderCalendar } from '../components/planner/calendar.js';
import { renderIncomeChips } from '../components/planner/incomeChips.js';
import { getDaysInMonth, addDays, findNthDayOfWeek, getDateFromDayAndMonth, getScheduleDates } from './dateUtils.js';
import { createIncomeChip } from './chipFactory.js';
import { reindexCalendarChips } from './chipManager.js';

function idMatchesType(id, type) {
    const cleanId = id.replace(/^custom-/, '');
    return cleanId.startsWith(type);
}

export function autoPlaceIncomeChips(currentMonthStr, currentYearStr) {
    const scope = state.planner?.calendar?.settings?.autoPlaceScope || 'month';
    const newCalendarDates = { ...state.planner.calendar.dates };

    if (scope === 'year') {
        for (let m = 1; m <= 12; m++) {
            const monthStr = String(m).padStart(2, '0');
            performAutoPlacementForMonth(monthStr, currentYearStr, newCalendarDates);
        }
    } else {
        performAutoPlacementForMonth(currentMonthStr, currentYearStr, newCalendarDates);
    }

    state.planner.calendar.dates = newCalendarDates;

    // Reindex all non-auto types to ensure numbering is consistent
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

    const currentMonth = parseInt(currentMonthStr, 10) - 1;
    const currentYear = parseInt(currentYearStr, 10);

    handleStateUpdate(() => {
        renderCalendar(state.planner);
        renderIncomeChips(currentYear, currentMonth);
    }, true);
}

function performAutoPlacementForMonth(currentMonthStr, currentYearStr, newCalendarDates) {
    const currentMonth = parseInt(currentMonthStr, 10) - 1;
    const currentYear = parseInt(currentYearStr, 10);
    const monthYearKey = `${String(currentMonth + 1).padStart(2, '0')}-${currentYear}`;

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
            }
            else {
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
        const chipId = `${chip.type}-${String(chip.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}`;
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
    const filteredUnplacedChips = [...otherUnplacedChips, ...clanWarToPlace, ...cwlToPlace];

    const placedByHistory = new Set();
    const historyLookbackMonths = 12;

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
            const lookbackMonthYearKey = `${String(lookbackMonth + 1).padStart(2, '0')}-${lookbackYear}`;

            const searchDates = newCalendarDates[lookbackMonthYearKey] || state.planner.calendar.dates[lookbackMonthYearKey];

            if (searchDates) {
                for (const day in searchDates) {
                    const chipsOnDay = searchDates[day];
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
                                const newChipId = `${chip.type}-${String(chip.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;
                                const paddedTargetDay = String(targetDay).padStart(2, '0');
                                if (!newCalendarDates[monthYearKey][paddedTargetDay]) {
                                    newCalendarDates[monthYearKey][paddedTargetDay] = [];
                                }
                                
                                const existingChips = newCalendarDates[monthYearKey][paddedTargetDay];
                                let canPlace = true;
                                if (chip.type === 'gemTrader') {
                                    canPlace = true; // Coexist
                                } else {
                                    const hasManualConflict = existingChips.some(id => !id.endsWith('-auto') && idMatchesType(id, chip.type));
                                    if (hasManualConflict) {
                                        if (chip.type === 'starBonus2x' || chip.type === 'starBonus4x') {
                                            const manualChipId = existingChips.find(id => !id.endsWith('-auto') && idMatchesType(id, chip.type));
                                            const manualMultiplier = manualChipId.includes('2x') ? 2 : (manualChipId.includes('4x') ? 4 : 1);
                                            const autoMultiplier = chip.type.includes('2x') ? 2 : (chip.type.includes('4x') ? 4 : 1);
                                            if (autoMultiplier >= manualMultiplier) {
                                                const idx = existingChips.indexOf(manualChipId);
                                                existingChips.splice(idx, 1);
                                                canPlace = true;
                                            } else {
                                                canPlace = false;
                                            }
                                        } else {
                                            let nextDay = findFirstAvailableValidDateForAutoPlacer(chip, currentMonth, currentYear, newCalendarDates[monthYearKey]);
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

    const finalUnplacedChips = filteredUnplacedChips.filter(chip => !placedByHistory.has(chip.type + '-' + chip.instance));
    
    // CWL
    const cwlChipsToPlaceActual = finalUnplacedChips.filter(chip => chip.type === 'cwl');
    if (cwlChipsToPlaceActual.length > 0) {
        const cwlSchedule = incomeData.cwl.schedule;
        const idealCwlDates = getScheduleDates(currentYear, currentMonth, cwlSchedule);
        const idealCwlDateStrings = idealCwlDates.map(d => d.toISOString().split('T')[0]);

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

            const newChipId = `${chipToPlace.type}-${String(chipToPlace.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;

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
                const newChipId = `${chipToPlace.type}-${String(chipToPlace.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;

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

    const remainingUnplacedChips = finalUnplacedChips.filter(chip => !placedByHistory.has(chip.type + '-' + chip.instance));

    for (let i = 0; i < remainingUnplacedChips.length; i++) {
        const chip = remainingUnplacedChips[i];
        let targetDay = null;

        const source = getSourceById(chip.type);
        const schedule = source ? source.schedule : null;
        if (schedule && schedule.availableMonths && schedule.availableMonths[currentYear] && !schedule.availableMonths[currentYear].includes(currentMonth + 1)) {
            continue;
        }

        if (chip.date) {
            if (chip.date.startDate) targetDay = chip.date.startDate.getUTCDate();
            else targetDay = chip.date.getUTCDate();
        } else {
            switch (chip.type) {
                case 'shopOffers':
                    const shopOffersScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    if (shopOffersScheduledDates.length > 0) targetDay = shopOffersScheduledDates[0].getUTCDate();
                    break;
                case 'raidMedalTrader':
                case 'gemTrader':
                    const scheduleDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    if (scheduleDates[chip.instance - 1] && scheduleDates[chip.instance - 1].startDate) targetDay = scheduleDates[chip.instance - 1].startDate.getUTCDate();
                    break;
                case 'eventPass':
                    const eventPassScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    const eventPassStartDate = eventPassScheduledDates.length > 0 ? eventPassScheduledDates[0] : null;
                    if (eventPassStartDate) targetDay = addDays(eventPassStartDate, 5).getUTCDate();
                    break;
                case 'eventTrader':
                    const eventTraderScheduledDates = getScheduleDates(currentYear, currentMonth, chip.schedule);
                    const eventTraderStartDate = eventTraderScheduledDates.length > 0 ? eventTraderScheduledDates[0] : null;
                    if (eventTraderStartDate) targetDay = addDays(eventTraderStartDate, 7).getUTCDate();
                    break;
                case 'starBonus2x':
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
                            const lbKey = `${String(lbMonth + 1).padStart(2, '0')}-${lbYear}`;
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
                case 'starBonus4x':
                    let startDay4x = 15;
                    const duration4x = 6;
                    const placed2xDays = [];
                    if (newCalendarDates[monthYearKey]) {
                        for (const day in newCalendarDates[monthYearKey]) {
                            if (newCalendarDates[monthYearKey][day].some(id => idMatchesType(id, 'starBonus2x-'))) placed2xDays.push(parseInt(day, 10));
                        }
                    }
                    placed2xDays.sort((a, b) => a - b);
                    if (placed2xDays.length > 0) {
                        const twoXStart = placed2xDays[0];
                        const twoXEnd = placed2xDays[placed2xDays.length - 1];
                        if (!(startDay4x + duration4x - 1 < twoXStart || startDay4x > twoXEnd)) {
                            if (startDay4x <= twoXStart) startDay4x = twoXStart - duration4x;
                            else startDay4x = twoXEnd + 1;
                        }
                    }
                    targetDay = startDay4x + (chip.instance - 1);
                    const daysInMonth4xFinal = getDaysInMonth(currentYear, currentMonth);
                    if (targetDay > daysInMonth4xFinal || targetDay < 1) targetDay = null;
                    break;
                case 'clanWar':
                    continue;
            }
        }

        if (targetDay !== null) {
            const newChipId = `${chip.type}-${String(chip.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;
            const paddedTargetDay = String(targetDay).padStart(2, '0');
            if (!newCalendarDates[monthYearKey][paddedTargetDay]) newCalendarDates[monthYearKey][paddedTargetDay] = [];
            
            const existingChips = newCalendarDates[monthYearKey][paddedTargetDay];
            let canPlace = true;
            if (chip.type === 'gemTrader') canPlace = true;
            else {
                const hasManualConflict = existingChips.some(id => !id.endsWith('-auto') && idMatchesType(id, chip.type));
                if (hasManualConflict) {
                     if (chip.type.startsWith('starBonus')) {
                         const manualChipId = existingChips.find(id => !id.endsWith('-auto') && idMatchesType(id, chip.type));
                         const manualMultiplier = manualChipId.includes('2x') ? 2 : (manualChipId.includes('4x') ? 4 : 1);
                         const autoMultiplier = chip.type.includes('2x') ? 2 : (chip.type.includes('4x') ? 4 : 1);
                         if (autoMultiplier >= manualMultiplier) {
                             const idx = existingChips.indexOf(manualChipId);
                             existingChips.splice(idx, 1);
                             canPlace = true;
                         } else canPlace = false;
                     } else {
                         let nextDay = findFirstAvailableValidDateForAutoPlacer(chip, currentMonth, currentYear, newCalendarDates[monthYearKey]);
                         if (nextDay) {
                             const nextPaddedDay = String(nextDay).padStart(2, '0');
                             if (!newCalendarDates[monthYearKey][nextPaddedDay]) newCalendarDates[monthYearKey][nextPaddedDay] = [];
                             newCalendarDates[monthYearKey][nextPaddedDay].push(newChipId);
                             canPlace = false;
                         } else canPlace = false;
                     }
                } else if (existingChips.some(id => idMatchesType(id, chip.type))) canPlace = false;
            }
            if (canPlace) newCalendarDates[monthYearKey][paddedTargetDay].push(newChipId);
        }
    }

    const allClanWarChips = filteredUnplacedChips.filter(chip => chip.type === 'clanWar');
    const warsToPlaceCount = allClanWarChips.length;
    if (warsToPlaceCount > 0) {
        let currentEarliestStartDate = null;
        let earliestStartDateCandidate = null;
        const totalClanWar = incomeData.clanWar.getCount(state);

        if (totalClanWar < 12) {
            let historicalStartDateFound = false;
            for (let m = 1; m <= historyLookbackMonths && !historicalStartDateFound; m++) {
                const lookbackDate = new Date(Date.UTC(currentYear, currentMonth - m, 1));
                const lookbackMonth = lookbackDate.getUTCMonth();
                const lookbackYear = lookbackDate.getUTCFullYear();
                const lbKey = `${String(lookbackMonth + 1).padStart(2, '0')}-${lookbackYear}`;
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
            if (totalClanWar >= 12) earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, 4);
            else {
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
                } else earliestStartDateCandidate = getDateFromDayAndMonth(currentYear, currentMonth, incomeData.clanWar.schedule.dateStart);
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
            const newChipId = `${chipToPlace.type}-${String(chipToPlace.instance).padStart(2, '0')}-${String(currentMonth + 1).padStart(2, '0')}-${currentYear}-cal-auto`;
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
            } else searchStartDate = daysInMonth + 1;
        }
    }
}

function findFirstAvailableValidDateForAutoPlacer(chip, month, year, monthDates) {
    const incomeSource = getSourceById(chip.type);
    if (!incomeSource || !incomeSource.schedule) return null;
    const scheduledDates = getScheduleDates(year, month, incomeSource.schedule);
    for (const date of scheduledDates) {
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
