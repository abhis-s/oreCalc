import { translate } from '../../i18n/translator.js';

export function createOreDisplay(config, oreType) {
    const container = document.createElement('div');
    container.className = 'ore';

    const img = document.createElement('orecalc-assets-image');
    img.setAttribute('src', `assets/${oreType}_ore.png`);
    const capitalizedOre = oreType.charAt(0).toUpperCase() + oreType.slice(1);
    img.setAttribute('alt', `${capitalizedOre} Ore`);
    img.dataset.i18nAlt = `ores.${oreType}`;
    img.setAttribute('class', 'ore-image');
    container.appendChild(img);

    if (config.type === 'value') {
        const span = document.createElement('span');
        span.id = config.idFormat(oreType);
        span.className = 'ore-value calculated';
        container.appendChild(span);
    } else if (config.type === 'input') {
        const wrapper = document.createElement('div');
        wrapper.className = 'ore-input-wrapper';

        const input = document.createElement('input');
        input.type = 'number';
        input.id = config.idFormat(oreType);
        input.name = config.idFormat(oreType);
        input.className = 'ore-value updatable';
        input.value = '0';
        input.min = '0';
        
        // Add aria-label for accessibility
        const labelText = `${translate('ores.storedTitle') || 'Stored Ores'} - ${translate(`ores.${oreType}`) || (oreType.charAt(0).toUpperCase() + oreType.slice(1) + ' Ore')}`;
        input.setAttribute('aria-label', labelText);
        
        if (oreType === 'shiny') {
            input.max = '50000';
            input.maxLength = 5;
        } else if (oreType === 'glowy') {
            input.max = '5000';
            input.maxLength = 4;
        } else {
            input.max = '1000';
            input.maxLength = 4;
        }
        
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    } else if (config.type === 'time') {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'ore-time';

        const units = ['years', 'months', 'days'];
        const unitSuffixes = { 'years': 'y', 'months': 'm', 'days': 'd' };

        units.forEach(unit => {
            const valSpan = document.createElement('span');
            valSpan.id = config.timeIdFormat(oreType, unit);
            valSpan.className = 'calculated';
            timeSpan.appendChild(valSpan);

            const suffixSpan = document.createElement('span');
            suffixSpan.dataset.i18n = `time.${unit}Suffix`;
            suffixSpan.textContent = unitSuffixes[unit];
            timeSpan.appendChild(suffixSpan);
        });

        container.appendChild(timeSpan);

        const dateSpan = document.createElement('span');
        dateSpan.id = config.dateIdFormat(oreType);
        dateSpan.className = 'ore-date calculated';
        container.appendChild(dateSpan);
    }

    return container;
}

export function populateOreContainer(containerId, config) {
    const containerEl = document.getElementById(containerId);
    if (!containerEl) return;
    
    let oresContainer = containerEl.querySelector('.ores');
    if (!oresContainer) {
        oresContainer = document.createElement('div');
        oresContainer.className = 'ores';
        containerEl.appendChild(oresContainer);
    } else {
        oresContainer.innerHTML = '';
    }

    const oreTypes = ['shiny', 'glowy', 'starry'];
    oreTypes.forEach(ore => {
        oresContainer.appendChild(createOreDisplay(config, ore));
    });
}
