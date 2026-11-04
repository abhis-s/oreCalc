/**
 * Modern Micro-Haptic Feedback Service
 * Leverages short (4-12ms) LRA motor pulses for crisp, native-feeling tactile feedback.
 */

import { state } from '../core/state.js';
import { handleStateUpdate } from '../core/stateManager.js';
import { loadStoredAppSettings, persistStoredAppSettings } from '../core/localStorageManager.js';

let isGlobalHapticsInitialized = false;

/**
 * Checks whether the current device/browser supports the physical Vibration API.
 * Desktop platforms (macOS, Windows, desktop Linux, ChromeOS) are explicitly filtered out
 * because Chromium exposes a silent dummy navigator.vibrate stub without hardware support.
 *
 * @param {string} [customUa=null]
 * @param {Object} [customNavigator=null]
 * @returns {boolean}
 */
export function isHapticsSupported(customUa = null, customNavigator = null) {
    const nav = customNavigator ?? (typeof navigator !== 'undefined' ? navigator : null);
    if (!nav || !('vibrate' in nav) || typeof nav.vibrate !== 'function') {
        return false;
    }
    const ua = customUa ?? nav.userAgent ?? '';
    const isDesktop = /(macintosh|windows|x11|cros)/i.test(ua) && !/android|mobile/i.test(ua);
    if (isDesktop) {
        return false;
    }
    return true;
}

/**
 * Retrieves user preference for tactile haptics. Defaults to true on supported devices.
 * @returns {boolean}
 */
export function getHapticsPreference() {
    if (typeof state.uiSettings?.hapticsEnabled === 'boolean') {
        return state.uiSettings.hapticsEnabled;
    }
    const stored = loadStoredAppSettings();
    return stored.hapticsEnabled !== false;
}

/**
 * Persists user preference for tactile haptics.
 * @param {boolean} enabled
 * @returns {boolean}
 */
export function setHapticsPreference(enabled) {
    const isEnabled = Boolean(enabled);
    handleStateUpdate(() => {
        if (!state.uiSettings) {
            state.uiSettings = {};
        }
        state.uiSettings.hapticsEnabled = isEnabled;
    }, true, { preferencesOnly: true });
    persistStoredAppSettings({ hapticsEnabled: isEnabled });
    return true;
}

/**
 * Resets the initialization state (used exclusively for isolated test harnesses).
 */
export function resetGlobalHapticsForTesting() {
    isGlobalHapticsInitialized = false;
}

/**
 * Triggers an LRA micro-haptic vibration pulse tailored to interaction type.
 * @param {'click' | 'tap' | 'toggle' | 'select' | 'selection' | 'success' | 'warning' | 'error' | 'bump' | 'light' | 'medium'} [type='click'] - Haptic pattern type.
 */
export function triggerHaptic(type = 'click') {
    if (!isHapticsSupported() || !getHapticsPreference()) return;

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
    if (typeof document === 'undefined' || isGlobalHapticsInitialized) return;
    isGlobalHapticsInitialized = true;

    // Delegate instant pointerdown haptics to all buttons, switches, tabs, and interactive controls
    document.addEventListener('pointerdown', (event) => {
        const target = /** @type {HTMLElement|null} */ (event.target?.closest?.(
            'button, summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], [role="button"], [role="tab"], [role="switch"], [role="radio"], [role="checkbox"], [role="option"], [data-tab], [data-action], a.btn, a.button, a[class*="btn"], a[class*="button"], .app-header__tab, .tab-button, .nav-button, .switch, .updatable, .app-header__hamburger, .hamburger'
        ));

        if (!target) return;

        // Skip disabled elements
        if (/** @type {any} */ (target).disabled || target.classList?.contains('disabled') || target.getAttribute?.('aria-disabled') === 'true') return;

        if (target.matches?.('[role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [data-tab], input[type="checkbox"], input[type="radio"], .switch, [class*="switch"], .app-header__tab, .tab-button, .nav-button')) {
            triggerHaptic('toggle');
        } else {
            triggerHaptic('click');
        }
    }, { passive: true });
}

// Auto-initialize globally in browser environments
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGlobalHaptics, { once: true });
    } else {
        initializeGlobalHaptics();
    }
}
