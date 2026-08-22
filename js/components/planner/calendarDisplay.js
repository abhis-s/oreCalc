import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { checkAndGenerateRecurringChips } from '../../utils/chipManager.js';
import { formatDate, getDateOfWeek, getISOWeekNumber, getMaxDate, getMinDate } from '../../utils/dateUtils.js';

import { generateMonthGrid, generateWeekGrid } from './calendarGridRenderer.js';
import {
    renderMonthChips,
    updateActiveChip,
    updateHeader
} from './calendarMonthChipsRenderer.js';
import { getCurrentView, getEquipmentSchedule, setCurrentView } from './calendarScheduler.js';
import { renderIncomeChips } from './incomeChipsDisplay.js';

let animateNextRender = false;
let animationBaseDelay = 0.2;
let activeEquipmentSchedule = { milestones: {}, ranges: [] };

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
    animationBaseDelay = delay;
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

    const currentView = getCurrentView();

    if (currentView === 'monthly') {
        calendarTrack.classList.remove('weekly-view-grid');
        const [yearStr, monthStr] = plannerState.calendar.view.month.split('-');
        const currentYear = parseInt(yearStr, 10);
        const currentMonth = parseInt(monthStr, 10) - 1;

        if (currentYear > getMinDate().year || (currentYear === getMinDate().year && currentMonth > getMinDate().month - 1)) {
            const prevDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
            const prevMonthGrid = generateMonthGrid(prevDate, plannerState, activeEquipmentSchedule);
            calendarTrack.appendChild(prevMonthGrid);
        }

        const currentDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        const nextDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1));

        const currentMonthGrid = generateMonthGrid(currentDate, plannerState, activeEquipmentSchedule);
        const nextMonthGrid = generateMonthGrid(nextDate, plannerState, activeEquipmentSchedule);

        calendarTrack.appendChild(currentMonthGrid);
        calendarTrack.appendChild(nextMonthGrid);

        if (currentYear > getMinDate().year || (currentYear === getMinDate().year && currentMonth > getMinDate().month - 1)) {
            positionTrackAtIndex(1);
        } else {
            positionTrackAtIndex(0);
        }

        updateHeader(formatDate(currentDate, { month: 'long', year: 'numeric' }));
        renderIncomeChips(currentYear, currentMonth);
    } else if (currentView === 'weekly') {
        calendarTrack.classList.add('weekly-view-grid');
        const [yearStr, weekStr] = plannerState.calendar.view.week.split('-');
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
            const prevWeekGrid = generateWeekGrid(prevWeekStartDate, plannerState, activeEquipmentSchedule);
            calendarTrack.appendChild(prevWeekGrid);
        }

        const nextWeekDate = new Date(currentWeekStartDate);
        nextWeekDate.setUTCDate(nextWeekDate.getUTCDate() + 7);
        const [nextWeekYear, nextWeekNumber] = getISOWeekNumber(nextWeekDate);
        const nextWeekStartDate = getDateOfWeek(nextWeekNumber, nextWeekYear);

        const currentWeekGrid = generateWeekGrid(currentWeekStartDate, plannerState, activeEquipmentSchedule);
        const nextWeekGrid = generateWeekGrid(nextWeekStartDate, plannerState, activeEquipmentSchedule);

        calendarTrack.appendChild(currentWeekGrid);
        calendarTrack.appendChild(nextWeekGrid);

        if (currentYear > minYearWeek || (currentYear === minYearWeek && currentWeek > minWeekNumber)) {
            positionTrackAtIndex(1);
        } else {
            positionTrackAtIndex(0);
        }

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

        const monthName = formatDate(new Date(Date.UTC(displayYear, displayMonth, 1)), { month: 'short' });
        updateHeader(translate('time.weekOfYear', { week: currentWeek, year: currentYear, month: monthName }));
        renderIncomeChips(displayYear, displayMonth);
    }
    updateActiveChip();

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
