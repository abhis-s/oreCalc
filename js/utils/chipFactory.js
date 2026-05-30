import { incomeData, getSourceById } from '../data/incomeSourceRegistry.js';
import { getScheduleDates } from './dateUtils.js';
import { state } from '../core/state.js';
import { translate } from '../i18n/translator.js';
import { formatNumber } from './numberFormatter.js';
import { handleChipDropOnCalendar } from '../components/planner/calendar.js';
import { handleChipDropOnContainer } from '../components/planner/incomeChips.js';
import { toCamelCase } from './stringUtils.js';
import { getSVG } from './svgManager.js';

let draggedChipData = null;

export function createIncomeChip(text, className, data, month, year, id = null) {
    const chip = document.createElement('div');
    const monthStr = String(month + 1).padStart(2, '0');
    const instanceStr = String(data.instance || 'monthly').padStart(2, '0');
    chip.id = id || `${data.type}-${instanceStr}-${monthStr}-${year}`;
    chip.classList.add('income-chip', className);
    
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
            const rawCustom = data.customType || translate('planner.createCustomChipsModal.typeExtras');
            const capitalizedCustom = rawCustom.toLowerCase() === 'custom' || rawCustom.toLowerCase() === 'extras' ? 'EXTRA' : rawCustom;
            const fullName = isCustomType ? capitalizedCustom : translate(incomeSource?.nameI18nKey || `income.${data.type}.title`);
            chipText.textContent = getShortName(data.type, fullName);
        }
    }

    // Special badge for multiplier events or results
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
    
    // Auto-generated chips (Daily Star Bonus, Prospector) are NOT draggable, unless they are custom-created
    const isCustom = data.isCustom === true || data.isCustom === 'true' || String(data.isCustom) === 'true' || (id && id.startsWith('custom-'));
    const isDraggable = isCustom ? true : (incomeSource ? !incomeSource.autoGenerateInCalendar : true);
    chip.draggable = isDraggable;
    chip.setAttribute('draggable', isDraggable ? 'true' : 'false');

    const chipData = { ...data, className: className, id: chip.id };

    if (data.isCustom) {
        if (id && id.includes('-cal')) {
            // Pencil icon for placed custom chips
            const pencilIcon = document.createElement('div');
            pencilIcon.classList.add('custom-chip-pencil');
            pencilIcon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
            chip.appendChild(pencilIcon);
        } else {
            // Ring for custom chips in container
            chip.classList.add('custom-chip-ring');
        }
    }

    if (incomeSource && incomeSource.schedule) {
        const isCustom = data.isCustom === true || data.isCustom === 'true' || String(data.isCustom) === 'true' || (id && id.startsWith('custom-'));
        const isRecurring = data.isRecurring === true || data.isRecurring === 'true' || String(data.isRecurring) === 'true';
        if (!isCustom || isRecurring) {
            const scheduledDates = getScheduleDates(year, month, incomeSource.schedule, data.instance);
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

    const tooltip = document.createElement('div');
    tooltip.classList.add('chip-tooltip');
    tooltip.classList.add('active-chip-tooltip-element');
    tooltip.draggable = false;
    const tooltipContent = document.createElement('div');
    tooltipContent.classList.add('tooltip-content');

    const chipName = document.createElement('div');
    chipName.classList.add('tooltip-header');
    const isCustomType = data.type === 'custom' || data.type === 'extras' || data.type.startsWith('custom-') || data.type.startsWith('custom') || data.type.startsWith('extras');
    if (isCustomType) {
        const rawCustom = data.customType || translate('planner.createCustomChipsModal.typeExtras');
        chipName.textContent = rawCustom.toLowerCase() === 'custom' || rawCustom.toLowerCase() === 'extras' ? 'Extras' : rawCustom;
    } else {
        const nameKey = incomeSource?.nameI18nKey || `income.${data.type}.title`;
        chipName.textContent = translate(nameKey);
        chipName.dataset.i18n = nameKey;
    }
    tooltipContent.appendChild(chipName);

    if (data.shiny !== undefined) {
        const shinyOre = document.createElement('div');
        shinyOre.classList.add('ore-count-item');
        const shinyVal = parseFloat(data.shiny);
        const isNegative = shinyVal < 0;
        shinyOre.innerHTML = `<span class="${isNegative ? 'negative-value' : ''}">${formatNumber(shinyVal)}</span> <img src="assets/shiny_ore.png" alt="${translate('ores.shiny')}" data-i18n-alt="ores.shiny" class="ore-icon-small">`;
        tooltipContent.appendChild(shinyOre);
    }
    if (data.glowy !== undefined) {
        const glowyOre = document.createElement('div');
        glowyOre.classList.add('ore-count-item');
        const glowyVal = parseFloat(data.glowy);
        const isNegative = glowyVal < 0;
        glowyOre.innerHTML = `<span class="${isNegative ? 'negative-value' : ''}">${formatNumber(glowyVal)}</span> <img src="assets/glowy_ore.png" alt="${translate('ores.glowy')}" data-i18n-alt="ores.glowy" class="ore-icon-small">`;
        tooltipContent.appendChild(glowyOre);
    }
    if (data.starry !== undefined) {
        const starryOre = document.createElement('div');
        starryOre.classList.add('ore-count-item');
        const starryVal = parseFloat(data.starry);
        const isNegative = starryVal < 0;
        starryOre.innerHTML = `<span class="${isNegative ? 'negative-value' : ''}">${formatNumber(starryVal)}</span> <img src="assets/starry_ore.png" alt="${translate('ores.starry')}" data-i18n-alt="ores.starry" class="ore-icon-small">`;
        tooltipContent.appendChild(starryOre);
    }

    tooltip.appendChild(tooltipContent);
    
    const showTooltip = (e) => {
        // Ensure only one chip tooltip exists
        document.querySelectorAll('.active-chip-tooltip-element').forEach(el => {
            if (el.parentNode === document.body) el.parentNode.removeChild(el);
        });

        document.body.appendChild(tooltip);
        tooltip.classList.add('visible');

        const rect = chip.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        let left = rect.left + rect.width / 2 + scrollX;
        let top = rect.bottom + scrollY + 10; // Position below

        tooltip.style.position = 'absolute';
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.zIndex = '1000';

        // Boundary check
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.left < 10) {
            tooltip.style.left = `${10 + tooltipRect.width / 2 + scrollX}px`;
        } else if (tooltipRect.right > window.innerWidth - 10) {
            tooltip.style.left = `${window.innerWidth - 10 - tooltipRect.width / 2 + scrollX}px`;
        }
    };

    const hideTooltip = () => {
        tooltip.classList.remove('visible');
        if (tooltip.parentNode === document.body) {
            document.body.removeChild(tooltip);
        }
    };

    chip.addEventListener('mouseenter', showTooltip);
    chip.addEventListener('mouseleave', hideTooltip);
    chip.addEventListener('dragstart', hideTooltip); 
    chip.addEventListener('touchstart', hideTooltip);

    const highlightDropTargets = () => {
        const formatDate = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const day = String(d.getUTCDate()).padStart(2, '0');
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const year = d.getUTCFullYear();
            return `${day}-${month}-${year}`;
        };

        const [calMonth, calYear] = state.planner.calendar.view.month.split('-').map(Number);
        
        const chipStartDate = chip.dataset.startDate;
        const chipEndDate = chip.dataset.endDate;
        const incomeSource = getSourceById(chipData.type);

        let validDates = [];
        if (chipStartDate && chipEndDate) {
            let currentDate = new Date(chipStartDate + 'T00:00:00Z');
            const endDate = new Date(chipEndDate + 'T00:00:00Z');
            while (currentDate <= endDate) {
                validDates.push(formatDate(currentDate));
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }
        } else if (incomeSource?.schedule) {
            const scheduledDates = getScheduleDates(calYear, calMonth - 1, incomeSource.schedule);
            validDates = scheduledDates.map(date => formatDate(date));
        }

        const calendarCells = document.querySelectorAll('.day-cell');
        const maxChips = incomeSource?.getCount ? incomeSource.getCount(state, calMonth - 1, calYear) : 0;

        // Find existing chips of this type to enforce consecutive logic
        const monthYearKeyForCalc = `${String(calMonth).padStart(2, '0')}-${calYear}`;
        let existingDays = [];
        if (state.planner.calendar.dates[monthYearKeyForCalc]) {
            for (const d in state.planner.calendar.dates[monthYearKeyForCalc]) {
                if (state.planner.calendar.dates[monthYearKeyForCalc][d].some(id => id.startsWith(chipData.type))) {
                    existingDays.push(parseInt(d, 10));
                }
            }
        }

        // If the chip being dragged is already on the calendar, exclude its current day
        // so we can "shift" the block by dragging the first or last chip.
        const currentDayOnCalendar = chip.closest('.day-cell')?.dataset.date?.split('-')[2];
        if (currentDayOnCalendar) {
            const dayInt = parseInt(currentDayOnCalendar, 10);
            existingDays = existingDays.filter(d => d !== dayInt);
        }

        existingDays.sort((a, b) => a - b);

        calendarCells.forEach(cell => {
            const chipContainer = cell.querySelector('.chip-container');
            if (!chipContainer) return;

            const cellDate = cell.dataset.date;
            const [year, month, day] = cellDate.split('-').map(Number);
            const monthYearKey = `${String(month).padStart(2, '0')}-${year}`;
            const dayKey = String(day).padStart(2, '0');

            let isValidRange = false;
            const isCustom = chipData.isCustom === true || chipData.isCustom === 'true' || String(chipData.isCustom) === 'true';
            const isRecurring = chipData.isRecurring === true || chipData.isRecurring === 'true' || String(chipData.isRecurring) === 'true';
            const isGenericCustom = chipData.type === 'custom' || chipData.type === 'extras' || chipData.type.startsWith('custom-') || chipData.type.startsWith('custom') || chipData.type.startsWith('extras');
            
            if (isCustom && !isRecurring) {
                isValidRange = true;
            } else if (isGenericCustom) {
                isValidRange = true;
            } else if (incomeSource?.isValidDate) {
                isValidRange = incomeSource.isValidDate(day, month - 1, year);
            } else if (chipStartDate && chipEndDate) {
                const formattedCellDate = formatDate(cellDate);
                isValidRange = validDates.includes(formattedCellDate);
            } else {
                const formattedCellDate = formatDate(cellDate);
                isValidRange = validDates.includes(formattedCellDate);
            }

            // Consecutive Constraint: The new span must not exceed maxChips
            const isMultiplierStarBonus = chipData.type && chipData.type.startsWith('starBonus') && chipData.type.endsWith('x');
            if (isValidRange && isMultiplierStarBonus && maxChips > 0) {
                if (existingDays.length > 0) {
                    const minEx = existingDays[0];
                    const maxEx = existingDays[existingDays.length - 1];
                    const newMin = Math.min(day, minEx);
                    const newMax = Math.max(day, maxEx);
                    if ((newMax - newMin + 1) > maxChips) {
                        isValidRange = false;
                    }
                }
            }

            const chipsOnThisDate = state.planner.calendar.dates[monthYearKey]?.[dayKey] || [];
            let hasDuplicateType = false;
            let hasConflictingBonus = false;

            const draggedOriginalId = chipData.id.split('-cal')[0];
            const baseDraggedType = chipData.type.replace(/^custom-/, '');

            for (const existingChipId of chipsOnThisDate) {
                const existingOriginalId = existingChipId.split('-cal')[0];
                const cleanExistingId = existingChipId.replace(/^custom-/, '');
                const baseExistingType = cleanExistingId.split('-')[0];

                // Star bonus conflicts
                if (baseDraggedType.startsWith('starBonus') && baseExistingType.startsWith('starBonus')) {
                    // manually created multiplier chips cannot be placed on an already auto placed multiplier chip
                    if (chipData.isCustom && existingChipId.endsWith('-auto')) {
                        hasConflictingBonus = true;
                    }
                }

                // Shop offers, Event Trader, Event Pass, Supercell Events:
                // "if the auto made chip is on a date, another cannot be placed on it."
                if ((baseDraggedType === 'shopOffers' || baseDraggedType === 'eventTrader' || baseDraggedType === 'eventPass' || baseDraggedType === 'supercellEvents') &&
                    (baseExistingType === baseDraggedType)) {
                    if (existingChipId.endsWith('-auto')) {
                        hasDuplicateType = true; // Block placement on auto-made
                    }
                }

                // Generic custom chip
                if (chipData.type === 'custom' || chipData.type === 'extras' || chipData.type.startsWith('custom-') || chipData.type.startsWith('custom') || chipData.type.startsWith('extras')) {
                    // If it has the same custom type name, it should prevent duplicate
                    const draggedCustomType = chipData.customType || '';
                    const existingCustomType = state.planner.calendar.customChipData?.[existingChipId]?.customType || '';
                    if (draggedCustomType && existingCustomType === draggedCustomType && existingOriginalId !== draggedOriginalId) {
                        hasDuplicateType = true;
                    }
                }

                // Default check for other chips that don't have coexistence/replace rules
                if (existingOriginalId !== draggedOriginalId && baseExistingType === baseDraggedType) {
                    if (baseDraggedType !== 'gemTrader' && 
                        baseDraggedType !== 'raidMedalTrader' && 
                        baseDraggedType !== 'clanWar' && 
                        baseDraggedType !== 'cwl' && 
                        baseDraggedType !== 'prospector' && 
                        baseDraggedType !== 'custom' && 
                        !baseDraggedType.startsWith('starBonus') && 
                        baseDraggedType !== 'shopOffers' && 
                        baseDraggedType !== 'eventTrader' && 
                        baseDraggedType !== 'eventPass' && 
                        baseDraggedType !== 'supercellEvents') {
                        hasDuplicateType = true;
                    }
                }
            }

            if (isValidRange && !hasDuplicateType && !hasConflictingBonus) {
                chipContainer.classList.add('valid-drop-range');
                chipContainer.classList.remove('duplicate-chip-type');
            } else if (isValidRange && hasDuplicateType) {
                chipContainer.classList.add('duplicate-chip-type');
                chipContainer.classList.remove('valid-drop-range');
            } else {
                chipContainer.classList.remove('valid-drop-range', 'duplicate-chip-type');
            }
        });

        const incomeChipsContainer = document.getElementById('income-chips-container');
        if (incomeChipsContainer) {
            incomeChipsContainer.classList.add('valid-drop-target');
        }
    };

    const clearDropTargetHighlights = () => {
        const calendarCells = document.querySelectorAll('.day-cell');
        calendarCells.forEach(cell => {
            const chipContainer = cell.querySelector('.chip-container');
            if (chipContainer) {
                chipContainer.classList.remove('valid-drop-range', 'valid-drop-target', 'invalid-drop-target', 'duplicate-chip-type');
            }
        });

        const incomeChipsContainer = document.getElementById('income-chips-container');
        if (incomeChipsContainer) {
            incomeChipsContainer.classList.remove('valid-drop-target');
        }
    };
    
    let dragImage = null;

    chip.addEventListener('dragstart', (e) => {
        if (chip.draggable === false) {
            e.preventDefault();
            return;
        }
        const chipData = { ...data, className: className, id: chip.id };
        draggedChipData = chipData;
        e.dataTransfer.setData('text/plain', JSON.stringify(chipData));
        e.dataTransfer.effectAllowed = 'move';
        highlightDropTargets();

        dragImage = chip.cloneNode(true);
        const tooltip = dragImage.querySelector('.chip-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        dragImage.style.left = '-1000px';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);
    });

    chip.addEventListener('dragend', () => {
        clearDropTargetHighlights();
        if (dragImage && document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
        }
        dragImage = null;
    });

    let touchTimeout;
    let isDragging = false;
    
    chip.addEventListener('touchstart', (e) => {
        if (!chip.draggable) return;
        touchTimeout = setTimeout(() => {
            isDragging = true;
            draggedChipData = { ...data, className: className, id: chip.id };
            highlightDropTargets();

            dragImage = chip.cloneNode(true);
            const tooltip = dragImage.querySelector('.chip-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
            dragImage.classList.add('dragging-clone');
            document.body.appendChild(dragImage);

            const touch = e.touches[0];
            dragImage.style.left = `${touch.pageX - dragImage.offsetWidth / 2}px`;
            dragImage.style.top = `${touch.pageY - dragImage.offsetHeight / 2}px`;
            
            chip.classList.add('dragging');
            state.isChipDragging = true;

        }, 500); 
    }, { passive: true });

    chip.addEventListener('touchmove', (e) => {
        if (isDragging && dragImage) {
            if (e.cancelable) {
                e.preventDefault();
            }
            const touch = e.touches[0];
            dragImage.style.left = `${touch.pageX - dragImage.offsetWidth / 2}px`;
            dragImage.style.top = `${touch.pageY - dragImage.offsetHeight / 2}px`;
        }
    }, { passive: false });

    chip.addEventListener('touchend', (e) => {
        clearTimeout(touchTimeout);
        if (isDragging && dragImage) {
            const touch = e.changedTouches[0];
            const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (dropTarget) {
                const chipContainer = dropTarget.closest('.chip-container');
                if (chipContainer) {
                    handleChipDropOnCalendar(draggedChipData, chipContainer);
                } else {
                    const incomeChipsContainer = dropTarget.closest('#income-chips-container');
                    if (incomeChipsContainer) {
                        handleChipDropOnContainer(draggedChipData);
                    }
                }
            }
        }
        
        if (dragImage && document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
        }
        isDragging = false;
        state.isChipDragging = false;
        dragImage = null;
        chip.classList.remove('dragging');
        clearDropTargetHighlights();
    });

    chip.addEventListener('touchcancel', () => {
        clearTimeout(touchTimeout);
        if (dragImage && document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
        }
        isDragging = false;
        state.isChipDragging = false;
        dragImage = null;
        chip.classList.remove('dragging');
        clearDropTargetHighlights();
    });

    return chip;
}

export function createOverflowChip(count, aggregatedData, type, className) {
    const chip = document.createElement('div');
    chip.classList.add('income-chip', 'overflow-chip', className);
    
    const chipText = document.createElement('span');
    chipText.classList.add('chip-text');
    chipText.textContent = `+${count}`;
    chip.appendChild(chipText);
    
    chip.draggable = false; 
    
    for (const key in aggregatedData) {
        chip.dataset[key] = aggregatedData[key];
    }
    chip.dataset.type = type;

    const tooltip = document.createElement('div');
    tooltip.classList.add('chip-tooltip');
    tooltip.classList.add('active-chip-tooltip-element');
    tooltip.draggable = false;
    const tooltipContent = document.createElement('div');
    tooltipContent.classList.add('tooltip-content');

    const chipName = document.createElement('div');
    chipName.classList.add('tooltip-header');
    const isCustomType = type === 'custom' || type === 'extras' || type.startsWith('custom-') || type.startsWith('custom') || type.startsWith('extras');
    let displayName;
    if (isCustomType) {
        displayName = translate('planner.createCustomChipsModal.typeExtras');
    } else {
        const incomeSource = getSourceById(type);
        displayName = translate(incomeSource?.nameI18nKey || `income.${type}.title`);
    }
    chipName.textContent = translate('ores.moreOf', { count: count, displayName: displayName });
    tooltipContent.appendChild(chipName);

    if (aggregatedData.shiny !== undefined) {
        const shinyOre = document.createElement('div');
        shinyOre.classList.add('ore-count-item');
        shinyOre.innerHTML = `<span>${formatNumber(parseFloat(aggregatedData.shiny))}</span> <img src="assets/shiny_ore.png" alt="${translate('ores.shiny')}" class="ore-icon-small">`;
        tooltipContent.appendChild(shinyOre);
    }
    if (aggregatedData.glowy !== undefined) {
        const glowyOre = document.createElement('div');
        glowyOre.classList.add('ore-count-item');
        glowyOre.innerHTML = `<span>${formatNumber(parseFloat(aggregatedData.glowy))}</span> <img src="assets/glowy_ore.png" alt="${translate('ores.glowy')}" class="ore-icon-small">`;
        tooltipContent.appendChild(glowyOre);
    }
    if (aggregatedData.starry !== undefined) {
        const starryOre = document.createElement('div');
        starryOre.classList.add('ore-count-item');
        starryOre.innerHTML = `<span>${formatNumber(parseFloat(aggregatedData.starry))}</span> <img src="assets/starry_ore.png" alt="${translate('ores.starry')}" class="ore-icon-small">`;
        tooltipContent.appendChild(starryOre);
    }

    tooltip.appendChild(tooltipContent);
    
    const showTooltip = (e) => {
        // Ensure only one chip tooltip exists
        document.querySelectorAll('.active-chip-tooltip-element').forEach(el => {
            if (el.parentNode === document.body) el.parentNode.removeChild(el);
        });

        document.body.appendChild(tooltip);
        tooltip.classList.add('visible');

        const rect = chip.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;

        let left = rect.left + rect.width / 2 + scrollX;
        let top = rect.bottom + scrollY + 10; // Position below

        tooltip.style.position = 'absolute';
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.zIndex = '1000';

        // Boundary check
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.left < 10) {
            tooltip.style.left = `${10 + tooltipRect.width / 2 + scrollX}px`;
        } else if (tooltipRect.right > window.innerWidth - 10) {
            tooltip.style.left = `${window.innerWidth - 10 - tooltipRect.width / 2 + scrollX}px`;
        }
    };

    const hideTooltip = () => {
        tooltip.classList.remove('visible');
        if (tooltip.parentNode === document.body) {
            document.body.removeChild(tooltip);
        }
    };

    chip.addEventListener('mouseenter', showTooltip);
    chip.addEventListener('mouseleave', hideTooltip);
    chip.addEventListener('dragstart', hideTooltip); 
    chip.addEventListener('touchstart', hideTooltip);

    return chip;
}

