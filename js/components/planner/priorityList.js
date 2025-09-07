import { heroData } from '../../data/heroData.js';
import { state } from '../../core/state.js';
import { openPriorityListModal, getGlobalPriorityList } from './priorityListModal.js';

export function initializePriorityList() {
    const priorityListCard = document.getElementById('priority-list-card');
    if (!priorityListCard) return;

    // Clear previous content
    priorityListCard.innerHTML = '';

    // Create header
    const header = document.createElement('div');
    header.classList.add('priority-list-header');

    const title = document.createElement('h3');
    title.textContent = 'Priority List';
    header.appendChild(title);

    const editButton = document.createElement('button');
    editButton.classList.add('edit-priority-list-btn');
    editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>`;
    editButton.addEventListener('click', () => {
        openPriorityListModal(); // Assuming this function exists elsewhere
    });
    header.appendChild(editButton);

    priorityListCard.appendChild(header);

    // Create list container
    const priorityListContainer = document.createElement('div');
    priorityListContainer.id = 'priority-list-container';
    priorityListContainer.classList.add('priority-list-content');
    priorityListCard.appendChild(priorityListContainer);

    // Get and process data
    const globalPriorityList = getGlobalPriorityList();

    // Check if the returned value is an error object
    if (globalPriorityList.error) {
        const errorMessage = document.createElement('p');
        errorMessage.classList.add('placeholder-text', 'error-text');
        errorMessage.textContent = globalPriorityList.message;
        priorityListContainer.appendChild(errorMessage);
        return;
    }

    const visiblePriorityList = globalPriorityList.filter(item => {
        // Assuming 'state' object is accessible
        const currentLevel = state.heroes[item.heroName]?.equipment[item.name]?.level || 1;
        return item.targetLevel > currentLevel;
    });

    const priorityListToDisplay = visiblePriorityList.slice(0, 4);

    // Handle empty list case
    if (priorityListToDisplay.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.classList.add('placeholder-text');
        placeholder.textContent = 'No priority items set. Click "Edit" to add some.';
        priorityListContainer.appendChild(placeholder);
        return;
    }

    // Build and append list items
    priorityListToDisplay.forEach(item => {
        const listItem = document.createElement('div');
        listItem.classList.add('priority-list-item');

        const equipmentInfo = document.createElement('div');
        equipmentInfo.classList.add('equipment-info');

        // Image container
        const imageContainer = document.createElement('div');
        imageContainer.classList.add('equipment-image-container');

        const equipmentImage = document.createElement('img');
        equipmentImage.src = item.image;
        equipmentImage.alt = item.name;
        equipmentImage.classList.add('equipment-image');

        const levelBox = document.createElement('div');
        levelBox.classList.add('equipment-level-box');
        levelBox.textContent = item.targetLevel;

        imageContainer.appendChild(equipmentImage);
        imageContainer.appendChild(levelBox);

        // Name element
        const equipmentName = document.createElement('span');
        equipmentName.textContent = `${item.name} (#${item.step})`;

        // Date element
        const completionDateText = item.completionDate ?
            item.completionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) :
            'Not enough income';

        const completionDateElement = document.createElement('div');
        completionDateElement.classList.add('priority-item-date');
        completionDateElement.textContent = `Complete by: ${completionDateText}`;

        // Create the wrapper for text content
        const itemTextContent = document.createElement('div');
        itemTextContent.classList.add('item-text-content');

        // Append name and date to the wrapper
        itemTextContent.appendChild(equipmentName);
        itemTextContent.appendChild(completionDateElement);

        // Append image and the new text wrapper to the main info container
        equipmentInfo.appendChild(imageContainer);
        equipmentInfo.appendChild(itemTextContent);

        // Append the fully constructed info section to the list item
        listItem.appendChild(equipmentInfo);

        // Finally, append the list item to the container
        priorityListContainer.appendChild(listItem);
    });
}
