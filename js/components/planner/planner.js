import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

let currentHeroIndex = 0;

import { initializeHeroPlannerCarousel } from './heroPlannerCarousel.js';
import { renderHeroPlannerCarouselDisplay, updatePageDots, scrollToHeroPage } from './heroPlannerCarouselDisplay.js';

import { initializePlannerCustomLevels, renderPlannerCustomLevels } from './plannerCustomLevels.js';
import { renderIncomeChips } from './incomeChips.js';
import { renderCalendar } from './calendar.js';


export function initializePlanner() {
    initializePlannerCustomLevels();
    renderCalendar(state.planner);
    const [monthStr, yearStr] = state.planner.calendar.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    renderIncomeChips(year, month);

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

        carouselContent.addEventListener('scroll', () => {
            const heroPages = carouselContent.querySelectorAll('.hero-page');
            if (heroPages.length === 0) return;

            const scrollLeft = carouselContent.scrollLeft;
            const pageOffset = heroPages[0].offsetWidth + 20; // Page width + gap

            currentHeroIndex = Math.round(scrollLeft / pageOffset);
            updatePageDots(currentHeroIndex);
        });
    }

    if (plannerPageDots) {
        plannerPageDots.addEventListener('click', (event) => {
            const target = event.target;
            if (target.matches('.dot')) {
                const dotIndex = parseInt(target.dataset.index, 10);
                if (!isNaN(dotIndex)) {
                    scrollToHeroPage(dotIndex);
                }
            }
        });
    }

    initializeHeroPlannerCarousel(state.heroes, state.planner);
}

export function renderPlanner(plannerState) {
    if (!plannerState) {
        console.error('Planner state is not available. Cannot update DOM.');
        return;
    }
    renderPlannerCustomLevels(plannerState);
    renderHeroPlannerCarouselDisplay(currentHeroIndex);
    renderCalendar(plannerState);
    const [monthStr, yearStr] = plannerState.calendar.month.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    renderIncomeChips(year, month);
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