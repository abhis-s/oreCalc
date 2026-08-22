import { CANONICAL_CHIP_PRIORITY_ORDER, getSourceById, incomeData } from '../../data/incomeSourceRegistry.js';
import { getWeekStart } from '../../data/languagesData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { getProspectorIncomeForDate } from '../../domain/income/prospectorManager.js';
import { createIncomeChip } from '../../utils/chipFactory.js';
import { formatDate, getShortDayNames } from '../../utils/dateUtils.js';

import {
    handleDayCellMouseEnter,
    handleDayCellMouseLeave,
    handleEquipmentBadgeMouseEnter,
    handleEquipmentBadgeMouseLeave
} from './calendarMilestonesRenderer.js';
import { getCurrentView, getHeroColor, getMidnightUTCTime } from './calendarScheduler.js';

const sourceOrder = [...CANONICAL_CHIP_PRIORITY_ORDER];

/**
 * Creates a single day cell in the calendar grid.
 * @param {Date} date
 * @param {Object} plannerState
 * @param {{ milestones?: Record<string, any[]>, ranges?: any[] }} [activeEquipmentSchedule]
 * @returns {HTMLDivElement}
 */
export function createDayCell(date, plannerState, activeEquipmentSchedule = { milestones: {}, ranges: [] }) {
    const dayCell = document.createElement('div');
    dayCell.classList.add('day-cell');

    const displayYear = date.getUTCFullYear();
    const displayMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const displayDay = String(date.getUTCDate()).padStart(2, '0');
    dayCell.dataset.date = `${displayYear}-${displayMonth}-${displayDay}`;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (date.getTime() === today.getTime()) {
        dayCell.classList.add('today');
    }

    const currentView = getCurrentView();

    if (currentView === 'weekly') {
        const dayMeta = document.createElement('div');
        dayMeta.classList.add('day-meta-container');

        const dayInfo = document.createElement('div');
        dayInfo.classList.add('day-info');
        const formattedDay = formatDate(date, { weekday: 'short' });

        const dayNameSpan = document.createElement('span');
        dayNameSpan.classList.add('day-name-short');
        dayNameSpan.textContent = formattedDay;

        const dateDisplay = document.createElement('div');
        dateDisplay.classList.add('date-display');
        dateDisplay.textContent = String(date.getUTCDate());

        dayInfo.appendChild(dayNameSpan);
        dayInfo.appendChild(dateDisplay);
        dayMeta.appendChild(dayInfo);
        dayCell.appendChild(dayMeta);
    } else {
        const dateDisplay = document.createElement('div');
        dateDisplay.classList.add('date-display');
        dateDisplay.textContent = String(date.getUTCDate());
        dayCell.appendChild(dateDisplay);
    }

    const chipContainer = document.createElement('div');
    chipContainer.classList.add('chip-container');
    dayCell.appendChild(chipContainer);

    if (date >= today) {
        dayCell.addEventListener('mouseenter', (e) => handleDayCellMouseEnter(e, activeEquipmentSchedule));
        dayCell.addEventListener('mouseleave', handleDayCellMouseLeave);
    }

    const monthYearKey = `${displayYear}-${displayMonth}`;
    const chipsOnThisDay = plannerState.calendar.dates[monthYearKey]?.[displayDay] || [];

    const chipsToRender = [];

    // Process Automatic Chips from Registry
    for (const key in incomeData) {
        const source = incomeData[key];
        if (!source.autoGenerateInCalendar) continue;

        let isSuppressedBySubcategory = false;
        if (source.subCategories) {
            isSuppressedBySubcategory = chipsOnThisDay.some(chipId => {
                const type = chipId.replace(/^custom-/, '').split('-')[0];
                return source.subCategories.some(sub => sub.id === type);
            });
        }

        const hasManualOverride = chipsOnThisDay.some(chipId => {
            const cleanId = chipId.replace(/^custom-/, '');
            const type = cleanId.split('-')[0];
            return type === source.id;
        });

        if (isSuppressedBySubcategory || hasManualOverride) continue;

        let autoData = null;
        if (source.getAutomaticSchedule) {
            autoData = source.getAutomaticSchedule(date, state);
        } else if (source.schedule?.type === 'daily') {
            autoData = { instance: date.getUTCDate() };
        }

        if (autoData) {
            let income;
            if (autoData.income) {
                income = autoData.income;
            } else if (source.id === 'prospector' && state.income?.prospector?.assistedConversion) {
                income = getProspectorIncomeForDate(date, state);
            } else if (source.getBaseIncome) {
                income = source.getBaseIncome(state);
            } else {
                income = source.getIncome(state);
            }

            const roundedIncome = {
                shiny: Math.round(income.shiny),
                glowy: Math.round(income.glowy),
                starry: Math.round(income.starry)
            };
            const chipId = `${source.id}-${autoData.instance || displayDay}-${displayYear}-${displayMonth}-cal`;
            const chip = createIncomeChip('', source.className, { type: source.id, instance: autoData.instance, ...roundedIncome }, date.getUTCMonth(), displayYear, chipId);

            const isAssistedProspector = source.id === 'prospector' && state.income?.prospector?.assistedConversion;
            chip.dataset.draggable = isAssistedProspector ? 'true' : 'false';
            chip.draggable = false;
            chip.setAttribute('draggable', 'false');

            chipsToRender.push({ type: source.id, element: chip });
        }
    }

    // Process Manual Chips
    chipsOnThisDay.forEach(chipId => {
        const parts = chipId.split('-');
        let type, instance, originalMonth, originalYear;

        if (chipId.startsWith('custom-')) {
            type = parts[1];
            instance = parseInt(parts[3], 10) + 1;
            originalMonth = date.getUTCMonth();
            originalYear = displayYear;
        } else {
            type = parts[0];
            instance = parseInt(parts[1], 10);
            let originalYearNum = parseInt(parts[2], 10);
            let originalMonthNum = parseInt(parts[3], 10);
            if (originalYearNum < 100 && originalMonthNum >= 2000) {
                const temp = originalYearNum;
                originalYearNum = originalMonthNum;
                originalMonthNum = temp;
            }
            originalMonth = !isNaN(originalMonthNum) ? (originalMonthNum - 1) : date.getUTCMonth();
            originalYear = !isNaN(originalYearNum) ? originalYearNum : displayYear;
        }

        const incomeSource = getSourceById(type);
        const isCustomType = type === 'custom' || type === 'extras' || type.startsWith('custom-') || type.startsWith('custom') || type.startsWith('extras');

        if (incomeSource || isCustomType) {
            let income;
            let displayClass = 'custom-chip';
            if (isCustomType) {
                const dataFromState = state.planner.calendar.customChipData?.[chipId] || {};
                income = {
                    shiny: dataFromState.shiny || 0,
                    glowy: dataFromState.glowy || 0,
                    starry: dataFromState.starry || 0
                };
                displayClass = 'custom-chip-type-custom';
            } else {
                const dataFromState = state.planner.calendar.customChipData?.[chipId];
                if (dataFromState) {
                    income = {
                        shiny: dataFromState.shiny ?? 0,
                        glowy: dataFromState.glowy ?? 0,
                        starry: dataFromState.starry ?? 0
                    };
                } else if (incomeSource.getBaseIncome) {
                    income = incomeSource.getBaseIncome(state);
                } else {
                    income = incomeSource.getIncome(state);
                }
                displayClass = incomeSource.className;
            }
            const roundedIncome = { shiny: Math.round(income.shiny), glowy: Math.round(income.glowy), starry: Math.round(income.starry) };
            const chipDataForFactory = {
                type,
                instance,
                isCustom: chipId.startsWith('custom-'),
                ...roundedIncome
            };
            if (state.planner.calendar.customChipData?.[chipId]) {
                const customProps = state.planner.calendar.customChipData[chipId];
                Object.assign(chipDataForFactory, customProps);
            }
            const chipElement = createIncomeChip('', displayClass, chipDataForFactory, originalMonth, originalYear, chipId);

            chipsToRender.push({ type: type, element: chipElement });
        }
    });

    chipsToRender.sort((a, b) => {
        let indexA = sourceOrder.indexOf(a.type);
        let indexB = sourceOrder.indexOf(b.type);
        if (indexA === -1) indexA = 9999;
        if (indexB === -1) indexB = 9999;
        return indexA - indexB;
    });

    if (chipsToRender.length === 1) {
        chipContainer.classList.add('subgrid-1');
    } else if (chipsToRender.length === 2) {
        chipContainer.classList.add('subgrid-2');
    } else if (chipsToRender.length >= 3) {
        chipContainer.classList.add('subgrid-compact-grid');
    }

    chipsToRender.forEach(item => {
        chipContainer.appendChild(item.element);
    });

    const cellTime = getMidnightUTCTime(date);
    const dateStr = `${displayYear}-${displayMonth}-${displayDay}`;

    const showRanges = state.planner.calendar.settings.highlightUpgradeRanges !== false;
    if (showRanges && activeEquipmentSchedule.ranges) {
        const activeRange = activeEquipmentSchedule.ranges.find(r => cellTime >= r.start && cellTime <= r.end);
        if (activeRange) {
            dayCell.classList.add('equipment-accumulating');
            dayCell.dataset.equipmentHero = activeRange.item.heroName || '';
            dayCell.dataset.equipmentName = activeRange.item.name || '';
            dayCell.style.setProperty('--equip-color', getHeroColor(activeRange.item.heroName));

            if (cellTime === activeRange.start) {
                dayCell.classList.add('range-start');
            }
            if (cellTime === activeRange.end) {
                dayCell.classList.add('range-end');
            }
        }
    }

    const showMilestones = state.planner.calendar.settings.showEquipmentMilestones !== false;
    if (showMilestones && activeEquipmentSchedule.milestones) {
        const milestones = activeEquipmentSchedule.milestones[dateStr];
        if (milestones && milestones.length > 0) {
            dayCell.classList.add('equipment-completion-day');

            const equipContainer = document.createElement('div');
            equipContainer.classList.add('calendar-equipment-container');

            const uniqueMilestones = [];
            const milestoneMap = new Map();

            milestones.forEach(item => {
                const key = `${item.heroName || ''}||${item.name || ''}`;
                const existing = milestoneMap.get(key);
                if (!existing || item.targetLevel > existing.targetLevel) {
                    milestoneMap.set(key, item);
                }
            });

            milestones.forEach(item => {
                const key = `${item.heroName || ''}||${item.name || ''}`;
                const bestItem = milestoneMap.get(key);
                if (bestItem && !uniqueMilestones.includes(bestItem)) {
                    uniqueMilestones.push(bestItem);
                }
            });

            uniqueMilestones.forEach(item => {
                const badge = document.createElement('div');
                badge.classList.add('calendar-equipment-badge');
                badge.dataset.hero = item.heroName;
                badge.style.setProperty('--equip-color', getHeroColor(item.heroName));

                if (item.image) {
                    const img = document.createElement('orecalc-assets-image');
                    img.setAttribute('src', item.image);
                    img.classList.add('calendar-equipment-icon');
                    badge.appendChild(img);
                } else {
                    const fallback = document.createElement('span');
                    fallback.classList.add('calendar-equipment-fallback');
                    fallback.textContent = item.name.substring(0, 2).toUpperCase();
                    badge.appendChild(fallback);
                }

                const levelSpan = document.createElement('span');
                levelSpan.classList.add('calendar-equipment-level');
                const lvlPrefix = translate('views.equipment.lvlShort');
                levelSpan.textContent = `${lvlPrefix} ${item.targetLevel}`;
                badge.appendChild(levelSpan);

                badge.addEventListener('mouseenter', (e) => handleEquipmentBadgeMouseEnter(e, item));
                badge.addEventListener('mouseleave', handleEquipmentBadgeMouseLeave);

                equipContainer.appendChild(badge);
            });

            if (currentView === 'weekly') {
                const dayMeta = dayCell.querySelector('.day-meta-container');
                if (dayMeta) {
                    dayMeta.appendChild(equipContainer);
                } else {
                    dayCell.appendChild(equipContainer);
                }
            } else {
                dayCell.appendChild(equipContainer);
            }
        }
    }

    return dayCell;
}

