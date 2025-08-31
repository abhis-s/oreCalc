import { dom } from '../../dom/domElements.js';

export function renderHeroPlannerCarouselDisplay(activeIndex) {
    updatePageDots(activeIndex);
}

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

export function scrollToHeroPage(index) {
    const carouselContent = dom.planner?.heroCarouselContent;
    if (!carouselContent) return;

    const heroPages = carouselContent.querySelectorAll('.hero-page');
    if (heroPages.length === 0) return;

    const pageOffset = heroPages[0].offsetWidth + 20; // Page width + gap

    carouselContent.scrollTo({
        left: index * pageOffset,
        behavior: 'smooth'
    });
}