export function renderIncomeChipsLegend(legendContainer) {
    if (!legendContainer) {
        console.error('Income chips legend container not found.');
        return;
    }

    legendContainer.innerHTML = '';

    // Use a shared map to keep track of active timeout IDs for each class
    // This prevents multiple rapid clicks from causing weird flickering behaviors
    const glowTimeouts = new Map();

    const processLegendItem = (item, sourceId) => {
        const legendItemDiv = document.createElement('div');
        legendItemDiv.classList.add('legend-item');

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
                const chips = calendarContainer.querySelectorAll(`.income-chip.${item.className}`);
                chips.forEach(chip => chip.classList.add('legend-highlight'));
            }
        });

        legendItemDiv.addEventListener('mouseleave', () => {
            const calendarContainer = document.getElementById('calendar-container');
            if (calendarContainer) {
                const chips = calendarContainer.querySelectorAll(`.income-chip.${item.className}`);
                chips.forEach(chip => chip.classList.remove('legend-highlight'));
            }
        });

        legendItemDiv.addEventListener('click', () => {
            const calendarContainer = document.getElementById('calendar-container');
            if (calendarContainer) {
                // Scroll the calendar into view
                calendarContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const chips = calendarContainer.querySelectorAll(`.income-chip.${item.className}`);
                
                // Add the persistent glow class
                chips.forEach(chip => chip.classList.add('persistent-glow'));

                // Clear any existing timeout for this specific chip class
                if (glowTimeouts.has(item.className)) {
                    clearTimeout(glowTimeouts.get(item.className));
                }

                // Set a timeout to remove the persistent glow after 5 seconds
                const timeoutId = setTimeout(() => {
                    chips.forEach(chip => chip.classList.remove('persistent-glow'));
                    glowTimeouts.delete(item.className);
                }, 5000);

                glowTimeouts.set(item.className, timeoutId);
            }
        });

        legendContainer.appendChild(legendItemDiv);

        // Process subcategories if any
        if (item.subCategories) {
            item.subCategories.forEach(sub => processLegendItem(sub, sub.id));
        }
    };

    Object.entries(incomeData).forEach(([key, value]) => {
        processLegendItem(value, key);
    });

    // Add custom legend item at the end
    const customLegendItem = {
        nameI18nKey: 'planner.createCustomChipsModal.typeExtras',
        className: 'custom-chip'
    };
    processLegendItem(customLegendItem, 'custom');
}

function getShortName(type, fullName) {
    const key = `income.shortcuts.${type}`;
    const translated = translate(key);
    if (translated && translated !== key) {
        // Strip [EN] prefix if we fallback to English under a different language,
        // or just keep it simple. Usually we want the clean text. Let's strip the prefix if it exists.
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