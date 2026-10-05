import { translate } from '../i18n/translator.js';
import { announce } from '../utils/a11yAnnouncer.js';

export const API_ERROR_COOLDOWN_MS = 2 * 60 * 1000;
let lastApiErrorTimestamp = 0;
const activeToasts = [];

function updateToastPositions() {
    const isMobile = window.innerWidth <= 779;
    // Row height matches the CSS heights plus a gap (desktop: 50px + 12px gap = 62px; mobile: 40px + 8px gap = 48px)
    const rowHeight = isMobile ? 48 : 62;
    const maxStackSlots = isMobile ? 2 : 5;

    activeToasts.forEach((toast, index) => {
        // Enforce max stack rows. Index (maxStackSlots - 1) and above stack on that topmost row.
        const slotIndex = Math.min(index, maxStackSlots - 1);
        const targetY = -slotIndex * rowHeight;

        toast.style.transform = `translateY(${targetY}px) scale(1)`;
        toast.style.zIndex = `${1000 - index}`;
    });
}

/**
 * Displays a non-blocking toast notification banner with stacked positioning and screen reader announcements.
 * @param {string} message - Notification text message.
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - Semantic toast theme type.
 */
export function showToast(message, type = 'info') {
    announce(message, type === 'error' ? 'assertive' : 'polite');

    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

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
    toast.innerHTML = `
        <span class="toast-icon">
            <orecalc-assets-svg name="${iconName}" class="toast-icon-svg" aria-hidden="true"></orecalc-assets-svg>
        </span>
        <span class="toast-message">${message}</span>
    `;

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
            });
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

        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
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
