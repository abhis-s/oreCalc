import { state } from '../../core/state.js';

import { formatDate } from '../../utils/dateFormatter.js';
import { getSVG } from '../../utils/svgManager.js';
import { heroData } from '../../data/heroData.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { translate } from '../../i18n/translator.js';

import { openPriorityListModal, getGlobalPriorityList, getStepOrderErrors } from './priorityListModal.js';

import { createHeroIcon } from '../common/heroDisplayFactory.js';

export function initializePriorityList() {
    const priorityListCard = document.getElementById('priority-list-card');
    if (!priorityListCard) return;

    priorityListCard.innerHTML = '';

    const header = document.createElement('div');
    header.classList.add('priority-list-header');

    const title = document.createElement('h3');
    title.textContent = translate('planner.priorityList');
    header.appendChild(title);

    const editButton = document.createElement('button');
    editButton.classList.add('edit-priority-list-btn');
    editButton.setAttribute('aria-label', translate('planner.editPriorityList') || 'Edit Priority List');
    editButton.innerHTML = getSVG('edit', '', 24, 24, 'currentColor');
    editButton.addEventListener('click', () => {
        openPriorityListModal(); 
    });
    header.appendChild(editButton);

    priorityListCard.appendChild(header);

    const priorityListContainer = document.createElement('div');
    priorityListContainer.id = 'priority-list-container';
    priorityListContainer.classList.add('priority-list-content');
    priorityListCard.appendChild(priorityListContainer);

    const { globalPriorityList } = getGlobalPriorityList();

    if (globalPriorityList.error) {
        const errorMessage = document.createElement('p');
        errorMessage.classList.add('placeholder-text', 'error-text');
        errorMessage.textContent = globalPriorityList.message;
        priorityListContainer.appendChild(errorMessage);
        return;
    }

    const { errorItems } = getStepOrderErrors(globalPriorityList);

    const visiblePriorityList = globalPriorityList.filter(item => {
        const currentLevel = state.heroes[item.heroName]?.equipment[item.name]?.level || 1;
        return item.targetLevel > currentLevel;
    });

    if (visiblePriorityList.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.classList.add('placeholder-text');
        placeholder.textContent = translate('planner.noPriorityItems');
        priorityListContainer.appendChild(placeholder);
        return;
    }

    let firstErrorIndex = -1;
    visiblePriorityList.forEach((item, index) => {
        const itemKey = `${item.name}-${item.step}`;
        if ((item.error || errorItems.has(itemKey)) && firstErrorIndex === -1) {
            firstErrorIndex = index;
        }
    });

    const itemsToShow = firstErrorIndex === -1 ? visiblePriorityList : visiblePriorityList.slice(0, firstErrorIndex);

    itemsToShow.forEach(item => {
        const listItem = document.createElement('div');
        listItem.classList.add('priority-list-item');

        const equipmentInfo = document.createElement('div');
        equipmentInfo.classList.add('equipment-info');

        const imageContainer = document.createElement('div');
        imageContainer.classList.add('equipment-image-container');

        const equipmentImage = document.createElement('orecalc-assets-image');
        equipmentImage.setAttribute('src', item.image);
        equipmentImage.setAttribute('alt', translate('equipment.' + toCamelCase(item.name)));
        equipmentImage.setAttribute('class', 'equipment-image');
        equipmentImage.setAttribute('size', 'thumbnail');

        const levelBox = document.createElement('div');
        levelBox.classList.add('equipment-level-box');
        levelBox.textContent = item.targetLevel;

        imageContainer.appendChild(equipmentImage);
        imageContainer.appendChild(levelBox);

        const equipmentName = document.createElement('span');
        equipmentName.textContent = translate('planner.nameStep', { equipmentName: translate('equipment.' + toCamelCase(item.name)), step: item.step });

        let completionDateText;
        if (item.completionDate) {
            completionDateText = `${translate('planner.completeByColon')} ${formatDate(item.completionDate, { month: 'short', day: 'numeric' })}`;
        } else {
            completionDateText = translate('planner.notEnoughIncome');
        }

        const completionDateElement = document.createElement('div');
        completionDateElement.classList.add('priority-item-date');
        completionDateElement.textContent = completionDateText;
        
        const itemTextContent = document.createElement('div');
        itemTextContent.classList.add('item-text-content');
        itemTextContent.appendChild(equipmentName);
        itemTextContent.appendChild(completionDateElement);
        equipmentInfo.appendChild(imageContainer);
        equipmentInfo.appendChild(itemTextContent);
        listItem.appendChild(equipmentInfo);
        priorityListContainer.appendChild(listItem);
    });

    if (firstErrorIndex !== -1) {
        const separator = document.createElement('div');
        separator.className = 'priority-error-truncated-separator';
        priorityListContainer.appendChild(separator);

        const errorMsg = document.createElement('p');
        errorMsg.className = 'priority-error-truncated-msg';
        errorMsg.innerHTML = `${getSVG('error', '', 18, 18, 'currentColor')} <span>${translate('planner.resolveErrorsToViewPlan')}</span>`;
        priorityListContainer.appendChild(errorMsg);
    }
}