const BOUNDARY_SCROLL_ZONE_PX = 60;
const MAX_AUTO_SCROLL_SPEED = 14;

/**
 * Creates and appends the floating drag ghost element.
 *
 * @param {HTMLElement} chip
 * @param {DOMRect} rect
 * @param {number} startX
 * @param {number} startY
 * @param {number} offsetX
 * @param {number} offsetY
 * @returns {HTMLElement}
 */
export function createDragGhost(chip, rect, startX, startY, offsetX, offsetY) {
    document.querySelectorAll('.dragging-clone').forEach(el => el.remove());

    const ghost = /** @type {HTMLElement} */ (chip.cloneNode(true));
    const tooltip = ghost.querySelector('.chip-tooltip, [role="tooltip"]');
    if (tooltip) tooltip.remove();

    ghost.classList.add('dragging-clone');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '99999';
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = '0px';
    ghost.style.top = '0px';
    ghost.style.transform = `translate3d(${startX - offsetX}px, ${startY - offsetY}px, 0) scale(1.08)`;
    ghost.style.willChange = 'transform, opacity';
    ghost.style.margin = '0';

    document.body.appendChild(ghost);
    return ghost;
}

/**
 * Updates floating ghost position and dynamic hover states on drop targets.
 * @param {Object} activeDragState
 * @param {number} clientX
 * @param {number} clientY
 */
export function updateDragPosition(activeDragState, clientX, clientY) {
    if (!activeDragState || !activeDragState.ghost) return;

    const { offsetX, offsetY, ghost } = activeDragState;
    ghost.style.transform = `translate3d(${clientX - offsetX}px, ${clientY - offsetY}px, 0) scale(1.08)`;

    const elements = document.elementsFromPoint(clientX, clientY) || [];
    let targetContainer = null;
    let isPoolOrTrashTarget = false;

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        const container = el.classList?.contains('chip-container') ? el : (el.closest?.('.chip-container') || el.closest?.('.day-cell')?.querySelector('.chip-container'));
        if (container) {
            targetContainer = container;
            break;
        } else if (el.id === 'income-chips-container' || el.id === 'income-chip-trash-drop-zone' || el.closest?.('#income-chips-container') || el.closest?.('#income-chip-trash-drop-zone')) {
            isPoolOrTrashTarget = true;
            break;
        }
    }

    document.querySelectorAll('.chip-container').forEach(container => {
        container.classList.remove('valid-drop-target', 'invalid-drop-target');
    });

    if (targetContainer) {
        if (targetContainer.classList.contains('valid-drop-range')) {
            targetContainer.classList.add('valid-drop-target');
        } else {
            targetContainer.classList.add('invalid-drop-target');
        }
    }

    const incomeChipsContainer = document.getElementById('income-chips-container');
    if (incomeChipsContainer) {
        if (isPoolOrTrashTarget) {
            incomeChipsContainer.classList.add('valid-drop-target');
        }
    }
}

/**
 * Handles smooth auto-scrolling when dragging near container / viewport boundaries.
 * @param {() => Object|null} getActiveDragState
 * @param {() => number|null} getAutoScrollRafId
 * @param {(id: number|null) => void} setAutoScrollRafId
 */
export function startBoundaryAutoScroll(getActiveDragState, getAutoScrollRafId, setAutoScrollRafId) {
    if (getAutoScrollRafId()) return;

    const checkAndScroll = () => {
        const activeDragState = getActiveDragState();
        if (!activeDragState || !activeDragState.isDragging || !activeDragState.ghost) {
            setAutoScrollRafId(null);
            return;
        }

        const ghostRect = activeDragState.ghost.getBoundingClientRect();
        const pointerY = ghostRect.top + ghostRect.height / 2;
        const viewportHeight = window.innerHeight;
        const currentScrollY = window.scrollY;

        const calendarCard = document.getElementById('planner-calendar-card');
        if (calendarCard) {
            const cardRect = calendarCard.getBoundingClientRect();
            const minScrollY = Math.max(0, cardRect.top + currentScrollY - 20);
            const maxScrollY = Math.max(minScrollY, cardRect.bottom + currentScrollY - viewportHeight + 20);

            if (pointerY < BOUNDARY_SCROLL_ZONE_PX && currentScrollY > minScrollY) {
                const ratio = (BOUNDARY_SCROLL_ZONE_PX - pointerY) / BOUNDARY_SCROLL_ZONE_PX;
                const speed = Math.round(ratio * MAX_AUTO_SCROLL_SPEED);
                window.scrollTo({ top: Math.max(minScrollY, currentScrollY - speed), behavior: 'instant' });
            } else if (viewportHeight - pointerY < BOUNDARY_SCROLL_ZONE_PX && currentScrollY < maxScrollY) {
                const ratio = (BOUNDARY_SCROLL_ZONE_PX - (viewportHeight - pointerY)) / BOUNDARY_SCROLL_ZONE_PX;
                const speed = Math.round(ratio * MAX_AUTO_SCROLL_SPEED);
                window.scrollTo({ top: Math.min(maxScrollY, currentScrollY + speed), behavior: 'instant' });
            }
        }

        setAutoScrollRafId(requestAnimationFrame(checkAndScroll));
    };

    setAutoScrollRafId(requestAnimationFrame(checkAndScroll));
}

/**
 * Animates the floating ghost smoothly into the resolved drop zone or back to origin.
 * @param {HTMLElement} ghost
 * @param {HTMLElement|null} dropTarget
 * @param {number} startX
 * @param {number} startY
 * @param {() => void} [onComplete]
 */
export function animateGhostTransition(ghost, dropTarget, startX, startY, onComplete) {
    if (!ghost || !document.body.contains(ghost)) {
        if (onComplete) onComplete();
        return;
    }

    const ghostRect = ghost.getBoundingClientRect();
    ghost.style.transition = 'transform 0.22s cubic-bezier(0.2, 1, 0.2, 1), opacity 0.2s ease-out';

    if (dropTarget) {
        const targetRect = dropTarget.getBoundingClientRect();
        const targetCenterX = targetRect.left + (targetRect.width / 2);
        const targetCenterY = targetRect.top + (targetRect.height / 2);
        const currentCenterX = ghostRect.left + (ghostRect.width / 2);
        const currentCenterY = ghostRect.top + (ghostRect.height / 2);

        const deltaX = targetCenterX - currentCenterX;
        const deltaY = targetCenterY - currentCenterY;

        ghost.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.75)`;
        ghost.style.opacity = '0';
    } else {
        const currentCenterX = ghostRect.left + (ghostRect.width / 2);
        const currentCenterY = ghostRect.top + (ghostRect.height / 2);

        const deltaX = startX - currentCenterX;
        const deltaY = startY - currentCenterY;

        ghost.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(0.85)`;
        ghost.style.opacity = '0';
    }

    setTimeout(() => {
        if (ghost && document.body.contains(ghost)) {
            ghost.remove();
        }
        if (onComplete) onComplete();
    }, 220);
}
