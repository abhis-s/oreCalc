import { translate } from '../i18n/translator.js';

let modal, titleElem, messageElem, cancelBtn, okBtn, overlay;

export function initializeNoticeModal() {
    modal = document.getElementById('notice-modal');
    titleElem = document.getElementById('notice-modal-title');
    messageElem = document.getElementById('notice-modal-message');
    cancelBtn = document.getElementById('notice-modal-cancel-btn');
    okBtn = document.getElementById('notice-modal-ok-btn');
    overlay = document.getElementById('overlay');
}

/**
 * Shows a notice modal (alert or confirm).
 * @param {string} message - The message to display.
 * @param {string} titleKey - The translation key for the title.
 * @param {boolean} showCancel - Whether to show the cancel button.
 * @param {string} okBtnKey - Optional translation key for the OK button.
 * @param {string} cancelBtnKey - Optional translation key for the Cancel button.
 * @returns {Promise<boolean>} - Resolves to true if OK was clicked, false if Cancel.
 */
function showNotice(message, titleKey = 'status.notice', showCancel = false, okBtnKey = null, cancelBtnKey = 'actions.cancel') {
    return new Promise((resolve) => {
        if (!modal) initializeNoticeModal();

        titleElem.textContent = translate(titleKey);
        titleElem.setAttribute('data-i18n', titleKey);
        messageElem.innerHTML = message;
        
        cancelBtn.style.display = showCancel ? 'block' : 'none';
        
        const defaultOkKey = showCancel ? 'actions.confirm' : 'actions.ok';
        const okKey = okBtnKey || defaultOkKey;
        okBtn.textContent = translate(okKey);
        okBtn.setAttribute('data-i18n', okKey);

        cancelBtn.textContent = translate(cancelBtnKey);
        cancelBtn.setAttribute('data-i18n', cancelBtnKey);

        const handleOk = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.classList.remove('show');
            overlay?.classList.remove('show');
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);

        modal.classList.add('show');
        overlay?.classList.add('show');
    });
}

/**
 * Replaces window.alert
 */
export async function showAlert(message, titleKey = 'status.notice', okBtnKey = null) {
    return showNotice(message, titleKey, false, okBtnKey);
}

/**
 * Replaces window.confirm
 */
export async function showConfirm(message, titleKey = 'status.confirm', okBtnKey = null, cancelBtnKey = 'actions.cancel') {
    return showNotice(message, titleKey, true, okBtnKey, cancelBtnKey);
}
