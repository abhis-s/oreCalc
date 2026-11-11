/**
 * Universal Mobile Back Button, Accessibility (a11y) & Modal History Manager
 * - Intercepts Android hardware back button, iOS back swipe gestures, and browser back buttons.
 * - Coordinates with modalFocusManager for WAI-ARIA dialog semantics and focus trapping.
 * - Restores keyboard focus to the opening trigger button upon modal dismissal.
 * - Provides universal Escape key modal dismissal.
 */

import { MOTION_DURATION_EXIT_MS } from '../core/constants.js';
import { hideCardHelpPopover } from './cardHelpPopover.js';
import { trapFocus, ensureModalAriaSemantics, getInitialModalFocusTarget } from './modalFocusManager.js';

let modalStack = [];
let isPoppingForClose = false;
let isModalPopping = false;
let suppressHistoryPop = false;

/**
 * Indicates whether a popstate event was triggered by modal/drawer closure or trapped by an active modal.
 * @returns {boolean}
 */
export function isModalHistoryPopping() {
    return isPoppingForClose || isModalPopping;
}

/**
 * Programmatically opens a modal dialog, invoking showModal() on native <dialog>
 * elements, attaching top-layer focus trap, and managing browser history state.
 *
 * @param {HTMLElement | string} modalOrId - Modal element or element ID string.
 * @param {Object} [options] - Optional configuration options.
 */
export function openModal(modalOrId, options = {}) {
    hideCardHelpPopover();
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
 * @param {HTMLElement|HTMLDialogElement|string|any} modalOrId - Target modal element or ID string.
 * @param {() => void} [callback] - Optional completion callback executed after exit animation finishes.
 */
export function closeModalAnimated(modalOrId, callback) {
    const modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!modal) return;
    if (modal.id === 'guided-setup-modal' || modal.classList.contains('guided-setup-modal-content')) {
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
            document.body?.classList?.remove('open-drawer');
            modal.style.transform = '';
        }
        if (modal.id === 'fab-menu' || modal.classList.contains('fab-menu')) {
            document.body?.classList?.remove('open-fab');
        }

        if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
            const visibleModals = document.querySelectorAll('.modal.show, .dialog-overlay.show, dialog.modal[open], dialog.navigation-drawer[open]');
            if (visibleModals.length === 0) {
                const overlays = document.querySelectorAll('#overlay, #nav-drawer-overlay, .modal-overlay, .dialog-overlay');
                overlays.forEach(o => {
                    o.classList.remove('show', 'active', 'closing');
                    o.style.opacity = '';
                });
            }
        }
        handleModalStateChange(modal, false);
        if (typeof modal.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            modal.dispatchEvent(new CustomEvent('modalClosed', { bubbles: true }));
        }
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

const boundHistoryDocs = new WeakSet();
/** @type {MutationObserver | null} */
let activeHistoryObserver = null;

/**
 * Observes a modal or drawer element for class and open attribute changes.
 * @param {any} el
 */
function observeModalTarget(el) {
    if (!el || el.__historyObserverAttached || el.id === 'guided-setup-modal' || el.id === 'notice-modal') return;
    el.__historyObserverAttached = true;

    ensureModalAriaSemantics(el, false);

    if (typeof el.addEventListener === 'function') {
        // Native cancel event listener (fired on Escape key in native dialogs)
        el.addEventListener('cancel', (e) => {
            e.preventDefault();
            if (el.id === 'guided-setup-modal' || el.id === 'notice-modal') return;
            closeModalAnimated(el);
        });

        // Native backdrop click listener: clicks on the <dialog> element itself (outside .modal-content)
        el.addEventListener('click', (e) => {
            if (e.target === el) {
                if (el.id === 'guided-setup-modal' || el.id === 'notice-modal') return;
                closeModalAnimated(el);
            }
        });
    }

    if (activeHistoryObserver && typeof activeHistoryObserver.observe === 'function') {
        activeHistoryObserver.observe(el, {
            attributes: true,
            attributeFilter: ['class', 'open']
        });
    }
}

/**
 * Initializes browser history stack integration and popstate listeners for nested modal dialogs.
 */
