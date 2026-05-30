import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { leagueTiers, townHallLeagueFloors } from '../../data/appData.js';
import { dom } from '../../dom/domElements.js';
import { formatDate } from '../../utils/dateFormatter.js';
import { getMaxTownHall, getTHReleaseDate } from '../../utils/dateUtils.js';
import { addValidation } from '../../utils/inputValidator.js';
import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { translate } from '../../i18n/translator.js';

function renderLastEventOptions() {
    const select = dom.income?.starBonus?.lastEventSelect;
    if (!select) return;

    const frequency = parseInt(dom.income?.starBonus?.frequencyInput?.value || 2, 10);
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    let savedMonth = state.income.starBonus?.lastEventMonth;
    let savedYear = state.income.starBonus?.lastEventYear;

    // Initialize if missing
    if (savedMonth === undefined || savedYear === undefined) {
        savedMonth = currentMonth;
        savedYear = currentYear;
        handleStateUpdate(() => {
            if (!state.income.starBonus) state.income.starBonus = {};
            state.income.starBonus.lastEventMonth = currentMonth;
            state.income.starBonus.lastEventYear = currentYear;
        }, { skipRender: true });
    }

    // Check expiration: if diff >= frequency, roll to current month
    const monthDiff = (currentYear - savedYear) * 12 + (currentMonth - savedMonth);
    if (monthDiff >= frequency || monthDiff < 0) {
        savedMonth = currentMonth;
        savedYear = currentYear;
        handleStateUpdate(() => {
            if (!state.income.starBonus) state.income.starBonus = {};
            state.income.starBonus.lastEventMonth = currentMonth;
            state.income.starBonus.lastEventYear = currentYear;
        }, { skipRender: true });
    }

    const row = select.closest('.input-group-flex');
    if (row) {
        row.style.display = frequency === 1 ? 'none' : 'flex';
    }

    if (frequency === 1) {
        return;
    }

    select.innerHTML = '';
    const currentMonthBase = new Date();
    currentMonthBase.setUTCDate(1);

    for (let i = 0; i < frequency; i++) {
        const date = new Date(currentMonthBase);
        date.setUTCMonth(date.getUTCMonth() - i);
        
        const monthLabel = formatDate(date, { month: 'short', year: '2-digit' });
        
        const option = document.createElement('option');
        option.value = -i; // Negative offset
        option.textContent = monthLabel;
        select.appendChild(option);
    }

    // The current saved offset relative to now
    const currentOffset = -( (currentYear - savedYear) * 12 + (currentMonth - savedMonth) );
    select.value = currentOffset;

    // Final safety check
    if (select.value === "") {
        select.value = 0;
        handleStateUpdate(() => {
            if (!state.income.starBonus) state.income.starBonus = {};
            state.income.starBonus.lastEventMonth = currentMonth;
            state.income.starBonus.lastEventYear = currentYear;
        }, { skipRender: true });
    }
}

