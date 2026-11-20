/**
 * Viewport & Virtual Keyboard Handler
 * Manages input focus scrolling, pins header to VisualViewport on iOS, and shifts toasts above virtual keyboard on all devices.
 */

/**
 * Detects if the current device is a touch/mobile device capable of showing a software virtual keyboard.
 * @returns {boolean}
 */
export function isTouchDevice() {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
}

/**
 * Calculates the required virtual keyboard bottom offset (in px) for toast positioning.
 * Returns 0 if device is not touch-enabled, if no input is focused, or if keyboard height <= 50px.
 *
 * @param {Object} options
 * @param {boolean} options.isInputFocused
 * @param {boolean} options.isTouch
 * @param {number} options.layoutHeight
 * @param {number} options.vvHeight
 * @param {number} options.vvTop
 * @param {number} [options.screenHeight]
 * @returns {number}
 */
export function calculateToastKeyboardOffset({
    isInputFocused,
    isTouch,
    layoutHeight,
    vvHeight,
    vvTop,
    screenHeight = 0
}) {
    if (!isTouch || !isInputFocused) {
        return 0;
    }

    // Primary keyboard height formula: layout height minus visual viewport visible bottom
    let keyboardHeight = layoutHeight - (vvHeight + vvTop);

    // iPadOS / touch Safari fallback: when layoutHeight (window.innerHeight) shrinks alongside visualViewport
    if (keyboardHeight < 50 && screenHeight > 0) {
        const screenDiff = screenHeight - vvHeight;
        if (screenDiff > 150) {
            keyboardHeight = Math.min(screenDiff, 400);
        }
    }

    if (keyboardHeight > 50) {
        return Math.round(keyboardHeight + 10);
    }

    return 0;
}

/**
 * Ensures an active input element is not occluded by floating chrome (top header or bottom navigation bar).
 * If the input is behind or within the bottom chrome margin (or top header margin), scrolls it into view.
 *
 * @param {Element | HTMLElement | null} target
 * @param {{ block?: ScrollLogicalPosition, behavior?: ScrollBehavior }} [options={}]
 * @returns {boolean} True if a scroll adjustment was triggered.
 */
function ensureInputVisibleAboveChrome(target, { block = 'center', behavior = 'smooth' } = {}) {
    if (!target || typeof target.getBoundingClientRect !== 'function' || typeof target.scrollIntoView !== 'function') {
        return false;
    }

    const rect = target.getBoundingClientRect();
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    const viewportHeight = vv ? vv.height : ((typeof window !== 'undefined' ? window.innerHeight : 0) || 800);

    const bottomNav = typeof document !== 'undefined' ? document.querySelector('.bottom-nav-bar') : null;
    let isBottomNavVisible = false;
    if (bottomNav) {
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            isBottomNavVisible = window.getComputedStyle(bottomNav).display !== 'none';
        } else {
            isBottomNavVisible = true;
        }
    }

    const bottomThreshold = isBottomNavVisible ? 96 : 40;
    const topThreshold = 80;

    if (rect.bottom > viewportHeight - bottomThreshold || rect.top < topThreshold) {
        target.scrollIntoView({ block, inline: 'nearest', behavior });
        return true;
    }

    return false;
}

/**
 * Initializes virtual keyboard compensation listeners and visualViewport resize handlers for mobile inputs.
 */
const boundViewportDocs = new WeakSet();

/**
 * Initializes global viewport listeners for iOS Safari header stabilization and toast keyboard elevation.
 */
