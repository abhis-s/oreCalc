import { translate } from '../i18n/translator.js';

import { state } from '../core/state.js';

import { dom } from '../dom/domElements.js';

/**
 * Displays active saving spinners and updates text across floating save buttons and FAB pills.
 */
export function showSavingIndicator() {
    if (!dom || !dom.controls || !dom.fab || !dom.fab.pills) return;
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;

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
export function hideSavingIndicator() {
    if (!dom || !dom.controls || !dom.fab || !dom.fab.pills) return;
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;

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
export function showSaveSuccessIndicator() {
    if (!dom || !dom.controls || !dom.fab || !dom.fab.pills) return;
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;
    const buttons = [floatingSaveBtn, fabSaveDataPill, mainFab];

    buttons.forEach(btn => {
        if (btn) {
            btn.classList.remove('saving');
            btn.classList.remove('error');
            btn.classList.add('success');
            const textElement = btn.querySelector('.animated-btn-text');
            if (textElement) {
                textElement.textContent = translate('actions.synced');
            }
        }
    });

    setTimeout(() => {
        hideSaveSuccessIndicator();
    }, 2000);
}

function hideSaveSuccessIndicator() {
    if (!dom || !dom.controls || !dom.fab || !dom.fab.pills) return;
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;
    const buttons = [floatingSaveBtn, fabSaveDataPill, mainFab];

    buttons.forEach(btn => {
        if (btn) {
            btn.classList.remove('success');
            const textElement = btn.querySelector('.animated-btn-text');
            if (textElement) {
                textElement.textContent = translate('actions.syncToCloud');
            }
        }
    });
}

/**
 * Displays transient error warning animation across floating save buttons and FAB pills.
 */
export function showSaveErrorIndicator() {
    if (!dom || !dom.controls || !dom.fab || !dom.fab.pills) return;
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;
    const buttons = [floatingSaveBtn, fabSaveDataPill, mainFab];

    state.uiSettings.saveError = true;

    buttons.forEach(btn => {
        if (btn) {
            btn.classList.remove('saving');
            btn.classList.remove('success');
            btn.classList.add('error');
            const textElement = btn.querySelector('.animated-btn-text');
            if (textElement) {
                textElement.textContent = translate('actions.failed');
            }
        }
    });

    setTimeout(() => {
        hideSaveErrorIndicator();
    }, 3000);
}

function hideSaveErrorIndicator() {
    if (!dom || !dom.controls || !dom.fab || !dom.fab.pills) return;
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;
    const buttons = [floatingSaveBtn, fabSaveDataPill, mainFab];

    state.uiSettings.saveError = false;

    buttons.forEach(btn => {
        if (btn) {
            btn.classList.remove('error');
            const textElement = btn.querySelector('.animated-btn-text');
            if (textElement) {
                textElement.textContent = translate('actions.syncToCloud');
            }
        }
    });
}
