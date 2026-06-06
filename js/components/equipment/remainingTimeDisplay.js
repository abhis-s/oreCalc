import { dom } from '../../dom/domElements.js';

import { formatDate } from '../../utils/dateFormatter.js';

export function renderRemainingTime(remainingTime) {
    const timeElements = dom.income?.home?.results?.time;
    const dateElements = dom.income?.home?.results?.date;

    const now = new Date();
    const currentYear = now.getFullYear();

    const updatePartVisibility = (elements, val, shouldShow, isSpecial = false, specialText = '') => {
        if (!elements) return;

        if (isSpecial) {
            elements.textContent = specialText;
            elements.style.display = 'inline';
        } else {
            elements.textContent = val;
            elements.style.display = shouldShow ? 'inline' : 'none';
        }

        const suffix = elements.nextElementSibling;
        if (suffix) suffix.style.display = (shouldShow && !isSpecial) ? 'inline' : 'none';
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
                updatePartVisibility(el.days, 0, true, true, 'Done');
                if (dateElements[oreType]) dateElements[oreType].textContent = '';
            } else if (isNA) {
                updatePartVisibility(el.years, 0, false);
                updatePartVisibility(el.months, 0, false);
                updatePartVisibility(el.days, 0, true, true, 'N/A');
                if (dateElements[oreType]) dateElements[oreType].textContent = '';
            } else {
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
                    const options = { 
                        day: '2-digit', 
                        month: 'short',
                        year: isCurrentYear ? undefined : '2-digit'
                    };
                    dateElements[oreType].textContent = formatDate(data.date, options);
                }
            }
        });
    }
}