import { applyGPUTransforms } from './cardDragTransforms.js';
import {
    getCardTitleText,
    saveCustomCardOrder
} from './cardLayoutConfig.js';

let autoScrollFrame = null;
let currentAutoScrollSpeed = 0;
let lastClientX = 0;
let lastClientY = 0;

let activeDragCard = null;
let activeDragLayout = null;
let activePreviewPill = null;
let activeTouchId = null;
let cardRectsMap = new Map();
let originalCardsList = [];
let startIndex = -1;
let currentDropIndex = -1;
let isDragMovePending = false;
let currentActiveMode = 'cozy';
let currentIsCompact = false;
let currentOnRepack = null;

/**
 * Starts auto-scrolling the viewport during card drag.
 * @param {number} speed
 */
function startAutoScroll(speed) {
    currentAutoScrollSpeed = speed;
    if (autoScrollFrame !== null) return;

    const scrollStep = () => {
        if (currentAutoScrollSpeed === 0) {
            stopAutoScroll();
            return;
        }
        window.scrollBy(0, currentAutoScrollSpeed);
        processDragMove(lastClientX, lastClientY);
        autoScrollFrame = requestAnimationFrame(scrollStep);
    };
    autoScrollFrame = requestAnimationFrame(scrollStep);
}

/**
 * Stops active viewport auto-scroller.
 */
function stopAutoScroll() {
    currentAutoScrollSpeed = 0;
    if (autoScrollFrame !== null) {
        cancelAnimationFrame(autoScrollFrame);
        autoScrollFrame = null;
    }
}

const willChangePosition = (card, targetParent, targetSibling) => {
    return card.parentNode !== targetParent || card.nextSibling !== targetSibling;
};

/**
 * Cleans up active card drag state, event listeners, and drag preview pills.
 */
export function cleanupActiveCardDrag() {
    window.removeEventListener('touchmove', handleGlobalTouchMove);
    window.removeEventListener('touchend', handleGlobalTouchRelease);
    window.removeEventListener('touchcancel', handleGlobalTouchRelease);
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseRelease);
    window.removeEventListener('blur', cleanupActiveCardDrag);

    if (originalCardsList) {
        originalCardsList.forEach(card => {
            card.style.transition = '';
            card.style.transform = '';
            card.style.minHeight = '';
            card.classList.remove('dragging');
            card.setAttribute('draggable', 'false');
        });
    }

    if (activeDragCard) {
        activeDragCard.classList.remove('dragging');
        activeDragCard.setAttribute('draggable', 'false');
    }

    if (activePreviewPill) {
        activePreviewPill.remove();
        activePreviewPill = null;
    }

    document.querySelectorAll('.card-drag-preview-pill').forEach(pill => pill.remove());

    activeDragCard = null;
    activeDragLayout = null;
    activeTouchId = null;
    cardRectsMap = new Map();
    originalCardsList = [];
    startIndex = -1;
    currentDropIndex = -1;
    isDragMovePending = false;
    lastClientX = 0;
    lastClientY = 0;

    stopAutoScroll();
}

/**
 * Initiates card dragging.
 * @param {Object} layout
 * @param {HTMLElement} cardContainer
 * @param {PointerEvent|MouseEvent|Touch} touchOrPointer
 * @param {number|null} [touchId=null]
 */
