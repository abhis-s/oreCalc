import { translate } from '../i18n/translator.js';
import { announce } from '../utils/a11yAnnouncer.js';

export const API_ERROR_COOLDOWN_MS = 2 * 60 * 1000;
let lastApiErrorTimestamp = 0;
const activeToasts = [];

function updateToastPositions() {
    const isMobile = window.innerWidth <= 779;
    const gap = isMobile ? 8 : 12;
    const fallbackHeight = isMobile ? 40 : 50;
    const maxStackSlots = isMobile ? 2 : 5;

    const heights = activeToasts.map((toast) => toast.offsetHeight || fallbackHeight);
    const offsets = [];
    let cumulativeY = 0;
    for (let i = 0; i < activeToasts.length; i++) {
        if (i < maxStackSlots) {
            offsets.push(-cumulativeY);
            cumulativeY += heights[i] + gap;
        } else {
            offsets.push(offsets[maxStackSlots - 1]);
        }
    }

    activeToasts.forEach((toast, index) => {
        toast.style.transform = `translateY(${offsets[index]}px) scale(1)`;
        toast.style.zIndex = `${1000 - index}`;
    });
}

/**
 * Retrieves or creates the singleton toast notification container element,
 * initializing it with popover="manual" for browser Top Layer promotion.
 *
 * @returns {HTMLElement} The toast container element.
 */
export function getOrCreateToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        if (typeof container.setAttribute === 'function') {
            container.setAttribute('popover', 'manual');
        }
        document.body.appendChild(container);
    } else if (typeof container.setAttribute === 'function' && !container.getAttribute('popover')) {
        container.setAttribute('popover', 'manual');
    }
    return container;
}

/**
 * Promotes the toast container into the browser's Top Layer so that notifications
 * reliably render above active native dialog modals.
 *
 * @param {HTMLElement} container
 */
export function ensureToastContainerInTopLayer(container) {
    if (!container || typeof container.showPopover !== 'function') {
        return;
    }
    try {
        const isAlreadyOpen = typeof container.matches === 'function' ? container.matches(':popover-open') : false;
        const hasOpenDialog = Boolean(document.querySelector?.('dialog[open], .modal.show'));

        // Re-promote container if an open modal dialog exists to guarantee top layer apex
        if (hasOpenDialog && isAlreadyOpen && typeof container.hidePopover === 'function') {
            container.hidePopover();
        }

        if (!container.matches || !container.matches(':popover-open')) {
            container.showPopover();
        }
    } catch {
        // Fallback for non-standard or mock environments
    }
}

/**
 * Displays a non-blocking toast notification banner with stacked positioning and screen reader announcements.
 *
 * @param {string} message - Notification text message.
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Semantic toast theme type.
 * @returns {HTMLElement|null} The mounted toast element or null if DOM is unavailable.
 */
