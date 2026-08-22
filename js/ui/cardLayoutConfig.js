import { state } from '../core/state.js';
import { handleStateUpdate } from '../core/stateManager.js';

export const COMPACT_CLASS = 'layout-compact';
export const HEIGHT_THRESHOLD = 10;
export const DEBOUNCE_MS = 150;
export const TRANSITION_DURATION = 250;
export const TRANSITION_EASING = 'cubic-bezier(0.2, 1, 0.2, 1)';

export const LAYOUT_CONFIGS = [
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

/**
 * Global layouts state tracking array.
 */
export const layouts = LAYOUT_CONFIGS.map(config => ({
    config,
    gridEl: null,
    originalCards: [],
    originalIndices: new Map(),
    heightMap: new Map(),
    resizeObserver: null,
    cleanupListeners: null
}));

/**
 * Debounce helper that returns a cancel-able timer id.
 * @param {Function} fn
 * @param {number} delay
 * @returns {any} timer id
 */
export function debounce(fn, delay) {
    return setTimeout(fn, delay);
}

/**
 * Get or create the two column divs for compact layout on a specific config.
 * @param {Object} layout
 * @returns {HTMLDivElement[]}
 */
export function getOrCreateColumns(layout) {
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
export function clearColumns(layout) {
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
 * Enforces half-width adjacency rule on Planner tab for carousel and priority list.
 * @param {Element|HTMLElement|null} gridEl
 */
export function enforcePlannerHalfWidthAdjacency(gridEl) {
    if (!gridEl) return;
    const carousel = gridEl.querySelector('#planner-hero-carousel-card');
    const priority = gridEl.querySelector('#priority-list-card');
    if (!carousel || !priority) return;

    if (carousel.nextElementSibling !== priority) {
        carousel.parentNode.insertBefore(priority, carousel.nextSibling);
    }
}

/**
 * Extracts card title text from heading or fallback element ID.
 * @param {HTMLElement} container
 * @returns {string}
 */
export function getCardTitleText(container) {
    const titleEl = container.querySelector('h2, h3');
    if (titleEl) {
        return titleEl.textContent.trim();
    }
    if (container.dataset.heroName) return container.dataset.heroName;
    if (container.id) return container.id.replace('planner-', '').replace('-card', '').replace('eq-', '');
    return 'Card';
}

/**
 * Persists customized card order to state.
 * @param {Object} layout
 * @param {string} [currentMode='cozy']
 */
export function saveCustomCardOrder(layout, currentMode = 'cozy') {
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
