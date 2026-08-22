/**
 * Universal Mobile Back Button, Accessibility (a11y) & Modal Focus Manager
 * - Intercepts Android hardware back button, iOS back swipe gestures, and browser back buttons.
 * - Enforces WAI-ARIA dialog semantics (role="dialog", aria-modal="true").
 * - Traps keyboard focus within active modals (Tab / Shift+Tab cycling).
 * - Restores keyboard focus to the opening trigger button upon modal dismissal.
 * - Provides universal Escape key modal dismissal.
 */

import { MOTION_DURATION_EXIT_MS } from '../core/constants.js';

let modalStack = [];
let isPoppingForClose = false;

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

function trapFocus(modal, e) {
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
 * Programmatically opens a modal dialog, invoking showModal() on native <dialog>
 * elements, attaching top-layer focus trap, and managing browser history state.
 *
 * @param {HTMLElement | string} modalOrId - Modal element or element ID string.
 * @param {Object} [options] - Optional configuration options.
 */
export function openModal(modalOrId, options = {}) {
    const modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!modal) return;

    if (typeof modal.showModal === 'function' && !modal.open) {
        try {
            modal.showModal();
        } catch (err) {
            // Fallback if unsupported or already showing in non-standard environment
        }
    }

    modal.classList.add('show');
    handleModalStateChange(modal, true, options);
}

/**
 * Programmatically closes a modal dialog, gracefully coordinating exit animation,
 * invoking dialog.close() on native <dialog> elements, and popping browser history state.
 *
 * @param {HTMLElement | string} modalOrId - Modal element or element ID string.
 * @param {Function} [callback] - Optional callback function executed upon close completion.
 */
export function closeModal(modalOrId, callback) {
    const modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!modal) return;

    closeModalAnimated(modal, () => {
        if (typeof modal.close === 'function' && modal.open) {
            try {
                modal.close();
            } catch (err) {
                // Fallback for mock environments
            }
        }
        if (typeof callback === 'function') {
            callback();
        }
    });
}

/**
 * Animates modal dialog closure with smooth scale/fade exit transitions before removing DOM state.
 * @param {HTMLElement|HTMLDialogElement|any} modal - Target modal or dialog element.
 * @param {() => void} [callback] - Optional completion callback executed after exit animation finishes.
 */
export function closeModalAnimated(modal, callback) {
    if (!modal) return;
    if (modal.id === 'welcome-modal' || modal.classList.contains('welcome-modal-content')) {
        modal.classList.remove('show', 'active', 'open', 'closing');
        if (typeof modal.close === 'function' && modal.open) {
            try {
                modal.close();
            } catch (err) {}
        }
        const visibleModals = document.querySelectorAll('.modal.show, dialog.modal[open]');
        if (visibleModals.length === 0) {
            const overlays = document.querySelectorAll('#overlay, #nav-drawer-overlay, .modal-overlay, .dialog-overlay');
            overlays.forEach(o => {
                o.classList.remove('show', 'active', 'closing');
                o.style.opacity = '';
            });
        }
        handleModalStateChange(modal, false);
        if (callback) callback();
        return;
    }
    if (modal.classList.contains('closing')) return;

    modal.classList.add('closing');
    const overlay = document.getElementById('overlay');
    if (overlay && modal.classList.contains('modal')) {
        overlay.classList.add('closing');
    }

    setTimeout(() => {
        modal.classList.remove('show', 'active', 'open', 'closing');
        if (typeof modal.close === 'function' && modal.open) {
            try {
                modal.close();
            } catch (err) {}
        }

        if (modal.id === 'nav-drawer' || modal.id === 'navigation-drawer' || modal.classList.contains('nav-drawer') || modal.classList.contains('navigation-drawer')) {
            document.body.classList.remove('open-drawer');
            modal.style.transform = '';
        }
        if (modal.id === 'fab-menu' || modal.classList.contains('fab-menu')) {
            document.body.classList.remove('open-fab');
        }

        const visibleModals = document.querySelectorAll('.modal.show, .dialog-overlay.show, dialog.modal[open], dialog.navigation-drawer[open]');
        if (visibleModals.length === 0) {
            const overlays = document.querySelectorAll('#overlay, #nav-drawer-overlay, .modal-overlay, .dialog-overlay');
            overlays.forEach(o => {
                o.classList.remove('show', 'active', 'closing');
                o.style.opacity = '';
            });
        }
        handleModalStateChange(modal, false);
        modal.dispatchEvent(new CustomEvent('modalClosed', { bubbles: true }));
        if (callback) callback();
    }, MOTION_DURATION_EXIT_MS);
}

