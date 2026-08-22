import { state } from '../../core/state.js';
import { formatDate, getMinDate, getMaxDate } from '../../utils/dateUtils.js';
import { getWeeksInMonth, getCurrentView } from './calendarScheduler.js';

/**
 * Updates the calendar month/year header with a fade-in animation.
 * @param {string} text
 */
export function updateHeader(text) {
    const currentMonthYearHeader = document.getElementById('current-month-year');
    if (!currentMonthYearHeader) return;
    currentMonthYearHeader.textContent = text;
    currentMonthYearHeader.classList.remove('header-fade-in');
    void currentMonthYearHeader.offsetWidth;
    currentMonthYearHeader.classList.add('header-fade-in');
}

/**
 * Renders the month navigation chips list.
 */
export function renderMonthChips() {
    const monthChipContainer = document.getElementById('month-chip-container');
    if (!monthChipContainer) return;
    monthChipContainer.innerHTML = '';

    for (let year = getMinDate().year; year <= getMaxDate().year; year++) {
        const startMonth = (year === getMinDate().year) ? getMinDate().month : 1;
        const endMonth = (year === getMaxDate().year) ? getMaxDate().month : 12;

        const yearLabel = document.createElement('div');
        yearLabel.classList.add('year-label');
        yearLabel.textContent = String(year);
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
            chip.dataset.year = String(year);
            chip.dataset.month = String(month).padStart(2, '0');

            const weekNumbersContainer = document.createElement('div');
            weekNumbersContainer.classList.add('week-numbers-container');
            chip.appendChild(weekNumbersContainer);

            const weeksInMonth = getWeeksInMonth(year, month);
            weeksInMonth.forEach(week => {
                const weekChip = document.createElement('div');
                weekChip.classList.add('week-chip');
                weekChip.setAttribute('tabindex', '0');
                weekChip.setAttribute('role', 'button');
                weekChip.textContent = String(week.number);
                weekChip.dataset.year = String(week.year);
                weekChip.dataset.week = String(week.number);
                weekNumbersContainer.appendChild(weekChip);
            });

            monthChipContainer.appendChild(chip);
        }
    }
    updateActiveChip();
}

/**
 * Updates the active styling on navigation month and week chips.
 */
export function updateActiveChip() {
    const monthChipContainer = document.getElementById('month-chip-container');
    if (!monthChipContainer || !state.planner || !state.planner.calendar.view.month || !state.planner.calendar.view.week) return;

    const [currentYear, currentMonth] = state.planner.calendar.view.month.split('-');
    const [currentWeekYear, currentWeek] = state.planner.calendar.view.week.split('-');
    const currentView = getCurrentView();

    const chips = monthChipContainer.querySelectorAll('.month-chip');

    chips.forEach(chip => {
        const htmlChip = /** @type {HTMLElement} */ (chip);
        if (htmlChip.dataset.year === currentYear && htmlChip.dataset.month === currentMonth) {
            htmlChip.classList.add('active');

            const containerWidth = monthChipContainer.clientWidth;
            if (containerWidth > 0) {
                const targetScrollLeft = htmlChip.offsetLeft - (containerWidth / 2) + (htmlChip.offsetWidth / 2);
                monthChipContainer.scrollTo({
                    left: Math.max(0, targetScrollLeft),
                    behavior: 'smooth'
                });
            }

            const weekNumbersContainer = /** @type {HTMLElement|null} */ (htmlChip.querySelector('.week-numbers-container'));
            if (weekNumbersContainer) {
                weekNumbersContainer.style.display = currentView === 'weekly' ? 'flex' : 'none';
            }

            const weekChips = htmlChip.querySelectorAll('.week-chip');
            weekChips.forEach(weekChip => {
                const htmlWeekChip = /** @type {HTMLElement} */ (weekChip);
                if (htmlWeekChip.dataset.year === currentWeekYear && htmlWeekChip.dataset.week === currentWeek) {
                    htmlWeekChip.classList.add('active');
                } else {
                    htmlWeekChip.classList.remove('active');
                }
            });
        } else {
            htmlChip.classList.remove('active');
            const weekNumbersContainer = /** @type {HTMLElement|null} */ (htmlChip.querySelector('.week-numbers-container'));
            if (weekNumbersContainer) {
                weekNumbersContainer.style.display = 'none';
            }
            htmlChip.querySelectorAll('.week-chip').forEach(weekChip => weekChip.classList.remove('active'));
        }
    });
}
