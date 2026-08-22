import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { calculateCumulativeOres } from '../../utils/chipManager.js';
import { formatDate } from '../../utils/dateUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { toCamelCase } from '../../utils/stringUtils.js';

import { getHeroColor, getMidnightUTCTime } from './calendarScheduler.js';

/**
 * Tooltip handler for equipment milestone badge mouse enter.
 * @param {MouseEvent} e
 * @param {Object} item
 */
export function handleEquipmentBadgeMouseEnter(e, item) {
    e.stopPropagation();
    const badge = /** @type {HTMLElement} */ (e.currentTarget);

    const existingTooltip = document.getElementById('active-calendar-tooltip');
    if (existingTooltip) existingTooltip.remove();

    const tooltip = document.createElement('div');
    tooltip.classList.add('ore-tooltip');
    tooltip.id = 'active-calendar-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    badge.setAttribute('aria-describedby', 'active-calendar-tooltip');

    const rawEquipName = item.name || '';
    const translatedEquipName = translate(`entities.equipment.${toCamelCase(rawEquipName)}`);
    const targetLvl = item.targetLevel || 1;
    const lvlPrefix = translate('views.equipment.lvlShort');
    const bottleneckTrans = item.bottleneckOre ? translate(`entities.ores.${item.bottleneckOre}`) : '';

    let requiredHtml = '';
    if (item.requiredOres) {
        requiredHtml = `
            <div class="tooltip-req-ores">
                ${item.requiredOres.shiny > 0 ? `<span>${formatNumber(item.requiredOres.shiny)} <orecalc-assets-image src="assets/shiny_ore.png" alt="${translate('entities.ores.shiny')}"></orecalc-assets-image></span>` : ''}
                ${item.requiredOres.glowy > 0 ? `<span>${formatNumber(item.requiredOres.glowy)} <orecalc-assets-image src="assets/glowy_ore.png" alt="${translate('entities.ores.glowy')}"></orecalc-assets-image></span>` : ''}
                ${item.requiredOres.starry > 0 ? `<span>${formatNumber(item.requiredOres.starry)} <orecalc-assets-image src="assets/starry_ore.png" alt="${translate('entities.ores.starry')}"></orecalc-assets-image></span>` : ''}
            </div>
        `;
    }

    tooltip.innerHTML = `
        <div class="tooltip-header" style="color: ${getHeroColor(item.heroName)}; font-weight: bold;">${translatedEquipName} (${lvlPrefix} ${targetLvl})</div>
        ${item.message ? `<div class="tooltip-message" style="color: #ff7675;">${item.message}</div>` : ''}
        ${item.bottleneckOre ? `<div class="tooltip-bottleneck">${translate('views.income.ores.bottleneckLabel')}: ${bottleneckTrans}</div>` : ''}
        ${requiredHtml}
    `;

    document.body.appendChild(tooltip);

    tooltip.style.position = 'absolute';

    const rect = badge.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let centerX = rect.left + rect.width / 2;
    const margin = 10;

    if (centerX - tooltipRect.width / 2 < margin) {
        centerX = margin + tooltipRect.width / 2;
    } else if (centerX + tooltipRect.width / 2 > window.innerWidth - margin) {
        centerX = window.innerWidth - margin - tooltipRect.width / 2;
    }

    let top = rect.top + scrollY - 8;
    let transform = 'translate(-50%, -100%)';

    if (rect.top - tooltipRect.height - 8 < margin && rect.bottom + tooltipRect.height + 8 < window.innerHeight) {
        top = rect.bottom + scrollY + 8;
        transform = 'translate(-50%, 0)';
    }

    tooltip.style.left = `${centerX + scrollX}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = transform;
}

/**
 * Tooltip handler for equipment milestone badge mouse leave.
 * @param {MouseEvent} [e]
 */
export function handleEquipmentBadgeMouseLeave(e) {
    if (e?.currentTarget && typeof e.currentTarget.removeAttribute === 'function') {
        e.currentTarget.removeAttribute('aria-describedby');
    }
    const tooltip = document.getElementById('active-calendar-tooltip');
    if (tooltip) tooltip.remove();
}

/**
 * Tooltip handler for day cell hover.
 * @param {MouseEvent} e
 * @param {{ ranges?: Array<{ start: number, end: number, item: any }> }} [activeEquipmentSchedule]
 */
export function handleDayCellMouseEnter(e, activeEquipmentSchedule = { ranges: [] }) {
    const dayCell = /** @type {HTMLElement} */ (e.currentTarget);
    const dateString = dayCell.dataset.date;
    if (!dateString) return;

    const [year, month, day] = dateString.split('-').map(Number);
    const targetDate = new Date(Date.UTC(year, month - 1, day));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (targetDate < today) return;

    const existingTooltip = document.getElementById('active-calendar-tooltip');
    if (existingTooltip) existingTooltip.remove();

    const cumulativeOres = calculateCumulativeOres(targetDate, state.storedOres);
    const formattedDate = formatDate(targetDate, { month: 'short', day: 'numeric', weekday: 'short' });

    const cellTime = getMidnightUTCTime(targetDate);
    const activeRange = activeEquipmentSchedule.ranges ? activeEquipmentSchedule.ranges.find(r => cellTime >= r.start && cellTime <= r.end) : null;
    let inProgressHtml = '';

    if (activeRange && activeRange.item) {
        const compDateObj = new Date(activeRange.end);
        const compDateFormatted = formatDate(compDateObj, { month: 'short', day: 'numeric', weekday: 'short' });
        const heroColor = getHeroColor(activeRange.item.heroName);
        const translatedItemName = translate(`entities.equipment.${toCamelCase(activeRange.item.name)}`);
        const lvlPrefix = translate('views.equipment.lvlShort');

        inProgressHtml = `
            <div class="tooltip-in-progress">
                <div class="in-progress-title">${translate('views.income.ores.byLabel')}: ${compDateFormatted}</div>
                <div class="in-progress-badge" style="--equip-color: ${heroColor}; border-color: ${heroColor};">
                    ${activeRange.item.image ? `<orecalc-assets-image src="${activeRange.item.image}" class="in-progress-icon" alt="${translatedItemName}"></orecalc-assets-image>` : `<span class="in-progress-fallback">${activeRange.item.name.substring(0, 2).toUpperCase()}</span>`}
                    <span class="in-progress-level">${lvlPrefix} ${activeRange.item.targetLevel}</span>
                </div>
            </div>
        `;
    }

    const tooltip = document.createElement('div');
    tooltip.classList.add('ore-tooltip');
    tooltip.id = 'active-calendar-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    dayCell.setAttribute('aria-describedby', 'active-calendar-tooltip');
    tooltip.innerHTML = `
        <div class="tooltip-header">${formattedDate}</div>
        <div class="ore-count-item"><span>${formatNumber(cumulativeOres.shiny)}</span> <orecalc-assets-image src="assets/shiny_ore.png" alt="${translate('entities.ores.shiny')}" class="ore-icon-small"></orecalc-assets-image></div>
        <div class="ore-count-item"><span>${formatNumber(cumulativeOres.glowy)}</span> <orecalc-assets-image src="assets/glowy_ore.png" alt="${translate('entities.ores.glowy')}" class="ore-icon-small"></orecalc-assets-image></div>
        <div class="ore-count-item"><span>${formatNumber(cumulativeOres.starry)}</span> <orecalc-assets-image src="assets/starry_ore.png" alt="${translate('entities.ores.starry')}" class="ore-icon-small"></orecalc-assets-image></div>
        ${inProgressHtml}
    `;

    document.body.appendChild(tooltip);

    tooltip.style.position = 'absolute';

    const rect = dayCell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    let centerX = rect.left + rect.width / 2;
    const margin = 10;

    if (centerX - tooltipRect.width / 2 < margin) {
        centerX = margin + tooltipRect.width / 2;
    } else if (centerX + tooltipRect.width / 2 > window.innerWidth - margin) {
        centerX = window.innerWidth - margin - tooltipRect.width / 2;
    }

    let top = rect.top + scrollY - 8;
    let transform = 'translate(-50%, -100%)';

    if (rect.top - tooltipRect.height - 8 < margin && rect.bottom + tooltipRect.height + 8 < window.innerHeight) {
        top = rect.bottom + scrollY + 8;
        transform = 'translate(-50%, 0)';
    }

    tooltip.style.left = `${centerX + scrollX}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.transform = transform;
}

/**
 * Tooltip handler for day cell mouse leave.
 * @param {MouseEvent} [e]
 */
export function handleDayCellMouseLeave(e) {
    if (e?.currentTarget && typeof e.currentTarget.removeAttribute === 'function') {
        e.currentTarget.removeAttribute('aria-describedby');
    }
    const tooltip = document.getElementById('active-calendar-tooltip');
    if (tooltip) tooltip.remove();
}
