/**
 * Viewport & Virtual Keyboard Handler
 * Manages input focus scrolling, pins header to VisualViewport on iOS, and coordinates floating chrome/toasts with virtual keyboards.
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
 * Determines whether an on-screen software keyboard is actively open without false-positiving on hardware keyboards or split windows.
 *
 * @param {Object} options
 * @param {boolean} options.isTouch
 * @param {boolean} options.isInputFocused
 * @param {number} options.layoutHeight
 * @param {number} options.vvHeight
 * @param {number} options.vvTop
 * @param {number} [options.baselineVvHeight=0]
 * @param {number} [options.screenHeight=0]
 * @returns {boolean}
 */
export function detectSoftwareKeyboardOpen({
    isTouch,
    isInputFocused,
    layoutHeight,
    vvHeight,
    vvTop,
    baselineVvHeight = 0,
    screenHeight = 0
}) {
    if (!isTouch || !isInputFocused || vvHeight <= 0) {
        return false;
    }

    if (baselineVvHeight > 0 && (baselineVvHeight - vvHeight) > 100) {
        return true;
    }

    if ((layoutHeight - vvHeight) > 80) {
        return true;
    }

    if (baselineVvHeight <= 0) {
        return calculateToastKeyboardOffset({
            isInputFocused,
            isTouch,
            layoutHeight,
            vvHeight,
            vvTop,
            screenHeight
        }) > 0;
    }

    return (layoutHeight - (vvHeight + vvTop)) > 50;
}

/**
 * Calculates header vertical offset (in px) to keep the fixed header pinned to VisualViewport top on iOS/iPadOS
 * while a software keyboard session is active (open or dismissing), ignoring non-keyboard overscroll rubberbanding.
 *
 * @param {Object} options
 * @param {boolean} options.isIOS
 * @param {number} options.vvOffsetTop
 * @param {number} [options.vvScale=1]
 * @param {boolean} [options.isModalOpen=false]
 * @param {boolean} [options.isKeyboardActive=false]
 * @returns {number}
 */
export function calculateHeaderViewportOffset({
    isIOS,
    vvOffsetTop,
    vvScale = 1,
    isModalOpen = false,
    isKeyboardActive = false
}) {
    if (!isIOS || isModalOpen || !isKeyboardActive || vvScale > 1.05) {
        return 0;
    }
    if (vvOffsetTop > 0.5) {
        return Math.round(vvOffsetTop * 10) / 10;
    }
    return 0;
}

/**
 * Checks whether an element rect is occluded relative to the active visual viewport rather than layout viewport top.
 *
 * @param {Object} options
 * @param {number} options.rectTop
 * @param {number} options.rectBottom
 * @param {number} options.vvTop
 * @param {number} options.vvHeight
 * @param {number} options.topThreshold
 * @param {number} options.bottomThreshold
 * @returns {boolean}
 */
export function calculateVisualRectOcclusion({
    rectTop,
    rectBottom,
    vvTop,
    vvHeight,
    topThreshold,
    bottomThreshold
}) {
    const visibleTop = rectTop - vvTop;
    const visibleBottom = rectBottom - vvTop;
    return visibleBottom > (vvHeight - bottomThreshold) || visibleTop < topThreshold;
}

/**
 * Ensures an active input element is not occluded by floating chrome (top header, virtual keyboard, or bottom navigation bar).
 * Uses visual viewport offset compensation so already-visible scrolled inputs are not pushed around redundantly.
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
    const vvTop = vv ? (vv.offsetTop || 0) : 0;
    const viewportHeight = vv ? vv.height : ((typeof window !== 'undefined' ? window.innerHeight : 0) || 800);

    const bottomNav = typeof document !== 'undefined' ? document.querySelector('.bottom-nav-bar') : null;
    let isBottomNavVisible = false;
    if (bottomNav) {
        if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
            const cs = window.getComputedStyle(bottomNav);
            isBottomNavVisible = cs.display !== 'none' && cs.pointerEvents !== 'none';
        } else {
            isBottomNavVisible = true;
        }
    }

    const bottomThreshold = isBottomNavVisible ? 96 : 36;
    const topThreshold = 84;

    const isOccluded = calculateVisualRectOcclusion({
        rectTop: rect.top,
        rectBottom: rect.bottom,
        vvTop,
        vvHeight: viewportHeight,
        topThreshold,
        bottomThreshold
    });

    if (isOccluded) {
        target.scrollIntoView({ block, inline: 'nearest', behavior });
        return true;
    }

    return false;
}

const boundViewportDocs = new WeakSet();

/**
 * Initializes global viewport listeners for iOS/iPadOS Safari header stabilization, floating chrome yield, and toast elevation.
 */
