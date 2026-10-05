import { translate } from '../../i18n/translator.js';
import { calculateRemainingTime } from '../../core/timeCalculator.js';
import { formatNumber } from '../../utils/numberFormatter.js';

/**
 * Formats remaining time object into shorthand string (e.g. 1y 2m 3d).
 *
 * @param {any} timeObj - Remaining time calculation object.
 * @returns {string} Formatted duration string.
 */
function formatRemainingTime(timeObj) {
    if (!timeObj) return '';
    if (timeObj.status === 'DONE' || (timeObj.years === 0 && timeObj.months === 0 && timeObj.days === 0)) {
        return translate('time.done');
    }
    if (timeObj.date === 'N/A' || timeObj.years === null) {
        return translate('time.notAvailable');
    }
    const y = translate('time.yearsSuffix');
    const mo = translate('time.monthsSuffix');
    const d = translate('time.daysSuffix');
    const parts = [];
    if (timeObj.years > 0) parts.push(`${timeObj.years}${y}`);
    if (timeObj.months > 0) parts.push(`${timeObj.months}${mo}`);
    if (timeObj.days > 0 || parts.length === 0) parts.push(`${timeObj.days}${d}`);
    return parts.join(' ');
}

/**
 * Builds the sub-row data (remaining counts + times) for all three ore types.
 *
 * @param {any} progress - Calculated progress metrics.
 * @param {import('../../core/types.js').AppState} state - Current global application state.
 * @returns {Record<string, any>} Sub-row data by ore type.
 */
export function buildSubData(progress, state) {
    const monthlyIncome = state.derived?.totalMonthlyIncome || { shiny: 0, glowy: 0, starry: 0 };
    const shinyRemaining = progress.shinyTotal - progress.shinySpent;
    const glowyRemaining = progress.glowyTotal - progress.glowySpent;
    const starryRemaining = progress.starryTotal - progress.starrySpent;

    const rawTime = calculateRemainingTime(
        { shiny: shinyRemaining, glowy: glowyRemaining, starry: starryRemaining },
        monthlyIncome
    );

    const col = translate('views.home.profile.remainingColon');

    return {
        shiny: { spent: progress.shinySpent, total: progress.shinyTotal, remaining: shinyRemaining, time: formatRemainingTime(rawTime?.shiny), col },
        glowy: { spent: progress.glowySpent, total: progress.glowyTotal, remaining: glowyRemaining, time: formatRemainingTime(rawTime?.glowy), col },
        starry: { spent: progress.starrySpent, total: progress.starryTotal, remaining: starryRemaining, time: formatRemainingTime(rawTime?.starry), col }
    };
}

/**
 * Renders the bottom sub-row HTML for one ore type (either maxed label or two-line remaining).
 *
 * @param {string} key - Ore type key.
 * @param {number} pct - Progress percentage.
 * @param {Record<string, any>} subData - Calculated sub-data.
 * @returns {string} HTML markup.
 */
export function subtextHTML(key, pct, subData) {
    if (pct >= 100) {
        return `<div class="stat-box-maxed" data-i18n="views.home.profile.maxed"><orecalc-assets-svg name="check-simple" height="14" width="14"></orecalc-assets-svg> ${translate('views.home.profile.maxed')}</div>`;
    }
    const { spent, total, remaining, time, col } = subData[key];
    return `<div class="stat-box-sub">
        <div>${formatNumber(spent)} / ${formatNumber(total)}</div>
        <div><span data-i18n="views.home.profile.remainingColon">${col}</span> ${formatNumber(remaining)} | ${time}</div>
    </div>`;
}
