import { logger } from '../utils/logger.js';
import { state } from '../core/state.js';
import { handleStateUpdate } from '../core/stateManager.js';

const COMPACT_CLASS = 'layout-compact';
const HEIGHT_THRESHOLD = 10;
const DEBOUNCE_MS = 150;
const TRANSITION_DURATION = 250;
const TRANSITION_EASING = 'cubic-bezier(0.2, 1, 0.2, 1)';

let isWindowResizing = false;
let windowResizeTimeout = null;

const LAYOUT_CONFIGS = [
    {
        name: 'income',
        gridSelector: '#income-tab .income-cards-grid',
        containerSelector: '.card-container',
        dragHandleSelector: '.income-card',
        orderKey: 'incomeCardOrder',
        compactOrderKey: 'incomeCompactCardOrder',
        prefix: 'income',
        hasCompactMode: true
    },
    {
        name: 'settings',
        gridSelector: '#settings-tab .settings-cards-grid',
        containerSelector: '.card-container',
        dragHandleSelector: '.card > h2, .card > h3',
        orderKey: 'settingsCardOrder',
        prefix: 'settings',
        hasCompactMode: true
    },
    {
        name: 'home',
        gridSelector: '#home-tab .main-content',
        containerSelector: '.left-panel, .right-panel',
        dragHandleSelector: '.card h2',
        orderKey: 'homePanelOrder',
        prefix: 'home',
        hasCompactMode: false
    },
    {
        name: 'equipment-left',
        gridSelector: '#equipment-tab #heroes-container',
        containerSelector: '.hero-card',
        dragHandleSelector: '.hero-title',
        orderKey: 'heroOrder',
        prefix: 'eq-left',
        hasCompactMode: true,
        useHeroNameForId: true
    },
    {
        name: 'equipment-right',
        gridSelector: '#equipment-tab .right-panel',
        containerSelector: '.card',
        dragHandleSelector: 'h2, .input-group-flex:first-child',
        orderKey: 'equipmentRightCardOrder',
        prefix: 'eq-right',
        hasCompactMode: false
    },
    {
        name: 'planner',
        gridSelector: '#planner-tab .planner-cards-grid',
        containerSelector: '.planner-card, #priority-list-card, .full-width-planner-section',
        dragHandleSelector: 'h2, .max-level-card-header, .priority-list-header h3',
        orderKey: 'plannerCardOrder',
        prefix: 'planner',
        hasCompactMode: false,
        isPlannerLayout: true
    }
];

const layouts = LAYOUT_CONFIGS.map(config => ({
    config,
    gridEl: null,
    originalCards: [],
    originalIndices: new Map(),
    heightMap: new Map(),
    resizeObserver: null
}));

let isCompact = false;
let currentMode = 'cozy'; // 'cozy', 'compact0', 'compact1'
let repackTimer = null;
let resizeTimer = null;

/**
 * Debounce helper that returns a cancel-able timer id.
 * @param {Function} fn
 * @param {number} delay
 * @returns {number|null} timer id
 */
function debounce(fn, delay) {
    return setTimeout(fn, delay);
}

/**
 * Get or create the two column divs for compact layout on a specific config.
 * @param {Object} layout
 * @returns {HTMLDivElement[]}
 */
function getOrCreateColumns(layout) {
    let col0 = layout.gridEl.querySelector(`#${layout.config.prefix}-column-0`);
    let col1 = layout.gridEl.querySelector(`#${layout.config.prefix}-column-1`);
    
    if (!col0) {
        col0 = document.createElement('div');
        col0.id = `${layout.config.prefix}-column-0`;
        col0.className = 'layout-grid-column';
    }
    if (!col1) {
        col1 = document.createElement('div');
        col1.id = `${layout.config.prefix}-column-1`;
        col1.className = 'layout-grid-column';
    }
    return [col0, col1];
}

/**
 * Revert columns and place cards back in their natural DOM order under the grid for a specific layout.
 * @param {Object} layout
 */
function clearColumns(layout) {
    if (!layout.gridEl) return;
    const col0 = layout.gridEl.querySelector(`#${layout.config.prefix}-column-0`);
    const col1 = layout.gridEl.querySelector(`#${layout.config.prefix}-column-1`);

    layout.originalCards.forEach(card => {
        if (card.parentNode !== layout.gridEl) {
            layout.gridEl.appendChild(card);
        }
    });

    if (col0) col0.remove();
    if (col1) col1.remove();
}

