/**
 * chipPointerManager.js
 * Unified Pointer Events and Drag-and-Drop Interaction Engine for OreCalc Calendar Chips.
 * Implements high-performance physics, touch long-press ergonomics, haptic ticks,
 * boundary auto-scrolling, and collision target detection.
 */

import { state } from '../core/state.js';

import { clearDropTargetHighlights, highlightDropTargets } from './chipDragDropTargetValidator.js';
import { animateGhostTransition, createDragGhost, startBoundaryAutoScroll, updateDragPosition } from './chipPointerGhostScroller.js';

import { triggerHaptic } from '../services/hapticService.js';

let activeDragState = null;

let autoScrollRafId = null;

const HOLD_DELAY_MS = 250;
const MOVE_CANCEL_THRESHOLD_PX = 8;
const MOUSE_DRAG_THRESHOLD_PX = 4;

/**
 * Returns whether a chip drag is currently in progress.
 * @returns {boolean}
 */
export function isDraggingActive() {
    return activeDragState !== null && activeDragState.isDragging;
}

/**
 * Returns current dragged chip metadata.
 * @returns {Object|null}
 */
export function getDraggedChipData() {
    return activeDragState?.chipData || null;
}

/**
 * Cancels active drag operation if one is running.
 */
export function cancelActiveDrag() {
    if (activeDragState) {
        if (activeDragState.holdTimer) {
            clearTimeout(activeDragState.holdTimer);
            activeDragState.holdTimer = null;
        }
        if (activeDragState.ghost && typeof document !== 'undefined' && document.body?.contains?.(activeDragState.ghost)) {
            activeDragState.ghost.remove();
        }
        if (activeDragState.chip) {
            activeDragState.chip.classList.remove('dragging');
        }
        activeDragState = null;
    }
    if (autoScrollRafId) {
        cancelAnimationFrame(autoScrollRafId);
        autoScrollRafId = null;
    }
    clearDropTargetHighlights();
    state.isChipDragging = false;
}

/**
 * Attaches unified pointer drag listeners to a calendar or income chip.
 * @param {HTMLElement} chip
 * @param {Object} chipData
 */
