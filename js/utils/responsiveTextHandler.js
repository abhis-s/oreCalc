import { translate } from '../i18n/translator.js';

const RESPONSIVE_TITLE_CONFIGS = [
    { id: 'results-title-text', containerSelector: 'h2', fullKey: 'views.income.ores.requiredTitle', shortKey: 'views.income.ores.requiredShort' },
    { id: 'storage-title-text', containerSelector: 'h2', fullKey: 'views.income.ores.storedTitle', shortKey: 'views.income.ores.storedShort' },
    { id: 'home-required-ores-title', containerSelector: 'h2', fullKey: 'views.income.ores.requiredTitle', shortKey: 'views.income.ores.short' },
    { id: 'home-remaining-time-title', containerSelector: 'h2', fullKey: 'time.remainingTitle', shortKey: 'time.short' },
    { selector: '.income-summary-title', containerSelector: '.income-header', fullKey: 'views.income.summaryTitle', shortKey: 'views.income.summaryTitleShort' }
];

let isUpdatePending = false;

/**
 * Dynamically adapts card titles based on container overflow using batched Read/Write phases:
 * Phase 1 (Batch Write): Reset all elements to full title text.
 * Phase 2 (Batch Read): Query container dimensions in a single pass without intervening style writes.
 * Phase 3 (Batch Write): Apply short titles only to overflowing containers.
 */
export function updateResponsiveText() {
    isUpdatePending = false;

    // Resolve elements and their parent containers
    const items = [];
    for (const config of RESPONSIVE_TITLE_CONFIGS) {
        const el = config.id ? document.getElementById(config.id) : document.querySelector(config.selector);
        if (!el) continue;
        const container = config.containerSelector
            ? (el.matches(config.containerSelector) ? el.parentElement?.closest(config.containerSelector) || el.parentElement : el.closest(config.containerSelector))
            : (el.parentElement?.closest('h2, .income-header, .card-header') || el.parentElement);
        if (!container) continue;

        items.push({ el, container, fullKey: config.fullKey, shortKey: config.shortKey });
    }

    if (items.length === 0) return;

    // Reset to canonical full titles
    for (const item of items) {
        item.el.setAttribute('data-i18n', item.fullKey);
        item.el.textContent = translate(item.fullKey);
    }

    // Measure container overflow
    for (const item of items) {
        item.isOverflowing = item.container.scrollWidth > item.container.clientWidth + 1;
    }

    // Apply short titles to overflowing elements
    for (const item of items) {
        if (item.isOverflowing) {
            item.el.setAttribute('data-i18n', item.shortKey);
            item.el.textContent = translate(item.shortKey);
        }
    }
}

/**
 * Coalesces multiple layout adjustment requests into a single requestAnimationFrame tick.
 */
export function requestResponsiveTextUpdate() {
    if (!isUpdatePending) {
        isUpdatePending = true;
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(updateResponsiveText);
        } else {
            updateResponsiveText();
        }
    }
}

// Observe container/window resize automatically
if (typeof ResizeObserver !== 'undefined' && typeof document !== 'undefined' && document.body) {
    const observer = new ResizeObserver(() => {
        requestResponsiveTextUpdate();
    });
    observer.observe(document.body);
}

// Listen for window resize as a robust fallback
if (typeof window !== 'undefined') {
    window.addEventListener('resize', requestResponsiveTextUpdate, { passive: true });
}

// Listen for language changes
if (typeof document !== 'undefined') {
    document.addEventListener('languageChanged', requestResponsiveTextUpdate);
}
