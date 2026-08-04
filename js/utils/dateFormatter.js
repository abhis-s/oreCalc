import { state } from '../core/state.js';
import { getLocale, getWeekStart } from '../data/languagesData.js';

export function formatDate(date, options) {
    const language = state.uiSettings?.language || 'en';
    const locale = getLocale(language);
    return new Intl.DateTimeFormat(locale, options).format(date);
}

export function getShortDayNames(startDaySetting = 'auto') {
    const language = state.uiSettings?.language || 'en';
    const locale = getLocale(language);
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });

    let effectiveStartDay = startDaySetting;
    if (effectiveStartDay === 'auto') {
        effectiveStartDay = getWeekStart(language);
    }

    let startDayIndex = 0;
    if (effectiveStartDay === 'monday') startDayIndex = 1;
    else if (effectiveStartDay === 'tuesday') startDayIndex = 2;
    else if (effectiveStartDay === 'friday') startDayIndex = 5;
    else if (effectiveStartDay === 'saturday') startDayIndex = 6;

    const days = [];
    for (let i = 0; i < 7; i++) {
        // Jan 2, 2000 was a Sunday
        const date = new Date(Date.UTC(2000, 0, 2 + startDayIndex + i));
        days.push(formatter.format(date));
    }
    return days;
}
