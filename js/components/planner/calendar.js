import { incomeData } from '../../data/incomeChipData.js';
import { renderIncomeChips } from './incomeChips.js';
import { state, getWeekNumber } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { createIncomeChip } from '../../utils/chipFactory.js';
import { calculateCumulativeOres, reindexCalendarChips } from '../../utils/chipManager.js';

const calendarContainer = document.getElementById('calendar-container');
const calendarTrack = document.getElementById('calendar-track');
const currentMonthYearHeader = document.getElementById('current-month-year');
const deleteCurrentMonthChipsBtn = document.getElementById('delete-current-month-chips-btn');
const deleteAllChipsBtn = document.getElementById('delete-all-chips-btn');
const monthChipContainer = document.getElementById('month-chip-container');

const MIN_YEAR = 2025;
const MIN_MONTH = 8; // August
const MAX_YEAR = 2027;
const MAX_MONTH = 12; // December

let currentView = 'monthly';
let isSwiping = false;
let touchStartX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let isTransitioning = false;
let canScroll = true;
let wheelDebounceTimeout = null;

function getDateOfWeek(w, y) {
    const d = (1 + (w - 1) * 7); // 1st day of the week
    return new Date(Date.UTC(y, 0, d));
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
        dayInfo.innerHTML = `${date.toLocaleString('default', { weekday: 'short' })} <strong>${date.getUTCDate()}</strong>`;
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

    const starBonusSource = incomeData.starBonus;
    const starBonusIncome = starBonusSource.getIncome(state);
    const roundedStarBonusIncome = {
        shiny: Math.round(starBonusIncome.shiny),
        glowy: Math.round(starBonusIncome.glowy),
        starry: Math.round(starBonusIncome.starry),
    };
    const starBonusChipId = `starBonus-${displayDay}-${displayMonth}-${displayYear}-cal`;
    const starBonusChipText = currentView === 'weekly' ? starBonusSource.name : '';
    const starBonusChip = createIncomeChip(starBonusChipText, starBonusSource.className, { type: starBonusSource.type, instance: date.getUTCDate(), ...roundedStarBonusIncome }, date.getUTCMonth(), displayYear, starBonusChipId);
    starBonusChip.draggable = false;
    chipContainer.appendChild(starBonusChip);

    const monthYearKey = `${displayMonth}-${displayYear}`;
    const chipsForThisDay = plannerState.calendar.dates[monthYearKey]?.[displayDay] || [];

    chipsForThisDay.forEach(chipId => {
        const parts = chipId.split('-');
        const type = parts[0];
        const instance = parseInt(parts[1], 10);
        const incomeSource = incomeData[type];
        if (incomeSource) {
            const income = incomeSource.getIncome(state);
            const roundedIncome = { shiny: Math.round(income.shiny), glowy: Math.round(income.glowy), starry: Math.round(income.starry) };
            const chipText = currentView === 'weekly' ? incomeSource.name : '';
            const chipElement = createIncomeChip(chipText, incomeSource.className, { type, instance, ...roundedIncome }, date.getUTCMonth(), displayYear, chipId);
            chipContainer.appendChild(chipElement);
        }
    });

    return dayCell;
}

function generateMonthGrid(dateForMonth, plannerState) {
    const grid = document.createElement('div');
    grid.classList.add('calendar-grid');

    const year = dateForMonth.getUTCFullYear();
    const month = dateForMonth.getUTCMonth();

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        const dayNameCell = document.createElement('div');
        dayNameCell.classList.add('day-name');
        dayNameCell.textContent = day;
        grid.appendChild(dayNameCell);
    });

    const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
    const daysInMonth = lastDayOfMonth.getUTCDate();
    const firstDayOfWeek = firstDayOfMonth.getUTCDay();

    const startDate = new Date(Date.UTC(year, month, 1));
    startDate.setUTCDate(startDate.getUTCDate() - firstDayOfWeek);

    const endDate = new Date(Date.UTC(year, month, daysInMonth));
    endDate.setUTCDate(endDate.getUTCDate() + (6 - lastDayOfMonth.getUTCDay()));

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

