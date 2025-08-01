import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { eventPassData } from '../../data/appData.js';

export function initializeEventPassInputs() {
    const passTypeSelect = dom.income?.eventPass?.passType;
    const passStoreMedalsSelect = dom.income?.eventPass?.storeMedalsClaimed;
    const equipmentBoughtSelect = dom.income?.eventPass?.equipmentBought;

    if (passTypeSelect) {
        passTypeSelect.innerHTML = '';
        for (const type in eventPassData) {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.charAt(0).toUpperCase() + type.slice(1) + ' Pass';
            passTypeSelect.appendChild(option);
        }
    }

    passTypeSelect?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.type = e.target.value;
        });
    });
    passStoreMedalsSelect?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.storeMedalsClaimed = e.target.value === 'yes';
        });
    });
    equipmentBoughtSelect?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.equipmentBought = e.target.value === 'yes';
        });
    });
}

export function renderEventPassInputs(eventPassState) {
    const passTypeSelect = dom.income?.eventPass?.passType;
    const passStoreMedalsSelect = dom.income?.eventPass?.storeMedalsClaimed;
    const equipmentBoughtSelect = dom.income?.eventPass?.equipmentBought;

    if (passTypeSelect) {
        passTypeSelect.value = eventPassState.type;
    }
    if (passStoreMedalsSelect) {
        passStoreMedalsSelect.value = eventPassState.storeMedalsClaimed ? 'yes' : 'no';
    }
    if (equipmentBoughtSelect) {
        equipmentBoughtSelect.value = eventPassState.equipmentBought ? 'yes' : 'no';
    }
}