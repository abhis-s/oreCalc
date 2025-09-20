import { state } from '../core/state.js';

const locales = {
    en: 'en-US',
    de: 'de-DE'
};

export function formatDate(date, options) {
    const language = state.uiSettings?.language || 'en';
    const locale = locales[language] || 'en-US';
    return new Intl.DateTimeFormat(locale, options).format(date);
}

export function getShortDayNames() {
    const language = state.uiSettings?.language || 'en';
    const locale = locales[language] || 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(2000, 0, i + 2); // Use a fixed date to get day names (Jan 2, 2000 was a Sunday)
        days.push(formatter.format(date));
    }
    return days;
}
