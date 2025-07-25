import { dom } from '../../dom/domElements.js';

export function renderShopOfferHomeDisplay(shopOfferIncome, timeframe, uiSettings) {
    const homeElements = dom.income.home.incomeCard.table.shopOffer;
    const incomeTabDisplayElements = dom.income.shopOffers.display;
    if (!homeElements || !incomeTabDisplayElements) return;

    const timeframeIncome = shopOfferIncome[timeframe] || {};

    if (homeElements.shiny) {
        homeElements.shiny.textContent = Math.round(timeframeIncome.shiny || 0).toLocaleString();
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = Math.round(timeframeIncome.glowy || 0).toLocaleString();
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = Math.round(timeframeIncome.starry || 0).toLocaleString();
    }
    if (homeElements.resource) {
        const selectedCurrencyKey = uiSettings.currency.toUpperCase();
        const selectedCurrencySymbol = uiSettings.currencySymbol;
        const resourceText = `${selectedCurrencySymbol} ${(shopOfferIncome.monthly?.[selectedCurrencyKey] || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        homeElements.resource.textContent = resourceText;
    }

    if (incomeTabDisplayElements.shiny) incomeTabDisplayElements.shiny.textContent = Math.round(shopOfferIncome.monthly?.shiny || 0).toLocaleString();
    if (incomeTabDisplayElements.glowy) incomeTabDisplayElements.glowy.textContent = Math.round(shopOfferIncome.monthly?.glowy || 0).toLocaleString();
    if (incomeTabDisplayElements.starry) incomeTabDisplayElements.starry.textContent = Math.round(shopOfferIncome.monthly?.starry || 0).toLocaleString();
    if (incomeTabDisplayElements.eur) incomeTabDisplayElements.eur.textContent = (shopOfferIncome.monthly?.EUR || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (incomeTabDisplayElements.usd) incomeTabDisplayElements.usd.textContent = (shopOfferIncome.monthly?.USD || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (incomeTabDisplayElements.dynamic) {
        let displayCurrencyCode = uiSettings.currency.toUpperCase();
        let displaySymbol = uiSettings.currencySymbol;

        if (displayCurrencyCode === 'USD' || displayCurrencyCode === 'EUR' || displayCurrencyCode === 'GBP') {
            displayCurrencyCode = 'GBP';
            displaySymbol = '£';
        }

        const dynamicValue = (shopOfferIncome.monthly?.[displayCurrencyCode] || 0);
        incomeTabDisplayElements.dynamic.textContent = dynamicValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        incomeTabDisplayElements.dynamicCurrencySymbol.textContent = displaySymbol;
    }
}