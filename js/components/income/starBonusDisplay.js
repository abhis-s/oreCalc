import { leagueTiers } from '../../data/leagueTiers.js';
import { townHallLeagueFloors } from '../../data/incomeSources/starBonus.js';
import { translate } from '../../i18n/translator.js';

import { formatDate, getMaxTownHall, getTHReleaseDate } from '../../utils/dateUtils.js';
import { updateCalculatedValue } from '../../utils/numberFormatter.js';

import { dom } from '../../dom/domElements.js';

/**
 * Renders calculated Star Bonus daily and monthly ore income values to DOM elements.
 * @param {import('../../core/types.js').IncomeResult} starBonusIncome - Calculated Star Bonus income results.
 * @param {number|string} [league] - Active league ID or tier.
 * @param {import('../../core/types.js').PlayerData|import('../../core/types.js').PlayerProfile|null} [playerData] - Active player profile data.
 * @param {string} [timeframe] - Active timeframe context.
 */
export function renderStarBonusDisplay(starBonusIncome, league, playerData, timeframe) {
    const incomeTabElements = dom.income.starBonus.display;

    if (!incomeTabElements) return;

    updateCalculatedValue(incomeTabElements.monthly?.shiny, starBonusIncome.monthly?.shiny || 0);
    updateCalculatedValue(incomeTabElements.monthly?.glowy, starBonusIncome.monthly?.glowy || 0);
    updateCalculatedValue(incomeTabElements.monthly?.starry, starBonusIncome.monthly?.starry || 0);

    updateCalculatedValue(incomeTabElements.daily?.shiny, starBonusIncome.daily?.shiny || 0);
    updateCalculatedValue(incomeTabElements.daily?.glowy, starBonusIncome.daily?.glowy || 0);
    updateCalculatedValue(incomeTabElements.daily?.starry, starBonusIncome.daily?.starry || 0);
}

/**
 * Renders the league dropdown selector options for Star Bonus based on current TH floor.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 */
export function renderStarBonusSelectorContent(state) {
    const selectElement = dom.income?.starBonus?.league;
    if (!selectElement) return;

    const selectedValue = selectElement.value;
    let townHallLevel = Number(state.playerProfile?.townHallLevel) || 1;

    if (!Object.hasOwn(townHallLeagueFloors, townHallLevel)) {
        const thKeys = Object.keys(townHallLeagueFloors).map(Number);
        const maxTh = Math.max(...thKeys);
        const minTh = Math.min(...thKeys);
        townHallLevel = Math.min(Math.max(townHallLevel, minTh), maxTh);
    }

    const floorLeagueId = townHallLeagueFloors[townHallLevel] || 0;
    const currentLang = state.uiSettings.language || 'en';
    const needsRebuild = selectElement.dataset.renderedThLevel !== String(townHallLevel) || selectElement.dataset.renderedLang !== currentLang || selectElement.options.length === 0;

    if (needsRebuild) {
        selectElement.innerHTML = '';

        // Always add Unranked
        const unrankedLeague = leagueTiers.items.find(l => l.id === 105000000);
        if (unrankedLeague) {
            const option = document.createElement('option');
            option.value = String(unrankedLeague.id);
            const translationKey = 'entities.leagues.' + unrankedLeague.name.toLowerCase()
                .replace(/\./g, '')
                .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
                .replace(/\s/g, '_');
            option.dataset.i18n = translationKey;
            option.textContent = translate(translationKey);
            selectElement.appendChild(option);
        }

        leagueTiers.items.forEach(league => {
            if (league.id !== 105000000) {
                if (floorLeagueId === 0 || league.id >= floorLeagueId) {
                    const option = document.createElement('option');
                    option.value = String(league.id);
                    const translationKey = 'entities.leagues.' + league.name.toLowerCase()
                        .replace(/\./g, '')
                        .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
                        .replace(/\s/g, '_');
                    option.dataset.i18n = translationKey;
                    option.textContent = translate(translationKey);
                    selectElement.appendChild(option);
                }
            }
        });

        selectElement.dataset.renderedThLevel = String(townHallLevel);
        selectElement.dataset.renderedLang = currentLang;

        if (selectedValue) {
            selectElement.value = selectedValue;
            if (selectElement.selectedIndex === -1) {
                selectElement.selectedIndex = 0;
            }
        }
    }
}

/**
 * Updates or renders option elements for the 2x Star Bonus last event offset dropdown.
 * @param {HTMLSelectElement} select - Select element to populate.
 * @param {number} frequency - Multiplier event frequency in months.
 * @param {number} currentYear - Current UTC year.
 * @param {number} currentMonth - Current UTC month index (0-11).
 * @param {number} savedYear - Saved event year.
 * @param {number} savedMonth - Saved event month index (0-11).
 */
export function renderLastEventOptions(select, frequency, currentYear, currentMonth, savedYear, savedMonth) {
    const row = select.closest('.input-group-flex');
    if (row) {
        row.style.display = frequency === 1 ? 'none' : 'flex';
    }

    if (frequency === 1) {
        return;
    }

    const monthYearKey = `${currentYear}-${currentMonth}`;
    const needsRebuild = select.dataset.renderedFrequency !== String(frequency) || select.dataset.renderedMonthYear !== monthYearKey || select.options.length === 0;

    if (needsRebuild) {
        select.innerHTML = '';
        const currentMonthBase = new Date();
        currentMonthBase.setUTCDate(1);

        for (let i = 0; i < frequency; i++) {
            const date = new Date(currentMonthBase);
            date.setUTCMonth(date.getUTCMonth() - i);

            const monthLabel = formatDate(date, { month: 'short', year: '2-digit' });

            const option = document.createElement('option');
            option.value = String(-i);
            option.textContent = monthLabel;
            select.appendChild(option);
        }
        select.dataset.renderedFrequency = String(frequency);
        select.dataset.renderedMonthYear = monthYearKey;
    }

    const currentOffset = -( (currentYear - savedYear) * 12 + (currentMonth - savedMonth) );
    select.value = String(currentOffset);
}

