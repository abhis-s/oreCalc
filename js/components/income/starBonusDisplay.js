import { translate } from '../../i18n/translator.js';

import { getMaxTownHall, getTHReleaseDate } from '../../domain/townHall/townHallSchedule.js';
import { formatDate } from '../../utils/dateUtils.js';
import { updateCalculatedValue } from '../../utils/numberFormatter.js';

import { dom } from '../../dom/domElements.js';

/**
 * Renders calculated Star Bonus daily and monthly ore income values to DOM elements.
 * @param {import('../../core/types.js').IncomeResult} starBonusIncome - Calculated Star Bonus income results.
 * @param {number|string} [league=0] - Deprecated league parameter.
 * @param {import('../../core/types.js').PlayerData|import('../../core/types.js').PlayerProfile|null} [playerData=null] - Active player profile data.
 * @param {string} [timeframe=''] - Active timeframe context.
 */
export function renderStarBonusDisplay(starBonusIncome, league = 0, playerData = null, timeframe = '') {
    const incomeTabElements = dom.income.starBonus.display;

    if (!incomeTabElements) return;

    updateCalculatedValue(incomeTabElements.monthly?.shiny, starBonusIncome.monthly?.shiny || 0);
    updateCalculatedValue(incomeTabElements.monthly?.glowy, starBonusIncome.monthly?.glowy || 0);
    updateCalculatedValue(incomeTabElements.monthly?.starry, starBonusIncome.monthly?.starry || 0);

    updateCalculatedValue(incomeTabElements.daily?.shiny, starBonusIncome.daily?.shiny || 0);
    updateCalculatedValue(incomeTabElements.daily?.glowy, starBonusIncome.daily?.glowy || 0);
    updateCalculatedValue(incomeTabElements.daily?.starry, starBonusIncome.daily?.starry || 0);

    const thIcon = dom.income.starBonus.thIcon || document.getElementById('inc-star-bonus-th-icon');
    if (thIcon) {
        const rawTH = (/** @type {any} */ (playerData))?.townHallLevel || (/** @type {any} */ (playerData))?.playerProfile?.townHallLevel;
        const thLevel = Math.max(1, Number(rawTH) || 18);
        const iconSrc = `assets/th/th${Math.min(thLevel, 18)}.png`;
        if (thIcon.getAttribute('src') !== iconSrc) {
            thIcon.setAttribute('src', iconSrc);
        }
        const thText = translate('views.equipment.thShort', { level: thLevel });
        if (thIcon.getAttribute('alt') !== thText) {
            thIcon.setAttribute('alt', thText);
        }
        thIcon.setAttribute('data-i18n-alt', 'views.equipment.thShort');
        thIcon.setAttribute('data-i18n-alt-args', JSON.stringify({ level: thLevel }));
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
 * @param {string} [locale] - UI language locale.
 */
export function renderLastEventOptions(select, frequency, currentYear, currentMonth, savedYear, savedMonth, locale = undefined) {
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

            const monthLabel = formatDate(date, { month: 'short', year: '2-digit' }, locale);

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
 */
export function renderTHPlanningSection(state) {
    const container = dom.income?.starBonus?.thPlanningSection;
    if (!container) return;

    const outerBox = dom.income?.starBonus?.multiplierModal?.querySelector('#star-bonus-4x-section');
    const separator = dom.income?.starBonus?.multiplierModal?.querySelector('.separator');

    let currentTH = 18;
    if (state.playerProfile && state.playerProfile.townHallLevel) {
        currentTH = Number(state.playerProfile.townHallLevel) || 18;
    } else {
        const activeTag = state.savedPlayerTags?.[0];
        const activePlayer = state.allPlayersData?.[activeTag];
        if (activePlayer && activePlayer.playerProfile && activePlayer.playerProfile.townHallLevel) {
            currentTH = Number(activePlayer.playerProfile.townHallLevel) || 18;
        }
    }

    const maxTH = getMaxTownHall();
    const planningFloor = maxTH - 8;
    const thLimit = (currentTH >= maxTH - 1) ? maxTH + 2 : maxTH + 1;

    if (outerBox) outerBox.style.display = 'block';
    if (separator) separator.style.display = 'block';
    container.innerHTML = '';

    const planningTitle = document.createElement('h4');
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
    const currentLang = state.uiSettings?.language || 'en';
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    let previousMonthsOffset = 0;
    const startTH = Math.max(currentTH + 1, planningFloor);

    for (let th = startTH; th <= thLimit; th++) {
        const row = document.createElement('div');
        row.className = 'input-group-flex';

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
        select.dataset.th = String(th);
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
                const monthLabel = formatDate(date, { month: 'short', year: '2-digit' }, currentLang);
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

        row.appendChild(select);
        container.appendChild(row);

        if (select.value === "0") {
            break;
        } else {
            previousMonthsOffset = parseInt(select.value, 10);
        }
    }
}
