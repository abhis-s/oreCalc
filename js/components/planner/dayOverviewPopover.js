/**
 * dayOverviewPopover.js
 * Accessible singleton Popover displaying full event breakdowns, ore quantities,
 * and per-chip action controls for calendar day cells.
 */

import { getSourceById, incomeData } from '../../data/incomeSourceRegistry.js';
import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { getProspectorIncomeForDate } from '../../domain/income/prospectorManager.js';
import { formatDate } from '../../utils/dateUtils.js';
import { formatNumber } from '../../utils/numberFormatter.js';
import { toCamelCase } from '../../utils/stringUtils.js';

import { getHeroColor } from './calendarScheduler.js';
import { openCreateCustomChipsModal } from './createCustomChipsModalDisplay.js';
import { handleChipDropOnContainer } from './incomeChipsInputs.js';

let dayPopoverElem = null;
let activeDayCell = null;
let isOutsideDismissBound = false;

function bindOutsideDismiss() {
    if (isOutsideDismissBound || typeof document === 'undefined') return;
    isOutsideDismissBound = true;

    const handleOutsideInteraction = (e) => {
        if (!dayPopoverElem || !dayPopoverElem.classList.contains('show')) return;
        const target = e.target;
        if (dayPopoverElem.contains(target)) return;
        if (activeDayCell && (activeDayCell === target || activeDayCell.contains(target))) return;
        hideDayOverviewPopover();
    };

    document.addEventListener('pointerdown', handleOutsideInteraction, { capture: true, passive: true });

    if (dayPopoverElem && typeof dayPopoverElem.addEventListener === 'function') {
        dayPopoverElem.addEventListener('toggle', (event) => {
            if (event.newState === 'closed') {
                if (activeDayCell && typeof activeDayCell.removeAttribute === 'function') {
                    activeDayCell.removeAttribute('aria-describedby');
                }
                if (dayPopoverElem.classList) {
                    dayPopoverElem.classList.remove('show');
                }
                activeDayCell = null;
            }
        });
    }
}

function getOrCreateDayPopover() {
    if (!dayPopoverElem) {
        dayPopoverElem = document.getElementById('day-overview-popover');
    }
    if (!dayPopoverElem) {
        dayPopoverElem = document.createElement('div');
        dayPopoverElem.id = 'day-overview-popover';
        dayPopoverElem.className = 'day-overview-popover';
        if (typeof dayPopoverElem.setAttribute === 'function') {
            dayPopoverElem.setAttribute('popover', 'auto');
            dayPopoverElem.setAttribute('role', 'dialog');
            dayPopoverElem.setAttribute('aria-label', translate('views.planner.dayOverview.title'));
        }
        document.body.appendChild(dayPopoverElem);
    }
    bindOutsideDismiss();
    return dayPopoverElem;
}

/**
 * Hides and closes the day overview popover.
 */
export function hideDayOverviewPopover() {
    if (activeDayCell && typeof activeDayCell.removeAttribute === 'function') {
        activeDayCell.removeAttribute('aria-describedby');
    }
    if (dayPopoverElem) {
        dayPopoverElem.classList.remove('show');
        if (typeof dayPopoverElem.hidePopover === 'function') {
            try {
                let isOpen = false;
                try {
                    isOpen = typeof dayPopoverElem.matches === 'function' ? dayPopoverElem.matches(':popover-open') : false;
                } catch (_) {}
                if (isOpen) {
                    dayPopoverElem.hidePopover();
                }
            } catch (_) {}
        }
    }
    activeDayCell = null;
}

/**
 * Displays the day overview popover for a specific day cell.
 * @param {HTMLElement} dayCell
 * @param {Date} date
 * @param {Object} plannerState
 * @param {Object} activeEquipmentSchedule
 */
