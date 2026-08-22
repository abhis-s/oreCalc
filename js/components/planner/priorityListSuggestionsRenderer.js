import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { getSVG } from '../../utils/svgManager.js';

import { getStepOrderErrors } from './priorityListScheduler.js';

let suggestionsHidden = false;
let previousValidPriorityOrder = null;

/**
 * Returns whether optimization suggestions are currently hidden in the Priority List modal.
 * @returns {boolean} True if suggestions are hidden.
 */
export function getSuggestionsHidden() {
    return suggestionsHidden;
}

/**
 * Sets whether optimization suggestions are hidden in the Priority List modal.
 * @param {boolean} val - True to hide suggestions.
 */
export function setSuggestionsHidden(val) {
    suggestionsHidden = val;
}

/**
 * Returns the cached previous valid priority sequence order.
 * @returns {Array<any>|null} Previous valid priority order array.
 */
export function getPreviousValidPriorityOrder() {
    return previousValidPriorityOrder;
}

/**
 * Stores the previous valid priority sequence order for undo/fallback resolution.
 * @param {Array<any>|null} val - Array of priority order items.
 */
export function setPreviousValidPriorityOrder(val) {
    previousValidPriorityOrder = val;
}

/**
 * Renders optimization suggestions and order validation error alerts.
 * @param {Array<any>} globalPriorityList
 * @param {Array<any>|null} suggestions
 * @param {() => void} [onReRenderList]
 */
