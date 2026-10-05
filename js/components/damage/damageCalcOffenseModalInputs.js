/**
 * Event Listener Engine for Damage Calculator Offense Levels Modal.
 * Tier 4: UI Controller (Dedicated exclusively to event attachments and state mutations).
 */

import { persistState, getActiveModifier } from './damageCalcState.js';
import { formatOffenseModalValue } from './damageCalcOffenseModalDisplay.js';

/**
 * Attaches event listeners for the Offense editor section of the Edit Levels modal.
 *
 * @param {Object} state - Damage calculator state.
 * @param {HTMLElement} modalBody - Modal body DOM container.
 * @param {() => void} onStateChange - Re-render callback.
 */
export function attachOffenseModalListeners(state, modalBody, onStateChange) {
    const updateOffenseRow = (type, id, val) => {
        const slider = /** @type {HTMLInputElement | null} */ (modalBody.querySelector(`.offense-level-slider[data-type="${type}"][data-id="${id}"]`));
        if (!slider) return;
        const min = Number(slider.min) || 1;
        const max = Number(slider.max) || 1;
        const clamped = Math.max(min, Math.min(max, val));
        slider.value = String(clamped);

        if (!state.offense) state.offense = { spells: {}, equipment: {} };
        if (!state.offense.spells) state.offense.spells = {};
        if (!state.offense.equipment) state.offense.equipment = {};

        if (type === 'spell') {
            state.offense.spells[id] = clamped;
            if (id === 'lightning') {
                state.zapQuake.lightningLevel = clamped;
                const readout = modalBody.querySelector('#modal-val-lightning');
                if (readout) readout.textContent = formatOffenseModalValue('spell', 'lightning', clamped);
            } else if (id === 'earthquake') {
                state.zapQuake.earthquakeLevel = clamped;
                const readout = modalBody.querySelector('#modal-val-earthquake');
                if (readout) readout.textContent = formatOffenseModalValue('spell', 'earthquake', clamped);
            }
        } else if (type === 'cc_spell') {
            if (!state.offense.ccSpells) state.offense.ccSpells = { lightning: 13, earthquake: 8 };
            state.offense.ccSpells[id] = clamped;
            const readout = modalBody.querySelector(`#modal-val-cc-${id}`);
            if (readout) readout.textContent = formatOffenseModalValue('spell', id, clamped);
        } else if (type === 'equipment') {
            state.offense.equipment[id] = clamped;
            const readout = modalBody.querySelector(`#modal-val-${id}`);
            const activeMod = getActiveModifier(state);
            if (readout) readout.textContent = formatOffenseModalValue('equipment', id, clamped, { modifier: activeMod, leagueId: activeMod });
        }

        const row = slider.closest('.calc-offense-modal-row');
        if (row) {
            const decBtn = /** @type {HTMLButtonElement | null} */ (row.querySelector('.calc-stepper-btn[data-action="decrement"]'));
            const incBtn = /** @type {HTMLButtonElement | null} */ (row.querySelector('.calc-stepper-btn[data-action="increment"]'));
            if (decBtn) decBtn.disabled = clamped <= min;
            if (incBtn) incBtn.disabled = clamped >= max;
        }

        modalBody.dataset.isDirty = 'true';
        persistState();
    };

    const sliders = modalBody.querySelectorAll('.offense-level-slider');
    sliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
            const input = /** @type {HTMLInputElement} */ (e.target);
            const type = input.getAttribute('data-type');
            const id = input.getAttribute('data-id');
            const val = Number(input.value) || 1;
            updateOffenseRow(type, id, val);
        });

        slider.addEventListener('change', () => {
            persistState();
            onStateChange();
        });
    });

    const stepperBtns = modalBody.querySelectorAll('.calc-offense-modal-row .calc-stepper-btn');
    stepperBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const button = /** @type {HTMLButtonElement} */ (e.currentTarget);
            if (button.disabled) return;
            const action = button.getAttribute('data-action');
            const type = button.getAttribute('data-type');
            const id = button.getAttribute('data-id');
            if (!action || !type || !id) return;

            const slider = /** @type {HTMLInputElement | null} */ (modalBody.querySelector(`.offense-level-slider[data-type="${type}"][data-id="${id}"]`));
            if (!slider) return;
            const currentVal = Number(slider.value) || 1;
            const nextVal = action === 'increment' ? currentVal + 1 : currentVal - 1;
            updateOffenseRow(type, id, nextVal);
            onStateChange();
        });
    });
}
