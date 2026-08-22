import { CANONICAL_CHIP_PRIORITY_ORDER, getSourceById, incomeData } from '../data/incomeSourceRegistry.js';
import { translate } from '../i18n/translator.js';

import { state } from '../core/state.js';

import { attachChipPointerListeners } from './chipPointerManager.js';
import { formatDate, getScheduleDates } from './dateUtils.js';
import { formatNumber } from './numberFormatter.js';
import { getSVG } from './svgManager.js';

function getChipValidRangeString(chip, data, incomeSource) {
    const [calYear, calMonth] = (state.planner?.calendar?.view?.month || '2026-08').split('-').map(Number);
    const chipStartDate = chip.dataset.startDate;
    const chipEndDate = chip.dataset.endDate;

    const formatDateShort = (dateInput) => {
        if (!dateInput) return '';
        const d = typeof dateInput === 'string' ? new Date(dateInput.includes('T') ? dateInput : dateInput + 'T00:00:00Z') : dateInput;
        if (isNaN(d.getTime())) return '';
        return formatDate(d, { day: '2-digit', month: 'short' });
    };

    if (chipStartDate && chipEndDate) {
        return `${formatDateShort(chipStartDate)} – ${formatDateShort(chipEndDate)}`;
    }

    if (incomeSource?.isValidDate && incomeSource.id === 'starBonus2x') {
        const validDays = [];
        const daysInMonth = new Date(calYear, calMonth, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            if (incomeSource.isValidDate(day, calMonth - 1, calYear)) {
                validDays.push(day);
            }
        }
        if (validDays.length > 0) {
            const firstDate = new Date(Date.UTC(calYear, calMonth - 1, validDays[0]));
            const lastDate = new Date(Date.UTC(calYear, calMonth - 1, validDays[validDays.length - 1]));
            return `${formatDateShort(firstDate)} – ${formatDateShort(lastDate)}`;
        }
    }

    if (incomeSource?.schedule) {
        const scheduled = getScheduleDates(calYear, calMonth - 1, incomeSource.schedule);
        if (scheduled && scheduled.length > 0) {
            if (incomeSource.schedule.type === 'daily') {
                return translate('views.planner.anyDate');
            }
            const firstItem = scheduled[0];
            const lastItem = scheduled[scheduled.length - 1];

            const firstDate = firstItem instanceof Date ? firstItem : (firstItem?.startDate || null);
            const lastDate = lastItem instanceof Date ? lastItem : (lastItem?.endDate || lastItem?.startDate || null);

            if (firstDate && lastDate) {
                if (firstDate.getTime() === lastDate.getTime()) {
                    return formatDateShort(firstDate);
                }
                return `${formatDateShort(firstDate)} – ${formatDateShort(lastDate)}`;
            }
        }
    }

    return translate('views.planner.anyDate');
}

/**
 * Creates an interactive income chip DOM element with icons, badges, tooltips, and pointer event physics.
 * @param {string} text
 * @param {string} className
 * @param {Object} data
 * @param {number} month
 * @param {number} year
 * @param {string|null} [id=null]
 * @returns {HTMLDivElement}
 */
