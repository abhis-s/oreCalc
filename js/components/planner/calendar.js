import { handleStateUpdate } from '../../core/stateManager.js';
import { state } from '../../core/state.js';

import { autoPlaceIncomeChips } from '../../utils/autoPlaceChips.js';
import { calculateCumulativeOres, reindexCalendarChips, checkAndGenerateRecurringChips } from '../../utils/chipManager.js';
import { createIncomeChip } from '../../utils/chipFactory.js';
import { formatDate, getShortDayNames } from '../../utils/dateFormatter.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { getISOWeekNumber, getDaysInMonth, addDays, getSupercellEventsForYear, getDateOfWeek, getMinDate, getMaxDate } from '../../utils/dateUtils.js';
import { incomeData, getSourceById } from '../../data/incomeSourceRegistry.js';
import { supercellEventsData } from '../../data/appData.js';
import { translate } from '../../i18n/translator.js';
import { getProspectorIncomeForDate } from '../../incomeCalculations/prospectorManager.js';

import { renderIncomeChips } from './incomeChips.js';

import { showConfirm } from '../../ui/noticeModal.js';

const sourceOrder = [];
for (const key in incomeData) {
    sourceOrder.push(key);
    if (incomeData[key].subCategories) {
        incomeData[key].subCategories.forEach(sub => sourceOrder.push(sub.id));
    }
}

const calendarContainer = document.getElementById('calendar-container');
const calendarTrack = document.getElementById('calendar-track');
const currentMonthYearHeader = document.getElementById('current-month-year');
const deleteCurrentMonthChipsBtn = document.getElementById('delete-current-month-chips-btn');
const deleteAllChipsBtn = document.getElementById('delete-all-chips-btn');
const calendarSettingsBtn = document.getElementById('calendar-settings-btn');
const autoPlaceChipsBtn = document.getElementById('auto-place-chips-btn');
const monthChipContainer = document.getElementById('month-chip-container');

// Settings Modal Elements
const calendarSettingsModal = document.getElementById('calendar-settings-modal');
const closeCalendarSettingsModalBtn = document.getElementById('close-calendar-settings-modal-btn');
const cancelCalendarSettingsBtn = document.getElementById('cancel-calendar-settings-btn');
const saveCalendarSettingsBtn = document.getElementById('save-calendar-settings-btn');
const firstDaySelect = document.getElementById('calendar-first-day-select');
const showIconsSwitch = document.getElementById('calendar-show-icons-switch');
const autoPlaceScopeSelect = document.getElementById('calendar-auto-place-scope-select');

let currentView = 'monthly';
let isSwiping = false;
let touchStartX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let isTransitioning = false;
let canScroll = true;
let wheelDebounceTimeout = null;

let animateNextRender = false;
let animationBaseDelay = 0.2;
let autoPlaceStaggerCounter = 0;

export function setAnimateNextRender(val, delay = 0.2) {
    animateNextRender = val;
    animationBaseDelay = delay;
}

