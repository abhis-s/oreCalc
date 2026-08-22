import { getSourceById } from '../../data/incomeSourceRegistry.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { getProspectorIncomeForDate } from '../../domain/income/prospectorManager.js';
import { syncAutoPlacedChipsForMonth } from '../../utils/autoPlaceChips.js';
import { reindexCalendarChips } from '../../utils/chipManager.js';
import { addDays } from '../../utils/dateUtils.js';
import { safeJsonParse } from '../../utils/jsonUtils.js';

import { renderCalendar } from './calendarDisplay.js';
import { renderIncomeChips } from './incomeChipsDisplay.js';

/**
 * Handles HTML5 dragover events on calendar day chip containers and toggles drop feedback classes.
 * @param {DragEvent} e - Native dragover event object.
 */
export function handleDragOver(e) {
    const chipContainer = e.target?.closest?.('.chip-container') || e.currentTarget;
    if (!chipContainer || !chipContainer.classList) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    chipContainer.classList.remove('valid-drop-target', 'invalid-drop-target');
    if (chipContainer.classList.contains('duplicate-chip-type')) {
        chipContainer.classList.add('invalid-drop-target');
    } else if (chipContainer.classList.contains('valid-drop-range')) {
        chipContainer.classList.add('valid-drop-target');
    } else {
        chipContainer.classList.add('invalid-drop-target');
    }
}

/**
 * Handles HTML5 dragleave events on calendar day chip containers to remove highlight classes.
 * @param {DragEvent} e - Native dragleave event object.
 */
export function handleDragLeave(e) {
    const chipContainer = e.target?.closest?.('.chip-container') || e.currentTarget;
    if (!chipContainer || !chipContainer.classList) return;
    chipContainer.classList.remove('valid-drop-target', 'invalid-drop-target');
}

/**
 * Handles HTML5 drop events on calendar day chip containers, deserializing payload and invoking handler.
 * @param {DragEvent} e - Native drop event object.
 */
export function handleDrop(e) {
    const chipContainer = e.target?.closest?.('.chip-container') || e.currentTarget;
    if (!chipContainer || !chipContainer.classList || !e.dataTransfer) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    const incomeChipData = safeJsonParse(raw, null);
    if (incomeChipData && incomeChipData.id) {
        handleChipDropOnCalendar(incomeChipData, chipContainer);
    }
}

/**
 * Handles placing or swapping an income chip onto a calendar day cell.
 * @param {Object} incomeChipData
 * @param {HTMLElement} chipContainer
 */
