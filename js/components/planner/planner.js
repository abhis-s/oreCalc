import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

import { autoPlaceIncomeChips } from '../../utils/autoPlaceChips.js';

import { initializeHeroPlannerCarousel } from './heroPlannerCarousel.js';
import { initializePlannerCustomLevels, renderPlannerCustomLevels } from './plannerCustomLevels.js';
import { initializePriorityList } from './priorityList.js';
import { renderCalendar, setAnimateNextRender } from './calendar.js';
import { renderHeroPlannerCarouselDisplay, updatePageDots, scrollToHeroPage, getCurrentHeroIndex, setCurrentHeroIndex } from './heroPlannerCarouselDisplay.js';
import { renderIncomeChips, initializeIncomeChipsEventListeners } from './incomeChips.js';

let scrollInterval = null;

function renderPlannerUI(plannerState) {
    renderCalendar(plannerState);
    if (!plannerState?.calendar?.view?.month) return;
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
                    if (!state.heroes[heroName]) state.heroes[heroName] = { equipment: {} };
                    state.heroes[heroName].enabled = target.checked;
                });
            } else if (target.matches('.equipment-item-planner input[type="checkbox"]')) {
                const heroName = target.closest('.hero-page').dataset.heroName;
                const equipName = target.closest('.equipment-item-planner').dataset.equipName;
                handleStateUpdate(() => {
                    if (!state.heroes[heroName]) state.heroes[heroName] = { equipment: {} };
                    if (!state.heroes[heroName].equipment[equipName]) state.heroes[heroName].equipment[equipName] = {};
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
                const containerWidth = carouselContent.offsetWidth;
                const cardWidth = heroPages[0].offsetWidth;
                const gap = 20; // 20px gap from CSS

                // Calculate which card is closest to the center of the container
                const centerPoint = scrollLeft + (containerWidth / 2);
                const cardFullWidth = cardWidth + gap;
                const newIndex = Math.floor(centerPoint / cardFullWidth);

                if (newIndex >= 0 && newIndex < heroPages.length) {
                    setCurrentHeroIndex(newIndex);
                    updatePageDots(newIndex);
                }
            }, 10);
        });
    }

    if (plannerPageDots) {
        plannerPageDots.addEventListener('click', (event) => {
            const target = event.target;
            if (target.matches('.dot')) {
                const dotIndex = parseInt(target.dataset.index, 10);
                if (!isNaN(dotIndex)) {
                    setCurrentHeroIndex(dotIndex);
                    scrollToHeroPage(dotIndex);
                    updatePageDots(dotIndex);
                }
            }
        });
    }
}

function initializePlannerEventListeners() {
    // Moved autoPlaceChipsBtn listener to calendar.js
}

function syncPriorityListHeight() {
    requestAnimationFrame(() => {
        const carousel = document.querySelector('.planner-hero-carousel');
        const priorityCard = document.getElementById('priority-list-card');
        const priorityContent = document.getElementById('priority-list-container');
        
        if (!carousel || !priorityCard || !priorityContent) return;

        const parentGrid = carousel.parentElement;
        const gridComputed = window.getComputedStyle(parentGrid);
        const isSideBySide = gridComputed.display === 'grid' && window.innerWidth >= 780;
        
        if (isSideBySide) {
            // Measure the carousel without the priority list's influence
            const targetHeight = carousel.offsetHeight;
            if (targetHeight <= 0) return;

            priorityCard.style.setProperty('height', `${targetHeight}px`, 'important');
            priorityCard.style.setProperty('max-height', `${targetHeight}px`, 'important');

            const header = priorityCard.querySelector('.priority-list-header');
            const headerHeight = header ? header.offsetHeight : 0;

            // Force the inner content to scroll within the card boundaries
            // Subtracting header height, its margin (10px), card vertical padding (20px), and an additional 20px buffer
            const availableContentHeight = targetHeight - headerHeight - 50; 
            priorityContent.style.setProperty('height', `${availableContentHeight}px`, 'important');
            priorityContent.style.setProperty('max-height', `${availableContentHeight}px`, 'important');
            priorityContent.style.setProperty('overflow-y', 'auto', 'important');
        } else {
            // Reset for mobile/stacked layout
            priorityCard.style.removeProperty('height');
            priorityCard.style.removeProperty('max-height');
            priorityContent.style.setProperty('height', '300px', 'important');
            priorityContent.style.setProperty('max-height', '300px', 'important');
        }
    });
}

export function initializePlanner() {
    initializePlannerCustomLevels();
    renderPlannerUI(state.planner);
    initializeDragScroll();
    initializeCarouselEventListeners();
    initializePlannerEventListeners();
    initializeIncomeChipsEventListeners();

    const carousel = document.querySelector('.planner-hero-carousel');
    if (carousel) {
        const resizeObserver = new ResizeObserver(() => {
            syncPriorityListHeight();
        });
        resizeObserver.observe(carousel.parentElement);
        window.addEventListener('resize', syncPriorityListHeight);
    }
}

export function renderPlanner(plannerState) {
    if (!plannerState) {
        console.error('Planner state is not available. Cannot update DOM.');
        return;
    }
    renderPlannerCustomLevels(plannerState);
    
    const activeIndex = getCurrentHeroIndex();
    renderHeroPlannerCarouselDisplay(activeIndex);
    renderPlannerUI(plannerState);
    initializePriorityList();
    initializeHeroPlannerCarousel(state.heroes, state.planner);
    
    // Restore the carousel's scroll alignment if layout updates reset the native scroll position
    setTimeout(() => {
        scrollToHeroPage(activeIndex, 'auto');
    }, 0);
    
    // Ensure height sync happens after the carousel has been populated
    syncPriorityListHeight();
}

document.addEventListener('DOMContentLoaded', () => {
    const plannerTab = document.getElementById('planner-tab');
    if (plannerTab) {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                initializePlanner();
                syncPriorityListHeight();
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        observer.observe(plannerTab);
    }
});