function startCardDrag(layout, cardContainer, touchOrPointer, touchId = null) {
    cleanupActiveCardDrag();

    if (navigator.vibrate) {
        try {
            navigator.vibrate(15);
        } catch (_) {}
    }

    activeDragCard = cardContainer;
    activeDragLayout = layout;
    activeTouchId = touchId;
    lastClientX = touchOrPointer.clientX;
    lastClientY = touchOrPointer.clientY;

    const gridEl = layout.gridEl;

    originalCardsList = Array.from(gridEl.querySelectorAll(layout.config.containerSelector))
        .filter(el => {
            const isHidden = el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0;
            return !isHidden;
        });
    startIndex = originalCardsList.indexOf(cardContainer);
    currentDropIndex = startIndex;

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const scrollX = window.scrollX || window.pageXOffset || 0;

    cardRectsMap = new Map();
    originalCardsList.forEach((c, idx) => {
        const rect = c.getBoundingClientRect();
        const top = rect.top + scrollY;
        const left = rect.left + scrollX;
        cardRectsMap.set(c, {
            rect,
            top,
            left,
            width: rect.width,
            height: rect.height,
            centerX: left + rect.width / 2,
            centerY: top + rect.height / 2,
            index: idx
        });
    });

    activeDragCard.classList.add('dragging');

    const titleText = getCardTitleText(cardContainer);
    activePreviewPill = document.createElement('div');
    activePreviewPill.className = 'card-drag-preview-pill';
    activePreviewPill.style.position = 'fixed';
    activePreviewPill.style.pointerEvents = 'none';
    activePreviewPill.style.zIndex = '99999';
    activePreviewPill.style.left = `${touchOrPointer.clientX - 30}px`;
    activePreviewPill.style.top = `${touchOrPointer.clientY - 20}px`;

    activePreviewPill.innerHTML = `
        <div class="drag-preview-handle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="12" r="1.5"></circle>
                <circle cx="9" cy="5" r="1.5"></circle>
                <circle cx="9" cy="19" r="1.5"></circle>
                <circle cx="15" cy="12" r="1.5"></circle>
                <circle cx="15" cy="5" r="1.5"></circle>
                <circle cx="15" cy="19" r="1.5"></circle>
            </svg>
        </div>
        <span class="drag-preview-title">${titleText}</span>
    `;
    document.body.appendChild(activePreviewPill);

    if (touchId !== null) {
        window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
        window.addEventListener('touchend', handleGlobalTouchRelease, { passive: false });
        window.addEventListener('touchcancel', handleGlobalTouchRelease, { passive: false });
    } else {
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseRelease);
    }
    window.addEventListener('blur', cleanupActiveCardDrag);
}

/**
 * Calculates current drop slot candidate and moves drag preview pill.
 * @param {number} clientX
 * @param {number} clientY
 */
function processDragMove(clientX, clientY) {
    if (!activeDragCard || !activeDragLayout || originalCardsList.length === 0) return;

    lastClientX = clientX;
    lastClientY = clientY;

    if (activePreviewPill) {
        activePreviewPill.style.left = `${clientX - 30}px`;
        activePreviewPill.style.top = `${clientY - 20}px`;
    }

    const scrollZoneHeight = 120;
    const maxSpeed = 15;
    if (clientY < scrollZoneHeight) {
        const ratio = (scrollZoneHeight - clientY) / scrollZoneHeight;
        startAutoScroll(-Math.round(ratio * maxSpeed));
    } else if (window.innerHeight - clientY < scrollZoneHeight) {
        const ratio = (scrollZoneHeight - (window.innerHeight - clientY)) / scrollZoneHeight;
        startAutoScroll(Math.round(ratio * maxSpeed));
    } else {
        stopAutoScroll();
    }

    const scrollY = window.scrollY || window.pageYOffset || 0;
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const pageX = clientX + scrollX;
    const pageY = clientY + scrollY;

    let hoverIndex = startIndex;
    let minDistance = Infinity;

    for (let i = 0; i < originalCardsList.length; i++) {
        const c = originalCardsList[i];
        const data = cardRectsMap.get(c);
        if (!data) continue;

        if (pageX >= data.left && pageX <= data.left + data.width && pageY >= data.top && pageY <= data.top + data.height) {
            hoverIndex = i;
            break;
        }

        const dist = Math.hypot(pageX - data.centerX, pageY - data.centerY);
        if (dist < minDistance) {
            minDistance = dist;
            hoverIndex = i;
        }
    }

    const newTargetIndex = Math.max(0, Math.min(originalCardsList.length - 1, hoverIndex));

    if (newTargetIndex !== currentDropIndex) {
        currentDropIndex = newTargetIndex;
        updateGPUTransforms();
    }
}

/**
 * Updates GPU transform translations for all grid cards during active drag.
 */
function updateGPUTransforms() {
    applyGPUTransforms({
        originalCardsList,
        cardRectsMap,
        activeDragCard,
        startIndex,
        currentDropIndex
    });
}

/**
 * Commits final card drop position in the DOM.
 */
function commitCardDrop() {
    if (!activeDragCard || !activeDragLayout) {
        cleanupActiveCardDrag();
        return;
    }

    const layout = activeDragLayout;
    const card = activeDragCard;

    if (originalCardsList) {
        originalCardsList.forEach(c => {
            c.style.transition = '';
            c.style.transform = '';
            c.style.minHeight = '';
        });
    }

    if (originalCardsList && currentDropIndex !== startIndex && startIndex !== -1 && currentDropIndex !== -1) {
        const targetCard = originalCardsList[currentDropIndex];
        if (targetCard && targetCard !== card) {
            const targetParent = targetCard.parentNode;
            let targetSibling = null;
            if (startIndex < currentDropIndex) {
                targetSibling = targetCard.nextSibling;
            } else {
                targetSibling = targetCard;
            }

            if (willChangePosition(card, targetParent, targetSibling)) {
                targetParent.insertBefore(card, targetSibling);
            }
        }
    }

    saveCustomCardOrder(layout, currentActiveMode);

    if (layout.config.hasCompactMode && currentIsCompact && typeof currentOnRepack === 'function') {
        currentOnRepack();
    }

    cleanupActiveCardDrag();
}

