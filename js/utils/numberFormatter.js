import { state } from '../core/state.js';

const locales = {
    en: 'en-US',
    de: 'de-DE'
};

export function formatNumber(number) {
    const language = state.uiSettings?.language || 'en';
    const locale = locales[language] || 'en-US';
    return new Intl.NumberFormat(locale).format(number);
}

export function formatCurrency(number) {
    const language = state.uiSettings?.language || 'en';
    const locale = locales[language] || 'en-US';
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
}

export function animateValue(element, start, end, duration = 750, formatFn = val => val) {
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

export function formatFloat(number, decimals, integerDigits = 1) {
    const language = state.uiSettings?.language || 'en';
    const locale = locales[language] || 'en-US';
    const clampedDecimals = Math.min(5, Math.max(0, decimals));
    const clampedIntegers = Math.min(5, Math.max(1, integerDigits));
    return new Intl.NumberFormat(locale, { 
        minimumIntegerDigits: clampedIntegers,
        minimumFractionDigits: clampedDecimals, 
        maximumFractionDigits: clampedDecimals 
    }).format(number);
}

export function updateCalculatedValue(element, targetValue, decimalPlaces = 0, integerDigits = 1, duration = 500) {
    if (!element) return;
    
    if (decimalPlaces > 0 || integerDigits > 1) {
        const decimals = Math.min(5, decimalPlaces);
        const integers = Math.min(5, integerDigits);
        const cleanText = element.textContent.replace(/[^0-9.,-]/g, '').replace(',', '.');
        const prevVal = parseFloat(cleanText) || 0;
        const endVal = targetValue || 0;
        
        if (element.textContent && Math.abs(prevVal - endVal) > 0.0001) {
            animateValue(element, prevVal, endVal, duration, val => formatFloat(val, decimals, integers));
        } else {
            element.textContent = formatFloat(endVal, decimals, integers);
        }
    } else {
        const cleanText = element.textContent.replace(/[^0-9-]/g, '');
        const prevVal = parseInt(cleanText, 10) || 0;
        const endVal = Math.round(targetValue);
        
        if (element.textContent && prevVal !== endVal) {
            animateValue(element, prevVal, endVal, duration, val => formatNumber(Math.round(val)));
        } else {
            element.textContent = formatNumber(endVal);
        }
    }
}
