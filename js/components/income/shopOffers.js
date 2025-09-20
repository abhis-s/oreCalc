import { dom } from '../../dom/domElements.js';
import { initializeOfferGrid, renderOfferGrid } from '../common/offerGrid.js';
import { currencySymbols, currencyConversionRates, shopOfferData } from '../../data/appData.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { translate } from '../../i18n/translator.js';
import { formatNumber, formatCurrency } from '../../utils/numberFormatter.js';

let isResponsive = false;

function renderShopOfferSelectorContent() {
    const selector = dom.income?.shopOffers?.dropdown;
    if (!selector) return;

    const selectedValue = selector.value;
    selector.innerHTML = '';

    for (const key in shopOfferData) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = (() => {
            if (key === 'none') {
                return translate('none');
            } else if (shopOfferData[key] && shopOfferData[key].townHallLevel !== undefined) {
                return translate(`TH${shopOfferData[key].townHallLevel}_Set`);
            } else {
                return key;
            }
        })();
        selector.appendChild(option);
    }
    selector.value = selectedValue;
}

function renderShopOfferRow(offer, offerState) {
    const row = document.createElement('div');
    row.className = 'offer-grid-row';

    const costDisplay = document.createElement('div');
    costDisplay.className = 'offer-cost-display';
    const selectedCurrency = state.uiSettings.currency;
    let currencyValue = offer.baseCostUSD !== undefined ? currencyConversionRates[offer.baseCostUSD.toFixed(2)]?.[selectedCurrency] : undefined;
    let currencySymbol = currencySymbols[selectedCurrency]?.symbol;

    if (currencyValue === undefined && offer.baseCostUSD !== undefined) {
        currencyValue = offer.baseCostUSD;
        currencySymbol = currencySymbols.USD.symbol;
    } else if (offer.baseCostUSD === undefined) {
        currencyValue = 0;
        currencySymbol = '';
    }

    if (state.uiSettings.regionalPricingEnabled && currencySymbols[selectedCurrency]?.regionalPricing) {
        currencyValue /= 2;
    }

    currencyValue = currencyValue || 0.00;
        costDisplay.innerHTML = `<span>${currencySymbol} ${formatCurrency(currencyValue)}</span>`;

    const oreType = offer.shiny ? 'shiny' : offer.glowy ? 'glowy' : 'starry';
    const oreValue = offer.shiny || offer.glowy || offer.starry;
    const oreImage = `assets/${oreType}_ore.png`;
    const oreDisplay = document.createElement('div');
    oreDisplay.className = 'offer-ore-display';
    oreDisplay.innerHTML = `<span>${formatNumber(Math.round(oreValue))}</span><img src="${oreImage}" alt="${translate(`${oreType}_ore`)}" class="ore-image">`;

    row.appendChild(costDisplay);
    row.appendChild(oreDisplay);

    if (isResponsive) {
        const dropdownDiv = document.createElement('div');
        dropdownDiv.className = 'offer-dropdown-instance';
        const select = document.createElement('select');
        select.className = 'offer-input-dropdown dropdown-style';
        select.id = `shop-offer-${offer.id}-dropdown`;
        select.dataset.offerId = offer.id;
        for (let i = 0; i <= offer.maxPacks; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            select.appendChild(option);
        }
        select.value = offerState;
        select.addEventListener('change', (e) => {
            const selectedValue = parseInt(e.target.value, 10);
            updateShopOfferState(offer.id, null, selectedValue);
        });
        dropdownDiv.appendChild(select);
        row.appendChild(dropdownDiv);
    } else {
        for (let i = 1; i <= offer.maxPacks; i++) {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'offer-checkbox-instance';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.instance = i;
            checkbox.id = `${offer.id}_${i}`;
            checkbox.checked = i <= offerState;
            checkboxDiv.appendChild(checkbox);
            row.appendChild(checkboxDiv);
        }
    }
    return row;
}

function updateShopOfferState(offerId, oreType, count) {
    const selectedSetKey = state.income.shopOffers.selectedSet;
    if (!state.income.shopOffers.sets[selectedSetKey]) {
        state.income.shopOffers.sets[selectedSetKey] = {};
    }
    handleStateUpdate(() => { state.income.shopOffers.sets[selectedSetKey][offerId] = count; });
}

export function initializeShopOffers() {
    const selector = dom.income?.shopOffers?.dropdown;
    const container = dom.income?.shopOffers?.checkboxes;
    if (!selector || !container) return;

    renderShopOfferSelectorContent();

    selector.addEventListener('change', (e) => {
        handleStateUpdate(() => { state.income.shopOffers.selectedSet = e.target.value; });
    });

    document.addEventListener('languageChanged', renderShopOfferSelectorContent);

    initializeOfferGrid({
        container,
        offers: Object.values(shopOfferData).flatMap(setOffers => 
            Object.entries(setOffers)
                .filter(([offerId]) => offerId !== 'townHallLevel')
                .map(([offerId, offer]) => ({ ...offer, id: offerId }))
        ),
        onStateChange: updateShopOfferState,
        renderRow: renderShopOfferRow
    });

    const incomeCardElement = container.closest('.income-card');
    if (incomeCardElement) {
        incomeCardElement.addEventListener('cardsizechanged', (event) => {
            isResponsive = event.detail.newSize === 1;
            renderShopOfferGrid(state.income.shopOffers);
        });
    }
}

export function renderShopOfferSelector(shopOfferState) {
    const selector = dom.income?.shopOffers?.dropdown;
    if (selector) {
        const effectiveSelectedSet = shopOfferState.selectedSet && shopOfferData[shopOfferState.selectedSet] 
            ? shopOfferState.selectedSet 
            : 'none';
        selector.value = effectiveSelectedSet;
    }
}

export function renderShopOfferGrid(shopOfferState) {
    const container = dom.income?.shopOffers?.checkboxes;
    if (!container) return;

    const selectedSetKey = shopOfferState.selectedSet;
    const offersForSet = (selectedSetKey !== 'none' && shopOfferData[selectedSetKey]) ? 
        Object.entries(shopOfferData[selectedSetKey])
            .filter(([offerId]) => offerId !== 'townHallLevel')
            .map(([offerId, offer]) => ({ ...offer, id: offerId })) 
        : [];

    renderOfferGrid({
        container,
        offers: offersForSet,
        stateSelector: (offer) => {
            const currentSetPurchases = shopOfferState.sets[selectedSetKey] || {};
            return currentSetPurchases[offer.id] || 0;
        },
        renderRow: renderShopOfferRow
    });
}
