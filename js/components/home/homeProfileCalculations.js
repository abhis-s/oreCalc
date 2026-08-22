import { getEquipmentMaxLevel, upgradeCosts } from '../../data/equipmentCommonData.js';
import { heroData } from '../../data/heroData.js';
import { translate } from '../../i18n/translator.js';

import { calculateRemainingTime } from '../../core/timeCalculator.js';

import { formatNumber } from '../../utils/numberFormatter.js';

/**
 * Calculates overall ore-cost-based progress percentage for common and epic equipment.
 *
 * @param {Record<string, number>} ownedEquipment - Map of equipment name to level.
 * @param {Record<string, any>} ownedHeroes - Map of hero name to hero profile.
 * @returns {{ overall: number, shiny: number, glowy: number, starry: number, shinySpent: number, shinyTotal: number, glowySpent: number, glowyTotal: number, starrySpent: number, starryTotal: number }} Progress stats.
 */
export function calculateEquipmentProgress(ownedEquipment, ownedHeroes) {
    let commonSpent = { shiny: 0, glowy: 0 };
    let commonTotal = { shiny: 0, glowy: 0 };
    let epicSpent = { shiny: 0, glowy: 0, starry: 0 };
    let epicTotal = { shiny: 0, glowy: 0, starry: 0 };

    for (const heroKey in heroData) {
        const heroInfo = heroData[heroKey];
        if (ownedHeroes && ownedHeroes[heroInfo.name]) {
            for (const equip of heroInfo.equipment) {
                const isEpic = equip.type === 'epic';
                const currentLevel = ownedEquipment[equip.name] !== undefined ? ownedEquipment[equip.name] : 1;
                const maxLevel = getEquipmentMaxLevel(equip.type);

                if (ownedEquipment[equip.name] !== undefined) {
                    for (let lvl = 2; lvl <= currentLevel; lvl++) {
                        if (upgradeCosts[lvl]) {
                            if (isEpic) {
                                epicSpent.shiny += upgradeCosts[lvl].shiny || 0;
                                epicSpent.glowy += upgradeCosts[lvl].glowy || 0;
                                epicSpent.starry += upgradeCosts[lvl].starry || 0;
                            } else {
                                commonSpent.shiny += upgradeCosts[lvl].shiny || 0;
                                commonSpent.glowy += upgradeCosts[lvl].glowy || 0;
                            }
                        }
                    }
                }

                for (let lvl = 2; lvl <= maxLevel; lvl++) {
                    if (upgradeCosts[lvl]) {
                        if (isEpic) {
                            epicTotal.shiny += upgradeCosts[lvl].shiny || 0;
                            epicTotal.glowy += upgradeCosts[lvl].glowy || 0;
                            epicTotal.starry += upgradeCosts[lvl].starry || 0;
                        } else {
                            commonTotal.shiny += upgradeCosts[lvl].shiny || 0;
                            commonTotal.glowy += upgradeCosts[lvl].glowy || 0;
                        }
                    }
                }
            }
        }
    }

    const shinySpent = commonSpent.shiny + epicSpent.shiny;
    const shinyTotal = commonTotal.shiny + epicTotal.shiny;
    const shiny = shinyTotal > 0 ? Math.round((shinySpent / shinyTotal) * 100) : 0;

    const glowySpent = commonSpent.glowy + epicSpent.glowy;
    const glowyTotal = commonTotal.glowy + epicTotal.glowy;
    const glowy = glowyTotal > 0 ? Math.round((glowySpent / glowyTotal) * 100) : 0;

    const starrySpent = epicSpent.starry;
    const starryTotal = epicTotal.starry;
    const starry = starryTotal > 0 ? Math.round((starrySpent / starryTotal) * 100) : 0;

    const orePcts = [];
    if (shinyTotal > 0) orePcts.push(shiny);
    if (glowyTotal > 0) orePcts.push(glowy);
    if (starryTotal > 0) orePcts.push(starry);

    const overall = orePcts.length > 0
        ? Math.round(orePcts.reduce((sum, val) => sum + val, 0) / orePcts.length)
        : 0;

    return {
        overall,
        shiny,
        glowy,
        starry,
        shinySpent,
        shinyTotal,
        glowySpent,
        glowyTotal,
        starrySpent,
        starryTotal
    };
}

/**
 * Generates the mathematical gradient background for the overall progress bar.
 *
 * @param {{ overall: number, shiny: number, glowy: number, starry: number }} progress - Equipment progress numbers.
 * @returns {string} CSS background gradient string.
 */
export function getOverallGradient(progress) {
    if (progress.overall >= 100) {
        return '';
    }
    const total = progress.shiny + progress.glowy + progress.starry;
    if (total === 0) {
        return 'linear-gradient(90deg, #00b0ff 0%, #aa00ff 50%, #ffd700 100%)';
    }
    const stopVal = Math.round((progress.shiny / total) * 100);
    const stop = Math.min(85, Math.max(15, stopVal));
    return `linear-gradient(90deg, #00b0ff 0%, #aa00ff ${stop}%, #ffd700 100%)`;
}

/**
 * Formats the clan role for localization.
 *
 * @param {string} role - Clan role enum value.
 * @returns {string} Localized clan role string.
 */
export function formatClanRole(role) {
    if (!role) return '';
    const key = `player.roles.${role.toLowerCase()}`;
    const translated = translate(key);
    return translated !== key ? translated : role;
}

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
        return `<div class="stat-box-maxed" data-i18n="views.home.profile.maxed">✓ ${translate('views.home.profile.maxed')}</div>`;
    }
    const { spent, total, remaining, time, col } = subData[key];
    return `<div class="stat-box-sub">
        <div>${formatNumber(spent)} / ${formatNumber(total)}</div>
        <div><span data-i18n="views.home.profile.remainingColon">${col}</span> ${formatNumber(remaining)} | ${time}</div>
    </div>`;
}
