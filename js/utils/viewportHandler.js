/**
 * Viewport & Virtual Keyboard Handler
 * Manages input focus scrolling, pins header to VisualViewport on iOS, and shifts toasts above virtual keyboard on all devices.
 */

export function initializeViewportHandler() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Reset header transform on cold load / reload immediately
    const initialHeader = document.querySelector('.header-container');
    if (initialHeader) {
        initialHeader.style.transform = '';
    }

    // 1. Smoothly scroll focused inputs into view within modal-body
    document.addEventListener('focusin', (event) => {
        const target = event.target;
        if (!target || !target.matches('input, select, textarea')) return;

        // If input is inside a modal, scroll the modal-body container smoothly
        const modalBody = target.closest('.modal-body');
        if (modalBody) {
            setTimeout(() => {
                target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            }, 120);
        }
    }, { passive: true });

    // 2. Lock fixed header to visual viewport on iOS WebKit when keyboard shifts layout viewport
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isIOS && window.visualViewport) {
        let headerFrame = null;
        let isTransitioningOut = false;

        const syncHeaderVisualViewport = () => {
            if (headerFrame || isTransitioningOut) return;

            headerFrame = requestAnimationFrame(() => {
                headerFrame = null;

                const activeEl = document.activeElement;
                // If active input is inside a modal, ignore header sync
                if (activeEl && activeEl.closest('.modal, .modal-content, .modal-backdrop')) {
                    return;
                }

                const header = document.querySelector('.header-container');
                if (!header) return;

                const isInputFocused = Boolean(activeEl && activeEl.matches('input, select, textarea'));
                const offsetTop = window.visualViewport.offsetTop;

                if (isInputFocused && offsetTop > 2) {
                    header.style.transition = 'none';
                    header.style.transform = `translate3d(0, ${offsetTop}px, 0)`;
                } else {
                    header.style.transform = '';
                }
            });
        };

        window.visualViewport.addEventListener('scroll', syncHeaderVisualViewport, { passive: true });
        window.visualViewport.addEventListener('resize', syncHeaderVisualViewport, { passive: true });
        window.addEventListener('scroll', syncHeaderVisualViewport, { passive: true });
        window.addEventListener('pageshow', syncHeaderVisualViewport, { passive: true });

        // Fluid 0.3s cubic-bezier transition back to 0 on focusout for non-modal inputs
        document.addEventListener('focusout', (event) => {
            const target = event.target;
            if (!target || !target.matches('input, select, textarea')) return;
            if (target.closest('.modal, .modal-content, .modal-backdrop')) return;

            const header = document.querySelector('.header-container');
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

    // 3. Dynamic Toast Container positioning above virtual keyboard on iPadOS, iOS, Android, and Desktop
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

                const vv = window.visualViewport;
                if (!vv) return;

                const layoutHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
                const vvHeight = vv.height;
                const vvTop = vv.offsetTop;

                // Primary keyboard height formula
                let keyboardHeight = layoutHeight - (vvHeight + vvTop);

                // iPadOS Safari fallback: window.innerHeight shrinks alongside visualViewport
                if (isInputFocused && keyboardHeight < 50 && window.screen) {
                    const screenDiff = window.screen.height - vvHeight;
                    if (screenDiff > 150) {
                        keyboardHeight = Math.min(screenDiff, 400);
                    }
                }

                if (isInputFocused && keyboardHeight > 50) {
                    toastContainer.style.transition = 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)';
                    toastContainer.style.transform = `translate3d(0, -${Math.round(keyboardHeight + 10)}px, 0)`;
                } else {
                    toastContainer.style.transition = 'transform 0.3s ease';
                    toastContainer.style.transform = '';
                }
            });
        };

        window.visualViewport.addEventListener('scroll', syncToastVisualViewport, { passive: true });
        window.visualViewport.addEventListener('resize', syncToastVisualViewport, { passive: true });
        window.addEventListener('scroll', syncToastVisualViewport, { passive: true });
        document.addEventListener('focusin', syncToastVisualViewport, { passive: true });
        document.addEventListener('focusout', syncToastVisualViewport, { passive: true });
    }
}