export function initializeViewportHandler() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Reset header transform on cold load / reload immediately
    const initialHeader = document.querySelector('.app-header, .header-container');
    if (initialHeader) {
        initialHeader.style.transform = '';
    }

    if (boundViewportDocs.has(document)) return;
    boundViewportDocs.add(document);

    document.addEventListener('focusin', (event) => {
        const target = /** @type {HTMLElement | null} */ (event.target);
        if (!target || !target.matches('input, select, textarea')) return;

        const modalContainer = target.closest('.modal-body, .modal-content, dialog.modal, .modal');
        if (modalContainer) {
            setTimeout(() => {
                target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
            }, 120);
        } else if (isTouchDevice()) {
            setTimeout(() => {
                ensureInputVisibleAboveChrome(target);
            }, 160);
        }
    }, { passive: true });

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS && window.visualViewport) {
        let headerFrame = null;
        let isTransitioningOut = false;

        const syncHeaderVisualViewport = () => {
            if (headerFrame || isTransitioningOut) return;

            headerFrame = requestAnimationFrame(() => {
                headerFrame = null;

                const activeEl = document.activeElement;
                const header = document.querySelector('.app-header, .header-container');
                if (!header) return;

                if (activeEl && activeEl.closest('.modal, .modal-content, .modal-backdrop')) {
                    if (header.style.transform) {
                        header.style.transform = '';
                        header.style.transition = '';
                    }
                    return;
                }

                const isInputFocused = Boolean(activeEl && activeEl.matches('input, select, textarea'));
                const offsetTop = window.visualViewport.offsetTop;

                if (isInputFocused && offsetTop > 2) {
                    header.style.transition = 'none';
                    header.style.transform = `translate3d(0, ${offsetTop}px, 0)`;
                } else if (header.style.transform) {
                    header.style.transform = '';
                }
            });
        };

        window.visualViewport.addEventListener('scroll', syncHeaderVisualViewport, { passive: true });
        window.visualViewport.addEventListener('resize', syncHeaderVisualViewport, { passive: true });
        window.addEventListener('scroll', syncHeaderVisualViewport, { passive: true });
        window.addEventListener('pageshow', syncHeaderVisualViewport, { passive: true });

        document.addEventListener('focusout', (event) => {
            const target = event.target;
            if (!target || !target.matches('input, select, textarea')) return;
            if (target.closest('.modal, .modal-content, .modal-backdrop')) return;

            const header = document.querySelector('.app-header, .header-container');
            if (!header) return;

            isTransitioningOut = true;
            header.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
            header.style.transform = 'translate3d(0, 0, 0)';

            setTimeout(() => {
                header.style.transform = '';
                header.style.transition = '';
                isTransitioningOut = false;
            }, 300);
        }, { passive: true });
    }

    if (window.visualViewport) {
        let toastFrame = null;

        const syncToastVisualViewport = () => {
            if (toastFrame) return;

            toastFrame = requestAnimationFrame(() => {
                toastFrame = null;

                const toastContainer = document.getElementById('toast-container');
                if (!toastContainer) return;

                const activeEl = document.activeElement;
                const isInputFocused = Boolean(activeEl && activeEl.matches('input, select, textarea'));
                const isTouch = isTouchDevice();

                if (!isTouch || !isInputFocused) {
                    toastContainer.style.removeProperty('--toast-keyboard-offset');
                    return;
                }

                const vv = window.visualViewport;
                if (!vv) return;

                const layoutHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
                const offset = calculateToastKeyboardOffset({
                    isInputFocused,
                    isTouch,
                    layoutHeight,
                    vvHeight: vv.height,
                    vvTop: vv.offsetTop,
                    screenHeight: window.screen ? window.screen.height : 0
                });

                if (offset > 0) {
                    toastContainer.style.setProperty('--toast-keyboard-offset', `${offset}px`);
                } else {
                    toastContainer.style.removeProperty('--toast-keyboard-offset');
                }
            });
        };

        const handleVisualViewportResize = () => {
            const activeEl = /** @type {HTMLElement | null} */ (document.activeElement);
            if (activeEl && activeEl.matches('input, select, textarea') && !activeEl.closest('.modal-body, .modal-content, dialog.modal, .modal')) {
                ensureInputVisibleAboveChrome(activeEl);
            }
        };

        window.visualViewport.addEventListener('scroll', syncToastVisualViewport, { passive: true });
        window.visualViewport.addEventListener('resize', syncToastVisualViewport, { passive: true });
        window.visualViewport.addEventListener('resize', handleVisualViewportResize, { passive: true });
        window.addEventListener('scroll', syncToastVisualViewport, { passive: true });
        document.addEventListener('focusin', syncToastVisualViewport, { passive: true });
        document.addEventListener('focusout', syncToastVisualViewport, { passive: true });
    }
}
