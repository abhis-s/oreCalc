export function getAppSettingsDOMElements() {
    return {
        currencySelect: document.getElementById('currency-select'),
        languageSelect: document.getElementById('language-select'),
        modeToggle: {
            switch: document.getElementById('mode-toggle-switch'),
            easeLabel: document.querySelector('#mode-toggle-switch .switch-label:first-child'),
            tweakLabel: document.querySelector('#mode-toggle-switch .switch-label:last-child'),
        },
        regionalPricingSwitchContainer: document.getElementById('regional-pricing-switch-container'),
        regionalPricingToggle: document.getElementById('regional-pricing-toggle'),
    };
}
