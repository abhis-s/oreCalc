import { shopOfferData } from '../../data/incomeSources/shopOffers.js';
import { currencyData } from '../../data/pricingData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { getCurrencySymbol, getPriceForTier } from '../../utils/incomeUtils.js';
import { formatCurrency, formatNumber, updateCalculatedValue } from '../../utils/numberFormatter.js';

import { renderOfferGrid } from '../common/offerGrid.js';
import { dom } from '../../dom/domElements.js';

const TH_SET_TRANSLATION_MAP = {
    8: 'views.income.shopOffers.th8Set',
    11: 'views.income.shopOffers.th11Set',
    14: 'views.income.shopOffers.th14Set',
    16: 'views.income.shopOffers.th16Set'
};

/**
 * Renders the options inside the Shop Offer set selection dropdown.
 */
export function renderShopOfferSelectorContent() {
    const selector = dom.income?.shopOffers?.dropdown;
    if (!selector) return;

    const selectedValue = selector.value;
    selector.innerHTML = '';

    for (const key in shopOfferData) {
        const option = document.createElement('option');
        option.value = key;
        const thLevel = shopOfferData[key]?.townHallLevel;
        const i18nKey = key === '0' ? 'app.none' : (thLevel && TH_SET_TRANSLATION_MAP[thLevel]);
        if (i18nKey) {
            option.dataset.i18n = i18nKey;
            option.textContent = translate(i18nKey);
        } else {
            option.textContent = key;
        }
        selector.appendChild(option);
    }
    selector.value = selectedValue;
}

/**
 * Renders a single Shop Offer row element with dropdown and checkboxes.
 * @param {any} offer - Shop Offer configuration object.
 * @param {number} offerState - Current purchased quantity for this offer.
 * @returns {HTMLDivElement} Rendered offer grid row DOM element.
 */
export function renderShopOfferRow(offer, offerState) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';

    const costDisplay = document.createElement('div');
    costDisplay.className = 'offer-cost-display';
    const currencyCode = state.uiSettings?.currency?.code || 'USD';
    const activeTag = state.savedPlayerTags?.[0];
    const customPricing = state.allPlayersData?.[activeTag]?.currency?.globalPricing?.[currencyCode];
    const currencyValue = getPriceForTier(offer.priceTier, currencyCode, customPricing);
    const currencySymbol = getCurrencySymbol(currencyCode);

    costDisplay.innerHTML = `<span>${currencySymbol} ${formatCurrency(currencyValue)}</span>`;

    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : offer.starry ? 'starry' : (offer.id?.includes('glowy') ? 'glowy' : offer.id?.includes('starry') ? 'starry' : 'shiny');
    const oreValue = (offer.shiny || offer.glowy || offer.starry) || 0;
    const oreImage = `assets/${oreType}_ore.png`;
    const oreDisplay = document.createElement('div');
    oreDisplay.className = 'offer-ore-display';
    oreDisplay.innerHTML = `<span>${formatNumber(Math.round(oreValue))}</span><orecalc-assets-image src="${oreImage}" alt="${translate('entities.ores.' + oreType)}" class="ore-image" size="thumbnail"></orecalc-assets-image>`;

    row.appendChild(costDisplay);
    row.appendChild(oreDisplay);

    const dropdownDiv = document.createElement('div');
    dropdownDiv.className = 'offer-dropdown-instance';
    const select = document.createElement('select');
    select.className = 'offer-input-dropdown dropdown-style';
    select.id = `shop-offers-${offer.id}-dropdown`;
    select.name = `shop-offers-${offer.id}-dropdown`;
    select.dataset.offerId = offer.id;

    const oreName = translate('entities.ores.' + oreType);
    const offerName = `${formatNumber(Math.round(oreValue))} ${oreName}`;
    select.setAttribute('aria-label', translate('views.income.supercellEvents.packInput', { name: offerName }));

    const maxPacks = typeof offer.maxPacks === 'number' ? offer.maxPacks : 2;
    for (let i = 0; i <= maxPacks; i++) {
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = String(i);
        select.appendChild(option);
    }
    select.value = String(offerState || 0);
    dropdownDiv.appendChild(select);
    row.appendChild(dropdownDiv);

    for (let i = 1; i <= 2; i++) {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'offer-checkbox-instance';
        if (i <= maxPacks) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.offerId = offer.id;
            checkbox.dataset.instance = String(i);
            checkbox.id = `cb_${offer.id}_${i}`;
            checkbox.name = `cb_${offer.id}_${i}`;
            checkbox.checked = i <= offerState;

            const oreName = translate('entities.ores.' + oreType);
            const offerName = `${formatNumber(Math.round(oreValue))} ${oreName}`;
            checkbox.setAttribute('aria-label', translate('views.income.shopOffers.packCheckbox', {
                num: i,
                name: offerName
            }));

            checkboxDiv.appendChild(checkbox);
        }
        row.appendChild(checkboxDiv);
    }

    return row;
}

/**
 * Synchronizes the Shop Offer set dropdown selection with active state.
 * @param {import('../../core/types.js').ShopOffersIncomeState} shopOfferState - Active Shop Offers state object.
 */