function closeTargetModal(item) {
    if (!item || !item.element) return;

    const el = item.element;
    try {
        if (typeof item.closeFn === 'function') {
            item.closeFn();
        } else {
            closeModalAnimated(el);
        }
    } catch (err) {
        console.warn('[ModalHistoryManager] Error closing modal on back navigation:', err);
    }
}

/**
 * Initializes browser history stack integration and popstate listeners for nested modal dialogs.
 */
export function initializeModalHistoryManager() {
    // Smoothly animate modal dismiss when close/cancel/X buttons are clicked
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.close-button, [data-action="close"], [data-modal-dismiss]');
        if (!closeBtn) return;

        const modal = closeBtn.closest('.modal, dialog, .dialog-overlay');
        const isOpen = modal && (modal.classList.contains('show') || modal.open);
        if (modal && modal.id !== 'welcome-modal' && isOpen && !modal.classList.contains('closing')) {
            closeModalAnimated(modal);
        }
    });

    // Escape key modal dismissal fallback for standard DOM elements
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (modalStack.length > 0) {
                const topModal = modalStack.at(-1);
                if (topModal && topModal.element && topModal.element.id !== 'welcome-modal') {
                    closeTargetModal(topModal);
                }
            }
        }
    });

    // Intercept back navigation gestures & buttons
    window.addEventListener('popstate', () => {
        if (isPoppingForClose) {
            isPoppingForClose = false;
            return;
        }

        if (modalStack.length > 0) {
            const topModal = modalStack.pop();
            closeTargetModal(topModal);
        }
    });

    // Observe specific modal & drawer elements for class and open attribute changes
    const observeModalTarget = (el) => {
        if (!el || el.__historyObserverAttached) return;
        el.__historyObserverAttached = true;

        // Ensure ARIA semantics and accessible name
        if (!el.hasAttribute('role') && (el.classList.contains('modal') || el.classList.contains('dialog-overlay') || el.tagName === 'DIALOG')) {
            el.setAttribute('role', 'dialog');
            el.setAttribute('aria-modal', 'true');
        }

        if (el.getAttribute('role') === 'dialog' || el.classList.contains('modal') || el.tagName === 'DIALOG') {
            if (!el.hasAttribute('aria-labelledby') && !el.hasAttribute('aria-label')) {
                const heading = el.querySelector('.modal-header h1, .modal-header h2, .modal-header h3, h1, h2, h3');
                if (heading) {
                    if (!heading.id) {
                        heading.id = `${el.id || 'modal'}-title`;
                    }
                    el.setAttribute('aria-labelledby', heading.id);
                } else if (el.id) {
                    const fallbackName = el.id.replace(/-modal$/, '').replace(/-/g, ' ');
                    el.setAttribute('aria-label', fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1));
                }
            }
        }

        // Native cancel event listener (fired on Escape key in native dialogs)
        el.addEventListener('cancel', (e) => {
            e.preventDefault();
            if (el.id === 'welcome-modal') return;
            closeModalAnimated(el);
        });

        // Native backdrop click listener: clicks on the <dialog> element itself (outside .modal-content)
        el.addEventListener('click', (e) => {
            if (e.target === el) {
                if (el.id === 'welcome-modal') return;
                closeModalAnimated(el);
            }
        });

        observer.observe(el, {
            attributes: true,
            attributeFilter: ['class', 'open']
        });
    };

    // Observe body & document tree for modal/drawer visibility changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Node.ELEMENT_NODE
                        if (node.matches && (node.matches('dialog, .modal, .dialog-overlay, .nav-drawer, .navigation-drawer') || node.id === 'level-select-modal')) {
                            observeModalTarget(node);
                        }
                        if (node.querySelectorAll) {
                            const nestedModals = node.querySelectorAll('dialog, .modal, .dialog-overlay, .nav-drawer, .navigation-drawer');
                            nestedModals.forEach(observeModalTarget);
                        }
                    }
                });
                return;
            }

            const target = mutation.target;

            // Target check: modals, dialog overlays, side drawer, FAB menu (excluding welcome-modal to prevent mobile back-gesture dismissal)
            const isModal = (target.classList.contains('modal') && target.id !== 'welcome-modal') ||
                            target.tagName === 'DIALOG' ||
                            target.classList.contains('dialog-overlay') ||
                            target.classList.contains('nav-drawer') ||
                            target.classList.contains('navigation-drawer') ||
                            target.id === 'nav-drawer' ||
                            target.id === 'navigation-drawer' ||
                            target.id === 'priority-list-modal' ||
                            target.id === 'equipment-details-modal' ||
                            target.id === 'changelog-modal' ||
                            target.id === 'commits-modal' ||
                            target.id === 'app-settings-modal' ||
                            target.id === 'star-bonus-multiplier-modal';

            const isBodyDrawerOrFab = target === document.body && (mutation.attributeName === 'class');

            if (isModal && target.id !== 'welcome-modal') {
                const isOpen = target.classList.contains('show') ||
                               target.classList.contains('open') ||
                               target.classList.contains('active') ||
                               Boolean(target.open || (typeof target.hasAttribute === 'function' && target.hasAttribute('open')));

                handleModalStateChange(target, isOpen);
            } else if (isBodyDrawerOrFab) {
                const navDrawer = document.getElementById('nav-drawer') || document.getElementById('navigation-drawer');
                if (navDrawer) {
                    const isDrawerOpen = document.body.classList.contains('open-drawer');
                    handleModalStateChange(navDrawer, isDrawerOpen);
                }
                const fabMenu = document.getElementById('fab-menu');
                if (fabMenu) {
                    const isFabOpen = document.body.classList.contains('open-fab');
                    handleModalStateChange(fabMenu, isFabOpen);
                }
            }
        });
    });

    const initialTargets = document.querySelectorAll('dialog, .modal, .dialog-overlay, .nav-drawer, .navigation-drawer, #nav-drawer, #navigation-drawer, #fab-menu, #priority-list-modal, #equipment-details-modal, #changelog-modal, #commits-modal, #app-settings-modal, #star-bonus-multiplier-modal');
    initialTargets.forEach(observeModalTarget);

    // Observe body for drawer/fab classes and dynamically added modals
    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true
    });
}

