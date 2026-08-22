import { getSourceById } from '../data/incomeSourceRegistry.js';

import { state } from '../core/state.js';

import { getProspectorIncomeForDate } from '../domain/income/prospectorManager.js';
import { getScheduleDates } from './dateUtils.js';

/**
 * Extracts prospector trade details for comparison.
 *
 * @param {Object} data
 * @param {string} [chipId]
 * @param {string} [cellDate]
 * @returns {{ oreMark: string, amount: number }}
 */
function getProspectorDetails(data, chipId, cellDate) {
    const cleanId = chipId ? chipId.split('-cal')[0] : '';
    const custom = state.planner.calendar.customChipData?.[chipId] ||
                   state.planner.calendar.customChipData?.[`${cleanId}-cal`] ||
                   state.planner.calendar.customChips?.find(c => c.id === cleanId);

    let shiny = 0;
    let glowy = 0;
    let starry = 0;
    if (custom) {
        shiny = custom.shiny || 0;
        glowy = custom.glowy || 0;
        starry = custom.starry || 0;
    } else if (data.shiny !== undefined || data.glowy !== undefined || data.starry !== undefined) {
        shiny = data.shiny || 0;
        glowy = data.glowy || 0;
        starry = data.starry || 0;
    } else if (cellDate) {
        const autoIncome = getProspectorIncomeForDate(new Date(cellDate + 'T00:00:00Z'), state);
        shiny = autoIncome.shiny || 0;
        glowy = autoIncome.glowy || 0;
        starry = autoIncome.starry || 0;
    }

    let fromOre = '';
    let toOre = '';
    let amount = 0;

    if (shiny < 0) { fromOre = 'shiny'; amount = Math.abs(shiny); }
    else if (glowy < 0) { fromOre = 'glowy'; amount = Math.abs(glowy); }
    else if (starry < 0) { fromOre = 'starry'; amount = Math.abs(starry); }

    if (shiny > 0) toOre = 'shiny';
    else if (glowy > 0) toOre = 'glowy';
    else if (starry > 0) toOre = 'starry';

    return {
        oreMark: `${fromOre}->${toOre}`,
        amount: amount
    };
}

/**
 * Normalizes a Date or date string to YYYY-MM-DD format.
 *
 * @param {Date|string|null} date
 * @returns {string|null}
 */