function createDayCell(date, plannerState) {

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

    if (currentView === 'weekly') {
        const dayInfo = document.createElement('div');
        dayInfo.classList.add('day-info');
        const formattedDay = formatDate(date, { weekday: 'short' });
        
        const dayNameSpan = document.createElement('span');
        dayNameSpan.classList.add('day-name-short');
        dayNameSpan.textContent = formattedDay;
        
        const dateDisplay = document.createElement('div');
        dateDisplay.classList.add('date-display');
        dateDisplay.textContent = date.getUTCDate();
        
        dayInfo.appendChild(dayNameSpan);
        dayInfo.appendChild(dateDisplay);
        dayCell.appendChild(dayInfo);
    } else {
        const dateDisplay = document.createElement('div');
        dateDisplay.classList.add('date-display');
        dateDisplay.textContent = date.getUTCDate();
        dayCell.appendChild(dateDisplay);
    }

    const chipContainer = document.createElement('div');
    chipContainer.classList.add('chip-container');
    chipContainer.addEventListener('dragover', handleDragOver);
    chipContainer.addEventListener('dragleave', handleDragLeave);
    chipContainer.addEventListener('drop', handleDrop);
    dayCell.appendChild(chipContainer);

    if (date >= today) {
        dayCell.addEventListener('mouseenter', handleDayCellMouseEnter);
        dayCell.addEventListener('mouseleave', handleDayCellMouseLeave);
    }

    const monthYearKey = `${displayMonth}-${displayYear}`;
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

        // Suppress if manual/custom chip of this exact source id is present
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
                starry: Math.round(income.starry),
            };
            const chipId = `${source.id}-${autoData.instance || displayDay}-${displayMonth}-${displayYear}-cal`;
            const chip = createIncomeChip('', source.className, { type: source.id, instance: autoData.instance, ...roundedIncome }, date.getUTCMonth(), displayYear, chipId);
            const isAssistedProspector = source.id === 'prospector' && state.income?.prospector?.assistedConversion;
            chip.draggable = isAssistedProspector ? true : false;
            chip.setAttribute('draggable', chip.draggable ? 'true' : 'false');

            chipsToRender.push({ type: source.id, element: chip });
        }
    }

    // Process Manual Chips
    chipsOnThisDay.forEach(chipId => {
        const parts = chipId.split('-');
        let type, instance, originalMonth, originalYear;

        if (chipId.startsWith('custom-')) {
            // ID: custom-[type]-[timestamp]-[index]-cal
            type = parts[1];
            instance = parseInt(parts[3], 10) + 1; // index+1 is instance
            originalMonth = date.getUTCMonth();
            originalYear = displayYear;
        } else {
            // ID: [type]-[instance]-[month]-[year]-cal
            type = parts[0];
            instance = parseInt(parts[1], 10);
            const originalMonthNum = parseInt(parts[2], 10);
            const originalYearNum = parseInt(parts[3], 10);
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

    // Sort chips based on sourceOrder
    chipsToRender.sort((a, b) => {
        let indexA = sourceOrder.indexOf(a.type);
        let indexB = sourceOrder.indexOf(b.type);
        if (indexA === -1) indexA = 9999;
        if (indexB === -1) indexB = 9999;
        return indexA - indexB;
    });

    // Render sorted chips
    chipsToRender.forEach(item => {
        if (animateNextRender === 'all' || (animateNextRender === 'auto-placed' && item.element.id.includes('-auto'))) {
            item.element.classList.add('animate-autoplace');
            item.element.style.animationDelay = `${animationBaseDelay + (autoPlaceStaggerCounter * 0.06)}s`;
            autoPlaceStaggerCounter++;
        }
        chipContainer.appendChild(item.element);
    });

    return dayCell;
}

function generateMonthGrid(dateForMonth, plannerState) {
    const grid = document.createElement('div');
    grid.classList.add('calendar-grid');

    const year = dateForMonth.getUTCFullYear();
    const month = dateForMonth.getUTCMonth();

    const firstDayOfWeekSetting = state.planner.calendar.settings.firstDayOfWeek;
    const language = state.uiSettings?.language || 'en';
    let effectiveStartDay = firstDayOfWeekSetting;
    if (effectiveStartDay === 'auto') {
        effectiveStartDay = language === 'de' ? 'monday' : 'sunday';
    }
    const startDayIndex = effectiveStartDay === 'monday' ? 1 : 0;

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
        const dayCell = createDayCell(currentDate, plannerState);
        if (currentDate.getUTCMonth() !== month) {
            dayCell.classList.add('other-month');
        }
        grid.appendChild(dayCell);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    return grid;
}

function generateWeekGrid(date, plannerState) {
    const grid = document.createElement('div');
    grid.classList.add('weekly-view-grid');

    const firstDayOfWeekSetting = state.planner.calendar.settings.firstDayOfWeek;
    const language = state.uiSettings?.language || 'en';
    let effectiveStartDay = firstDayOfWeekSetting;
    if (effectiveStartDay === 'auto') {
        effectiveStartDay = language === 'de' ? 'monday' : 'sunday';
    }
    const startDayIndex = effectiveStartDay === 'monday' ? 1 : 0;

    const startOfWeek = new Date(date);
    const diff = (startOfWeek.getUTCDay() - startDayIndex + 7) % 7;
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - diff);

    for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setUTCDate(startOfWeek.getUTCDate() + i);
        const dayCell = createDayCell(day, plannerState);
        grid.appendChild(dayCell);
    }

    return grid;
}

