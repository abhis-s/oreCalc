import { dom } from '../../dom/domElements.js';

export function initializeHeader() {
    const headerContainer = dom.header?.container;
    if (!headerContainer) return;

    const handleScroll = () => {
        const isScrolled = window.scrollY > 5;
        headerContainer.classList.toggle('is-scrolled', isScrolled);
        headerContainer.classList.toggle('sticky', isScrolled);
    };

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleScroll();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    handleScroll();
}