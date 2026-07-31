import { translate } from '../i18n/translator.js';

/**
 * Dynamically adapts card titles based on container overflow:
 * 1. Default to Full Title text (Icon is always preserved).
 * 2. If title text overflows container width, switch text to Short Title version.
 */
function adaptTitle(titleEl, fullKey, shortKey) {
    if (!titleEl) return;
    const headerContainer = titleEl.closest('h2, .income-header, .card-header, .income-summary-title') || titleEl.parentElement;
    if (!headerContainer) return;

    // 1. Set Full Title text
    titleEl.setAttribute('data-i18n', fullKey);
    titleEl.textContent = translate(fullKey);

    // 2. If full title overflows container width, switch to Short Title text
    if (headerContainer.scrollWidth > headerContainer.clientWidth + 1) {
        titleEl.setAttribute('data-i18n', shortKey);
        titleEl.textContent = translate(shortKey);
    }
}

export function updateResponsiveText() {
    const storageTitle = document.getElementById('storage-title-text');
    const resultsTitle = document.getElementById('results-title-text');
    const homeRequiredOresTitle = document.getElementById('home-required-ores-title');
    const homeRemainingTimeTitle = document.getElementById('home-remaining-time-title');
    const incomeSummaryTitle = document.querySelector('.income-summary-title');

    adaptTitle(resultsTitle, 'ores.requiredTitle', 'ores.requiredShort');
    adaptTitle(storageTitle, 'ores.storedTitle', 'ores.storedShort');
    adaptTitle(homeRequiredOresTitle, 'ores.requiredTitle', 'ores.short');
    adaptTitle(homeRemainingTimeTitle, 'time.remainingTitle', 'time.short');
    adaptTitle(incomeSummaryTitle, 'income.summaryTitle', 'income.summaryTitleShort');
}

// Observe container/window resize automatically
if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
        window.requestAnimationFrame(updateResponsiveText);
    });
    observer.observe(document.body);
}

// Listen for language changes
document.addEventListener('languageChanged', updateResponsiveText);