export function initializeViewportHandler() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Clear any legacy inline header transforms/transitions so CSS variable compositing leads cleanly
    const initialHeaders = document.querySelectorAll('.app-header, .landing-header, .header-container');
    initialHeaders.forEach((header) => {
        const el = /** @type {HTMLElement} */ (header);
        if (el.style.transform) el.style.transform = '';
        if (el.style.transition) el.style.transition = '';
    });
    document.documentElement?.style?.setProperty('--header-vv-offset', '0px');

    if (boundViewportDocs.has(document)) return;
    boundViewportDocs.add(document);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    let lastHeaderOffset = 0;
    let lastToastOffset = -1;
    let lastKeyboardOpen = false;
    let isKeyboardPinActive = false;
    let baselineVvHeight = window.visualViewport?.height || window.innerHeight || 0;
    let prevVvHeight = baselineVvHeight;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let keyboardDismissTimer = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let focusScrollTimer = null;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let vvResizeScrollTimer = null;
    /** @type {number | null} */
    let settleRafId = null;

    const cancelPendingInputScrolls = () => {
        if (focusScrollTimer !== null) {
            clearTimeout(focusScrollTimer);
            focusScrollTimer = null;
        }
        if (vvResizeScrollTimer !== null) {
            clearTimeout(vvResizeScrollTimer);
            vvResizeScrollTimer = null;
        }
    };

    const syncViewportChrome = () => {
        const vv = window.visualViewport;
        const activeEl = /** @type {HTMLElement | null} */ (document.activeElement);
        const isInputFocused = Boolean(activeEl && activeEl.matches('input, select, textarea'));
        const isModalOpen = Boolean(
            document.querySelector('dialog.modal[open], dialog.navigation-drawer[open], .modal.show, .modal-backdrop.show')
            || activeEl?.closest('.modal, .modal-content, .modal-backdrop')
        );

        const vvHeight = vv ? vv.height : (window.innerHeight || 0);
        const vvTop = vv ? (vv.offsetTop || 0) : 0;
        const vvScale = vv ? (vv.scale || 1) : 1;
        const layoutHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

        if (!isInputFocused && vvHeight > 0 && vvScale <= 1.05) {
            baselineVvHeight = Math.max(layoutHeight, vvHeight);
        }

        const isTouch = isTouchDevice();
        const keyboardOpen = detectSoftwareKeyboardOpen({
            isTouch,
            isInputFocused,
            layoutHeight,
            vvHeight,
            vvTop,
            baselineVvHeight,
            screenHeight: window.screen ? window.screen.height : 0
        });

        if (keyboardOpen) {
            isKeyboardPinActive = true;
            if (keyboardDismissTimer !== null) {
                clearTimeout(keyboardDismissTimer);
                keyboardDismissTimer = null;
            }
        } else if (isKeyboardPinActive) {
            const viewportRestored = baselineVvHeight <= 0 || vvHeight >= baselineVvHeight - 50;
            if (vvTop <= 0.5 && viewportRestored) {
                isKeyboardPinActive = false;
                if (keyboardDismissTimer !== null) {
                    clearTimeout(keyboardDismissTimer);
                    keyboardDismissTimer = null;
                }
            } else if (!isInputFocused && keyboardDismissTimer === null) {
                // Clear header pin after dismissal transition if WebKit leaves residual vvOffsetTop
                keyboardDismissTimer = setTimeout(() => {
                    keyboardDismissTimer = null;
                    isKeyboardPinActive = false;
                    syncViewportChrome();
                }, 650);
            }
        }

        const headerOffset = calculateHeaderViewportOffset({
            isIOS,
            vvOffsetTop: vvTop,
            vvScale,
            isModalOpen,
            isKeyboardActive: keyboardOpen || isKeyboardPinActive
        });

        if (headerOffset !== lastHeaderOffset) {
            lastHeaderOffset = headerOffset;
            document.documentElement?.style?.setProperty('--header-vv-offset', `${headerOffset}px`);
        }

        if (keyboardOpen !== lastKeyboardOpen) {
            lastKeyboardOpen = keyboardOpen;
            document.body?.classList?.toggle('is-keyboard-open', keyboardOpen);
        }

        const toastContainer = document.getElementById('toast-container');
        if (toastContainer) {
            const toastOffset = (isTouch && isInputFocused)
                ? calculateToastKeyboardOffset({
                    isInputFocused,
                    isTouch,
                    layoutHeight,
                    vvHeight,
                    vvTop,
                    screenHeight: baselineVvHeight > 0 ? 0 : (window.screen ? window.screen.height : 0)
                })
                : 0;

            if (toastOffset !== lastToastOffset) {
                lastToastOffset = toastOffset;
                if (toastOffset > 0) {
                    toastContainer.style.setProperty('--toast-keyboard-offset', `${toastOffset}px`);
                } else {
                    toastContainer.style.removeProperty('--toast-keyboard-offset');
                }
            }
        }
    };

    const scheduleTrailingSync = () => {
        if (settleRafId !== null) cancelAnimationFrame(settleRafId);
        settleRafId = requestAnimationFrame(() => {
            settleRafId = null;
            syncViewportChrome();
        });
    };

    document.addEventListener('focusin', (event) => {
        const target = /** @type {HTMLElement | null} */ (event.target);
        if (!target || !target.matches('input, select, textarea')) {
            syncViewportChrome();
            return;
        }

        cancelPendingInputScrolls();
        syncViewportChrome();

        const modalContainer = target.closest('.modal-body, .modal-content, dialog.modal, .modal');
        if (modalContainer) {
            focusScrollTimer = setTimeout(() => {
                focusScrollTimer = null;
                if (document.activeElement === target) {
                    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
                }
            }, 120);
        } else if (isTouchDevice()) {
            focusScrollTimer = setTimeout(() => {
                focusScrollTimer = null;
                if (document.activeElement === target) {
                    ensureInputVisibleAboveChrome(target);
                }
            }, 220);
        }
    }, { passive: true });

    document.addEventListener('focusout', (event) => {
        const target = /** @type {HTMLElement | null} */ (event.target);
        if (!target || !target.matches('input, select, textarea')) return;

        cancelPendingInputScrolls();
        syncViewportChrome();
        scheduleTrailingSync();
        setTimeout(syncViewportChrome, 350);
    }, { passive: true });

    if (window.visualViewport) {
        window.visualViewport.addEventListener('scroll', () => {
            syncViewportChrome();
            scheduleTrailingSync();
        }, { passive: true });

        window.visualViewport.addEventListener('resize', () => {
            const currentVvHeight = window.visualViewport?.height || 0;
            const shrank = currentVvHeight > 0 && currentVvHeight < prevVvHeight - 10;
            prevVvHeight = currentVvHeight;

            syncViewportChrome();

            if (!shrank) {
                if (vvResizeScrollTimer !== null) {
                    clearTimeout(vvResizeScrollTimer);
                    vvResizeScrollTimer = null;
                }
                return;
            }

            const activeEl = /** @type {HTMLElement | null} */ (document.activeElement);
            if (activeEl && activeEl.matches('input, select, textarea') && !activeEl.closest('.modal-body, .modal-content, dialog.modal, .modal')) {
                cancelPendingInputScrolls();
                vvResizeScrollTimer = setTimeout(() => {
                    vvResizeScrollTimer = null;
                    if (document.activeElement === activeEl) {
                        ensureInputVisibleAboveChrome(activeEl);
                    }
                }, 100);
            }
        }, { passive: true });
    }

    window.addEventListener('scroll', syncViewportChrome, { passive: true });
    window.addEventListener('resize', syncViewportChrome, { passive: true });
    window.addEventListener('orientationchange', () => {
        baselineVvHeight = 0;
        prevVvHeight = 0;
        isKeyboardPinActive = false;
        if (keyboardDismissTimer !== null) {
            clearTimeout(keyboardDismissTimer);
            keyboardDismissTimer = null;
        }
        syncViewportChrome();
    }, { passive: true });
    window.addEventListener('pageshow', syncViewportChrome, { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) syncViewportChrome();
    }, { passive: true });

    syncViewportChrome();
}
