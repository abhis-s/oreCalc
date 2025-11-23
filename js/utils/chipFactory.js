import { incomeData } from '../data/incomeChipData.js';
import { getScheduleDates } from './dateUtils.js';
import { state } from '../core/state.js';
import { translate } from '../i18n/translator.js';
import { formatNumber } from './numberFormatter.js';
import { handleChipDropOnCalendar } from '../components/planner/calendar.js';
import { handleChipDropOnContainer } from '../components/planner/incomeChips.js';

let draggedChipData = null;

export function createIncomeChip(text, className, data, month, year, id = null) {
    const chip = document.createElement('div');
    const monthStr = String(month + 1).padStart(2, '0');
    const instanceStr = String(data.instance || 'monthly').padStart(2, '0');
    chip.id = id || `${data.type}-${instanceStr}-${monthStr}-${year}`;
    chip.classList.add('income-chip', className);
    chip.textContent = text;
    chip.draggable = true;

    const chipData = { ...data, className: className, id: chip.id };

    const incomeSource = incomeData[data.type];
    if (incomeSource && incomeSource.schedule) {
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

    for (const key in chipData) {
        chip.dataset[key] = chipData[key];
    }

    const tooltip = document.createElement('div');
    tooltip.classList.add('chip-tooltip');
    tooltip.draggable = false;
    const tooltipContent = document.createElement('div');
    tooltipContent.classList.add('tooltip-content');

    const chipName = document.createElement('div');
    const displayName = incomeData[data.type]?.name || data.type;
    chipName.textContent = translate(displayName.toLowerCase().replace(/\s/g, '_'));
    tooltipContent.appendChild(chipName);

    if (chipData.shiny !== undefined) {
        const shinyOre = document.createElement('div');
        shinyOre.classList.add('ore-count-item');
        shinyOre.innerHTML = `<span>${formatNumber(chipData.shiny)}</span> <img src="assets/shiny_ore.png" alt="${translate('shiny_ore')}" class="ore-icon-small">`;
        tooltipContent.appendChild(shinyOre);
    }
    if (chipData.glowy !== undefined) {
        const glowyOre = document.createElement('div');
        glowyOre.classList.add('ore-count-item');
        glowyOre.innerHTML = `<span>${formatNumber(chipData.glowy)}</span> <img src="assets/glowy_ore.png" alt="${translate('glowy_ore')}" class="ore-icon-small">`;
        tooltipContent.appendChild(glowyOre);
    }
    if (chipData.starry !== undefined) {
        const starryOre = document.createElement('div');
        starryOre.classList.add('ore-count-item');
        starryOre.innerHTML = `<span>${formatNumber(chipData.starry)}</span> <img src="assets/starry_ore.png" alt="${translate('starry_ore')}" class="ore-icon-small">`;
        tooltipContent.appendChild(starryOre);
    }

    tooltip.appendChild(tooltipContent);
    chip.appendChild(tooltip);

    chip.addEventListener('mouseenter', () => {
        tooltip.classList.add('visible');
    });
    chip.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
    });

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

        let validDates = [];
        if (chipStartDate && chipEndDate) {
            let currentDate = new Date(chipStartDate + 'T00:00:00Z');
            const endDate = new Date(chipEndDate + 'T00:00:00Z');
            while (currentDate <= endDate) {
                validDates.push(formatDate(currentDate));
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }
        } else {
            const schedule = incomeData[chipData.type].schedule;
            const scheduledDates = getScheduleDates(calYear, calMonth - 1, schedule);
            validDates = scheduledDates.map(date => formatDate(date));
        }

        const calendarCells = document.querySelectorAll('.day-cell');
        calendarCells.forEach(cell => {
            const chipContainer = cell.querySelector('.chip-container');
            if (!chipContainer) return;

            const cellDate = cell.dataset.date;
            const formattedCellDate = formatDate(cellDate);
            const [year, month, day] = cellDate.split('-');
            const monthYearKey = `${month}-${year}`;
            const dayKey = day;

            const chipsOnThisDate = state.planner.calendar.dates[monthYearKey]?.[dayKey] || [];
            let hasDuplicateType = false;

            for (const existingChipId of chipsOnThisDate) {
                const existingChipType = existingChipId.split('-')[0];
                if (existingChipType === chipData.type) {
                    hasDuplicateType = true;
                    break;
                }
            }

            if (validDates.includes(formattedCellDate) && !hasDuplicateType) {
                chipContainer.classList.add('valid-drop-range');
                chipContainer.classList.remove('duplicate-chip-type');
            } else if (validDates.includes(formattedCellDate) && hasDuplicateType) {
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
            e.preventDefault();
            const touch = e.touches[0];
            dragImage.style.left = `${touch.pageX - dragImage.offsetWidth / 2}px`;
            dragImage.style.top = `${touch.pageY - dragImage.offsetHeight / 2}px`;
        }
    });

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
    chip.textContent = `+${count}`;
    chip.draggable = false; 
    
    for (const key in aggregatedData) {
        chip.dataset[key] = aggregatedData[key];
    }
    chip.dataset.type = type;

    const tooltip = document.createElement('div');
    tooltip.classList.add('chip-tooltip');
    tooltip.draggable = false;
    const tooltipContent = document.createElement('div');
    tooltipContent.classList.add('tooltip-content');

    const chipName = document.createElement('div');
    const displayName = incomeData[type]?.name || type;
    chipName.textContent = translate('more_of', { count: count, displayName: translate(displayName.toLowerCase().replace(/\s/g, '_')) });
    tooltipContent.appendChild(chipName);

    if (aggregatedData.shiny !== undefined) {
        const shinyOre = document.createElement('div');
        shinyOre.classList.add('ore-count-item');
        shinyOre.innerHTML = `<span>${aggregatedData.shiny}</span> <img src="assets/shiny_ore.png" alt="${translate('shiny_ore')}" class="ore-icon-small">`;
        tooltipContent.appendChild(shinyOre);
    }
    if (aggregatedData.glowy !== undefined) {
        const glowyOre = document.createElement('div');
        glowyOre.classList.add('ore-count-item');
        glowyOre.innerHTML = `<span>${aggregatedData.glowy}</span> <img src="assets/glowy_ore.png" alt="${translate('glowy_ore')}" class="ore-icon-small">`;
        tooltipContent.appendChild(glowyOre);
    }
    if (aggregatedData.starry !== undefined) {
        const starryOre = document.createElement('div');
        starryOre.classList.add('ore-count-item');
        starryOre.innerHTML = `<span>${aggregatedData.starry}</span> <img src="assets/starry_ore.png" alt="${translate('starry_ore')}" class="ore-icon-small">`;
        tooltipContent.appendChild(starryOre);
    }

    tooltip.appendChild(tooltipContent);
    chip.appendChild(tooltip);

    chip.addEventListener('mouseenter', () => {
        tooltip.classList.add('visible');
    });
    chip.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
    });

    return chip;
}

export function renderIncomeChipsLegend(legendContainer) {
    if (!legendContainer) {
        console.error('Income chips legend container not found.');
        return;
    }

    legendContainer.innerHTML = '';

    for (const key in incomeData) {
        const item = incomeData[key];
        const legendItemDiv = document.createElement('div');
        legendItemDiv.classList.add('legend-item');

        const colorBoxDiv = document.createElement('div');
        colorBoxDiv.classList.add('color-box');
        colorBoxDiv.style.backgroundColor = item.color;
        legendItemDiv.appendChild(colorBoxDiv);

        const legendTextSpan = document.createElement('span');
        legendTextSpan.classList.add('legend-text');
        legendTextSpan.textContent = translate(item.name.toLowerCase().replace(/\s/g, '_'));
        legendItemDiv.appendChild(legendTextSpan);

        legendContainer.appendChild(legendItemDiv);
    }
}
