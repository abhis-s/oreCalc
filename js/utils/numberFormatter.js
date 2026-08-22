import { getLocale } from '../data/languagesData.js';
import { state } from '../core/state.js';

const numberFormatCache = new Map();

/**
 * Retrieves a cached Intl.NumberFormat instance.
 *
 * @param {string} locale - Locale code.
 * @param {Intl.NumberFormatOptions} [options] - Formatter configuration options.
 * @returns {Intl.NumberFormat} Formatter instance.
 */
function getCachedNumberFormat(locale, options) {
    const key = options ? `${locale}|${JSON.stringify(options)}` : locale;
    let formatter = numberFormatCache.get(key);
    if (!formatter) {
        formatter = new Intl.NumberFormat(locale, options);
        numberFormatCache.set(key, formatter);
    }
    return formatter;
}

/**
 * Formats an integer using current UI locale.
 *
 * @param {number} number - Number to format.
 * @returns {string} Formatted string.
 */
export function formatNumber(number) {
    const language = state.uiSettings?.language || 'en';
    const locale = getLocale(language);
    return getCachedNumberFormat(locale).format(number);
}

/**
 * Formats a monetary value with 2 decimal digits according to locale.
 *
 * @param {number} number - Currency amount.
 * @returns {string} Formatted currency string.
 */
export function formatCurrency(number) {
    const language = state.uiSettings?.language || 'en';
    const locale = getLocale(language);
    return getCachedNumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
}

/**
 * Animates a numeric transition in a DOM text element using requestAnimationFrame and quartic-out easing.
 * @param {HTMLElement | any} element - DOM element to animate.
 * @param {number} start - Starting numeric value.
 * @param {number} end - Target numeric value.
 * @param {number} [duration=750] - Animation duration in ms.
 * @param {(val: number) => string} [formatFn=val => val] - Text formatting function.
 */
export function animateValue(element, start, end, duration = 750, formatFn = val => String(val)) {
    if (!element) return;

    if (element.__animationFrameId) {
        cancelAnimationFrame(element.__animationFrameId);
    }

    const startTime = performance.now();

    function update(currentTime) {
        if (!element.isConnected) {
            cancelAnimationFrame(element.__animationFrameId);
            element.__animationFrameId = null;
            return;
        }

        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Quartic Out easing (matches cubic-bezier(0.25, 1, 0.5, 1)):
        const easeProgress = 1 - Math.pow(1 - progress, 4);

        const currentVal = start + (end - start) * easeProgress;
        element.textContent = formatFn(currentVal);

        if (progress < 1) {
            element.__animationFrameId = requestAnimationFrame(update);
        } else {
            element.__animationFrameId = null;
        }
    }

    element.__animationFrameId = requestAnimationFrame(update);
}

function formatFloat(number, decimals, integerDigits = 1) {
    const language = state.uiSettings?.language || 'en';
    const locale = getLocale(language);
    const clampedDecimals = Math.min(5, Math.max(0, decimals));
    const clampedIntegers = Math.min(5, Math.max(1, integerDigits));
    return getCachedNumberFormat(locale, {
        minimumIntegerDigits: clampedIntegers,
        minimumFractionDigits: clampedDecimals,
        maximumFractionDigits: clampedDecimals
    }).format(number);
}

/**
 * Updates a DOM element's text with smooth animation or immediate update.
 * @param {HTMLElement | any} element - DOM element to update.
 * @param {number} targetValue - Target numeric value.
 * @param {number} [decimalPlaces=0] - Decimal places for formatting.
 * @param {number} [integerDigits=1] - Minimum integer digits.
 * @param {number} [duration=500] - Animation duration in ms.
 */
export function updateCalculatedValue(element, targetValue, decimalPlaces = 0, integerDigits = 1, duration = 500) {
    if (!element) return;

    if (decimalPlaces > 0 || integerDigits > 1) {
        const decimals = Math.min(5, decimalPlaces);
        const integers = Math.min(5, integerDigits);
        const cleanText = element.textContent.replace(/[^0-9.,-]/g, '').replace(',', '.');
        const prevVal = typeof element._currentNumericValue === 'number'
            ? element._currentNumericValue
            : (parseFloat(cleanText) || 0);
        const endVal = targetValue || 0;
        element._currentNumericValue = endVal;

        if (element.textContent && Math.abs(prevVal - endVal) > 0.0001) {
            animateValue(element, prevVal, endVal, duration, val => formatFloat(val, decimals, integers));
        } else {
            element.textContent = formatFloat(endVal, decimals, integers);
        }
    } else {
        const cleanText = element.textContent.replace(/[^0-9-]/g, '');
        const prevVal = typeof element._currentNumericValue === 'number'
            ? Math.round(element._currentNumericValue)
            : (parseInt(cleanText, 10) || 0);
        const endVal = Math.round(targetValue || 0);
        element._currentNumericValue = endVal;

        if (element.textContent && prevVal !== endVal) {
            animateValue(element, prevVal, endVal, duration, val => formatNumber(Math.round(val)));
        } else {
            element.textContent = formatNumber(endVal);
        }
    }
}
