/**
 * Accessibility Live Region Announcer for assistive technologies (screen readers).
 * Dispatches polite dynamic announcements for calculation results, status updates, and notifications.
 */

let announcerElement = null;
let debounceTimer = null;

/**
 * Retrieves or lazily creates the singleton aria-live live region DOM container.
 *
 * @returns {HTMLElement | null} Live region DOM element.
 */
function getOrCreateAnnouncer() {
    if (typeof document === 'undefined') return null;
    if (announcerElement && document.body && document.body.contains(announcerElement)) {
        return announcerElement;
    }
    let el = document.getElementById('a11y-announcer');
    if (!el && document.body) {
        el = document.createElement('div');
        el.id = 'a11y-announcer';
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
        document.body.appendChild(el);
    }
    announcerElement = el;
    return announcerElement;
}

/**
 * Announces a message to screen readers via aria-live live region.
 * @param {string} message - The text message to announce.
 * @param {'polite' | 'assertive'} [mode='polite'] - Live region politeness level.
 */
export function announce(message, mode = 'polite') {
    if (!message || typeof message !== 'string') return;
    const cleanMsg = message.trim();
    if (!cleanMsg) return;

    const el = getOrCreateAnnouncer();
    if (!el) return;

    if (el.getAttribute('aria-live') !== mode) {
        el.setAttribute('aria-live', mode);
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        el.textContent = '';
        if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => {
                el.textContent = cleanMsg;
            });
        } else {
            el.textContent = cleanMsg;
        }
    }, 150);
}
