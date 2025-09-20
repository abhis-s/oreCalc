import { translate } from '../i18n/translator.js';

export function initializeResponsiveTextHandler() {
    const storageTitle = document.getElementById('storage-title-text');
    const resultsTitle = document.getElementById('results-title-text');
    const homeRequiredOresTitle = document.getElementById('home-required-ores-title');
    const homeRemainingTimeTitle = document.getElementById('home-remaining-time-title');

    const mediaQuery = window.matchMedia('(max-width: 399px)');

    function handleMediaQueryChange(event) {
        if (event.matches) {
            if (storageTitle) storageTitle.textContent = translate('stored_short');
            if (resultsTitle) resultsTitle.textContent = translate('required_short');
            if (homeRequiredOresTitle) homeRequiredOresTitle.textContent = translate('ores_short');
            if (homeRemainingTimeTitle) homeRemainingTimeTitle.textContent = translate('time_short');
        } else {
            if (resultsTitle) resultsTitle.textContent = translate('required_ores');
            if (storageTitle) storageTitle.textContent = translate('stored_ores');
            if (homeRequiredOresTitle) homeRequiredOresTitle.textContent = translate('required_ores');
            if (homeRemainingTimeTitle) homeRemainingTimeTitle.textContent = translate('remaining_time');
        }
    }

    handleMediaQueryChange(mediaQuery);

    mediaQuery.addEventListener('change', handleMediaQueryChange);
}