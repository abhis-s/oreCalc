import { dom } from '../../dom/domElements.js';
import { state } from '../../core/state.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';

import { guidedSetupState, resetGuidedSetupState, syncPreferencesFromProfile } from './guidedSetupState.js';
import { initializeGuidedSetupIdentityInputs, renderSavedProfilesList } from './guidedSetupIdentityInputs.js';
import { initializeGuidedSetupStepsInputs } from './guidedSetupStepsInputs.js';
import { syncGuidedSetupQuickSettings } from './guidedSetupStepsDisplay.js';
import { renderProfilePreviewCard } from './guidedSetupProfileDisplay.js';
import { goToNextStep, goToPrevStep, goToStep, skipSetup } from './guidedSetupNavigation.js';

let isGuidedSetupInitialized = false;

/**
 * Opens the Guided Setup modal dialog.
 * @param {Object} [options={}] - Optional setup configuration.
 * @param {string} [options.initialTag] - Pre-filled player tag to load.
 * @param {number} [options.startStep=1] - Starting step number (1 to 6).
 */
export function openGuidedSetupModal(options = {}) {
    const modal = /** @type {HTMLDialogElement|null} */ (document.getElementById('guided-setup-modal'));
    if (!modal) return;

    if (!isGuidedSetupInitialized) {
        initializeGuidedSetupModal();
    }

    resetGuidedSetupState();

    const startStep = options.startStep || 1;
    const initialTag = options.initialTag ? normalizePlayerTag(options.initialTag) : null;

    if (initialTag) {
        guidedSetupState.activeTag = initialTag;
        const input = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-player-tag-input'));
        if (input) input.value = initialTag;

        const existingPlayer = state.allPlayersData?.[initialTag];
        if (existingPlayer) {
            guidedSetupState.isProfileLoaded = true;
            guidedSetupState.selectedTH = existingPlayer.playerProfile?.townHallLevel || 16;
            guidedSetupState.selectedLeague = existingPlayer.playerProfile?.leagueTier?.id || 105000000;
            syncPreferencesFromProfile(initialTag);
            syncGuidedSetupQuickSettings(initialTag);
            renderProfilePreviewCard(existingPlayer.playerProfile || existingPlayer);
            const previewContainer = document.getElementById('guided-setup-profile-preview-container');
            if (previewContainer) previewContainer.style.display = 'block';
        }
        const savedContainer = document.getElementById('guided-setup-saved-profiles-container');
        if (savedContainer) savedContainer.style.display = 'none';
    } else {
        const input = /** @type {HTMLInputElement|null} */ (document.getElementById('guided-setup-player-tag-input'));
        if (input) input.value = '';
        const previewContainer = document.getElementById('guided-setup-profile-preview-container');
        if (previewContainer) previewContainer.style.display = 'none';
        renderSavedProfilesList();
    }

    syncGuidedSetupQuickSettings(guidedSetupState.activeTag || '');

    goToStep(startStep);

    if (typeof modal.showModal === 'function' && !modal.open) {
        try {
            modal.showModal();
        } catch (_) {}
    }
    modal.classList.add('show');
    guidedSetupState.isOpen = true;

    if (dom.overlay) {
        dom.overlay.classList.add('show');
    }
}

/**
 * Closes the Guided Setup modal dialog.
 */
export function closeGuidedSetupModal() {
    const modal = /** @type {HTMLDialogElement|null} */ (document.getElementById('guided-setup-modal'));
    if (!modal) return;

    if (document.activeElement && typeof /** @type {HTMLElement} */ (document.activeElement).blur === 'function') {
        /** @type {HTMLElement} */ (document.activeElement).blur();
    }
    const openPopovers = document.querySelectorAll('.input-feature-popover.show');
    openPopovers.forEach((pop) => {
        pop.classList.remove('show');
        /** @type {HTMLElement} */ (pop).style.opacity = '0';
        /** @type {HTMLElement} */ (pop).style.pointerEvents = 'none';
    });

    guidedSetupState.isOpen = false;
    closeModalAnimated(modal, () => {
        resetGuidedSetupState();
    });
}

/**
 * Initializes Guided Setup modal event listeners, navigation buttons, and child inputs.
 */
export function initializeGuidedSetupModal() {
    if (isGuidedSetupInitialized) return;
    isGuidedSetupInitialized = true;

    const modal = document.getElementById('guided-setup-modal');
    if (!modal) return;

    const nextBtn = document.getElementById('guided-setup-next-btn');
    const backBtn = document.getElementById('guided-setup-back-btn');
    const cancelBtn = document.getElementById('guided-setup-cancel-btn');
    const skipBtn = document.getElementById('guided-setup-skip-btn');
    const closeBtn = document.getElementById('close-guided-setup-modal-btn');

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeGuidedSetupModal();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goToNextStep(() => closeGuidedSetupModal());
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            goToPrevStep();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeGuidedSetupModal();
        });
    }

    if (skipBtn) {
        skipBtn.addEventListener('click', (e) => {
            e.preventDefault();
            skipSetup(() => closeGuidedSetupModal());
        });
    }

    initializeGuidedSetupIdentityInputs(modal, () => {
        // When profile is loaded in Step 1, auto-advance or update button text
        const nextBtn = document.getElementById('guided-setup-next-btn');
        if (nextBtn) {
            nextBtn.focus();
        }
    });

    initializeGuidedSetupStepsInputs(modal);

    // Keyboard focus trap & Escape key
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeGuidedSetupModal();
            return;
        }

        if (e.key !== 'Tab') return;

        const tabbables = Array.from(modal.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        )).filter(el => {
            if (el.closest('[inert]')) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && (/** @type {HTMLElement} */ (el).offsetWidth > 0 || /** @type {HTMLElement} */ (el).offsetHeight > 0);
        });

        if (tabbables.length === 0) {
            e.preventDefault();
            return;
        }

        const firstTabbable = tabbables[0];
        const lastTabbable = tabbables.at(-1);

        if (e.shiftKey) {
            if (document.activeElement === firstTabbable || !modal.contains(document.activeElement)) {
                e.preventDefault();
                /** @type {HTMLElement} */ (lastTabbable).focus();
            }
        } else {
            if (document.activeElement === lastTabbable || !modal.contains(document.activeElement)) {
                e.preventDefault();
                /** @type {HTMLElement} */ (firstTabbable).focus();
            }
        }
    });
}
