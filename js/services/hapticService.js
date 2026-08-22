/**
 * Modern Micro-Haptic Feedback Service
 * Leverages short (4-12ms) LRA motor pulses for crisp, native-feeling tactile feedback.
 */

/**
 * Triggers an LRA micro-haptic vibration pulse tailored to interaction type.
 * @param {'click' | 'tap' | 'toggle' | 'select' | 'selection' | 'success' | 'warning' | 'error' | 'bump' | 'light' | 'medium'} [type='click'] - Haptic pattern type.
 */
export function triggerHaptic(type = 'click') {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

    try {
        switch (type) {
            case 'click':
            case 'tap':
            case 'light':
                // 6ms ultra-short micro-tick (crisp mechanical button feel)
                navigator.vibrate(6);
                break;

            case 'toggle':
            case 'select':
            case 'selection':
            case 'medium':
                // 10ms crisp pop for switches, tabs, and checkboxes
                navigator.vibrate(10);
                break;

            case 'success':
                // Double micro-pop (8ms tick, 25ms pause, 8ms tick)
                navigator.vibrate([8, 25, 8]);
                break;

            case 'warning':
            case 'error':
                // Double firm click
                navigator.vibrate([16, 35, 16]);
                break;

            case 'bump':
                // Soft descending bump for drawer/modal open-close
                navigator.vibrate([10, 30, 5]);
                break;
        }
    } catch (_) {
        // Silently catch environment restrictions
    }
}

/**
 * Attaches delegated pointer event listeners to trigger tactile micro-haptics across UI elements.
 */
export function initializeGlobalHaptics() {
    if (typeof window === 'undefined') return;

    // Delegate instant pointerdown haptics to all buttons and interactive controls
    document.addEventListener('pointerdown', (event) => {
        const target = event.target.closest(
            'button, [role="button"], .tab-button, .hamburger, .animated-btn, .fab-item-pill, .updatable, input[type="checkbox"], input[type="radio"], .switch'
        );

        if (!target) return;

        // Skip disabled elements
        if (target.disabled || target.classList.contains('disabled')) return;

        if (target.matches('.tab-button, [data-tab], .switch, input[type="checkbox"]')) {
            triggerHaptic('toggle');
        } else {
            triggerHaptic('click');
        }
    }, { passive: true });
}