function normalizeDateStr(date) {
    if (!date) return null;
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${year}-${month}-${day}`;
}

/**
 * Highlights valid day cell drop targets based on chip schedule, constraints, and coexistence rules.
 * @param {HTMLElement} chip
 * @param {Object} chipData
 */
export function highlightDropTargets(chip, chipData) {
    const [calYear, calMonth] = (state.planner?.calendar?.view?.month || '2026-08').split('-').map(Number);
    const chipStartDate = chip?.dataset?.startDate;
    const chipEndDate = chip?.dataset?.endDate;
    const incomeSource = getSourceById(chipData.type);

    let validDates = [];
    if (chipStartDate && chipEndDate) {
        let currentDate = new Date(chipStartDate + 'T00:00:00Z');
        const endDate = new Date(chipEndDate + 'T00:00:00Z');
        while (currentDate <= endDate) {
            validDates.push(normalizeDateStr(currentDate));
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
    } else if (incomeSource?.schedule) {
        const scheduledDates = getScheduleDates(calYear, calMonth - 1, incomeSource.schedule);
        scheduledDates.forEach(item => {
            if (item && item.startDate && item.endDate) {
                let cur = new Date(item.startDate);
                const end = new Date(item.endDate);
                while (cur <= end) {
                    validDates.push(normalizeDateStr(cur));
                    cur.setUTCDate(cur.getUTCDate() + 1);
                }
            } else if (item) {
                validDates.push(normalizeDateStr(item));
            }
        });
    }

    const calendarCells = document.querySelectorAll('.day-cell');
    const maxChips = incomeSource?.getCount ? incomeSource.getCount(state, calMonth - 1, calYear) : 0;

    const monthYearKeyForCalc = `${calYear}-${String(calMonth).padStart(2, '0')}`;
    let existingDays = [];
    if (state.planner.calendar.dates[monthYearKeyForCalc]) {
        for (const d in state.planner.calendar.dates[monthYearKeyForCalc]) {
            if (state.planner.calendar.dates[monthYearKeyForCalc][d].some(id => id.startsWith(chipData.type))) {
                existingDays.push(parseInt(d, 10));
            }
        }
    }

    const currentDayOnCalendar = chip?.closest('.day-cell')?.dataset?.date?.split('-')[2];
    if (currentDayOnCalendar) {
        const dayInt = parseInt(currentDayOnCalendar, 10);
        existingDays = existingDays.filter(d => d !== dayInt);
    }
    existingDays.sort((a, b) => a - b);

    calendarCells.forEach(cell => {
        const chipContainer = cell.querySelector('.chip-container');
        if (!chipContainer) return;

        const cellDate = /** @type {HTMLElement} */ (cell).dataset.date;
        if (!cellDate) return;
        const [year, month, day] = cellDate.split('-').map(Number);
        const monthYearKey = `${year}-${String(month).padStart(2, '0')}`;
        const dayKey = String(day).padStart(2, '0');

        let isValidRange = false;
        const isCustom = chipData.isCustom === true || chipData.isCustom === 'true' || String(chipData.isCustom) === 'true';
        const isRecurring = chipData.isRecurring === true || chipData.isRecurring === 'true' || String(chipData.isRecurring) === 'true';
        const isGenericCustom = chipData.type === 'custom' || chipData.type === 'extras' || chipData.type.startsWith('custom-') || chipData.type.startsWith('custom') || chipData.type.startsWith('extras');

        if (isCustom && !isRecurring) {
            isValidRange = true;
        } else if (isGenericCustom) {
            isValidRange = true;
        } else if (incomeSource?.isValidDate) {
            isValidRange = incomeSource.isValidDate(day, month - 1, year);
        } else if (validDates.length > 0) {
            const formattedCellDate = normalizeDateStr(cellDate);
            isValidRange = validDates.includes(formattedCellDate);
        } else {
            isValidRange = true;
        }

        const isMultiplierStarBonus = chipData.type && chipData.type.startsWith('starBonus') && chipData.type.endsWith('x');
        if (isValidRange && isMultiplierStarBonus && maxChips > 0) {
            if (existingDays.length > 0) {
                const minEx = existingDays[0];
                const maxEx = existingDays[existingDays.length - 1];
                const newMin = Math.min(day, minEx);
                const newMax = Math.max(day, maxEx);
                if ((newMax - newMin + 1) > maxChips) {
                    isValidRange = false;
                }
            }
        }

        const chipsOnThisDate = state.planner.calendar.dates[monthYearKey]?.[dayKey] || [];

        if (chipData.type === 'prospector') {
            let targetProspectorId = chipsOnThisDate.find(id => id.replace(/^custom-/, '').startsWith('prospector'));
            let hasTargetProspector = !!targetProspectorId;
            if (!hasTargetProspector && state.income.prospector && state.income.prospector.goldPass) {
                hasTargetProspector = true;
            }
            if (hasTargetProspector) {
                const dragDetails = getProspectorDetails(chipData, chip?.id, chip?.closest('.day-cell')?.dataset?.date);
                const targetDetails = getProspectorDetails({ type: 'prospector' }, targetProspectorId, cellDate);
                if (dragDetails.oreMark === targetDetails.oreMark && dragDetails.amount === targetDetails.amount) {
                    isValidRange = false;
                }
            }
        }

        let hasDuplicateType = false;
        let hasConflictingBonus = false;

        const draggedOriginalId = (chipData.id || '').split('-cal')[0];
        const baseDraggedType = chipData.type.replace(/^custom-/, '');

        for (const existingChipId of chipsOnThisDate) {
            const existingOriginalId = existingChipId.split('-cal')[0];
            const cleanExistingId = existingChipId.replace(/^custom-/, '');
            const baseExistingType = cleanExistingId.split('-')[0];

            if (baseDraggedType.startsWith('starBonus') && baseExistingType.startsWith('starBonus')) {
                if (chipData.isCustom && existingChipId.endsWith('-auto')) {
                    hasConflictingBonus = true;
                }
            }

            if ((baseDraggedType === 'shopOffers' || baseDraggedType === 'eventTrader' || baseDraggedType === 'eventPass' || baseDraggedType === 'supercellEvents') &&
                (baseExistingType === baseDraggedType)) {
                if (existingChipId.endsWith('-auto')) {
                    hasDuplicateType = true;
                }
            }

            if (chipData.type === 'custom' || chipData.type === 'extras' || chipData.type.startsWith('custom-') || chipData.type.startsWith('custom') || chipData.type.startsWith('extras')) {
                const draggedCustomType = chipData.customType || '';
                const existingCustomType = state.planner.calendar.customChipData?.[existingChipId]?.customType || '';
                if (draggedCustomType && existingCustomType === draggedCustomType && existingOriginalId !== draggedOriginalId) {
                    hasDuplicateType = true;
                }
            }

            if (existingOriginalId !== draggedOriginalId && baseExistingType === baseDraggedType) {
                if (baseDraggedType !== 'gemTrader' &&
                    baseDraggedType !== 'raidMedalTrader' &&
                    baseDraggedType !== 'clanWar' &&
                    baseDraggedType !== 'cwl' &&
                    baseDraggedType !== 'prospector' &&
                    baseDraggedType !== 'custom' &&
                    !baseDraggedType.startsWith('starBonus') &&
                    baseDraggedType !== 'shopOffers' &&
                    baseDraggedType !== 'eventTrader' &&
                    baseDraggedType !== 'eventPass' &&
                    baseDraggedType !== 'supercellEvents') {
                    hasDuplicateType = true;
                }
            }
        }

        if (isValidRange && !hasDuplicateType && !hasConflictingBonus) {
            chipContainer.classList.add('valid-drop-range');
            chipContainer.classList.remove('duplicate-chip-type');
        } else if (isValidRange && hasDuplicateType) {
            chipContainer.classList.add('duplicate-chip-type');
            chipContainer.classList.remove('valid-drop-range');
        } else {
            chipContainer.classList.remove('valid-drop-range', 'duplicate-chip-type');
        }
    });

    const incomeChipsContainer = document.getElementById('income-chips-container');
    if (incomeChipsContainer) {
        incomeChipsContainer.classList.add('valid-drop-target');
    }
}

/**
 * Clears all drop target highlight classes from calendar day cells and container.
 */
export function clearDropTargetHighlights() {
    const calendarCells = document.querySelectorAll('.day-cell');
    calendarCells.forEach(cell => {
        cell.classList.remove('drag-source-cell', 'drag-source-day');
        const chipContainer = cell.querySelector('.chip-container');
        if (chipContainer) {
            chipContainer.classList.remove('valid-drop-range', 'valid-drop-target', 'invalid-drop-target', 'duplicate-chip-type');
        }
    });

    const incomeChipsContainer = document.getElementById('income-chips-container');
    if (incomeChipsContainer) {
        incomeChipsContainer.classList.remove('valid-drop-target');
    }

    document.querySelectorAll('.dragging-clone').forEach(el => el.remove());
}
