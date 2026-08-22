import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { addValidation } from '../../utils/inputValidator.js';

import {
    closeCreateCustomChipsModal,
    prefillModalInputs,
    updatePerChipRewardsPreview
} from './createCustomChipsModalDisplay.js';
import { parseCustomChipFormData } from './customChipFormParsers.js';
import {
    initializeModalCustomDropdown,
    registerCustomChipsPopovers
} from './customChipPopoversManager.js';
import { renderIncomeChips } from './incomeChipsDisplay.js';

let isProspectorInitialized = false;

/**
 * Synchronizes Prospector UI elements and initial dropdown comboboxes.
 */
export function syncProspectorUI() {
    const fromDropdown = document.getElementById('custom-chip-prospector-from-ore');
    const toDropdown = document.getElementById('custom-chip-prospector-to-ore');

    if (!isProspectorInitialized && fromDropdown && toDropdown) {
        isProspectorInitialized = true;
        initializeModalCustomDropdown(fromDropdown, 'from');
        initializeModalCustomDropdown(toDropdown, 'to');
    }

    prefillModalInputs('prospector');
}

/**
 * Initializes all event listeners, popover registrations, and save operations for custom chip creation.
 */
export function initializeCreateCustomChipsModalListeners() {
    const modal = document.getElementById('create-custom-chips-modal');
    if (!modal) return;

    // Register all numeric inputs inside this modal for validation
    const numberInputs = modal.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
        addValidation(input, { inputName: input.id });
    });

    // Register all input popovers
    registerCustomChipsPopovers();

    const typeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-type-select'));
    const dynamicInputsContainer = document.getElementById('custom-chip-dynamic-inputs');

    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            const target = /** @type {HTMLSelectElement} */ (e.target);
            const selectedType = target.value;
            const sections = modal.querySelectorAll('.custom-chip-section');
            sections.forEach(sec => {
                /** @type {HTMLElement} */ (sec).style.display = 'none';
            });

            if (selectedType) {
                if (dynamicInputsContainer) dynamicInputsContainer.style.display = 'block';
                const activeSection = document.getElementById(`custom-chip-section-${selectedType}`);
                if (activeSection) {
                    activeSection.style.display = 'block';
                }
                if (selectedType === 'prospector') {
                    syncProspectorUI();
                } else {
                    prefillModalInputs(selectedType);
                }
            } else {
                if (dynamicInputsContainer) dynamicInputsContainer.style.display = 'none';
            }
            updatePerChipRewardsPreview();
        });
    }

    const previewTriggers = [
        'custom-chip-starBonus-multiplier',
        'custom-chip-clanWar-result',
        'custom-chip-clanWar-shiny',
        'custom-chip-clanWar-glowy',
        'custom-chip-clanWar-starry',
        'custom-chip-cwl-result',
        'custom-chip-cwl-shiny',
        'custom-chip-cwl-glowy',
        'custom-chip-cwl-starry',
        'custom-chip-prospector-from-amount',
        'custom-chip-prospector-to-amount'
    ];

    previewTriggers.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const eventType = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(eventType, updatePerChipRewardsPreview);
        }
    });

    // Auto-save form drafts to sessionStorage on any change
    modal.addEventListener('input', saveCustomChipDraft);
    modal.addEventListener('change', saveCustomChipDraft);

    const closeBtn = document.getElementById('close-create-custom-chips-modal-btn');
    const cancelBtn = document.getElementById('cancel-create-custom-chips-btn');
    const saveBtn = document.getElementById('save-create-custom-chips-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeCreateCustomChipsModal);
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            clearCustomChipDraft();
            closeCreateCustomChipsModal();
        });
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!typeSelect) return;
            const selectedType = typeSelect.value;
            if (!selectedType) return;

            const customChips = state.planner.calendar.customChips || [];
            const parseResult = await parseCustomChipFormData(selectedType, state, customChips);
            if (!parseResult) return;

            const { count, chipData } = parseResult;

            handleStateUpdate(() => {
                for (let i = 0; i < count; i++) {
                    const shortId = Math.random().toString(36).substring(2, 7);
                    const newId = `custom-${chipData.type}-${shortId}-${i}`;
                    const finalChipData = { ...chipData, instance: i + 1, id: newId };
                    customChips.push(finalChipData);
                }
                state.planner.calendar.customChips = customChips;
            });

            clearCustomChipDraft();
            closeCreateCustomChipsModal();
            if (state.planner?.calendar?.view?.month) {
                renderIncomeChips(parseInt(state.planner.calendar.view.month.split('-')[0], 10), parseInt(state.planner.calendar.view.month.split('-')[1], 10) - 1);
            }
        });
    }
}

/**
 * Saves in-progress custom chip creation inputs to sessionStorage.
 */
export function saveCustomChipDraft() {
    const modal = document.getElementById('create-custom-chips-modal');
    const typeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('custom-chip-type-select'));
    if (!modal || !typeSelect || !typeSelect.value) return;

    const draft = {
        type: typeSelect.value,
        values: {}
    };

    const inputs = modal.querySelectorAll('input, select');
    inputs.forEach(input => {
        const el = /** @type {HTMLInputElement|HTMLSelectElement} */ (input);
        if (!el.id || el.id === 'custom-chip-type-select') return;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') {
            draft.values[el.id] = el.checked;
        } else {
            draft.values[el.id] = el.value;
        }
    });

    try {
        sessionStorage.setItem('oreCalc_custom_chip_draft', JSON.stringify(draft));
    } catch (_) {}
}

/**
 * Clears custom chip draft from sessionStorage.
 */
export function clearCustomChipDraft() {
    try {
        sessionStorage.removeItem('oreCalc_custom_chip_draft');
    } catch (_) {}
}
