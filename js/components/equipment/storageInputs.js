import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { addValidation } from '../../utils/inputValidator.js';

const maxValues = {
    shiny: 50000,
    glowy: 5000,
    starry: 1000
};

function addListenerToInput(oreType) {
    const input = dom.equipment.storage.quantity[oreType];
    if (!input) return;

    addValidation(input, { inputName: `${oreType} Ore` });

    input.addEventListener('validated-input', (e) => {
        handleStateUpdate(() => {
            state.storedOres[oreType] = e.detail.value;
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
    if (inputs.shiny) inputs.shiny.value = storedOres.shiny;
    if (inputs.glowy) inputs.glowy.value = storedOres.glowy;
    if (inputs.starry) inputs.starry.value = storedOres.starry;
}