export function renderCalendar(plannerState) {
    if (!plannerState || !plannerState.calendar?.view?.month) return;
    checkAndGenerateRecurringChips();
    calendarTrack.innerHTML = '';
    
    autoPlaceStaggerCounter = 0;

    if (currentView === 'monthly') {
        calendarTrack.classList.remove('weekly-view-grid');
        const [monthStr, yearStr] = plannerState.calendar.view.month.split('-');
        const currentYear = parseInt(yearStr, 10);
        const currentMonth = parseInt(monthStr, 10) - 1;

        if (currentYear > getMinDate().year || (currentYear === getMinDate().year && currentMonth > getMinDate().month -1)) {
            const prevDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
            const prevMonthGrid = generateMonthGrid(prevDate, plannerState);
            calendarTrack.appendChild(prevMonthGrid);
        }

        const currentDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        const nextDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1));

        // Reset stagger counter right before rendering the current (visible) grid
        autoPlaceStaggerCounter = 0;
        const currentMonthGrid = generateMonthGrid(currentDate, plannerState);
        const nextMonthGrid = generateMonthGrid(nextDate, plannerState);

        calendarTrack.appendChild(currentMonthGrid);
        calendarTrack.appendChild(nextMonthGrid);

        if (currentYear > getMinDate().year || (currentYear === getMinDate().year && currentMonth > getMinDate().month - 1)) {
            positionTrackAtIndex(1);
        } else {
            positionTrackAtIndex(0);
        }
        // move the translation logic from locale to date formatter

        currentMonthYearHeader.textContent = formatDate(currentDate, { month: 'long', year: 'numeric' });
        renderIncomeChips(currentYear, currentMonth);
    } else if (currentView === 'weekly') {
        calendarTrack.classList.add('weekly-view-grid');
        const [weekStr, yearStr] = plannerState.calendar.view.week.split('-');
        const currentYear = parseInt(yearStr, 10);
        const currentWeek = parseInt(weekStr, 10);

        const currentWeekStartDate = getDateOfWeek(currentWeek, currentYear);
        
        const minDate = new Date(Date.UTC(getMinDate().year, getMinDate().month - 1, 1));
        const [minYearWeek, minWeekNumber] = getISOWeekNumber(minDate);

        if (currentYear > minYearWeek || (currentYear === minYearWeek && currentWeek > minWeekNumber)) {
            const prevWeekDate = new Date(currentWeekStartDate);
            prevWeekDate.setUTCDate(prevWeekDate.getUTCDate() - 7);
            const [prevWeekYear, prevWeekNumber] = getISOWeekNumber(prevWeekDate);
            const prevWeekStartDate = getDateOfWeek(prevWeekNumber, prevWeekYear);
            const prevWeekGrid = generateWeekGrid(prevWeekStartDate, plannerState);
            calendarTrack.appendChild(prevWeekGrid);
        }

        const nextWeekDate = new Date(currentWeekStartDate);
        nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);
        const [nextWeekYear, nextWeekNumber] = getISOWeekNumber(nextWeekDate);
        const nextWeekStartDate = getDateOfWeek(nextWeekNumber, nextWeekYear);

        // Reset stagger counter right before rendering the current (visible) grid
        autoPlaceStaggerCounter = 0;
        const currentWeekGrid = generateWeekGrid(currentWeekStartDate, plannerState);
        const nextWeekGrid = generateWeekGrid(nextWeekStartDate, plannerState);

        calendarTrack.appendChild(currentWeekGrid);
        calendarTrack.appendChild(nextWeekGrid);

        if (currentYear > minYearWeek || (currentYear === minYearWeek && currentWeek > minWeekNumber)) {
            positionTrackAtIndex(1);
        } else {
            positionTrackAtIndex(0);
        }

        // Constrain the display month for chips and header
        const weekEndDate = new Date(currentWeekStartDate);
        weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
        
        let displayMonth = currentWeekStartDate.getUTCMonth();
        let displayYear = currentWeekStartDate.getUTCFullYear();
        
        const minBound = getMinDate();
        const maxBound = getMaxDate();

        // If week starts before min, but ends in or after min, force min
        if (displayYear < minBound.year || (displayYear === minBound.year && displayMonth < minBound.month - 1)) {
            displayMonth = minBound.month - 1;
            displayYear = minBound.year;
        }
        // If week ends after max, but starts in or before max, force max
        else if (weekEndDate.getUTCFullYear() > maxBound.year || (weekEndDate.getUTCFullYear() === maxBound.year && weekEndDate.getUTCMonth() > maxBound.month - 1)) {
            displayMonth = maxBound.month - 1;
            displayYear = maxBound.year;
        }

        const monthName = formatDate(new Date(Date.UTC(displayYear, displayMonth, 1)), { month: 'short' });
        currentMonthYearHeader.textContent = translate('time.weekOfYear', { week: currentWeek, year: currentYear, month: monthName });
        renderIncomeChips(displayYear, displayMonth);
    }
    updateActiveChip();

    if (animateNextRender) {
        setTimeout(() => {
            animateNextRender = false;
        }, 500);
    }
}

function positionTrackAtIndex(index, animated = false) {
    calendarTrack.style.transition = animated ? 'transform 0.3s ease-out' : 'none';
    currentTranslate = -index * calendarContainer.offsetWidth;
    calendarTrack.style.transform = `translateX(${currentTranslate}px)`;

    const activeGrid = calendarTrack.children[index];
    if (activeGrid) {
        requestAnimationFrame(() => {
            const height = activeGrid.offsetHeight;
            if (height > 0) {
                calendarContainer.style.transition = animated ? 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
                calendarContainer.style.height = `${height}px`;
            } else {
                calendarContainer.style.height = '';
            }
        });
    } else {
        calendarContainer.style.height = '';
    }
}

function shiftNext() {
    if (isTransitioning) {
        return;
    }

    const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
    const [weekStr, weeklyYearStr] = state.planner.calendar.view.week.split('-');

    if (currentView === 'monthly') {
        const currentYear = parseInt(yearStr, 10);
        const currentMonth = parseInt(monthStr, 10);

        if (currentYear >= getMaxDate().year && currentMonth >= getMaxDate().month) {
            return snapBack();
        }
    } else {
        const currentWeek = parseInt(weekStr, 10);
        const currentWeeklyYear = parseInt(weeklyYearStr, 10);

        const maxDate = new Date(Date.UTC(getMaxDate().year, getMaxDate().month, 31));
        const currentWeekStartDate = getDateOfWeek(currentWeek, currentWeeklyYear);
        const nextWeekStartDate = new Date(currentWeekStartDate);
        nextWeekStartDate.setUTCDate(nextWeekStartDate.getUTCDate() + 7);

        if (nextWeekStartDate >= maxDate) {
            return snapBack();
        }
    }

    isTransitioning = true;
    const numGrids = calendarTrack.children.length;
    positionTrackAtIndex(numGrids - 1, true);
    calendarTrack.addEventListener('transitionend', onNextReady, { once: true });
}

