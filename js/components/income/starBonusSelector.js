import { dom } from '../../dom/domElements.js';
import { starBonusData } from '../../data/appData.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

export function initializeStarBonusSelector() {
    const selectElement = dom.income?.starBonus?.league;
    if (!selectElement) return;

    selectElement.innerHTML = '';
    starBonusData.forEach(data => {
        const option = document.createElement('option');
        option.value = data.league;
        option.textContent = data.league;
        selectElement.appendChild(option);
    });

    selectElement.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.starBonusLeague = e.target.value;
        });
    });
}

export function renderStarBonusSelector(selectedLeague) {
    const selectElement = dom.income?.starBonus?.league;
    if (selectElement) {
        selectElement.value = selectedLeague;
    }
}