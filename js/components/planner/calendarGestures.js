import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { getDateOfWeek, getISOWeekNumber, getMaxDate, getMinDate } from '../../utils/dateUtils.js';

import { positionTrackAtIndex, renderCalendar, setAnimateNextRender } from './calendarDisplay.js';
import { getCurrentView, setCurrentView } from './calendarScheduler.js';

let isSwiping = false;
let touchDirection = null;
let touchStartX = 0;
let touchStartY = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let isTransitioning = false;
let canScroll = true;
let wheelDebounceTimeout = null;

/**
 * Resolves the active track index (0 or 1) based on current view and boundaries.
 * @returns {number}
 */
function getActiveTrackIndex() {
    if (!state.planner?.calendar?.view?.month) return 1;

    const [yearStr, monthStr] = state.planner.calendar.view.month.split('-');
    const [weeklyYearStr, weekStr] = (state.planner.calendar.view.week || '').split('-');

    if (getCurrentView() === 'monthly') {
        const currentYear = parseInt(yearStr, 10);
        const currentMonth = parseInt(monthStr, 10) - 1;
        const hasPrev = currentYear > getMinDate().year || (currentYear === getMinDate().year && currentMonth > getMinDate().month - 1);
        return hasPrev ? 1 : 0;
    }

    const currentYear = parseInt(weeklyYearStr, 10);
    const currentWeek = parseInt(weekStr, 10);
    const minDate = new Date(Date.UTC(getMinDate().year, getMinDate().month - 1, 1));
    const [minYearWeek, minWeekNumber] = getISOWeekNumber(minDate);
    const hasPrev = currentYear > minYearWeek || (currentYear === minYearWeek && currentWeek > minWeekNumber);
    return hasPrev ? 1 : 0;
}

/**
 * Resets calendar sliding track translation back to the current active page position with animation.
 */
export function snapBack() {
    positionTrackAtIndex(getActiveTrackIndex(), true);
}

function onNextReady() {
    isTransitioning = false;

    if (getCurrentView() === 'monthly') {
        const [yearStr, monthStr] = state.planner.calendar.view.month.split('-');
        const oldYear = parseInt(yearStr, 10);
        const oldMonth0Index = parseInt(monthStr, 10) - 1;
        const newCurrentDate = new Date(Date.UTC(oldYear, oldMonth0Index + 1, 1));
        const [newWeekYear, newWeekNo] = getISOWeekNumber(newCurrentDate);

        handleStateUpdate(() => {
            state.planner.calendar.view.month = `${newCurrentDate.getUTCFullYear()}-${String(newCurrentDate.getUTCMonth() + 1).padStart(2, '0')}`;
            state.planner.calendar.view.week = `${newWeekYear}-${String(newWeekNo).padStart(2, '0')}`;
        });
    } else {
        const [yearStr, weekStr] = state.planner.calendar.view.week.split('-');
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
            state.planner.calendar.view.week = `${nextWeekYear}-${String(nextWeekNumber).padStart(2, '0')}`;
            state.planner.calendar.view.month = `${nextYearOfMonth}-${String(nextMonth).padStart(2, '0')}`;
        });
    }

    setAnimateNextRender(true);
    renderCalendar(state.planner);
}

/**
 * Transitions calendar track animation to the next month/week view.
 */
export function shiftNext() {
    if (isTransitioning) return;

    const [yearStr, monthStr] = state.planner.calendar.view.month.split('-');
    const [weeklyYearStr, weekStr] = state.planner.calendar.view.week.split('-');

    if (getCurrentView() === 'monthly') {
        const currentYear = parseInt(yearStr, 10);
        const currentMonth = parseInt(monthStr, 10);

        if (currentYear >= getMaxDate().year && currentMonth >= getMaxDate().month) {
            return snapBack();
        }
    } else {
        const currentWeek = parseInt(weekStr, 10);
        const currentWeeklyYear = parseInt(weeklyYearStr, 10);

        const minDate = new Date(Date.UTC(getMaxDate().year, getMaxDate().month - 1, 1));
        const [maxYearWeek, maxWeekNumber] = getISOWeekNumber(minDate);

        if (currentWeeklyYear >= maxYearWeek && currentWeek >= maxWeekNumber) {
            return snapBack();
        }
    }

    const calendarTrack = document.getElementById('calendar-track');
    if (!calendarTrack) return;

    isTransitioning = true;
    calendarTrack.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    currentTranslate = -calendarTrack.parentElement.offsetWidth * 2;
    calendarTrack.style.transform = `translateX(${currentTranslate}px)`;

    let transitionHandled = false;
    const handleTransition = () => {
        if (transitionHandled) return;
        transitionHandled = true;
        calendarTrack.removeEventListener('transitionend', handleTransition);
        onNextReady();
    };

    calendarTrack.addEventListener('transitionend', handleTransition, { once: true });
    setTimeout(handleTransition, 350);
}

