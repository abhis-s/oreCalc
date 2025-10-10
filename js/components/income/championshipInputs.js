import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

export function initializeChampionshipInputs() {
    const selectElement = dom.income?.championship?.supercellEvents;
    if (selectElement) {
        selectElement.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                state.income.championship.supercellEvents = e.target.value === 'true';
            });
        });
    }
}

export function renderChampionshipInputs(incomeState) {
    const selectElement = dom.income?.championship?.supercellEvents;
    if (selectElement) {
        selectElement.value = incomeState.championship.supercellEvents;
    }
}
