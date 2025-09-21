import { dom } from '../../dom/domElements.js';

export function initializeHeader() {
    const headerContainer = dom.header?.container;
    const headerPlaceholder = dom.header?.placeholder;

    if (!headerContainer || !headerPlaceholder) return;

    const initialOffset = headerContainer.offsetTop;

    const updateHeaderHeight = () => {
        const height = headerContainer.offsetHeight;
        headerPlaceholder.style.height = `${height}px`;
    };

    const handleScroll = () => {
        // Add a 10px cushion to prevent flickering.
        // The header becomes sticky only after scrolling 10px past its starting position.
        if (window.scrollY > initialOffset + 10) {
            headerContainer.classList.add('header-container--sticky');
            headerPlaceholder.style.display = 'block';
        } else if (window.scrollY <= initialOffset) {
            // It becomes un-sticky only when scrolling back to its original position.
            headerContainer.classList.remove('header-container--sticky');
            headerPlaceholder.style.display = 'none';
        }
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
    });

    window.addEventListener('resize', updateHeaderHeight);
    
    updateHeaderHeight();
    handleScroll();
}