export function handleChipDropOnCalendar(incomeChipData, chipContainer) {
    if (!chipContainer || !chipContainer.classList.contains('valid-drop-range')) return;
    chipContainer.classList.remove('valid-drop-target', 'invalid-drop-target');
    const isAssistedProspector = incomeChipData.type === 'prospector' && state.income?.prospector?.assistedConversion;
    if ((incomeChipData.type === 'starBonus' || incomeChipData.type === 'prospector') && !incomeChipData.isCustom && !isAssistedProspector) return;

    const dayCell = chipContainer.closest('.day-cell');
    if (!dayCell || !dayCell.dataset.date) return;
    const targetDate = dayCell.dataset.date;
    const wasCustom = incomeChipData.isCustom || incomeChipData.id.startsWith('custom-');
    const originalIncomingId = incomeChipData.id;

    let newId = incomeChipData.id;
    let isNewChip = !incomeChipData.id.includes('-cal');

    if (isAssistedProspector && !incomeChipData.isCustom) {
        incomeChipData.isCustom = true;
        const shortId = Math.random().toString(36).substring(2, 7);
        incomeChipData.id = `custom-prospector-${shortId}`;
        isNewChip = true;
    }

    handleStateUpdate(() => {
        const [year, month, day] = targetDate.split('-');
        const monthYearKey = `${year}-${month}`;

        let swapped = false;
        if (incomeChipData.type === 'prospector' && incomeChipData.originalDate) {
            const [origYear, origMonth, origDay] = incomeChipData.originalDate.split('-');
            const origMonthYearKey = `${origYear}-${origMonth}`;

            const targetChips = state.planner.calendar.dates[monthYearKey]?.[day] || [];
            let targetProspectorId = targetChips.find(id => id.replace(/^custom-/, '').startsWith('prospector'));

            if (!targetProspectorId && state.income.prospector && state.income.prospector.goldPass) {
                targetProspectorId = `prospector-${parseInt(day, 10)}-${year}-${month}-cal`;
            }

            if (targetProspectorId) {
                const dragIsCustom = wasCustom;
                let finalDraggedId = originalIncomingId;
                if (!dragIsCustom) {
                    const shortId = Math.random().toString(36).substring(2, 7);
                    finalDraggedId = `custom-prospector-${shortId}-cal`;

                    const dragIncome = getProspectorIncomeForDate(new Date(incomeChipData.originalDate + 'T00:00:00Z'), state);

                    if (!state.planner.calendar.customChipData) state.planner.calendar.customChipData = {};
                    state.planner.calendar.customChipData[finalDraggedId] = {
                        shiny: dragIncome.shiny || 0,
                        glowy: dragIncome.glowy || 0,
                        starry: dragIncome.starry || 0
                    };
                } else {
                    finalDraggedId = originalIncomingId.includes('-cal') ? originalIncomingId : `${originalIncomingId}-cal`;
                }

                const targetIsCustom = targetProspectorId.startsWith('custom-');
                let finalTargetId = targetProspectorId;
                if (!targetIsCustom) {
                    const autoIncome = getProspectorIncomeForDate(new Date(targetDate + 'T00:00:00Z'), state);

                    const shortId = Math.random().toString(36).substring(2, 7);
                    finalTargetId = `custom-prospector-${shortId}-cal`;
                    if (!state.planner.calendar.customChipData) state.planner.calendar.customChipData = {};
                    state.planner.calendar.customChipData[finalTargetId] = {
                        shiny: autoIncome.shiny || 0,
                        glowy: autoIncome.glowy || 0,
                        starry: autoIncome.starry || 0
                    };
                }

                const origChips = state.planner.calendar.dates[origMonthYearKey]?.[origDay] || [];
                const dragIndex = origChips.findIndex(id => id.split('-cal')[0] === originalIncomingId.split('-cal')[0]);
                if (dragIndex > -1) {
                    origChips.splice(dragIndex, 1);
                }

                const targetIndex = targetChips.indexOf(targetProspectorId);
                if (targetIndex > -1) {
                    targetChips.splice(targetIndex, 1);
                }

                if (!state.planner.calendar.dates[origMonthYearKey]) state.planner.calendar.dates[origMonthYearKey] = {};
                if (!state.planner.calendar.dates[origMonthYearKey][origDay]) state.planner.calendar.dates[origMonthYearKey][origDay] = [];
                state.planner.calendar.dates[origMonthYearKey][origDay].push(finalTargetId);

                if (!state.planner.calendar.dates[monthYearKey]) state.planner.calendar.dates[monthYearKey] = {};
                if (!state.planner.calendar.dates[monthYearKey][day]) state.planner.calendar.dates[monthYearKey][day] = [];
                state.planner.calendar.dates[monthYearKey][day].push(finalDraggedId);

                swapped = true;
            }
        }

        if (swapped) return;

        if (isAssistedProspector && isNewChip) {
            if (!state.planner.calendar.customChipData) state.planner.calendar.customChipData = {};
            state.planner.calendar.customChipData[`${incomeChipData.id}-cal`] = {
                shiny: incomeChipData.shiny || 0,
                glowy: incomeChipData.glowy || 0,
                starry: incomeChipData.starry || 0
            };
        }

        if (!isNewChip) {
            const originalId = incomeChipData.id.split('-cal')[0];
            for (const mYKey in state.planner.calendar.dates) {
                for (const dKey in state.planner.calendar.dates[mYKey]) {
                    const chipIds = state.planner.calendar.dates[mYKey][dKey];
                    const index = chipIds.findIndex(id => id.split('-cal')[0] === originalId);
                    if (index > -1) {
                        chipIds.splice(index, 1);
                        if (chipIds.length === 0) delete state.planner.calendar.dates[mYKey][dKey];
                        if (Object.keys(state.planner.calendar.dates[mYKey]).length === 0) delete state.planner.calendar.dates[mYKey];
                    }
                }
            }
        } else if (incomeChipData.isCustom) {
            const customChips = state.planner.calendar.customChips || [];
            const index = customChips.findIndex(c => c.id === incomeChipData.id);
            if (index > -1) {
                const chipData = customChips.splice(index, 1)[0];
                if (!state.planner.calendar.customChipData) state.planner.calendar.customChipData = {};
                state.planner.calendar.customChipData[`${incomeChipData.id}-cal`] = {
                    shiny: chipData.shiny || 0,
                    glowy: chipData.glowy || 0,
                    starry: chipData.starry || 0,
                    multiplier: chipData.multiplier,
                    result: chipData.result,
                    customType: chipData.customType || ''
                };
            }
        }

        if (isNewChip) {
            newId = `${incomeChipData.id}-cal`;
        } else {
            newId = `${incomeChipData.id.split('-cal')[0]}-cal`;
        }

        if (!state.planner.calendar.dates[monthYearKey]) state.planner.calendar.dates[monthYearKey] = {};
        if (!state.planner.calendar.dates[monthYearKey][day]) state.planner.calendar.dates[monthYearKey][day] = [];

        const existingChips = state.planner.calendar.dates[monthYearKey][day];
        const draggedType = incomeChipData.type;
        const draggedOriginalId = incomeChipData.id.split('-cal')[0];
        const baseDraggedType = draggedType.replace(/^custom-/, '');
        const effectiveType = incomeChipData.customType || baseDraggedType;
        const incomeSource = getSourceById(effectiveType) || getSourceById(draggedType);
        const isWeekly = incomeSource?.schedule?.type === 'weekly' || effectiveType === 'raidMedalTrader' || effectiveType === 'gemTrader';

        if (isWeekly) {
            const [targetYear, targetMonth] = monthYearKey.split('-').map(Number);
            const targetDayNum = parseInt(day, 10);
            const targetDate = new Date(Date.UTC(targetYear, targetMonth - 1, targetDayNum));
            const dayOfWeek = targetDate.getUTCDay();
            const offsetFromTuesday = (dayOfWeek - 2 + 7) % 7;
            const weekStartDate = addDays(targetDate, -offsetFromTuesday);
            const weekEndDate = addDays(weekStartDate, 6);

            let curDate = new Date(weekStartDate);
            while (curDate <= weekEndDate) {
                const curMYKey = `${curDate.getUTCFullYear()}-${String(curDate.getUTCMonth() + 1).padStart(2, '0')}`;
                const curDayKey = String(curDate.getUTCDate()).padStart(2, '0');
                const curDays = state.planner.calendar.dates[curMYKey];
                if (curDays && curDays[curDayKey]) {
                    const existingIdx = curDays[curDayKey].findIndex(id => {
                        const cleanId = id.replace(/^custom-/, '');
                        const storedCustomType = state.planner.calendar.customChipData?.[id]?.customType || '';
                        return cleanId.startsWith(effectiveType) || storedCustomType === effectiveType || id.startsWith(effectiveType);
                    });
                    if (existingIdx > -1) {
                        curDays[curDayKey].splice(existingIdx, 1);
                        if (curDays[curDayKey].length === 0) {
                            delete curDays[curDayKey];
                        }
                    }
                }
                curDate = addDays(curDate, 1);
            }
        }

        // Collision Rules
        if (isWeekly) {
            // Overwrites and replaces existing weekly chips across Tuesday-to-Monday week window
        } else if (baseDraggedType.startsWith('starBonus')) {
            const hasAutoMultiplier = existingChips.some(id => id.startsWith('starBonus') && id.endsWith('-auto'));
            if (hasAutoMultiplier && incomeChipData.isCustom) {
                console.warn('[Calendar] Cannot place manually created multiplier chip on an already auto placed multiplier');
                return;
            }
            const existingManualIndex = existingChips.findIndex(id => id.startsWith('starBonus') && !id.endsWith('-auto'));
            if (existingManualIndex > -1) {
                existingChips.splice(existingManualIndex, 1);
            }
        } else if (baseDraggedType === 'shopOffers' || baseDraggedType === 'eventTrader' || baseDraggedType === 'supercellEvents') {
            const hasAutoChip = existingChips.some(id => id.startsWith(baseDraggedType) && id.endsWith('-auto'));
            if (hasAutoChip) {
                console.warn(`[Calendar] Cannot place manual chip on an auto-placed ${baseDraggedType}`);
                return;
            }
            const existingManualIndex = existingChips.findIndex(id => id.startsWith(baseDraggedType) && !id.endsWith('-auto'));
            if (existingManualIndex > -1) {
                existingChips.splice(existingManualIndex, 1);
            }
        } else if (baseDraggedType === 'clanWar' || baseDraggedType === 'cwl' || baseDraggedType === 'prospector') {
            const existingIndex = existingChips.findIndex(id => {
                const cleanId = id.replace(/^custom-/, '');
                return cleanId.startsWith(baseDraggedType);
            });
            if (existingIndex > -1) {
                existingChips.splice(existingIndex, 1);
            }
        } else if (draggedType === 'custom' || draggedType === 'extras' || draggedType.startsWith('custom-') || draggedType.startsWith('extras')) {
            const draggedCustomType = incomeChipData.customType || '';
            const existingIdx = existingChips.findIndex(id => {
                const existingCustomType = state.planner.calendar.customChipData?.[id]?.customType || '';
                return existingCustomType === draggedCustomType && id !== newId;
            });
            if (existingIdx > -1) {
                existingChips.splice(existingIdx, 1);
            }
        } else {
            const hasDuplicate = existingChips.some(id => {
                const type = id.split('-')[0];
                const originalId = id.split('-cal')[0];
                return type === draggedType && originalId !== draggedOriginalId;
            });

            if (hasDuplicate) {
                console.warn(`[Calendar] Prevented duplicate chip of type ${draggedType} on day ${day}`);
                return;
            }
        }

        state.planner.calendar.dates[monthYearKey][day].push(newId);

        // Gap Filling Logic for Star Bonuses
        if (draggedType && draggedType.startsWith('starBonus') && draggedType.endsWith('x')) {
            const monthDays = state.planner.calendar.dates[monthYearKey];
            const existingDays = [];
            for (const dayKey in monthDays) {
                if (monthDays[dayKey].some(id => id.startsWith(draggedType))) {
                    existingDays.push(parseInt(dayKey, 10));
                }
            }
            existingDays.sort((a, b) => a - b);

            if (existingDays.length > 1) {
                const minDay = existingDays[0];
                const maxDay = existingDays.at(-1) ?? existingDays[0];
                for (let fillDay = minDay + 1; fillDay < maxDay; fillDay++) {
                    const paddedDay = String(fillDay).padStart(2, '0');
                    if (!monthDays[paddedDay]) monthDays[paddedDay] = [];
                    if (!monthDays[paddedDay].some(id => id.startsWith(draggedType))) {
                        const newAutoId = `${draggedType}-00-${year}-${month}-cal-auto`;
                        monthDays[paddedDay].push(newAutoId);
                    }
                }
            }
        }

        if (isWeekly) {
            syncAutoPlacedChipsForMonth(month, year);
        } else {
            reindexCalendarChips(draggedType);
        }
    });

    renderCalendar(state.planner);
    if (state.planner?.calendar?.view?.month) {
        renderIncomeChips(parseInt(state.planner.calendar.view.month.split('-')[0], 10), parseInt(state.planner.calendar.view.month.split('-')[1], 10) - 1);
    }

    const targetDayCell = document.querySelector(`.day-cell[data-date="${targetDate}"]`);
    if (targetDayCell) {
        targetDayCell.classList.add('drop-pulse');
        setTimeout(() => {
            targetDayCell.classList.remove('drop-pulse');
        }, 600);
    }
}
