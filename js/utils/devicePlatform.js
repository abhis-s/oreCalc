/**
 * Device Platform & Browser Engine Detection Utilities.
 * Tier 2: Pure Environment Detection Helpers (zero side effects or higher-tier imports).
 */

/**
 * Detects browser engine family cleanly.
 *
 * @param {string | null} [customUa=null]
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
 * @returns {string} Clean OS label (e.g. "macOS", "iPadOS", "iOS", "Windows", "Android", "Linux")
 */
export function detectOperatingSystem() {
    if (typeof navigator === 'undefined') return 'Server';
    if (/** @type {any} */ (navigator).userAgentData?.platform) {
        return /** @type {any} */ (navigator).userAgentData.platform;
    }
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';

    const isTouchMac = (platform === 'MacIntel' || /Macintosh/i.test(ua))
        && typeof navigator.maxTouchPoints === 'number'
        && navigator.maxTouchPoints > 1;
    const hasIosTouchCallout = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
        ? CSS.supports('-webkit-touch-callout', 'none')
        : true;

    if (/iPad/i.test(ua) || (isTouchMac && hasIosTouchCallout)) {
        return 'iPadOS';
    }
    if (/iPhone|iPod/i.test(ua)) {
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