/**
 * Generates the monthly calendar grid for a given reference date.
 * @param {Date} dateForMonth
 * @param {Object} plannerState
 * @param {{ milestones?: Record<string, any[]>, ranges?: any[] }} [activeEquipmentSchedule]
 * @returns {HTMLDivElement}
 */
export function generateMonthGrid(dateForMonth, plannerState, activeEquipmentSchedule = { milestones: {}, ranges: [] }) {
    const grid = document.createElement('div');
    grid.classList.add('calendar-grid');

    const year = dateForMonth.getUTCFullYear();
    const month = dateForMonth.getUTCMonth();

    const firstDayOfWeekSetting = state.planner.calendar.settings.firstDayOfWeek;
    const language = state.uiSettings?.language || 'en';
    let effectiveStartDay = firstDayOfWeekSetting;
    if (effectiveStartDay === 'auto') {
        effectiveStartDay = getWeekStart(language);
    }
    let startDayIndex = 0;
    if (effectiveStartDay === 'monday') startDayIndex = 1;
    else if (effectiveStartDay === 'tuesday') startDayIndex = 2;
    else if (effectiveStartDay === 'friday') startDayIndex = 5;
    else if (effectiveStartDay === 'saturday') startDayIndex = 6;

    const dayNames = getShortDayNames(firstDayOfWeekSetting);
    dayNames.forEach(day => {
        const dayNameCell = document.createElement('div');
        dayNameCell.classList.add('day-name');
        dayNameCell.textContent = day;
        grid.appendChild(dayNameCell);
    });

    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    const daysInMonth = lastDayOfMonth.getUTCDate();

    const padding = (firstDayOfMonth.getUTCDay() - startDayIndex + 7) % 7;

    const startDate = new Date(Date.UTC(year, month, 1));
    startDate.setUTCDate(startDate.getUTCDate() - padding);

    const endPadding = (6 - (lastDayOfMonth.getUTCDay() - startDayIndex + 7) % 7);
    const endDate = new Date(Date.UTC(year, month, daysInMonth));
    endDate.setUTCDate(endDate.getUTCDate() + endPadding);

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dayCell = createDayCell(currentDate, plannerState, activeEquipmentSchedule);
        if (currentDate.getUTCMonth() !== month) {
            dayCell.classList.add('other-month');
        }
        grid.appendChild(dayCell);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return grid;
}

