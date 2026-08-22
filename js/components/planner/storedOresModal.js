import { translate } from '../../i18n/translator.js';

import { STORAGE_LIMITS } from '../../core/constants.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { registerInputPopover } from '../../utils/inputPopoverProvider.js';
import { addValidation } from '../../utils/inputValidator.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';

/**
 * Checks if opening the stored ores modal should be suppressed due to open welcome/consent/tour dialogs.
 * @returns {boolean}
 */
export function isInterruptionRestricted() {
    const welcomeModal = document.getElementById('welcome-modal');
    if (welcomeModal && welcomeModal.classList.contains('show')) {
        return true;
    }
    const consentBanner = document.getElementById('consent-banner');
    if (consentBanner && consentBanner.classList.contains('show')) {
        return true;
    }
    const consentModal = document.getElementById('consent-modal');
    if (consentModal && consentModal.classList.contains('show')) {
        return true;
    }
    const tourTooltip = /** @type {HTMLElement|null} */ (document.querySelector('.tour-tooltip'));
    if (tourTooltip && tourTooltip.style.display !== 'none' && tourTooltip.style.opacity !== '0') {
        return true;
    }
    return false;
}

/**
 * Auto-predicts current stored ore amounts.
 * @returns {{ shiny: number, glowy: number, starry: number }}
 */
export function autoPredictStoredOres() {
    return {
        shiny: state.storedOres.shiny !== undefined ? state.storedOres.shiny : 0,
        glowy: state.storedOres.glowy !== undefined ? state.storedOres.glowy : 0,
        starry: state.storedOres.starry !== undefined ? state.storedOres.starry : 0
    };
}

/**
 * Opens the stored ores modal.
 */
export function openStoredOresModal() {
    if (isInterruptionRestricted()) return;

    const modal = document.getElementById('stored-ores-modal');
    if (!modal) return;

    const shinyEl = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-stored-ore-shiny'));
    const glowyEl = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-stored-ore-glowy'));
    const starryEl = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-stored-ore-starry'));
    const dontAskCheckbox = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-stored-ore-dont-ask'));

    if (shinyEl) shinyEl.value = String(state.storedOres.shiny !== undefined ? state.storedOres.shiny : 0);
    if (glowyEl) glowyEl.value = String(state.storedOres.glowy !== undefined ? state.storedOres.glowy : 0);
    if (starryEl) starryEl.value = String(state.storedOres.starry !== undefined ? state.storedOres.starry : 0);
    if (dontAskCheckbox) dontAskCheckbox.checked = false;

    modal.classList.add('show');
}

/**
 * Closes the stored ores modal.
 */
export function closeStoredOresModal() {
    const modal = document.getElementById('stored-ores-modal');
    if (modal) closeModalAnimated(modal);
}

/**
 * Initializes validation, popovers, and save bindings for the stored ores modal.
 */
export function initializeStoredOresModal() {
    const modal = document.getElementById('stored-ores-modal');
    if (!modal) return;

    let isModalOpen = modal.classList.contains('show');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                const isOpenNow = modal.classList.contains('show');
                if (isModalOpen && !isOpenNow) {
                    handleStateUpdate(() => {
                        if (!state.storedOres) state.storedOres = {};
                        const lastUpdated = state.storedOres.lastUpdated || 0;
                        if (lastUpdated <= Date.now()) {
                            state.storedOres.lastUpdated = Date.now();
                        }
                    });
                }
                isModalOpen = isOpenNow;
            }
        });
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });

    const shinyInput = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-stored-ore-shiny'));
    const glowyInput = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-stored-ore-glowy'));
    const starryInput = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-stored-ore-starry'));

    if (shinyInput) {
        addValidation(shinyInput, { inputName: 'modal-stored-ore-shiny' });
        registerInputPopover(shinyInput, {
            title: () => translate('entities.ores.shiny'),
            min: 0,
            max: STORAGE_LIMITS.shiny,
            clickToFill: { max: true }
        });
    }
    if (glowyInput) {
        addValidation(glowyInput, { inputName: 'modal-stored-ore-glowy' });
        registerInputPopover(glowyInput, {
            title: () => translate('entities.ores.glowy'),
            min: 0,
            max: STORAGE_LIMITS.glowy,
            clickToFill: { max: true }
        });
    }
    if (starryInput) {
        addValidation(starryInput, { inputName: 'modal-stored-ore-starry' });
        registerInputPopover(starryInput, {
            title: () => translate('entities.ores.starry'),
            min: 0,
            max: STORAGE_LIMITS.starry,
            clickToFill: { max: true }
        });
    }

    const closeBtn = document.getElementById('close-stored-ores-modal-btn');
    const cancelBtn = document.getElementById('cancel-stored-ores-modal-btn');
    const saveBtn = document.getElementById('save-stored-ores-modal-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeStoredOresModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeStoredOresModal);
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const shinyVal = shinyInput ? parseInt(shinyInput.value, 10) || 0 : 0;
            const glowyVal = glowyInput ? parseInt(glowyInput.value, 10) || 0 : 0;
            const starryVal = starryInput ? parseInt(starryInput.value, 10) || 0 : 0;

            const dontAskCheckbox = /** @type {HTMLInputElement|null} */ (document.getElementById('modal-stored-ore-dont-ask'));
            const dontAsk = dontAskCheckbox ? dontAskCheckbox.checked : false;

            handleStateUpdate(() => {
                state.storedOres.shiny = shinyVal;
                state.storedOres.glowy = glowyVal;
                state.storedOres.starry = starryVal;
                state.storedOres.lastUpdated = dontAsk ? (Date.now() + 60 * 24 * 60 * 60 * 1000) : Date.now();
            });

            // Keep equipment tab storage inputs in sync
            const shinyEqInput = /** @type {HTMLInputElement|null} */ (document.getElementById('eq-shiny-ore-storage'));
            const glowyEqInput = /** @type {HTMLInputElement|null} */ (document.getElementById('eq-glowy-ore-storage'));
            const starryEqInput = /** @type {HTMLInputElement|null} */ (document.getElementById('eq-starry-ore-storage'));

            if (shinyEqInput) {
                shinyEqInput.value = String(shinyVal);
                shinyEqInput.dataset.lastValidValue = shinyVal.toString();
            }
            if (glowyEqInput) {
                glowyEqInput.value = String(glowyVal);
                glowyEqInput.dataset.lastValidValue = glowyVal.toString();
            }
            if (starryEqInput) {
                starryEqInput.value = String(starryVal);
                starryEqInput.dataset.lastValidValue = starryVal.toString();
            }

            closeStoredOresModal();
            document.dispatchEvent(new CustomEvent('priorityListUpdated'));
        });
    }
}