/**
 * Determines whether a candidate DOM element is visible and interactive.
 *
 * @param {Element|null} el
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
 * according to WAI-ARIA authoring practices and strict priority hierarchy.
 *
 * Priority Hierarchy:
 * 1. Explicit data-modal-autofocus or autofocus target (if visible & enabled).
 * 2. First interactive text/number/email/url input, select dropdown, or textarea in .modal-body / .modal-content.
 * 3. First checkbox or radio toggle in .modal-body / .modal-content (if no text inputs).
 * 4. Primary confirm/accept/submit button in .modal-actions / .modal-footer (.btn-primary, .confirm-button, .accept-button, [type="submit"]).
 * 5. First focusable interactive element in .modal-body / .modal-content.
 * 6. Any action button in .modal-actions / .modal-footer.
 * 7. Fallback: Close button in .modal-header or the modal container itself.
 *
 * @param {Element|null} modal - The active modal or dialog container.
 * @returns {Element|null} - The element that should receive initial focus.
 */
export function getInitialModalFocusTarget(modal) {
    if (!modal || typeof modal.querySelector !== 'function') return null;

    const autofocusCandidates = Array.from(modal.querySelectorAll('[data-modal-autofocus], [autofocus]'));
    const explicitTarget = autofocusCandidates.find(isInteractiveCandidate);
    if (explicitTarget) return explicitTarget;

    const bodyScope = modal.querySelector('.modal-body') || modal.querySelector('.modal-content') || modal;
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
        const primaryBtnSelector = '.accept-button, .confirm-button, .btn-primary, [type="submit"], button[data-action="accept"], button[data-action="confirm"], a.accept-button';
        const primaryBtns = Array.from(actionsScope.querySelectorAll(primaryBtnSelector))
            .filter(isInteractiveCandidate);
        if (primaryBtns.length > 0) return primaryBtns[0];
    }

    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';
    const bodyFocusables = Array.from(bodyScope.querySelectorAll(focusableSelector))
        .filter(el => !el.closest('.modal-header') && !el.closest('.modal-actions') && !el.closest('.modal-footer') && isInteractiveCandidate(el));
    if (bodyFocusables.length > 0) return bodyFocusables[0];

    if (actionsScope) {
        const anyActionSelector = 'button:not([disabled]), a[href]:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';
        const actionBtns = Array.from(actionsScope.querySelectorAll(anyActionSelector))
            .filter(isInteractiveCandidate);
        if (actionBtns.length > 0) return actionBtns[0];
    }

    const headerClose = modal.querySelector('.modal-header .close-button, .modal-header .close-btn, .modal-header button');
    if (headerClose && isInteractiveCandidate(headerClose)) return headerClose;

    const anyClose = modal.querySelector('.close-button, .close-btn');
    if (anyClose && isInteractiveCandidate(anyClose)) return anyClose;

    if (!modal.hasAttribute('tabindex')) {
        modal.setAttribute('tabindex', '-1');
    }
    return modal;
}

/**
 * Synchronizes browser history stack entries and focus trapping when a modal opens or closes.
 * @param {HTMLElement|HTMLDialogElement|any} element - Modal dialog DOM element.
 * @param {boolean} isOpen - True if opening, false if closing.
 * @param {object} [options={}] - Configuration options for close callbacks and focus restore targets.
 */
