import { state } from '../../core/state.js';
import { supercellEventsData } from '../../data/appData.js';
import { dom } from '../../dom/domElements.js';

import { getSupercellEventsForYear } from '../../utils/dateUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { toCamelCase } from '../../utils/stringUtils.js';

import { translate } from '../../i18n/translator.js';

export function renderSupercellEventsDisplay(supercellEventsIncome, timeframe) {
    const supercellEventsElements = dom.income.supercellEvents.display;

    if (!supercellEventsElements) return;

    const timeframeIncome = supercellEventsIncome[timeframe] || {};

    if (supercellEventsElements.perEvent?.shiny) supercellEventsElements.perEvent.shiny.textContent = formatNumber(Math.round(supercellEventsIncome.perEvent?.shiny || 0));
    if (supercellEventsElements.perEvent?.glowy) supercellEventsElements.perEvent.glowy.textContent = formatNumber(Math.round(supercellEventsIncome.perEvent?.glowy || 0));
    if (supercellEventsElements.perEvent?.starry) supercellEventsElements.perEvent.starry.textContent = formatNumber(Math.round(supercellEventsIncome.perEvent?.starry || 0));

    if (supercellEventsElements.monthly?.shiny) supercellEventsElements.monthly.shiny.textContent = formatNumber(Math.round(supercellEventsIncome.monthly?.shiny || 0));
    if (supercellEventsElements.monthly?.glowy) supercellEventsElements.monthly.glowy.textContent = formatNumber(Math.round(supercellEventsIncome.monthly?.glowy || 0));
    if (supercellEventsElements.monthly?.starry) supercellEventsElements.monthly.starry.textContent = formatNumber(Math.round(supercellEventsIncome.monthly?.starry || 0));

    renderSupercellEvents();
}

function renderSupercellEvents() {
    const container = document.getElementById('supercell-events-container');
    if (!container) return;

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const events = getSupercellEventsForYear(currentYear, supercellEventsData);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // 1. Check if schedule is empty
    if (events.length === 0) {
        container.innerHTML = `
            <div class="notice">
                <p>${translate('income.supercellEvents.noSchedule')}</p>
            </div>
        `;
        return;
    }

    // 2. Check if all events for the year have ended
    const latestEndDate = events.reduce((max, event) => {
        const end = new Date(event.end);
        return end > max ? end : max;
    }, new Date(0));

    if (latestEndDate < now) {
        container.innerHTML = `
            <div class="notice">
                <p>${translate('income.supercellEvents.concluded')}</p>
            </div>
        `;
        return;
    }

    let html = `
        <table class="supercell-events-table">
            <thead>
                <tr>
                    <th>${translate('income.supercellEvents.tableEvent')}</th>
                    <th>${translate('income.supercellEvents.tableDates')}</th>
                </tr>
            </thead>
            <tbody>
    `;

    events.forEach(event => {
        const startDate = new Date(event.start);
        const endDate = new Date(event.end);
        const isDimmed = endDate < now;
        const isCurrentMonth = startDate.getUTCMonth() === now.getUTCMonth() && startDate.getUTCFullYear() === now.getUTCFullYear();
        const isLive = now >= startDate && now <= endDate;
        
        let rowClasses = [];
        if (isDimmed) rowClasses.push('dimmed');
        if (isCurrentMonth) {
            rowClasses.push('highlighted');
            if (event.name === 'World Finals') {
                rowClasses.push('golden');
            }
        }

        const classAttr = rowClasses.length > 0 ? `class="${rowClasses.join(' ')}"` : '';

        let watchLiveHtml = '';
        if (isLive) {
            let lang = state.uiSettings.language === 'de' ? 'de' : 'en';
            const url = `https://event.supercell.com/clashofclans/${lang}/`;
            watchLiveHtml = `<a href="${url}" target="_blank" class="watch-live-btn">${translate('income.supercellEvents.live')}</a>`;
        }

        let translatedEventName = (() => { 
            const key = toCamelCase(event.name);
            return translate('income.supercellEvents.' + (key === 'lastChanceQualifier' ? 'lcq' : key)); 
        })();
        let eventNameHtml = translatedEventName;
        if (event.name === 'World Finals') {
            eventNameHtml = `<span class="world-finals-wrapper"><orecalc-assets-image src="assets/crown.png" alt="${translate('alts.crown')}" class="world-finals-crown"></orecalc-assets-image>${translatedEventName}</span>`;
        }

        let labelHtml = event.label;
        const diffTime = startDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0 && diffDays <= 7) {
            labelHtml = `<span class="countdown-text">${translate('income.supercellEvents.inDays', { days: diffDays })}</span> ${event.label}`;
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
        <div class="notice">
            <p>${translate('income.supercellEvents.bonusesUnknown')}</p>
        </div>
    `;

    container.innerHTML = html;
}

export function renderSupercellEventsHomeDisplay(supercellEventsIncome, timeframe) {
    const homeElements = dom.income.home.incomeCard.table.supercellEvents;

    if (!homeElements) return;

    const timeframeIncome = supercellEventsIncome[timeframe] || {};

    if (homeElements.shiny) {
        homeElements.shiny.textContent = formatNumber(Math.round(timeframeIncome.shiny || 0));
    }
    if (homeElements.glowy) {
        homeElements.glowy.textContent = formatNumber(Math.round(timeframeIncome.glowy || 0));
    }
    if (homeElements.starry) {
        homeElements.starry.textContent = formatNumber(Math.round(timeframeIncome.starry || 0));
    }

}
