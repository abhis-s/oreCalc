import { translate } from '../i18n/translator.js';
import { state } from '../core/state.js';

/**
 * Resolves active saving buttons present in the current DOM environment.
 * @returns {{ floatingSaveBtn: HTMLElement | null, fabSaveDataPill: HTMLElement | null, mainFab: HTMLElement | null, buttons: HTMLElement[] }}
 */
function getSaveElements() {
    if (typeof document === 'undefined') {
        return { floatingSaveBtn: null, fabSaveDataPill: null, mainFab: null, buttons: [] };
    }
    const floatingSaveBtn = document.getElementById('floating-save-btn');
    const fabSaveDataPill = document.getElementById('fab-save-data-pill');
    const mainFab = document.getElementById('main-fab');
    const buttons = /** @type {HTMLElement[]} */ ([floatingSaveBtn, fabSaveDataPill, mainFab].filter(Boolean));
    return { floatingSaveBtn, fabSaveDataPill, mainFab, buttons };
}

/**
 * Displays active saving spinners and updates text across floating save buttons and FAB pills.
 */
function showSavingIndicator() {
    const { floatingSaveBtn, fabSaveDataPill, mainFab, buttons } = getSaveElements();
    if (buttons.length === 0) return;

    if (floatingSaveBtn) {
        floatingSaveBtn.classList.add('saving');
        const textElement = floatingSaveBtn.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('status.saving');
        }
    }

    if (fabSaveDataPill) {
        fabSaveDataPill.classList.add('saving');
        const textElement = fabSaveDataPill.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('status.saving');
        }
    }

    if (mainFab) {
        mainFab.classList.add('saving');
    }
}

/**
 * Hides saving spinner indicators and resets button labels back to default.
 */
function hideSavingIndicator() {
    const { floatingSaveBtn, fabSaveDataPill, mainFab, buttons } = getSaveElements();
    if (buttons.length === 0) return;

    if (floatingSaveBtn) {
        floatingSaveBtn.classList.remove('saving');
        const textElement = floatingSaveBtn.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('actions.syncToCloud');
        }
    }

    if (fabSaveDataPill) {
        fabSaveDataPill.classList.remove('saving');
        const textElement = fabSaveDataPill.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('actions.syncToCloud');
        }
    }

    if (mainFab) {
        mainFab.classList.remove('saving');
    }
}

/**
 * Displays transient success checkmark animation across floating save buttons and FAB pills.
 */
function showSaveSuccessIndicator() {
    const { buttons } = getSaveElements();
    if (buttons.length === 0) return;

    buttons.forEach(btn => {
        btn.classList.remove('saving');
        btn.classList.remove('error');
        btn.classList.add('success');
        const textElement = btn.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('actions.synced');
        }
    });

    setTimeout(() => {
        hideSaveSuccessIndicator();
    }, 2000);
}

function hideSaveSuccessIndicator() {
    const { buttons } = getSaveElements();
    if (buttons.length === 0) return;

    buttons.forEach(btn => {
        btn.classList.remove('success');
        const textElement = btn.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('actions.syncToCloud');
        }
    });
}

/**
 * Displays transient error warning animation across floating save buttons and FAB pills.
 */
function showSaveErrorIndicator() {
    const { buttons } = getSaveElements();
    if (buttons.length === 0) return;

    state.uiSettings.saveError = true;

    buttons.forEach(btn => {
        btn.classList.remove('saving');
        btn.classList.remove('success');
        btn.classList.add('error');
        const textElement = btn.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('actions.failed');
        }
    });

    setTimeout(() => {
        hideSaveErrorIndicator();
    }, 3000);
}

function hideSaveErrorIndicator() {
    const { buttons } = getSaveElements();
    if (buttons.length === 0) return;

    state.uiSettings.saveError = false;

    buttons.forEach(btn => {
        btn.classList.remove('error');
        const textElement = btn.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('actions.syncToCloud');
        }
    });
}

// Auto-register reactive event listener for application save state events
if (typeof document !== 'undefined') {
    document.addEventListener('app:savingState', (event) => {
        const customEvent = /** @type {CustomEvent<{ status: string }>} */ (event);
        const status = customEvent.detail?.status;
        if (status === 'saving') {
            showSavingIndicator();
        } else if (status === 'success') {
            showSaveSuccessIndicator();
        } else if (status === 'error') {
            showSaveErrorIndicator();
        } else if (status === 'idle') {
            hideSavingIndicator();
        }
    });
}