function onNextReady() {
    isTransitioning = false;

    if (currentView === 'monthly') {
        const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
        const oldYear = parseInt(yearStr, 10);
        const oldMonth0Index = parseInt(monthStr, 10) - 1;
        const newCurrentDate = new Date(Date.UTC(oldYear, oldMonth0Index + 1, 1));
        const [newWeekYear, newWeekNo] = getISOWeekNumber(newCurrentDate);

        handleStateUpdate(() => {
            state.planner.calendar.view.month = `${String(newCurrentDate.getUTCMonth() + 1).padStart(2, '0')}-${newCurrentDate.getUTCFullYear()}`;
            state.planner.calendar.view.week = `${newWeekNo}-${newWeekYear}`;
        });
    } else {
        const [weekStr, yearStr] = state.planner.calendar.view.week.split('-');
        const currentWeek = parseInt(weekStr, 10);
        const currentYear = parseInt(yearStr, 10);

        const currentWeekStartDate = getDateOfWeek(currentWeek, currentYear);
        const nextWeekStartDate = new Date(currentWeekStartDate);
        nextWeekStartDate.setUTCDate(nextWeekStartDate.getUTCDate() + 7);

        const [nextWeekYear, nextWeekNumber] = getISOWeekNumber(nextWeekStartDate);
        
        let nextMonth = nextWeekStartDate.getUTCMonth() + 1;
        let nextYearOfMonth = nextWeekStartDate.getUTCFullYear();

        const minBound = getMinDate();
        const maxBound = getMaxDate();

        if (nextYearOfMonth < minBound.year || (nextYearOfMonth === minBound.year && nextMonth < minBound.month)) {
            nextMonth = minBound.month;
            nextYearOfMonth = minBound.year;
        } else if (nextYearOfMonth > maxBound.year || (nextYearOfMonth === maxBound.year && nextMonth > maxBound.month)) {
            nextMonth = maxBound.month;
            nextYearOfMonth = maxBound.year;
        }

        handleStateUpdate(() => {
            state.planner.calendar.view.week = `${nextWeekNumber}-${nextWeekYear}`;
            state.planner.calendar.view.month = `${String(nextMonth).padStart(2, '0')}-${nextYearOfMonth}`;
        });
    }

    animateNextRender = true;
    renderCalendar(state.planner);
}

function shiftPrev() {
    if (isTransitioning) return;
    const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
    const [weekStr, weeklyYearStr] = state.planner.calendar.view.week.split('-');

    if (currentView === 'monthly') {
        if (parseInt(yearStr, 10) <= getMinDate().year && parseInt(monthStr, 10) <= getMinDate().month) {
            return snapBack();
        }
    } else {
        const minDate = new Date(Date.UTC(getMinDate().year, getMinDate().month - 1, 1));
        const [minYearWeek, minWeekNumber] = getISOWeekNumber(minDate);

        if (parseInt(weeklyYearStr, 10) <= minYearWeek && parseInt(weekStr, 10) <= minWeekNumber) {
            return snapBack();
        }
    }

    isTransitioning = true;
    positionTrackAtIndex(0, true);
    calendarTrack.addEventListener('transitionend', onPrevReady, { once: true });
}

function onPrevReady() {
    if (currentView === 'monthly') {
        const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
        const oldYear = parseInt(yearStr, 10);
        const oldMonth0Index = parseInt(monthStr, 10) - 1;
        const newCurrentDate = new Date(Date.UTC(oldYear, oldMonth0Index - 1, 1));
        const [newWeekYear, newWeekNo] = getISOWeekNumber(newCurrentDate);

        handleStateUpdate(() => {
            state.planner.calendar.view.month = `${String(newCurrentDate.getUTCMonth() + 1).padStart(2, '0')}-${newCurrentDate.getUTCFullYear()}`;
            state.planner.calendar.view.week = `${newWeekNo}-${newWeekYear}`;
        });
    } else {
        let [weekStr, yearStr] = state.planner.calendar.view.week.split('-');
        let week = parseInt(weekStr, 10) - 1;
        let year = parseInt(yearStr, 10);
        
        if (week < 1) {
            const lastWeekOfPrevYear = new Date(Date.UTC(year - 1, 11, 31));
            const [prevYearWeek, prevYearNumber] = getISOWeekNumber(lastWeekOfPrevYear);
            week = prevYearNumber;
            year = prevYearWeek;
        }

        const newStartDate = getDateOfWeek(week, year);
        let newMonth = newStartDate.getUTCMonth() + 1;
        let newYearOfMonth = newStartDate.getUTCFullYear();

        const minBound = getMinDate();
        const maxBound = getMaxDate();

        if (newYearOfMonth < minBound.year || (newYearOfMonth === minBound.year && newMonth < minBound.month)) {
            newMonth = minBound.month;
            newYearOfMonth = minBound.year;
        } else if (newYearOfMonth > maxBound.year || (newYearOfMonth === maxBound.year && newMonth > maxBound.month)) {
            newMonth = maxBound.month;
            newYearOfMonth = maxBound.year;
        }

        handleStateUpdate(() => {
            state.planner.calendar.view.week = `${week}-${year}`;
            state.planner.calendar.view.month = `${String(newMonth).padStart(2, '0')}-${newYearOfMonth}`;
        });
    }

    animateNextRender = true;
    renderCalendar(state.planner);
    isTransitioning = false;
}

