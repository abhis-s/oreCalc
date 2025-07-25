import { dom } from '../../dom/domElements.js';

export function initializeHeader() {
    const headerContainer = dom.header?.container;
    const headerPlaceholder = dom.header?.placeholder;

    if (!headerContainer || !headerPlaceholder) return;

    const updateHeaderHeight = () => {
        const height = headerContainer.offsetHeight;
        headerPlaceholder.style.height = `${height}px`;
    };

    window.addEventListener('resize', updateHeaderHeight);
    updateHeaderHeight();
}