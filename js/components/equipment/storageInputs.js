import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { addValidation } from '../../utils/inputValidator.js';
import { translate } from '../../i18n/translator.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';

const maxValues = {
    shiny: 50000,
    glowy: 5000,
    starry: 1000
};

function addListenerToInput(oreType) {
    const input = dom.equipment.storage.quantity[oreType];
    if (!input) return;

    addValidation(input, { inputName: `${oreType} Ore` });
    
    registerInputPopover(input, {
        title: translate(`ores.${oreType}`),
        min: 0,
        max: maxValues[oreType],
        placement: 'prefer-below',
        clickToFill: {
            max: true
        }
    });

    input.addEventListener('validated-input', (e) => {
        handleStateUpdate(() => {
            state.storedOres[oreType] = e.detail.value;
            state.storedOres.lastUpdated = Date.now();
        });
    });
}

export function initializeStorageInputs() {
    addListenerToInput('shiny');
    addListenerToInput('glowy');
    addListenerToInput('starry');
}

export function renderStorageInputs(storedOres) {
    const inputs = dom.equipment.storage.quantity;
    if (inputs.shiny) inputs.shiny.value = storedOres.shiny || 0;
    if (inputs.glowy) inputs.glowy.value = storedOres.glowy || 0;
    if (inputs.starry) inputs.starry.value = storedOres.starry || 0;
}