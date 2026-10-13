import { supercellEventsData } from '../../data/incomeSources/supercellEvents.js';
import { getSupercellEventUrl } from '../../data/languagesData.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { getSupercellEventsForYear, isEventPlaceholder, isSupercellEventLive } from '../../domain/income/supercellEventsSchedule.js';
import { updateCalculatedValue } from '../../utils/numberFormatter.js';
import { toCamelCase } from '../../utils/stringUtils.js';

import { dom } from '../../dom/domElements.js';

let countdownInterval = null;

/**
 * Stops and clears any active sub-day countdown interval.
 */
function stopCountdownTimer() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

/**
 * Formats a duration in milliseconds into zero-padded HH:MM:SS format.
 * @param {number} durationMs - Duration in milliseconds.
 * @returns {string} Formatted HH:MM:SS time string.
 */
function formatCountdownHms(durationMs) {
    const totalSecs = Math.max(0, Math.floor(durationMs / 1000));
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

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
export function renderSupercellEvents(referenceDate) {
    stopCountdownTimer();

    const container = document.getElementById('supercell-events-container');
    if (!container) return;

    const isRealTime = !referenceDate;
    const now = referenceDate || new Date();
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
            eventNameHtml = `<span class="world-finals-wrapper"><clashcalc-assets-image src="assets/crown.png" alt="${translate('app.alts.crown')}" class="world-finals-crown"></clashcalc-assets-image>${translatedEventName}</span>`;
        }

        let labelHtml = event.label || 'TBD';
        if (isValidDates && startDate && !isPlaceholder) {
            const diffTime = startDate.getTime() - now.getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            const sevenDaysMs = 7 * oneDayMs;

            if (diffTime > 0 && diffTime <= sevenDaysMs) {
                if (diffTime < oneDayMs) {
                    const hms = formatCountdownHms(diffTime);
                    labelHtml = `<span class="countdown-text" data-countdown-target="${startDate.getTime()}">${hms}</span> ${event.label}`;
                } else {
                    const diffDays = Math.ceil(diffTime / oneDayMs);
                    labelHtml = `<span class="countdown-text">${translate('views.income.supercellEvents.inDays', { days: diffDays })}</span> ${event.label}`;
                }
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

    if (isRealTime && typeof container.querySelectorAll === 'function') {
        const targetElements = container.querySelectorAll('[data-countdown-target]');
        if (targetElements.length > 0 && typeof window !== 'undefined' && typeof setInterval === 'function') {
            countdownInterval = setInterval(() => {
                if (typeof document !== 'undefined' && document.body && !document.body.contains(container)) {
                    stopCountdownTimer();
                    return;
                }
                const incomeTab = document.getElementById('income-tab');
                if (incomeTab && !incomeTab.classList.contains('active')) {
                    stopCountdownTimer();
                    return;
                }
                const currentTime = Date.now();
                let hasActiveTarget = false;
                targetElements.forEach(el => {
                    const targetMs = parseInt(el.getAttribute('data-countdown-target') || '0', 10);
                    const remainingMs = targetMs - currentTime;
                    if (remainingMs > 0) {
                        hasActiveTarget = true;
                        el.textContent = formatCountdownHms(remainingMs);
                    } else {
                        stopCountdownTimer();
                        renderSupercellEvents();
                    }
                });
                if (!hasActiveTarget) {
                    stopCountdownTimer();
                }
            }, 1000);
        }
    }
}
