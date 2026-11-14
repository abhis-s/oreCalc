/**
 * Queries and caches DOM element references for the Equipment overview tab and stats cards.
 *
 * @returns {Record<string, any>} Equipment DOM element references.
 */
export function getEquipmentDOMElements() {
    return {
        heroesContainer: document.getElementById('heroes-container'),
        heroesEmptyState: document.getElementById('eq-heroes-empty-state'),
        emptyShowMaxedBtn: document.getElementById('eq-empty-show-maxed-btn'),
        emptyAddComingSoonBtn: document.getElementById('eq-empty-add-coming-soon-btn'),
        enableLevelInputToggle: document.getElementById('eq-enable-level-edit-switch'),
        hideMaxedToggle: document.getElementById('eq-hide-maxed-switch'),
        hiddenCountLabel: document.getElementById('eq-hidden-count'),
        hideLockedToggle: document.getElementById('eq-hide-locked-switch'),
        lockedHiddenCountLabel: document.getElementById('eq-locked-hidden-count'),
        allowOverflowToggle: document.getElementById('eq-allow-overflow-switch'),
        storageOverflowWrapper: document.getElementById('eq-storage-overflow-setting-wrapper'),
        addComingSoonWrapper: document.getElementById('eq-add-coming-soon-setting-wrapper'),
        comingSoonSwitch: document.getElementById('eq-coming-soon-switch'),
        addComingSoonDesc: document.getElementById('eq-add-coming-soon-desc'),
        storageGoalBarContainer: document.getElementById('eq-storage-goal-bar-container'),
        storageMeters: {
            shiny: {
                wrapper: document.getElementById('eq-shiny-meter'),
                fill: document.getElementById('eq-shiny-fill'),
                tag: document.getElementById('eq-shiny-tag')
            },
            glowy: {
                wrapper: document.getElementById('eq-glowy-meter'),
                fill: document.getElementById('eq-glowy-fill'),
                tag: document.getElementById('eq-glowy-tag')
            },
            starry: {
                wrapper: document.getElementById('eq-starry-meter'),
                fill: document.getElementById('eq-starry-fill'),
                tag: document.getElementById('eq-starry-tag')
            }
        },
        results: {
            titleText: document.getElementById('results-title-text'),
            quantity: {
                shiny: document.getElementById('eq-shiny-ore-result'),
                glowy: document.getElementById('eq-glowy-ore-result'),
                starry: document.getElementById('eq-starry-ore-result'),
            },
        },
        storage: {
            titleText: document.getElementById('storage-title-text'),
            quantity: {
                shiny: document.getElementById('eq-shiny-ore-storage'),
                glowy: document.getElementById('eq-glowy-ore-storage'),
                starry: document.getElementById('eq-starry-ore-storage'),
            },
        },
    };
}
