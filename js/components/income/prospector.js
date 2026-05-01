import { dom } from '../../dom/domElements.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { convertOres, getStepValue } from '../../incomeCalculations/prospectorManager.js';
import { oreMaxValues } from '../../data/oreConversionData.js';
import { addValidation } from '../../utils/inputValidator.js';

const oreTypes = {
    shiny: 'assets/shiny_ore.png',
    glowy: 'assets/glowy_ore.png',
    starry: 'assets/starry_ore.png',
};

function initializeCustomDropdown(dropdownElement, whichOre) {
    const selected = dropdownElement.querySelector('.dropdown-selected');
    const options = dropdownElement.querySelector('.dropdown-options');

    selected.addEventListener('click', () => {
        dropdownElement.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!dropdownElement.contains(e.target)) {
            dropdownElement.classList.remove('open');
        }
    });

    options.addEventListener('click', (e) => {
        const option = e.target.closest('.dropdown-option');
        if (option) {
            if (!state.income.prospector) {
                state.income.prospector = {
                    fromOre: 'shiny',
                    toOre: 'glowy',
                    fromAmount: 0,
                };
            }
            const value = option.dataset.value;
            const imgSrc = oreTypes[value];
            selected.innerHTML = `<img src="${imgSrc}" alt="${value}">`;
            dropdownElement.dataset.value = value;
            if (whichOre === 'from') {
                state.income.prospector.fromOre = value;
            } else {
                state.income.prospector.toOre = value;
            }
            updateConversion();
            dropdownElement.classList.remove('open');
        }
    });
}

function updateProspectorDropdowns() {
    const fromOreValue = dom.income.prospector.fromOre.dataset.value;
    let toOreValue = dom.income.prospector.toOre.dataset.value;

    // Auto-update "toOre" if it conflicts with the new "fromOre"
    if (fromOreValue === toOreValue) {
        const newToOre = Object.keys(oreTypes).find(ore => ore !== fromOreValue);
        if (newToOre) {
            toOreValue = newToOre;
            dom.income.prospector.toOre.dataset.value = toOreValue;
            dom.income.prospector.toOre.querySelector('.dropdown-selected').innerHTML = `<img src="${oreTypes[toOreValue]}" alt="${toOreValue}">`;
        }
    }

    // Populate "fromOre" dropdown options (exclude its own current value)
    const fromOreOptions = dom.income.prospector.fromOre.querySelector('.dropdown-options');
    fromOreOptions.innerHTML = '';
    Object.keys(oreTypes).forEach(ore => {
        if (ore !== fromOreValue) {
            const option = document.createElement('div');
            option.classList.add('dropdown-option');
            option.dataset.value = ore;
            option.innerHTML = `<img src="${oreTypes[ore]}" alt="${ore}">`;
            fromOreOptions.appendChild(option);
        }
    });

    // Populate "toOre" dropdown options (exclude fromOre value and its own current value)
    const toOreOptions = dom.income.prospector.toOre.querySelector('.dropdown-options');
    toOreOptions.innerHTML = '';
    Object.keys(oreTypes).forEach(ore => {
        if (ore !== fromOreValue && ore !== toOreValue) {
            const option = document.createElement('div');
            option.classList.add('dropdown-option');
            option.dataset.value = ore;
            option.innerHTML = `<img src="${oreTypes[ore]}" alt="${ore}">`;
            toOreOptions.appendChild(option);
        }
    });
}

