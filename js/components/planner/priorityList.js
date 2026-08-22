import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { formatDate } from '../../utils/dateUtils.js';
import { toCamelCase } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';

import { openPriorityListModal } from './priorityListModalInputs.js';
import { getGlobalPriorityList, getStepOrderErrors } from './priorityListScheduler.js';

let loadingTimeoutId = null;
let forceRender = false;

/**
 * Renders the jumping dots loader inside the priority list container.
 * @param {HTMLElement} container
 */
function renderPriorityListLoader(container) {
    container.innerHTML = `
        <div class="priority-list-loader">
            <span class="button-loader"><span></span><span></span><span></span></span>
        </div>
    `;
}

/**
 * Initializes and renders the Planner priority list card, header controls, edit button, and equipment rows.
 * @param {any} [options={}] - Configuration options.
 */
export function initializePriorityList(options = {}) {
    const priorityListCard = document.getElementById('priority-list-card');
    if (!priorityListCard) return;

    priorityListCard.innerHTML = '';

    const header = document.createElement('div');
    header.classList.add('priority-list-header');

    const title = document.createElement('h3');
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.gap = '6px';
    title.style.margin = '0';

    const titleText = document.createElement('span');
    titleText.dataset.i18n = 'views.planner.priorityList';
    titleText.textContent = translate('views.planner.priorityList');
    title.appendChild(titleText);

    const infoBtn = document.createElement('button');
    infoBtn.className = 'info-btn';
    infoBtn.dataset.info = 'views.planner.priorityListHelp';
    infoBtn.setAttribute('aria-label', translate('actions.showInfo'));
    infoBtn.dataset.i18nAriaLabel = 'actions.showInfo';
    infoBtn.innerHTML = '<orecalc-assets-svg name="info" class="info-icon" height="16" width="16"></orecalc-assets-svg>';
    title.appendChild(infoBtn);

    header.appendChild(title);

    const editButton = document.createElement('button');
    editButton.classList.add('edit-priority-list-btn');
    editButton.setAttribute('aria-label', translate('views.planner.editPriorityList'));
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

    const isCalendarHydrated = state.planner?.calendar?.isHydrated === true;

    if (isCalendarHydrated) {
        forceRender = false;
        if (loadingTimeoutId !== null) {
            clearTimeout(loadingTimeoutId);
            loadingTimeoutId = null;
        }
    }

    const { globalPriorityList } = getGlobalPriorityList();

    const { errorItems } = getStepOrderErrors(globalPriorityList);

    const visiblePriorityList = globalPriorityList.filter(item => {
        const currentLevel = state.heroes[item.heroName]?.equipment[item.name]?.level || 1;
        return item.targetLevel > currentLevel;
    });

    if (visiblePriorityList.length === 0) {
        const placeholder = document.createElement('p');
        placeholder.classList.add('placeholder-text');
        placeholder.textContent = translate('views.planner.noPriorityItems');
        priorityListContainer.appendChild(placeholder);
        return;
    }

    if ((!isCalendarHydrated && !forceRender) || options.loading) {
        renderPriorityListLoader(priorityListContainer);

        if (!loadingTimeoutId && !isCalendarHydrated && !forceRender) {
            loadingTimeoutId = setTimeout(() => {
                forceRender = true;
                loadingTimeoutId = null;
                initializePriorityList();
            }, 1500);
        }
        return;
    }

    let firstErrorIndex = -1;
    visiblePriorityList.forEach((item, index) => {
        const itemKey = `${item.name}-${item.step}`;
        if ((errorItems.has(itemKey) || (item.error && item.message)) && firstErrorIndex === -1) {
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
        equipmentImage.setAttribute('alt', translate('entities.equipment.' + toCamelCase(item.name)));
        equipmentImage.setAttribute('class', 'equipment-image');
        equipmentImage.setAttribute('size', 'thumbnail');

        const levelBox = document.createElement('div');
        levelBox.classList.add('equipment-level-box');
        levelBox.textContent = item.targetLevel;

        imageContainer.appendChild(equipmentImage);
        imageContainer.appendChild(levelBox);

        const equipmentName = document.createElement('span');
        equipmentName.textContent = translate('views.planner.nameStep', { equipmentName: translate('entities.equipment.' + toCamelCase(item.name)), step: item.step });

        let completionDateText;
        if (item.completionDate) {
            completionDateText = `${translate('views.planner.completeByColon')} ${formatDate(item.completionDate, { month: 'short', day: 'numeric' })}`;
        } else {
            completionDateText = translate('views.planner.notEnoughIncome');
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
        errorMsg.innerHTML = `${getSVG('error', '', 18, 18, 'currentColor')} <span>${translate('views.planner.resolveErrorsToViewPlan')}</span>`;
        priorityListContainer.appendChild(errorMsg);
    }
}

document.addEventListener('priorityListUpdated', () => {
    initializePriorityList();
});