/**
 * Compact0 layout: cards can only move left/right (swap columns) but not up/down.
 * Keeps row groupings exact.
 * @param {Object} layout
 * @param {HTMLElement[]} visibleCards
 * @returns {Object[]}
 */
function packCardsCompact0(layout, visibleCards) {
    const columns = [
        { height: 0, items: [] },
        { height: 0, items: [] }
    ];

    for (let i = 0; i < visibleCards.length; i += 2) {
        const card0 = visibleCards[i];
        const card1 = visibleCards[i + 1] || null;

        if (!card1) {
            // Only one card left in the row
            const target = columns[0].height <= columns[1].height ? 0 : 1;
            columns[target].items.push(card0);
            columns[target].height += layout.heightMap.get(card0) || card0.getBoundingClientRect().height;
        } else {
            // Two cards in the row. Decide whether to swap them.
            const h0 = layout.heightMap.get(card0) || card0.getBoundingClientRect().height;
            const h1 = layout.heightMap.get(card1) || card1.getBoundingClientRect().height;

            // Option 1: card0 in columns[0], card1 in columns[1]
            const diff1 = Math.abs((columns[0].height + h0) - (columns[1].height + h1));

            // Option 2: card1 in columns[0], card0 in columns[1]
            const diff2 = Math.abs((columns[0].height + h1) - (columns[1].height + h0));

            if (diff1 <= diff2) {
                columns[0].items.push(card0);
                columns[1].items.push(card1);
                columns[0].height += h0;
                columns[1].height += h1;
            } else {
                columns[0].items.push(card1);
                columns[1].items.push(card0);
                columns[0].height += h1;
                columns[1].height += h0;
            }
        }
    }

    return columns;
}

/**
 * Compact1 layout: greedy bin-packing (tallest-first) and then sorted by original order.
 * @param {Object} layout
 * @param {HTMLElement[]} visibleCards
 * @returns {Object[]}
 */
function packCardsCompact1(layout, visibleCards) {
    const measured = visibleCards.map(el => ({
        element: el,
        height: layout.heightMap.get(el) || el.getBoundingClientRect().height
    }));

    measured.sort((a, b) => b.height - a.height);

    const columns = [
        { height: 0, items: [] },
        { height: 0, items: [] }
    ];

    for (const card of measured) {
        const target = columns[0].height <= columns[1].height ? 0 : 1;
        columns[target].items.push(card.element);
        columns[target].height += card.height + 20; // Add card height + grid row gap
    }

    // Sort items inside each column by their original reading index
    columns[0].items.sort((a, b) => layout.originalIndices.get(a) - layout.originalIndices.get(b));
    columns[1].items.sort((a, b) => layout.originalIndices.get(a) - layout.originalIndices.get(b));

    return columns;
}

/**
 * Determine which packed column becomes the left column (Column 0)
 * and which becomes the right column (Column 1) based on majority vote of original columns.
 * @param {Object} layout
 * @param {HTMLElement[]} colA_items
 * @param {HTMLElement[]} colB_items
 * @returns {{ leftItems: HTMLElement[], rightItems: HTMLElement[] }}
 */
function determineColumnOrder(layout, colA_items, colB_items) {
    let leftCountA = 0;
    let rightCountA = 0;
    let leftCountB = 0;
    let rightCountB = 0;

    colA_items.forEach(el => {
        const index = layout.originalIndices.get(el);
        if (index % 2 === 0) leftCountA++;
        else rightCountA++;
    });

    colB_items.forEach(el => {
        const index = layout.originalIndices.get(el);
        if (index % 2 === 0) leftCountB++;
        else rightCountB++;
    });

    // Check if column A has a majority (> 50%) of left-origin or right-origin items
    const totalA = colA_items.length;
    const isALeftMajority = leftCountA > totalA / 2;
    const isARightMajority = rightCountA > totalA / 2;

    if (isALeftMajority) {
        return { leftItems: colA_items, rightItems: colB_items };
    }
    if (isARightMajority) {
        return { leftItems: colB_items, rightItems: colA_items };
    }

    // Check if column B has a majority (> 50%) of left-origin or right-origin items
    const totalB = colB_items.length;
    const isBLeftMajority = leftCountB > totalB / 2;
    const isBRightMajority = rightCountB > totalB / 2;

    if (isBLeftMajority) {
        return { leftItems: colB_items, rightItems: colA_items };
    }
    if (isBRightMajority) {
        return { leftItems: colA_items, rightItems: colB_items };
    }

    // Tie-breaker: column containing the first card of the original layout (index 0) goes left
    const hasFirstCardA = colA_items.some(el => layout.originalIndices.get(el) === 0);
    if (hasFirstCardA) {
        return { leftItems: colA_items, rightItems: colB_items };
    } else {
        return { leftItems: colB_items, rightItems: colA_items };
    }
}

