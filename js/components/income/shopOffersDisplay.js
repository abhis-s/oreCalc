import { dom } from '../../dom/domElements.js';

import { currencyData, shopOfferData } from '../../data/appData.js';
import { formatCurrency, formatNumber } from '../../utils/numberFormatter.js';
import { getPriceForTier, getCurrencySymbol } from '../../utils/incomeUtils.js';
import { translate } from '../../i18n/translator.js';

import { updateShopOfferState } from './shopOffersInputs.js';

import { renderOfferGrid } from '../common/offerGrid.js';

export function renderShopOfferSelectorContent() {
    const selector = dom.income?.shopOffers?.dropdown;
    if (!selector) return;

    const selectedValue = selector.value;
    selector.innerHTML = '';

    for (const key in shopOfferData) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = (() => {
            if (key === '0') {
                return translate('app.none');
            } else if (shopOfferData[key] && shopOfferData[key].townHallLevel !== undefined && shopOfferData[key].townHallLevel > 0) {
                return translate('income.shopOffers.th' + shopOfferData[key].townHallLevel + 'Set');
            } else {
                return key;
            }
        })();
        selector.appendChild(option);
    }
    selector.value = selectedValue;
}

export function renderShopOfferRow(offer, offerState) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';

    const costDisplay = document.createElement('div');
    costDisplay.className = 'offer-cost-display';
    
    const currencyValue = getPriceForTier(offer.priceTier);
    const currencySymbol = getCurrencySymbol();

    costDisplay.innerHTML = `<span>${currencySymbol} ${formatCurrency(currencyValue)}</span>`;

    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
    const oreValue = offer.shiny || offer.glowy || offer.starry;
    const oreImage = `assets/${oreType}_ore.png`;
    const oreDisplay = document.createElement('div');
    oreDisplay.className = 'offer-ore-display';
    oreDisplay.innerHTML = `<span>${formatNumber(Math.round(oreValue))}</span><orecalc-assets-image src="${oreImage}" alt="${translate('ores.' + oreType)}" class="ore-image" size="thumbnail"></orecalc-assets-image>`;

    row.appendChild(costDisplay);
    row.appendChild(oreDisplay);

    // 1. Dropdown (for responsive view)
    const dropdownDiv = document.createElement('div');
    dropdownDiv.className = 'offer-dropdown-instance';
    const select = document.createElement('select');
    select.className = 'offer-input-dropdown dropdown-style';
    select.id = `shop-offers-${offer.id}-dropdown`;
    select.name = `shop-offers-${offer.id}-dropdown`;
    select.dataset.offerId = offer.id;
    
    const oreName = translate('ores.' + oreType);
    const offerName = `${formatNumber(Math.round(oreValue))} ${oreName}`;
    select.setAttribute('aria-label', translate('income.supercellEvents.packInput', { name: offerName }));

    for (let i = 0; i <= offer.maxPacks; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        select.appendChild(option);
    }
    select.value = offerState;
    dropdownDiv.appendChild(select);
    row.appendChild(dropdownDiv);

    // 2. Checkboxes (for default view)
    for (let i = 1; i <= 2; i++) {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'offer-checkbox-instance';
        if (i <= offer.maxPacks) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.offerId = offer.id;
            checkbox.dataset.instance = i;
            checkbox.id = `cb_${offer.id}_${i}`;
            checkbox.name = `cb_${offer.id}_${i}`;
            checkbox.checked = i <= offerState;
            
            const oreName = translate('ores.' + oreType);
            const offerName = `${formatNumber(Math.round(oreValue))} ${oreName}`;
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

export function renderShopOfferSelector(shopOfferState) {
    const selector = dom.income?.shopOffers?.dropdown;
    if (selector) {
        let selected = shopOfferState.selectedSet;
        if (selected === undefined) {
            const firstKey = Object.keys(shopOfferState).find(k => k !== 'selectedSet');
            selected = firstKey ? parseInt(firstKey, 10) : 0;
        }
        selector.value = selected.toString();
    }
}

export function renderShopOfferGrid(shopOfferState) {
    const container = dom.income?.shopOffers?.checkboxes;
    if (!container) return;

    let selected = shopOfferState.selectedSet;
    if (selected === undefined) {
        const firstKey = Object.keys(shopOfferState).find(k => k !== 'selectedSet');
        selected = firstKey ? parseInt(firstKey, 10) : 0;
    }
    
    const offersForSet = (selected !== 0 && shopOfferData[selected]) ? 
        Object.entries(shopOfferData[selected])
            .filter(([offerId]) => offerId !== 'townHallLevel')
            .map(([offerId, offer]) => ({ 
                ...offer, 
                id: offerId 
            })) 
        : [];

    const rows = container.querySelectorAll('.offer-grid-row');
    let needsFullRender = (rows.length === 0 || rows.length !== offersForSet.length);
    if (!needsFullRender) {
        for (let i = 0; i < offersForSet.length; i++) {
            const input = rows[i].querySelector('input[type="checkbox"], select');
            if (input && input.dataset.offerId !== offersForSet[i].id) {
                needsFullRender = true;
                break;
            }
        }
    }

    if (needsFullRender) {
        renderOfferGrid({
            container,
            offers: offersForSet,
            stateSelector: (offer) => {
                const currentSetPurchases = shopOfferState[selected] || {};
                return currentSetPurchases[offer.id] || 0;
            },
            renderRow: renderShopOfferRow
        });
    } else {
        offersForSet.forEach((offer, index) => {
            const currentSetPurchases = shopOfferState[selected] || {};
            const offerState = currentSetPurchases[offer.id] || 0;

            const row = rows[index];
            if (row) {
                const costDisplay = row.querySelector('.offer-cost-display');
                if (costDisplay) {
                    const currencyValue = getPriceForTier(offer.priceTier);
                    const currencySymbol = getCurrencySymbol();
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

export function renderShopOfferIncomeTabDisplay(shopOfferIncome, uiSettings) {
    const incomeTabDisplayElements = dom.income.shopOffers.display;
    if (!incomeTabDisplayElements) return;

    if (incomeTabDisplayElements.shiny) incomeTabDisplayElements.shiny.textContent = formatNumber(Math.round(shopOfferIncome.monthly?.shiny || 0));
    if (incomeTabDisplayElements.glowy) incomeTabDisplayElements.glowy.textContent = formatNumber(Math.round(shopOfferIncome.monthly?.glowy || 0));
    if (incomeTabDisplayElements.starry) incomeTabDisplayElements.starry.textContent = formatNumber(Math.round(shopOfferIncome.monthly?.starry || 0));
    if (incomeTabDisplayElements.eur) incomeTabDisplayElements.eur.textContent = formatCurrency(shopOfferIncome.monthly?.EUR || 0);
    if (incomeTabDisplayElements.usd) incomeTabDisplayElements.usd.textContent = formatCurrency(shopOfferIncome.monthly?.USD || 0);
    if (incomeTabDisplayElements.dynamic) {
        let displayCurrencyCode = uiSettings.currency.code.toUpperCase();
        let displaySymbol = currencyData[uiSettings.currency.code]?.symbol || '';

        if (displayCurrencyCode === 'USD' || displayCurrencyCode === 'EUR' || displayCurrencyCode === 'GBP') {
            displayCurrencyCode = 'GBP';
            displaySymbol = currencyData['GBP']?.symbol || '£';
        }

        const dynamicValue = (shopOfferIncome.monthly?.[displayCurrencyCode] || 0);
        incomeTabDisplayElements.dynamic.textContent = formatCurrency(dynamicValue);
        incomeTabDisplayElements.dynamicCurrencySymbol.textContent = displaySymbol;
    }
}