export function createIncomeChip(text, className, data, month, year, id = null) {
    const chip = document.createElement('div');
    const monthStr = String(month + 1).padStart(2, '0');
    const instanceStr = String(data.instance || 'monthly').padStart(2, '0');
    chip.id = id || `${data.type}-${instanceStr}-${year}-${monthStr}`;
    chip.classList.add('income-chip', className);

    chip.setAttribute('tabindex', '0');
    chip.setAttribute('role', 'button');

    const chipText = document.createElement('span');
    chipText.classList.add('chip-text');
    chipText.textContent = text;
    chip.appendChild(chipText);

    const incomeSource = getSourceById(data.type);

    // Render icon for calendar chips (where text is empty)
    if (text === '') {
        const showIcons = state.planner?.calendar?.settings?.showChipIcons !== false;
        const isCustomType = data.type === 'custom' || data.type === 'extras' || data.type.startsWith('custom-') || data.type.startsWith('custom') || data.type.startsWith('extras');
        let iconRendered = false;

        if (showIcons) {
            if (isCustomType) {
                chip.classList.add('calendar-chip');
                const svgContainer = document.createElement('div');
                svgContainer.classList.add('chip-icon-svg-container');
                svgContainer.style.display = 'flex';
                svgContainer.style.alignItems = 'center';
                svgContainer.style.justifyContent = 'center';
                svgContainer.innerHTML = getSVG('settings-filled', 'chip-icon svg-icon', 16, 16, 'currentColor');
                chip.appendChild(svgContainer);
                iconRendered = true;
            } else if (incomeSource) {
                const iconUrl = incomeSource.getSVGUrl ? incomeSource.getSVGUrl(state) : incomeSource.iconUrl;
                if (iconUrl) {
                    chip.classList.add('calendar-chip');
                    const iconImg = document.createElement('orecalc-assets-image');
                    iconImg.setAttribute('src', iconUrl);
                    iconImg.setAttribute('size', 'thumbnail');
                    iconImg.setAttribute('class', 'chip-icon');
                    chip.appendChild(iconImg);
                    iconRendered = true;
                }
            }
        }

        if (!iconRendered) {
            chip.classList.add('calendar-chip', 'no-icon');
            const rawCustom = data.customType || translate('views.planner.createCustomChipsModal.typeExtras');
            const capitalizedCustom = rawCustom.toLowerCase() === 'custom' || rawCustom.toLowerCase() === 'extras' ? 'EXTRA' : rawCustom;
            const fullName = isCustomType ? capitalizedCustom : translate(incomeSource?.nameI18nKey || `views.income.${data.type}.title`);
            chipText.textContent = getShortName(data.type, fullName);
        }
    }

    // Special badge for multiplier events or war results
    if (data.type && data.type.startsWith('starBonus') && data.type.endsWith('x')) {
        const badge = document.createElement('span');
        badge.classList.add('chip-badge');
        badge.textContent = data.type.substring('starBonus'.length);
        chip.appendChild(badge);
    } else if (data.result) {
        const badge = document.createElement('span');
        badge.classList.add('chip-badge', `badge-result-${data.result}`);
        badge.textContent = data.result === 'win' ? 'W' : (data.result === 'loss' ? 'L' : 'D');
        chip.appendChild(badge);
    }

    // Auto-generated chips (Daily Star Bonus, Prospector) are NOT draggable unless custom
    const isCustom = data.isCustom === true || data.isCustom === 'true' || String(data.isCustom) === 'true' || (id && id.startsWith('custom-'));
    let isDraggable = isCustom ? true : (incomeSource ? !incomeSource.autoGenerateInCalendar : true);
    if (data.type === 'prospector' && state.income?.prospector?.assistedConversion) {
        isDraggable = true;
    }
    chip.dataset.draggable = isDraggable ? 'true' : 'false';
    chip.draggable = false;
    chip.setAttribute('draggable', 'false');

    const chipData = { ...data, className: className, id: chip.id };

    if (data.isCustom) {
        if (id && id.includes('-cal')) {
            // Pencil icon for placed custom chips
            const pencilIcon = document.createElement('div');
            pencilIcon.classList.add('custom-chip-pencil');
            pencilIcon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
            chip.appendChild(pencilIcon);
        } else {
            // Ring for custom chips in unplaced container
            chip.classList.add('custom-chip-ring');
        }
    }

    if (incomeSource && incomeSource.schedule) {
        const isRecurring = data.isRecurring === true || data.isRecurring === 'true' || String(data.isRecurring) === 'true';
        if (!isCustom || isRecurring) {
            const scheduledDates = getScheduleDates(year, month, incomeSource.schedule);
            if (scheduledDates.length > 0) {
                if (incomeSource.schedule.type === 'weekly') {
                    const weekData = scheduledDates[data.instance - 1];
                    if (weekData) {
                        chip.dataset.startDate = weekData.startDate.toISOString().split('T')[0];
                        chip.dataset.endDate = weekData.endDate.toISOString().split('T')[0];
                    }
                } else {
                    chip.dataset.startDate = scheduledDates[0].toISOString().split('T')[0];
                    chip.dataset.endDate = scheduledDates[scheduledDates.length - 1].toISOString().split('T')[0];
                }
            }
        }
    }

    for (const key in chipData) {
        chip.dataset[key] = chipData[key];
    }

    // Accessible Tooltip Configuration
    const tooltip = document.createElement('div');
    tooltip.classList.add('chip-tooltip');
    tooltip.classList.add('active-chip-tooltip-element');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.draggable = false;
    const tooltipContent = document.createElement('div');
    tooltipContent.classList.add('tooltip-content');

    const chipName = document.createElement('div');
    chipName.classList.add('tooltip-header');
    const isCustomType = data.type === 'custom' || data.type === 'extras' || data.type.startsWith('custom-') || data.type.startsWith('custom') || data.type.startsWith('extras');
    if (isCustomType) {
        const rawCustom = data.customType || translate('views.planner.createCustomChipsModal.typeExtras');
        chipName.textContent = rawCustom.toLowerCase() === 'custom' || rawCustom.toLowerCase() === 'extras' ? 'Extras' : rawCustom;
    } else {
        const nameKey = incomeSource?.nameI18nKey || `views.income.${data.type}.title`;
        chipName.textContent = translate(nameKey);
        chipName.dataset.i18n = nameKey;
    }
    tooltipContent.appendChild(chipName);

    if (data.shiny !== undefined) {
        const shinyOre = document.createElement('div');
        shinyOre.classList.add('ore-count-item');
        const shinyVal = parseFloat(data.shiny);
        const isNegative = shinyVal < 0;
        shinyOre.innerHTML = `<span class="${isNegative ? 'negative-value' : ''}">${formatNumber(shinyVal)}</span> <orecalc-assets-image src="assets/shiny_ore.png" alt="${translate('entities.ores.shiny')}" data-i18n-alt="entities.ores.shiny" class="ore-icon-small"></orecalc-assets-image>`;
        tooltipContent.appendChild(shinyOre);
    }
    if (data.glowy !== undefined) {
        const glowyOre = document.createElement('div');
        glowyOre.classList.add('ore-count-item');
        const glowyVal = parseFloat(data.glowy);
        const isNegative = glowyVal < 0;
        glowyOre.innerHTML = `<span class="${isNegative ? 'negative-value' : ''}">${formatNumber(glowyVal)}</span> <orecalc-assets-image src="assets/glowy_ore.png" alt="${translate('entities.ores.glowy')}" data-i18n-alt="entities.ores.glowy" class="ore-icon-small"></orecalc-assets-image>`;
        tooltipContent.appendChild(glowyOre);
    }
    if (data.starry !== undefined) {
        const starryOre = document.createElement('div');
        starryOre.classList.add('ore-count-item');
        const starryVal = parseFloat(data.starry);
        const isNegative = starryVal < 0;
        starryOre.innerHTML = `<span class="${isNegative ? 'negative-value' : ''}">${formatNumber(starryVal)}</span> <orecalc-assets-image src="assets/starry_ore.png" alt="${translate('entities.ores.starry')}" data-i18n-alt="entities.ores.starry" class="ore-icon-small"></orecalc-assets-image>`;
        tooltipContent.appendChild(starryOre);
    }

    const validRangeText = getChipValidRangeString(chip, data, incomeSource);
    if (validRangeText) {
        const validRangeEl = document.createElement('div');
        validRangeEl.classList.add('tooltip-valid-range');
        validRangeEl.innerHTML = `<span class="valid-range-label">${translate('views.planner.validDates')}:</span> <span class="valid-range-value">${validRangeText}</span>`;
        tooltipContent.appendChild(validRangeEl);
    }

    tooltip.appendChild(tooltipContent);

    const showTooltip = () => {
        if (state.isChipDragging) return;

        document.querySelectorAll('.active-chip-tooltip-element').forEach(el => {
            if (el.parentNode === document.body) el.parentNode.removeChild(el);
        });

        const tooltipId = 'active-chip-tooltip';
        tooltip.id = tooltipId;
        chip.setAttribute('aria-describedby', tooltipId);

        document.body.appendChild(tooltip);
        tooltip.classList.add('visible');

        const rect = chip.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        let left = rect.left + rect.width / 2 + scrollX;
        let top = rect.bottom + scrollY + 10;

        tooltip.style.position = 'absolute';
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.transform = 'translateX(-50%)';

        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.left < 10) {
            tooltip.style.left = `${10 + tooltipRect.width / 2 + scrollX}px`;
        } else if (tooltipRect.right > window.innerWidth - 10) {
            tooltip.style.left = `${window.innerWidth - 10 - tooltipRect.width / 2 + scrollX}px`;
        }
    };

    const hideTooltip = () => {
        chip.removeAttribute('aria-describedby');
        tooltip.classList.remove('visible');
        if (tooltip.parentNode === document.body) {
            document.body.removeChild(tooltip);
        }
    };

    chip.addEventListener('mouseenter', showTooltip);
    chip.addEventListener('mouseleave', hideTooltip);
    chip.addEventListener('focus', showTooltip);
    chip.addEventListener('blur', hideTooltip);

    // Attach Unified Pointer Events Drag Physics
    if (isDraggable) {
        attachChipPointerListeners(chip, chipData);
    }

    return chip;
}

