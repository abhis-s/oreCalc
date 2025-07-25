import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';

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

    headerShiny.textContent = Math.round(totalIncome.shiny || 0).toLocaleString();
    headerGlowy.textContent = Math.round(totalIncome.glowy || 0).toLocaleString();
    headerStarry.textContent = Math.round(totalIncome.starry || 0).toLocaleString();

    const footerShiny = dom.income?.home?.incomeCard?.table?.totalRow?.shiny;
    const footerGlowy = dom.income?.home?.incomeCard?.table?.totalRow?.glowy;
    const footerStarry = dom.income?.home?.incomeCard?.table?.totalRow?.starry;

    if (footerShiny) footerShiny.textContent = Math.round(totalIncome.shiny || 0).toLocaleString();
    if (footerGlowy) footerGlowy.textContent = Math.round(totalIncome.glowy || 0).toLocaleString();
    if (footerStarry) footerStarry.textContent = Math.round(totalIncome.starry || 0).toLocaleString();

    const homeResourceElements = dom.income.home.incomeCard.resources;
    if (homeResourceElements.moneyValue) {
        const selectedCurrencyKey = uiSettings.currency.toUpperCase();
        const moneyValue = totalMoneyCost?.[selectedCurrencyKey] || totalMoneyCost?.USD || 0;
        homeResourceElements.moneyValue.textContent = moneyValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        homeResourceElements.moneySymbol.textContent = uiSettings.currencySymbol;
    }
}