/**
 * Global touch move handler.
 * @param {TouchEvent} e
 */
function handleGlobalTouchMove(e) {
    if (!activeDragCard || activeTouchId === null) return;

    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === activeTouchId) {
            touch = e.touches[i];
            break;
        }
    }
    if (!touch) return;
    if (e.cancelable) e.preventDefault();

    if (isDragMovePending) return;
    isDragMovePending = true;

    const clientX = touch.clientX;
    const clientY = touch.clientY;

    requestAnimationFrame(() => {
        isDragMovePending = false;
        processDragMove(clientX, clientY);
    });
}

/**
 * Global touch release handler.
 * @param {TouchEvent} e
 */
function handleGlobalTouchRelease(e) {
    if (!activeDragCard) return;

    if (e && e.type !== 'blur' && e.type !== 'touchcancel') {
        let touchEnded = false;
        if (e.changedTouches) {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === activeTouchId) {
                    touchEnded = true;
                    break;
                }
            }
        }
        if (!touchEnded) return;
    }

    commitCardDrop();
}

/**
 * Global mouse move handler.
 * @param {MouseEvent} e
 */
function handleGlobalMouseMove(e) {
    if (!activeDragCard) return;
    if (isDragMovePending) return;
    isDragMovePending = true;

    const clientX = e.clientX;
    const clientY = e.clientY;

    requestAnimationFrame(() => {
        isDragMovePending = false;
        processDragMove(clientX, clientY);
    });
}

/**
 * Global mouse release handler.
 * @param {MouseEvent} e
 */
function handleGlobalMouseRelease(e) {
    if (!activeDragCard) return;
    commitCardDrop();
}

/**
 * Attaches drag indicators and gesture listeners to layout cards.
 * @param {Object} layout
 * @param {string} currentMode
 * @param {boolean} isCompact
 * @param {Function} onRepack
 */
export function initCardDragReordering(layout, currentMode, isCompact, onRepack) {
    currentActiveMode = currentMode;
    currentIsCompact = isCompact;
    currentOnRepack = onRepack;

    if (layout.cleanupListeners) {
        layout.cleanupListeners();
        layout.cleanupListeners = null;
    }

    layout.originalCards.forEach(container => {
        if (container.id === 'planner-hero-carousel-card' || container.id === 'eq-settings-container-card') {
            return;
        }

        const handleTarget = container.querySelector(layout.config.dragHandleSelector);
        if (!handleTarget) return;

        if (handleTarget.querySelector('.card-drag-handle')) return;

        const dragHandle = document.createElement('div');
        dragHandle.className = 'card-drag-handle';
        dragHandle.innerHTML = `<orecalc-assets-svg name="drag-indicator" fill="currentColor"></orecalc-assets-svg>`;

        handleTarget.appendChild(dragHandle);

        dragHandle.addEventListener('contextmenu', (e) => e.preventDefault());
        dragHandle.addEventListener('dragstart', (e) => e.preventDefault());

        const HOLD_DELAY = 220;
        const MOVE_THRESHOLD = 8;

        const handleStart = (e) => {
            if (currentActiveMode === 'compact1') return;
            const containerCard = e.target.closest(layout.config.containerSelector);
            if (!containerCard) return;

            const touchOrPointer = (e.type === 'touchstart') ? e.touches[0] : e;
            const touchId = (e.type === 'touchstart') ? e.touches[0].identifier : null;
            const startX = touchOrPointer.clientX;
            const startY = touchOrPointer.clientY;
            let holdTimer = null;

            const cancelHold = () => {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
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

            holdTimer = setTimeout(() => {
                cancelHold();
                startCardDrag(layout, containerCard, touchOrPointer, touchId);
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
        };

        dragHandle.addEventListener('touchstart', handleStart, { passive: false });
        dragHandle.addEventListener('mousedown', handleStart);
    });

    layout.cleanupListeners = () => {
        cleanupActiveCardDrag();
    };
}
