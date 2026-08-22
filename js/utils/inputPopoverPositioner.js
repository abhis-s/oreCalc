/**
 * Calculates adaptive placement and coordinates for the input popover relative to its input element.
 * @param {HTMLElement} popover
 * @param {HTMLElement} inputElement
 * @param {Object} options
 */
export function positionPopover(popover, inputElement, options = {}) {
    if (!popover.classList.contains('show')) return;

    const popoverRect = popover.getBoundingClientRect();
    const inputRect = inputElement.getBoundingClientRect();

    const vv = window.visualViewport;
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const viewportWidth = vv ? vv.width : window.innerWidth;

    const HEADER_OFFSET = 80;
    const spaceAbove = inputRect.top - HEADER_OFFSET;
    const spaceBelow = viewportHeight - inputRect.bottom;
    const spaceRight = viewportWidth - inputRect.right;
    const spaceLeft = inputRect.left;

    const popoverHeight = popoverRect.height;
    const popoverWidth = popoverRect.width;

    const placement = options.placement || 'auto';
    let finalPlacement = 'above';

    if (placement === 'force-below') {
        finalPlacement = 'below';
    } else if (placement === 'force-above') {
        finalPlacement = 'above';
    } else if (placement === 'force-right') {
        finalPlacement = 'right';
    } else if (placement === 'force-left') {
        finalPlacement = 'left';
    } else {
        if (spaceAbove >= popoverHeight + 8) {
            finalPlacement = 'above';
        } else if (spaceBelow >= popoverHeight + 8) {
            finalPlacement = 'below';
        } else if (spaceRight >= popoverWidth + 12) {
            finalPlacement = 'right';
        } else if (spaceLeft >= popoverWidth + 12) {
            finalPlacement = 'left';
        } else {
            const spaces = [
                { dir: 'above', size: spaceAbove },
                { dir: 'below', size: spaceBelow },
                { dir: 'right', size: spaceRight },
                { dir: 'left', size: spaceLeft }
            ];
            spaces.sort((a, b) => b.size - a.size);
            finalPlacement = spaces[0].dir;
        }
    }

    popover.style.position = 'fixed';
    popover.style.bottom = 'auto';
    popover.style.right = 'auto';

    let top = 0;
    let left = 0;

    popover.classList.remove('position-below', 'position-above', 'position-right', 'position-left');
    popover.classList.add(`position-${finalPlacement}`);

    if (finalPlacement === 'above') {
        top = inputRect.top - popoverHeight - 6;
        left = inputRect.left + (inputRect.width / 2) - (popoverWidth / 2);
    } else if (finalPlacement === 'below') {
        top = inputRect.bottom + 6;
        left = inputRect.left + (inputRect.width / 2) - (popoverWidth / 2);
    } else if (finalPlacement === 'right') {
        top = inputRect.top + (inputRect.height / 2) - (popoverHeight / 2);
        left = inputRect.right + 8;
    } else if (finalPlacement === 'left') {
        top = inputRect.top + (inputRect.height / 2) - (popoverHeight / 2);
        left = inputRect.left - popoverWidth - 8;
    }

    const vvTop = vv ? (vv.offsetTop || 0) : 0;
    const vvLeft = vv ? (vv.offsetLeft || 0) : 0;

    left = Math.max(vvLeft + 8, Math.min(left, vvLeft + viewportWidth - popoverWidth - 8));
    top = Math.max(vvTop + 8, Math.min(top, vvTop + viewportHeight - popoverHeight - 8));

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
}

/**
 * Safely invokes native popover display if supported.
 * @param {HTMLElement} popover
 */
export function showNativePopover(popover) {
    if (typeof popover.showPopover === 'function') {
        try {
            let isOpen = false;
            try {
                isOpen = typeof popover.matches === 'function' ? popover.matches(':popover-open') : false;
            } catch (_) {}
            if (!isOpen) {
                popover.showPopover();
            }
        } catch (_) {}
    }
}

/**
 * Safely invokes native popover hide if supported.
 * @param {HTMLElement} popover
 */
export function hideNativePopover(popover) {
    if (typeof popover.hidePopover === 'function') {
        try {
            let isOpen = false;
            try {
                isOpen = typeof popover.matches === 'function' ? popover.matches(':popover-open') : false;
            } catch (_) {}
            if (isOpen) {
                popover.hidePopover();
            }
        } catch (_) {}
    }
}
