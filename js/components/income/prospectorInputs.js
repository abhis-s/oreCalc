import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { oreMaxValues } from '../../data/oreConversionData.js';
import { dom } from '../../dom/domElements.js';

import { convertOres, getStepValue } from '../../incomeCalculations/prospectorManager.js';
import { addValidation } from '../../utils/inputValidator.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';

import { translate } from '../../i18n/translator.js';

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
                state.income.prospector = {};
            }
            const value = option.dataset.value;
            const imgSrc = oreTypes[value];
            selected.innerHTML = `<orecalc-assets-image src="${imgSrc}" alt="${translate('ores.' + value)}" size="thumbnail"></orecalc-assets-image>`;
            dropdownElement.dataset.value = value;
            if (whichOre === 'from') {
                state.income.prospector.fromOre = value;
            } else {
                state.income.prospector.toOre = value;
            }

            if (Object.keys(state.income.prospector).length === 0) {
                delete state.income.prospector;
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
            dom.income.prospector.toOre.querySelector('.dropdown-selected').innerHTML = `<orecalc-assets-image src="${oreTypes[toOreValue]}" alt="${toOreValue}" size="thumbnail"></orecalc-assets-image>`;
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
            option.innerHTML = `<orecalc-assets-image src="${oreTypes[ore]}" alt="${translate('ores.' + ore)}" size="thumbnail"></orecalc-assets-image>`;
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
            option.innerHTML = `<orecalc-assets-image src="${oreTypes[ore]}" alt="${translate('ores.' + ore)}" size="thumbnail"></orecalc-assets-image>`;
            toOreOptions.appendChild(option);
        }
    });
}

function updateConversionUI() {
    updateProspectorDropdowns();

    const fromOre = dom.income.prospector.fromOre.dataset.value;
    const toOre = dom.income.prospector.toOre.dataset.value;

    let fromAmount = parseInt(dom.income.prospector.fromAmount.value, 10);
    if (isNaN(fromAmount)) fromAmount = 0;

    const newMax = oreMaxValues[fromOre];
    dom.income.prospector.fromAmount.max = newMax;
    dom.income.prospector.slider.max = newMax;
    const currentStep = getStepValue(fromOre, toOre);
    dom.income.prospector.slider.step = currentStep;
    dom.income.prospector.fromAmount.step = currentStep;

    if (fromAmount > newMax) {
        fromAmount = newMax;
        dom.income.prospector.fromAmount.value = fromAmount;
    }
    
    // Ensure the validation dataset is kept in sync when we programmatically change the value
    dom.income.prospector.fromAmount.dataset.lastValidValue = fromAmount;

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
}

export function updateConversion(isSilent = false) {
    if (isSilent) {
        updateConversionUI();
        const fromOre = dom.income.prospector.fromOre.dataset.value;
        const toOre = dom.income.prospector.toOre.dataset.value;
        const fromAmount = parseInt(dom.income.prospector.fromAmount.value, 10) || 0;

        dom.income.prospector.fromOre.dataset.previousOre = fromOre;
        dom.income.prospector.toOre.dataset.previousOre = toOre;

        if (state.income.prospector) {
            state.income.prospector.fromOre = fromOre;
            state.income.prospector.toOre = toOre;
            state.income.prospector.fromAmount = fromAmount;
        }
        return;
    }

    handleStateUpdate(() => {
        if (!state.income.prospector) {
            state.income.prospector = {};
        }
    
        updateConversionUI();
    
        const fromOre = dom.income.prospector.fromOre.dataset.value;
        const toOre = dom.income.prospector.toOre.dataset.value;
        let fromAmount = parseInt(dom.income.prospector.fromAmount.value, 10) || 0;

        if ((dom.income.prospector.fromOre.dataset.previousOre && dom.income.prospector.fromOre.dataset.previousOre !== fromOre) || (dom.income.prospector.toOre.dataset.previousOre && dom.income.prospector.toOre.dataset.previousOre !== toOre)) {
            fromAmount = 0;
            dom.income.prospector.fromAmount.value = fromAmount;
            updateConversionUI();
        }
        dom.income.prospector.fromOre.dataset.previousOre = fromOre;
        dom.income.prospector.toOre.dataset.previousOre = toOre;
    
        state.income.prospector.fromOre = fromOre;
        state.income.prospector.toOre = toOre;

        if (fromAmount === 0) delete state.income.prospector.fromAmount;
        else state.income.prospector.fromAmount = fromAmount;

        if (Object.keys(state.income.prospector).length === 0) {
            delete state.income.prospector;
        }
    });
}

function updateSlider() {
    const fromAmount = parseInt(dom.income.prospector.slider.value, 10);
    dom.income.prospector.fromAmount.value = fromAmount;
    updateConversion();
}

export function renderProspector(prospectorState) {
    if (!prospectorState) return;

    const goldPass = prospectorState.goldPass || false;
    const fromOre = prospectorState.fromOre || 'shiny';
    const toOre = prospectorState.toOre || 'glowy';
    const fromAmount = prospectorState.fromAmount || 0;

    if (dom.income.prospector.goldPass) {
        dom.income.prospector.goldPass.checked = goldPass;
    }

    if (dom.income.prospector.fromOre) {
        dom.income.prospector.fromOre.dataset.value = fromOre;
        const selected = dom.income.prospector.fromOre.querySelector('.dropdown-selected');
        if (selected) {
            selected.innerHTML = `<orecalc-assets-image src="${oreTypes[fromOre]}" alt="${translate('ores.' + fromOre)}" size="thumbnail"></orecalc-assets-image>`;
        }
    }

    if (dom.income.prospector.toOre) {
        dom.income.prospector.toOre.dataset.value = toOre;
        const selected = dom.income.prospector.toOre.querySelector('.dropdown-selected');
        if (selected) {
            selected.innerHTML = `<orecalc-assets-image src="${oreTypes[toOre]}" alt="${translate('ores.' + toOre)}" size="thumbnail"></orecalc-assets-image>`;
        }
    }

    if (dom.income.prospector.fromAmount) {
        dom.income.prospector.fromAmount.value = fromAmount;
    }

    updateConversion(true);
}

export function initializeProspector() {
    // --- Set Initial UI Values from State ---
    renderProspector(state.income.prospector);

    // --- Add Validation ---
    addValidation(dom.income.prospector.fromAmount, { inputName: translate('validation.amount') });
    registerInputPopover(dom.income.prospector.fromAmount, {
        title: translate('income.prospector.fromOre') || 'From Ore',
        min: 0,
        max: () => {
            const fromOre = dom.income.prospector.fromOre?.dataset.value || 'shiny';
            return oreMaxValues[fromOre] || 2000;
        },
        // TODO: Implement recommended value logic (see task 6gjJmWmg6V6Crr24)
        showRecommended: false,
        clickToFill: {
            min: true,
            max: true
        }
    });

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
                if (!state.income.prospector) state.income.prospector = { fromOre: 'shiny', toOre: 'glowy' };
                state.income.prospector.fromAmount = value;
                dom.income.prospector.fromAmount.value = value;
            });
            updateConversion();
        }
    });
    dom.income.prospector.slider.addEventListener('input', () => updateSlider());

    dom.income.prospector.goldPass.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            if (!state.income.prospector) state.income.prospector = { fromOre: 'shiny', toOre: 'glowy' };
            state.income.prospector.goldPass = e.target.checked;
        });
    });

    updateConversion(true); // Initial call to sync UI
}