export function renderSuggestionsAndErrors(globalPriorityList, suggestions, onReRenderList) {
    const errorContainer = document.getElementById('priority-list-message-container');
    const unhideBtn = document.getElementById('unhide-suggestion-btn');
    const listItems = document.querySelectorAll('.priority-list-editor-item');

    if (!errorContainer) return;

    errorContainer.innerHTML = '';
    errorContainer.style.display = 'none';
    errorContainer.classList.remove('suggestion-only', 'error');
    if (unhideBtn) unhideBtn.style.display = 'none';

    listItems.forEach(item => item.classList.remove('error', 'suggestion'));
    document.querySelectorAll('.suggestion-bar').forEach(bar => bar.remove());

    const { hasError, errorItems } = getStepOrderErrors(globalPriorityList);

    if (!hasError) {
        previousValidPriorityOrder = null;
    } else {
        const canUndo = previousValidPriorityOrder !== null && previousValidPriorityOrder.length > 0;
        const iconName = canUndo ? 'undo' : 'check';
        const buttonTextKey = canUndo ? 'actions.undo' : 'actions.fix';

        errorContainer.classList.add('error');
        errorContainer.innerHTML += `
            <div class="error-messages-wrapper">
                <p class="error-message">
                    ${getSVG('error', 'error-icon', 20, 20, 'currentColor')}
                    <span>${translate('views.planner.orderError')}</span>
                </p>
            </div>
            <button id="fix-order-btn" class="fix-order-btn success-btn">
                ${getSVG(iconName, '', 18, 18, 'currentColor')}
                <span>${translate(buttonTextKey)}</span>
            </button>
        `;

        const fixBtn = document.getElementById('fix-order-btn');
        if (fixBtn) {
            fixBtn.addEventListener('click', () => {
                if (canUndo) {
                    handleStateUpdate(() => {
                        previousValidPriorityOrder.forEach((savedItem) => {
                            const plan = state.heroes[savedItem.heroName]?.equipment[savedItem.equipName]?.upgradePlan[savedItem.step];
                            if (plan) {
                                plan.priorityIndex = savedItem.priorityIndex;
                            }
                        });
                    });
                    previousValidPriorityOrder = null;
                } else {
                    handleStateUpdate(() => {
                        const equipmentGroups = {};
                        globalPriorityList.forEach(item => {
                            if (!equipmentGroups[item.name]) {
                                equipmentGroups[item.name] = [];
                            }
                            equipmentGroups[item.name].push(item);
                        });

                        for (const equipName in equipmentGroups) {
                            const items = equipmentGroups[equipName];
                            for (let i = 0; i < items.length - 1; i++) {
                                if (items[i].step > items[i + 1].step) {
                                    const itemA = items[i];
                                    const itemB = items[i + 1];

                                    const planA = state.heroes[itemA.heroName].equipment[itemA.name].upgradePlan[itemA.step];
                                    const planB = state.heroes[itemB.heroName].equipment[itemB.name].upgradePlan[itemB.step];

                                    const tempIndex = planA.priorityIndex;
                                    planA.priorityIndex = planB.priorityIndex;
                                    planB.priorityIndex = tempIndex;

                                    return;
                                }
                            }
                        }
                    });
                    previousValidPriorityOrder = null;
                }
                if (onReRenderList) onReRenderList();
            });
        }

        listItems.forEach(item => {
            const htmlItem = /** @type {HTMLElement} */ (item);
            const key = `${htmlItem.dataset.equipName}-${htmlItem.dataset.step}`;
            if (errorItems.has(key)) {
                item.classList.add('error');
            }
        });
    }

    const hasSuggestions = suggestions && suggestions.length > 0;

    if (hasSuggestions && !hasError) {
        if (!suggestionsHidden) {
            let suggestionsHtml = `<div class="suggestion-messages-wrapper">`;
            suggestionsHtml += suggestions.map(s => `
                <p class="suggestion-message">
                    ${getSVG('suggestion', 'suggestion-icon', 16, 16, 'currentColor')}
                    <span>${s.message}</span>
                </p>
            `).join('');
            suggestionsHtml += `</div>`;

            errorContainer.classList.add('app-message-box', 'suggestion-only');
            suggestionsHtml += `<button class="hide-suggestion-btn app-message-box-btn" id="hide-suggestion-btn">${translate('actions.hide')}</button>`;

            errorContainer.innerHTML += suggestionsHtml;

            suggestions.forEach(suggestion => {
                const { itemToMove, itemsToMove, moveBefore } = suggestion;
                const items = itemsToMove || (itemToMove ? [itemToMove] : []);

                items.forEach(itm => {
                    const itemToMoveElement = Array.from(listItems).find(el => {
                        const htmlEl = /** @type {HTMLElement} */ (el);
                        return htmlEl.dataset.heroName === itm.heroName &&
                            htmlEl.dataset.equipName === itm.name &&
                            htmlEl.dataset.step == itm.step;
                    });
                    if (itemToMoveElement) {
                        itemToMoveElement.classList.add('suggestion');
                    }
                });

                if (moveBefore) {
                    const moveBeforeElement = Array.from(listItems).find(el => {
                        const htmlEl = /** @type {HTMLElement} */ (el);
                        return htmlEl.dataset.heroName === moveBefore.heroName &&
                            htmlEl.dataset.equipName === moveBefore.name &&
                            htmlEl.dataset.step == moveBefore.step;
                    });
                    if (moveBeforeElement) {
                        if (!moveBeforeElement.previousElementSibling?.classList.contains('suggestion-bar')) {
                            const suggestionBar = document.createElement('div');
                            suggestionBar.className = 'suggestion-bar';
                            moveBeforeElement.parentNode.insertBefore(suggestionBar, moveBeforeElement);
                        }
                    }
                }
            });

            if (!hasError) {
                const hideBtn = errorContainer.querySelector('#hide-suggestion-btn');
                if (hideBtn) {
                    hideBtn.addEventListener('click', () => {
                        suggestionsHidden = true;
                        renderSuggestionsAndErrors(globalPriorityList, suggestions, onReRenderList);
                    });
                }
            }
        } else if (!hasError && suggestionsHidden) {
            if (unhideBtn) {
                unhideBtn.style.display = 'flex';
                const badge = unhideBtn.querySelector('#suggestion-badge');
                if (badge) badge.textContent = String(suggestions.length);
            }
        }
    }

    if (hasError || (hasSuggestions && !suggestionsHidden)) {
        errorContainer.style.display = 'flex';
    }
}
