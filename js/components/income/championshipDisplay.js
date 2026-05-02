import { dom } from '../../dom/domElements.js';
import { state } from '../../core/state.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { championshipData } from '../../data/appData.js';
import { getChampionshipEventsForYear } from '../../utils/dateUtils.js';

export function renderChampionshipDisplay(championshipIncome, timeframe) {
    const championshipElements = dom.income.championship.display;

    if (!championshipElements) return;

    const timeframeIncome = championshipIncome[timeframe] || {};

    if (championshipElements.perEvent?.shiny) championshipElements.perEvent.shiny.textContent = formatNumber(Math.round(championshipIncome.perEvent?.shiny || 0));
    if (championshipElements.perEvent?.glowy) championshipElements.perEvent.glowy.textContent = formatNumber(Math.round(championshipIncome.perEvent?.glowy || 0));
    if (championshipElements.perEvent?.starry) championshipElements.perEvent.starry.textContent = formatNumber(Math.round(championshipIncome.perEvent?.starry || 0));

    if (championshipElements.monthly?.shiny) championshipElements.monthly.shiny.textContent = formatNumber(Math.round(championshipIncome.monthly?.shiny || 0));
    if (championshipElements.monthly?.glowy) championshipElements.monthly.glowy.textContent = formatNumber(Math.round(championshipIncome.monthly?.glowy || 0));
    if (championshipElements.monthly?.starry) championshipElements.monthly.starry.textContent = formatNumber(Math.round(championshipIncome.monthly?.starry || 0));

    renderChampionshipEvents();
}

function renderChampionshipEvents() {
    const container = document.getElementById('championship-events-container');
    if (!container) return;

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const events = getChampionshipEventsForYear(currentYear, championshipData);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // 1. Check if schedule is empty
    if (events.length === 0) {
        container.innerHTML = `
            <div class="notice">
                <p>The Championship schedule for this year hasn't been officially announced yet. Check back later!</p>
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
                <p>This year's Championship season has concluded. See you next year!</p>
            </div>
        `;
        return;
    }

    let html = `
        <table class="championship-events-table">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>DATES</th>
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
            watchLiveHtml = `<a href="${url}" target="_blank" class="watch-live-btn">🔴 LIVE</a>`;
        }

        let eventNameHtml = event.name;
        if (event.name === 'World Finals') {
            eventNameHtml = `<span class="world-finals-wrapper"><img src="assets/crown.png" alt="Crown" class="world-finals-crown">${event.name}</span>`;
        }

        let labelHtml = event.label;
        const diffTime = startDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0 && diffDays <= 7) {
            labelHtml = `<span class="countdown-text">(In ${diffDays} day${diffDays > 1 ? 's' : ''})</span> ${event.label}`;
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
            <p>Resource bonuses during events are currently unknown.</p>
        </div>
    `;

    container.innerHTML = html;
}

export function renderChampionshipHomeDisplay(championshipIncome, timeframe) {
    const homeElements = dom.income.home.incomeCard.table.championship;

    if (!homeElements) return;

    const timeframeIncome = championshipIncome[timeframe] || {};

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