/**
 * Creates an overflow indicator chip displaying aggregated income counts.
 * @param {number} count
 * @param {Object} aggregatedData
 * @param {string} type
 * @param {string} className
 * @returns {HTMLDivElement}
 */
export function createOverflowChip(count, aggregatedData, type, className) {
    const chip = document.createElement('div');
    chip.classList.add('income-chip', 'overflow-chip', className);
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('role', 'button');

    const chipText = document.createElement('span');
    chipText.classList.add('chip-text');
    chipText.textContent = `+${count}`;
    chip.appendChild(chipText);

    chip.draggable = false;
    chip.setAttribute('draggable', 'false');
    chip.dataset.draggable = 'false';

    for (const key in aggregatedData) {
        chip.dataset[key] = aggregatedData[key];
    }
    chip.dataset.type = type;

    const tooltip = document.createElement('div');
    tooltip.classList.add('chip-tooltip');
    tooltip.classList.add('active-chip-tooltip-element');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.draggable = false;
    const tooltipContent = document.createElement('div');
    tooltipContent.classList.add('tooltip-content');

    const chipName = document.createElement('div');
    chipName.classList.add('tooltip-header');
    const isCustomType = type === 'custom' || type === 'extras' || type.startsWith('custom-') || type.startsWith('custom') || type.startsWith('extras');
    let displayName;
    if (isCustomType) {
        displayName = translate('views.planner.createCustomChipsModal.typeExtras');
    } else {
        const incomeSource = getSourceById(type);
        displayName = translate(incomeSource?.nameI18nKey || `views.income.${type}.title`);
    }
    chipName.textContent = translate('views.income.ores.moreOf', { count: count, displayName: displayName });
    tooltipContent.appendChild(chipName);

    if (aggregatedData.shiny !== undefined) {
        const shinyOre = document.createElement('div');
        shinyOre.classList.add('ore-count-item');
        shinyOre.innerHTML = `<span>${formatNumber(parseFloat(aggregatedData.shiny))}</span> <orecalc-assets-image src="assets/shiny_ore.png" alt="${translate('entities.ores.shiny')}" class="ore-icon-small"></orecalc-assets-image>`;
        tooltipContent.appendChild(shinyOre);
    }
    if (aggregatedData.glowy !== undefined) {
        const glowyOre = document.createElement('div');
        glowyOre.classList.add('ore-count-item');
        glowyOre.innerHTML = `<span>${formatNumber(parseFloat(aggregatedData.glowy))}</span> <orecalc-assets-image src="assets/glowy_ore.png" alt="${translate('entities.ores.glowy')}" class="ore-icon-small"></orecalc-assets-image>`;
        tooltipContent.appendChild(glowyOre);
    }
    if (aggregatedData.starry !== undefined) {
        const starryOre = document.createElement('div');
        starryOre.classList.add('ore-count-item');
        starryOre.innerHTML = `<span>${formatNumber(parseFloat(aggregatedData.starry))}</span> <orecalc-assets-image src="assets/starry_ore.png" alt="${translate('entities.ores.starry')}" class="ore-icon-small"></orecalc-assets-image>`;
        tooltipContent.appendChild(starryOre);
    }

    tooltip.appendChild(tooltipContent);

    const showTooltip = () => {
        document.querySelectorAll('.active-chip-tooltip-element').forEach(el => {
            if (el.parentNode === document.body) el.parentNode.removeChild(el);
        });

        const tooltipId = 'active-chip-tooltip';
        tooltip.id = tooltipId;
        chip.setAttribute('aria-describedby', tooltipId);

        document.body.appendChild(tooltip);
        tooltip.classList.add('visible');

        const rect = chip.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        let left = rect.left + rect.width / 2 + scrollX;
        let top = rect.bottom + scrollY + 10;

        tooltip.style.position = 'absolute';
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.transform = 'translateX(-50%)';

        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.left < 10) {
            tooltip.style.left = `${10 + tooltipRect.width / 2 + scrollX}px`;
        } else if (tooltipRect.right > window.innerWidth - 10) {
            tooltip.style.left = `${window.innerWidth - 10 - tooltipRect.width / 2 + scrollX}px`;
        }
    };

    const hideTooltip = () => {
        chip.removeAttribute('aria-describedby');
        tooltip.classList.remove('visible');
        if (tooltip.parentNode === document.body) {
            document.body.removeChild(tooltip);
        }
    };

    chip.addEventListener('mouseenter', showTooltip);
    chip.addEventListener('mouseleave', hideTooltip);
    chip.addEventListener('focus', showTooltip);
    chip.addEventListener('blur', hideTooltip);

    return chip;
}

