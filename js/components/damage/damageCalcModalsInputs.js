/**
 * Unified Edit Levels Modal Inputs Coordinator & Facade.
 * Coordinates modal tab switching and delegates event binding to Offense and Building modules.
 * Tier 4: User Inputs (Dedicated exclusively to event listener attachments inside modal dialogs).
 */

import { persistState } from './damageCalcState.js';
import { renderEditLevelsModal } from './damageCalcModalsDisplay.js';
import { attachOffenseModalListeners } from './damageCalcOffenseModalInputs.js';
import {
    attachBuildingEditorModalListeners
} from './damageCalcBuildingEditorModalInputs.js';

/**
 * Attaches event listeners for the unified Edit Levels modal (Tabs, Offense, Buildings).
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} modalBody - Modal body container.
 * @param {() => void} onStateChange - Re-render callback.
 */
export function attachEditLevelsModalListeners(state, modalBody, onStateChange) {
    if (!modalBody) return;

    // Tab switching buttons
    const tabBtns = modalBody.querySelectorAll('[data-modal-tab]');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-modal-tab');
            if (targetTab && targetTab !== state.modalActiveTab) {
                state.modalActiveTab = targetTab;
                persistState();
                renderEditLevelsModal(state, modalBody);
                attachEditLevelsModalListeners(state, modalBody, onStateChange);
            }
        });
    });

    const activeTab = state.modalActiveTab || 'offense';

    if (activeTab === 'offense') {
        attachOffenseModalListeners(state, modalBody, onStateChange);
        return;
    }

    // Delegate Building Level Editor listeners
    attachBuildingEditorModalListeners(state, modalBody, onStateChange, attachEditLevelsModalListeners);
}
