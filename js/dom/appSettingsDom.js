export function getAppSettingsDOMElements() {
    return {
        currencySelect: document.getElementById('currency-select'),
        languageSelect: document.getElementById('language-select'),
        regionalPricingSwitchContainer: document.getElementById('regional-pricing-switch-container'),
        regionalPricingToggle: document.getElementById('regional-pricing-toggle'),
        userIdDisplay: document.getElementById('user-id-display'),
        copyUserIdBtn: document.getElementById('copy-user-id-btn'),
        importUserIdInput: document.getElementById('import-user-id-input'),
        importUserDataBtn: document.getElementById('import-user-data-btn'),
    };
}