export function renderShopOfferSelector(shopOfferState) {
    const selector = dom.income?.shopOffers?.dropdown;
    if (selector) {
        let selected = shopOfferState.selectedSet;
        if (selected === undefined || selected === null) {
            const firstKey = Object.keys(shopOfferState).find(k => k !== 'selectedSet');
            selected = firstKey ? Number(firstKey) || 0 : 0;
        }
        const selectedNum = Number(selected) || 0;
        selector.value = selectedNum.toString();
    }
}

/**
 * Renders the Shop Offers grid based on active set selection and purchase states.
 * @param {import('../../core/types.js').ShopOffersIncomeState} shopOfferState - Active Shop Offers state object.
 */
export function renderShopOfferGrid(shopOfferState) {
    const container = dom.income?.shopOffers?.checkboxes;
    if (!container) return;

    let selected = shopOfferState.selectedSet;
    if (selected === undefined || selected === null) {
        const firstKey = Object.keys(shopOfferState).find(k => k !== 'selectedSet');
        selected = firstKey ? Number(firstKey) || 0 : 0;
    }
    const selectedNum = Number(selected) || 0;

    const order = { 'shiny_large': 1, 'starry': 2, 'glowy': 3, 'shiny_small': 4, 'shiny': 4 };
    const offersForSet = (selectedNum !== 0 && shopOfferData[selectedNum]) ?
        Object.entries(shopOfferData[selectedNum])
            .filter(([offerId]) => offerId !== 'townHallLevel')
            .sort(([idA], [idB]) => (order[idA] || 99) - (order[idB] || 99))
            .map(([offerId, offer]) => ({
                ...offer,
                id: offerId
            }))
        : [];

    const rows = container.querySelectorAll('.offer-grid-row');
    const isSetChanged = container.dataset.renderedSet !== String(selectedNum);
    const needsFullRender = isSetChanged || rows.length === 0 || rows.length !== offersForSet.length;

    if (needsFullRender) {
        container.dataset.renderedSet = String(selectedNum);
        renderOfferGrid({
            container,
            offers: offersForSet,
            stateSelector: (offer) => {
                const currentSetPurchases = shopOfferState[selectedNum] || {};
                return currentSetPurchases[offer.id] || 0;
            },
            renderRow: renderShopOfferRow
        });
    } else {
        offersForSet.forEach((offer, index) => {
            const currentSetPurchases = shopOfferState[selectedNum] || {};
            const offerState = currentSetPurchases[offer.id] || 0;

            const row = rows[index];
            if (row) {
                const costDisplay = row.querySelector('.offer-cost-display');
                if (costDisplay) {
                    const currencyCode = state.uiSettings?.currency?.code || 'USD';
                    const activeTag = state.savedPlayerTags?.[0];
                    const customPricing = state.allPlayersData?.[activeTag]?.currency?.globalPricing?.[currencyCode];
                    const currencyValue = getPriceForTier(offer.priceTier, currencyCode, customPricing);
                    const currencySymbol = getCurrencySymbol(currencyCode);
                    costDisplay.innerHTML = `<span>${currencySymbol} ${formatCurrency(currencyValue)}</span>`;
                }
            }

            const select = container.querySelector(`select[data-offer-id="${offer.id}"]`);
            if (select && parseInt(select.value, 10) !== offerState) {
                select.value = offerState;
            }

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

/**
 * Renders calculated Shop Offer ore totals and currency pricing summaries.
 * @param {import('../../core/types.js').IncomeResult} shopOfferIncome - Calculated Shop Offer monthly income object.
 * @param {import('../../core/types.js').UISettingsState} uiSettings - User interface and currency settings state.
 */
export function renderShopOfferIncomeTabDisplay(shopOfferIncome, uiSettings) {
    const incomeTabDisplayElements = dom.income.shopOffers.display;
    if (!incomeTabDisplayElements) return;

    updateCalculatedValue(incomeTabDisplayElements.shiny, shopOfferIncome.monthly?.shiny || 0);
    updateCalculatedValue(incomeTabDisplayElements.glowy, shopOfferIncome.monthly?.glowy || 0);
    updateCalculatedValue(incomeTabDisplayElements.starry, shopOfferIncome.monthly?.starry || 0);
    updateCalculatedValue(incomeTabDisplayElements.eur, shopOfferIncome.monthly?.EUR || 0, 2);
    updateCalculatedValue(incomeTabDisplayElements.usd, shopOfferIncome.monthly?.USD || 0, 2);
    if (incomeTabDisplayElements.dynamic) {
        let displayCurrencyCode = uiSettings.currency.code.toUpperCase();
        let displaySymbol = currencyData[uiSettings.currency.code]?.symbol || '';

        if (displayCurrencyCode === 'USD' || displayCurrencyCode === 'EUR' || displayCurrencyCode === 'GBP') {
            displayCurrencyCode = 'GBP';
            displaySymbol = currencyData['GBP']?.symbol || '£';
        }

        const dynamicValue = (shopOfferIncome.monthly?.[displayCurrencyCode] || 0);
        updateCalculatedValue(incomeTabDisplayElements.dynamic, dynamicValue, 2);
        incomeTabDisplayElements.dynamicCurrencySymbol.textContent = displaySymbol;
    }
}
