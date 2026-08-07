import { dom } from '../../dom/domElements.js';

export function initializeHeader() {
    const headerContainer = dom.header?.container;
    if (!headerContainer) return;

    // Create an invisible 1px sentinel at top: 5px to trigger scrolled state off-main-thread
    const sentinel = document.createElement('div');
    sentinel.className = 'header-scroll-sentinel';
    sentinel.style.cssText = 'position: absolute; top: 5px; left: 0; width: 1px; height: 1px; pointer-events: none; opacity: 0; z-index: -1;';
    document.body.prepend(sentinel);

    const observer = new IntersectionObserver(([entry]) => {
        headerContainer.classList.toggle('is-scrolled', !entry.isIntersecting);
    });

    observer.observe(sentinel);
}