/**
 * Account Display Utilities.
 * Reusable DOM content and animation helpers for account management views.
 * Tier 4: UI Presentation Helper.
 */

/**
 * Sets animated button label and optional SVG icon name without clobbering inner layout wrappers.
 *
 * @param {HTMLElement|null} btn - Button element.
 * @param {string} text - Localized text content.
 * @param {string|null} [iconName=null] - Optional SVG icon identifier.
 */
export function setAnimatedButtonContent(btn, text, iconName = null) {
    if (!btn) return;
    const textEl = btn.querySelector('.animated-btn-text');
    if (textEl) {
        textEl.textContent = text;
    } else {
        btn.textContent = text;
    }

    if (iconName) {
        const iconEl = btn.querySelector('.animated-btn-icon-wrapper clashcalc-assets-svg, .animated-btn-icon-wrapper orecalc-assets-svg');
        if (iconEl) {
            iconEl.setAttribute('name', iconName);
        }
    }
}
