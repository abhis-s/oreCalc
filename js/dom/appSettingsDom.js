/**
 * Queries and caches DOM element references for the App Settings tab and related modals.
 */
export function getAppSettingsDOMElements() {
    return {
        currencySelect: document.getElementById('currency-select'),
        languageSelect: document.getElementById('language-select'),
        openGlobalPricingBtn: document.getElementById('open-global-pricing-btn'),
        accentColorSwatches: document.querySelectorAll('#settings-tab .accent-swatch'),
        mobileAccentPickerBtn: document.getElementById('mobile-accent-picker-btn'),
        accentPickerModal: document.getElementById('accent-picker-modal'),
        mobileAccentSwatches: document.querySelectorAll('.mobile-accent-swatch'),
        closeAccentPickerBtn: document.getElementById('close-accent-picker-btn'),
        globalPricingModal: document.getElementById('global-pricing-modal'),
        closeGlobalPricingModalBtn: document.getElementById('close-global-pricing-modal-btn'),
        globalPricingCurrencySelect: document.getElementById('global-pricing-currency-select'),
        globalPricingGridBody: document.getElementById('global-pricing-grid-body'),
        globalPricingCustomHeader: document.getElementById('global-pricing-custom-header'),
        saveGlobalPricingBtn: document.getElementById('save-global-pricing-btn'),
        resetGlobalPricingBtn: document.getElementById('reset-global-pricing-btn'),
        cancelGlobalPricingBtn: document.getElementById('cancel-global-pricing-btn'),
        deleteModal: document.getElementById('delete-player-modal'),
        deleteTagContainer: document.getElementById('delete-tag-container'),
        deleteTokenContainer: document.getElementById('delete-token-container'),
        deleteTagInput: document.getElementById('delete-player-tag-input'),
        deleteTokenInput: document.getElementById('delete-player-token-input'),
        deleteTagError: document.getElementById('delete-player-tag-error'),
        deleteTokenError: document.getElementById('delete-player-token-error'),
        deleteModalActionsValidate: document.getElementById('delete-modal-actions-validate'),
        deleteModalActionsVerify: document.getElementById('delete-modal-actions-verify'),
        cancelDeletePlayerBtn: document.getElementById('cancel-delete-player-btn'),
        validateDeletePlayerBtn: document.getElementById('validate-delete-player-btn'),
        closeDeletePlayerModalBtn: document.getElementById('close-delete-player-modal-btn'),
        cancelDeleteVerifyBtn: document.getElementById('cancel-delete-verify-btn'),
        verifyDeletePlayerBtn: document.getElementById('verify-delete-player-btn')
    };
}
