import { supercellEventsData } from '../../data/incomeSources/supercellEvents.js';
import { getSupercellEventUrl } from '../../data/languagesData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { getSupercellEventsForYear, isEventPlaceholder, isSupercellEventLive } from '../../domain/income/supercellEventsSchedule.js';
import { updateCalculatedValue } from '../../utils/numberFormatter.js';
import { toCamelCase } from '../../utils/stringUtils.js';

import { dom } from '../../dom/domElements.js';

/**
 * Renders calculated Supercell Events ore income display and scheduled tournament list.
 * @param {import('../../core/types.js').IncomeResult} supercellEventsIncome - Calculated Supercell Events income results.
 * @param {string} [timeframe] - Active timeframe context.
 */
export function renderSupercellEventsDisplay(supercellEventsIncome, timeframe) {
    const supercellEventsElements = dom.income.supercellEvents.display;

    if (!supercellEventsElements) return;

    updateCalculatedValue(supercellEventsElements.perEvent?.shiny, supercellEventsIncome.perEvent?.shiny || 0);
    updateCalculatedValue(supercellEventsElements.perEvent?.glowy, supercellEventsIncome.perEvent?.glowy || 0);
    updateCalculatedValue(supercellEventsElements.perEvent?.starry, supercellEventsIncome.perEvent?.starry || 0);

    updateCalculatedValue(supercellEventsElements.monthly?.shiny, supercellEventsIncome.monthly?.shiny || 0);
    updateCalculatedValue(supercellEventsElements.monthly?.glowy, supercellEventsIncome.monthly?.glowy || 0);
    updateCalculatedValue(supercellEventsElements.monthly?.starry, supercellEventsIncome.monthly?.starry || 0);

    renderSupercellEvents();
}

/**
 * Renders the tournament schedule table into the supercell-events-container element.
 * @param {Date} [referenceDate] - Optional reference date for time evaluation. Defaults to current date.
 */
export function renderSupercellEvents(referenceDate = new Date()) {
    const container = document.getElementById('supercell-events-container');
    if (!container) return;

    const now = referenceDate;
    const currentYear = now.getUTCFullYear();
    const currentLang = state.uiSettings?.language || 'en';
    const events = getSupercellEventsForYear(currentYear, supercellEventsData, currentLang);

    if (events.length === 0) {
        container.innerHTML = `
            <div class="notice">
                <p>${translate('views.income.supercellEvents.noSchedule')}</p>
            </div>
        `;
        return;
    }

    const latestEndDate = events.reduce((max, event) => {
        const end = new Date(event.end);
        return end > max ? end : max;
    }, new Date(0));

    if (latestEndDate < now) {
        container.innerHTML = `
            <div class="notice">
                <p>${translate('views.income.supercellEvents.concluded')}</p>
            </div>
        `;
        return;
    }

    let html = `
        <table class="supercell-events-table">
            <thead>
                <tr>
                    <th>${translate('views.income.supercellEvents.tableEvent')}</th>
                    <th>${translate('views.income.supercellEvents.tableDates')}</th>
                </tr>
            </thead>
            <tbody>
    `;

    events.forEach(event => {
        const isPlaceholder = isEventPlaceholder(event);
        const hasDates = Boolean(event.start && event.end);
        const startDate = hasDates ? new Date(event.start) : null;
        const endDate = hasDates ? new Date(event.end) : null;
        const isValidDates = Boolean(startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()));
        const isDimmed = Boolean(isValidDates && endDate && endDate < now);
        const isCurrentMonth = Boolean(isValidDates && startDate && startDate.getUTCMonth() === now.getUTCMonth() && startDate.getUTCFullYear() === now.getUTCFullYear());
        const isLive = isSupercellEventLive(event, now);

        let rowClasses = [];
        if (isDimmed) rowClasses.push('dimmed');
        if (isLive) rowClasses.push('is-live');
        if (isCurrentMonth) {
            rowClasses.push('highlighted');
            if (event.name === 'World Finals') {
                rowClasses.push('golden');
            }
        }

        const classAttr = rowClasses.length > 0 ? `class="${rowClasses.join(' ')}"` : '';

        let watchLiveHtml = '';
        if (isLive) {
            const currentLang = state.uiSettings?.language || 'en';
            const url = getSupercellEventUrl(currentLang);
            watchLiveHtml = `<a href="${url}" target="_blank" class="watch-live-btn"><span class="live-beacon-dot" aria-hidden="true"></span>${translate('views.income.supercellEvents.live')}</a>`;
        }

        let translatedEventName = (() => {
            const key = toCamelCase(event.name);
            return translate('views.income.supercellEvents.' + (key === 'lastChanceQualifier' ? 'lcq' : key));
        })();
        let eventNameHtml = translatedEventName;
        if (event.name === 'World Finals') {
            eventNameHtml = `<span class="world-finals-wrapper"><orecalc-assets-image src="assets/crown.png" alt="${translate('app.alts.crown')}" class="world-finals-crown"></orecalc-assets-image>${translatedEventName}</span>`;
        }

        let labelHtml = event.label || 'TBD';
        if (isValidDates && startDate && !isPlaceholder) {
            const diffTime = startDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 0 && diffDays <= 7) {
                labelHtml = `<span class="countdown-text">${translate('views.income.supercellEvents.inDays', { days: diffDays })}</span> ${event.label}`;
            }
        }

        html += `
            <tr ${classAttr}>
                <td>
                    ${eventNameHtml}
                    ${watchLiveHtml}
                </td>
                <td>${labelHtml}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        <!--
        <div class="notice">
            <p>${translate('views.income.supercellEvents.bonusesUnknown')}</p>
        </div>
        -->
    `;

    container.innerHTML = html;
}
