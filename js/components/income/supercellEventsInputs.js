import { state } from '../../core/state.js';

import { bindToggleInput } from '../common/formBindingUtils.js';
import { dom } from '../../dom/domElements.js';
import { renderSupercellEvents } from './supercellEventsDisplay.js';

/**
 * Initializes Supercell Events world championship toggle input binding.
 */
export function initializeSupercellEventsInputs() {
    const selectElement = dom.income?.supercellEvents?.worldChampionship;
    bindToggleInput(selectElement, {
        onUpdate: (checked) => {
            if (!state.income.supercellEvents) {
                state.income.supercellEvents = { worldChampionship: false };
            }
            state.income.supercellEvents.worldChampionship = checked;
        }
    });

    document.addEventListener('languageChanged', () => {
        renderSupercellEvents();
    });
}

/**
 * Populates Supercell Events world championship toggle checked state.
 * @param {import('../../core/types.js').IncomeSourcesState} incomeState - Global income state object.
 */
export function renderSupercellEventsInputs(incomeState) {
    const selectElement = dom.income?.supercellEvents?.worldChampionship;
    if (selectElement) {
        selectElement.checked = incomeState.supercellEvents?.worldChampionship || false;
    }
}
