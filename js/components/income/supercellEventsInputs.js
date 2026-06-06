import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

export function initializeSupercellEventsInputs() {
    const selectElement = dom.income?.supercellEvents?.worldChampionship;
    if (selectElement) {
        selectElement.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                if (!state.income.supercellEvents) {
                    state.income.supercellEvents = { worldChampionship: false };
                }
                state.income.supercellEvents.worldChampionship = e.target.checked;
            });
        });
    }
}

export function renderSupercellEventsInputs(incomeState) {
    const selectElement = dom.income?.supercellEvents?.worldChampionship;
    if (selectElement) {
        selectElement.checked = incomeState.supercellEvents?.worldChampionship || false;
    }
}
