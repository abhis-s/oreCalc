import { dom } from '../dom/domElements.js';
import { translate } from '../i18n/translator.js';
import { state } from '../core/state.js';

export function showSavingIndicator() {
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;

    if (floatingSaveBtn) {
        floatingSaveBtn.classList.add('saving');
        const textElement = floatingSaveBtn.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('saving');
        }
    }

    if (fabSaveDataPill) {
        fabSaveDataPill.classList.add('saving');
        const textElement = fabSaveDataPill.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('saving');
        }
    }

    if (mainFab) {
        mainFab.classList.add('saving');
    }
}

export function hideSavingIndicator() {
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;

    if (floatingSaveBtn) {
        floatingSaveBtn.classList.remove('saving');
        const textElement = floatingSaveBtn.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('action_sync');
        }
    }

    if (fabSaveDataPill) {
        fabSaveDataPill.classList.remove('saving');
        const textElement = fabSaveDataPill.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('action_sync');
        }
    }

    if (mainFab) {
        mainFab.classList.remove('saving');
    }
}

export function showSaveErrorIndicator() {
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;
    const buttons = [floatingSaveBtn, fabSaveDataPill, mainFab];

    state.uiSettings.saveError = true;

    buttons.forEach(btn => {
        if (btn) {
            btn.classList.remove('saving');
            btn.classList.add('error');
            const textElement = btn.querySelector('.animated-btn-text');
            if (textElement) {
                textElement.textContent = translate('save_failed');
            }
        }
    });

    setTimeout(() => {
        hideSaveErrorIndicator();
    }, 5000);
}

function hideSaveErrorIndicator() {
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
                textElement.textContent = translate('action_sync');
            }
        }
    });
}