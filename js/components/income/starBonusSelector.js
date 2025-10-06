import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';
import { leagueTiers, townHallLeagueFloors } from '../../data/appData.js';

function renderStarBonusSelectorContent() {
    const selectElement = dom.income?.starBonus?.league;
    if (!selectElement) return;

    const selectedValue = selectElement.value;
    let townHallLevel = state.playerData?.townHallLevel || 1;

    if (!townHallLeagueFloors[townHallLevel]) {
        const maxTh = Math.max(...Object.keys(townHallLeagueFloors).map(Number));
        if (townHallLevel > maxTh) {
            townHallLevel = maxTh;
        }
    }

    const floorLeagueId = townHallLeagueFloors[townHallLevel];

    selectElement.innerHTML = '';

    // Always add Unranked
    const unrankedLeague = leagueTiers.items.find(l => l.id === 105000000);
    if (unrankedLeague) {
        const option = document.createElement('option');
        option.value = unrankedLeague.id;
        const translationKey = 'league.' + unrankedLeague.name.toLowerCase().replace(/\./g, '').replace(/\s/g, '_');
        option.textContent = translate(translationKey);
        selectElement.appendChild(option);
    }

    leagueTiers.items.forEach(league => {
        if (league.id !== 105000000) { // Exclude unranked as it's already added
            if (floorLeagueId === 0 || league.id >= floorLeagueId) {
                const option = document.createElement('option');
                option.value = league.id;
                const translationKey = 'league.' + league.name.toLowerCase().replace(/\./g, '').replace(/\s/g, '_');
                option.textContent = translate(translationKey);
                selectElement.appendChild(option);
            }
        }
    });

    if (Array.from(selectElement.options).some(opt => opt.value === selectedValue)) {
        selectElement.value = selectedValue;
    } else {
        selectElement.value = 105000000;
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