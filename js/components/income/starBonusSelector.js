import { dom } from '../../dom/domElements.js';
import { starBonusData } from '../../data/appData.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';

function renderStarBonusSelectorContent() {
    const selectElement = dom.income?.starBonus?.league;
    if (!selectElement) return;

    const selectedValue = selectElement.value;

    selectElement.innerHTML = '';
    starBonusData.forEach(data => {
        const option = document.createElement('option');
        option.value = data.league;
        option.textContent = translate('league.' + data.league.toLowerCase().replace(/\s/g, '_'));
        selectElement.appendChild(option);
    });

    if (Array.from(selectElement.options).some(opt => opt.value === selectedValue)) {
        selectElement.value = selectedValue;
    }
}

export function initializeStarBonusSelector() {
    const selectElement = dom.income?.starBonus?.league;
    if (!selectElement) return;

    renderStarBonusSelectorContent();

    selectElement.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.income.starBonusLeague = e.target.value;
        });
    });

    document.addEventListener('languageChanged', renderStarBonusSelectorContent);
}

export function renderStarBonusSelector(selectedLeague) {
    const selectElement = dom.income?.starBonus?.league;
    if (selectElement) {
        selectElement.value = selectedLeague;
    }
}