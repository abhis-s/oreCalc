import { incomeData } from '../data/incomeChipData.js';
import { getScheduleDates, getDatesInRange } from './dateUtils.js';
import { state } from '../core/state.js';

function createIncomeChip(text, className, data, month, year, id = null) {
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
        const { startDate, endDate } = getScheduleDates(year, month, incomeSource.schedule, data.instance);
        if (startDate) {
            chip.dataset.startDate = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
        }
        if (endDate) {
            chip.dataset.endDate = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
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
    chipName.textContent = displayName;
    tooltipContent.appendChild(chipName);

    if (chipData.shiny !== undefined) {
        const shinyOre = document.createElement('div');
        shinyOre.classList.add('ore-count-item');
        shinyOre.innerHTML = `<span>${chipData.shiny}</span> <img src="assets/shiny_ore.png" alt="Shiny Ore" class="ore-icon-small">`;
        tooltipContent.appendChild(shinyOre);
    }
    if (chipData.glowy !== undefined) {
        const glowyOre = document.createElement('div');
        glowyOre.classList.add('ore-count-item');
        glowyOre.innerHTML = `<span>${chipData.glowy}</span> <img src="assets/glowy_ore.png" alt="Glowy Ore" class="ore-icon-small">`;
        tooltipContent.appendChild(glowyOre);
    }
    if (chipData.starry !== undefined) {
        const starryOre = document.createElement('div');
        starryOre.classList.add('ore-count-item');
        starryOre.innerHTML = `<span>${chipData.starry}</span> <img src="assets/starry_ore.png" alt="Starry Ore" class="ore-icon-small">`;
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

    chip.addEventListener('dragstart', (e) => {
        const chipData = { ...data, className: className, id: chip.id };

        if (chip.dataset.startDate) {
            chipData.startDate = chip.dataset.startDate;
        }
        if (chip.dataset.endDate) {
            chipData.endDate = chip.dataset.endDate;
        }

        e.dataTransfer.setData('text/plain', JSON.stringify(chipData));
        e.dataTransfer.effectAllowed = 'move';

        const formatDate = (date) => {
            if (!date) return null;
            const d = new Date(date);
            const day = String(d.getUTCDate()).padStart(2, '0');
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const year = d.getUTCFullYear();
            return `${day}-${month}-${year}`;
        };

        const [calMonth, calYear] = state.planner.calendar.view.month.split('-').map(Number);

        const validDates = getDatesInRange({
            startDate: chipData.startDate ? formatDate(chipData.startDate) : null,
            endDate: chipData.endDate ? formatDate(chipData.endDate) : null,
            month: calMonth,
            year: calYear
        });

        const calendarCells = document.querySelectorAll('.day-cell');
        calendarCells.forEach(cell => {
            const chipContainer = cell.querySelector('.chip-container');
            if (!chipContainer) return;

            const cellDate = cell.dataset.date; // YYYY-MM-DD format
            const formattedCellDate = formatDate(cellDate); // Convert to DD-MM-YYYY for comparison
            const [year, month, day] = cellDate.split('-'); // Keep YYYY-MM-DD for state access
            const monthYearKey = `${month}-${year}`; // MM-YYYY
            const dayKey = day; // DD

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

        // Add visual feedback for the income chips container
        const incomeChipsContainer = document.getElementById('income-chips-container');
        if (incomeChipsContainer) {
            incomeChipsContainer.classList.add('valid-drop-target');
        }

        const dragImage = document.createElement('div');
        dragImage.style.width = '50px';
        dragImage.style.height = '20px';
        dragImage.style.borderRadius = '10px';
        dragImage.style.opacity = '0.7';

        const itemColor = incomeData[data.type]?.color;
        dragImage.style.backgroundColor = itemColor || '#ccc';

        dragImage.style.position = 'absolute';
        dragImage.style.top = '-1000px';
        dragImage.style.left = '-1000px';

        document.body.appendChild(dragImage);

        e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);

        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 0);
    });

    chip.addEventListener('dragend', () => {
        const calendarCells = document.querySelectorAll('.day-cell');
        calendarCells.forEach(cell => {
            const chipContainer = cell.querySelector('.chip-container');
            if (chipContainer) {
                chipContainer.classList.remove('valid-drop-range', 'valid-drop-target', 'invalid-drop-target');
            }
        });

        // Remove visual feedback from the income chips container
        const incomeChipsContainer = document.getElementById('income-chips-container');
        if (incomeChipsContainer) {
            incomeChipsContainer.classList.remove('valid-drop-target');
        }
    });

    return chip;
}

function createOverflowChip(count, aggregatedData, type, className) {
    const chip = document.createElement('div');
    chip.classList.add('income-chip', 'overflow-chip', className);
    chip.textContent = `+${count}`;
    chip.draggable = false; // Overflow chips are not draggable

    // Store aggregated data in dataset
    for (const key in aggregatedData) {
        chip.dataset[key] = aggregatedData[key];
    }
    chip.dataset.type = type;

    // Add a simple tooltip for overflow chip to show aggregated values
    const tooltip = document.createElement('div');
    tooltip.classList.add('chip-tooltip');
    tooltip.draggable = false;
    const tooltipContent = document.createElement('div');
    tooltipContent.classList.add('tooltip-content');

    const chipName = document.createElement('div');
    const displayName = incomeData[type]?.name || type;
    chipName.textContent = `${count} more of ${displayName}`;
    tooltipContent.appendChild(chipName);

    if (aggregatedData.shiny !== undefined) {
        const shinyOre = document.createElement('div');
        shinyOre.classList.add('ore-count-item');
        shinyOre.innerHTML = `<span>${aggregatedData.shiny}</span> <img src="assets/shiny_ore.png" alt="Shiny Ore" class="ore-icon-small">`;
        tooltipContent.appendChild(shinyOre);
    }
    if (aggregatedData.glowy !== undefined) {
        const glowyOre = document.createElement('div');
        glowyOre.classList.add('ore-count-item');
        glowyOre.innerHTML = `<span>${aggregatedData.glowy}</span> <img src="assets/glowy_ore.png" alt="Glowy Ore" class="ore-icon-small">`;
        tooltipContent.appendChild(glowyOre);
    }
    if (aggregatedData.starry !== undefined) {
        const starryOre = document.createElement('div');
        starryOre.classList.add('ore-count-item');
        starryOre.innerHTML = `<span>${aggregatedData.starry}</span> <img src="assets/starry_ore.png" alt="Starry Ore" class="ore-icon-small">`;
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

function renderIncomeChipsLegend(legendContainer) {
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
        legendTextSpan.textContent = item.name;
        legendItemDiv.appendChild(legendTextSpan);

        legendContainer.appendChild(legendItemDiv);
    }
}

export { createIncomeChip, renderIncomeChipsLegend, createOverflowChip };