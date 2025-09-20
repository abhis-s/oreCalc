import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { formatNumber, formatCurrency } from '../../utils/numberFormatter.js';

export function initializeIncomeCardHandler() {
    const headerContainer = dom.income?.home?.incomeCard?.header?.container;
    const incomeContent = dom.income?.home?.incomeCard?.tableContainer;
    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;

    if (!headerContainer || !incomeContent || !timeframeSelect) return;

    headerContainer.addEventListener('click', (event) => {
        if (event.target.closest('.updatable') || event.target.closest('collapse-button')) {
            return;
        }
        handleStateUpdate(() => {
            state.uiSettings.incomeCardExpanded = !state.uiSettings.incomeCardExpanded;
        });
    });

    timeframeSelect.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            state.uiSettings.incomeTimeframe = e.target.value;
        });
    });
}

export function renderIncomeCard(isExpanded, totalIncome, uiSettings, totalMoneyCost) {
    const expanderBtn = dom.income?.home?.incomeCard?.tableExpanderBtn;
    const incomeContent = dom.income?.home?.incomeCard?.tableContainer;
    const headerContainer = dom.income?.home?.incomeCard?.header?.container;
    const headerShiny = dom.income?.home?.incomeCard?.header?.shiny;
    const headerGlowy = dom.income?.home?.incomeCard?.header?.glowy;
    const headerStarry = dom.income?.home?.incomeCard?.header?.starry;
    const timeframeSelect = dom.income?.home?.incomeCard?.timeframe;

    if (!expanderBtn || !incomeContent || !headerShiny || !headerGlowy || !headerStarry || !headerContainer || !timeframeSelect) return;

    timeframeSelect.value = uiSettings.incomeTimeframe;

    expanderBtn.classList.toggle('collapsed', !isExpanded);
    expanderBtn.querySelector('.collapse-icon')?.classList.toggle('hidden', isExpanded);
    expanderBtn.querySelector('.expand-icon')?.classList.toggle('hidden', !isExpanded);
    incomeContent.classList.toggle('expanded', isExpanded);
    headerContainer.classList.toggle('collapsed', !isExpanded);

    headerShiny.textContent = formatNumber(Math.round(totalIncome.shiny || 0));
    headerGlowy.textContent = formatNumber(Math.round(totalIncome.glowy || 0));
    headerStarry.textContent = formatNumber(Math.round(totalIncome.starry || 0));

    const footerShiny = dom.income?.home?.incomeCard?.table?.totalRow?.shiny;
    const footerGlowy = dom.income?.home?.incomeCard?.table?.totalRow?.glowy;
    const footerStarry = dom.income?.home?.incomeCard?.table?.totalRow?.starry;

    if (footerShiny) footerShiny.textContent = formatNumber(Math.round(totalIncome.shiny || 0));
    if (footerGlowy) footerGlowy.textContent = formatNumber(Math.round(totalIncome.glowy || 0));
    if (footerStarry) footerStarry.textContent = formatNumber(Math.round(totalIncome.starry || 0));

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.moneyValue) {
        const selectedCurrencyKey = uiSettings.currency.toUpperCase();
        const moneyValue = totalMoneyCost?.[selectedCurrencyKey] || totalMoneyCost?.USD || 0;
        homeResourceElements.moneyValue.textContent = formatCurrency(moneyValue);
        homeResourceElements.moneySymbol.textContent = uiSettings.currencySymbol;
    }
}