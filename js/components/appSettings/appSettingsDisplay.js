import { languagesData } from '../../data/languagesData.js';
import { currencyData, priceTierRegistry } from '../../data/pricingData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { getLanguageFromPath } from '../../core/languageRouter.js';

import { addCurrencyValidation } from '../../utils/inputValidator.js';
import { toMajorUnits } from '../../utils/incomeUtils.js';
import { formatCurrency } from '../../utils/numberFormatter.js';

import { dom } from '../../dom/domElements.js';

/**
 * Populates language and currency select dropdown options with localized labels and symbols.
 */
export function populateDropdowns() {
    const languageSelect = dom.appSettings?.languageSelect;
    const currencySelect = dom.appSettings?.currencySelect;

    if (languageSelect) {
        const activeLang = getLanguageFromPath() || state.uiSettings?.language || 'en';
        const existingOptions = Array.from(languageSelect.options || []);
        const enabledLanguages = languagesData.filter(lang => lang.enabled);
        const alreadyPopulated = existingOptions.length === enabledLanguages.length
            && enabledLanguages.every((lang, index) => existingOptions[index]?.value === lang.code);

        if (alreadyPopulated) {
            languageSelect.value = activeLang;
            existingOptions.forEach(opt => {
                opt.selected = opt.value === activeLang;
            });
        } else {
            languageSelect.innerHTML = '';
            enabledLanguages.forEach(lang => {
                const option = document.createElement('option');
                option.value = lang.code;
                option.dataset.i18nLangName = lang.nameI18n;
                option.dataset.nativeName = lang.nativeName || '';
                option.dataset.fallbackName = lang.fallbackName || 'Unknown';

                const name = lang.nativeName || lang.fallbackName;
                const flag = lang.flag ? `${lang.flag} ` : '';
                option.textContent = `${flag}${name}`;
                if (lang.code === activeLang) {
                    option.selected = true;
                }
                languageSelect.appendChild(option);
            });
            languageSelect.value = activeLang;
        }
    }

    if (currencySelect) {
        const activeCurrency = state.uiSettings?.currency?.code || 'USD';
        const existingOptions = Array.from(currencySelect.options || []);
        const enabledCurrencies = Object.keys(currencyData).filter(code => currencyData[code].enabled);
        const alreadyPopulated = existingOptions.length === enabledCurrencies.length
            && enabledCurrencies.every((code, index) => existingOptions[index]?.value === code);

        if (alreadyPopulated) {
            currencySelect.value = activeCurrency;
            existingOptions.forEach(opt => {
                opt.selected = opt.value === activeCurrency;
            });
        } else {
            currencySelect.innerHTML = '';
            enabledCurrencies.forEach(code => {
                const currency = currencyData[code];
                const option = document.createElement('option');
                option.value = code;
                option.textContent = `${currency.symbol} ${code}`;
                if (code === activeCurrency) {
                    option.selected = true;
                }
                currencySelect.appendChild(option);
            });
            currencySelect.value = activeCurrency;
        }
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
        const usdMajor = toMajorUnits(tierData.USD, 'USD');
        const usdPrice = usdMajor.toFixed(2);

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
            input.placeholder = formatCurrency(toMajorUnits(defaultPrice, currencyCode), currencyCode);
        } else {
            input.placeholder = defaultPrice || '';
        }

        const rawValue = customPricing[tierKey] || customPricing[usdPrice] || '';
        if (rawValue !== '') {
            const numVal = parseFloat(rawValue);
            const majorVal = Number.isInteger(numVal) ? toMajorUnits(numVal, currencyCode) : numVal;
            input.value = !isNaN(majorVal) ? formatCurrency(majorVal, currencyCode) : rawValue;
        } else {
            input.value = '';
        }

        addCurrencyValidation(input, currencyCode);
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
        languageSelect.value = getLanguageFromPath() || uiSettings.language || 'en';
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
