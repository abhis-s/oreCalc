import { dom } from '../../dom/domElements.js';
import { initializeOfferGrid, renderOfferGrid } from '../common/offerGrid.js';
import { raidMedalTraderData } from '../../data/appData.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { addValidation } from '../../utils/inputValidator.js';

function renderRaidMedalTraderRow(offer, offerState) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';
    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
    const oreValue = offer.shiny || offer.glowy || offer.starry;
    row.innerHTML = `
        <div class="offer-cost-display"><img src="assets/resources/raid_medal.png" alt="Raid Medal" class="ore-image raid-medal-icon"> ${offer.cost.toLocaleString()}</div>
        <div class="offer-ore-display"><span>${oreValue.toLocaleString()}</span><img src="assets/${oreType}_ore.png" alt="${oreType} ore" class="ore-image"></div>
        ${Array.from({ length: offer.maxPacks }, (_, i) => `
            <div class="offer-checkbox-instance">
                <input type="checkbox" data-instance="${i + 1}" id="${offer.id}_${i + 1}" ${i < offerState ? 'checked' : ''}>
            </div>
        `).join('')}
    `;
    return row;
}

function updateRaidMedalTraderState(offerId, oreType, count) {
    handleStateUpdate(() => { state.income.raidMedals.packs[oreType] = count; });
}

export function initializeRaidMedalTrader() {
    const container = dom.income?.raids?.offersContainer;
    const earnedInput = dom.income?.raids?.earned;
    if (!container || !earnedInput) return;

    initializeOfferGrid({
        container,
        offers: raidMedalTraderData,
        onStateChange: updateRaidMedalTraderState
    });
    addValidation(earnedInput, { inputName: 'Raid Medals' });
    earnedInput.addEventListener('validated-input', (e) => {
        handleStateUpdate(() => { state.income.raidMedals.earned = e.detail.value; });
    });
}

export function renderRaidMedalTraderGrid(raidMedalState) {
    const container = dom.income?.raids?.offersContainer;
    const earnedInput = dom.income?.raids?.earned;
    if (!container || !earnedInput) return;

    earnedInput.value = raidMedalState.earned;
    renderOfferGrid({
        container,
        offers: raidMedalTraderData,
        stateSelector: (offer) => {
            const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
            return raidMedalState.packs[oreType] || 0;
        },
        renderRow: renderRaidMedalTraderRow
    });
}

export function renderRaidMedalTraderDisplay(raidMedalIncome, timeframe) {
    const homeDisplayElements = dom.income?.home?.incomeCard?.table?.raidMedal;
    const incomeTabDisplayElements = dom.income?.raids;
    if (!homeDisplayElements || !incomeTabDisplayElements) return;

    const displayData = raidMedalIncome?.[timeframe] || {};
    if (homeDisplayElements.shiny) homeDisplayElements.shiny.textContent = Math.round(displayData.shiny || 0).toLocaleString();
    if (homeDisplayElements.glowy) homeDisplayElements.glowy.textContent = Math.round(displayData.glowy || 0).toLocaleString();
    if (homeDisplayElements.starry) homeDisplayElements.starry.textContent = Math.round(displayData.starry || 0).toLocaleString();
    if (homeDisplayElements.resource) homeDisplayElements.resource.textContent = `${raidMedalIncome.cost || 0} Raid Medals per week`;

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.raidMedals) {
        homeResourceElements.raidMedals.textContent = `Raid Medals: ${raidMedalIncome.cost || 0}`;
    }

    if (incomeTabDisplayElements.display) {
        const remaining = raidMedalIncome.remaining || 0;
        incomeTabDisplayElements.remaining.textContent = remaining.toLocaleString();
        incomeTabDisplayElements.remaining.classList.toggle("negative-medals", remaining < 0);

        if (incomeTabDisplayElements.display.monthly?.shiny) incomeTabDisplayElements.display.monthly.shiny.textContent = Math.round(raidMedalIncome.monthly?.shiny || 0).toLocaleString();
        if (incomeTabDisplayElements.display.monthly?.glowy) incomeTabDisplayElements.display.monthly.glowy.textContent = Math.round(raidMedalIncome.monthly?.glowy || 0).toLocaleString();
        if (incomeTabDisplayElements.display.monthly?.starry) incomeTabDisplayElements.display.monthly.starry.textContent = Math.round(raidMedalIncome.monthly?.starry || 0).toLocaleString();

        if (incomeTabDisplayElements.display.weekly?.shiny) incomeTabDisplayElements.display.weekly.shiny.textContent = Math.round(raidMedalIncome.weekly?.shiny || 0).toLocaleString();
        if (incomeTabDisplayElements.display.weekly?.glowy) incomeTabDisplayElements.display.weekly.glowy.textContent = Math.round(raidMedalIncome.weekly?.glowy || 0).toLocaleString();
        if (incomeTabDisplayElements.display.weekly?.starry) incomeTabDisplayElements.display.weekly.starry.textContent = Math.round(raidMedalIncome.weekly?.starry || 0).toLocaleString();
    }
}