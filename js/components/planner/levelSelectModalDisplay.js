/**
 * DOM Presentation & Template Rendering for Planner Level Selection Modal.
 * Tier 4: UI Presentation (Dedicated exclusively to DOM rendering, 0 event listeners, 0 state mutations).
 */

import { getEquipmentMaxLevel } from '../../data/equipmentCommonData.js';
import { translate } from '../../i18n/translator.js';
import { calculateStepBounds } from '../../domain/planner/stepRecommendationDomain.js';
import { getEquipmentDisplayName } from '../../utils/equipmentMetadata.js';
import { getSVG } from '../../utils/svgManager.js';

/**
 * Generates the semantic HTML markup for the Level Selection modal dialog.
 *
 * @returns {string} Modal HTML markup.
 */
function createLevelSelectModalHtml() {
    return `
        <dialog id="level-select-modal" class="modal" aria-labelledby="level-select-modal-title" aria-label="${translate('views.planner.setTargetFor')}" data-i18n-aria-label="views.planner.setTargetFor">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="level-select-modal-title"><span class="set-target-text" data-i18n="views.planner.setTargetFor">${translate('views.planner.setTargetFor')}</span> <span id="level-select-modal-equip-name"></span></h2>
                    <div class="modal-header-actions">
                        <button id="level-select-modal-info-btn" class="info-button" data-info="views.planner.levelSelectModalHelp" data-i18n-aria-label="actions.showInfo" aria-label="Show Information">
                            <orecalc-assets-svg name="info" height="22" width="22"></orecalc-assets-svg>
                        </button>
                        <button id="close-level-select-modal-btn" class="close-button" aria-label="${translate('actions.close')}" data-i18n-aria-label="actions.close"><orecalc-assets-svg name="close"></orecalc-assets-svg></button>
                    </div>
                </div>
                <div class="modal-body">
                    <p><span data-i18n="views.planner.currentLevel">${translate('views.planner.currentLevel')}</span> <span id="current-equipment-level"></span></p>
                    <table id="level-select-table">
                        <thead>
                            <tr>
                                <th data-i18n="actions.enable">${translate('actions.enable')}</th>
                                <th data-i18n="views.planner.step">${translate('views.planner.step')}</th>
                                <th data-i18n="validation.level">${translate('validation.level')}</th>
                                <th data-i18n="actions.delete">${translate('actions.delete')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <!-- Rows will be inserted here by JavaScript -->
                        </tbody>
                    </table>
                </div>
                <div class="modal-actions">
                    <button id="level-select-modal-save-btn" class="accept-button" data-i18n="actions.save">${translate('actions.save')}</button>
                </div>
            </div>
        </dialog>
    `;
}

/**
 * Ensures the level selection modal element is present in the DOM tree.
 *
 * @param {HTMLElement} [container=document.body] - Parent container element.
 * @returns {HTMLDialogElement} The modal element.
 */
export function ensureLevelSelectModalInDOM(container = document.body) {
    let modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('level-select-modal'));
    if (!modal) {
        container.insertAdjacentHTML('beforeend', createLevelSelectModalHtml());
        modal = /** @type {HTMLDialogElement} */ (document.getElementById('level-select-modal'));
    }
    return modal;
}

/**
 * Generates the HTML template markup for the 3 upgrade steps table rows.
 *
 * @returns {string} Table rows HTML markup.
 */
function renderTableRowsHtml() {
    let rowsHtml = '';
    for (let i = 1; i <= 3; i++) {
        rowsHtml += `
            <tr data-step-id="${i}">
                <td>
                    <div class="switch">
                        <input type="checkbox" id="enable-switch-${i}" class="enable-switch" checked>
                        <span class="slider round"></span>
                    </div>
                </td>
                <td>#${i}</td>
                <td class="level-input-cell">
                    <div class="popover-wrapper">
                        <input type="number" id="level-input-${i}" class="level-input" placeholder="${translate('views.planner.placeholderLevel')}" data-i18n-placeholder="views.planner.placeholderLevel" maxlength="2" data-allow-empty="true" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false">
                    </div>
                </td>
                <td class="trash-cell">
                    <button class="trash-btn icon-button" aria-label="${translate('actions.delete')}" data-i18n-aria-label="actions.delete">${getSVG('trash', '', 24, 24, 'currentColor')}</button>
                </td>
            </tr>
        `;
    }
    return rowsHtml;
}

/**
 * Populates table rows into the modal table body.
 *
 * @param {HTMLElement} tbody - Table body element.
 */
export function populateTableRows(tbody) {
    if (!tbody) return;
    tbody.innerHTML = renderTableRowsHtml();
}

/**
 * Updates modal header titles and current equipment level display.
 *
 * @param {string} equipmentName - Equipment identifier.
 * @param {number} currentLevel - Current base level.
 */
export function updateModalHeaderDisplay(equipmentName, currentLevel) {
    const equipNameSpan = document.getElementById('level-select-modal-equip-name');
    const currentLevelSpan = document.getElementById('current-equipment-level');

    if (equipNameSpan) {
        equipNameSpan.textContent = getEquipmentDisplayName(equipmentName);
    }
    if (currentLevelSpan) {
        currentLevelSpan.textContent = String(currentLevel);
    }
}

/**
 * Synchronizes input placeholders, numeric min bounds, and switch states across all table rows.
 * Pure DOM presentation: updates attributes without dispatching events or mutating global state.
 *
 * @param {Object | null} currentEquipment - Active equipment definition.
 * @param {Object | null} currentHero - Active hero definition.
 * @param {any} heroState - Current hero state partition.
 * @param {(stepIndex: number) => number} getRecommendedLevelFn - Recommendation resolver callback.
 */
export function syncTableRecommendationsAndBounds(currentEquipment, currentHero, heroState, getRecommendedLevelFn) {
    const rows = Array.from(document.querySelectorAll('#level-select-table tbody tr'));
    if (rows.length === 0 || !currentEquipment || !currentHero) return;

    const maxLevel = getEquipmentMaxLevel(currentEquipment.type);
    const currentLevel = heroState?.equipment[currentEquipment.name]?.level || 1;
    const basePlaceholderText = translate('views.planner.placeholderLevel');
    const prefix = basePlaceholderText.includes('18') ? basePlaceholderText.split('18')[0] : 'e.g., ';

    rows.forEach((row, index) => {
        const stepNum = index + 1;
        const levelInput = /** @type {HTMLInputElement | null} */ (row.querySelector('.level-input'));
        const enableSwitch = /** @type {HTMLInputElement | null} */ (row.querySelector('.enable-switch'));
        if (!levelInput || !enableSwitch) return;

        const prevInput = index > 0 ? /** @type {HTMLInputElement | null} */ (rows[index - 1]?.querySelector('.level-input')) : null;
        const prevVal = parseInt(prevInput?.value || '', 10);
        const { minVal, isPrecedingMaxed } = calculateStepBounds(stepNum, prevVal, currentLevel, maxLevel);

        levelInput.setAttribute('min', String(minVal));
        levelInput.setAttribute('max', String(maxLevel));

        const recVal = typeof getRecommendedLevelFn === 'function' ? getRecommendedLevelFn(stepNum) : 0;

        if (recVal > 0 && recVal >= minVal && recVal <= maxLevel) {
            levelInput.setAttribute('placeholder', `${prefix}${recVal}`);
        } else {
            levelInput.setAttribute('placeholder', '');
        }

        if ((minVal > maxLevel || isPrecedingMaxed) && levelInput.value === '') {
            enableSwitch.checked = false;
        }
    });
}