export function renderCalendar(plannerState) {
    if (!plannerState || !plannerState.calendar?.view?.month) return;
    calendarTrack.innerHTML = '';

    if (currentView === 'monthly') {
        calendarTrack.classList.remove('weekly-view-grid');
        const [monthStr, yearStr] = plannerState.calendar.view.month.split('-');
        const currentYear = parseInt(yearStr, 10);
        const currentMonth = parseInt(monthStr, 10) - 1;

        const currentDate = new Date(Date.UTC(currentYear, currentMonth, 1));
        const prevDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
        const nextDate = new Date(Date.UTC(currentYear, currentMonth + 1, 1));

        const prevMonthGrid = generateMonthGrid(prevDate, plannerState);
        const currentMonthGrid = generateMonthGrid(currentDate, plannerState);
        const nextMonthGrid = generateMonthGrid(nextDate, plannerState);

        calendarTrack.appendChild(prevMonthGrid);
        calendarTrack.appendChild(currentMonthGrid);
        calendarTrack.appendChild(nextMonthGrid);

        positionTrackAtIndex(1);
        currentMonthYearHeader.textContent = `${currentDate.toLocaleString('default', { month: 'long' })} ${currentYear}`;
        renderIncomeChips(currentYear, currentMonth);
    } else if (currentView === 'weekly') {
        calendarTrack.classList.add('weekly-view-grid');
        const [weekStr, yearStr] = plannerState.calendar.view.week.split('-');
        const currentYear = parseInt(yearStr, 10);
        const currentWeek = parseInt(weekStr, 10);

        const startDate = getDateOfWeek(currentWeek, currentYear);
        const startMonth = startDate.toLocaleString('default', { month: 'short' });

        currentMonthYearHeader.textContent = `Week ${currentWeek} of ${currentYear} (${startMonth})`

        for (let i = 0; i < 7; i++) {
            const day = new Date(startDate);
            day.setUTCDate(day.getUTCDate() + i);
            const dayCell = createDayCell(day, plannerState);
            calendarTrack.appendChild(dayCell);
        }
    }
    updateActiveChip();
}

function positionTrackAtIndex(index, animated = false) {
    calendarTrack.style.transition = animated ? 'transform 0.3s ease-out' : 'none';
    currentTranslate = -index * calendarContainer.offsetWidth;
    calendarTrack.style.transform = `translateX(${currentTranslate}px)`;
}

function shiftNext() {
    if (isTransitioning) return;
    if (currentView === 'monthly') {
        const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
        if (parseInt(yearStr, 10) >= MAX_YEAR && parseInt(monthStr, 10) >= MAX_MONTH) return snapBack();
    }
    isTransitioning = true;
    positionTrackAtIndex(2, true);
    calendarTrack.addEventListener('transitionend', onNextReady, { once: true });
}

function onNextReady() {
    isTransitioning = true;
    if (currentView === 'monthly') {
        const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
        const oldYear = parseInt(yearStr, 10);
        const oldMonth0Index = parseInt(monthStr, 10) - 1;
        const newCurrentDate = new Date(Date.UTC(oldYear, oldMonth0Index + 1, 1));
        const [newWeekYear, newWeekNo] = getWeekNumber(newCurrentDate);

        handleStateUpdate(() => {
            state.planner.calendar.view.month = `${String(newCurrentDate.getUTCMonth() + 1).padStart(2, '0')}-${newCurrentDate.getUTCFullYear()}`;
            state.planner.calendar.view.week = `${newWeekNo}-${newWeekYear}`;
        });
    } else {
        let [weekStr, yearStr] = state.planner.calendar.view.week.split('-');
        let week = parseInt(weekStr, 10) + 1;
        let year = parseInt(yearStr, 10);
        if (week > 52) { // This is a simplification, a proper library should be used for week calculations
            week = 1;
            year += 1;
        }
        const newStartDate = getDateOfWeek(week, year);
        const newMonth = newStartDate.getUTCMonth() + 1;
        const newYearOfMonth = newStartDate.getUTCFullYear();

        handleStateUpdate(() => {
            state.planner.calendar.view.week = `${week}-${year}`;
            state.planner.calendar.view.month = `${String(newMonth).padStart(2, '0')}-${newYearOfMonth}`;
        });
    }

    renderCalendar(state.planner);
    isTransitioning = false;
}

function shiftPrev() {
    if (isTransitioning) return;
    if (currentView === 'monthly') {
        const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
        if (parseInt(yearStr, 10) <= MIN_YEAR && parseInt(monthStr, 10) <= MIN_MONTH) return snapBack();
    }
    isTransitioning = true;
    positionTrackAtIndex(0, true);
    calendarTrack.addEventListener('transitionend', onPrevReady, { once: true });
}

function onPrevReady() {
    isTransitioning = true;
    if (currentView === 'monthly') {
        const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
        const oldYear = parseInt(yearStr, 10);
        const oldMonth0Index = parseInt(monthStr, 10) - 1;
        const newCurrentDate = new Date(Date.UTC(oldYear, oldMonth0Index - 1, 1));
        const [newWeekYear, newWeekNo] = getWeekNumber(newCurrentDate);

        handleStateUpdate(() => {
            state.planner.calendar.view.month = `${String(newCurrentDate.getUTCMonth() + 1).padStart(2, '0')}-${newCurrentDate.getUTCFullYear()}`;
            state.planner.calendar.view.week = `${newWeekNo}-${newWeekYear}`;
        });
    } else {
        let [weekStr, yearStr] = state.planner.calendar.view.week.split('-');
        let week = parseInt(weekStr, 10) - 1;
        let year = parseInt(yearStr, 10);
        if (week < 1) {
            week = 52;
            year -= 1;
        }
        const newStartDate = getDateOfWeek(week, year);
        const newMonth = newStartDate.getUTCMonth() + 1;
        const newYearOfMonth = newStartDate.getUTCFullYear();

        handleStateUpdate(() => {
            state.planner.calendar.view.week = `${week}-${year}`;
            state.planner.calendar.view.month = `${String(newMonth).padStart(2, '0')}-${newYearOfMonth}`;
        });
    }

    renderCalendar(state.planner);
    isTransitioning = false;
}