function renderTHPlanningSection() {
    const container = dom.income?.starBonus?.thPlanningSection;
    if (!container) return;

    const outerBox = dom.income?.starBonus?.multiplierModal?.querySelector('#star-bonus-4x-section');
    const separator = dom.income?.starBonus?.multiplierModal?.querySelector('.danger-zone-separator');

    // Get current TH level
    let currentTH = 1;
    if (state.playerProfile && state.playerProfile.townHallLevel) {
        currentTH = parseInt(state.playerProfile.townHallLevel, 10);
    } else {
        const activeTag = state.savedPlayerTags[0];
        const activePlayer = state.allPlayersData[activeTag];
        if (activePlayer && activePlayer.playerProfile && activePlayer.playerProfile.townHallLevel) {
            currentTH = parseInt(activePlayer.playerProfile.townHallLevel, 10);
        }
    }

    const maxTH = getMaxTownHall();
    const planningFloor = maxTH - 8; // currently TH 10
    const thLimit = (currentTH >= maxTH - 1) ? maxTH + 2 : maxTH + 1;

    // Always show the section if we have a container, but content changes
    if (outerBox) outerBox.style.display = 'block';
    if (separator) separator.style.display = 'block';
    container.innerHTML = '';

    const planningTitle = document.createElement('h4');
    planningTitle.className = 'push-top-5 margin-bottom-20';
    planningTitle.dataset.i18n = 'income.starBonus.thPlanningTitle';
    planningTitle.textContent = translate('income.starBonus.thPlanningTitle');
    container.appendChild(planningTitle);

    // If player is too low, show info message about the floor
    if (currentTH < planningFloor - 1) {
        const infoMsg = document.createElement('p');
        infoMsg.className = 'form-setting-text';
        infoMsg.dataset.i18n = 'income.starBonus.planningStartInfo';
        infoMsg.dataset.i18nArgs = JSON.stringify({ th: planningFloor });
        infoMsg.textContent = translate('income.starBonus.planningStartInfo', { th: planningFloor });
        container.appendChild(infoMsg);
    }

    const planningData = state.income.starBonus?.thUpgrades || {};
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    // Roll/Expire logic: remove upgrades that are in the past
    let stateChanged = false;
    for (const th in planningData) {
        const plan = planningData[th];
        if (plan) {
            const diff = (plan.year - currentYear) * 12 + (plan.month - currentMonth);
            if (diff < 0) {
                delete planningData[th];
                stateChanged = true;
            }
        }
    }
    if (stateChanged) {
        handleStateUpdate(() => {}, { skipRender: true });
    }

    let previousMonthsOffset = 0;
    const startTH = Math.max(currentTH + 1, planningFloor);

    for (let th = startTH; th <= thLimit; th++) {
        const row = document.createElement('div');
        row.className = 'input-group-flex push-top-5';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'field-descriptor-group';
        const label = document.createElement('label');

        if (th > maxTH) {
            const releaseYear = getTHReleaseDate(th);
            label.dataset.i18n = 'income.starBonus.unreleasedTH';
            label.dataset.i18nArgs = JSON.stringify({ th: th, year: releaseYear });
            label.textContent = translate('income.starBonus.unreleasedTH', { th: th, year: releaseYear });
        } else {
            label.dataset.i18n = 'income.starBonus.upgradeToTH';
            label.dataset.i18nArgs = JSON.stringify({ th: th });
            label.textContent = translate('income.starBonus.upgradeToTH', { th: th });
        }
        labelDiv.appendChild(label);
        row.appendChild(labelDiv);
        
        const select = document.createElement('select');
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
                option.value = i;
                option.textContent = monthLabel;
                select.appendChild(option);
            }
        }
        
        const savedPlan = planningData[th];
        if (savedPlan) {
            const savedOffset = (savedPlan.year - currentYear) * 12 + (savedPlan.month - currentMonth) + 1;
            select.value = (savedOffset >= startOffset && savedOffset <= endOffset) ? savedOffset : 0;
        } else {
            select.value = 0;
        }
        
        select.addEventListener('change', (e) => {
            const offset = parseInt(e.target.value, 10);
            handleStateUpdate(() => {
                if (!state.income.starBonus.thUpgrades) state.income.starBonus.thUpgrades = {};
                if (offset === 0) {
                    delete state.income.starBonus.thUpgrades[th];
                    for (let subsequent = th + 1; subsequent <= thLimit; subsequent++) {
                        delete state.income.starBonus.thUpgrades[subsequent];
                    }
                } else {
                    const targetDate = new Date(currentMonthBase);
                    targetDate.setUTCMonth(targetDate.getUTCMonth() + (offset - 1));
                    state.income.starBonus.thUpgrades[th] = {
                        month: targetDate.getUTCMonth(),
                        year: targetDate.getUTCFullYear()
                    };
                    
                    let currentLimitOffset = offset;
                    for (let subsequent = th + 1; subsequent <= thLimit; subsequent++) {
                        const subPlan = state.income.starBonus.thUpgrades[subsequent];
                        if (subPlan) {
                            const subOffset = (subPlan.year - currentYear) * 12 + (subPlan.month - currentMonth) + 1;
                            if (subOffset <= currentLimitOffset) {
                                const nextDate = new Date(currentMonthBase);
                                nextDate.setUTCMonth(nextDate.getUTCMonth() + currentLimitOffset);
                                state.income.starBonus.thUpgrades[subsequent] = {
                                    month: nextDate.getUTCMonth(),
                                    year: nextDate.getUTCFullYear()
                                };
                                currentLimitOffset++;
                            } else {
                                currentLimitOffset = subOffset;
                            }
                        }
                    }
                }
            });
            renderTHPlanningSection();
        });
        
        row.appendChild(select);
        container.appendChild(row);
        
        if (select.value === "0") {
            break;
        } else {
            previousMonthsOffset = parseInt(select.value, 10);
        }
    }
}