export function handleModalStateChange(element, isOpen, options = {}) {
    if (!element) return;
    if (element.id === 'welcome-modal') {
        // Welcome modal is onboarding flow, exempted from history back popping
        return;
    }

    const existingIndex = modalStack.findIndex(item => item.element === element);

    if (isOpen) {
        if (typeof element.showModal === 'function' && !element.open) {
            try {
                element.showModal();
            } catch (err) {}
        }

        if (existingIndex === -1) {
            // Ensure ARIA semantics & accessible name
            if (!element.hasAttribute('role')) {
                element.setAttribute('role', 'dialog');
            }
            element.setAttribute('aria-modal', 'true');

            if (!element.hasAttribute('aria-labelledby') && !element.hasAttribute('aria-label')) {
                const heading = element.querySelector('.modal-header h1, .modal-header h2, .modal-header h3, h1, h2, h3');
                if (heading) {
                    if (!heading.id) {
                        heading.id = `${element.id || 'modal'}-title`;
                    }
                    element.setAttribute('aria-labelledby', heading.id);
                } else if (element.id) {
                    const fallbackName = element.id.replace(/-modal$/, '').replace(/-/g, ' ');
                    element.setAttribute('aria-label', fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1));
                }
            }

            const previousActiveElement = document.activeElement;
            const trapHandler = (e) => trapFocus(element, e);
            element.addEventListener('keydown', trapHandler);

            // Focus initial interactive element inside modal according to WAI-ARIA hierarchy
            setTimeout(() => {
                const target = getInitialModalFocusTarget(element);
                if (target && typeof target.focus === 'function') {
                    target.focus();
                }
            }, 50);

            // Push history state entry for back-gesture trapping
            const stateId = `modal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            modalStack.push({ element, stateId, previousActiveElement, trapHandler, options });
            if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
                window.history.pushState({ modalStateId: stateId }, '');
            }
        }
    } else {
        if (typeof element.close === 'function' && element.open) {
            try {
                element.close();
            } catch (err) {}
        }

        if (existingIndex !== -1) {
            const [removed] = modalStack.splice(existingIndex, 1);

            if (removed && removed.trapHandler) {
                element.removeEventListener('keydown', removed.trapHandler);
            }

            // Restore focus to opening trigger element
            if (removed && removed.previousActiveElement && typeof removed.previousActiveElement.focus === 'function') {
                try {
                    removed.previousActiveElement.focus();
                } catch (e) {}
            }

            // Cleanup overlays if all modals are closed
            const visibleModals = document.querySelectorAll('.modal.show, .dialog-overlay.show, dialog.modal[open], dialog.navigation-drawer[open]');
            if (visibleModals.length === 0) {
                const overlays = document.querySelectorAll('#overlay, #nav-drawer-overlay, .modal-overlay, .dialog-overlay');
                overlays.forEach(overlay => {
                    overlay.classList.remove('show', 'active');
                    overlay.style.opacity = '';
                });
            }

            // If closed manually by user (X button, tap outside) and state is top of stack, pop history entry
            if (typeof window !== 'undefined' && window.history && window.history.state && window.history.state.modalStateId === removed.stateId) {
                isPoppingForClose = true;
                window.history.back();
            }
        }
    }
}

/**
 * Closes all open modal dialogs, drawers, and overlay backdrops unconditionally.
 * Synchronously removes top-layer pointer locks and resets modal navigation stack.
 */
export function closeAllModals() {
    const candidateModals = document.querySelectorAll('dialog, .modal, .dialog-overlay, .nav-drawer, .navigation-drawer, #fab-menu');
    candidateModals.forEach(modal => {
        const isOpen = modal.classList.contains('show') ||
                       modal.classList.contains('open') ||
                       modal.classList.contains('active') ||
                       Boolean(modal.open);
        if (isOpen) {
            modal.classList.remove('show', 'active', 'open', 'closing');
            if (typeof modal.close === 'function' && modal.open) {
                try {
                    modal.close();
                } catch (err) {}
            }
            if (modal.id === 'nav-drawer' || modal.id === 'navigation-drawer' || modal.classList.contains('nav-drawer') || modal.classList.contains('navigation-drawer')) {
                document.body.classList.remove('open-drawer');
                modal.style.transform = '';
            }
            if (modal.id === 'fab-menu' || modal.classList.contains('fab-menu')) {
                document.body.classList.remove('open-fab');
            }
            handleModalStateChange(modal, false);
        }
    });

    modalStack.forEach(item => {
        if (item && item.element && item.trapHandler) {
            item.element.removeEventListener('keydown', item.trapHandler);
        }
    });
    modalStack = [];

    const overlays = document.querySelectorAll('#overlay, #nav-drawer-overlay, .modal-overlay, .dialog-overlay');
    overlays.forEach(overlay => {
        overlay.classList.remove('show', 'active', 'closing');
        overlay.style.opacity = '';
    });
    document.body.classList.remove('open-drawer', 'open-fab');
}
