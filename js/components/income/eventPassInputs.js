import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import {eventPassData, eventStoreMedalsData} from '../../data/appData.js';

export function initializeEventPassInputs() {
    const passTypeSelect = dom.income?.eventPass?.passType;
    const passStoreMedalsSelect = dom.income?.medalsClaimed?.medalsClaimed;
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

    if (passStoreMedalsSelect) {
        passStoreMedalsSelect.innerHTML = '';
        for (const storeMedals in eventStoreMedalsData) {
            const option = document.createElement('option');
            option.value = storeMedals;
            option.textContent = storeMedals;
            passStoreMedalsSelect.appendChild(option);
        }
    }

    passTypeSelect?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.type = e.target.value;
            
        });
    });
    passStoreMedalsSelect?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.medalsClaimed = e.target.value;
        })
    });
    equipmentBoughtSelect?.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.eventPass.equipmentBought = e.target.value === 'yes';
        });
    });
}

export function renderEventPassInputs(eventPassState) {
    const passTypeSelect = dom.income?.eventPass?.passType;
    const passStoreMedalsSelect = dom.income?.eventPass?.medalsClaimed;
    const equipmentBoughtSelect = dom.income?.eventPass?.equipmentBought;

    if (passTypeSelect) {
        passTypeSelect.value = eventPassState.type;
    }
    if (passStoreMedalsSelect) {
        equipmentBoughtSelect.value = eventPassState.equipmentBought;
    }
    if (equipmentBoughtSelect) {
        equipmentBoughtSelect.value = eventPassState.equipmentBought ? 'yes' : 'no';
    }
}