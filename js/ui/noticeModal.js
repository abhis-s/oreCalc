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
 * Sanitizes HTML input to allow only safe formatting elements and classes.
 * Discards any dangerous elements such as script, iframe, objects, images, etc.
 * 
 * @param {string} html - The raw HTML string to sanitize.
 * @returns {string} The sanitized HTML safe for innerHTML insertion.
 */
function sanitizeHTML(html) {
    if (!html) return '';
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const allowedTags = new Set(['span', 'strong', 'em', 'code', 'br', 'p', 'b', 'i']);
        const allowedClasses = new Set(['user-id-code']);
        const blockedTags = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'svg', 'img', 'video', 'audio']);

        function cleanNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.cloneNode(true);
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                if (blockedTags.has(tagName)) {
                    return document.createDocumentFragment();
                }
                if (allowedTags.has(tagName)) {
                    const cleanedElement = document.createElement(tagName);
                    if (node.className) {
                        const classes = Array.from(node.classList).filter(cls => allowedClasses.has(cls));
                        if (classes.length > 0) {
                            cleanedElement.className = classes.join(' ');
                        }
                    }
                    for (const child of Array.from(node.childNodes)) {
                        cleanedElement.appendChild(cleanNode(child));
                    }
                    return cleanedElement;
                }
            }
            // Unrecognized tags: just extract children (unpack them)
            const fragment = document.createDocumentFragment();
            for (const child of Array.from(node.childNodes)) {
                fragment.appendChild(cleanNode(child));
            }
            return fragment;
        }

        const container = document.createElement('div');
        for (const child of Array.from(doc.body.childNodes)) {
            container.appendChild(cleanNode(child));
        }
        return container.innerHTML;
    } catch (e) {
        // Fallback to text content if DOMParser fails
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
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
        messageElem.innerHTML = sanitizeHTML(message);
        
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
