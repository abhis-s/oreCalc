import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { renderCalendar } from './calendarDisplay.js';
import { initializeHeroPlannerCarousel } from './heroPlannerCarousel.js';
import {
    getCurrentHeroIndex,
    renderHeroPlannerCarouselDisplay,
    scrollToHeroPage,
    setCurrentHeroIndex,
    updatePageDots
} from './heroPlannerCarouselDisplay.js';
import { renderIncomeChips } from './incomeChipsDisplay.js';
import { initializeIncomeChipsEventListeners } from './incomeChipsInputs.js';
import { initializePlannerCustomLevels, renderPlannerCustomLevels } from './plannerCustomLevels.js';
import { initializePriorityList } from './priorityList.js';
import { dom } from '../../dom/domElements.js';

let scrollInterval = null;
let isLayoutInitialized = false;
let isPlannerInitialized = false;

function renderPlannerUI(plannerState) {
    renderCalendar(plannerState);
    if (!plannerState?.calendar?.view?.month) return;
    const [yearStr, monthStr] = plannerState.calendar.view.month.split('-');
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
            const target = /** @type {HTMLElement} */ (event.target);
            if (target.matches('.hero-toggle-switch input[type="checkbox"]')) {
                const heroName = target.closest('.hero-page')?.dataset.heroName;
                if (!heroName) return;
                handleStateUpdate(() => {
                    if (!state.heroes[heroName]) state.heroes[heroName] = { equipment: {} };
                    state.heroes[heroName].enabled = /** @type {HTMLInputElement} */ (target).checked;
                });
            } else if (target.matches('.equipment-item-planner input[type="checkbox"]')) {
                const heroName = target.closest('.hero-page')?.dataset.heroName;
                const equipName = target.closest('.equipment-item-planner')?.dataset.equipName;
                if (!heroName || !equipName) return;
                handleStateUpdate(() => {
                    if (!state.heroes[heroName]) state.heroes[heroName] = { equipment: {} };
                    if (!state.heroes[heroName].equipment[equipName]) state.heroes[heroName].equipment[equipName] = {};
                    state.heroes[heroName].equipment[equipName].checked = /** @type {HTMLInputElement} */ (target).checked;
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
                const cardWidth = /** @type {HTMLElement} */ (heroPages[0]).offsetWidth;
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
        }, { passive: true });
    }

    if (plannerPageDots) {
        plannerPageDots.addEventListener('click', (event) => {
            const target = /** @type {HTMLElement} */ (event.target);
            if (target.matches('.dot')) {
                const dotIndex = Number(target.dataset.index) || 0;
                setCurrentHeroIndex(dotIndex);
                scrollToHeroPage(dotIndex);
                updatePageDots(dotIndex);
            }
        });
    }
}

let isSyncPriorityHeightPending = false;

function syncPriorityListHeight() {
    if (isSyncPriorityHeightPending) return;
    isSyncPriorityHeightPending = true;

    requestAnimationFrame(() => {
        isSyncPriorityHeightPending = false;

        const carousel = document.querySelector('.planner-hero-carousel');
        const priorityCard = document.getElementById('priority-list-card');
        const priorityContent = document.getElementById('priority-list-container');

        if (!carousel || !priorityCard || !priorityContent) return;

        const parentGrid = carousel.parentElement;
        const gridComputed = parentGrid ? window.getComputedStyle(parentGrid) : null;
        const isSideBySide = gridComputed && gridComputed.display === 'grid' && window.innerWidth >= 780;

        if (isSideBySide) {
            // Read Phase: Batch measure dimensions
            const targetHeight = /** @type {HTMLElement} */ (carousel).offsetHeight;
            if (targetHeight <= 0) return;

            const header = priorityCard.querySelector('.priority-list-header');
            const headerHeight = header ? /** @type {HTMLElement} */ (header).offsetHeight : 0;
            const availableContentHeight = Math.max(0, targetHeight - headerHeight - 50);

            // Write Phase: Apply all inline styles in a single pass
            priorityCard.style.setProperty('height', `${targetHeight}px`, 'important');
            priorityCard.style.setProperty('max-height', `${targetHeight}px`, 'important');

            priorityContent.style.setProperty('height', `${availableContentHeight}px`, 'important');
            priorityContent.style.setProperty('max-height', `${availableContentHeight}px`, 'important');
            priorityContent.style.setProperty('overflow-y', 'auto', 'important');
        } else {
            // Write Phase: Reset for mobile/stacked layout
            priorityCard.style.removeProperty('height');
            priorityCard.style.removeProperty('max-height');
            priorityContent.style.setProperty('height', '300px', 'important');
            priorityContent.style.setProperty('max-height', '300px', 'important');
        }
    });
}

/**
 * Initializes Planner module controllers, custom max levels, drag scroll, and resize observers.
 */
export function initializePlanner() {
    if (isPlannerInitialized) return;
    isPlannerInitialized = true;

    initializePlannerCustomLevels();
    renderPlannerUI(state.planner);
    initializeDragScroll();
    initializeCarouselEventListeners();
    initializeIncomeChipsEventListeners();

    const carousel = document.querySelector('.planner-hero-carousel');
    if (carousel && carousel.parentElement) {
        const resizeObserver = new ResizeObserver(() => {
            syncPriorityListHeight();
        });
        resizeObserver.observe(carousel.parentElement);
        window.addEventListener('resize', syncPriorityListHeight);
    }
}

/**
 * Re-renders all Planner subcomponents: custom levels, carousel, priority list, and calendar cards.
 * @param {import('../../core/types.js').PlannerState} plannerState - Player's planner state configuration.
 */
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

    // Refresh planner layout drag handles and restore card order only on initialization
    if (!isLayoutInitialized) {
        import('../../ui/cardLayoutManager.js').then(module => {
            module.refreshLayout('planner');
        });
        isLayoutInitialized = true;
    }
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
