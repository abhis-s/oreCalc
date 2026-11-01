/**
 * Modal Focus Trapping, Initial Focus Resolution, and WAI-ARIA Dialog Semantics.
 * Tier 1: Pure DOM / Accessibility Utility.
 */

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

/**
 * Traps keyboard Tab / Shift+Tab cycling within an active modal container.
 *
 * @param {HTMLElement|any} modal
 * @param {KeyboardEvent} e
 */
export function trapFocus(modal, e) {
    if (e.key !== 'Tab') return;
    const focusable = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);

    if (focusable.length === 0) {
        e.preventDefault();
        return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);

    if (e.shiftKey) {
        if (document.activeElement === first || !modal.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
        }
    } else {
        if (document.activeElement === last || !modal.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
        }
    }
}

/**
 * Applies WAI-ARIA dialog role, aria-modal, and accessible labelling to a modal container.
 *
 * @param {HTMLElement|any} el
 * @param {boolean} [forceDialog=false]
 */
export function ensureModalAriaSemantics(el, forceDialog = false) {
    if (!el) return;

    const isDialogLike = forceDialog ||
        el.classList?.contains?.('modal') ||
        el.classList?.contains?.('dialog-overlay') ||
        el.tagName === 'DIALOG';

    if (isDialogLike) {
        if (typeof el.hasAttribute === 'function' && !el.hasAttribute('role')) {
            if (typeof el.setAttribute === 'function') {
                el.setAttribute('role', 'dialog');
                el.setAttribute('aria-modal', 'true');
            }
        } else if (forceDialog && typeof el.setAttribute === 'function') {
            el.setAttribute('aria-modal', 'true');
        }
    }

    const shouldLabel = forceDialog ||
        (typeof el.getAttribute === 'function' && (
            el.getAttribute('role') === 'dialog' ||
            el.classList?.contains?.('modal') ||
            el.tagName === 'DIALOG'
        ));

    if (shouldLabel && typeof el.hasAttribute === 'function' && !el.hasAttribute('aria-labelledby') && !el.hasAttribute('aria-label')) {
        const heading = typeof el.querySelector === 'function'
            ? el.querySelector('.modal-header h1, .modal-header h2, .modal-header h3, h1, h2, h3')
            : null;
        if (heading) {
            if (!heading.id) {
                heading.id = `${el.id || 'modal'}-title`;
            }
            if (typeof el.setAttribute === 'function') el.setAttribute('aria-labelledby', heading.id);
        } else if (el.id) {
            const fallbackName = el.id.replace(/-modal$/, '').replace(/-/g, ' ');
            if (typeof el.setAttribute === 'function') el.setAttribute('aria-label', fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1));
        }
    }
}

/**
 * Determines whether a candidate DOM element is visible and interactive.
 *
 * @param {Element|any} el
 * @returns {boolean}
 */
function isInteractiveCandidate(el) {
    if (!el || typeof el.getAttribute !== 'function') return false;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    if (el.tabIndex === -1 || el.getAttribute('tabindex') === '-1') return false;

    // Check hidden attribute or class
    if (el.hidden || (el.classList && el.classList.contains('hidden'))) return false;

    // Check inline or computed display/visibility
    if (el.style && (el.style.display === 'none' || el.style.visibility === 'hidden')) return false;

    // Real browser layout geometry check (when supported and computed)
    if (typeof el.offsetWidth === 'number' && typeof el.offsetHeight === 'number') {
        if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.offsetParent === null) {
            if (typeof el.getClientRects === 'function' && el.getClientRects().length === 0) {
                return false;
            }
        }
    }

    // Check for hidden parent containers
    let parent = el.parentElement;
    while (parent) {
        if (parent.hidden || (parent.classList && parent.classList.contains('hidden'))) return false;
        if (parent.style && (parent.style.display === 'none' || parent.style.visibility === 'hidden')) return false;
        parent = parent.parentElement;
    }

    return true;
}

/**
 * Resolves the optimal initial focus candidate for a modal dialog
 * according to WAI-ARIA authoring practices and priority hierarchy.
 *
 * @param {Element|any} modal - The active modal or dialog container.
 * @returns {Element|null} - The element that should receive initial focus.
 */
export function getInitialModalFocusTarget(modal) {
    if (!modal || typeof modal.querySelector !== 'function' || typeof modal.querySelectorAll !== 'function') return null;

    const autofocusCandidates = Array.from(modal.querySelectorAll('[data-modal-autofocus], [autofocus]'));
    const explicitTarget = autofocusCandidates.find(isInteractiveCandidate);
    if (explicitTarget) return explicitTarget;

    const bodyScope = modal.querySelector('.modal-body') || modal.querySelector('.modal-content') || modal;
    if (!bodyScope || typeof bodyScope.querySelectorAll !== 'function') return null;
    const actionsScope = modal.querySelector('.modal-actions, .modal-footer');

    const textInputSelector = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';
    const textInputs = Array.from(bodyScope.querySelectorAll(textInputSelector))
        .filter(el => !el.closest('.modal-header') && isInteractiveCandidate(el));
    if (textInputs.length > 0) return textInputs[0];

    const toggleSelector = 'input[type="checkbox"]:not([disabled]), input[type="radio"]:not([disabled])';
    const toggles = Array.from(bodyScope.querySelectorAll(toggleSelector))
        .filter(el => !el.closest('.modal-header') && isInteractiveCandidate(el));
    if (toggles.length > 0) return toggles[0];

    if (actionsScope) {
        const primaryBtnSelector = '.accept-button, .confirm-button, .btn--primary, .btn-primary, [type="submit"], button[data-action="accept"], button[data-action="confirm"], a.accept-button';
        const primaryBtns = Array.from(actionsScope.querySelectorAll(primaryBtnSelector))
            .filter(isInteractiveCandidate);
        if (primaryBtns.length > 0) return primaryBtns[0];
    }

    const bodyFocusables = Array.from(bodyScope.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(el => !el.closest('.modal-header') && !el.closest('.modal-actions') && !el.closest('.modal-footer') && isInteractiveCandidate(el));
    if (bodyFocusables.length > 0) return bodyFocusables[0];

    if (actionsScope) {
        const anyActionSelector = 'button:not([disabled]), a[href]:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';
        const actionBtns = Array.from(actionsScope.querySelectorAll(anyActionSelector))
            .filter(isInteractiveCandidate);
        if (actionBtns.length > 0) return actionBtns[0];
    }

    const headerClose = modal.querySelector('.modal-header .close-button, .modal-header .modal__close-btn, .modal-header .close-btn, .modal-header button');
    if (headerClose && isInteractiveCandidate(headerClose)) return headerClose;

    const anyClose = modal.querySelector('.close-button, .modal__close-btn, .close-btn');
    if (anyClose && isInteractiveCandidate(anyClose)) return anyClose;

    if (typeof modal.hasAttribute === 'function' && !modal.hasAttribute('tabindex')) {
        if (typeof modal.setAttribute === 'function') {
            modal.setAttribute('tabindex', '-1');
        }
    }
    return modal;
}
