import { logger } from '../utils/logger.js';
import { state } from '../core/state.js';
import { handleStateUpdate } from '../core/stateManager.js';

const CONTAINER_SELECTOR = '.card-container';
const COMPACT_CLASS = 'layout-compact';
const HEIGHT_THRESHOLD = 10;
const DEBOUNCE_MS = 150;
const TRANSITION_DURATION = 350;
const TRANSITION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

const LAYOUT_CONFIGS = [
    {
        name: 'income',
        gridSelector: '#income-tab .income-cards-grid',
        prefix: 'income'
    },
    {
        name: 'settings',
        gridSelector: '#settings-tab .settings-cards-grid',
        prefix: 'settings'
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
 * @returns {Object[]}
 */
function packCardsCompact0(layout) {
    const columns = [
        { height: 0, items: [] },
        { height: 0, items: [] }
    ];

    for (let i = 0; i < layout.originalCards.length; i += 2) {
        const card0 = layout.originalCards[i];
        const card1 = layout.originalCards[i + 1] || null;

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
 * @returns {Object[]}
 */
function packCardsCompact1(layout) {
    const measured = layout.originalCards.map(el => ({
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
    let oddCountA = 0;
    let evenCountA = 0;
    let oddCountB = 0;
    let evenCountB = 0;

    colA_items.forEach(el => {
        const index = layout.originalIndices.get(el);
        if (index % 2 === 1) oddCountA++;
        else evenCountA++;
    });

    colB_items.forEach(el => {
        const index = layout.originalIndices.get(el);
        if (index % 2 === 1) oddCountB++;
        else evenCountB++;
    });

    // Score is (odd - even). Lower score means more even items (Left). Higher score means more odd items (Right).
    const scoreA = oddCountA - evenCountA;
    const scoreB = oddCountB - evenCountB;

    if (scoreA < scoreB) {
        return { leftItems: colA_items, rightItems: colB_items };
    } else if (scoreB < scoreA) {
        return { leftItems: colB_items, rightItems: colA_items };
    } else {
        // Tie breaker: the column containing the first card of the original layout (Star Bonus / Preferences) goes left
        const hasFirstCardA = colA_items.some(el => layout.originalIndices.get(el) === 0);
        if (hasFirstCardA) {
            return { leftItems: colA_items, rightItems: colB_items };
        } else {
            return { leftItems: colB_items, rightItems: colA_items };
        }
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
        if (!layout.gridEl || layout.originalCards.length === 0) continue;

        if (!isDesktop) {
            // Fallback to normal layout on mobile devices
            clearColumns(layout);
            continue;
        }

        const firstPositions = animate ? recordPositions(layout.originalCards) : null;
        const [col0, col1] = getOrCreateColumns(layout);

        // If we have a saved custom compact order, restore it directly instead of running the algorithm
        if (currentMode === 'compact0' && state.uiSettings?.incomeCompactCardOrder && layout.config.name === 'income') {
            const saved = state.uiSettings.incomeCompactCardOrder;
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

        const columns = currentMode === 'compact1'
            ? packCardsCompact1(layout)
            : packCardsCompact0(layout);

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
    if (resizeTimer !== null) {
        clearTimeout(resizeTimer);
    }
    resizeTimer = debounce(() => {
        resizeTimer = null;
        if (isCompact) {
            applyPacking(false);
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
        layout.resizeObserver.observe(el);
        layout.heightMap.set(el, el.getBoundingClientRect().height);
    }
}

function saveCustomCardOrder(layout) {
    if (layout.config.name !== 'income') return;
    
    if (currentMode === 'compact0') {
        const col0 = layout.gridEl.querySelector(`#${layout.config.prefix}-column-0`);
        const col1 = layout.gridEl.querySelector(`#${layout.config.prefix}-column-1`);
        if (col0 && col1) {
            const getIds = (col) => Array.from(col.querySelectorAll(':scope > ' + CONTAINER_SELECTOR))
                .map(container => container.querySelector('.income-card')?.id)
                .filter(Boolean);
            
            handleStateUpdate(() => {
                if (!state.uiSettings) state.uiSettings = {};
                state.uiSettings.incomeCompactCardOrder = {
                    column0: getIds(col0),
                    column1: getIds(col1)
                };
            }, true);
        }
        return;
    }
    
    const currentCards = Array.from(layout.gridEl.querySelectorAll(':scope > ' + CONTAINER_SELECTOR));
    
    layout.originalCards = currentCards;
    layout.originalIndices.clear();
    layout.originalCards.forEach((card, index) => layout.originalIndices.set(card, index));
    
    const cardIds = currentCards.map(container => {
        const card = container.querySelector('.income-card');
        return card ? card.id : null;
    }).filter(Boolean);
    
    handleStateUpdate(() => {
        if (!state.uiSettings) state.uiSettings = {};
        state.uiSettings.incomeCardOrder = cardIds;
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

function initCardDragReordering(layout) {
    if (layout.config.name !== 'income') return;
    
    function canMoveToColumn(draggingCard, targetColumn) {
        if (currentMode === 'cozy') return true;
        
        const totalCards = layout.originalCards.length;
        const limit = Math.floor(totalCards / 2) + 2;
        
        const currentInTarget = targetColumn.querySelectorAll(':scope > ' + CONTAINER_SELECTOR);
        let count = currentInTarget.length;
        
        const isAlreadyInTarget = draggingCard.parentNode === targetColumn;
        if (!isAlreadyInTarget) {
            count += 1;
        }
        
        return count <= limit;
    }
    
    layout.originalCards.forEach(container => {
        const card = container.querySelector('.income-card');
        if (!card) return;
        
        if (card.querySelector('.card-drag-handle')) return;
        
        const dragHandle = document.createElement('div');
        dragHandle.className = 'card-drag-handle';
        dragHandle.setAttribute('draggable', 'true');
        dragHandle.innerHTML = `<orecalc-assets-svg name="drag-indicator" fill="#e3e3e3"></orecalc-assets-svg>`;
        
        card.appendChild(dragHandle);
        
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
        const container = e.target.closest(CONTAINER_SELECTOR);
        if (!container) return;
        
        container.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    gridEl.addEventListener('dragend', (e) => {
        const container = e.target.closest(CONTAINER_SELECTOR);
        if (container) {
            container.classList.remove('dragging');
            container.setAttribute('draggable', 'false');
        }
        saveCustomCardOrder(layout);
        stopAutoScroll();
    });

    gridEl.addEventListener('dragover', (e) => {
        if (currentMode === 'compact1') return;
        e.preventDefault();
        
        const draggingCard = gridEl.querySelector('.dragging');
        if (!draggingCard) return;
        
        const targetCard = e.target.closest(CONTAINER_SELECTOR);
        
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
                    targetColumn.appendChild(draggingCard);
                }
            }
            return;
        }
        
        if (targetCard === draggingCard) return;

        const targetColumn = targetCard.parentNode;

        // --- Drag Insertion Logic ---
        const cards = Array.from(gridEl.querySelectorAll(CONTAINER_SELECTOR));
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
            if (targetIsBelow || !isSameColumn) {
                if (clientY > rect.top + rect.height * 0.3) {
                    if (canMoveToColumn(draggingCard, targetColumn)) {
                        targetColumn.insertBefore(draggingCard, targetCard.nextSibling);
                    }
                }
            } else {
                if (e.clientX > rect.left + rect.width * 0.3) {
                    if (canMoveToColumn(draggingCard, targetColumn)) {
                        targetColumn.insertBefore(draggingCard, targetCard.nextSibling);
                    }
                }
            }
        } else {
            const targetIsAbove = rect.bottom < dragRect.bottom - 10;
            if (targetIsAbove || !isSameColumn) {
                if (clientY < rect.bottom - rect.height * 0.3) {
                    if (canMoveToColumn(draggingCard, targetColumn)) {
                        targetColumn.insertBefore(draggingCard, targetCard);
                    }
                }
            } else {
                if (e.clientX < rect.right - rect.width * 0.3) {
                    if (canMoveToColumn(draggingCard, targetColumn)) {
                        targetColumn.insertBefore(draggingCard, targetCard);
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

        if (layout.config.name === 'income' && state.uiSettings?.incomeCardOrder) {
            const savedOrder = state.uiSettings.incomeCardOrder;
            const containerMap = new Map();
            const containers = Array.from(gridEl.querySelectorAll(':scope > ' + CONTAINER_SELECTOR));
            
            containers.forEach(container => {
                const card = container.querySelector('.income-card');
                if (card && card.id) {
                    containerMap.set(card.id, container);
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

        layout.originalCards = Array.from(gridEl.querySelectorAll(':scope > ' + CONTAINER_SELECTOR));
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
                delete state.uiSettings.incomeCardOrder;
                delete state.uiSettings.incomeCompactCardOrder;
            }
        }, true);
    }

    for (const layout of layouts) {
        if (!layout.gridEl) continue;

        if (isCompact) {
            layout.gridEl.classList.add(COMPACT_CLASS);
            if (mode === 'compact1') {
                layout.gridEl.classList.add('layout-compact-dev');
            } else {
                layout.gridEl.classList.remove('layout-compact-dev');
            }
            observeContainers(layout);
        } else {
            layout.gridEl.classList.remove(COMPACT_CLASS);
            layout.gridEl.classList.remove('layout-compact-dev');
            if (layout.resizeObserver) {
                layout.originalCards.forEach(card => layout.resizeObserver.unobserve(card));
            }
        }
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
        if (layout.gridEl) {
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