function renderStarBonusSelectorContent() {
    const selectElement = dom.income?.starBonus?.league;
    if (!selectElement) return;

    const selectedValue = selectElement.value;
    let townHallLevel = parseInt(state.playerProfile?.townHallLevel || 1, 10);

    if (isNaN(townHallLevel) || !townHallLeagueFloors.hasOwnProperty(townHallLevel)) {
        const thKeys = Object.keys(townHallLeagueFloors).map(Number);
        const maxTh = Math.max(...thKeys);
        const minTh = Math.min(...thKeys);
        
        if (townHallLevel > maxTh) {
            townHallLevel = maxTh;
        } else if (townHallLevel < minTh) {
            townHallLevel = minTh;
        }
    }

    const floorLeagueId = townHallLeagueFloors[townHallLevel] || 0;

    selectElement.innerHTML = '';

    // Always add Unranked
    const unrankedLeague = leagueTiers.items.find(l => l.id === 105000000);
    if (unrankedLeague) {
        const option = document.createElement('option');
        option.value = unrankedLeague.id;
        const translationKey = 'leagues.' + unrankedLeague.name.toLowerCase()
            .replace(/\./g, '')
            .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
            .replace(/\s/g, '_');
        option.textContent = translate(translationKey);
        selectElement.appendChild(option);
    }

    leagueTiers.items.forEach(league => {
        if (league.id !== 105000000) { // Exclude unranked as it's already added
            if (floorLeagueId === 0 || league.id >= floorLeagueId) {
                const option = document.createElement('option');
                option.value = league.id;
                const translationKey = 'leagues.' + league.name.toLowerCase()
                    .replace(/\./g, '')
                    .replace(/\s(i+)$/i, (match, p1) => p1.toUpperCase())
                    .replace(/\s/g, '_');
                option.textContent = translate(translationKey);
                selectElement.appendChild(option);
            }
        }
    });

    if (selectedValue && Array.from(selectElement.options).some(opt => opt.value === selectedValue)) {
        selectElement.value = selectedValue;
    } else {
        if (!selectElement.value && selectElement.options.length > 0) {
            selectElement.value = 105000000;
        }
    }
}

