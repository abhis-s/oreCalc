import { translate } from '../../i18n/translator.js';

import { selectIsEquipmentMaxed } from '../../core/selectors.js';
import { state } from '../../core/state.js';

import { checkAndGenerateRecurringChips } from '../../utils/chipManager.js';
import { formatDate, getDateOfWeek, getISOWeekNumber, getMaxDate, getMinDate } from '../../utils/dateUtils.js';

import { generateMonthGrid, generateWeekGrid } from './calendarGridDisplay.js';
import {
    renderMonthChips,
    updateActiveChip,
    updateHeader
} from './calendarMonthChipsDisplay.js';
import { getCurrentView, getEquipmentSchedule } from './calendarScheduler.js';
import { renderIncomeChips } from './incomeChipsDisplay.js';
import { calculateStorageForecast } from '../../domain/equipment/storageForecastDomain.js';

let animateNextRender = false;
let activeEquipmentSchedule = { milestones: {}, ranges: [] };
let activeStorageForecast = null;

/**
 * Gets the current active storage forecast.
 * @returns {any}
 */
export function getActiveStorageForecast() {
    return activeStorageForecast;
}

/**
 * Renders the compact storage full countdown strip above the calendar track.
 *
 * @param {HTMLElement | null} container
 * @param {any} forecast
 */