export function showDayOverviewPopover(dayCell, date, plannerState, activeEquipmentSchedule) {
    if (!dayCell) return;
    const popover = getOrCreateDayPopover();

    if (activeDayCell === dayCell && popover.classList.contains('show')) {
        hideDayOverviewPopover();
        return;
    }

    if (activeDayCell && activeDayCell !== dayCell) {
        activeDayCell.removeAttribute('aria-describedby');
    }

    activeDayCell = dayCell;
    dayCell.setAttribute('aria-describedby', 'day-overview-popover');

    const displayYear = date.getUTCFullYear();
    const displayMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const displayDay = String(date.getUTCDate()).padStart(2, '0');
    const monthYearKey = `${displayYear}-${displayMonth}`;
    const dateStr = `${displayYear}-${displayMonth}-${displayDay}`;

    const formattedDateHeader = formatDate(date, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const chipsOnThisDay = plannerState?.calendar?.dates?.[monthYearKey]?.[displayDay] || [];
    const items = [];
    let totalShiny = 0;
    let totalGlowy = 0;
    let totalStarry = 0;

    for (const key in incomeData) {
        const source = incomeData[key];
        if (!source.autoGenerateInCalendar) continue;

        let isSuppressedBySubcategory = false;
        if (source.subCategories) {
            isSuppressedBySubcategory = chipsOnThisDay.some(chipId => {
                const type = chipId.replace(/^custom-/, '').split('-')[0];
                return source.subCategories.some(sub => sub.id === type);
            });
        }

        const hasManualOverride = chipsOnThisDay.some(chipId => {
            const cleanId = chipId.replace(/^custom-/, '');
            const type = cleanId.split('-')[0];
            return type === source.id;
        });

        if (isSuppressedBySubcategory || hasManualOverride) continue;

        let autoData = null;
        if (source.getAutomaticSchedule) {
            autoData = source.getAutomaticSchedule(date, state);
        } else if (source.schedule?.type === 'daily') {
            autoData = { instance: date.getUTCDate() };
        }

        if (autoData) {
            let income;
            if (autoData.income) {
                income = autoData.income;
            } else if (source.id === 'prospector' && state.income?.prospector?.assistedConversion) {
                income = getProspectorIncomeForDate(date, state);
            } else if (source.getBaseIncome) {
                income = source.getBaseIncome(state);
            } else {
                income = source.getIncome(state);
            }

            const s = Math.round(income.shiny || 0);
            const g = Math.round(income.glowy || 0);
            const st = Math.round(income.starry || 0);
            totalShiny += s;
            totalGlowy += g;
            totalStarry += st;

            items.push({
                id: `${source.id}-${autoData.instance || displayDay}-${displayYear}-${displayMonth}-cal-auto`,
                type: source.id,

                name: translate(source.nameI18nKey || `views.income.${source.id}.title`),
                className: source.className,
                shiny: s,
                glowy: g,
                starry: st,
                isAuto: true,
                isCustom: false,
                iconUrl: source.iconUrl
            });
        }
    }

    chipsOnThisDay.forEach(chipId => {
        const parts = chipId.split('-');
        let type;

        if (chipId.startsWith('custom-')) {
            type = parts[1];
        } else {
            type = parts[0];
        }

        const customChip = (plannerState?.customChips || []).find(c => c.id === chipId);
        const storedData = plannerState?.customChipData?.[chipId];
        const incomeSource = incomeData[type];

        if (customChip || storedData) {
            const data = customChip || storedData;
            const s = Math.round(data.shiny || 0);
            const g = Math.round(data.glowy || 0);
            const st = Math.round(data.starry || 0);
            totalShiny += s;
            totalGlowy += g;
            totalStarry += st;

            items.push({
                id: chipId,
                type: data.type || type,
                name: data.name || (incomeSource ? translate(incomeSource.nameI18nKey || `views.income.${type}.title`) : type),
                className: incomeSource?.className || 'chip-custom',
                shiny: s,
                glowy: g,
                starry: st,
                isAuto: false,
                isCustom: true,
                iconUrl: incomeSource?.iconUrl || null
            });
        } else if (incomeSource) {
            const income = incomeSource.getIncome(state);
            const s = Math.round(income.shiny || 0);
            const g = Math.round(income.glowy || 0);
            const st = Math.round(income.starry || 0);
            totalShiny += s;
            totalGlowy += g;
            totalStarry += st;

            items.push({
                id: chipId,
                type: type,
                name: translate(incomeSource.nameI18nKey || `views.income.${type}.title`),
                className: incomeSource.className,
                shiny: s,
                glowy: g,
                starry: st,
                isAuto: false,
                isCustom: chipId.startsWith('custom-'),
                iconUrl: incomeSource?.iconUrl || null
            });
        }
    });

    const milestones = activeEquipmentSchedule?.milestones?.[dateStr] || [];
    let milestoneHtml = '';
    if (milestones.length > 0) {
        milestoneHtml = `
            <div class="day-overview-milestones">
                <div class="day-overview-section-title">${translate('views.planner.dayOverview.equipmentMilestone')}</div>
                <div class="day-overview-milestones-list">
                    ${milestones.map(m => {
                        const heroColor = getHeroColor(m.heroName);
                        const transName = translate(`entities.equipment.${toCamelCase(m.name || '')}`);
                        const lvlPrefix = translate('views.equipment.lvlShort');
                        return `
                            <div class="day-overview-milestone-item" style="--equip-color: ${heroColor};">
                                ${m.image ? `<orecalc-assets-image src="${m.image}" class="milestone-icon"></orecalc-assets-image>` : `<span class="milestone-fallback">${(m.name || '').substring(0, 2).toUpperCase()}</span>`}
                                <div class="milestone-text-group">
                                    <div class="milestone-title">${transName} (${lvlPrefix} ${m.targetLevel})</div>
                                    ${m.bottleneckOre ? `<div class="milestone-bottleneck">${translate('views.income.ores.bottleneckLabel')}: ${translate(`entities.ores.${m.bottleneckOre}`)}</div>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    popover.innerHTML = `
        <div class="day-overview-header">
            <h3 class="day-overview-date">${formattedDateHeader}</h3>
            <button class="day-overview-close-btn" data-action="close-popover" data-i18n-aria-label="actions.close">
                <orecalc-assets-svg name="close"></orecalc-assets-svg>
            </button>
        </div>
        <div class="day-overview-summary-card">
            <div class="day-overview-summary-title">${translate('views.planner.dayOverview.dayIncome')}</div>
            <div class="day-overview-ores-grid">
                <div class="day-ore-stat">
                    <span class="day-ore-val">${formatNumber(totalShiny)}</span>
                    <orecalc-assets-image src="assets/shiny_ore.png" class="ore-icon-small" alt="${translate('entities.ores.shiny')}"></orecalc-assets-image>
                </div>
                <div class="day-ore-stat">
                    <span class="day-ore-val">${formatNumber(totalGlowy)}</span>
                    <orecalc-assets-image src="assets/glowy_ore.png" class="ore-icon-small" alt="${translate('entities.ores.glowy')}"></orecalc-assets-image>
                </div>
                <div class="day-ore-stat">
                    <span class="day-ore-val">${formatNumber(totalStarry)}</span>
                    <orecalc-assets-image src="assets/starry_ore.png" class="ore-icon-small" alt="${translate('entities.ores.starry')}"></orecalc-assets-image>
                </div>
            </div>
        </div>
        ${milestoneHtml}
        <div class="day-overview-chips-section">
            ${items.length === 0 ? `
                <div class="day-overview-empty">${translate('views.planner.dayOverview.noChips')}</div>
            ` : `
                <div class="day-overview-chips-list">
                    ${items.map(item => `
                        <div class="day-overview-chip-row ${item.className}">
                            <div class="chip-row-info">
                                <span class="chip-row-title">${item.name}</span>
                                <div class="chip-row-ores">
                                    ${item.shiny ? `<span>+${formatNumber(item.shiny)} <orecalc-assets-image src="assets/shiny_ore.png" class="ore-icon-tiny"></orecalc-assets-image></span>` : ''}
                                    ${item.glowy ? `<span>+${formatNumber(item.glowy)} <orecalc-assets-image src="assets/glowy_ore.png" class="ore-icon-tiny"></orecalc-assets-image></span>` : ''}
                                    ${item.starry ? `<span>+${formatNumber(item.starry)} <orecalc-assets-image src="assets/starry_ore.png" class="ore-icon-tiny"></orecalc-assets-image></span>` : ''}
                                </div>
                            </div>
                            <div class="chip-row-actions">
                                ${!item.isAuto ? `
                                    <button class="chip-action-btn btn-remove" data-action="return-chip" data-chip-id="${item.id}" data-chip-type="${item.type}" data-i18n-aria-label="views.planner.dayOverview.returnToPool" title="${translate('views.planner.dayOverview.returnToPool')}">
                                        <orecalc-assets-svg name="close"></orecalc-assets-svg>
                                    </button>
                                ` : ''}
                                ${item.isCustom ? `
                                    <button class="chip-action-btn btn-edit" data-action="edit-chip" data-chip-id="${item.id}" data-i18n-aria-label="views.planner.dayOverview.editCustom" title="${translate('views.planner.dayOverview.editCustom')}">
                                        <orecalc-assets-svg name="edit"></orecalc-assets-svg>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
    `;

    popover.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.getAttribute('data-action');
            if (action === 'close-popover') {
                hideDayOverviewPopover();
            } else if (action === 'return-chip') {
                const chipId = btn.getAttribute('data-chip-id');
                const chipType = btn.getAttribute('data-chip-type');
                if (chipId) {
                    handleChipDropOnContainer({ id: chipId, type: chipType });
                    hideDayOverviewPopover();
                }
            } else if (action === 'edit-chip') {
                hideDayOverviewPopover();
                openCreateCustomChipsModal();
            }
        });
    });

    popover.classList.add('show');
    if (typeof popover.showPopover === 'function') {
        try {
            let isOpen = false;
            try {
                isOpen = typeof popover.matches === 'function' ? popover.matches(':popover-open') : false;
            } catch (_) {}
            if (!isOpen) {
                popover.showPopover();
            }
        } catch (_) {}
    }

    const positionPopover = () => {
        if (activeDayCell !== dayCell) return;
        const popoverRect = popover.getBoundingClientRect();
        const cellRect = dayCell.getBoundingClientRect();

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const popoverHeight = popoverRect.height || 220;
        const popoverWidth = popoverRect.width || 280;

        let top = cellRect.bottom + 8;
        if (top + popoverHeight > viewportHeight - 12) {
            top = Math.max(12, cellRect.top - popoverHeight - 8);
        }

        let left = cellRect.left + (cellRect.width / 2) - (popoverWidth / 2);
        left = Math.max(12, Math.min(left, viewportWidth - popoverWidth - 12));

        popover.style.top = `${top}px`;
        popover.style.left = `${left}px`;
    };

    positionPopover();
    requestAnimationFrame(positionPopover);
}