export function showToast(message, type = 'info') {
    if (typeof document === 'undefined') {
        return null;
    }
    announce(message, type === 'error' ? 'assertive' : 'polite');

    const container = getOrCreateToastContainer();
    ensureToastContainerInTopLayer(container);

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;

    let iconId = 'icon-notification';
    if (type === 'error') {
        iconId = 'icon-error';
    } else if (type === 'success') {
        iconId = 'icon-check';
    } else if (type === 'warning') {
        iconId = 'icon-warning';
    }

    const iconName = iconId.replace(/^icon-/, '');
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    const svgElem = document.createElement('clashcalc-assets-svg');
    svgElem.setAttribute('name', iconName);
    svgElem.setAttribute('class', 'toast-icon-svg');
    svgElem.setAttribute('aria-hidden', 'true');
    iconSpan.appendChild(svgElem);

    const messageSpan = document.createElement('span');
    messageSpan.className = 'toast-message';
    messageSpan.textContent = String(message);

    toast.appendChild(iconSpan);
    toast.appendChild(messageSpan);

    // Position it at slot 0 initially, but offset slightly down and faded out for the transition
    toast.style.opacity = '0';
    toast.style.transform = `translateY(20px) scale(0.95)`;

    container.appendChild(toast);

    // Add to active queue (unshift to keep index 0 as newest at the bottom)
    activeToasts.unshift(toast);

    // Limit maximum number of toasts to 9, removing the oldest from the screen/queue immediately if exceeded
    while (activeToasts.length > 9) {
        const oldestToast = activeToasts.pop();
        if (oldestToast) {
            oldestToast.style.opacity = '0';
            oldestToast.style.transform = oldestToast.style.transform.replace('scale(1)', 'scale(0.95)');
            oldestToast.addEventListener('transitionend', () => {
                oldestToast.remove();
            }, { once: true });
            setTimeout(() => {
                if (oldestToast.parentElement) {
                    oldestToast.remove();
                }
            }, 500);
        }
    }

    // Trigger position updates on next animation frame
    requestAnimationFrame(() => {
        updateToastPositions();
        toast.style.opacity = '1';
    });

    // Expiration timer
    setTimeout(() => {
        toast.style.opacity = '0';
        // Fade out transition
        toast.style.transform = toast.style.transform.replace('scale(1)', 'scale(0.95)');

        const idx = activeToasts.indexOf(toast);
        if (idx !== -1) {
            activeToasts.splice(idx, 1);
            updateToastPositions();
        }

        const removeToastAndCleanContainer = () => {
            toast.remove();
            if (activeToasts.length === 0 && typeof container.hidePopover === 'function') {
                try {
                    const isOpen = typeof container.matches === 'function' ? container.matches(':popover-open') : true;
                    if (isOpen) {
                        container.hidePopover();
                    }
                } catch {
                    // Fallback for non-standard environments
                }
            }
        };

        toast.addEventListener('transitionend', removeToastAndCleanContainer, { once: true });
        // Fallback removal if transition doesn't fire
        setTimeout(() => {
            if (toast.parentElement) {
                removeToastAndCleanContainer();
            }
        }, 500);
    }, 4000);

    return toast;
}

/**
 * Normalizes and extracts user-friendly text from error codes, objects, or strings.
 * @param {any} errorOrMessage - Error payload, i18n key, or message string.
 * @returns {string} Sanitized localized message.
 */
export function formatApiErrorMessage(errorOrMessage) {
    if (!errorOrMessage) {
        return translate('apiErrors.500');
    }
    if (typeof errorOrMessage === 'object') {
        if (errorOrMessage.errorType && typeof errorOrMessage.errorType === 'string') {
            return translate(errorOrMessage.errorType);
        }
        if (errorOrMessage.message && typeof errorOrMessage.message === 'string') {
            return errorOrMessage.message.replace(/<[^>]*>/g, '').trim();
        }
    }
    if (typeof errorOrMessage === 'string') {
        if (errorOrMessage.startsWith('apiErrors.') || errorOrMessage.startsWith('errors.')) {
            return translate(errorOrMessage);
        }
        return errorOrMessage.replace(/<[^>]*>/g, '').trim();
    }
    return String(errorOrMessage);
}

/**
 * Displays an API error toast constrained to at most 1 visible instance and a 2-minute mute cooldown.
 * Subsequent API errors during the 2-minute window are dropped without altering base toast settings.
 * @param {any} errorOrMessage - Error payload, i18n key, or error object.
 * @returns {HTMLElement|null} The toast element if rendered, or null if dropped by cooldown.
 */
export function showApiErrorToast(errorOrMessage) {
    const now = Date.now();

    if (now - lastApiErrorTimestamp < API_ERROR_COOLDOWN_MS) {
        return null;
    }

    lastApiErrorTimestamp = now;

    // Dismiss any existing API error toast before rendering to enforce 1-toast limit for API errors
    for (let i = activeToasts.length - 1; i >= 0; i--) {
        const activeToast = activeToasts[i];
        if (activeToast && activeToast.classList.contains('toast-api-error')) {
            activeToasts.splice(i, 1);
            activeToast.remove();
        }
    }
    updateToastPositions();

    const cleanMessage = formatApiErrorMessage(errorOrMessage);
    const toast = showToast(cleanMessage, 'error');
    if (toast) {
        toast.classList.add('toast-api-error');
        toast.dataset.toastCategory = 'api-error';
    }
    return toast;
}

/**
 * Resets the 2-minute API error cooldown timer in memory (primarily for testing).
 */
export function resetApiErrorCooldown() {
    lastApiErrorTimestamp = 0;
}