function snapBack() {
    positionTrackAtIndex(1, true);
}

function handleTouchStart(e) {
    if (state.isChipDragging || isTransitioning) return;
    isSwiping = true;
    touchStartX = e.touches[0].clientX;
    prevTranslate = -calendarContainer.offsetWidth;
    calendarTrack.style.transition = 'none';
}

function handleTouchMove(e) {
    if (state.isChipDragging || !isSwiping || isTransitioning) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX;
    currentTranslate = prevTranslate + diff;
    calendarTrack.style.transform = `translateX(${currentTranslate}px)`;
}

function handleTouchEnd() {
    if (isTransitioning || !isSwiping) return;
    isSwiping = false;
    const movedBy = currentTranslate - prevTranslate;
    const threshold = calendarContainer.offsetWidth / 4;

    if (movedBy < -threshold) {
        shiftNext();
    } else if (movedBy > threshold) {
        shiftPrev();
    } else {
        snapBack();
    }
}

function handleWheel(e) {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        return; 
    }
    e.preventDefault();

    clearTimeout(wheelDebounceTimeout);

    if (canScroll && !isTransitioning) {
        canScroll = false;
        if (e.deltaX > 0) {
            shiftNext();
        } else if (e.deltaX < 0) {
            shiftPrev();
        }
    }

    wheelDebounceTimeout = setTimeout(() => {
        canScroll = true;
    }, 50); 
}

function getWeeksInMonth(year, month) {
    const weeks = [];
    const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0));

    let currentDay = new Date(firstDayOfMonth);
    while (currentDay <= lastDayOfMonth) {
        const [weekYear, weekNumber] = getISOWeekNumber(currentDay);
        const weekKey = `${weekNumber}-${weekYear}`;
        if (!weeks.some(w => w.key === weekKey)) {
            weeks.push({ key: weekKey, number: weekNumber, year: weekYear });
        }
        currentDay.setUTCDate(currentDay.getUTCDate() + 7); 
    }
    return weeks;
}

function renderMonthChips() {
    monthChipContainer.innerHTML = '';
    let currentYear = 0;

    for (let year = getMinDate().year; year <= getMaxDate().year; year++) {
        const startMonth = (year === getMinDate().year) ? getMinDate().month : 1;
        const endMonth = (year === getMaxDate().year) ? getMaxDate().month : 12;

        const yearLabel = document.createElement('div');
        yearLabel.classList.add('year-label');
        yearLabel.textContent = year;
        monthChipContainer.appendChild(yearLabel);

        for (let month = startMonth; month <= endMonth; month++) {
            const chip = document.createElement('div');
            chip.classList.add('month-chip');
            chip.setAttribute('tabindex', '0');
            chip.setAttribute('role', 'button');
            const monthDate = new Date(Date.UTC(year, month - 1, 1));
            const monthNameSpan = document.createElement('span'); 
            monthNameSpan.classList.add('month-name');
            const monthName = formatDate(monthDate, { month: 'short' });
            monthNameSpan.textContent = monthName;

            chip.appendChild(monthNameSpan); 
            chip.dataset.year = year;
            chip.dataset.month = String(month).padStart(2, '0');
            chip.addEventListener('click', handleMonthChipClick);
            chip.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleMonthChipClick(e);
                }
            });

            const weekNumbersContainer = document.createElement('div');
            weekNumbersContainer.classList.add('week-numbers-container');
            chip.appendChild(weekNumbersContainer);

            const weeksInMonth = getWeeksInMonth(year, month);
            weeksInMonth.forEach(week => {
                const weekChip = document.createElement('div');
                weekChip.classList.add('week-chip');
                weekChip.setAttribute('tabindex', '0');
                weekChip.setAttribute('role', 'button');
                weekChip.textContent = week.number;
                weekChip.dataset.year = week.year;
                weekChip.dataset.week = week.number;
                weekChip.addEventListener('click', handleWeekChipClick);
                weekChip.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleWeekChipClick(e);
                    }
                });
                weekNumbersContainer.appendChild(weekChip);
            });

            monthChipContainer.appendChild(chip);
        }
    }
    updateActiveChip();
}

