import { translate } from '../i18n/translator.js';
import { sanitizeHTML } from '../utils/stringUtils.js';

let modal, titleElem, messageElem, cancelBtn, okBtn, overlay;
/** @type {(() => void) | null} */
let activeNoticeSupersede = null;

function initializeNoticeModal() {
    modal = document.getElementById('notice-modal');
    titleElem = document.getElementById('notice-modal-title');
    messageElem = document.getElementById('notice-modal-message');
    cancelBtn = document.getElementById('cancel-notice-modal-btn') || document.getElementById('notice-modal-cancel-btn');
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
        activeNoticeSupersede?.();

        if (!modal || (typeof modal.isConnected === 'boolean' && !modal.isConnected)) {
            initializeNoticeModal();
        }
        if (!modal || !titleElem || !messageElem || !okBtn || !cancelBtn) {
            resolve(false);
            return;
        }

        titleElem.textContent = translate(titleKey);
        titleElem.setAttribute('data-i18n', titleKey);
        messageElem.innerHTML = sanitizeHTML(message);

        cancelBtn.hidden = !showCancel;
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

        const handleCancelEvent = (e) => {
            e?.preventDefault?.();
            handleCancel();
        };

        const handleBackdropClick = (e) => {
            if (e.target === modal) {
                handleCancel();
            }
        };

        const handleMessageClick = (e) => {
            const anchor = /** @type {HTMLElement | null} */ (e.target)?.closest('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (href === '#open-data-management') {
                e.preventDefault();
                cleanup();
                resolve(false);
                if (typeof window !== 'undefined' && window.location) {
                    const pathLang = window.location.pathname.split('/').filter(Boolean)[0];
                    const isSupported = pathLang && ['de', 'tr', 'zh'].includes(pathLang.toLowerCase());
                    const targetPath = isSupported ? `/${pathLang.toLowerCase()}/account/` : '/account/';
                    window.location.href = targetPath;
                }
            }
        };

        const detachListeners = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.removeEventListener('cancel', handleCancelEvent);
            modal.removeEventListener('click', handleBackdropClick);
            messageElem?.removeEventListener?.('click', handleMessageClick);
        };

        const supersede = () => {
            if (activeNoticeSupersede === supersede) {
                activeNoticeSupersede = null;
            }
            detachListeners();
            resolve(false);
        };

        const cleanup = () => {
            if (activeNoticeSupersede === supersede) {
                activeNoticeSupersede = null;
            }
            detachListeners();
            modal.classList.remove('show');
            if (typeof modal.close === 'function' && modal.open) {
                try {
                    modal.close();
                } catch (e) {}
            }
            const otherOpenModal = typeof document !== 'undefined' && typeof document.querySelector === 'function'
                ? document.querySelector('.modal.show:not(#notice-modal), dialog[open]:not(#notice-modal), .dialog-overlay.show, .navigation-drawer.open, dialog.navigation-drawer[open]')
                : null;
            if (!otherOpenModal) {
                overlay?.classList.remove('show');
            }
        };

        activeNoticeSupersede = supersede;

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        modal.addEventListener('cancel', handleCancelEvent);
        modal.addEventListener('click', handleBackdropClick);
        messageElem?.addEventListener?.('click', handleMessageClick);

        if (typeof modal.showModal === 'function' && !modal.open) {
            try {
                modal.showModal();
            } catch (e) {}
        }
        modal.classList.add('show');
        overlay?.classList.add('show');
    });
}

/**
 * Displays an alert notice modal.
 *
 * @param {string} message - Message or i18n key to display.
 * @param {string} [titleKey='status.notice'] - Modal title i18n key.
 * @param {string|null} [okBtnKey=null] - OK button label i18n key.
 * @returns {Promise<boolean>} Resolves to true when dismissed.
 */
export async function showAlert(message, titleKey = 'status.notice', okBtnKey = null) {
    return showNotice(message, titleKey, false, okBtnKey);
}

/**
 * Displays a confirmation dialog modal.
 *
 * @param {string} message - Confirmation message or i18n key to display.
 * @param {string} [titleKey='actions.confirm'] - Modal title i18n key.
 * @param {string|null} [okBtnKey=null] - Confirm button label i18n key.
 * @param {string} [cancelBtnKey='actions.cancel'] - Cancel button label i18n key.
 * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled.
 */
export async function showConfirm(message, titleKey = 'actions.confirm', okBtnKey = null, cancelBtnKey = 'actions.cancel') {
    return showNotice(message, titleKey, true, okBtnKey, cancelBtnKey);
}