export function initializeStarBonusSelector() {
    const selectElement = dom.income?.starBonus?.league;
    const frequencyInput = dom.income?.starBonus?.frequencyInput;
    const durationInput = dom.income?.starBonus?.durationInput;
    const lastEventSelect = dom.income?.starBonus?.lastEventSelect;
    const openMultiplierBtn = dom.income?.starBonus?.openMultiplierBtn;
    const multiplierModal = dom.income?.starBonus?.multiplierModal;
    const closeMultiplierHeaderBtn = dom.income?.starBonus?.closeMultiplierHeaderBtn;
    const closeMultiplierFooterBtn = dom.income?.starBonus?.closeMultiplierFooterBtn;

    if (selectElement) {
        selectElement.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                if (!state.income.starBonus) state.income.starBonus = {};
                state.income.starBonus.league = parseInt(e.target.value, 10);
            });
        });
    }

    if (openMultiplierBtn && multiplierModal) {
        openMultiplierBtn.addEventListener('click', () => {
            multiplierModal.classList.add('show');
            if (dom.overlay) dom.overlay.classList.add('show');
        });
    }

    const closeMultiplierModal = () => {
        if (multiplierModal) multiplierModal.classList.remove('show');
        if (dom.overlay) dom.overlay.classList.remove('show');
    };

    if (closeMultiplierHeaderBtn) closeMultiplierHeaderBtn.addEventListener('click', closeMultiplierModal);
    if (closeMultiplierFooterBtn) closeMultiplierFooterBtn.addEventListener('click', closeMultiplierModal);

    if (frequencyInput) {
        addValidation(frequencyInput, { inputName: translate('income.starBonus.eventFrequency') });
        registerInputPopover(frequencyInput, {
            title: translate('income.starBonus.eventFrequency'),
            min: 1,
            max: 4,
            showRange: true,
            showRecommended: true,
            recommended: 2,
            clickToFill: {
                recommended: true
            }
        });
        frequencyInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value)) value = 2;
            value = Math.max(1, Math.min(4, value));
            e.target.value = value;
            
            handleStateUpdate(() => {
                if (!state.income.starBonus) state.income.starBonus = {};
                state.income.starBonus.eventFrequency = value;
            });
            renderLastEventOptions();
        });
    }

    if (durationInput) {
        addValidation(durationInput, { inputName: translate('income.starBonus.eventDuration') });
        registerInputPopover(durationInput, {
            title: translate('income.starBonus.eventDuration'),
            min: 0,
            max: 7,
            showMin: true,
            showMax: false,
            showRecommended: true,
            recommended: 5,
            clickToFill: {
                min: true,
                recommended: true
            }
        });
        durationInput.addEventListener('change', (e) => {
            let value = parseInt(e.target.value, 10);
            if (isNaN(value)) value = 5;
            value = Math.max(0, Math.min(7, value));
            e.target.value = value;
            
            handleStateUpdate(() => {
                if (!state.income.starBonus) state.income.starBonus = {};
                state.income.starBonus.eventDuration = value;
            });
        });
    }

    if (lastEventSelect) {
        lastEventSelect.addEventListener('change', (e) => {
            const offset = parseInt(e.target.value, 10);
            const now = new Date();
            const date = new Date(now.getUTCFullYear(), now.getUTCMonth() + offset, 1);
            
            handleStateUpdate(() => {
                if (!state.income.starBonus) state.income.starBonus = {};
                state.income.starBonus.lastEventMonth = date.getUTCMonth();
                state.income.starBonus.lastEventYear = date.getUTCFullYear();
            });
        });
    }

    document.addEventListener('languageChanged', () => {
        renderStarBonusSelectorContent();
        renderTHPlanningSection();
        renderLastEventOptions();
    });
    renderStarBonusSelectorContent();
    renderTHPlanningSection();
    renderLastEventOptions();
}

export function renderStarBonusControls(incomeState) {
    renderStarBonusSelectorContent();
    renderTHPlanningSection();
    renderLastEventOptions();
    
    const selectElement = dom.income?.starBonus?.league;
    const safeState = incomeState.starBonus || {};
    if (selectElement) {
        selectElement.value = safeState.league || 105000000;
    }

    const frequencyInput = dom.income?.starBonus?.frequencyInput;
    const durationInput = dom.income?.starBonus?.durationInput;
    const lastEventSelect = dom.income?.starBonus?.lastEventSelect;

    if (frequencyInput) {
        frequencyInput.value = safeState.eventFrequency || 2;
    }
    if (durationInput) {
        durationInput.value = safeState.eventDuration !== undefined ? safeState.eventDuration : 5;
    }
}