function handleMonthChipClick(e) {
    const year = e.currentTarget.dataset.year;
    const month = e.currentTarget.dataset.month;
    const newMonth = `${month}-${year}`;

    if (state.planner.calendar.view.month !== newMonth) {
        handleStateUpdate(() => {
            state.planner.calendar.view.month = newMonth;
            const firstDayOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
            const [firstWeekYear, firstWeekNumber] = getISOWeekNumber(firstDayOfMonth);
            state.planner.calendar.view.week = `${firstWeekNumber}-${firstWeekYear}`;
        });
        animateNextRender = true;
        renderCalendar(state.planner);
    }
}

function handleWeekChipClick(e) {
    e.stopPropagation(); 
    const year = e.currentTarget.dataset.year;
    const week = e.currentTarget.dataset.week;
    const newWeek = `${week}-${year}`;

    if (state.planner.calendar.view.week !== newWeek) {
        handleStateUpdate(() => {
            state.planner.calendar.view.week = newWeek;
        });
        animateNextRender = true;
        renderCalendar(state.planner);
    }
}

function updateActiveChip() {
    if (!state.planner || !state.planner.calendar.view.month || !state.planner.calendar.view.week) return;
    const [currentMonth, currentYear] = state.planner.calendar.view.month.split('-');
    const [currentWeek, currentWeekYear] = state.planner.calendar.view.week.split('-');

    const chips = monthChipContainer.querySelectorAll('.month-chip');
    
    chips.forEach(chip => {
        if (chip.dataset.year === currentYear && chip.dataset.month === currentMonth) {
            chip.classList.add('active');

            const weekNumbersContainer = chip.querySelector('.week-numbers-container');
            if (currentView === 'weekly') {
                weekNumbersContainer.style.display = 'flex'; 
            } else {
                weekNumbersContainer.style.display = 'none'; 
            }

            const weekChips = chip.querySelectorAll('.week-chip');
            weekChips.forEach(weekChip => {
                if (weekChip.dataset.year === currentWeekYear && weekChip.dataset.week === currentWeek) {
                    weekChip.classList.add('active');
                } else {
                    weekChip.classList.remove('active');
                }
            });
        } else {
            chip.classList.remove('active');
            const weekNumbersContainer = chip.querySelector('.week-numbers-container');
            if (weekNumbersContainer) {
                weekNumbersContainer.style.display = 'none';
            }
            chip.querySelectorAll('.week-chip').forEach(weekChip => weekChip.classList.remove('active'));
        }
    });
}

function handleMediaQueryChange(event) {
    currentView = event.matches ? 'weekly' : 'monthly';
    renderCalendar(state.planner);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const chipContainer = e.currentTarget;
    if (!chipContainer) return;
    chipContainer.classList.remove('valid-drop-target', 'invalid-drop-target');
    if (chipContainer.classList.contains('duplicate-chip-type')) {
        chipContainer.classList.add('invalid-drop-target');
    } else if (chipContainer.classList.contains('valid-drop-range')) {
        chipContainer.classList.add('valid-drop-target');
    } else {
        chipContainer.classList.add('invalid-drop-target');
    }
}

function handleDragLeave(e) {
    const chipContainer = e.currentTarget;
    if (!chipContainer) return;
    chipContainer.classList.remove('valid-drop-target', 'invalid-drop-target');
}

function handleDrop(e) {
    e.preventDefault();
    const chipContainer = e.currentTarget;
    const incomeChipData = JSON.parse(e.dataTransfer.getData('text/plain'));
    handleChipDropOnCalendar(incomeChipData, chipContainer);
}

