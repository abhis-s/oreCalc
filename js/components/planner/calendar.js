import { incomeData } from '../../data/incomeChipData.js';
import { renderIncomeChips } from './incomeChips.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { createIncomeChip } from '../../utils/chipFactory.js';
import { calculateCumulativeOres, reindexCalendarChips } from '../../utils/chipManager.js';

const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearHeader = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const deleteCurrentMonthChipsBtn = document.getElementById('delete-current-month-chips-btn');
const deleteAllChipsBtn = document.getElementById('delete-all-chips-btn');

let viewSelect;
let currentView = 'monthly';

// TODO: Weekly view on small screens
const mediaQuery = window.matchMedia('(max-width: 779px)');

function handleMediaQueryChange(event) {
    if (event.matches) {
        // Screen size is 779px or less
        if (viewSelect) {
            viewSelect.style.display = 'none';
        }
        currentView = 'weekly';
    } else {
        if (viewSelect) {
            viewSelect.style.display = 'block';
        }
        currentView = viewSelect ? viewSelect.value : 'monthly';
    }
}

export function renderCalendar(plannerState) {
    if (!plannerState) return;
    calendarGrid.innerHTML = '';
    const [monthStr, yearStr] = plannerState.calendar.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    calendarGrid.classList.remove('weekly-view-grid');

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Render day names (monthly view)
    if (currentView === 'monthly') {
        dayNames.forEach(day => {
            const dayNameCell = document.createElement('div');
            dayNameCell.classList.add('day-name');
            dayNameCell.textContent = day;
            calendarGrid.appendChild(dayNameCell);
        });
    }

    if (currentView === 'monthly') {
        currentMonthYearHeader.textContent = `${new Date(Date.UTC(year, month)).toLocaleString('default', { month: 'long' })} ${year}`;

        const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
        const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0));
        const daysInMonth = lastDayOfMonth.getUTCDate();

        const firstDayOfWeek = firstDayOfMonth.getUTCDay();

        // Calculate the start and end dates for rendering full weeks
        const startDate = new Date(Date.UTC(year, month, 1));
        startDate.setUTCDate(startDate.getUTCDate() - firstDayOfWeek);

        const endDate = new Date(Date.UTC(year, month, daysInMonth));
        endDate.setUTCDate(endDate.getUTCDate() + (6 - lastDayOfMonth.getUTCDay()));

        let currentDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
        while (currentDate <= endDate) {
            const dayCell = document.createElement('div');
            dayCell.classList.add('day-cell');

            const displayYear = currentDate.getUTCFullYear();
            const displayMonth = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
            const displayDay = String(currentDate.getUTCDate()).padStart(2, '0');
            dayCell.dataset.date = `${displayYear}-${displayMonth}-${displayDay}`;

            if (currentDate.getUTCMonth() !== month) {
                dayCell.classList.add('other-month');
            }

            if (currentDate.getUTCDate() === today.getUTCDate() && currentDate.getUTCMonth() === today.getUTCMonth() && currentDate.getUTCFullYear() === today.getUTCFullYear()) {
                dayCell.classList.add('today');
            }

            const dateDisplay = document.createElement('div');
            dateDisplay.classList.add('date-display');
            dateDisplay.textContent = currentDate.getUTCDate();
            dayCell.appendChild(dateDisplay);

            const chipContainer = document.createElement('div');
            chipContainer.classList.add('chip-container');
            chipContainer.addEventListener('dragover', handleDragOver);
            chipContainer.addEventListener('dragleave', handleDragLeave);
            chipContainer.addEventListener('drop', handleDrop);
            dayCell.appendChild(chipContainer);

            // Add mouse events for tooltip
            const dayCellDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));
            const todayUTC = new Date();
            todayUTC.setUTCHours(0, 0, 0, 0);

            if (dayCellDate >= todayUTC) {
                dayCell.addEventListener('mouseenter', handleDayCellMouseEnter);
                dayCell.addEventListener('mouseleave', handleDayCellMouseLeave);
            }

            // Automatically place Star Bonus chip
            const starBonusSource = incomeData.starBonus;
            const starBonusIncome = starBonusSource.getIncome(state);
            const roundedStarBonusIncome = {
                shiny: Math.round(starBonusIncome.shiny),
                glowy: Math.round(starBonusIncome.glowy),
                starry: Math.round(starBonusIncome.starry),
            };
            const starBonusChipId = `starBonus-${String(currentDate.getUTCDate()).padStart(2, '0')}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${currentDate.getUTCFullYear()}-cal`;
            const starBonusChip = createIncomeChip(
                '', // Empty string for text content in calendar view (TODO: Use income source name on small screens)
                starBonusSource.className,
                { type: starBonusSource.type, instance: currentDate.getUTCDate(), ...roundedStarBonusIncome },
                currentDate.getUTCMonth(),
                currentDate.getUTCFullYear(),
                starBonusChipId
            );
            starBonusChip.draggable = false;
            chipContainer.appendChild(starBonusChip);

            // Draw and populate with saved chips
            const currentDay = String(currentDate.getUTCDate()).padStart(2, '0'); // DD format
            const monthYearKey = `${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}-${currentDate.getUTCFullYear()}`; // MM-YYYY

            const chipsForThisDay = plannerState.calendar.dates[monthYearKey]?.[currentDay] || [];

            chipsForThisDay.forEach(chipId => {
                const parts = chipId.split('-');
                const type = parts[0];
                const instance = parseInt(parts[1], 10);
                const chipMonth = parseInt(parts[2], 10) - 1;
                const chipYear = parseInt(parts[3], 10);

                const incomeSource = incomeData[type];
                if (incomeSource) {
                    const income = incomeSource.getIncome(state);
                    const roundedIncome = {
                        shiny: Math.round(income.shiny),
                        glowy: Math.round(income.glowy),
                        starry: Math.round(income.starry),
                    };

                    const chipElement = createIncomeChip(
                        '', // Empty string for text content in calendar view (TODO: Use income source name on small screens)
                        incomeSource.className,
                        {
                            type: type,
                            instance: instance,
                            ...roundedIncome
                        },
                        chipMonth,
                        chipYear,
                        chipId
                    );
                    chipContainer.appendChild(chipElement);
                }
            });

            calendarGrid.appendChild(dayCell);
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
    }
    renderIncomeChips(year, month);
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
    if (!chipContainer || !chipContainer.classList.contains('valid-drop-range')) {
        return;
    }

    chipContainer.classList.remove('valid-drop-target', 'invalid-drop-target');

    const incomeChipData = JSON.parse(e.dataTransfer.getData('text/plain'));

    // Prevent Star Bonus chips from being dropped
    if (incomeChipData.type === 'starBonus') {
        return;
    }

    const targetDate = chipContainer.closest('.day-cell').dataset.date; // YYYY-MM-DD
    let newId = incomeChipData.id;
    let isNewChip = !incomeChipData.id.includes('-cal');

    handleStateUpdate(() => {
        // Remove old chipId from its previous location if it was moved from another calendar cell
        if (!isNewChip) {
            const originalId = incomeChipData.id.split('-cal')[0];
            for (const monthYearKey in state.planner.calendar.dates) {
                const days = state.planner.calendar.dates[monthYearKey];
                for (const dayKey in days) {
                    const chipIds = days[dayKey];
                    const indexToRemove = chipIds.findIndex(id => id.split('-cal')[0] === originalId);
                    if (indexToRemove > -1) {
                        chipIds.splice(indexToRemove, 1);
                        if (chipIds.length === 0) {
                            delete days[dayKey];
                        }
                        if (Object.keys(days).length === 0) {
                            delete state.planner.calendar.dates[monthYearKey];
                        }
                    }
                }
            }
        }

        const [year, month, day] = targetDate.split('-'); // YYYY-MM-DD
        const monthYearKey = `${month}-${year}`; // MM-YYYY
        const dayKey = day; // DD

        if (isNewChip) {
            newId = `${incomeChipData.id}-cal`;
        } else {
            const originalId = incomeChipData.id.split('-cal')[0];
            newId = `${originalId}-cal`;
        }

        if (!state.planner.calendar.dates[monthYearKey]) {
            state.planner.calendar.dates[monthYearKey] = {};
        }
        if (!state.planner.calendar.dates[monthYearKey][dayKey]) {
            state.planner.calendar.dates[monthYearKey][dayKey] = [];
        }
        state.planner.calendar.dates[monthYearKey][dayKey].push(newId);

        // Re-index chips if it's not a weekly occurrence
        const incomeSource = incomeData[incomeChipData.type];
        if (!(incomeSource && incomeSource.schedule && incomeSource.schedule.type === 'weekly')) {
            const changed = reindexCalendarChips(incomeChipData.type);
            if (changed) {
                // If re-indexing changed IDs, re-render everything
                renderCalendar(state.planner);
                renderIncomeChips(state.planner.calendar.month.split('-')[1], parseInt(state.planner.calendar.month.split('-')[0], 10) - 1);
                return; // Exit to prevent double re-render
            }
        }
    });

    renderCalendar(state.planner);
    renderIncomeChips(state.planner.calendar.month.split('-')[1], parseInt(state.planner.calendar.month.split('-')[0], 10) - 1);
}

