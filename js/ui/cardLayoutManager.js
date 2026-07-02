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

const animateInsertion = (layout, action, targetCard) => {
    const draggingCard = layout.gridEl.querySelector('.dragging');
    if (draggingCard && targetCard) {
        const now = Date.now();
        if (lastSwapCards && lastSwapCards.has(draggingCard) && lastSwapCards.has(targetCard) && (now - lastSwapTime < 350)) {
            return;
        }
        lastSwapTime = now;
        lastSwapCards = new Set([draggingCard, targetCard]);
    }

    const firstPositions = recordPositions(layout.originalCards);
    action();
    flipAnimate(layout.gridEl, layout.originalCards, firstPositions);
};

function initCardDragReordering(layout) {
    function canMoveToColumn(draggingCard, targetColumn) {
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
    
    layout.originalCards.forEach(container => {
        if (container.id === 'planner-hero-carousel-card' || container.id === 'eq-settings-container-card') {
            return;
        }
        const handleTarget = container.querySelector(layout.config.dragHandleSelector);
        if (!handleTarget) return;
        
        if (handleTarget.querySelector('.card-drag-handle')) return;
        
        const dragHandle = document.createElement('div');
        dragHandle.className = 'card-drag-handle';
        dragHandle.setAttribute('draggable', 'true');
        dragHandle.innerHTML = `<orecalc-assets-svg name="drag-indicator" fill="currentColor"></orecalc-assets-svg>`;
        
        // Match drag handle position to card padding dynamically if requested
        handleTarget.appendChild(dragHandle);
        
        dragHandle.addEventListener('mousedown', () => {
            if (currentMode === 'compact1') return;
            container.setAttribute('draggable', 'true');
        });
        
        dragHandle.addEventListener('mouseup', () => {
            container.setAttribute('draggable', 'false');
        });
        
        dragHandle.addEventListener('touchstart', () => {
            if (currentMode === 'compact1') return;
            container.setAttribute('draggable', 'true');
        }, { passive: true });
        
        dragHandle.addEventListener('touchend', () => {
            container.setAttribute('draggable', 'false');
        });
    });

    const gridEl = layout.gridEl;
    
    gridEl.addEventListener('dragstart', (e) => {
        if (currentMode === 'compact1') {
            e.preventDefault();
            return;
        }
        const container = e.target.closest(layout.config.containerSelector);
        if (!container) return;
        
        if (container.getAttribute('draggable') !== 'true') {
            return;
        }
        
        container.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';

        // Create custom drag preview pill
        const titleText = getCardTitleText(container);
        const dragPreview = document.createElement('div');
        dragPreview.className = 'card-drag-preview-pill';
        dragPreview.innerHTML = `
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
        document.body.appendChild(dragPreview);
        e.dataTransfer.setDragImage(dragPreview, 25, 18);
        setTimeout(() => dragPreview.remove(), 0);
    });

    gridEl.addEventListener('dragend', (e) => {
        const container = e.target.closest(layout.config.containerSelector);
        if (container) {
            container.classList.remove('dragging');
            container.setAttribute('draggable', 'false');
        }
        lastSwapCards = null;
        lastSwapTime = 0;
        saveCustomCardOrder(layout);
        stopAutoScroll();
    });

    gridEl.addEventListener('dragover', (e) => {
        if (currentMode === 'compact1') return;
        e.preventDefault();
        
        const draggingCard = gridEl.querySelector('.dragging');
        if (!draggingCard) return;
        
        const targetCard = e.target.closest(layout.config.containerSelector);
        
        // --- Viewport Auto-scrolling ---
        const scrollZoneHeight = 120; // pixels from top/bottom of viewport
        const maxSpeed = 15;
        const clientY = e.clientY;
        
        if (clientY < scrollZoneHeight) {
            const ratio = (scrollZoneHeight - clientY) / scrollZoneHeight;
            const speed = -Math.round(ratio * maxSpeed);
            startAutoScroll(speed);
        } else if (window.innerHeight - clientY < scrollZoneHeight) {
            const ratio = (scrollZoneHeight - (window.innerHeight - clientY)) / scrollZoneHeight;
            const speed = Math.round(ratio * maxSpeed);
            startAutoScroll(speed);
        } else {
            stopAutoScroll();
        }

        // Handle dragging over the column itself (e.g. empty column space)
        if (!targetCard) {
            const targetColumn = e.target.closest('.layout-grid-column');
            if (targetColumn && draggingCard.parentNode !== targetColumn) {
                if (canMoveToColumn(draggingCard, targetColumn)) {
                    if (willChangePosition(draggingCard, targetColumn, null)) {
                        animateInsertion(layout, () => {
                            targetColumn.appendChild(draggingCard);
                        });
                    }
                }
            }
            return;
        }
        
        if (targetCard === draggingCard) return;

        // Custom logic for Planner layout side-by-side pairing preservation
        if (layout.config.isPlannerLayout) {
            const cards = Array.from(gridEl.querySelectorAll(layout.config.containerSelector));
            const draggingIndex = cards.indexOf(draggingCard);
            const targetIndex = cards.indexOf(targetCard);
            
            if (draggingIndex === -1 || targetIndex === -1) return;

            // Half-width cards: carousel and priority-list
            const isDraggingHalf = draggingCard.id === 'planner-hero-carousel-card' || draggingCard.id === 'priority-list-card';
            const isTargetFull = targetCard.id === 'planner-max-levels-card' || targetCard.id === 'planner-calendar-card';

            if (isDraggingHalf && isTargetFull) {
                // Move both half-width cards together
                const carousel = gridEl.querySelector('#planner-hero-carousel-card');
                const priority = gridEl.querySelector('#priority-list-card');
                if (carousel && priority) {
                    const rect = targetCard.getBoundingClientRect();
                    const isAfter = clientY > rect.top + rect.height * 0.5;
                    
                    if (isAfter) {
                        const targetSibling = targetCard.nextSibling;
                        if (willChangePosition(carousel, gridEl, targetSibling) || willChangePosition(priority, gridEl, carousel.nextSibling)) {
                            animateInsertion(layout, () => {
                                gridEl.insertBefore(carousel, targetSibling);
                                gridEl.insertBefore(priority, carousel.nextSibling);
                            });
                        }
                    } else {
                        if (willChangePosition(carousel, gridEl, targetCard) || willChangePosition(priority, gridEl, carousel.nextSibling)) {
                            animateInsertion(layout, () => {
                                gridEl.insertBefore(carousel, targetCard);
                                gridEl.insertBefore(priority, carousel.nextSibling);
                            });
                        }
                    }
                }
                return;
            }
        }

        const targetColumn = targetCard.parentNode;

        // --- Drag Insertion Logic ---
        const cards = Array.from(gridEl.querySelectorAll(layout.config.containerSelector));
        const draggingIndex = cards.indexOf(draggingCard);
        const targetIndex = cards.indexOf(targetCard);
        
        if (draggingIndex === -1 || targetIndex === -1) return;
        
        const rect = targetCard.getBoundingClientRect();
        const dragRect = draggingCard.getBoundingClientRect();
        
        const isSameColumn = draggingCard.parentNode === targetColumn;
        let isAfter;
        if (isSameColumn) {
            isAfter = draggingIndex < targetIndex;
        } else {
            isAfter = clientY > rect.top + rect.height * 0.5;
        }
        
        if (isAfter) {
            const targetIsBelow = rect.top > dragRect.top + 10;
            const targetSibling = targetCard.nextSibling;
            if (targetIsBelow || !isSameColumn) {
                if (clientY > rect.top + rect.height * 0.3) {
                    if (canMoveToColumn(draggingCard, targetColumn)) {
                        if (willChangePosition(draggingCard, targetColumn, targetSibling)) {
                            animateInsertion(layout, () => {
                                targetColumn.insertBefore(draggingCard, targetSibling);
                            }, targetCard);
                        }
                    }
                }
            } else {
                if (e.clientX > rect.left + rect.width * 0.3) {
                    if (canMoveToColumn(draggingCard, targetColumn)) {
                        if (willChangePosition(draggingCard, targetColumn, targetSibling)) {
                            animateInsertion(layout, () => {
                                targetColumn.insertBefore(draggingCard, targetSibling);
                            }, targetCard);
                        }
                    }
                }
            }
        } else {
            const targetIsAbove = rect.bottom < dragRect.bottom - 10;
            if (targetIsAbove || !isSameColumn) {
                if (clientY < rect.bottom - rect.height * 0.3) {
                    if (canMoveToColumn(draggingCard, targetColumn)) {
                        if (willChangePosition(draggingCard, targetColumn, targetCard)) {
                            animateInsertion(layout, () => {
                                targetColumn.insertBefore(draggingCard, targetCard);
                            }, targetCard);
                        }
                    }
                }
            } else {
                if (e.clientX < rect.right - rect.width * 0.3) {
                    if (canMoveToColumn(draggingCard, targetColumn)) {
                        if (willChangePosition(draggingCard, targetColumn, targetCard)) {
                            animateInsertion(layout, () => {
                                targetColumn.insertBefore(draggingCard, targetCard);
                            }, targetCard);
                        }
                    }
                }
            }
        }
    });
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