function snapBack() {
    positionTrackAtIndex(1, true);
}

function handleTouchStart(e) {
    if (isTransitioning) return;
    isSwiping = true;
    touchStartX = e.touches[0].clientX;
    prevTranslate = -calendarContainer.offsetWidth;
    calendarTrack.style.transition = 'none';
}

function handleTouchMove(e) {
    if (!isSwiping || isTransitioning) return;
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
        return; // Ignore vertical scrolls
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
    }, 50); // Cooldown period
}

function getWeeksInMonth(year, month) {
    const weeks = [];
    const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0));

    let currentDay = new Date(firstDayOfMonth);
    while (currentDay <= lastDayOfMonth) {
        const [weekYear, weekNumber] = getWeekNumber(currentDay);
        const weekKey = `${weekNumber}-${weekYear}`;
        if (!weeks.some(w => w.key === weekKey)) {
            weeks.push({ key: weekKey, number: weekNumber, year: weekYear });
        }
        currentDay.setUTCDate(currentDay.getUTCDate() + 7); // Move to the next week
    }
    return weeks;
}

function renderMonthChips() {
    monthChipContainer.innerHTML = '';
    let currentYear = 0;

    for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
        const startMonth = (year === MIN_YEAR) ? MIN_MONTH : 1;
        const endMonth = (year === MAX_YEAR) ? MAX_MONTH : 12;

        const yearLabel = document.createElement('div');
        yearLabel.classList.add('year-label');
        yearLabel.textContent = year;
        monthChipContainer.appendChild(yearLabel);

        for (let month = startMonth; month <= endMonth; month++) {
            const chip = document.createElement('div');
            chip.classList.add('month-chip');
            const monthDate = new Date(Date.UTC(year, month - 1, 1));
            const monthNameSpan = document.createElement('span'); // Create a span for the month name
            monthNameSpan.classList.add('month-name'); // Add a class for styling if needed
            monthNameSpan.textContent = monthDate.toLocaleString('default', { month: 'short' });
            chip.appendChild(monthNameSpan); // Append the span to the chip
            chip.dataset.year = year;
            chip.dataset.month = String(month).padStart(2, '0');
            chip.addEventListener('click', handleMonthChipClick);

            const weekNumbersContainer = document.createElement('div');
            weekNumbersContainer.classList.add('week-numbers-container');
            chip.appendChild(weekNumbersContainer);

            const weeksInMonth = getWeeksInMonth(year, month);
            weeksInMonth.forEach(week => {
                const weekChip = document.createElement('div');
                weekChip.classList.add('week-chip');
                weekChip.textContent = week.number;
                weekChip.dataset.year = week.year;
                weekChip.dataset.week = week.number;
                weekChip.addEventListener('click', handleWeekChipClick);
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
            // When a new month is selected, set the week to the first week of that month
            const firstDayOfMonth = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
            const [firstWeekYear, firstWeekNumber] = getWeekNumber(firstDayOfMonth);
            state.planner.calendar.view.week = `${firstWeekNumber}-${firstWeekYear}`;
        });
        renderCalendar(state.planner);
    }
}

function handleWeekChipClick(e) {
    e.stopPropagation(); // Prevent month chip click from firing
    const year = e.currentTarget.dataset.year;
    const week = e.currentTarget.dataset.week;
    const newWeek = `${week}-${year}`;

    if (state.planner.calendar.view.week !== newWeek) {
        handleStateUpdate(() => {
            state.planner.calendar.view.week = newWeek;
        });
        renderCalendar(state.planner);
    }
}

