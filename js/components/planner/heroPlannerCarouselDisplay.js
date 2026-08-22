import { dom } from '../../dom/domElements.js';

let currentHeroIndex = 0;

/**
 * Returns the currently active zero-based index in the Hero Equipment Planner carousel.
 * @returns {number} Active carousel index.
 */
export function getCurrentHeroIndex() {
    return currentHeroIndex;
}

/**
 * Sets the active zero-based index in the Hero Equipment Planner carousel.
 * @param {number} index - New active index.
 */
export function setCurrentHeroIndex(index) {
    currentHeroIndex = index;
}

/**
 * Updates the hero planner carousel presentation and active page dots for the given index.
 * @param {number} activeIndex - Active slide index.
 */
export function renderHeroPlannerCarouselDisplay(activeIndex) {
    updatePageDots(activeIndex);
}

/**
 * Synchronizes active styling classes on pagination dots in the hero carousel footer.
 * @param {number} activeIndex - Active dot index.
 */
export function updatePageDots(activeIndex) {
    const plannerPageDots = dom.planner?.plannerPageDots;
    if (!plannerPageDots) return;

    const dots = plannerPageDots.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        if (index === activeIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

/**
 * Scrolls the hero planner carousel viewport to the specified slide page.
 * @param {number} index - Target hero page index.
 * @param {ScrollBehavior} [behavior='smooth'] - Native scroll behavior string.
 */
export function scrollToHeroPage(index, behavior = 'smooth') {
    const carouselContent = dom.planner?.heroCarouselContent;
    if (!carouselContent) return;

    const heroPages = carouselContent.querySelectorAll('.hero-page');
    if (heroPages.length === 0) return;

    const pageOffset = heroPages[0].offsetWidth + 20;

    carouselContent.scrollTo({
        left: index * pageOffset,
        behavior: behavior
    });
}
