import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { formatDate } from '../../utils/dateUtils.js';

import { dom } from '../../dom/domElements.js';

/**
 * Renders estimated completion time and target dates across ore types in Home tab results.
 *
 * @param {Record<string, any>} remainingTime
 */
export function renderRemainingTime(remainingTime) {
    const timeElements = dom.income?.home?.results?.time;
    const dateElements = dom.income?.home?.results?.date;

    const now = new Date();
    const currentYear = now.getFullYear();

    const updatePartVisibility = (elements, val, shouldShow, isSpecial = false, specialText = '') => {
        if (!elements) return;

        const targetText = isSpecial ? specialText : String(val);
        const targetDisplay = (isSpecial || shouldShow) ? 'inline' : 'none';

        if (elements.textContent !== targetText) {
            elements.textContent = targetText;
        }
        if (elements.style.display !== targetDisplay) {
            elements.style.display = targetDisplay;
        }

        const suffix = /** @type {HTMLElement | null} */ (elements.nextElementSibling);
        if (suffix) {
            const suffixDisplay = (shouldShow && !isSpecial) ? 'inline' : 'none';
            if (suffix.style.display !== suffixDisplay) {
                suffix.style.display = suffixDisplay;
            }
        }
    };

    if (timeElements && dateElements) {
        Object.keys(timeElements).forEach(oreType => {
            const el = timeElements[oreType];
            const data = remainingTime[oreType];

            const isDone = data && data.status === 'DONE';
            const isNA = data && data.years === null;

            if (isDone) {
                updatePartVisibility(el.years, 0, false);
                updatePartVisibility(el.months, 0, false);
                updatePartVisibility(el.days, 0, true, true, translate('time.done'));
                if (dateElements[oreType] && dateElements[oreType].textContent !== '') dateElements[oreType].textContent = '';
            } else if (isNA) {
                updatePartVisibility(el.years, 0, false);
                updatePartVisibility(el.months, 0, false);
                updatePartVisibility(el.days, 0, true, true, translate('time.notAvailable'));
                if (dateElements[oreType] && dateElements[oreType].textContent !== '') dateElements[oreType].textContent = '';
            } else if (data) {
                const years = data.years;
                const months = data.months;
                const days = data.days;

                const showYears = years > 0;
                const showMonths = showYears || months > 0;

                updatePartVisibility(el.years, years, showYears);
                updatePartVisibility(el.months, months, showMonths);
                updatePartVisibility(el.days, days, true);

                if (dateElements[oreType] && data.date instanceof Date) {
                    const isCurrentYear = data.date.getFullYear() === currentYear;
                    /** @type {Intl.DateTimeFormatOptions} */
                    const options = {
                        day: '2-digit',
                        month: 'short',
                        year: isCurrentYear ? undefined : '2-digit'
                    };
                    const locale = state.uiSettings?.language || 'en';
                    const formatted = formatDate(data.date, options, locale);
                    if (dateElements[oreType].textContent !== formatted) {
                        dateElements[oreType].textContent = formatted;
                    }
                }
            }
        });
    }
}