/**
 * Record the bounding rect of every container (the "First" in FLIP).
 * @param {HTMLElement[]} containers
 * @returns {Map<HTMLElement, DOMRect>}
 */
function recordPositions(containers) {
    const positions = new Map();
    for (const el of containers) {
        positions.set(el, el.getBoundingClientRect());
    }
    return positions;
}

/**
 * Run the FLIP animation after elements have been re-parented.
 * @param {HTMLElement} gridEl
 * @param {HTMLElement[]} containers
 * @param {Map<HTMLElement, DOMRect>} firstPositions
 */
function flipAnimate(gridEl, containers, firstPositions) {
    // Force layout so new positions are computed
    void gridEl.offsetHeight;

    for (const el of containers) {
        const first = firstPositions.get(el);
        if (!first) continue;

        const last = el.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top - last.top;

        if (dx === 0 && dy === 0) continue;

        el.style.willChange = 'transform';
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    // Next frame: remove inversion with transition (Play)
    requestAnimationFrame(() => {
        for (const el of containers) {
            const first = firstPositions.get(el);
            if (!first) continue;

            el.style.transition = `transform ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`;
            el.style.transform = '';
        }

        // Clean up will-change and transition styles after transition completes
        const cleanup = () => {
            for (const el of containers) {
                el.style.willChange = '';
                el.style.transition = '';
                el.removeEventListener('transitionend', cleanup);
            }
        };

        for (const el of containers) {
            el.addEventListener('transitionend', cleanup, { once: true });
        }
    });
}

/**
 * Apply column structure and perform bin-packing on all active grids, optionally animating.
 * @param {boolean} animate
 */
function applyPacking(animate) {
    const isDesktop = window.innerWidth >= 780;

    for (const layout of layouts) {
        if (!layout.config.hasCompactMode) continue;
        if (!layout.gridEl || layout.originalCards.length === 0) continue;

        if (!isDesktop) {
            // Fallback to normal layout on mobile devices smoothly
            layout.gridEl.classList.remove(COMPACT_CLASS);
            layout.gridEl.classList.remove('layout-compact-dev');
            
            const firstPositions = animate ? recordPositions(layout.originalCards) : null;
            clearColumns(layout);
            if (animate && firstPositions) {
                flipAnimate(layout.gridEl, layout.originalCards, firstPositions);
            }
            continue;
        }

        // Ensure classes are present on desktop
        layout.gridEl.classList.add(COMPACT_CLASS);
        if (currentMode === 'compact1') {
            layout.gridEl.classList.add('layout-compact-dev');
        } else {
            layout.gridEl.classList.remove('layout-compact-dev');
        }

        const firstPositions = animate ? recordPositions(layout.originalCards) : null;
        const [col0, col1] = getOrCreateColumns(layout);

        // If we have a saved custom compact order, restore it directly instead of running the algorithm
        if (currentMode === 'compact0' && state.uiSettings?.[layout.config.compactOrderKey] && layout.config.name === 'income') {
            const saved = state.uiSettings[layout.config.compactOrderKey];
            const containerMap = new Map();
            layout.originalCards.forEach(container => {
                const card = container.querySelector('.income-card');
                if (card && card.id) {
                    containerMap.set(card.id, container);
                }
            });

            saved.column0.forEach(id => {
                const container = containerMap.get(id);
                if (container) {
                    col0.appendChild(container);
                    containerMap.delete(id);
                }
            });
            saved.column1.forEach(id => {
                const container = containerMap.get(id);
                if (container) {
                    col1.appendChild(container);
                    containerMap.delete(id);
                }
            });
            containerMap.forEach(container => {
                col0.appendChild(container);
            });

            if (col0.parentNode !== layout.gridEl) layout.gridEl.appendChild(col0);
            if (col1.parentNode !== layout.gridEl) layout.gridEl.appendChild(col1);

            if (animate && firstPositions) {
                flipAnimate(layout.gridEl, layout.originalCards, firstPositions);
            }
            continue;
        }

        // Filter out hidden cards so they do not affect columns or origin indices
        const visibleCards = layout.originalCards.filter(card => {
            return window.getComputedStyle(card).display !== 'none';
        });

        // Re-index originalIndices based only on visible cards
        layout.originalIndices.clear();
        visibleCards.forEach((card, index) => layout.originalIndices.set(card, index));

        const columns = currentMode === 'compact1'
            ? packCardsCompact1(layout, visibleCards)
            : packCardsCompact0(layout, visibleCards);

        // Determine left and right column assignments based on original layout votes
        const { leftItems, rightItems } = determineColumnOrder(layout, columns[0].items, columns[1].items);

        // Re-parent card elements to their packed columns
        leftItems.forEach(el => col0.appendChild(el));
        rightItems.forEach(el => col1.appendChild(el));

        if (col0.parentNode !== layout.gridEl) layout.gridEl.appendChild(col0);
        if (col1.parentNode !== layout.gridEl) layout.gridEl.appendChild(col1);

        if (animate && firstPositions) {
            flipAnimate(layout.gridEl, layout.originalCards, firstPositions);
        }
    }

    logger.debug('CardLayoutManager: packed cards into columns using mode', currentMode);
}

/**
 * Revert all columns to cozy layout structure, optionally animating.
 * @param {boolean} animate
 */
function clearPacking(animate) {
    for (const layout of layouts) {
        if (!layout.config.hasCompactMode) continue;
        if (!layout.gridEl || layout.originalCards.length === 0) continue;

        const firstPositions = animate ? recordPositions(layout.originalCards) : null;

        clearColumns(layout);

        if (animate && firstPositions) {
            flipAnimate(layout.gridEl, layout.originalCards, firstPositions);
        }
    }

    logger.debug('CardLayoutManager: cleared packing');
}

/**
 * Schedule a debounced repack.
 */
function scheduleRepack() {
    if (repackTimer !== null) {
        clearTimeout(repackTimer);
    }
    repackTimer = debounce(() => {
        repackTimer = null;
        if (isCompact) {
            applyPacking(true);
        }
    }, DEBOUNCE_MS);
}

/**
 * ResizeObserver callback — triggers repack when any card's height
 * changes by more than the threshold.
 * @param {Object} layout
 * @param {ResizeObserverEntry[]} entries
 */
function onContainerResize(layout, entries) {
    let changed = false;

    for (const entry of entries) {
        const el = entry.target;
        const newHeight = entry.borderBoxSize?.[0]?.blockSize
            ?? entry.contentRect.height;
        const prevHeight = layout.heightMap.get(el) ?? 0;

        if (Math.abs(newHeight - prevHeight) >= HEIGHT_THRESHOLD) {
            layout.heightMap.set(el, newHeight);
            changed = true;
        }
    }

    if (changed && isCompact) {
        scheduleRepack();
    }
}

/**
 * Window resize handler - rebuilds layout or resets based on screen width.
 */
function onWindowResize() {
    isWindowResizing = true;
    if (windowResizeTimeout !== null) {
        clearTimeout(windowResizeTimeout);
    }
    windowResizeTimeout = setTimeout(() => {
        isWindowResizing = false;
        windowResizeTimeout = null;
    }, 300);

    if (resizeTimer !== null) {
        clearTimeout(resizeTimer);
    }
    resizeTimer = debounce(() => {
        resizeTimer = null;
        if (isCompact) {
            applyPacking(true);
        }
    }, DEBOUNCE_MS);
}

/**
 * Observe all containers on a specific layout.
 * @param {Object} layout
 */
function observeContainers(layout) {
    if (!layout.resizeObserver) return;

    for (const el of layout.originalCards) {
        if (el.id === 'priority-list-card' || el.id === 'planner-calendar-card') {
            continue;
        }
        layout.resizeObserver.observe(el);
        layout.heightMap.set(el, el.getBoundingClientRect().height);
    }
}

function saveCustomCardOrder(layout) {
    if (layout.config.name === 'planner') {
        enforcePlannerHalfWidthAdjacency(layout.gridEl);
    }

    if (layout.config.hasCompactMode && currentMode === 'compact0' && layout.config.compactOrderKey) {
        const col0 = layout.gridEl.querySelector(`#${layout.config.prefix}-column-0`);
        const col1 = layout.gridEl.querySelector(`#${layout.config.prefix}-column-1`);
        if (col0 && col1) {
            const getIds = (col) => Array.from(col.querySelectorAll(':scope > ' + layout.config.containerSelector))
                .map(container => container.querySelector(layout.config.dragHandleSelector.split(',')[0])?.id)
                .filter(Boolean);
            
            handleStateUpdate(() => {
                if (!state.uiSettings) state.uiSettings = {};
                state.uiSettings[layout.config.compactOrderKey] = {
                    column0: getIds(col0),
                    column1: getIds(col1)
                };
            }, true);
        }
        return;
    }
    
    const currentCards = Array.from(layout.gridEl.querySelectorAll(':scope > ' + layout.config.containerSelector));
    
    layout.originalCards = currentCards;
    layout.originalIndices.clear();
    layout.originalCards.forEach((card, index) => layout.originalIndices.set(card, index));
    
    const cardIds = currentCards.map(container => {
        if (layout.config.useHeroNameForId) {
            return container.dataset.heroName;
        }
        return container.id || null;
    }).filter(Boolean);
    
    handleStateUpdate(() => {
        if (!state.uiSettings) state.uiSettings = {};
        state.uiSettings[layout.config.orderKey] = cardIds;
    }, true);
}

let scrollInterval = null;

function startAutoScroll(speed) {
    if (scrollInterval) {
        clearInterval(scrollInterval);
    }
    scrollInterval = setInterval(() => {
        window.scrollBy(0, speed);
    }, 16);
}

function stopAutoScroll() {
    if (scrollInterval) {
        clearInterval(scrollInterval);
        scrollInterval = null;
    }
}

function enforcePlannerHalfWidthAdjacency(gridEl) {
    if (!gridEl) return;
    const carousel = gridEl.querySelector('#planner-hero-carousel-card');
    const priority = gridEl.querySelector('#priority-list-card');
    if (!carousel || !priority) return;

    if (carousel.nextElementSibling !== priority) {
        carousel.parentNode.insertBefore(priority, carousel.nextSibling);
    }
}

function getCardTitleText(container) {
    const titleEl = container.querySelector('h2, h3');
    if (titleEl) {
        return titleEl.textContent.trim();
    }
    if (container.dataset.heroName) return container.dataset.heroName;
    if (container.id) return container.id.replace('planner-', '').replace('-card', '').replace('eq-', '');
    return 'Card';
}

const willChangePosition = (card, targetParent, targetSibling) => {
    return card.parentNode !== targetParent || card.nextSibling !== targetSibling;
};

let lastSwapTime = 0;
let lastSwapCards = null;

const animateInsertion = (layout, action) => {
    action();
};

// --- Global GPU Transform Drag Engine (Shared across all card layouts) ---
let activeDragCard = null;
let activeDragLayout = null;
let activePreviewPill = null;
let activeTouchId = null;
let cardRectsMap = new Map();
let originalCardsList = [];
let startIndex = -1;
let currentDropIndex = -1;
let isDragMovePending = false;

function cleanupActiveCardDrag() {
    window.removeEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    window.removeEventListener('touchend', handleGlobalTouchRelease, { passive: false });
    window.removeEventListener('touchcancel', handleGlobalTouchRelease, { passive: false });
    window.removeEventListener('mousemove', handleGlobalMouseMove);
    window.removeEventListener('mouseup', handleGlobalMouseRelease);
    window.removeEventListener('blur', cleanupActiveCardDrag);

    // Reset GPU transforms and classes on all cards
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

    // Failsafe: purge any orphaned drag preview pills from document.body
    document.querySelectorAll('.card-drag-preview-pill').forEach(pill => pill.remove());

    activeDragCard = null;
    activeDragLayout = null;
    activeTouchId = null;
    cardRectsMap = new Map();
    originalCardsList = [];
    startIndex = -1;
    currentDropIndex = -1;
    isDragMovePending = false;

    stopAutoScroll();
}

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

    const gridEl = layout.gridEl;

    // Snapshot ALL cards in the layout grid across all columns BEFORE modifying anything
    originalCardsList = Array.from(gridEl.querySelectorAll(layout.config.containerSelector));
    startIndex = originalCardsList.indexOf(cardContainer);
    currentDropIndex = startIndex;

    cardRectsMap = new Map();
    originalCardsList.forEach((c, idx) => {
        const rect = c.getBoundingClientRect();
        cardRectsMap.set(c, {
            rect,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            index: idx
        });
    });

    activeDragCard.classList.add('dragging');

    // Create fixed drag preview pill
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

function processDragMove(clientX, clientY) {
    if (!activeDragCard || !activeDragLayout || originalCardsList.length === 0) return;

    // 1. Move preview pill
    if (activePreviewPill) {
        activePreviewPill.style.left = `${clientX - 30}px`;
        activePreviewPill.style.top = `${clientY - 20}px`;
    }

    // 2. Viewport Auto-scrolling
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

    // 3. Find candidate card under/closest to (clientX, clientY)
    let hoverIndex = startIndex;
    let minDistance = Infinity;

    for (let i = 0; i < originalCardsList.length; i++) {
        const c = originalCardsList[i];
        const data = cardRectsMap.get(c);
        if (!data) continue;

        const rect = data.rect;
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
            hoverIndex = i;
            break;
        }

        const dist = Math.hypot(clientX - data.centerX, clientY - data.centerY);
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

function updateGPUTransforms() {
    if (!originalCardsList || originalCardsList.length === 0) return;

    // 1. Build map of which card is visually assigned to each virtual slot index
    const slotToCardMap = new Map();

    originalCardsList.forEach((c, idx) => {
        let targetIndex = idx;
        if (c === activeDragCard) {
            targetIndex = currentDropIndex;
        } else if (startIndex < currentDropIndex) {
            if (idx > startIndex && idx <= currentDropIndex) {
                targetIndex = idx - 1;
            }
        } else if (startIndex > currentDropIndex) {
            if (idx >= currentDropIndex && idx < startIndex) {
                targetIndex = idx + 1;
            }
        }
        slotToCardMap.set(targetIndex, c);
    });

    // 2. Detect column structure of the layout grid (1 column vs multi-column)
    const numCards = originalCardsList.length;
    const slotVisualRects = new Map();

    let numCols = 1;
    if (numCards >= 2) {
        const r0 = cardRectsMap.get(originalCardsList[0]);
        const r1 = cardRectsMap.get(originalCardsList[1]);
        if (r0 && r1 && Math.abs(r0.top - r1.top) < r0.height * 0.5) {
            numCols = 2;
        }
    }

    const verticalGap = 20;

    if (numCols === 1) {
        let currentTop = cardRectsMap.get(originalCardsList[0])?.top || 0;
        const initialLeft = cardRectsMap.get(originalCardsList[0])?.left || 0;

        for (let slot = 0; slot < numCards; slot++) {
            const cardInSlot = slotToCardMap.get(slot);
            const cardHeight = cardRectsMap.get(cardInSlot)?.height || 0;

            slotVisualRects.set(slot, { left: initialLeft, top: currentTop });
            currentTop += cardHeight + verticalGap;
        }
    } else {
        let colTop0 = cardRectsMap.get(originalCardsList[0])?.top || 0;
        let colTop1 = cardRectsMap.get(originalCardsList[1])?.top || colTop0;
        const colLeft0 = cardRectsMap.get(originalCardsList[0])?.left || 0;
        const colLeft1 = cardRectsMap.get(originalCardsList[1])?.left || colLeft0;

        for (let slot = 0; slot < numCards; slot++) {
            const colIndex = slot % 2;
            const cardInSlot = slotToCardMap.get(slot);
            const cardHeight = cardRectsMap.get(cardInSlot)?.height || 0;

            if (colIndex === 0) {
                slotVisualRects.set(slot, { left: colLeft0, top: colTop0 });
                colTop0 += cardHeight + verticalGap;
            } else {
                slotVisualRects.set(slot, { left: colLeft1, top: colTop1 });
                colTop1 += cardHeight + verticalGap;
            }
        }
    }

    // 3. Apply GPU translate3d to each card based on its target visual position
    originalCardsList.forEach((c, idx) => {
        const originData = cardRectsMap.get(c);
        if (!originData) return;

        let targetIndex = idx;
        if (c === activeDragCard) {
            targetIndex = currentDropIndex;
        } else if (startIndex < currentDropIndex) {
            if (idx > startIndex && idx <= currentDropIndex) {
                targetIndex = idx - 1;
            }
        } else if (startIndex > currentDropIndex) {
            if (idx >= currentDropIndex && idx < startIndex) {
                targetIndex = idx + 1;
            }
        }

        const targetVisualPos = slotVisualRects.get(targetIndex);
        if (targetVisualPos) {
            const dx = targetVisualPos.left - originData.left;
            const dy = targetVisualPos.top - originData.top;

            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                c.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
                c.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
                return;
            }
        }

        c.style.transition = 'transform 180ms cubic-bezier(0.2, 0, 0, 1)';
        c.style.transform = '';
    });
}

function commitCardDrop() {
    if (!activeDragCard || !activeDragLayout) {
        cleanupActiveCardDrag();
        return;
    }

    const layout = activeDragLayout;
    const card = activeDragCard;

    // 1. Reset GPU transforms & min-heights
    if (originalCardsList) {
        originalCardsList.forEach(c => {
            c.style.transition = '';
            c.style.transform = '';
            c.style.minHeight = '';
        });
    }

    // 2. Perform SINGLE DOM commit across columns
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

    // 3. Save layout order and repack columns if compact mode is enabled
    saveCustomCardOrder(layout);

    if (layout.config.hasCompactMode && isCompact) {
        repackLayout(layout);
    }

    cleanupActiveCardDrag();
}

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

function handleGlobalMouseRelease(e) {
    if (!activeDragCard) return;
    commitCardDrop();
}

function canMoveToColumn(layout, draggingCard, targetColumn) {
    if (currentMode === 'cozy') return true;
    
    const totalCards = layout.originalCards.length;
    const limit = Math.floor(totalCards / 2) + 2;
    
    const currentInTarget = targetColumn.querySelectorAll(':scope > ' + layout.config.containerSelector);
    let count = currentInTarget.length;
    
    const isAlreadyInTarget = draggingCard.parentNode === targetColumn;
    if (!isAlreadyInTarget) {
        count += 1;
    }
    
    return count <= limit;
}

function initCardDragReordering(layout) {
    if (layout.cleanupListeners) {
        layout.cleanupListeners();
        layout.cleanupListeners = null;
    }

    // Attach drag handles to cards
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

        const handleStart = (e) => {
            if (currentMode === 'compact1') return;
            const containerCard = e.target.closest(layout.config.containerSelector);
            if (!containerCard) return;

            if (e.type === 'touchstart') {
                if (e.cancelable) e.preventDefault();
                startCardDrag(layout, containerCard, e.touches[0], e.touches[0].identifier);
            } else if (e.type === 'mousedown') {
                e.preventDefault();
                startCardDrag(layout, containerCard, e, null);
            }
        };

        dragHandle.addEventListener('touchstart', handleStart, { passive: false });
        dragHandle.addEventListener('mousedown', handleStart);
    });

    const gridEl = layout.gridEl;
    if (!gridEl) return;

    layout.cleanupListeners = () => {
        cleanupActiveCardDrag();
    };
}