export function initializeModalHistoryManager() {
    if (typeof document === 'undefined') return;

    if (!boundHistoryDocs.has(document)) {
        boundHistoryDocs.add(document);

        // Smoothly animate modal dismiss when close/cancel/X buttons are clicked
        document.addEventListener('click', (e) => {
            const closeBtn = e.target?.closest?.('.close-button, [data-action="close"], [data-modal-dismiss]');
            if (!closeBtn) return;

            const modal = closeBtn.closest('.modal, dialog, .dialog-overlay');
            const isOpen = modal && (modal.classList.contains('show') || modal.open);
            if (modal && modal.id !== 'guided-setup-modal' && modal.id !== 'notice-modal' && isOpen && !modal.classList.contains('closing')) {
                closeModalAnimated(modal);
            }
        });

        // Escape key modal dismissal fallback for standard DOM elements
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (modalStack.length > 0) {
                    const topModal = modalStack.at(-1);
                    if (topModal && topModal.element && topModal.element.id !== 'guided-setup-modal' && topModal.element.id !== 'notice-modal') {
                        closeTargetModal(topModal);
                    }
                }
            }
        });

        // Intercept back navigation gestures & buttons
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
            window.addEventListener('popstate', () => {
                if (isPoppingForClose) {
                    queueMicrotask(() => {
                        isPoppingForClose = false;
                    });
                    return;
                }

                if (modalStack.length > 0) {
                    isModalPopping = true;
                    queueMicrotask(() => {
                        isModalPopping = false;
                    });
                    const topModal = modalStack.pop();
                    closeTargetModal(topModal);
                }
            });
        }

        // Observe body & document tree for modal/drawer visibility changes
        if (typeof MutationObserver !== 'undefined') {
            activeHistoryObserver = new MutationObserver((mutations) => {
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

                    const target = /** @type {any} */ (mutation.target);

                    // Target check: modals, dialog overlays, side drawer, FAB menu (excluding guided-setup-modal and notice-modal)
                    const isModal = ((target.classList.contains('modal') || target.tagName === 'DIALOG') && target.id !== 'guided-setup-modal' && target.id !== 'notice-modal') ||
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

                    if (isModal && target.id !== 'guided-setup-modal' && target.id !== 'notice-modal') {
                        const isOpen = target.classList.contains('show') ||
                                       target.classList.contains('open') ||
                                       target.classList.contains('active') ||
                                       Boolean(target.open || (typeof target.hasAttribute === 'function' && target.hasAttribute('open')));

                        handleModalStateChange(target, isOpen);
                    } else if (isBodyDrawerOrFab) {
                        const fabMenu = document.getElementById('fab-menu');
                        if (fabMenu) {
                            const isFabOpen = document.body.classList.contains('open-fab');
                            handleModalStateChange(fabMenu, isFabOpen);
                        }
                    }
                });
            });

            if (document.body) {
                activeHistoryObserver.observe(document.body, {
                    attributes: true,
                    attributeFilter: ['class'],
                    childList: true,
                    subtree: true
                });
            }
        }
    }

    if (typeof document.querySelectorAll === 'function') {
        const initialTargets = document.querySelectorAll('dialog:not(#guided-setup-modal):not(#notice-modal), .modal:not(#guided-setup-modal):not(#notice-modal), .dialog-overlay, .nav-drawer, .navigation-drawer, #nav-drawer, #navigation-drawer, #fab-menu, #priority-list-modal, #equipment-details-modal, #changelog-modal, #commits-modal, #app-settings-modal, #star-bonus-multiplier-modal');
        initialTargets.forEach(observeModalTarget);
    }
}

/**
 * Synchronizes browser history stack entries and focus trapping when a modal opens or closes.
 * @param {HTMLElement|HTMLDialogElement|any} element - Modal dialog DOM element.
 * @param {boolean} isOpen - True if opening, false if closing.
 * @param {Record<string, any>} [options={}] - Configuration options for close callbacks and focus restore targets.
 */