function updateActiveChip() {
    if (!state.planner) return;
    const [currentMonth, currentYear] = state.planner.calendar.view.month.split('-');
    const [currentWeek, currentWeekYear] = state.planner.calendar.view.week.split('-');

    const chips = monthChipContainer.querySelectorAll('.month-chip');
    
    chips.forEach(chip => {
        if (chip.dataset.year === currentYear && chip.dataset.month === currentMonth) {
            chip.classList.add('active');
            // chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

            const weekNumbersContainer = chip.querySelector('.week-numbers-container');
            if (currentView === 'weekly') {
                weekNumbersContainer.style.display = 'flex'; // Show week numbers in weekly view
            } else {
                weekNumbersContainer.style.display = 'none'; // Hide week numbers in monthly view
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
            // Hide week numbers for inactive months
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


// --- Event Handlers from original file (drag/drop, tooltips) ---

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
    if (!chipContainer || !chipContainer.classList.contains('valid-drop-range')) return;
    chipContainer.classList.remove('valid-drop-target', 'invalid-drop-target');
    const incomeChipData = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (incomeChipData.type === 'starBonus') return;

    const targetDate = chipContainer.closest('.day-cell').dataset.date;
    let newId = incomeChipData.id;
    let isNewChip = !incomeChipData.id.includes('-cal');

    handleStateUpdate(() => {
        if (!isNewChip) {
            const originalId = incomeChipData.id.split('-cal')[0];
            for (const monthYearKey in state.planner.calendar.dates) {
                for (const dayKey in state.planner.calendar.dates[monthYearKey]) {
                    const chipIds = state.planner.calendar.dates[monthYearKey][dayKey];
                    const index = chipIds.findIndex(id => id.split('-cal')[0] === originalId);
                    if (index > -1) {
                        chipIds.splice(index, 1);
                        if (chipIds.length === 0) delete state.planner.calendar.dates[monthYearKey][dayKey];
                        if (Object.keys(state.planner.calendar.dates[monthYearKey]).length === 0) delete state.planner.calendar.dates[monthYearKey];
                    }
                }
            }
        }

        const [year, month, day] = targetDate.split('-');
        const monthYearKey = `${month}-${year}`;
        if (isNewChip) {
            newId = `${incomeChipData.id}-cal`;
        } else {
            newId = `${incomeChipData.id.split('-cal')[0]}-cal`;
        }

        if (!state.planner.calendar.dates[monthYearKey]) state.planner.calendar.dates[monthYearKey] = {};
        if (!state.planner.calendar.dates[monthYearKey][day]) state.planner.calendar.dates[monthYearKey][day] = [];
        state.planner.calendar.dates[monthYearKey][day].push(newId);

        const incomeSource = incomeData[incomeChipData.type];
        if (!(incomeSource?.schedule?.type === 'weekly')) {
            reindexCalendarChips(incomeChipData.type);
        }
    });
    renderCalendar(state.planner);
}

function handleDayCellMouseEnter(e) {
    const dayCell = e.currentTarget;
    const dateString = dayCell.dataset.date;
    const [year, month, day] = dateString.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (targetDate < today) return;

    const cumulativeOres = calculateCumulativeOres(targetDate, state.storedOres);
    const formattedDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(targetDate);

    const tooltip = document.createElement('div');
    tooltip.classList.add('ore-tooltip');
    tooltip.innerHTML = `
        <div class="tooltip-header">${formattedDate}</div>
        <div class="ore-count-item"><span>${cumulativeOres.shiny}</span> <img src="assets/shiny_ore.png" alt="Shiny Ore" class="ore-icon-small"></div>
        <div class="ore-count-item"><span>${cumulativeOres.glowy}</span> <img src="assets/glowy_ore.png" alt="Glowy Ore" class="ore-icon-small"></div>
        <div class="ore-count-item"><span>${cumulativeOres.starry}</span> <img src="assets/starry_ore.png" alt="Starry Ore" class="ore-icon-small"></div>
    `;
    dayCell.appendChild(tooltip);
}

function handleDayCellMouseLeave(e) {
    const tooltip = e.currentTarget.querySelector('.ore-tooltip');
    if (tooltip) tooltip.remove();
}


// --- Initialization ---

const mediaQuery = window.matchMedia('(max-width: 425px)');

document.addEventListener('DOMContentLoaded', () => {
    calendarContainer.addEventListener('wheel', handleWheel, { passive: false });
    calendarContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    calendarContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    calendarContainer.addEventListener('touchend', handleTouchEnd);
    calendarContainer.addEventListener('touchcancel', handleTouchEnd);

    mediaQuery.addEventListener('change', handleMediaQueryChange);
    handleMediaQueryChange(mediaQuery);

    renderMonthChips();

    deleteCurrentMonthChipsBtn.addEventListener('click', () => {
        handleStateUpdate(() => {
            const [month, year] = state.planner.calendar.view.month.split('-');
            const monthYearKey = `${month}-${year}`;
            if (state.planner.calendar.dates[monthYearKey]) {
                delete state.planner.calendar.dates[monthYearKey];
            }
        });
        renderCalendar(state.planner);
    });

    deleteAllChipsBtn.addEventListener('click', () => {
        handleStateUpdate(() => {
            state.planner.calendar.dates = {};
        });
        renderCalendar(state.planner);
    });
});