/**
 * App Management Service.
 * Manages PWA storage estimation, offline caching, startup route preferences, and wake lock.
 * Tier 3: Core Service.
 */

import { logger } from '../utils/logger.js';
import { isRunningStandalone } from './pwaService.js';
import { state } from '../core/state.js';
import { handleStateUpdate } from '../core/stateManager.js';
import { loadStoredAppSettings, persistStoredAppSettings } from '../core/localStorageManager.js';

/**
 * Canonical startup destinations supported by the application.
 */
export const STARTUP_ROUTE_OPTIONS = Object.freeze([
    { id: 'hub', route: '/' },
    { id: 'ore-calc', route: '/ore-calculator/' },
    { id: 'ore-calc-equipment', route: '/ore-calculator/#equipment' },
    { id: 'ore-calc-income', route: '/ore-calculator/#income' },
    { id: 'ore-calc-planner', route: '/ore-calculator/#planner' },
    { id: 'hero-journey', route: '/hero-journey/' },
    { id: 'damage-calc-zapquake', route: '/damage-calculator/?tab=zapquake' },
    { id: 'damage-calc-cluster', route: '/damage-calculator/?tab=cluster-planner' }
]);

/** @type {WakeLockSentinel|null} */
let wakeLockSentinel = null;

/**
 * Formats byte count to clean human-readable size without device capacity.
 *
 * @param {number} bytes
 * @returns {string|null} Formatted size (e.g. "24.8 MB") or null if <= 0 / non-finite
 */
export function formatStorageSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return null;
    }
    const megaBytes = bytes / (1024 * 1024);
    if (megaBytes < 0.1) {
        const kiloBytes = bytes / 1024;
        return `${kiloBytes.toFixed(1)} KB`;
    }
    return `${megaBytes.toFixed(1)} MB`;
}

/**
 * Queries the application storage footprint. Returns formatted app usage only.
 *
 * @returns {Promise<string|null>} App usage string (e.g. "32.4 MB") or null if unavailable / <= 0
 */
export async function getAppStorageUsage() {
    try {
        if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
            const estimate = await navigator.storage.estimate();
            if (estimate?.usage && estimate.usage > 0) {
                return formatStorageSize(estimate.usage);
            }
        }
    } catch (err) {
        logger.warn('Failed to estimate app storage footprint:', err);
    }
    return null;
}

/**
 * Clears temporary runtime asset caches without purging player data.
 *
 * @returns {Promise<boolean>} Whether cache clearance succeeded
 */
export async function clearTemporaryAssetCaches() {
    try {
        if (typeof window !== 'undefined' && 'caches' in window) {
            const cacheNames = await window.caches.keys();
            const deletions = cacheNames
                .filter(name => !name.includes('precache'))
                .map(name => window.caches.delete(name));
            await Promise.all(deletions);
            return true;
        }
    } catch (err) {
        logger.warn('Failed to clear asset caches:', err);
    }
    return false;
}

/**
 * Retrieves the user-configured startup route preference.
 *
 * @returns {string} Route path (defaults to '/')
 */
export function getStartupRoutePreference() {
    if (state.uiSettings?.startupRoute && STARTUP_ROUTE_OPTIONS.some(opt => opt.route === state.uiSettings.startupRoute)) {
        return state.uiSettings.startupRoute;
    }
    const stored = loadStoredAppSettings();
    if (stored.startupRoute && STARTUP_ROUTE_OPTIONS.some(opt => opt.route === stored.startupRoute)) {
        return stored.startupRoute;
    }
    return '/';
}

/**
 * Persists the user-configured startup route preference.
 *
 * @param {string} route
 * @returns {boolean}
 */
export function setStartupRoutePreference(route) {
    if (!STARTUP_ROUTE_OPTIONS.some(opt => opt.route === route)) {
        return false;
    }
    handleStateUpdate(() => {
        if (!state.uiSettings) {
            state.uiSettings = {};
        }
        state.uiSettings.startupRoute = route;
    }, true, { preferencesOnly: true });
    persistStoredAppSettings({ startupRoute: route });
    return true;
}

/**
 * Detects browser engine family cleanly.
 *
 * @param {string} [customUa=null]
 * @returns {'Chromium'|'WebKit'|'Gecko'|'Unknown'}
 */