/**
 * Initialize the card layout manager for all configured grids.
 * Call once after DOM is ready and initial render is complete.
 */
export function initCardLayoutManager() {
    for (const layout of layouts) {
        const gridEl = document.querySelector(layout.config.gridSelector);

        if (!gridEl) {
            logger.warn('CardLayoutManager: grid not found at selector', layout.config.gridSelector);
            continue;
        }

        layout.gridEl = gridEl;

        const savedOrder = state.uiSettings?.[layout.config.orderKey];
        if (savedOrder) {
            const containerMap = new Map();
            const containers = Array.from(gridEl.querySelectorAll(':scope > ' + layout.config.containerSelector));
            
            containers.forEach(container => {
                const key = layout.config.useHeroNameForId ? container.dataset.heroName : container.id;
                if (key) {
                    containerMap.set(key, container);
                }
            });
            
            savedOrder.forEach(id => {
                const container = containerMap.get(id);
                if (container) {
                    gridEl.appendChild(container);
                    containerMap.delete(id);
                }
            });
            
            containerMap.forEach(container => {
                gridEl.appendChild(container);
            });
        }

        if (layout.config.name === 'planner') {
            enforcePlannerHalfWidthAdjacency(gridEl);
        }

        layout.originalCards = Array.from(gridEl.querySelectorAll(':scope > ' + layout.config.containerSelector));
        layout.originalIndices.clear();
        layout.originalCards.forEach((card, index) => layout.originalIndices.set(card, index));

        initCardDragReordering(layout);

        layout.resizeObserver = new ResizeObserver((entries) => {
            onContainerResize(layout, entries);
        });
        observeContainers(layout);
    }

    window.addEventListener('resize', onWindowResize);

    logger.debug('CardLayoutManager: initialized');
}

