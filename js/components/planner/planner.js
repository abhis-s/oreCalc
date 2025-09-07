import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { autoPlaceIncomeChips } from '../../utils/autoPlaceChips.js'; // Added import

import { initializeHeroPlannerCarousel } from './heroPlannerCarousel.js';
import { renderHeroPlannerCarouselDisplay, updatePageDots, scrollToHeroPage } from './heroPlannerCarouselDisplay.js';

import { initializePlannerCustomLevels, renderPlannerCustomLevels } from './plannerCustomLevels.js';
import { renderIncomeChips, initializeIncomeChipsEventListeners } from './incomeChips.js';
import { renderCalendar } from './calendar.js';
import { initializePriorityList } from './priorityList.js';

let scrollInterval = null;

function renderPlannerUI(plannerState) {
    renderCalendar(plannerState);
    const [monthStr, yearStr] = plannerState.calendar.view.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    renderIncomeChips(year, month);
}

function initializeDragScroll() {
    const plannerTab = document.getElementById('planner-tab');
    if (plannerTab) {
        plannerTab.addEventListener('dragover', (e) => {
            e.preventDefault();
            const y = e.clientY;
            const viewportHeight = window.innerHeight;
            const scrollThreshold = viewportHeight * 0.15;

            if (y < scrollThreshold) {
                if (!scrollInterval) {
                    scrollInterval = setInterval(() => {
                        window.scrollBy(0, -10);
                    }, 10);
                }
            } else if (y > viewportHeight - scrollThreshold) {
                if (!scrollInterval) {
                    scrollInterval = setInterval(() => {
                        window.scrollBy(0, 10);
                    }, 10);
                }
            } else {
                clearInterval(scrollInterval);
                scrollInterval = null;
            }
        });

        plannerTab.addEventListener('dragend', () => {
            clearInterval(scrollInterval);
            scrollInterval = null;
        });
    }
}

function initializeCarouselEventListeners() {
    const carouselContent = dom.planner?.heroCarouselContent;
    const plannerPageDots = dom.planner?.plannerPageDots;

    if (carouselContent) {
        carouselContent.addEventListener('change', (event) => {
            const target = event.target;
            if (target.matches('.hero-toggle-switch input[type="checkbox"]')) {
                const heroName = target.closest('.hero-page').dataset.heroName;
                handleStateUpdate(() => {
                    state.heroes[heroName].enabled = target.checked;
                });
            } else if (target.matches('.equipment-item-planner input[type="checkbox"]')) {
                const heroName = target.closest('.hero-page').dataset.heroName;
                const equipName = target.closest('.equipment-item-planner').dataset.equipName;
                handleStateUpdate(() => {
                    state.heroes[heroName].equipment[equipName].checked = target.checked;
                });
            }
        });

        let scrollTimeout;
        carouselContent.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const heroPages = carouselContent.querySelectorAll('.hero-page');
                if (heroPages.length === 0) return;

                const scrollLeft = carouselContent.scrollLeft;
                const pageOffset = heroPages[0].offsetWidth + 20; // Page width + gap

                const newIndex = Math.round(scrollLeft / pageOffset);
                if (newIndex !== state.planner.currentHeroIndex) {
                    handleStateUpdate(() => {
                        state.planner.currentHeroIndex = newIndex;
                    });
                    updatePageDots(newIndex);
                }
            }, 50);
        });
    }

    if (plannerPageDots) {
        plannerPageDots.addEventListener('click', (event) => {
            const target = event.target;
            if (target.matches('.dot')) {
                const dotIndex = parseInt(target.dataset.index, 10);
                if (!isNaN(dotIndex)) {
                    scrollToHeroPage(dotIndex);
                    handleStateUpdate(() => {
                        state.planner.currentHeroIndex = dotIndex;
                    });
                    updatePageDots(dotIndex);
                }
            }
        });
    }
}

function initializePlannerEventListeners() {
    const autoPlaceChipsBtn = dom.planner?.autoPlaceChipsBtn;

    if (autoPlaceChipsBtn) {
        autoPlaceChipsBtn.addEventListener('click', () => {
            const [monthStr, yearStr] = state.planner.calendar.view.month.split('-');
            autoPlaceIncomeChips(monthStr, yearStr);
        });
    }
}

export function initializePlanner() {
    initializePlannerCustomLevels();
    renderPlannerUI(state.planner);
    initializeDragScroll();
    initializeCarouselEventListeners();
    initializePlannerEventListeners();
    initializeIncomeChipsEventListeners();
}

export function renderPlanner(plannerState) {
    if (!plannerState) {
        console.error('Planner state is not available. Cannot update DOM.');
        return;
    }
    renderPlannerCustomLevels(plannerState);
    renderHeroPlannerCarouselDisplay(plannerState.currentHeroIndex);
    renderPlannerUI(plannerState);
    initializePriorityList();
    initializeHeroPlannerCarousel(state.heroes, state.planner);
}

document.addEventListener('DOMContentLoaded', () => {
    const plannerSection = document.getElementById('planner');
    if (plannerSection) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                initializePlanner();
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        observer.observe(plannerSection);
    }
});
