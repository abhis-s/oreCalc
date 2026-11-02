import { languagesData } from '../../data/languagesData.js';
import { currencyData, priceTierRegistry } from '../../data/pricingData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { addCurrencyValidation } from '../../utils/inputValidator.js';
import { formatCurrency } from '../../utils/numberFormatter.js';

import { dom } from '../../dom/domElements.js';

/**
 * Populates language and currency select dropdown options with localized labels and symbols.
 */
export function populateDropdowns() {
    const languageSelect = dom.appSettings?.languageSelect;
    const currencySelect = dom.appSettings?.currencySelect;

    if (languageSelect) {
        languageSelect.innerHTML = '';
        languagesData.filter(lang => lang.enabled).forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.dataset.i18nLangName = lang.nameI18n;
            option.dataset.nativeName = lang.nativeName || '';
            option.dataset.fallbackName = lang.fallbackName || 'Unknown';

            const name = lang.nativeName || lang.fallbackName;
            const flag = lang.flag ? `${lang.flag} ` : '';
            option.textContent = `${flag}${name}`;
            languageSelect.appendChild(option);
        });
    }

    if (currencySelect) {
        currencySelect.innerHTML = '';
        Object.keys(currencyData).forEach(code => {
            const currency = currencyData[code];
            if (currency.enabled) {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = `${currency.symbol} ${code}`;
                currencySelect.appendChild(option);
            }
        });
    }
}

/**
 * Renders the custom global pricing configuration grid for all store price tiers in the selected currency.
 * @param {string} currencyCode - 3-letter currency code (e.g. 'USD', 'EUR').
 */
export function renderGlobalPricingGrid(currencyCode) {
    const gridBody = dom.appSettings?.globalPricingGridBody;
    const customHeader = dom.appSettings?.globalPricingCustomHeader;
    const resetBtn = dom.appSettings?.resetGlobalPricingBtn;
    if (!gridBody) return;

    gridBody.innerHTML = '';
    if (customHeader) {
        customHeader.textContent = currencyCode;
    }

    const activeTag = state.savedPlayerTags[0];
    const playerState = state.allPlayersData[activeTag];
    const customPricing = playerState?.currency?.globalPricing?.[currencyCode] || {};

    if (resetBtn) {
        if (Object.keys(customPricing).length > 0) {
            resetBtn.style.display = 'block';
        } else {
            resetBtn.style.display = 'none';
        }
    }

    const tiers = Object.keys(priceTierRegistry).sort((a, b) => {
        const numA = parseInt(a.replace('tier', ''));
        const numB = parseInt(b.replace('tier', ''));
        return numA - numB;
    });

    tiers.forEach(tierKey => {
        const tierData = priceTierRegistry[tierKey];
        const usdPrice = tierData.USD.toFixed(2);

        const row = document.createElement('div');
        row.className = 'global-pricing-row';

        const labelSpan = document.createElement('span');
        if (tierData.i18nKey) {
            labelSpan.dataset.i18n = tierData.i18nKey;
            if (tierData.i18nArgs) {
                labelSpan.dataset.i18nArgs = JSON.stringify(tierData.i18nArgs);
            }
        }
        const labelText = tierData.i18nKey ? translate(tierData.i18nKey, tierData.i18nArgs || {}) : (tierData.label || tierKey);
        labelSpan.textContent = labelText;
        labelSpan.title = `USD: $${usdPrice}`;
        row.appendChild(labelSpan);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `pricing-tier-${tierKey}`;
        input.name = `pricing-tier-${tierKey}`;
        input.inputMode = 'decimal';
        input.dataset.usdPrice = usdPrice;
        input.dataset.tierKey = tierKey;

        const defaultPrice = tierData[currencyCode];
        if (typeof defaultPrice === 'number') {
            input.placeholder = formatCurrency(defaultPrice);
        } else {
            input.placeholder = defaultPrice || '';
        }

        const rawValue = customPricing[tierKey] || customPricing[usdPrice] || '';
        if (rawValue !== '') {
            const floatVal = parseFloat(rawValue);
            input.value = !isNaN(floatVal) ? formatCurrency(floatVal) : rawValue;
        } else {
            input.value = '';
        }

        addCurrencyValidation(input);
        row.appendChild(input);

        gridBody.appendChild(row);
    });
}

/**
 * Populates and synchronizes UI input states in the main App Settings modal.
 * @param {import('../../core/types.js').UISettingsState} uiSettings - Active UI settings configuration.
 */
export function renderAppSettings(uiSettings) {
    const currencySelect = dom.appSettings?.currencySelect;
    const languageSelect = dom.appSettings?.languageSelect;
    const enableLevelInputToggle = dom.equipment?.enableLevelInputToggle;
    const themeToggle = document.getElementById('settings-theme-switch');

    if (currencySelect) {
        currencySelect.value = uiSettings.currency.code;
    }

    if (languageSelect) {
        languageSelect.value = uiSettings.language || 'auto';
    }

    if (enableLevelInputToggle) {
        enableLevelInputToggle.checked = uiSettings.enableLevelInput;
    }

    const hideMaxedToggle = dom.equipment?.hideMaxedToggle;
    if (hideMaxedToggle) {
        hideMaxedToggle.checked = uiSettings.hideMaxedEquipment;
    }

    const hideLockedToggle = dom.equipment?.hideLockedToggle;
    if (hideLockedToggle) {
        hideLockedToggle.checked = uiSettings.hideLockedEquipment;
    }

    if (themeToggle) {
        themeToggle.checked = uiSettings.theme === 'light';
        const themeLabel = document.querySelector('label[for="settings-theme-switch"]');
        if (themeLabel) {
            const labelKey = themeToggle.checked ? 'views.settings.options.themeDark' : 'views.settings.options.themeLight';
            themeLabel.textContent = translate(labelKey);
            themeLabel.setAttribute('data-i18n', labelKey);
        }
    }

    const cozyQuiltToggle = /** @type {HTMLInputElement|null} */ (document.getElementById('app-card-layout-switch') || document.getElementById('settings-cozy-quilt-switch'));

    if (cozyQuiltToggle) {
        const isCompact = uiSettings.cardLayout === 'compact0' || uiSettings.cardLayout === 'compact1' || uiSettings.cardLayout === 'quilt';
        cozyQuiltToggle.checked = isCompact;
    }
}
