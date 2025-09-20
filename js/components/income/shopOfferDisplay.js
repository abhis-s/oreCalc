import { dom } from '../../dom/domElements.js';
import { formatNumber, formatCurrency } from '../../utils/numberFormatter.js';

export function renderShopOfferHomeDisplay(shopOfferIncome, timeframe, uiSettings) {
    const homeElements = dom.income.home.incomeCard.table.shopOffer;
    const incomeTabDisplayElements = dom.income.shopOffers.display;
    if (!homeElements || !incomeTabDisplayElements) return;

    const timeframeIncome = shopOfferIncome[timeframe] || {};

    if (homeElements.shiny) {
        homeElements.shiny.textContent = formatNumber(Math.round(timeframeIncome.shiny || 0));
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = formatNumber(Math.round(timeframeIncome.glowy || 0));
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = formatNumber(Math.round(timeframeIncome.starry || 0));
    }
    if (homeElements.resource) {
        const selectedCurrencyKey = uiSettings.currency.toUpperCase();
        const selectedCurrencySymbol = uiSettings.currencySymbol;
        const resourceText = `${selectedCurrencySymbol} ${formatCurrency(shopOfferIncome.monthly?.[selectedCurrencyKey] || 0)}`;
        homeElements.resource.textContent = resourceText;
    }

    if (incomeTabDisplayElements.shiny) incomeTabDisplayElements.shiny.textContent = formatNumber(Math.round(shopOfferIncome.monthly?.shiny || 0));
    if (incomeTabDisplayElements.glowy) incomeTabDisplayElements.glowy.textContent = formatNumber(Math.round(shopOfferIncome.monthly?.glowy || 0));
    if (incomeTabDisplayElements.starry) incomeTabDisplayElements.starry.textContent = formatNumber(Math.round(shopOfferIncome.monthly?.starry || 0));
    if (incomeTabDisplayElements.eur) incomeTabDisplayElements.eur.textContent = formatCurrency(shopOfferIncome.monthly?.EUR || 0);
    if (incomeTabDisplayElements.usd) incomeTabDisplayElements.usd.textContent = formatCurrency(shopOfferIncome.monthly?.USD || 0);
    if (incomeTabDisplayElements.dynamic) {
        let displayCurrencyCode = uiSettings.currency.toUpperCase();
        let displaySymbol = uiSettings.currencySymbol;

        if (displayCurrencyCode === 'USD' || displayCurrencyCode === 'EUR' || displayCurrencyCode === 'GBP') {
            displayCurrencyCode = 'GBP';
            displaySymbol = '£';
        }

        const dynamicValue = (shopOfferIncome.monthly?.[displayCurrencyCode] || 0);
        incomeTabDisplayElements.dynamic.textContent = formatCurrency(dynamicValue);
        incomeTabDisplayElements.dynamicCurrencySymbol.textContent = displaySymbol;
    }
}