function handleDayCellMouseEnter(e) {
    const dayCell = e.currentTarget;
    const dateString = dayCell.dataset.date; // YYYY-MM-DD
    const [year, month, day] = dateString.split('-').map(Number);

    // Create a date for the day cell at UTC midnight
    const targetDate = new Date(Date.UTC(year, month - 1, day));

    // Create a date for today at UTC midnight
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    if (targetDate.getTime() < todayUTC.getTime()) {
        return; // No tooltip for past dates
    }

    const cumulativeOres = calculateCumulativeOres(targetDate, state.storedOres);

    // Format the date for display
    const formattedDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }).format(targetDate);

    const tooltip = document.createElement('div');
    tooltip.classList.add('ore-tooltip');
    tooltip.innerHTML = `
        <div class="tooltip-header">${formattedDate}</div>
        <div class="ore-count-item">
            <span>${cumulativeOres.shiny}</span> <img src="assets/shiny_ore.png" alt="Shiny Ore" class="ore-icon-small">
        </div>
        <div class="ore-count-item">
            <span>${cumulativeOres.glowy}</span> <img src="assets/glowy_ore.png" alt="Glowy Ore" class="ore-icon-small">
        </div>
        <div class="ore-count-item">
            <span>${cumulativeOres.starry}</span> <img src="assets/starry_ore.png" alt="Starry Ore" class="ore-icon-small">
        </div>
    `;
    dayCell.appendChild(tooltip);
}