export function attachChipPointerListeners(chip, chipData) {
    if (!chip) return;

    chip.addEventListener('contextmenu', (e) => {
        if (state.isChipDragging || activeDragState) {
            e.preventDefault();
        }
    });

    chip.addEventListener('dragstart', (e) => {
        e.preventDefault();
    });

    chip.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        if (chip.dataset?.draggable === 'false' || (!chip.dataset?.draggable && (chip.draggable === false || chip.getAttribute?.('draggable') === 'false'))) return;
        if (activeDragState) {
            cancelActiveDrag();
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const pointerId = e.pointerId;
        const pointerType = e.pointerType;
        const rect = chip.getBoundingClientRect();
        const offsetX = startX - rect.left;
        const offsetY = startY - rect.top;

        const sourceCell = chip.closest('.day-cell');
        const originalDate = sourceCell?.dataset.date || null;
        const fullChipData = { ...chipData, id: chip.id, originalDate };

        let holdTimer = null;
        let isDragStarted = false;

        const dragContext = {
            chip,
            chipData: fullChipData,
            pointerId,
            pointerType,
            startX,
            startY,
            offsetX,
            offsetY,
            rect,
            sourceCell,
            ghost: null,
            isDragging: false,
            holdTimer: null
        };

        const startDragging = () => {
            if (isDragStarted) return;
            isDragStarted = true;
            dragContext.isDragging = true;
            activeDragState = dragContext;
            state.isChipDragging = true;

            triggerHaptic('medium');

            if (sourceCell) {
                sourceCell.classList.add('drag-source-cell', 'drag-source-day');
            }
            chip.classList.add('dragging');

            highlightDropTargets(chip, fullChipData);

            dragContext.ghost = createDragGhost(chip, rect, startX, startY, offsetX, offsetY);
            startBoundaryAutoScroll(() => activeDragState, () => autoScrollRafId, (id) => { autoScrollRafId = id; });
        };

        if (pointerType === 'mouse') {
            const onPointerMovePreDrag = (moveEv) => {
                if (moveEv.pointerId !== pointerId) return;
                const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY);
                if (dist > MOUSE_DRAG_THRESHOLD_PX) {
                    cleanupPreDragListeners();
                    startDragging();
                    updateDragPosition(activeDragState, moveEv.clientX, moveEv.clientY);
                }
            };

            const onPointerUpPreDrag = (upEv) => {
                if (upEv.pointerId !== pointerId) return;
                cleanupPreDragListeners();
            };

            const cleanupPreDragListeners = () => {
                window.removeEventListener('pointermove', onPointerMovePreDrag);
                window.removeEventListener('pointerup', onPointerUpPreDrag);
                window.removeEventListener('pointercancel', onPointerUpPreDrag);
            };

            window.addEventListener('pointermove', onPointerMovePreDrag, { passive: false });
            window.addEventListener('pointerup', onPointerUpPreDrag, { passive: false });
            window.addEventListener('pointercancel', onPointerUpPreDrag, { passive: false });
        } else {
            const onTouchMovePreDrag = (moveEv) => {
                if (moveEv.pointerId !== pointerId) return;
                const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY);
                if (dist > MOVE_CANCEL_THRESHOLD_PX) {
                    cleanupTouchHold();
                }
            };

            const onTouchUpPreDrag = (upEv) => {
                if (upEv.pointerId !== pointerId) return;
                cleanupTouchHold();
            };

            const cleanupTouchHold = () => {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
                window.removeEventListener('pointermove', onTouchMovePreDrag);
                window.removeEventListener('pointerup', onTouchUpPreDrag);
                window.removeEventListener('pointercancel', onTouchUpPreDrag);
            };

            holdTimer = setTimeout(() => {
                cleanupTouchHold();
                startDragging();
            }, HOLD_DELAY_MS);

            dragContext.holdTimer = holdTimer;

            window.addEventListener('pointermove', onTouchMovePreDrag, { passive: false });
            window.addEventListener('pointerup', onTouchUpPreDrag, { passive: false });
            window.addEventListener('pointercancel', onTouchUpPreDrag, { passive: false });
        }

        const onActivePointerMove = (moveEv) => {
            if (!activeDragState || moveEv.pointerId !== pointerId || !activeDragState.isDragging) return;
            if (moveEv.cancelable) moveEv.preventDefault();
            updateDragPosition(activeDragState, moveEv.clientX, moveEv.clientY);
        };

        const onActivePointerUp = (upEv) => {
            if (!activeDragState || upEv.pointerId !== pointerId) return;
            window.removeEventListener('pointermove', onActivePointerMove);
            window.removeEventListener('pointerup', onActivePointerUp);
            window.removeEventListener('pointercancel', onActivePointerUp);

            if (activeDragState.isDragging) {
                finishDrag(upEv.clientX, upEv.clientY);
            }
        };

        window.addEventListener('pointermove', onActivePointerMove, { passive: false });
        window.addEventListener('pointerup', onActivePointerUp, { passive: false });
        window.addEventListener('pointercancel', onActivePointerUp, { passive: false });
    });
}

/**
 * Completes drag-and-drop resolution upon pointer release.
 * @param {number} clientX
 * @param {number} clientY
 */
function finishDrag(clientX, clientY) {
    if (!activeDragState) return;

    if (autoScrollRafId) {
        cancelAnimationFrame(autoScrollRafId);
        autoScrollRafId = null;
    }

    const { chip, chipData, ghost, startX, startY } = activeDragState;
    const elements = document.elementsFromPoint(clientX, clientY) || [];

    let resolvedDropTarget = null;
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.closest) {
            const cell = el.closest('.chip-container') || el.closest('.day-cell')?.querySelector('.chip-container') || el.closest('#income-chips-container') || el.closest('#income-chip-trash-drop-zone');
            if (cell) {
                resolvedDropTarget = cell;
                break;
            }
        }
    }

    let isSuccessfulDrop = false;

    if (resolvedDropTarget) {
        if (resolvedDropTarget.classList.contains('chip-container') && resolvedDropTarget.classList.contains('valid-drop-range')) {
            isSuccessfulDrop = true;
            document.dispatchEvent(new CustomEvent('chipDropOnCalendar', {
                detail: { incomeChipData: chipData, chipContainer: resolvedDropTarget }
            }));
        } else if (resolvedDropTarget.id === 'income-chips-container' || resolvedDropTarget.id === 'income-chip-trash-drop-zone') {
            isSuccessfulDrop = true;
            document.dispatchEvent(new CustomEvent('chipDropOnContainer', {
                detail: { incomeChipData: chipData }
            }));
        }
    }

    animateGhostTransition(ghost, isSuccessfulDrop ? resolvedDropTarget : null, startX, startY, () => {
        chip.classList.remove('dragging');
        clearDropTargetHighlights();
        state.isChipDragging = false;
        activeDragState = null;
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('blur', cancelActiveDrag);
}