export function handleChipDropOnCalendar(incomeChipData, chipContainer) {
    if (!chipContainer || !chipContainer.classList.contains('valid-drop-range')) return;
    chipContainer.classList.remove('valid-drop-target', 'invalid-drop-target');
    const isAssistedProspector = incomeChipData.type === 'prospector' && state.income?.prospector?.assistedConversion;
    if ((incomeChipData.type === 'starBonus' || incomeChipData.type === 'prospector') && !incomeChipData.isCustom && !isAssistedProspector) return;

    const targetDate = chipContainer.closest('.day-cell').dataset.date;
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
        const monthYearKey = `${month}-${year}`;

        let swapped = false;
        if (incomeChipData.type === 'prospector' && incomeChipData.originalDate) {
            const [origYear, origMonth, origDay] = incomeChipData.originalDate.split('-');
            const origMonthYearKey = `${origMonth}-${origYear}`;

            const targetChips = state.planner.calendar.dates[monthYearKey]?.[day] || [];
            let targetProspectorId = targetChips.find(id => id.replace(/^custom-/, '').startsWith('prospector'));
            
            if (!targetProspectorId && state.income.prospector && state.income.prospector.goldPass) {
                targetProspectorId = `prospector-${parseInt(day, 10)}-${month}-${year}-cal`;
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
            // Remove from customChips list
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

        // Collision Rules
        const baseDraggedType = draggedType.replace(/^custom-/, '');

        // 1. Gem Trader: coexists, do nothing to replace!
        if (baseDraggedType === 'gemTrader') {
            // Coexists
        }
        // 2. Star Bonus multiplier:
        else if (baseDraggedType.startsWith('starBonus')) {
             const hasAutoMultiplier = existingChips.some(id => id.startsWith('starBonus') && id.endsWith('-auto'));
             if (hasAutoMultiplier && incomeChipData.isCustom) {
                  console.warn(`[Calendar] Cannot place manually created multiplier chip on an already auto placed multiplier`);
                  return;
             }
             // Replace existing manual multiplier if any
             const existingManualIndex = existingChips.findIndex(id => id.startsWith('starBonus') && !id.endsWith('-auto'));
             if (existingManualIndex > -1) {
                  existingChips.splice(existingManualIndex, 1);
             }
        }
        // 3. Shop Offers, Event Trader, Supercell Events:
        else if (baseDraggedType === 'shopOffers' || baseDraggedType === 'eventTrader' || baseDraggedType === 'supercellEvents') {
             const hasAutoChip = existingChips.some(id => id.startsWith(baseDraggedType) && id.endsWith('-auto'));
             if (hasAutoChip) {
                 console.warn(`[Calendar] Cannot place manual chip on an auto-placed ${baseDraggedType}`);
                 return;
             }
             // Replace existing manual chip
             const existingManualIndex = existingChips.findIndex(id => id.startsWith(baseDraggedType) && !id.endsWith('-auto'));
             if (existingManualIndex > -1) {
                 existingChips.splice(existingManualIndex, 1);
             }
        }
        // 4. Clan War, CWL, Prospector:
        else if (baseDraggedType === 'clanWar' || baseDraggedType === 'cwl' || baseDraggedType === 'prospector') {
             // Replace any existing chip of the same base type (auto or manual)
             const existingIndex = existingChips.findIndex(id => {
                 const cleanId = id.replace(/^custom-/, '');
                 return cleanId.startsWith(baseDraggedType);
             });
             if (existingIndex > -1) {
                 existingChips.splice(existingIndex, 1);
             }
        }
        // 5. Generic Custom Chip
        else if (draggedType === 'custom' || draggedType === 'extras' || draggedType.startsWith('custom-') || draggedType.startsWith('extras')) {
             // Avoid duplicate of same customType name
             const draggedCustomType = incomeChipData.customType || '';
             const existingIdx = existingChips.findIndex(id => {
                 const existingCustomType = state.planner.calendar.customChipData?.[id]?.customType || '';
                 return existingCustomType === draggedCustomType && id !== newId;
             });
             if (existingIdx > -1) {
                 existingChips.splice(existingIdx, 1);
             }
        }
        else {
            // Default duplicate check
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
                const maxDay = existingDays[existingDays.length - 1];
                for (let fillDay = minDay + 1; fillDay < maxDay; fillDay++) {
                    const paddedDay = String(fillDay).padStart(2, '0');
                    if (!monthDays[paddedDay]) monthDays[paddedDay] = [];
                    if (!monthDays[paddedDay].some(id => id.startsWith(draggedType))) {
                        // Use a dummy instance '00', reindex will fix it
                        const newAutoId = `${draggedType}-00-${month}-${year}-cal-auto`;
                        monthDays[paddedDay].push(newAutoId);
                    }
                }
            }
        }

        const incomeSource = getSourceById(draggedType);
        if (!(incomeSource?.schedule?.type === 'weekly')) {
            reindexCalendarChips(draggedType);
        }
    });

    renderCalendar(state.planner);
    if (state.planner?.calendar?.view?.month) {
        renderIncomeChips(state.planner.calendar.view.month.split('-')[1], parseInt(state.planner.calendar.view.month.split('-')[0], 10) - 1);
    }

    // Add pulse effect for confirmation
    const dayCell = document.querySelector(`.day-cell[data-date="${targetDate}"]`);
    if (dayCell) {
        dayCell.classList.add('drop-pulse');
        setTimeout(() => {
            dayCell.classList.remove('drop-pulse');
        }, 600);
    }
}

