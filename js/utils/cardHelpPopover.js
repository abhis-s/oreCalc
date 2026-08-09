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
        if (activeTargetElem && (activeTargetElem === target || activeTargetElem.contains(target))) return;
        hideCardHelpPopover();
    };

    document.addEventListener('pointerdown', handleOutsideTap, { capture: true, passive: true });
    document.addEventListener('touchstart', handleOutsideTap, { capture: true, passive: true });
}

function getOrCreateHelpPopover() {
    if (!helpPopover) {
        helpPopover = document.getElementById('card-help-popover');
    }
    if (!helpPopover) {
        helpPopover = document.createElement('div');
        helpPopover.id = 'card-help-popover';
        helpPopover.className = 'card-help-popover';
        document.body.appendChild(helpPopover);
    }
    bindOutsideDismissListener();
    return helpPopover;
}

export function hideCardHelpPopover() {
    if (helpPopover) {
        helpPopover.classList.remove('show');
    }
    activeTargetElem = null;
}

export function showCardHelpPopover(targetElem, content, { isToggle = false } = {}) {
    const popover = getOrCreateHelpPopover();
    
    if (activeTargetElem === targetElem && popover.classList.contains('show')) {
        if (isToggle) {
            hideCardHelpPopover();
        }
        return;
    }

    activeTargetElem = targetElem;

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

    const positionPopover = () => {
        if (activeTargetElem !== targetElem) return;
        const popoverRect = popover.getBoundingClientRect();
        const elemRect = targetElem.getBoundingClientRect();

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        const spaceAbove = elemRect.top;
        const placeBelow = spaceAbove < popoverRect.height + 10;

        let top = 0;
        if (placeBelow) {
            top = elemRect.bottom + 6;
        } else {
            top = elemRect.top - popoverRect.height - 6;
        }

        let left = elemRect.left + (elemRect.width / 2) - (popoverRect.width / 2);

        if (left < 12) {
            left = 12;
        } else if (left + popoverRect.width > viewportWidth - 12) {
            left = viewportWidth - popoverRect.width - 12;
        }

        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    };

    positionPopover();
    setTimeout(positionPopover, 0);
}
