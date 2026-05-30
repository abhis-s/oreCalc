import { translate } from '../i18n/translator.js';

const storageTitle = document.getElementById('storage-title-text');
const resultsTitle = document.getElementById('results-title-text');
const homeRequiredOresTitle = document.getElementById('home-required-ores-title');
const homeRemainingTimeTitle = document.getElementById('home-remaining-time-title');
const incomeSummaryTitle = document.querySelector('.income-summary-title');

const mediaQuery = window.matchMedia('(max-width: 779px)');

export function updateResponsiveText() {
    if (mediaQuery.matches) {
        // set data-i18n attributes to short versions
        if (storageTitle) storageTitle.setAttribute('data-i18n', 'ores.storedShort');
        if (resultsTitle) resultsTitle.setAttribute('data-i18n', 'ores.requiredShort');
        if (storageTitle) storageTitle.textContent = translate('ores.storedShort');
        if (resultsTitle) resultsTitle.textContent = translate('ores.requiredShort');
        if (homeRequiredOresTitle) homeRequiredOresTitle.setAttribute('data-i18n', 'ores.short');
        if (homeRemainingTimeTitle) homeRemainingTimeTitle.setAttribute('data-i18n', 'time.short');
        if (homeRequiredOresTitle) homeRequiredOresTitle.textContent = translate('ores.short');
        if (homeRemainingTimeTitle) homeRemainingTimeTitle.textContent = translate('time.short');
        if (incomeSummaryTitle) {
            incomeSummaryTitle.setAttribute('data-i18n', 'income.summaryTitleShort');
            incomeSummaryTitle.textContent = translate('income.summaryTitleShort');
        }
    } else {
        // set data-i18n attributes to full versions
        if (resultsTitle) resultsTitle.setAttribute('data-i18n', 'ores.requiredTitle');
        if (storageTitle) storageTitle.setAttribute('data-i18n', 'ores.storedTitle');
        if (resultsTitle) resultsTitle.textContent = translate('ores.requiredTitle');
        if (storageTitle) storageTitle.textContent = translate('ores.storedTitle');
        if (homeRequiredOresTitle) homeRequiredOresTitle.setAttribute('data-i18n', 'ores.requiredTitle');
        if (homeRemainingTimeTitle) homeRemainingTimeTitle.setAttribute('data-i18n', 'time.remainingTitle');
        if (homeRequiredOresTitle) homeRequiredOresTitle.textContent = translate('ores.requiredTitle');
        if (homeRemainingTimeTitle) homeRemainingTimeTitle.textContent = translate('time.remainingTitle');
        if (incomeSummaryTitle) {
            incomeSummaryTitle.setAttribute('data-i18n', 'income.summaryTitle');
            incomeSummaryTitle.textContent = translate('income.summaryTitle');
        }
    }
}

function handleMediaQueryChange(event) {
    updateResponsiveText();
}

// Listen for media query changes
mediaQuery.addEventListener('change', handleMediaQueryChange);

// Listen for language changes
document.addEventListener('languageChanged', updateResponsiveText);
