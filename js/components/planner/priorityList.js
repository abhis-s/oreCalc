import { heroData } from '../../data/heroData.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';

function addSeparatorLine() {
    const priorityListContainer = document.getElementById('priority-list-container');
    if (!priorityListContainer) return;

    const existingSeparator = priorityListContainer.querySelector('.priority-separator-line');
    if (existingSeparator) {
        existingSeparator.remove();
    }

    const listItems = Array.from(priorityListContainer.children);
    let targetElement = null;

    // Iterate from bottom to top
    for (let i = listItems.length - 1; i >= 0; i--) {
        const item = listItems[i];
        const img = item.querySelector('.equipment-info img');
        if (img && img.classList.contains('custom-max-glow')) {
        } else {
            // This is the first non-custom-maxed item from the bottom
            targetElement = item;
            break;
        }
    }

    // If targetElement is null, it means all items are custom maxed, so no line is needed.
    if (targetElement) {
        const separator = document.createElement('div');
        separator.classList.add('priority-separator-line');
        // Insert the separator after the targetElement
        targetElement.parentNode.insertBefore(separator, targetElement.nextSibling);
    }
}

function savePriorityOrder() {
    const priorityListContainer = document.getElementById('priority-list-container');
    if (!priorityListContainer) return;

    const listItems = Array.from(priorityListContainer.children);
    const equipmentItems = listItems.filter(item => item.classList.contains('priority-list-item'));
    const separatorIndex = listItems.findIndex(item => item.classList.contains('favorite-separator'));

    handleStateUpdate(() => {
        equipmentItems.forEach((item, index) => {
            const equipName = item.dataset.equipmentName;
            for (const heroKey in state.heroes) {
                const hero = state.heroes[heroKey];
                if (hero.equipment[equipName]) {
                    hero.equipment[equipName].priority = index + 1;
                }
            }
        });

        if (separatorIndex !== -1) {
            const itemsBeforeSeparator = listItems.slice(0, separatorIndex);
            const equipmentBeforeSeparator = itemsBeforeSeparator.filter(item => item.classList.contains('priority-list-item')).length;
            state.planner.priorityList.remainingFavorites = equipmentBeforeSeparator;
        } else {
            state.planner.priorityList.remainingFavorites = 0;
        }
    });
}

export function initializePriorityList() {
    const priorityListCard = document.getElementById('priority-list-card');
    if (!priorityListCard) return;

    priorityListCard.innerHTML = '';

    const header = document.createElement('h3');
    header.textContent = 'Priority List';
    priorityListCard.appendChild(header);

    const priorityListContainer = document.createElement('div');
    priorityListContainer.id = 'priority-list-container';
    priorityListContainer.classList.add('priority-list-content');
    priorityListCard.appendChild(priorityListContainer);

    const allEquipment = [];
    for (const heroKey in heroData) {
        const hero = heroData[heroKey];
        if (state.heroes[hero.name].enabled) {
            hero.equipment.forEach(equip => {
                if (state.heroes[hero.name].equipment[equip.name].checked) {
                    const currentLevel = state.heroes[hero.name].equipment[equip.name].level;
                    const trueMaxLevel = equip.type === 'common' ? 18 : 27;

                    if (currentLevel < trueMaxLevel) {
                        allEquipment.push({
                            ...equip,
                            hero: hero.name,
                            currentLevel: currentLevel,
                            customMaxLevel: equip.type === 'common' ? state.planner.customMaxLevel.common : state.planner.customMaxLevel.epic,
                            priority: state.heroes[hero.name].equipment[equip.name].priority
                        });
                    }
                }
            });
        }
    }

    // Sort by priority, then by custom max level
    allEquipment.sort((a, b) => {
        if (a.priority !== 0 && b.priority !== 0) {
            return a.priority - b.priority;
        } else if (a.priority !== 0) {
            return -1;
        } else if (b.priority !== 0) {
            return 1;
        }

        const aAtCustomMax = a.currentLevel >= a.customMaxLevel;
        const bAtCustomMax = b.currentLevel >= b.customMaxLevel;

        if (aAtCustomMax && !bAtCustomMax) {
            return 1;
        }
        if (!aAtCustomMax && bAtCustomMax) {
            return -1;
        }
        return 0;
    });

    allEquipment.forEach(equip => {
        const listItem = document.createElement('div');
        listItem.classList.add('priority-list-item');
        listItem.draggable = true;
        listItem.dataset.equipmentName = equip.name;

        const equipmentInfo = document.createElement('div');
        equipmentInfo.classList.add('equipment-info');

        const equipmentImage = document.createElement('img');
        equipmentImage.src = equip.image;
        equipmentImage.alt = equip.name;

        if (equip.currentLevel >= equip.customMaxLevel) {
            equipmentImage.classList.add('custom-max-glow');
        }

        const equipmentName = document.createElement('span');
        equipmentName.textContent = equip.name;

        equipmentInfo.appendChild(equipmentImage);
        equipmentInfo.appendChild(equipmentName);

        const dragHandle = document.createElement('div');
        dragHandle.classList.add('drag-handle');
        dragHandle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M160-360v-80h640v80H160Zm0-160v-80h640v80H160Z"/></svg>`;

        listItem.appendChild(equipmentInfo);
        listItem.appendChild(dragHandle);

        priorityListContainer.appendChild(listItem);
    });

    const favoriteSeparator = document.createElement('div');
    favoriteSeparator.classList.add('favorite-separator');
    favoriteSeparator.draggable = true;
    const separatorIndex = state.planner.priorityList.remainingFavorites || 0;
    priorityListContainer.insertBefore(favoriteSeparator, priorityListContainer.children[separatorIndex]);

    addSeparatorLine();

    let draggedItem = null;

    priorityListContainer.addEventListener('dragstart', (e) => {
        draggedItem = e.target;
        draggedItem.classList.add('dragging');
    });

    priorityListContainer.addEventListener('dragend', (e) => {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
        addSeparatorLine();
        savePriorityOrder();
    });

    priorityListContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(priorityListContainer, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (afterElement == null) {
            priorityListContainer.appendChild(dragging);
        } else {
            priorityListContainer.insertBefore(dragging, afterElement);
        }
        addSeparatorLine();
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.priority-list-item:not(.dragging), .favorite-separator:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