function handleModalStateChange(element, isOpen, options = {}) {
    if (!element) return;
    if (element.id === 'guided-setup-modal' || element.id === 'notice-modal') {
        // Guided setup and notice modal (confirm/alert) are exempted from history back popping
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
            ensureModalAriaSemantics(element, true);

            const previousActiveElement = typeof document !== 'undefined' ? document.activeElement : null;
            const trapHandler = (e) => trapFocus(element, e);
            if (typeof element.addEventListener === 'function') {
                element.addEventListener('keydown', trapHandler);
            }

            // Focus initial interactive element inside modal according to WAI-ARIA hierarchy
            setTimeout(() => {
                const target = getInitialModalFocusTarget(element);
                if (target && typeof target.focus === 'function') {
                    target.focus();
                }
            }, 50);

            // Push or replace history state entry for back-gesture trapping
            const stateId = `modal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const topModal = modalStack.at(-1);
            const topEl = topModal?.element;
            const topId = topEl?.id || '';
            const hasClass = (cls) => Boolean(topEl?.classList && typeof topEl.classList.contains === 'function' && topEl.classList.contains(cls));
            const isReplacingDrawer = Boolean(topModal && (
                topId === 'navigation-drawer' ||
                topId === 'nav-drawer' ||
                hasClass('navigation-drawer') ||
                hasClass('nav-drawer')
            ));
            const hasUserInteracted = typeof navigator !== 'undefined' && navigator.userActivation
                ? Boolean(navigator.userActivation.hasBeenActive)
                : true;
            const shouldReplace = Boolean(options.replace) || isReplacingDrawer || !hasUserInteracted;

            if (shouldReplace) {
                if (modalStack.length > 0 && (isReplacingDrawer || options.replace)) {
                    const replaced = modalStack.pop();
                    if (replaced && replaced.trapHandler && typeof replaced.element?.removeEventListener === 'function') {
                        replaced.element.removeEventListener('keydown', replaced.trapHandler);
                    }
                }
                modalStack.push({ element, stateId, previousActiveElement, trapHandler, options, wasPushed: false });
                if (typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function') {
                    window.history.replaceState({ modalStateId: stateId }, '');
                }
            } else {
                modalStack.push({ element, stateId, previousActiveElement, trapHandler, options, wasPushed: true });
                if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
                    window.history.pushState({ modalStateId: stateId }, '');
                }
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

            if (removed && removed.trapHandler && typeof element.removeEventListener === 'function') {
                element.removeEventListener('keydown', removed.trapHandler);
            }

            // Restore focus to opening trigger element
            if (removed && removed.previousActiveElement && typeof removed.previousActiveElement.focus === 'function') {
                try {
                    removed.previousActiveElement.focus();
                } catch (e) {}
            }

            // Cleanup overlays if all modals are closed
            if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
                const visibleModals = document.querySelectorAll('.modal.show, .dialog-overlay.show, dialog.modal[open], dialog.navigation-drawer[open]');
                if (visibleModals.length === 0) {
                    const overlays = document.querySelectorAll('#overlay, #nav-drawer-overlay, .modal-overlay, .dialog-overlay');
                    overlays.forEach(overlay => {
                        overlay.classList.remove('show', 'active');
                        overlay.style.opacity = '';
                    });
                }
            }

            // If closed manually by user (X button, tap outside) and state is top of stack, pop history entry
            if (!suppressHistoryPop && typeof window !== 'undefined' && window.history && window.history.state && window.history.state.modalStateId === removed.stateId) {
                if (removed.wasPushed) {
                    isPoppingForClose = true;
                    window.history.back();
                } else {
                    const cleanUrl = window.location.pathname + window.location.search + window.location.hash;
                    const currentState = (typeof window.history.state === 'object' && window.history.state !== null) ? { ...window.history.state } : {};
                    delete currentState.modalStateId;
                    window.history.replaceState(currentState, document.title, cleanUrl);
                }
            }
        }
    }
}

/**
 * Dismisses all active modals and drawers in preparation for a forward app shell navigation.
 * Closes dialogs, clears the modal stack, removes focus traps, and suppresses window.history.back().
 * @returns {boolean} True if an active modal or drawer was dismissed.
 */
export function dismissModalsForNavigation() {
    const hasOpenDialogs = typeof document !== 'undefined' && Boolean(
        document.querySelector('.modal.show, dialog.modal[open], dialog.navigation-drawer[open], .navigation-drawer.open, #fab-menu.open')
    );
    const hadModal = modalStack.length > 0 || hasOpenDialogs;
    if (!hadModal) {
        return false;
    }

    suppressHistoryPop = true;
    isPoppingForClose = false;
    isModalPopping = false;

    try {
        closeAllModals();
    } finally {
        setTimeout(() => {
            suppressHistoryPop = false;
        }, 150);
    }

    return true;
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
