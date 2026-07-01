import { dom } from '../../dom/domElements.js';

import { formatNumber, updateCalculatedValue } from '../../utils/numberFormatter.js';
import { raidMedalTraderData } from '../../data/appData.js';
import { translate } from '../../i18n/translator.js';

import { renderOfferGrid } from '../common/offerGrid.js';

export function renderRaidMedalTraderRow(offer, offerState) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';
    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
    const oreValue = offer.shiny || offer.glowy || offer.starry;

    const costDisplay = document.createElement('div');
    costDisplay.className = 'offer-cost-display';
    costDisplay.innerHTML = `<orecalc-assets-image src="assets/resources/raidMedal.png" alt="${translate('ores.raidMedal')}" class="ore-image raid-medal-icon" size="thumbnail"></orecalc-assets-image> ${formatNumber(offer.cost)}`;
    row.appendChild(costDisplay);

    const oreDisplay = document.createElement('div');
    oreDisplay.className = 'offer-ore-display';
    oreDisplay.innerHTML = `<span>${formatNumber(oreValue)}</span><orecalc-assets-image src="assets/${oreType}_ore.png" alt="${translate('ores.' + oreType)}" class="ore-image"></orecalc-assets-image>`;
    row.appendChild(oreDisplay);

    // Only checkboxes for Raid Medal Trader
    for (let i = 1; i <= 2; i++) {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'offer-checkbox-instance';
        if (i <= offer.maxPacks) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.offerId = offer.id;
            checkbox.dataset.instance = i;
            checkbox.id = `${offer.id}_${i}`;
            checkbox.name = `${offer.id}_${i}`;
            checkbox.checked = i <= offerState;
            
            const oreName = translate('ores.' + oreType);
            const offerName = `${formatNumber(oreValue)} ${oreName}`;
            checkbox.setAttribute('aria-label', translate('income.shopOffers.packCheckbox', {
                num: i,
                name: offerName
            }));
            
            checkboxDiv.appendChild(checkbox);
        }
        row.appendChild(checkboxDiv);
    }

    return row;
}

export function renderRaidMedalTraderGrid(raidMedalState) {
    const container = dom.income?.raids?.offersContainer;
    const earnedInput = dom.income?.raids?.earned;
    if (!container || !earnedInput) return;

    const safeState = raidMedalState || { packs: {} };
    earnedInput.value = safeState.earned || 0;

    const rows = container.querySelectorAll('.offer-grid-row');
    if (rows.length === 0) {
        renderOfferGrid({
            container,
            offers: raidMedalTraderData,
            stateSelector: (offer) => {
                const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
                return safeState.packs?.[oreType] || 0;
            },
            renderRow: renderRaidMedalTraderRow
        });
    } else {
        raidMedalTraderData.forEach(offer => {
            const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
            const offerState = safeState.packs?.[oreType] || 0;

            for (let i = 1; i <= 2; i++) {
                const checkbox = container.querySelector(`input[type="checkbox"][data-offer-id="${offer.id}"][data-instance="${i}"]`);
                if (checkbox) {
                    const expectedChecked = i <= offerState;
                    if (checkbox.checked !== expectedChecked) {
                        checkbox.checked = expectedChecked;
                    }
                }
            }
        });
    }
}

export function renderRaidMedalTraderDisplay(raidMedalIncome, timeframe) {
    const incomeTabDisplayElements = dom.income?.raids;
    if (!incomeTabDisplayElements) return;

    if (incomeTabDisplayElements.display) {
        const remaining = raidMedalIncome.remaining || 0;
        if (incomeTabDisplayElements.remaining) {
            updateCalculatedValue(incomeTabDisplayElements.remaining, remaining);
            incomeTabDisplayElements.remaining.classList.toggle("negative-medals", remaining < 0);
        }

        updateCalculatedValue(incomeTabDisplayElements.display.monthly?.shiny, raidMedalIncome.monthly?.shiny || 0);
        updateCalculatedValue(incomeTabDisplayElements.display.monthly?.glowy, raidMedalIncome.monthly?.glowy || 0);
        updateCalculatedValue(incomeTabDisplayElements.display.monthly?.starry, raidMedalIncome.monthly?.starry || 0);

        updateCalculatedValue(incomeTabDisplayElements.display.weekly?.shiny, raidMedalIncome.weekly?.shiny || 0);
        updateCalculatedValue(incomeTabDisplayElements.display.weekly?.glowy, raidMedalIncome.weekly?.glowy || 0);
        updateCalculatedValue(incomeTabDisplayElements.display.weekly?.starry, raidMedalIncome.weekly?.starry || 0);
    }
}
