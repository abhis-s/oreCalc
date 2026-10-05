/**
 * Cloudflare Turnstile Client Service.
 * Manages explicit lifecycle, on-demand script loading, and widget state for auth forms.
 */

import { getApiBaseUrl } from './apiService.js';

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** @type {{ enabled: boolean, siteKey: string } | null} */
let cachedConfig = null;
/** @type {Promise<{ enabled: boolean, siteKey: string }> | null} */
let configPromise = null;
/** @type {Promise<any> | null} */
let scriptPromise = null;

/**
 * Fetches Turnstile configuration from backend with fallback to build environment.
 *
 * @param {{ forceRefresh?: boolean }} [options={}]
 * @returns {Promise<{ enabled: boolean, siteKey: string }>}
 */
export async function fetchTurnstileConfig(options = {}) {
    if (options.forceRefresh) {
        cachedConfig = null;
        configPromise = null;
    }
    if (cachedConfig) {
        return cachedConfig;
    }
    if (configPromise) {
        return configPromise;
    }

    configPromise = (async () => {
        try {
            const baseUrl = getApiBaseUrl();
            const res = await fetch(`${baseUrl}/api/auth/turnstile-config`, {
                headers: { 'Accept': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                cachedConfig = {
                    enabled: Boolean(data?.enabled),
                    siteKey: typeof data?.siteKey === 'string' ? data.siteKey.trim() : ''
                };
                return cachedConfig;
            }
        } catch {
            // Silently fall back to window.__ENV__
        }

        const envSiteKey = (typeof window !== 'undefined' &&
            (/** @type {any} */ (window).__ENV__?.PUBLIC_TURNSTILE_SITE_KEY || /** @type {any} */ (window).__ENV__?.VITE_TURNSTILE_SITE_KEY)) || '';
        cachedConfig = {
            enabled: Boolean(envSiteKey),
            siteKey: envSiteKey
        };
        return cachedConfig;
    })();

    return configPromise;
}

/**
 * Dynamically loads the Cloudflare Turnstile explicit rendering script if not already present.
 *
 * @returns {Promise<any>} Resolves when window.turnstile is ready.
 */
function loadTurnstileScript() {
    if (typeof window === 'undefined') {
        return Promise.resolve(null);
    }
    if (/** @type {any} */ (window).turnstile) {
        return Promise.resolve(/** @type {any} */ (window).turnstile);
    }
    if (scriptPromise) {
        return scriptPromise;
    }

    scriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.querySelector(`script[src^="${TURNSTILE_SCRIPT_URL}"]`);
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve(/** @type {any} */ (window).turnstile));
            existingScript.addEventListener('error', (err) => reject(err));
            return;
        }

        const script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(/** @type {any} */ (window).turnstile);
        script.onerror = (err) => {
            scriptPromise = null;
            reject(err);
        };
        document.head.appendChild(script);
    });

    return scriptPromise;
}

/**
 * @typedef {Object} RenderWidgetOptions
 * @property {(token: string) => void} [onVerify] - Called when CAPTCHA is solved.
 * @property {() => void} [onExpire] - Called when token expires.
 * @property {(error: any) => void} [onError] - Called on verification error.
 */

/**
 * Renders an explicit Turnstile widget into the specified DOM container.
 *
 * @param {HTMLElement | string} container - Target DOM container or selector.
 * @param {RenderWidgetOptions} [options={}] - Event handlers.
 * @returns {Promise<string | null>} The widget ID or null if disabled.
 */
export async function renderTurnstileWidget(container, options = {}) {
    const config = await fetchTurnstileConfig();
    if (!config.enabled || !config.siteKey) {
        return null;
    }

    const target = typeof container === 'string' ? document.querySelector(container) : container;
    if (!target) {
        return null;
    }

    const turnstile = await loadTurnstileScript();
    if (!turnstile || typeof turnstile.render !== 'function') {
        return null;
    }

    // Clear previous children to prevent duplicate widgets
    target.innerHTML = '';

    const isDarkMode = typeof document !== 'undefined' && document.body.classList.contains('dark-mode');
    const widgetId = turnstile.render(target, {
        sitekey: config.siteKey,
        theme: isDarkMode ? 'dark' : 'light',
        size: 'normal',
        callback: (token) => {
            if (typeof options.onVerify === 'function') {
                options.onVerify(token);
            }
        },
        'expired-callback': () => {
            if (typeof options.onExpire === 'function') {
                options.onExpire();
            }
        },
        'error-callback': (err) => {
            if (typeof options.onError === 'function') {
                options.onError(err);
            }
        }
    });

    return widgetId;
}

/**
 * Resets a Turnstile widget instance.
 *
 * @param {string | null} widgetId
 */
export function resetTurnstileWidget(widgetId) {
    if (!widgetId || typeof window === 'undefined') return;
    const turnstile = /** @type {any} */ (window).turnstile;
    if (turnstile && typeof turnstile.reset === 'function') {
        try {
            turnstile.reset(widgetId);
        } catch {
            // Silently ignore if widget was unmounted
        }
    }
}

/**
 * Removes a Turnstile widget instance from the DOM.
 *
 * @param {string | null} widgetId
 */
export function removeTurnstileWidget(widgetId) {
    if (!widgetId || typeof window === 'undefined') return;
    const turnstile = /** @type {any} */ (window).turnstile;
    if (turnstile && typeof turnstile.remove === 'function') {
        try {
            turnstile.remove(widgetId);
        } catch {
            // Silently ignore if widget was unmounted
        }
    }
}
