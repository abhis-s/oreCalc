export function getPlannerDOMElements() {
    return {
        customMaxLevel: {
            common: document.getElementById('planner-common-max-level'),
            epic: document.getElementById('planner-epic-max-level'),
        },
        heroCarouselContent: document.getElementById('planner-hero-carousel-content'),
        plannerPageDots: document.getElementById('planner-page-dots'),
        calendarGrid: document.getElementById('calendar-grid'),
        currentMonthYearHeader: document.getElementById('current-month-year'),
        prevMonthBtn: document.getElementById('prev-month'),
        nextMonthBtn: document.getElementById('next-month'),
        incomeChipsContainer: document.getElementById('income-chips-container'),
        deleteCurrentMonthChipsBtn: document.getElementById('delete-current-month-chips-btn'),
        deleteAllChipsBtn: document.getElementById('delete-all-chips-btn'),
    };
}