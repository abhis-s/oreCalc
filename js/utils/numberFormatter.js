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
