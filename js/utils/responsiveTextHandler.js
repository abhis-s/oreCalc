import { translate } from '../i18n/translator.js';

const storageTitle = document.getElementById('storage-title-text');
const resultsTitle = document.getElementById('results-title-text');
const homeRequiredOresTitle = document.getElementById('home-required-ores-title');
const homeRemainingTimeTitle = document.getElementById('home-remaining-time-title');

const mediaQuery = window.matchMedia('(max-width: 399px)');

export function updateResponsiveText() {
    if (mediaQuery.matches) {
        // set data-i18n attributes to short versions
        if (storageTitle) storageTitle.setAttribute('data-i18n', 'stored_short');
        if (resultsTitle) resultsTitle.setAttribute('data-i18n', 'required_short');
        if (storageTitle) storageTitle.textContent = translate('stored_short');
        if (resultsTitle) resultsTitle.textContent = translate('required_short');
        if (homeRequiredOresTitle) homeRequiredOresTitle.setAttribute('data-i18n', 'ores_short');
        if (homeRemainingTimeTitle) homeRemainingTimeTitle.setAttribute('data-i18n', 'time_short');
        if (homeRequiredOresTitle) homeRequiredOresTitle.textContent = translate('ores_short');
        if (homeRemainingTimeTitle) homeRemainingTimeTitle.textContent = translate('time_short');
    } else {
        // set data-i18n attributes to full versions
        if (resultsTitle) resultsTitle.setAttribute('data-i18n', 'required_ores');
        if (storageTitle) storageTitle.setAttribute('data-i18n', 'stored_ores');
        if (resultsTitle) resultsTitle.textContent = translate('required_ores');
        if (storageTitle) storageTitle.textContent = translate('stored_ores');
        if (homeRequiredOresTitle) homeRequiredOresTitle.setAttribute('data-i18n', 'required_ores');
        if (homeRemainingTimeTitle) homeRemainingTimeTitle.setAttribute('data-i18n', 'remaining_time');
        if (homeRequiredOresTitle) homeRequiredOresTitle.textContent = translate('required_ores');
        if (homeRemainingTimeTitle) homeRemainingTimeTitle.textContent = translate('remaining_time');
    }
}

function handleMediaQueryChange(event) {
    updateResponsiveText();
}

// Initial run
updateResponsiveText();

// Listen for media query changes
mediaQuery.addEventListener('change', handleMediaQueryChange);

// Listen for language changes
document.addEventListener('languageChanged', updateResponsiveText);