/**
 * Refresh a specific layout container (e.g. after dynamic contents re-rendering).
 * @param {string} name
 */
export function refreshLayout(name) {
    const layout = layouts.find(l => l.config.name === name);
    if (!layout) return;

    const gridEl = document.querySelector(layout.config.gridSelector);
    if (!gridEl) return;

    layout.gridEl = gridEl;

    if (isCompact && layout.config.hasCompactMode) {
        gridEl.classList.add(COMPACT_CLASS);
        if (currentMode === 'compact1') {
            gridEl.classList.add('layout-compact-dev');
        } else {
            gridEl.classList.remove('layout-compact-dev');
        }
    } else {
        gridEl.classList.remove(COMPACT_CLASS);
        gridEl.classList.remove('layout-compact-dev');
    }

    // Apply saved order if any
    const savedOrder = state.uiSettings?.[layout.config.orderKey];
    if (savedOrder) {
        const containerMap = new Map();
        const containers = Array.from(gridEl.querySelectorAll(':scope > ' + layout.config.containerSelector));
        
        containers.forEach(container => {
            const key = layout.config.useHeroNameForId ? container.dataset.heroName : container.id;
            if (key) {
                containerMap.set(key, container);
            }
        });
        
        savedOrder.forEach(id => {
            const container = containerMap.get(id);
            if (container) {
                gridEl.appendChild(container);
                containerMap.delete(id);
            }
        });
        
        containerMap.forEach(container => {
            gridEl.appendChild(container);
        });
    }

    if (name === 'planner') {
        enforcePlannerHalfWidthAdjacency(gridEl);
    }

    layout.originalCards = Array.from(gridEl.querySelectorAll(':scope > ' + layout.config.containerSelector));
    layout.originalIndices.clear();
    layout.originalCards.forEach((card, index) => layout.originalIndices.set(card, index));

    initCardDragReordering(layout);

    if (layout.resizeObserver) {
        layout.resizeObserver.disconnect();
    }
    layout.resizeObserver = new ResizeObserver((entries) => {
        onContainerResize(layout, entries);
    });
    observeContainers(layout);
}

