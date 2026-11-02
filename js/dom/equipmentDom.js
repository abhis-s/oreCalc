/**
 * Queries and caches DOM element references for the Equipment overview tab and stats cards.
 *
 * @returns {Record<string, any>} Equipment DOM element references.
 */
export function getEquipmentDOMElements() {
    return {
        heroesContainer: document.getElementById('heroes-container'),
        enableLevelInputToggle: document.getElementById('eq-enable-level-edit-switch'),
        hideMaxedToggle: document.getElementById('eq-hide-maxed-switch'),
        hiddenCountLabel: document.getElementById('eq-hidden-count'),
        hideLockedToggle: document.getElementById('eq-hide-locked-switch'),
        lockedHiddenCountLabel: document.getElementById('eq-locked-hidden-count'),
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
