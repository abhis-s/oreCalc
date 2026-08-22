import { translate } from '../../i18n/translator.js';

function createTimeframeGrid(timeframes, idPrefix) {
    const container = document.createElement('div');
    container.className = 'four-col-grid generated';

    timeframes.forEach(timeframe => {
        const row = document.createElement('div');
        row.className = 'grid-row';

        const label = document.createElement('div');
        label.className = 'grid-label';
        const i18nKey = `time.${timeframe}`;
        label.dataset.i18n = i18nKey;
        label.textContent = translate(i18nKey);
        row.appendChild(label);

        const oreTypes = ['shiny', 'glowy', 'starry'];
        oreTypes.forEach(ore => {
            const valDisplay = document.createElement('div');
            valDisplay.className = 'grid-value-display';

            const span = document.createElement('span');
            span.id = `inc-${idPrefix}-${ore}-${timeframe}-value`;
            span.className = 'calculated';
            valDisplay.appendChild(span);

            valDisplay.appendChild(document.createTextNode(' '));

            const img = document.createElement('orecalc-assets-image');
            img.setAttribute('src', `assets/${ore}_ore.png`);
            const capitalizedOre = ore.charAt(0).toUpperCase() + ore.slice(1);
            img.setAttribute('alt', `${capitalizedOre} Ore`);
            img.dataset.i18nAlt = `entities.ores.${ore}`;
            img.setAttribute('class', 'ore-image');
            valDisplay.appendChild(img);

            row.appendChild(valDisplay);
        });

        container.appendChild(row);
    });

    return container;
}

/**
 * Injects a generated 4-column timeframe grid into an income card wrapper element.
 * @param {string} containerId - Target DOM element ID.
 * @param {Array<string>} timeframes - List of timeframe keys (e.g. ['daily', 'monthly']).
 * @param {string} idPrefix - ID prefix for child value elements.
 */
export function populateTimeframeGrid(containerId, timeframes, idPrefix) {
    const containerEl = document.getElementById(containerId);
    if (!containerEl) return;

    let wrapper = containerEl.querySelector('.timeframe-income');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'timeframe-income';
        containerEl.appendChild(wrapper);
    }

    const existing = wrapper.querySelectorAll('.four-col-grid.generated');
    existing.forEach(el => el.remove());

    const grid = createTimeframeGrid(timeframes, idPrefix);
    wrapper.appendChild(grid);
}