/**
 * Apply or remove compact layout.
 * @param {string} mode - The layout mode ('cozy', 'compact0', 'compact1').
 * @param {boolean} [animate=true] - Whether to animate the transition.
 */
export function applyCardLayout(mode, animate = true, isUserSwitch = true) {
    currentMode = mode;
    isCompact = (mode === 'compact0' || mode === 'compact1');

    if (isUserSwitch) {
        handleStateUpdate(() => {
            if (state.uiSettings) {
                LAYOUT_CONFIGS.forEach(config => {
                    delete state.uiSettings[config.orderKey];
                    if (config.compactOrderKey) {
                        delete state.uiSettings[config.compactOrderKey];
                    }
                });
            }
        }, true);
    }

    for (const layout of layouts) {
        if (!layout.gridEl) continue;

        if (isCompact && layout.config.hasCompactMode) {
            layout.gridEl.classList.add(COMPACT_CLASS);
            if (mode === 'compact1') {
                layout.gridEl.classList.add('layout-compact-dev');
            } else {
                layout.gridEl.classList.remove('layout-compact-dev');
            }
        } else {
            layout.gridEl.classList.remove(COMPACT_CLASS);
            layout.gridEl.classList.remove('layout-compact-dev');
        }
        observeContainers(layout);
    }

    if (isCompact) {
        applyPacking(animate);
    } else {
        clearPacking(animate);
    }

    logger.debug('CardLayoutManager: layout set to', mode);
}

/**
 * Force a repack of the cards (e.g., after content changes).
 * Only does anything if compact mode is active.
 */
export function repackCards() {
    if (!isCompact) return;
    for (const layout of layouts) {
        if (layout.gridEl && layout.config.hasCompactMode) {
            observeContainers(layout);
        }
    }
    applyPacking(true);
}

/**
 * Clean up observers and listeners.
 */
export function destroyCardLayoutManager() {
    for (const layout of layouts) {
        if (layout.resizeObserver) {
            layout.resizeObserver.disconnect();
            layout.resizeObserver = null;
        }

        clearColumns(layout);

        layout.heightMap.clear();
        layout.originalCards = [];
        layout.originalIndices.clear();
        layout.gridEl = null;
    }

    if (repackTimer !== null) {
        clearTimeout(repackTimer);
        repackTimer = null;
    }

    if (resizeTimer !== null) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
    }

    window.removeEventListener('resize', onWindowResize);

    isCompact = false;
    currentMode = 'cozy';

    logger.debug('CardLayoutManager: destroyed');
}