export function detectBrowserEngine(customUa = null) {
    const ua = customUa ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '') ?? '';
    if (!ua) return 'Unknown';
    if (/opr\//i.test(ua)) return 'Chromium';
    if (/edg\//i.test(ua)) return 'Chromium';
    if (/chrome|crios|chromium/i.test(ua)) return 'Chromium';
    if (/firefox|fxios/i.test(ua)) return 'Gecko';
    if (/safari/i.test(ua) && !/chrome|crios|chromium|android/i.test(ua)) return 'WebKit';
    return 'Unknown';
}

/**
 * Detects and normalizes the client operating system name.
 *
 * @returns {string} Clean OS label (e.g. "macOS", "iOS", "Windows", "Android", "Linux")
 */
export function detectOperatingSystem() {
    if (typeof navigator === 'undefined') return 'Server';
    if (navigator.userAgentData?.platform) {
        return navigator.userAgentData.platform;
    }
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';

    if (/iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        return 'iOS';
    }
    if (/Android/i.test(ua)) return 'Android';
    if (/Macintosh|Mac OS X|MacIntel/i.test(ua) || platform === 'MacIntel' || /Mac/i.test(platform)) {
        return 'macOS';
    }
    if (/Windows|Win32|Win64/i.test(ua) || /Win/i.test(platform)) return 'Windows';
    if (/Linux/i.test(ua) || /Linux/i.test(platform)) return 'Linux';

    return platform || 'Unknown';
}

/**
 * Retrieves environment diagnostic metadata.
 *
 * @returns {Object}
 */
export function getEnvironmentDiagnostics() {
    const isClient = typeof window !== 'undefined';
    const isStandalone = isRunningStandalone();
    const engine = detectBrowserEngine();
    const platform = isClient ? detectOperatingSystem() : 'Server';
    const isWco = isClient && typeof window.matchMedia === 'function' && Boolean(window.matchMedia('(display-mode: window-controls-overlay)')?.matches);
    const displayMode = isWco
        ? 'window-controls-overlay'
        : (isStandalone ? 'standalone' : 'browser');
    const isOnline = isClient ? (navigator.onLine ?? true) : true;
    const viewport = isClient ? `${window.innerWidth || 0} x ${window.innerHeight || 0}` : 'Unknown';

    return {
        platform,
        engine,
        displayMode,
        isOnline,
        viewport
    };
}

/**
 * Checks whether Screen Wake Lock API is supported.
 *
 * @returns {boolean}
 */
export function isWakeLockSupported() {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

/**
 * Checks if wake lock is currently requested by user preference.
 *
 * @returns {boolean}
 */
export function getWakeLockPreference() {
    if (typeof state.uiSettings?.screenWakeLock === 'boolean') {
        return state.uiSettings.screenWakeLock;
    }
    const stored = loadStoredAppSettings();
    return Boolean(stored.screenWakeLock);
}

/**
 * Requests or releases Screen Wake Lock based on user preference.
 *
 * @param {boolean} enable
 * @returns {Promise<boolean>} Whether wake lock active state matches enable
 */
export async function toggleWakeLock(enable) {
    const isEnabled = Boolean(enable);
    handleStateUpdate(() => {
        if (!state.uiSettings) {
            state.uiSettings = {};
        }
        state.uiSettings.screenWakeLock = isEnabled;
    }, true, { preferencesOnly: true });
    persistStoredAppSettings({ screenWakeLock: isEnabled });

    if (!isWakeLockSupported()) {
        return false;
    }

    try {
        if (isEnabled) {
            if (!wakeLockSentinel) {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                wakeLockSentinel.addEventListener('release', () => {
                    wakeLockSentinel = null;
                });
            }
            return true;
        } else {
            if (wakeLockSentinel) {
                await wakeLockSentinel.release();
                wakeLockSentinel = null;
            }
            return false;
        }
    } catch (err) {
        logger.warn('Failed to toggle screen wake lock:', err);
        return false;
    }
}

let hasAttachedWakeLockVisibilityListener = false;

/**
 * Initializes global screen wake lock lifecycle.
 * Acquires wake lock if enabled, and automatically re-acquires on document visibility return.
 *
 * @returns {Promise<boolean>}
 */
export async function initScreenWakeLock() {
    if (!isWakeLockSupported()) return false;

    if (!hasAttachedWakeLockVisibilityListener) {
        hasAttachedWakeLockVisibilityListener = true;
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', async () => {
                if (document.visibilityState === 'visible' && getWakeLockPreference()) {
                    await toggleWakeLock(true);
                }
            });
        }
    }

    if (getWakeLockPreference()) {
        return await toggleWakeLock(true);
    }
    return false;
}
