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

export function getShortDayNames(startDaySetting = 'auto') {
    const language = state.uiSettings?.language || 'en';
    const locale = locales[language] || 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });

    let effectiveStartDay = startDaySetting;
    if (effectiveStartDay === 'auto') {
        effectiveStartDay = language === 'de' ? 'monday' : 'sunday';
    }

    const startDayIndex = effectiveStartDay === 'monday' ? 1 : 0;
    const days = [];
    for (let i = 0; i < 7; i++) {
        // Jan 2, 2000 was a Sunday
        const date = new Date(Date.UTC(2000, 0, 2 + startDayIndex + i));
        days.push(formatter.format(date));
    }
    return days;
}