/**
 * Renders the income chips legend with hover highlighting and click-to-glow features.
 * @param {HTMLElement} legendContainer
 */
export function renderIncomeChipsLegend(legendContainer) {
    if (!legendContainer) return;

    legendContainer.innerHTML = '';
    const glowTimeouts = new Map();

    const processLegendItem = (item) => {
        const legendItemDiv = document.createElement('div');
        legendItemDiv.classList.add('legend-item');
        legendItemDiv.setAttribute('tabindex', '0');
        legendItemDiv.setAttribute('role', 'button');

        const colorBoxDiv = document.createElement('div');
        colorBoxDiv.classList.add('color-box', item.className);
        legendItemDiv.appendChild(colorBoxDiv);

        const legendTextSpan = document.createElement('span');
        legendTextSpan.classList.add('legend-text');
        legendTextSpan.textContent = translate(item.nameI18nKey);
        legendItemDiv.appendChild(legendTextSpan);

        legendItemDiv.addEventListener('mouseenter', () => {
            const calendarContainer = document.getElementById('calendar-container');
            if (calendarContainer) {
                const chips = calendarContainer.querySelectorAll(`.income-chip[class*="${item.className}"]`);
                chips.forEach(chip => chip.classList.add('legend-highlight'));
            }
        });

        legendItemDiv.addEventListener('mouseleave', () => {
            const calendarContainer = document.getElementById('calendar-container');
            if (calendarContainer) {
                const chips = calendarContainer.querySelectorAll(`.income-chip[class*="${item.className}"]`);
                chips.forEach(chip => chip.classList.remove('legend-highlight'));
            }
        });

        const triggerGlow = () => {
            const calendarContainer = document.getElementById('calendar-container');
            if (calendarContainer) {
                calendarContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const chips = calendarContainer.querySelectorAll(`.income-chip[class*="${item.className}"]`);
                chips.forEach(chip => chip.classList.add('persistent-glow'));

                if (glowTimeouts.has(item.className)) {
                    clearTimeout(glowTimeouts.get(item.className));
                }

                const timeoutId = setTimeout(() => {
                    chips.forEach(chip => chip.classList.remove('persistent-glow'));
                    glowTimeouts.delete(item.className);
                }, 5000);

                glowTimeouts.set(item.className, timeoutId);
            }
        };

        legendItemDiv.addEventListener('click', triggerGlow);
        legendItemDiv.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                triggerGlow();
            }
        });

        legendContainer.appendChild(legendItemDiv);
    };

    const sortedEntries = Object.entries(incomeData).sort(([keyA], [keyB]) => {
        let indexA = CANONICAL_CHIP_PRIORITY_ORDER.indexOf(keyA);
        let indexB = CANONICAL_CHIP_PRIORITY_ORDER.indexOf(keyB);
        if (indexA === -1) indexA = 999;
        if (indexB === -1) indexB = 999;
        return indexA - indexB;
    });

    sortedEntries.forEach(([, value]) => {
        processLegendItem(value);
    });

    const customLegendItem = {
        nameI18nKey: 'views.planner.createCustomChipsModal.typeExtras',
        className: 'custom-chip'
    };
    processLegendItem(customLegendItem);
}

function getShortName(type, fullName) {
    const key = `views.income.shortcuts.${type}`;
    const translated = translate(key);
    if (translated && translated !== key) {
        return translated.startsWith('[EN] ') ? translated.substring(5) : translated;
    }
    if (type === 'starBonus') return 'SB';
    if (type && type.startsWith('starBonus') && type.endsWith('x')) {
        return type.substring('starBonus'.length) + ' SB';
    }
    if (type === 'raidMedalTrader') return 'Raid';
    if (type === 'gemTrader') return 'Gem';
    if (type === 'eventPass') return 'Pass';
    if (type === 'eventTrader') return 'Event';
    if (type === 'shopOffers') return 'Shop';
    if (type === 'prospector') return 'Pros';
    if (type === 'supercellEvents') return 'SC';
    if (type === 'clanWar') return 'War';
    if (type === 'cwl') return 'CWL';
    return fullName.split(' ')[0] || fullName;
}
