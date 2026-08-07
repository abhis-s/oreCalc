/**
 * Universal Mobile Back Button & Gesture History Manager
 * Intercepts Android hardware back button, iOS back swipe gestures, and browser back buttons
 * to close open modals, drawers, dialogs, and popups before navigating away from the page.
 */

let modalStack = [];
let isPoppingForClose = false;

export function closeModalAnimated(modal, callback) {
    if (!modal) return;
    if (modal.classList.contains('closing')) return;

    modal.classList.add('closing');
    const overlay = document.getElementById('overlay');
    if (overlay && modal.classList.contains('modal')) {
        overlay.classList.add('closing');
    }

    setTimeout(() => {
        modal.classList.remove('show', 'active', 'open', 'closing');

        if (modal.id === 'nav-drawer' || modal.classList.contains('nav-drawer')) {
            document.body.classList.remove('open-drawer');
            modal.style.transform = '';
        }
        if (modal.id === 'fab-menu' || modal.classList.contains('fab-menu')) {
            document.body.classList.remove('open-fab');
        }

        const visibleModals = document.querySelectorAll('.modal.show, .dialog-overlay.show');
        if (visibleModals.length === 0) {
            const overlays = document.querySelectorAll('#overlay, #nav-drawer-overlay, .modal-overlay, .dialog-overlay');
            overlays.forEach(o => {
                o.classList.remove('show', 'active', 'closing');
                o.style.opacity = '';
            });
        }
        modal.dispatchEvent(new CustomEvent('modalClosed', { bubbles: true }));
        if (callback) callback();
    }, 220);
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

export function initializeModalHistoryManager() {
    // Smoothly animate modal dismiss when close/cancel/X buttons are clicked
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.close-button, .reject-button, [data-action="close"]');
        if (!closeBtn) return;

        const modal = closeBtn.closest('.modal, .dialog-overlay');
        if (modal && modal.classList.contains('show') && !modal.classList.contains('closing')) {
            closeModalAnimated(modal);
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

    // Observe body & document tree for modal/drawer visibility changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            const target = mutation.target;

            // Target check: modals, dialog overlays, side drawer, FAB menu
            const isModal = target.classList.contains('modal') ||
                            target.classList.contains('dialog-overlay') ||
                            target.classList.contains('nav-drawer') ||
                            target.id === 'nav-drawer' ||
                            target.id === 'priority-list-modal' ||
                            target.id === 'equipment-details-modal' ||
                            target.id === 'changelog-modal' ||
                            target.id === 'commits-modal' ||
                            target.id === 'welcome-modal' ||
                            target.id === 'app-settings-modal' ||
                            target.id === 'star-bonus-multiplier-modal';

            const isBodyDrawerOrFab = target === document.body && (mutation.attributeName === 'class');

            if (isModal) {
                const isOpen = target.classList.contains('show') || 
                               target.classList.contains('open') || 
                               target.classList.contains('active');

                handleModalStateChange(target, isOpen);
            } else if (isBodyDrawerOrFab) {
                const navDrawer = document.getElementById('nav-drawer');
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

    observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class'],
        subtree: true
    });
}

function handleModalStateChange(element, isOpen) {
    const existingIndex = modalStack.findIndex(item => item.element === element);

    if (isOpen) {
        if (existingIndex === -1) {
            // Push history state entry for back-gesture trapping
            const stateId = `modal_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            modalStack.push({ element, stateId });
            window.history.pushState({ modalStateId: stateId }, '');
        }
    } else {
        if (existingIndex !== -1) {
            const [removed] = modalStack.splice(existingIndex, 1);

            // Cleanup overlays if all modals are closed
            const visibleModals = document.querySelectorAll('.modal.show, .dialog-overlay.show');
            if (visibleModals.length === 0) {
                const overlays = document.querySelectorAll('#overlay, #nav-drawer-overlay, .modal-overlay, .dialog-overlay');
                overlays.forEach(overlay => {
                    overlay.classList.remove('show', 'active');
                    overlay.style.opacity = '';
                });
            }

            // If closed manually by user (X button, tap outside) and state is top of stack, pop history entry
            if (window.history.state && window.history.state.modalStateId === removed.stateId) {
                isPoppingForClose = true;
                window.history.back();
            }
        }
    }
}
