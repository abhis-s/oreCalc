import { state } from '../core/state.js';

import { logger } from '../utils/logger.js';

import {
    clearColumns,
    COMPACT_CLASS,
    debounce,
    DEBOUNCE_MS,
    getOrCreateColumns,
    HEIGHT_THRESHOLD,
    layouts,
    TRANSITION_DURATION,
    TRANSITION_EASING
} from './cardLayoutConfig.js';

let repackTimer = null;

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
            columns[target].height += layout.heightMap.get(card0) || 0;
        } else {
            // Two cards in the row. Decide whether to swap them.
            const h0 = layout.heightMap.get(card0) || 0;
            const h1 = layout.heightMap.get(card1) || 0;

            const diff1 = Math.abs((columns[0].height + h0) - (columns[1].height + h1));
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
        height: layout.heightMap.get(el) || 0
    }));

    measured.sort((a, b) => b.height - a.height);

    const columns = [
        { height: 0, items: [] },
        { height: 0, items: [] }
    ];

    for (const card of measured) {
        const target = columns[0].height <= columns[1].height ? 0 : 1;
        columns[target].items.push(card.element);
        columns[target].height += card.height + 20;
    }

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

    const totalA = colA_items.length;
    const isALeftMajority = leftCountA > totalA / 2;
    const isARightMajority = rightCountA > totalA / 2;

    if (isALeftMajority) {
        return { leftItems: colA_items, rightItems: colB_items };
    }
    if (isARightMajority) {
        return { leftItems: colB_items, rightItems: colA_items };
    }

    const totalB = colB_items.length;
    const isBLeftMajority = leftCountB > totalB / 2;
    const isBRightMajority = rightCountB > totalB / 2;

    if (isBLeftMajority) {
        return { leftItems: colB_items, rightItems: colA_items };
    }
    if (isBRightMajority) {
        return { leftItems: colA_items, rightItems: colB_items };
    }

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
    const transformsToApply = [];
    for (const el of containers) {
        const first = firstPositions.get(el);
        if (!first) continue;

        const last = el.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top - last.top;

        if (dx !== 0 || dy !== 0) {
            transformsToApply.push({ el, dx, dy });
        }
    }

    for (const { el, dx, dy } of transformsToApply) {
        el.style.willChange = 'transform';
        el.style.transition = 'none';
        el.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    requestAnimationFrame(() => {
        for (const el of containers) {
            const first = firstPositions.get(el);
            if (!first) continue;

            el.style.transition = `transform ${TRANSITION_DURATION}ms ${TRANSITION_EASING}`;
            el.style.transform = '';
        }

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
 * @param {string} currentMode
 */
export function applyPacking(animate, currentMode) {
    const isDesktop = window.innerWidth >= 780;

    for (const layout of layouts) {
        if (!layout.config.hasCompactMode) continue;
        if (!layout.gridEl || layout.originalCards.length === 0) continue;

        if (!isDesktop) {
            layout.gridEl.classList.remove(COMPACT_CLASS);
            layout.gridEl.classList.remove('layout-compact-dev');

            const firstPositions = animate ? recordPositions(layout.originalCards) : null;
            clearColumns(layout);
            if (animate && firstPositions) {
                flipAnimate(layout.gridEl, layout.originalCards, firstPositions);
            }
            continue;
        }

        layout.gridEl.classList.add(COMPACT_CLASS);
        if (currentMode === 'compact1') {
            layout.gridEl.classList.add('layout-compact-dev');
        } else {
            layout.gridEl.classList.remove('layout-compact-dev');
        }

        const firstPositions = animate ? recordPositions(layout.originalCards) : null;
        const [col0, col1] = getOrCreateColumns(layout);

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

        const visibleCards = layout.originalCards.filter(card => {
            return window.getComputedStyle(card).display !== 'none';
        });

        layout.originalIndices.clear();
        visibleCards.forEach((card, index) => layout.originalIndices.set(card, index));

        for (const card of visibleCards) {
            if (!layout.heightMap.has(card)) {
                layout.heightMap.set(card, card.getBoundingClientRect().height);
            }
        }

        const columns = currentMode === 'compact1'
            ? packCardsCompact1(layout, visibleCards)
            : packCardsCompact0(layout, visibleCards);

        const { leftItems, rightItems } = determineColumnOrder(layout, columns[0].items, columns[1].items);

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
export function clearPacking(animate) {
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
 * @param {boolean} isCompact
 * @param {string} currentMode
 */
function scheduleRepack(isCompact, currentMode) {
    if (repackTimer !== null) {
        clearTimeout(repackTimer);
    }
    repackTimer = debounce(() => {
        repackTimer = null;
        if (isCompact) {
            applyPacking(true, currentMode);
        }
    }, DEBOUNCE_MS);
}

/**
 * ResizeObserver callback — triggers repack when any card's height
 * changes by more than the threshold.
 * @param {Object} layout
 * @param {ResizeObserverEntry[]} entries
 * @param {boolean} isCompact
 * @param {string} currentMode
 */
export function onContainerResize(layout, entries, isCompact, currentMode) {
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
        scheduleRepack(isCompact, currentMode);
    }
}

/**
 * Observe all containers on a specific layout.
 * @param {Object} layout
 */
export function observeContainers(layout) {
    if (!layout.resizeObserver) return;

    for (const el of layout.originalCards) {
        if (el.id === 'priority-list-card' || el.id === 'planner-calendar-card') {
            continue;
        }
        layout.resizeObserver.observe(el);
        layout.heightMap.set(el, el.getBoundingClientRect().height);
    }
}