/**
 * Renders Town Hall planning upgrade selector inputs.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 * @param {Function} [onTHUpgradeChange] - Callback invoked when a TH upgrade month changes.
 */
export function renderTHPlanningSection(state, onTHUpgradeChange) {
    const container = dom.income?.starBonus?.thPlanningSection;
    if (!container) return;

    const outerBox = dom.income?.starBonus?.multiplierModal?.querySelector('#star-bonus-4x-section');
    const separator = dom.income?.starBonus?.multiplierModal?.querySelector('.separator');

    let currentTH = 1;
    if (state.playerProfile && state.playerProfile.townHallLevel) {
        currentTH = Number(state.playerProfile.townHallLevel) || 1;
    } else {
        const activeTag = state.savedPlayerTags?.[0];
        const activePlayer = state.allPlayersData?.[activeTag];
        if (activePlayer && activePlayer.playerProfile && activePlayer.playerProfile.townHallLevel) {
            currentTH = Number(activePlayer.playerProfile.townHallLevel) || 1;
        }
    }

    const maxTH = getMaxTownHall();
    const planningFloor = maxTH - 8;
    const thLimit = (currentTH >= maxTH - 1) ? maxTH + 2 : maxTH + 1;

    if (outerBox) outerBox.style.display = 'block';
    if (separator) separator.style.display = 'block';
    container.innerHTML = '';

    const planningTitle = document.createElement('h4');
    planningTitle.className = 'push-top-5 margin-bottom-20';
    planningTitle.dataset.i18n = 'views.income.starBonus.thPlanningTitle';
    planningTitle.textContent = translate('views.income.starBonus.thPlanningTitle');
    container.appendChild(planningTitle);

    if (currentTH < planningFloor - 1) {
        const infoMsg = document.createElement('p');
        infoMsg.className = 'form-setting-text';
        infoMsg.dataset.i18n = 'views.income.starBonus.planningStartInfo';
        infoMsg.dataset.i18nArgs = JSON.stringify({ th: planningFloor });
        infoMsg.textContent = translate('views.income.starBonus.planningStartInfo', { th: planningFloor });
        container.appendChild(infoMsg);
    }

    const planningData = state.income.starBonus?.thUpgrades || {};
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    let previousMonthsOffset = 0;
    const startTH = Math.max(currentTH + 1, planningFloor);

    for (let th = startTH; th <= thLimit; th++) {
        const row = document.createElement('div');
        row.className = 'input-group-flex push-top-5';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'field-descriptor-group';
        const label = document.createElement('label');
        label.htmlFor = `th-upgrade-month-${th}`;

        if (th > maxTH) {
            const releaseYear = getTHReleaseDate(th);
            label.dataset.i18n = 'views.income.starBonus.unreleasedTH';
            label.dataset.i18nArgs = JSON.stringify({ th, year: releaseYear });
            label.textContent = translate('views.income.starBonus.unreleasedTH', { th, year: releaseYear });
        } else {
            label.dataset.i18n = 'views.income.starBonus.upgradeToTH';
            label.dataset.i18nArgs = JSON.stringify({ th });
            label.textContent = translate('views.income.starBonus.upgradeToTH', { th });
        }
        labelDiv.appendChild(label);
        row.appendChild(labelDiv);

        const select = document.createElement('select');
        select.id = `th-upgrade-month-${th}`;
        select.name = `th-upgrade-month-${th}`;
        select.className = 'dropdown-style updatable';
        select.innerHTML = `<option value="0">---</option>`;

        const currentMonthBase = new Date(Date.UTC(currentYear, currentMonth, 1));
        let startOffset = previousMonthsOffset + 1;
        let endOffset;

        if (th <= maxTH) {
            const rangeSize = th - (maxTH - 9);
            endOffset = startOffset + Math.max(0, rangeSize - 1);
        } else {
            const releaseYear = getTHReleaseDate(th);
            const totalMonthsToRelease = ((releaseYear - currentYear) * 12) + (10 - currentMonth) + 1;
            if (totalMonthsToRelease > startOffset) startOffset = totalMonthsToRelease;
            endOffset = previousMonthsOffset + 12;
        }

        if (startOffset <= endOffset) {
            for (let i = startOffset; i <= endOffset; i++) {
                const date = new Date(currentMonthBase);
                date.setUTCMonth(date.getUTCMonth() + (i - 1));
                const monthLabel = formatDate(date, { month: 'short', year: '2-digit' });
                const option = document.createElement('option');
                option.value = String(i);
                option.textContent = monthLabel;
                select.appendChild(option);
            }
        }

        const savedPlan = planningData[th];
        if (savedPlan) {
            const [year, month] = savedPlan.split('-').map(Number);
            const savedOffset = (year - currentYear) * 12 + (month - 1 - currentMonth) + 1;
            select.value = String((savedOffset >= startOffset && savedOffset <= endOffset) ? savedOffset : 0);
        } else {
            select.value = '0';
        }

        if (typeof onTHUpgradeChange === 'function') {
            select.addEventListener('change', (e) => {
                onTHUpgradeChange(th, parseInt(/** @type {HTMLSelectElement} */ (e.target).value, 10), currentMonthBase, thLimit);
            });
        }

        row.appendChild(select);
        container.appendChild(row);

        if (select.value === "0") {
            break;
        } else {
            previousMonthsOffset = parseInt(select.value, 10);
        }
    }
}
