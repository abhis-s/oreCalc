import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';
import { leagues } from '../../data/appData.js';

function renderStarBonusSelectorContent() {
    const selectElement = dom.income?.starBonus?.league;
    if (!selectElement) return;

    const selectedValue = selectElement.value;

    selectElement.innerHTML = '';
    leagues.items.forEach(league => {
        const option = document.createElement('option');
        option.value = league.id;
        const translationKey = 'league.' + league.name.toLowerCase().replace(/\s/g, '_');
        option.textContent = translate(translationKey);
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
            state.income.starBonusLeague = parseInt(e.target.value, 10);
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