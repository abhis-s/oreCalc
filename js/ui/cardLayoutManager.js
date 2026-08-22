import { state } from '../core/state.js';
import { handleStateUpdate } from '../core/stateManager.js';

import { logger } from '../utils/logger.js';

import {
    cleanupActiveCardDrag,
    initCardDragReordering
} from './cardDragManager.js';
import {
    COMPACT_CLASS,
    debounce,
    DEBOUNCE_MS,
    enforcePlannerHalfWidthAdjacency,
    LAYOUT_CONFIGS,
    layouts
} from './cardLayoutConfig.js';
import {
    applyPacking,
    clearPacking,
    observeContainers,
    onContainerResize
} from './cardPackingEngine.js';

let isCompact = false;
let currentMode = 'cozy'; // 'cozy', 'compact0', 'compact1'
let isWindowResizing = false;
let windowResizeTimeout = null;
let resizeTimer = null;

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

    cleanupActiveCardDrag();

    requestAnimationFrame(() => {
        layouts.forEach(layout => {
            if (layout.gridEl) {
                const cards = layout.gridEl.querySelectorAll(layout.config.containerSelector);
                cards.forEach(card => {
                    /** @type {HTMLElement} */ (card).style.transform = '';
                    /** @type {HTMLElement} */ (card).style.willChange = '';
                    /** @type {HTMLElement} */ (card).style.transition = '';
                });
            }
        });
    });

    if (resizeTimer !== null) {
        clearTimeout(resizeTimer);
    }
    resizeTimer = debounce(() => {
        resizeTimer = null;
        if (isCompact) {
            applyPacking(true, currentMode);
        } else {
            layouts.forEach(l => refreshLayout(l.config.name));
        }
    }, DEBOUNCE_MS);
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

        layout.originalCards = /** @type {HTMLElement[]} */ (Array.from(gridEl.querySelectorAll(':scope > ' + layout.config.containerSelector)));
        layout.originalIndices.clear();
        layout.originalCards.forEach((card, index) => layout.originalIndices.set(card, index));

        initCardDragReordering(layout, currentMode, isCompact, repackCards);

        layout.resizeObserver = new ResizeObserver((entries) => {
            onContainerResize(layout, entries, isCompact, currentMode);
        });
        observeContainers(layout);
    }

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);
    if (typeof screen !== 'undefined' && screen?.orientation?.addEventListener) {
        screen.orientation.addEventListener('change', onWindowResize);
    }

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

    layout.originalCards = /** @type {HTMLElement[]} */ (Array.from(gridEl.querySelectorAll(':scope > ' + layout.config.containerSelector)));
    layout.originalIndices.clear();
    layout.originalCards.forEach((card, index) => layout.originalIndices.set(card, index));

    initCardDragReordering(layout, currentMode, isCompact, repackCards);

    if (layout.resizeObserver) {
        layout.resizeObserver.disconnect();
    }
    layout.resizeObserver = new ResizeObserver((entries) => {
        onContainerResize(layout, entries, isCompact, currentMode);
    });
    observeContainers(layout);
}

/**
 * Apply or remove compact layout.
 * @param {string} mode - The layout mode ('cozy', 'compact0', 'compact1').
 * @param {boolean} [animate=true] - Whether to animate the transition.
 * @param {boolean} [isUserSwitch=true] - Whether this switch was triggered directly by user action.
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
        initCardDragReordering(layout, currentMode, isCompact, repackCards);
    }

    if (isCompact) {
        applyPacking(animate, currentMode);
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
    applyPacking(true, currentMode);
}