function handleDayCellMouseEnter(e) {
    const dayCell = e.currentTarget;
    const dateString = dayCell.dataset.date;
    const [year, month, day] = dateString.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (targetDate < today) return;

    // Ensure only one date tooltip exists
    const existingTooltip = document.getElementById('active-calendar-tooltip');
    if (existingTooltip) existingTooltip.remove();

    const cumulativeOres = calculateCumulativeOres(targetDate, state.storedOres);
    const formattedDate = formatDate(targetDate, { month: 'short', day: 'numeric', weekday: 'short' });

    const tooltip = document.createElement('div');
    tooltip.classList.add('ore-tooltip');
    tooltip.id = 'active-calendar-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">${formattedDate}</div>
        <div class="ore-count-item"><span>${formatNumber(cumulativeOres.shiny)}</span> <orecalc-assets-image src="assets/shiny_ore.png" alt="${translate('ores.shiny')}" class="ore-icon-small"></orecalc-assets-image></div>
        <div class="ore-count-item"><span>${formatNumber(cumulativeOres.glowy)}</span> <orecalc-assets-image src="assets/glowy_ore.png" alt="${translate('ores.glowy')}" class="ore-icon-small"></orecalc-assets-image></div>
        <div class="ore-count-item"><span>${formatNumber(cumulativeOres.starry)}</span> <orecalc-assets-image src="assets/starry_ore.png" alt="${translate('ores.starry')}" class="ore-icon-small"></orecalc-assets-image></div>
    `;
    
    document.body.appendChild(tooltip);

    const rect = dayCell.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let left = rect.left + rect.width / 2 + scrollX;
    let top = rect.top + scrollY - 10;

    tooltip.style.position = 'absolute';
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = 'translate(-50%, -100%)';

    // Boundary check
    const tooltipRect = tooltip.getBoundingClientRect();
    if (tooltipRect.left < 10) {
        tooltip.style.left = `${10 + tooltipRect.width / 2 + scrollX}px`;
    } else if (tooltipRect.right > window.innerWidth - 10) {
        tooltip.style.left = `${window.innerWidth - 10 - tooltipRect.width / 2 + scrollX}px`;
    }
}

function handleDayCellMouseLeave(e) {
    const tooltip = document.getElementById('active-calendar-tooltip');
    if (tooltip) tooltip.remove();
}

const mediaQuery = window.matchMedia('(max-width: 630px)');

document.addEventListener('DOMContentLoaded', () => {
    calendarContainer.addEventListener('wheel', handleWheel, { passive: false });
    calendarContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    calendarContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    calendarContainer.addEventListener('touchend', handleTouchEnd);
    calendarContainer.addEventListener('touchcancel', handleTouchEnd);

    mediaQuery.addEventListener('change', handleMediaQueryChange);
    handleMediaQueryChange(mediaQuery);

    window.addEventListener('resize', () => {
        if (currentView === 'monthly' || currentView === 'weekly') {
            const activeIndex = Math.max(0, calendarTrack.children.length - 2);
            positionTrackAtIndex(activeIndex);
        }
    });

    deleteCurrentMonthChipsBtn.addEventListener('click', async () => {
        const confirm = await showConfirm(translate('planner.confirmDeleteMonth'));
        if (!confirm) return;
        handleStateUpdate(() => {
            if (!state.planner?.calendar?.view?.month) return;
            const [month, year] = state.planner.calendar.view.month.split('-');
            const monthYearKey = `${month}-${year}`;
            if (state.planner.calendar.dates[monthYearKey]) {
                delete state.planner.calendar.dates[monthYearKey];
            }
        });
        animateNextRender = true;
        renderCalendar(state.planner);
    });

    deleteAllChipsBtn.addEventListener('click', async () => {
        const confirm = await showConfirm(translate('planner.confirmDeleteAll'));
        if (!confirm) return;
        handleStateUpdate(() => {
            state.planner.calendar.dates = {};
            state.planner.calendar.customChips = [];
            state.planner.calendar.customChipData = {};
        });
        animateNextRender = true;
        renderCalendar(state.planner);
        if (state.planner?.calendar?.view?.month) {
            const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
            renderIncomeChips(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1);
        }
    });

    if (autoPlaceChipsBtn) {
        autoPlaceChipsBtn.addEventListener('click', () => {
            const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
            setAnimateNextRender('auto-placed');
            autoPlaceIncomeChips(monthStr, yearStr);
        });
    }

    calendarSettingsBtn.addEventListener('click', () => {
        const settings = state.planner.calendar.settings;
        firstDaySelect.value = settings.firstDayOfWeek;
        showIconsSwitch.checked = settings.showChipIcons;
        autoPlaceScopeSelect.value = settings.autoPlaceScope;
        calendarSettingsModal.classList.add('show');
    });

    closeCalendarSettingsModalBtn.addEventListener('click', () => {
        calendarSettingsModal.classList.remove('show');
    });

    cancelCalendarSettingsBtn.addEventListener('click', () => {
        calendarSettingsModal.classList.remove('show');
    });

    saveCalendarSettingsBtn.addEventListener('click', () => {
        handleStateUpdate(() => {
            state.planner.calendar.settings = {
                firstDayOfWeek: firstDaySelect.value,
                showChipIcons: showIconsSwitch.checked,
                autoPlaceScope: autoPlaceScopeSelect.value
            };
        });
        calendarSettingsModal.classList.remove('show');
        animateNextRender = true;
        renderCalendar(state.planner);
    });

    document.addEventListener('languageChanged', () => {
        animateNextRender = true;
        renderCalendar(state.planner);
        renderMonthChips();
    });
});
