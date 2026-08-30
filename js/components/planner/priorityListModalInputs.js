import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { hideCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { toCamelCase } from '../../utils/stringUtils.js';

import {
    renderDraggableList,
    renderPriorityEditor,
    updateDraggableListValues
} from './priorityListModalDisplay.js';
import { autoPlaceChipsForDateRange, getGlobalPriorityList, getStepOrderErrors } from './priorityListScheduler.js';
import {
    getPreviousValidPriorityOrder,
    renderSuggestionsAndErrors,
    setPreviousValidPriorityOrder,
    setSuggestionsHidden
} from './priorityListSuggestionsRenderer.js';
import { initializeStoredOresModal, openStoredOresModal } from './storedOresModal.js';
import { openLevelSelectModal } from './levelSelectModal.js';
import { showConfirm } from '../../ui/noticeModal.js';

let wasErrorBeforeDrag = false;
let dragStartSnapshot = null;
let isPriorityModalInitialized = false;

/**
 * Handles deleting a specific upgrade step from the priority queue.
 * @param {string} heroName
 * @param {string} equipName
 * @param {number|string} stepNum
 */
function deletePriorityStep(heroName, equipName, stepNum) {
    handleStateUpdate(() => {
        const equipmentInState = state.heroes[heroName]?.equipment[equipName];
        if (!equipmentInState || !equipmentInState.upgradePlan) return;

        const planToDelete = equipmentInState.upgradePlan[stepNum];
        if (planToDelete) {
            planToDelete.enabled = false;
            planToDelete.priorityIndex = 0;
        }

        const remainingSteps = [];
        for (const sNum in equipmentInState.upgradePlan) {
            const step = equipmentInState.upgradePlan[sNum];
            if (step.enabled) {
                remainingSteps.push({ ...step });
            }
        }

        if (remainingSteps.length === 0) {
            delete equipmentInState.upgradePlan;
        } else {
            remainingSteps.sort((a, b) => a.targetLevel - b.targetLevel);
            equipmentInState.upgradePlan = {};
            remainingSteps.forEach((step, idx) => {
                const newStepKey = (idx + 1).toString();
                equipmentInState.upgradePlan[newStepKey] = {
                    targetLevel: step.targetLevel,
                    enabled: true,
                    priorityIndex: step.priorityIndex
                };
            });
        }

        const { globalPriorityList: reorderedGlobalPriorityList } = getGlobalPriorityList();

        if (Array.isArray(reorderedGlobalPriorityList)) {
            reorderedGlobalPriorityList.forEach((reorderedItem, reorderedIndex) => {
                if (state.heroes[reorderedItem.heroName]?.equipment[reorderedItem.name]?.upgradePlan?.[reorderedItem.step]) {
                    state.heroes[reorderedItem.heroName].equipment[reorderedItem.name].upgradePlan[reorderedItem.step].priorityIndex = reorderedIndex + 1;
                }
            });
        }
    });
    renderDraggableList();
    document.dispatchEvent(new CustomEvent('priorityListUpdated'));
}

/**
 * Initializes Priority List editor modal event listeners, drag-and-drop sortable lists, and stored ores actions.
 */
export function initializePriorityListModal() {
    if (isPriorityModalInitialized) return;
    isPriorityModalInitialized = true;

    initializeStoredOresModal();
    const modal = document.getElementById('priority-list-modal');
    const closeBtn = document.getElementById('close-priority-list-modal-btn');
    const resetButton = document.getElementById('reset-priority-list-modal-btn');
    const unhideBtn = document.getElementById('unhide-suggestion-btn');
    const storedOresBtn = document.getElementById('priority-list-stored-ores-btn');

    if (storedOresBtn) {
        storedOresBtn.addEventListener('click', () => {
            openStoredOresModal();
        });
    }

    if (unhideBtn) {
        unhideBtn.addEventListener('click', () => {
            setSuggestionsHidden(false);
            const { globalPriorityList, suggestions } = getGlobalPriorityList();
            renderSuggestionsAndErrors(globalPriorityList, suggestions);
        });
    }

    if (modal) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class' && !modal.classList.contains('show')) {
                    const prevOrder = getPreviousValidPriorityOrder();
                    if (prevOrder !== null && prevOrder.length > 0) {
                        handleStateUpdate(() => {
                            prevOrder.forEach((savedItem) => {
                                const plan = state.heroes[savedItem.heroName]?.equipment[savedItem.equipName]?.upgradePlan[savedItem.step];
                                if (plan) {
                                    plan.priorityIndex = savedItem.priorityIndex;
                                }
                            });
                        });
                        setPreviousValidPriorityOrder(null);
                    }
                }
            });
        });
        observer.observe(modal, { attributes: true });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) closeModalAnimated(modal);
        });
    }

    if (resetButton) {
        resetButton.addEventListener('click', async () => {
            const confirmed = await showConfirm(
                translate('views.planner.confirmResetList'),
                'status.confirm'
            );
            if (!confirmed) return;

            handleStateUpdate(() => {
                for (const heroKey in state.heroes) {
                    const hero = state.heroes[heroKey];
                    for (const equipName in hero.equipment) {
                        hero.equipment[equipName].upgradePlan = {};
                    }
                }
            });
            renderPriorityEditor();
            document.dispatchEvent(new CustomEvent('priorityListUpdated'));
        });
    }

    document.addEventListener('priorityListUpdated', () => {
        renderDraggableList();
    });

    /**
     * @param {HTMLElement} chip
     */
    const handleChipSelect = (chip) => {
        const heroKey = chip.dataset.heroKey;
        const equipKey = chip.dataset.equipKey;
        const equipName = chip.dataset.equipName;
        if (!heroKey) return;
        const hero = heroData[heroKey];
        if (hero) {
            const equip = hero.equipment.find(e => (e.key && e.key === equipKey) || e.name === equipName || toCamelCase(e.name || '') === equipKey);
            if (equip) {
                openLevelSelectModal(hero, equip);
            }
        }
    };

    const modalBody = document.getElementById('priority-list-modal-body');
    if (modalBody) {
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

        modalBody.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement | null} */ (e.target);
            if (!target) return;

            const chip = target.closest('.equipment-chip, .hero-equipment-chip');
            if (chip && modalBody.contains(chip)) {
                handleChipSelect(/** @type {HTMLElement} */ (chip));
                return;
            }

            const deleteBtn = target.closest('.delete-item-btn');
            if (deleteBtn && modalBody.contains(deleteBtn)) {
                const item = target.closest('.priority-list-editor-item');
                if (item) {
                    const heroName = /** @type {HTMLElement} */ (item).dataset.heroName;
                    const equipName = /** @type {HTMLElement} */ (item).dataset.equipName;
                    const step = /** @type {HTMLElement} */ (item).dataset.step;
                    if (heroName && equipName && step) {
                        deletePriorityStep(heroName, equipName, step);
                    }
                }
                return;
            }

            const fixBtn = target.closest('#fix-order-btn, .fix-order-btn');
            if (fixBtn && modalBody.contains(fixBtn)) {
                const prevOrder = getPreviousValidPriorityOrder();
                const canUndo = prevOrder !== null && prevOrder.length > 0;
                if (canUndo) {
                    handleStateUpdate(() => {
                        prevOrder.forEach((savedItem) => {
                            const plan = state.heroes[savedItem.heroName]?.equipment[savedItem.equipName]?.upgradePlan[savedItem.step];
                            if (plan) {
                                plan.priorityIndex = savedItem.priorityIndex;
                            }
                        });
                    });
                    setPreviousValidPriorityOrder(null);
                } else {
                    const { globalPriorityList } = getGlobalPriorityList();
                    handleStateUpdate(() => {
                        const equipmentGroups = {};
                        globalPriorityList.forEach(item => {
                            if (!equipmentGroups[item.name]) {
                                equipmentGroups[item.name] = [];
                            }
                            equipmentGroups[item.name].push(item);
                        });

                        for (const equipName in equipmentGroups) {
                            const items = equipmentGroups[equipName];
                            for (let i = 0; i < items.length - 1; i++) {
                                if (items[i].step > items[i + 1].step) {
                                    const itemA = items[i];
                                    const itemB = items[i + 1];

                                    const planA = state.heroes[itemA.heroName]?.equipment[itemA.name]?.upgradePlan[itemA.step];
                                    const planB = state.heroes[itemB.heroName]?.equipment[itemB.name]?.upgradePlan[itemB.step];

                                    if (planA && planB) {
                                        const tempIndex = planA.priorityIndex;
                                        planA.priorityIndex = planB.priorityIndex;
                                        planB.priorityIndex = tempIndex;
                                    }
                                    return;
                                }
                            }
                        }
                    });
                    setPreviousValidPriorityOrder(null);
                }
                renderDraggableList();
                document.dispatchEvent(new CustomEvent('priorityListUpdated'));
                return;
            }

            const hideBtn = target.closest('#hide-suggestion-btn, .hide-suggestion-btn');
            if (hideBtn && modalBody.contains(hideBtn)) {
                setSuggestionsHidden(true);
                const { globalPriorityList, suggestions } = getGlobalPriorityList();
                renderSuggestionsAndErrors(globalPriorityList, suggestions);
                return;
            }
        });

        modalBody.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const target = /** @type {HTMLElement | null} */ (e.target);
                const chip = target?.closest('.equipment-chip, .hero-equipment-chip');
                if (chip && modalBody.contains(chip)) {
                    e.preventDefault();
                    handleChipSelect(/** @type {HTMLElement} */ (chip));
                }
            }
        });
    }
}

/**
 * Opens the Priority List editor modal and renders draggable priority item cards and suggestions.
 */
export function openPriorityListModal() {
    const modal = document.getElementById('priority-list-modal');
    const title = document.getElementById('priority-list-modal-title');

    if (modal && title) {
        title.setAttribute('data-i18n', 'views.planner.editPriorityList');
        title.textContent = translate('views.planner.editPriorityList');
        if (state.planner?.calendar?.isDirty !== false) {
            autoPlaceChipsForDateRange();
        }
        renderPriorityEditor();
        modal.classList.add('show');
    }
}

/**
 * Re-renders the Priority List modal editor when open and not actively undergoing reordering.
 * @param {any} [renderState] - State configuration object.
 */
export function renderPriorityListModal(renderState) {
    if (window.__IS_REORDERING__) return;
    const modal = document.getElementById('priority-list-modal');
    if (modal && modal.classList.contains('show')) {
        renderPriorityEditor();
    }
}
