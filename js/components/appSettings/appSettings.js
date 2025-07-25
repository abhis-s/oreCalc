import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { currencySymbols } from '../../data/appData.js';

function updateRegionalPricingVisibility() {
    const currency = state.uiSettings.currency;
    const regionalPricingSwitchContainer = dom.appSettings?.regionalPricingSwitchContainer;
    if (!regionalPricingSwitchContainer) return;

    if (currencySymbols[currency] && currencySymbols[currency].regionalPricing) {
        regionalPricingSwitchContainer.style.display = 'flex';
    } else {
        regionalPricingSwitchContainer.style.display = 'none';
    }
}

export function initializeAppSettings() {
    const currencySelect = dom.appSettings?.currencySelect;
    const regionalPricingToggle = dom.appSettings?.regionalPricingToggle;
    const resetDataButton = dom.controls?.resetDataButton;

    if (!currencySelect) return;

    currencySelect.addEventListener('change', (e) => {
        handleStateUpdate(() => {
            const oldCurrency = state.uiSettings.currency;
            const wasRegionalPricingEnabled = state.uiSettings.regionalPricingEnabled;

            state.uiSettings.currency = e.target.value;
            state.uiSettings.currencySymbol = currencySymbols[e.target.value]?.symbol || '';

            if (wasRegionalPricingEnabled && !(currencySymbols[state.uiSettings.currency] && currencySymbols[state.uiSettings.currency].regionalPricing)) {
                state.uiSettings.regionalPricingEnabled = false;
                if (dom.appSettings?.regionalPricingToggle) {
                    dom.appSettings.regionalPricingToggle.checked = false;
                }
            }
            updateRegionalPricingVisibility();
        });
    });

    if (regionalPricingToggle) {
        regionalPricingToggle.addEventListener('change', (e) => {
            handleStateUpdate(() => {
                state.uiSettings.regionalPricingEnabled = e.target.checked;
                if (state.lastPlayerTag && state.allPlayersData[state.lastPlayerTag]) {
                    state.allPlayersData[state.lastPlayerTag].regionalPricingEnabled = e.target.checked;
                }
            });
        });
    }

    if (resetDataButton) {
        resetDataButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all data? This action cannot be undone.')) {
                window.resetApplication();
            }
        });
    }

    updateRegionalPricingVisibility();
}

export function renderAppSettings(uiSettings) {
    const currencySelect = dom.appSettings?.currencySelect;
    const regionalPricingToggle = dom.appSettings?.regionalPricingToggle;

    if (currencySelect) {
        currencySelect.value = uiSettings.currency;
    }

    if (regionalPricingToggle) {
        regionalPricingToggle.checked = uiSettings.regionalPricingEnabled;
    }
    updateRegionalPricingVisibility();
}