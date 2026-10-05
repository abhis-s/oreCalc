/**
 * GPU-Accelerated Drag and Drop Gesture Engine for Priority List Editor.
 * Manages pointer tracking, auto-scrolling, live DOM transforms, and reorder dispatch.
 * Tier 4: User Inputs & Gesture Physics.
 */

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';
import {
    getGlobalPriorityList,
    getStepOrderErrors
} from './priorityListScheduler.js';
import { updateDraggableListValues } from './priorityListModalDisplay.js';
import { hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { setPreviousValidPriorityOrder } from './priorityListSuggestionsRenderer.js';

let wasErrorBeforeDrag = false;
let dragStartSnapshot = null;

/**
 * Initializes the drag-and-drop gesture engine for the priority list editor inside modalBody.
 *
 * @param {HTMLElement} modalBody - The priority list modal body element.
 */
export function initPriorityDragAndDrop(modalBody) {
    if (!modalBody) return;

    let activePriorityDragItem = null;
    let activePriorityDragIndex = -1;
    let currentPriorityDropIndex = -1;
    let priorityOriginalList = [];
    let priorityInitialRects = [];
    let priorityItemOuterHeights = [];
    let priorityEditorRect = null;
    let priorityDragImage = null;
    let priorityTouchId = null;
    let priorityDragPointerOffsetY = 0;
    let autoScrollFrame = null;
    let lastPointerClientY = 0;
    let initialScrollTop = 0;
    let isPriorityDragMovePending = false;
    let pendingPriorityClientY = 0;

    function stopAutoScroll() {
        if (autoScrollFrame) {
            cancelAnimationFrame(autoScrollFrame);
            autoScrollFrame = null;
        }
    }

    function checkAndAutoScroll(clientY) {
        lastPointerClientY = clientY;
        const editor = document.getElementById('priority-list-editor');
        if (!editor || !activePriorityDragItem) {
            stopAutoScroll();
            return;
        }

        const editorRect = priorityEditorRect || editor.getBoundingClientRect();
        const threshold = 65;
        const topEdge = editorRect.top;
        const bottomEdge = editorRect.bottom;

        let speed = 0;
        if (clientY < topEdge + threshold) {
            const diff = (topEdge + threshold) - clientY;
            speed = -Math.min(22, Math.max(3, diff * 0.4));
        } else if (clientY > bottomEdge - threshold) {
            const diff = clientY - (bottomEdge - threshold);
            speed = Math.min(22, Math.max(3, diff * 0.4));
        }

        if (speed !== 0) {
            if (!autoScrollFrame) {
                const scrollLoop = () => {
                    if (!activePriorityDragItem) {
                        stopAutoScroll();
                        return;
                    }
                    const curEditor = document.getElementById('priority-list-editor');
                    if (!curEditor) {
                        stopAutoScroll();
                        return;
                    }

                    const curRect = priorityEditorRect || curEditor.getBoundingClientRect();
                    let curSpeed = 0;
                    if (lastPointerClientY < curRect.top + threshold) {
                        const diff = (curRect.top + threshold) - lastPointerClientY;
                        curSpeed = -Math.min(22, Math.max(3, diff * 0.4));
                    } else if (lastPointerClientY > curRect.bottom - threshold) {
                        const diff = lastPointerClientY - (curRect.bottom - threshold);
                        curSpeed = Math.min(22, Math.max(3, diff * 0.4));
                    }

                    if (curSpeed !== 0) {
                        curEditor.scrollTop += curSpeed;
                        updatePriorityGPUTransforms(lastPointerClientY);
                        autoScrollFrame = requestAnimationFrame(scrollLoop);
                    } else {
                        stopAutoScroll();
                    }
                };
                autoScrollFrame = requestAnimationFrame(scrollLoop);
            }
        } else {
            stopAutoScroll();
        }
    }

    function startPriorityDrag(item, clientX, clientY) {
        hideCardHelpPopover();
        const editor = document.getElementById('priority-list-editor');
        if (!editor) return;

        const { globalPriorityList: currentList } = getGlobalPriorityList();
        wasErrorBeforeDrag = getStepOrderErrors(currentList).hasError;
        dragStartSnapshot = currentList.map(i => ({
            heroName: i.heroName,
            equipName: i.name,
            step: i.step,
            priorityIndex: i.priorityIndex
        }));

        initialScrollTop = editor.scrollTop;
        priorityOriginalList = Array.from(editor.querySelectorAll('.priority-list-editor-item'));
        activePriorityDragIndex = priorityOriginalList.indexOf(item);
        if (activePriorityDragIndex === -1) return;

        activePriorityDragItem = item;
        currentPriorityDropIndex = activePriorityDragIndex;

        priorityInitialRects = priorityOriginalList.map(el => el.getBoundingClientRect());
        priorityEditorRect = editor.getBoundingClientRect();

        priorityItemOuterHeights = priorityOriginalList.map((el, i) => {
            const rect = priorityInitialRects[i];
            const style = window.getComputedStyle(el);
            const marginTop = parseFloat(style.marginTop) || 5;
            const marginBottom = parseFloat(style.marginBottom) || 5;
            return rect.height + marginTop + marginBottom;
        });

        const itemRect = priorityInitialRects[activePriorityDragIndex];
        priorityDragPointerOffsetY = clientY - itemRect.top;

        priorityDragImage = /** @type {HTMLElement} */ (item.cloneNode(true));
        priorityDragImage.querySelectorAll('.priority-item-ores, .priority-item-date, .delete-item-btn').forEach(el => el.remove());

        priorityDragImage.classList.add('dragging-clone');

        priorityDragImage.style.position = 'fixed';
        priorityDragImage.style.pointerEvents = 'none';
        priorityDragImage.style.zIndex = '99999';
        priorityDragImage.style.width = `${itemRect.width}px`;
        priorityDragImage.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.35)';
        priorityDragImage.style.transform = 'scale(1.02)';
        priorityDragImage.style.transition = 'transform 0.1s ease, box-shadow 0.1s ease';
        priorityDragImage.style.left = `${itemRect.left}px`;
        priorityDragImage.style.top = `${clientY - priorityDragPointerOffsetY}px`;
        const modal = document.getElementById('priority-list-modal');
        (modal || document.body).appendChild(priorityDragImage);

        const sourceLine = document.createElement('div');
        sourceLine.className = 'drag-source-line';
        sourceLine.style.opacity = '0';
        editor.appendChild(sourceLine);

        item.classList.add('dragging');
    }

    function updatePriorityGPUTransforms(clientY) {
        if (!activePriorityDragItem || activePriorityDragIndex === -1 || priorityOriginalList.length === 0) return;

        checkAndAutoScroll(clientY);

        if (priorityDragImage) {
            priorityDragImage.style.top = `${clientY - priorityDragPointerOffsetY}px`;
        }

        const editor = document.getElementById('priority-list-editor');
        if (!editor) return;

        const scrollDelta = editor.scrollTop - initialScrollTop;

        let targetIndex = 0;
        for (let i = 0; i < priorityOriginalList.length; i++) {
            const rect = priorityInitialRects[i];
            const realtimeMidY = (rect.top - scrollDelta) + (rect.height / 2);
            if (clientY > realtimeMidY) {
                targetIndex = i;
            }
        }

        currentPriorityDropIndex = targetIndex;

        const src = activePriorityDragIndex;
        const dst = currentPriorityDropIndex;

        const itemOuterHeights = (priorityItemOuterHeights.length === priorityOriginalList.length)
            ? priorityItemOuterHeights
            : priorityOriginalList.map((el, i) => (priorityInitialRects[i]?.height || 50) + 10);

        const virtualOrder = priorityOriginalList.map((_, i) => i);
        virtualOrder.splice(src, 1);
        virtualOrder.splice(dst, 0, src);

        let currentY = priorityInitialRects[0].top;
        const desiredTopMap = new Map();
        for (let k = 0; k < virtualOrder.length; k++) {
            const itemIndex = virtualOrder[k];
            desiredTopMap.set(itemIndex, currentY);
            currentY += itemOuterHeights[itemIndex];
        }

        const shiftMap = new Map();
        priorityOriginalList.forEach((el, index) => {
            const initialTop = priorityInitialRects[index].top;
            const desiredTop = desiredTopMap.get(index);
            const shiftY = desiredTop - initialTop;
            shiftMap.set(index, shiftY);

            el.style.transition = 'transform 0.2s cubic-bezier(0.2, 1, 0.2, 1)';
            el.style.transform = `translate3d(0, ${shiftY}px, 0)`;
        });

        const sourceLine = /** @type {HTMLElement|null} */ (editor.querySelector('.drag-source-line'));
        const editorRect = priorityEditorRect || editor.getBoundingClientRect();
        if (sourceLine) {
            if (dst === src) {
                sourceLine.style.opacity = '0';
            } else {
                sourceLine.style.opacity = '0.85';

                let seamContentTop = 0;
                const cardAboveIndex = src > 0 ? src - 1 : null;
                const cardBelowIndex = src < priorityOriginalList.length - 1 ? src + 1 : null;

                if (cardAboveIndex !== null && cardBelowIndex !== null) {
                    const rectAbove = priorityInitialRects[cardAboveIndex];
                    const shiftAbove = shiftMap.get(cardAboveIndex) || 0;
                    const contentBottomAbove = (rectAbove.bottom - editorRect.top + initialScrollTop) + shiftAbove;

                    const rectBelow = priorityInitialRects[cardBelowIndex];
                    const shiftBelow = shiftMap.get(cardBelowIndex) || 0;
                    const contentTopBelow = (rectBelow.top - editorRect.top + initialScrollTop) + shiftBelow;

                    seamContentTop = (contentBottomAbove + contentTopBelow) / 2;
                } else if (cardBelowIndex !== null) {
                    const rectBelow = priorityInitialRects[cardBelowIndex];
                    const shiftBelow = shiftMap.get(cardBelowIndex) || 0;
                    const contentTopBelow = (rectBelow.top - editorRect.top + initialScrollTop) + shiftBelow;
                    seamContentTop = contentTopBelow - 5;
                } else if (cardAboveIndex !== null) {
                    const rectAbove = priorityInitialRects[cardAboveIndex];
                    const shiftAbove = shiftMap.get(cardAboveIndex) || 0;
                    const contentBottomAbove = (rectAbove.bottom - editorRect.top + initialScrollTop) + shiftAbove;
                    seamContentTop = contentBottomAbove + 5;
                }

                sourceLine.style.top = `${seamContentTop}px`;
            }
        }
    }

    function schedulePriorityDragMove(clientY) {
        pendingPriorityClientY = clientY;
        if (isPriorityDragMovePending) return;
        isPriorityDragMovePending = true;

        requestAnimationFrame(() => {
            isPriorityDragMovePending = false;
            if (activePriorityDragItem) {
                updatePriorityGPUTransforms(pendingPriorityClientY);
            }
        });
    }

    function commitPriorityDrop() {
        stopAutoScroll();
        if (!activePriorityDragItem || activePriorityDragIndex === -1) return;

        const editor = document.getElementById('priority-list-editor');

        if (editor) {
            const sourceLines = editor.querySelectorAll('.drag-source-line');
            sourceLines.forEach(line => line.remove());
        }

        if (priorityDragImage && priorityDragImage.parentNode) {
            priorityDragImage.parentNode.removeChild(priorityDragImage);
        }
        priorityDragImage = null;

        priorityOriginalList.forEach(el => {
            el.style.transition = 'none';
            el.style.transform = '';
            el.classList.remove('dragging');
        });

        if (editor && currentPriorityDropIndex !== activePriorityDragIndex) {
            const targetElement = priorityOriginalList[currentPriorityDropIndex];
            if (currentPriorityDropIndex > activePriorityDragIndex) {
                editor.insertBefore(activePriorityDragItem, targetElement.nextSibling);
            } else {
                editor.insertBefore(activePriorityDragItem, targetElement);
            }

            const newOrderedItems = [...editor.querySelectorAll('.priority-list-editor-item')];
            window.__IS_REORDERING__ = true;
            handleStateUpdate(() => {
                newOrderedItems.forEach((domItem, index) => {
                    const { heroName, equipName, step } = domItem.dataset;
                    if (heroName && equipName && step) {
                        const plan = state.heroes[heroName]?.equipment[equipName]?.upgradePlan[step];
                        if (plan) {
                            plan.priorityIndex = index + 1;
                        }
                    }
                });
            });
            window.__IS_REORDERING__ = false;

            const { globalPriorityList: updatedList } = getGlobalPriorityList();
            const hasErrorAfter = getStepOrderErrors(updatedList).hasError;

            if (!wasErrorBeforeDrag && hasErrorAfter) {
                setPreviousValidPriorityOrder(dragStartSnapshot);
            } else {
                setPreviousValidPriorityOrder(null);
            }

            updateDraggableListValues();
        }

        activePriorityDragItem = null;
        activePriorityDragIndex = -1;
        currentPriorityDropIndex = -1;
        priorityOriginalList = [];
        priorityInitialRects = [];
        priorityItemOuterHeights = [];
        priorityEditorRect = null;
        priorityTouchId = null;
        isPriorityDragMovePending = false;
    }

    modalBody.addEventListener('dragstart', (e) => e.preventDefault());

    const HOLD_DELAY = 220;
    const MOVE_THRESHOLD = 8;

    function setupPriorityHoldToDrag(e, item) {
        const touchOrPointer = (e.type === 'touchstart') ? e.touches[0] : e;
        const touchId = (e.type === 'touchstart') ? e.touches[0].identifier : null;
        const startX = touchOrPointer.clientX;
        const startY = touchOrPointer.clientY;
        let priorityHoldTimer = null;

        const cancelHold = () => {
            if (priorityHoldTimer) {
                clearTimeout(priorityHoldTimer);
                priorityHoldTimer = null;
            }
            window.removeEventListener('touchmove', onPointerMove);
            window.removeEventListener('mousemove', onPointerMove);
            window.removeEventListener('touchend', onPointerUp);
            window.removeEventListener('mouseup', onPointerUp);
            window.removeEventListener('touchcancel', onPointerUp);
        };

        const onPointerMove = (moveEv) => {
            const pt = (moveEv.type === 'touchmove')
                ? Array.from(moveEv.touches).find(t => t.identifier === touchId) || moveEv.touches[0]
                : moveEv;
            if (pt) {
                const dist = Math.hypot(pt.clientX - startX, pt.clientY - startY);
                if (dist > MOVE_THRESHOLD) {
                    cancelHold();
                }
            }
        };

        const onPointerUp = () => {
            cancelHold();
        };

        priorityHoldTimer = setTimeout(() => {
            cancelHold();
            if (navigator.vibrate) {
                try { navigator.vibrate(20); } catch (_) {}
            }
            priorityTouchId = touchId;
            startPriorityDrag(item, touchOrPointer.clientX, touchOrPointer.clientY);
        }, HOLD_DELAY);

        if (e.type === 'touchstart') {
            if (e.cancelable) e.preventDefault();
            window.addEventListener('touchmove', onPointerMove, { passive: false });
            window.addEventListener('touchend', onPointerUp, { passive: false });
            window.addEventListener('touchcancel', onPointerUp, { passive: false });
        } else {
            window.addEventListener('mousemove', onPointerMove);
            window.addEventListener('mouseup', onPointerUp);
        }
    }

    modalBody.addEventListener('touchstart', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const handle = target.closest('.drag-handle');
        if (handle) {
            const item = handle.closest('.priority-list-editor-item');
            if (item && !item.classList.contains('disabled-dragging')) {
                setupPriorityHoldToDrag(e, item);
            }
        }
    }, { passive: false });

    modalBody.addEventListener('touchmove', (e) => {
        if (activePriorityDragItem && priorityTouchId !== null) {
            let touch = null;
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === priorityTouchId) {
                    touch = e.touches[i];
                    break;
                }
            }
            if (touch) {
                if (e.cancelable) e.preventDefault();
                schedulePriorityDragMove(touch.clientY);
            }
        }
    }, { passive: false });

    modalBody.addEventListener('touchend', () => {
        if (activePriorityDragItem) {
            commitPriorityDrop();
        }
    }, { passive: true });

    modalBody.addEventListener('touchcancel', () => {
        if (activePriorityDragItem) {
            commitPriorityDrop();
        }
    }, { passive: true });

    modalBody.addEventListener('mousedown', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const handle = target.closest('.drag-handle');
        if (handle && e.button === 0) {
            const item = handle.closest('.priority-list-editor-item');
            if (item && !item.classList.contains('disabled-dragging')) {
                setupPriorityHoldToDrag(e, item);

                const onMouseMove = (moveEv) => {
                    schedulePriorityDragMove(moveEv.clientY);
                };

                const onMouseUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    commitPriorityDrop();
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            }
        }
    });
}