function renderStorageCountdownStrip(container, forecast) {
    if (!container) return;

    if (!forecast || !forecast.firstFullDates) {
        container.hidden = true;
        container.innerHTML = '';
        return;
    }

    const ores = /** @type {Array<'shiny'|'glowy'|'starry'>} */ (['shiny', 'glowy', 'starry']);
    const pills = ores.map(ore => {
        const fullInfo = forecast.firstFullDates[ore];
        if (!fullInfo) return '';

        const oreName = translate(`entities.ores.${ore}`);
        const isFull = fullInfo.alreadyFull;
        const pillText = isFull
            ? translate('views.planner.storageAlreadyFull', { ore: oreName })
            : translate('views.planner.storageFullInDays', { ore: oreName, days: fullInfo.daysFromToday });

        const fullClass = isFull ? ' pill--full' : '';
        return `
            <button type="button" class="storage-countdown-pill${fullClass} pill--${ore}" data-target-date="${fullInfo.dateStr}">
                <clashcalc-assets-image src="assets/${ore}_ore.png" class="storage-countdown-icon"></clashcalc-assets-image>
                <span class="storage-countdown-text">${pillText}</span>
            </button>
        `;
    }).filter(Boolean);

    if (pills.length === 0) {
        container.hidden = true;
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="calendar-storage-countdown-inner">
            <span class="storage-countdown-title">
                <clashcalc-assets-svg name="timer" class="storage-countdown-title-icon"></clashcalc-assets-svg>
                <span data-i18n="views.planner.storageCountdownStrip">${translate('views.planner.storageCountdownStrip')}</span>
            </span>
            <div class="storage-countdown-pills">
                ${pills.join('')}
            </div>
        </div>
    `;
    container.hidden = false;
}

/**
 * Positions the calendar carousel track at the specified index.
 * @param {number} index
 * @param {boolean} [animated=false]
 */
export function positionTrackAtIndex(index, animated = false) {
    const calendarContainer = document.getElementById('calendar-container');
    const calendarTrack = document.getElementById('calendar-track');
    if (!calendarContainer || !calendarTrack) return;

    calendarTrack.style.transition = animated ? 'transform 0.3s ease-out' : 'none';
    const currentTranslate = -index * calendarContainer.offsetWidth;
    calendarTrack.style.transform = `translateX(${currentTranslate}px)`;

    const activeGrid = calendarTrack.children[index];
    if (activeGrid) {
        requestAnimationFrame(() => {
            const height = /** @type {HTMLElement} */ (activeGrid).offsetHeight;
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

/**
 * Sets animation parameters for the next calendar render.
 * @param {boolean|string} [val]
 * @param {number} [delay=0.2]
 */
export function setAnimateNextRender(val, delay = 0.2) {
    animateNextRender = false;
}

/**
 * Renders the full calendar track grids, headers, and unplaced income chips.
 * @param {Object} plannerState
 */
export function renderCalendar(plannerState) {
    if (!plannerState || !plannerState.calendar?.view?.month) return;

    const isPlannerTab = state.activeTab === 'planner-tab';
    if (!isPlannerTab) {
        plannerState.calendar.isDirty = true;
        return;
    }

    plannerState.calendar.isDirty = false;

    checkAndGenerateRecurringChips();

    const calendarContainer = document.getElementById('calendar-container');
    const calendarTrack = document.getElementById('calendar-track');
    if (!calendarTrack) return;

    const previousHeight = calendarContainer ? calendarContainer.offsetHeight : 0;
    if (previousHeight > 0 && calendarContainer) {
        calendarContainer.style.minHeight = `${previousHeight}px`;
    }

    calendarTrack.innerHTML = '';

    const settings = state.planner.calendar.settings;
    if (settings.showEquipmentMilestones !== false || settings.highlightUpgradeRanges !== false) {
        activeEquipmentSchedule = getEquipmentSchedule();
    } else {
        activeEquipmentSchedule = { milestones: {}, ranges: [] };
    }

    const countdownStrip = document.getElementById('calendar-storage-countdown-strip');
    const isEquipmentMaxed = selectIsEquipmentMaxed(state);
    const showStorageMilestones = isEquipmentMaxed && settings.showStorageMilestones !== false;
    if (showStorageMilestones) {
        const today = new Date();
        const maxBound = getMaxDate();
        const endDate = new Date(Date.UTC(maxBound.year, maxBound.month, 0));
        activeStorageForecast = calculateStorageForecast(state, today, endDate, activeEquipmentSchedule);
        renderStorageCountdownStrip(countdownStrip, activeStorageForecast);
    } else {
        activeStorageForecast = null;
        if (countdownStrip) {
            countdownStrip.hidden = true;
            countdownStrip.innerHTML = '';
        }
    }

    const currentView = getCurrentView();

    if (currentView === 'monthly') {
        calendarTrack.classList.remove('weekly-view-grid');
        const [yearStr, monthStr] = plannerState.calendar.view.month.split('-');
        const currentYear = parseInt(yearStr, 10);
        const currentMonth = parseInt(monthStr, 10) - 1;

        const currentDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        const currentMonthGrid = generateMonthGrid(currentDate, plannerState, activeEquipmentSchedule, activeStorageForecast);
        calendarTrack.appendChild(currentMonthGrid);
        positionTrackAtIndex(0);

        const currentLang = state.uiSettings?.language || 'en';
        updateHeader(formatDate(currentDate, { month: 'long', year: 'numeric' }, currentLang));
        renderIncomeChips(currentYear, currentMonth);

        // Mount adjacent swipe buffer months progressively in next frame to minimize main-thread work
        const hasPrev = currentYear > getMinDate().year || (currentYear === getMinDate().year && currentMonth > getMinDate().month - 1);
        requestAnimationFrame(() => {
            if (calendarTrack.children.length === 1 && calendarTrack.contains(currentMonthGrid)) {
                if (hasPrev) {
                    const prevDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
                    const prevMonthGrid = generateMonthGrid(prevDate, plannerState, activeEquipmentSchedule, activeStorageForecast);
                    calendarTrack.insertBefore(prevMonthGrid, currentMonthGrid);
                }
                const nextDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1));
                const nextMonthGrid = generateMonthGrid(nextDate, plannerState, activeEquipmentSchedule, activeStorageForecast);
                calendarTrack.appendChild(nextMonthGrid);

                positionTrackAtIndex(hasPrev ? 1 : 0);
            }
        });
    } else if (currentView === 'weekly') {
        calendarTrack.classList.add('weekly-view-grid');
        const [yearStr, weekStr] = plannerState.calendar.view.week.split('-');
        const currentYear = parseInt(yearStr, 10);
        const currentWeek = parseInt(weekStr, 10);

        const currentWeekStartDate = getDateOfWeek(currentWeek, currentYear);
        const currentWeekGrid = generateWeekGrid(currentWeekStartDate, plannerState, activeEquipmentSchedule, activeStorageForecast);
        calendarTrack.appendChild(currentWeekGrid);
        positionTrackAtIndex(0);

        const minDate = new Date(Date.UTC(getMinDate().year, getMinDate().month - 1, 1));
        const [minYearWeek, minWeekNumber] = getISOWeekNumber(minDate);
        const hasPrevWeek = currentYear > minYearWeek || (currentYear === minYearWeek && currentWeek > minWeekNumber);

        requestAnimationFrame(() => {
            if (calendarTrack.children.length === 1 && calendarTrack.contains(currentWeekGrid)) {
                if (hasPrevWeek) {
                    const prevWeekDate = new Date(currentWeekStartDate);
                    prevWeekDate.setUTCDate(prevWeekDate.getUTCDate() - 7);
                    const [prevWeekYear, prevWeekNumber] = getISOWeekNumber(prevWeekDate);
                    const prevWeekStartDate = getDateOfWeek(prevWeekNumber, prevWeekYear);
                    const prevWeekGrid = generateWeekGrid(prevWeekStartDate, plannerState, activeEquipmentSchedule, activeStorageForecast);
                    calendarTrack.insertBefore(prevWeekGrid, currentWeekGrid);
                }
                const nextWeekDate = new Date(currentWeekStartDate);
                nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);
                const [nextWeekYear, nextWeekNumber] = getISOWeekNumber(nextWeekDate);
                const nextWeekStartDate = getDateOfWeek(nextWeekNumber, nextWeekYear);
                const nextWeekGrid = generateWeekGrid(nextWeekStartDate, plannerState, activeEquipmentSchedule, activeStorageForecast);
                calendarTrack.appendChild(nextWeekGrid);

                positionTrackAtIndex(hasPrevWeek ? 1 : 0);
            }
        });

        const weekEndDate = new Date(currentWeekStartDate);
        weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);

        let displayMonth = currentWeekStartDate.getUTCMonth();
        let displayYear = currentWeekStartDate.getUTCFullYear();

        const minBound = getMinDate();
        const maxBound = getMaxDate();

        if (displayYear < minBound.year || (displayYear === minBound.year && displayMonth < minBound.month - 1)) {
            displayMonth = minBound.month - 1;
            displayYear = minBound.year;
        } else if (weekEndDate.getUTCFullYear() > maxBound.year || (weekEndDate.getUTCFullYear() === maxBound.year && weekEndDate.getUTCMonth() > maxBound.month - 1)) {
            displayMonth = maxBound.month - 1;
            displayYear = maxBound.year;
        }

        const currentLang = state.uiSettings?.language || 'en';
        const monthName = formatDate(new Date(Date.UTC(displayYear, displayMonth, 1)), { month: 'short' }, currentLang);
        updateHeader(translate('time.weekOfYear', { week: currentWeek, year: currentYear, month: monthName }));
        renderIncomeChips(displayYear, displayMonth);
    }

    const monthChipContainer = document.getElementById('month-chip-container');
    if (monthChipContainer && monthChipContainer.children.length === 0) {
        renderMonthChips();
    } else {
        updateActiveChip();
    }

    if (animateNextRender) {
        setTimeout(() => {
            animateNextRender = false;
        }, 500);
    }

    requestAnimationFrame(() => {
        if (calendarContainer) {
            calendarContainer.style.minHeight = '';
        }
    });
}