function handleDayCellMouseLeave(e) {
    const dayCell = e.currentTarget;
    const tooltip = dayCell.querySelector('.ore-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

const MIN_YEAR = 2025;
const MIN_MONTH = 8; // August
const MAX_YEAR = 2027;
const MAX_MONTH = 12; // December

prevMonthBtn.addEventListener('click', () => {
    handleStateUpdate(() => {
        const [monthStr, yearStr] = state.planner.calendar.month.split('-');
        let year = parseInt(yearStr, 10);
        let month = parseInt(monthStr, 10);

        if (currentView === 'monthly') {
            month -= 1;
            if (month < 1) { 
                month = 12;
                year -= 1;
            }
        } else if (currentView === 'weekly') {
            let date = new Date(Date.UTC(year, month - 1, 1));
            date.setUTCDate(date.getUTCDate() - 7);
            month = date.getUTCMonth() + 1;
            year = date.getUTCFullYear();
        }

        if (year < MIN_YEAR || (year === MIN_YEAR && month < MIN_MONTH)) {
            // If trying to go before MIN_YEAR/MIN_MONTH, set to MIN_YEAR/MIN_MONTH
            state.planner.calendar.month = `${String(MIN_MONTH).padStart(2, '0')}-${MIN_YEAR}`;
        } else {
            state.planner.calendar.month = `${String(month).padStart(2, '0')}-${year}`;
        }
    });
    renderCalendar(state.planner);
});

nextMonthBtn.addEventListener('click', () => {
    handleStateUpdate(() => {
        const [monthStr, yearStr] = state.planner.calendar.month.split('-');
        let year = parseInt(yearStr, 10);
        let month = parseInt(monthStr, 10);

        if (currentView === 'monthly') {
            month += 1;
            if (month > 12) { 
                month = 1;
                year += 1;
            }
        } else if (currentView === 'weekly') {
            let date = new Date(Date.UTC(year, month - 1, 1));
            date.setUTCDate(date.getUTCDate() + 7);
            month = date.getUTCMonth() + 1;
            year = date.getUTCFullYear();
        }

        if (year > MAX_YEAR || (year === MAX_YEAR && month > MAX_MONTH)) {
            // If trying to go after MAX_YEAR/MAX_MONTH, set to MAX_YEAR/MAX_MONTH
            state.planner.calendar.month = `${String(MAX_MONTH).padStart(2, '0')}-${MAX_YEAR}`;
        } else {
            state.planner.calendar.month = `${String(month).padStart(2, '0')}-${year}`;
        }
    });
    renderCalendar(state.planner);
});

document.addEventListener('DOMContentLoaded', () => {
    viewSelect = document.getElementById('view-select');

    viewSelect.addEventListener('change', (event) => {
        currentView = event.target.value;
        renderCalendar(state.planner);
    });

    mediaQuery.addEventListener('change', (event) => {
        handleMediaQueryChange(event);
        renderCalendar(state.planner);
    });

    if (!mediaQuery.matches) {
        viewSelect.value = currentView;
    }

    deleteCurrentMonthChipsBtn.addEventListener('click', () => {
        handleStateUpdate(() => {
            state.planner.calendar.dates[state.planner.calendar.month] = [];
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