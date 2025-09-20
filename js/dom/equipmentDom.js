export function getEquipmentDOMElements() {
    return {
        heroesContainer: document.getElementById('heroes-container'),
        enableLevelInputToggle: document.getElementById('eq-enable-level-input-toggle'),
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