function updateConversion() {
    handleStateUpdate(() => {
        if (!state.income.prospector) {
            state.income.prospector = {
                goldPass: false,
                fromOre: 'shiny',
                toOre: 'glowy',
                fromAmount: 0,
            };
        }
    
        updateProspectorDropdowns();
    
        const fromOre = dom.income.prospector.fromOre.dataset.value;
        const toOre = dom.income.prospector.toOre.dataset.value;
    
        let fromAmount = parseInt(dom.income.prospector.fromAmount.value, 10);
        if (isNaN(fromAmount)) fromAmount = 0;
    
        if ((dom.income.prospector.fromOre.dataset.previousOre && dom.income.prospector.fromOre.dataset.previousOre !== fromOre) || (dom.income.prospector.toOre.dataset.previousOre && dom.income.prospector.toOre.dataset.previousOre !== toOre)) {
            fromAmount = 0;
            dom.income.prospector.fromAmount.value = fromAmount;
        }
        dom.income.prospector.fromOre.dataset.previousOre = fromOre;
        dom.income.prospector.toOre.dataset.previousOre = toOre;
    
        const newMax = oreMaxValues[fromOre];
        dom.income.prospector.slider.max = newMax;
        dom.income.prospector.slider.step = getStepValue(fromOre, toOre);
    
        if (fromAmount > newMax) {
            fromAmount = newMax;
            dom.income.prospector.fromAmount.value = fromAmount;
        }
    
        if (fromOre === toOre) {
            dom.income.prospector.slider.disabled = true;
            dom.income.prospector.toAmount.value = fromAmount;
            dom.income.prospector.slider.value = fromAmount;
        } else {
            dom.income.prospector.slider.disabled = false;
            const convertedAmount = convertOres(fromOre, toOre, fromAmount);
            dom.income.prospector.toAmount.value = convertedAmount;
            dom.income.prospector.slider.value = fromAmount;
        }
    
        state.income.prospector.fromOre = fromOre;
        state.income.prospector.toOre = toOre;
        state.income.prospector.fromAmount = fromAmount;
    }); // Silent parameter removed to ensure UI updates
}

function updateSlider() {
    const fromAmount = parseInt(dom.income.prospector.slider.value, 10);
    dom.income.prospector.fromAmount.value = fromAmount;
    updateConversion();
}

export function initializeProspector() {
    // --- State Initialization ---
    if (!state.income.prospector) {
        state.income.prospector = {
            goldPass: false,
            fromOre: 'shiny',
            toOre: 'glowy',
            fromAmount: 0,
        };
    }

    // --- Set Initial UI Values from State ---
    const { goldPass, fromOre, toOre, fromAmount } = state.income.prospector;

    dom.income.prospector.goldPass.value = goldPass;

    dom.income.prospector.fromOre.dataset.value = fromOre;
    dom.income.prospector.fromOre.querySelector('.dropdown-selected').innerHTML = `<img src="${oreTypes[fromOre]}" alt="${fromOre}">`;

    dom.income.prospector.toOre.dataset.value = toOre;
    dom.income.prospector.toOre.querySelector('.dropdown-selected').innerHTML = `<img src="${oreTypes[toOre]}" alt="${toOre}">`;

    dom.income.prospector.fromAmount.value = fromAmount;

    // --- Add Validation ---
    addValidation(dom.income.prospector.fromAmount, { inputName: 'fromAmount' });

    // --- Initialize Dropdown Options & Event Listeners ---
    initializeCustomDropdown(dom.income.prospector.fromOre, 'from');
    initializeCustomDropdown(dom.income.prospector.toOre, 'to');

    dom.income.prospector.fromAmount.addEventListener('input', () => updateConversion());
    dom.income.prospector.fromAmount.addEventListener('change', (e) => {
        const fromOre = dom.income.prospector.fromOre.dataset.value;
        const toOre = dom.income.prospector.toOre.dataset.value;
        const step = getStepValue(fromOre, toOre);
        let value = parseInt(e.target.value, 10);
        if (!isNaN(value) && step > 1) {
            value = Math.round(value / step) * step;
            handleStateUpdate(() => {
                state.income.prospector.fromAmount = value;
                dom.income.prospector.fromAmount.value = value;
            });
            updateConversion();
        }
    });
    dom.income.prospector.slider.addEventListener('input', () => updateSlider());

    dom.income.prospector.goldPass.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.prospector.goldPass = e.target.value === 'true';
        });
    });

    updateConversion(); // Initial call to sync UI
}