/**
 * Generates the weekly calendar grid for a given reference date.
 * @param {Date} date
 * @param {Object} plannerState
 * @param {{ milestones?: Record<string, any[]>, ranges?: any[] }} [activeEquipmentSchedule]
 * @returns {HTMLDivElement}
 */
export function generateWeekGrid(date, plannerState, activeEquipmentSchedule = { milestones: {}, ranges: [] }) {
    const grid = document.createElement('div');
    grid.classList.add('weekly-view-grid');

    const firstDayOfWeekSetting = state.planner.calendar.settings.firstDayOfWeek;
    const language = state.uiSettings?.language || 'en';
    let effectiveStartDay = firstDayOfWeekSetting;
    if (effectiveStartDay === 'auto') {
        effectiveStartDay = getWeekStart(language);
    }
    let startDayIndex = 0;
    if (effectiveStartDay === 'monday') startDayIndex = 1;
    else if (effectiveStartDay === 'tuesday') startDayIndex = 2;
    else if (effectiveStartDay === 'friday') startDayIndex = 5;
    else if (effectiveStartDay === 'saturday') startDayIndex = 6;

    const startOfWeek = new Date(date);
    const diff = (startOfWeek.getUTCDay() - startDayIndex + 7) % 7;
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diff);

    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setUTCDate(startOfWeek.getUTCDate() + i);
        const dayCell = createDayCell(day, plannerState, activeEquipmentSchedule);
        grid.appendChild(dayCell);
    }

    return grid;
}
