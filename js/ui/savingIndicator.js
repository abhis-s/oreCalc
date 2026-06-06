import { dom } from '../dom/domElements.js';
import { state } from '../core/state.js';

import { translate } from '../i18n/translator.js';

export function showSavingIndicator() {
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

export function hideSavingIndicator() {
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;

    if (floatingSaveBtn) {
        floatingSaveBtn.classList.remove('saving');
        const textElement = floatingSaveBtn.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('actions.sync');
        }
    }

    if (fabSaveDataPill) {
        fabSaveDataPill.classList.remove('saving');
        const textElement = fabSaveDataPill.querySelector('.animated-btn-text');
        if (textElement) {
            textElement.textContent = translate('actions.sync');
        }
    }

    if (mainFab) {
        mainFab.classList.remove('saving');
    }
}

export function showSaveSuccessIndicator() {
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
    const floatingSaveBtn = dom.controls.saveButton;
    const fabSaveDataPill = dom.fab.pills.saveData;
    const mainFab = dom.fab.main;
    const buttons = [floatingSaveBtn, fabSaveDataPill, mainFab];

    buttons.forEach(btn => {
        if (btn) {
            btn.classList.remove('success');
            const textElement = btn.querySelector('.animated-btn-text');
            if (textElement) {
                textElement.textContent = translate('actions.sync');
            }
        }
    });
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
                textElement.textContent = translate('actions.sync');
            }
        }
    });
}