/**
 * Unified Edit Levels Modal Display Coordinator & Facade.
 * Coordinates Offense and Defense tabs, delegating rendering to domain modules.
 * Tier 4: UI Presentation (Dedicated exclusively to modal dialog DOM rendering, 0 event listeners).
 */

import { escapeHTML } from '../../utils/stringUtils.js';
import { translate } from '../../i18n/translator.js';
import {
    renderOffenseEditModal
} from './damageCalcOffenseModalDisplay.js';
import {
    renderBuildingEditModal
} from './damageCalcBuildingEditorModalDisplay.js';

/**
 * Renders the full Edit Levels modal including top segmented tab switcher and active panel.
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} modalContainer - Target modal element or modal body.
 */
export function renderEditLevelsModal(state, modalContainer) {
    if (!modalContainer) return;

    const modalBody = modalContainer.id === 'calc-offense-modal-body'
        ? modalContainer
        : modalContainer.querySelector('#calc-offense-modal-body') || modalContainer;

    const activeTab = state.modalActiveTab || 'offense';
    const isDefenseTab = activeTab === 'defense' || activeTab === 'buildings';

    const titleEl = typeof document !== 'undefined' ? document.getElementById('calc-offense-modal-title') : null;
    if (titleEl) {
        titleEl.textContent = translate('views.damageCalc.offense.editLevels');
        titleEl.setAttribute('data-i18n', 'views.damageCalc.offense.editLevels');
    }

    modalBody.innerHTML = `
        <div class="calc-offense-modal-sticky-header">
            <div class="calc-modal-tabs segmented-control" role="tablist" aria-label="${escapeHTML(translate('views.damageCalc.offense.levelEditorSections'))}" data-i18n-aria-label="views.damageCalc.offense.levelEditorSections">
                <button type="button" class="segmented-btn ${activeTab === 'offense' ? 'active' : ''}" data-modal-tab="offense" role="tab" aria-selected="${activeTab === 'offense'}" aria-controls="calc-modal-tab-content">
                    <span data-i18n="views.damageCalc.offense.offenseTabTitle">${escapeHTML(translate('views.damageCalc.offense.offenseTabTitle'))}</span>
                </button>
                <button type="button" class="segmented-btn ${isDefenseTab ? 'active' : ''}" data-modal-tab="defense" role="tab" aria-selected="${isDefenseTab}" aria-controls="calc-modal-tab-content">
                    <span data-i18n="views.damageCalc.clusterPlanner.defenseTabTitle">${escapeHTML(translate('views.damageCalc.clusterPlanner.defenseTabTitle'))}</span>
                </button>
            </div>
            <div class="calc-building-sticky-controls" id="calc-building-sticky-controls" ${!isDefenseTab ? 'hidden' : ''}></div>
        </div>
        <div class="calc-modal-tab-content" id="calc-modal-tab-content"></div>
    `;

    const tabContentContainer = /** @type {HTMLElement|null} */ (modalBody.querySelector('#calc-modal-tab-content'));
    const controlsContainer = /** @type {HTMLElement|null} */ (modalBody.querySelector('#calc-building-sticky-controls'));
    if (tabContentContainer) {
        if (isDefenseTab) {
            renderBuildingEditModal(state, tabContentContainer, controlsContainer);
        } else {
            renderOffenseEditModal(state, tabContentContainer);
        }
    }
}
