/**
 * cardHelpPopover.js
 * Centralized singleton provider for #card-help-popover tooltips across the application.
 */

let helpPopover = null;
let activeTargetElem = null;
let isDismissBound = false;

function bindOutsideDismissListener() {
    if (isDismissBound || typeof document === 'undefined') return;
    isDismissBound = true;

    const handleOutsideTap = (e) => {
        if (!helpPopover || !helpPopover.classList.contains('show')) return;
        const target = e.target;
        if (helpPopover.contains(target)) return;
        if (activeTargetElem) {
            if (activeTargetElem === target || activeTargetElem.contains(target)) return;
            const closestTarget = target.closest('.hero-journey-node-chip, [data-info], .info-btn, .info-button, .eq-badge, .hero-journey-upcoming-badge, .priority-item-ores');
            if (closestTarget && (closestTarget === activeTargetElem || activeTargetElem.contains(closestTarget))) return;
        }
        hideCardHelpPopover();
    };

    document.addEventListener('pointerdown', handleOutsideTap, { capture: true, passive: true });
    document.addEventListener('touchstart', handleOutsideTap, { capture: true, passive: true });

    if (helpPopover && typeof helpPopover.addEventListener === 'function') {
        helpPopover.addEventListener('toggle', (event) => {
            if (event.newState === 'closed') {
                if (activeTargetElem && typeof activeTargetElem.removeAttribute === 'function') {
                    activeTargetElem.removeAttribute('aria-describedby');
                }
                if (helpPopover.classList && typeof helpPopover.classList.remove === 'function') {
                    helpPopover.classList.remove('show');
                }
                activeTargetElem = null;
            }
        });
    }
}

function getOrCreateHelpPopover() {
    if (!helpPopover) {
        helpPopover = document.getElementById('card-help-popover');
    }
    if (!helpPopover) {
        helpPopover = document.createElement('div');
        helpPopover.id = 'card-help-popover';
        helpPopover.className = 'card-help-popover';
        if (typeof helpPopover.setAttribute === 'function') {
            helpPopover.setAttribute('popover', 'auto');
            helpPopover.setAttribute('role', 'tooltip');
        }
        document.body.appendChild(helpPopover);
    } else {
        if (typeof helpPopover.setAttribute === 'function') {
            if (!helpPopover.hasAttribute || !helpPopover.hasAttribute('popover')) {
                helpPopover.setAttribute('popover', 'auto');
            }
            if (!helpPopover.hasAttribute || !helpPopover.hasAttribute('role')) {
                helpPopover.setAttribute('role', 'tooltip');
            }
        }
    }
    bindOutsideDismissListener();
    return helpPopover;
}

/**
 * Hides and dismisses the active card help tooltip popover element.
 */
export function hideCardHelpPopover() {
    if (activeTargetElem) {
        activeTargetElem.removeAttribute('aria-describedby');
    }
    if (helpPopover) {
        helpPopover.classList.remove('show');
        if (typeof helpPopover.hidePopover === 'function') {
            try {
                let isOpen = false;
                try {
                    isOpen = typeof helpPopover.matches === 'function' ? helpPopover.matches(':popover-open') : false;
                } catch (_) {}
                if (isOpen) {
                    helpPopover.hidePopover();
                }
            } catch (_) {}
        }
    }
    activeTargetElem = null;
}

/**
 * Displays contextual help popover tooltip positioned relative to a target button element.
 * @param {HTMLElement} targetElem - Anchor trigger element.
 * @param {string|Record<string, any>} content - Localized help tooltip text content or structured parts.
 * @param {object} [options={}] - Configuration options.
 * @param {boolean} [options.isToggle=false] - True if clicking target again toggles visibility off.
 */
export function showCardHelpPopover(targetElem, content, { isToggle = false } = {}) {
    const popover = getOrCreateHelpPopover();

    if (activeTargetElem === targetElem && popover.classList.contains('show')) {
        if (isToggle) {
            hideCardHelpPopover();
        }
        return;
    }

    if (activeTargetElem && activeTargetElem !== targetElem) {
        activeTargetElem.removeAttribute('aria-describedby');
    }

    activeTargetElem = targetElem;
    if (targetElem && typeof targetElem.setAttribute === 'function') {
        targetElem.setAttribute('aria-describedby', 'card-help-popover');
    }

    let headerHtml = typeof content === 'object' ? (content?.header || null) : null;
    let bodyHtml = typeof content === 'string' ? content : (content?.body || '');
    let footerHtml = typeof content === 'object' ? (content?.footer || null) : null;

    let innerHTML = '';
    if (headerHtml) {
        innerHTML += `<div class="popover-header">${headerHtml}</div>`;
    }
    innerHTML += `<div class="popover-body">${bodyHtml}</div>`;
    if (footerHtml) {
        innerHTML += `<div class="popover-footer">${footerHtml}</div>`;
    }

    popover.innerHTML = innerHTML;
    popover.classList.add('show');

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

    const positionPopover = () => {
        if (activeTargetElem !== targetElem) return;
        const popoverRect = popover.getBoundingClientRect();
        const elemRect = targetElem.getBoundingClientRect();

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        const popoverHeight = popoverRect.height || 140;
        const popoverWidth = popoverRect.width || 230;

        const spaceAbove = elemRect.top;
        const spaceBelow = viewportHeight - elemRect.bottom;

        let top = 0;
        // Prefer placing ABOVE if space above is sufficient or greater than space below
        if (spaceAbove >= popoverHeight + 10 || spaceAbove >= spaceBelow) {
            top = elemRect.top - popoverHeight - 6;
        } else {
            top = elemRect.bottom + 6;
        }

        const effectiveHeight = Math.min(popoverHeight, Math.max(0, viewportHeight - 24));
        const effectiveWidth = Math.min(popoverWidth, Math.max(0, viewportWidth - 24));

        // Clamp top so popover is always 100% inside viewport vertical bounds
        top = Math.max(12, Math.min(top, viewportHeight - effectiveHeight - 12));

        let left = elemRect.left + (elemRect.width / 2) - (effectiveWidth / 2);
        left = Math.max(12, Math.min(left, viewportWidth - effectiveWidth - 12));

        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    };

    positionPopover();
    setTimeout(positionPopover, 0);
}