function onPrevReady() {
    if (getCurrentView() === 'monthly') {
        const [yearStr, monthStr] = state.planner.calendar.view.month.split('-');
        const oldYear = parseInt(yearStr, 10);
        const oldMonth0Index = parseInt(monthStr, 10) - 1;
        const newCurrentDate = new Date(Date.UTC(oldYear, oldMonth0Index - 1, 1));
        const [newWeekYear, newWeekNo] = getISOWeekNumber(newCurrentDate);

        handleStateUpdate(() => {
            state.planner.calendar.view.month = `${newCurrentDate.getUTCFullYear()}-${String(newCurrentDate.getUTCMonth() + 1).padStart(2, '0')}`;
            state.planner.calendar.view.week = `${newWeekYear}-${String(newWeekNo).padStart(2, '0')}`;
        });
    } else {
        const [yearStr, weekStr] = state.planner.calendar.view.week.split('-');
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
            state.planner.calendar.view.week = `${year}-${String(week).padStart(2, '0')}`;
            state.planner.calendar.view.month = `${newYearOfMonth}-${String(newMonth).padStart(2, '0')}`;
        });
    }

    setAnimateNextRender(true);
    renderCalendar(state.planner);
    isTransitioning = false;
}

/**
 * Transitions calendar track animation to the previous month/week view.
 */
export function shiftPrev() {
    if (isTransitioning) return;
    const [yearStr, monthStr] = state.planner.calendar.view.month.split('-');
    const [weeklyYearStr, weekStr] = state.planner.calendar.view.week.split('-');

    if (getCurrentView() === 'monthly') {
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

    const calendarTrack = document.getElementById('calendar-track');
    if (!calendarTrack) return;

    isTransitioning = true;
    positionTrackAtIndex(0, true);

    let transitionHandled = false;
    const handleTransition = () => {
        if (transitionHandled) return;
        transitionHandled = true;
        calendarTrack.removeEventListener('transitionend', handleTransition);
        onPrevReady();
    };

    calendarTrack.addEventListener('transitionend', handleTransition, { once: true });
    setTimeout(handleTransition, 350);
}

/**
 * Handles touchstart gestures on the calendar viewport to track start coordinates.
 * @param {TouchEvent} e - Native touchstart event object.
 */
export function handleTouchStart(e) {
    if (state.isChipDragging || isTransitioning || !e.touches?.length) return;
    const calendarContainer = document.getElementById('calendar-container');
    const calendarTrack = document.getElementById('calendar-track');
    if (!calendarContainer || !calendarTrack) return;

    isSwiping = false;
    touchDirection = null;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    const activeIndex = getActiveTrackIndex();
    prevTranslate = -activeIndex * calendarContainer.offsetWidth;
    currentTranslate = prevTranslate;
}

/**
 * Handles touchmove swipe gestures with axis locking and track translations.
 * @param {TouchEvent} e - Native touchmove event object.
 */
export function handleTouchMove(e) {
    if (state.isChipDragging || isTransitioning || !e.touches?.length) return;
    const calendarTrack = document.getElementById('calendar-track');
    if (!calendarTrack) return;

    if (touchDirection === 'vertical') return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;

    if (touchDirection === null) {
        if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) return;

        if (Math.abs(diffY) >= Math.abs(diffX)) {
            touchDirection = 'vertical';
            isSwiping = false;
            return;
        }

        touchDirection = 'horizontal';
        isSwiping = true;
        calendarTrack.style.transition = 'none';
    }

    if (touchDirection === 'horizontal') {
        if (e.cancelable) e.preventDefault();
        currentTranslate = prevTranslate + diffX;
        calendarTrack.style.transform = `translateX(${currentTranslate}px)`;
    }
}

/**
 * Handles touchend gesture completion and evaluates swipe thresholds to shift or snap back.
 */
export function handleTouchEnd() {
    if (isTransitioning) return;
    if (touchDirection !== 'horizontal' || !isSwiping) {
        isSwiping = false;
        touchDirection = null;
        return;
    }

    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) {
        isSwiping = false;
        touchDirection = null;
        return;
    }

    isSwiping = false;
    touchDirection = null;
    const movedBy = currentTranslate - prevTranslate;
    const threshold = Math.min(100, calendarContainer.offsetWidth / 4);

    if (movedBy < -threshold) {
        shiftNext();
    } else if (movedBy > threshold) {
        shiftPrev();
    } else {
        snapBack();
    }
}

/**
 * Handles horizontal mouse wheel / trackpad scrolling on the calendar track.
 * @param {WheelEvent} e - Native wheel event object.
 */
export function handleWheel(e) {
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

/**
 * Handles media query breakpoint transitions between monthly and weekly responsive calendar views.
 * @param {MediaQueryListEvent|MediaQueryList} event - Media query match event.
 */
export function handleMediaQueryChange(event) {
    setCurrentView(event.matches ? 'weekly' : 'monthly');
    renderCalendar(state.planner);
}
