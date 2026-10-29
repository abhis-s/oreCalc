import { logger } from '../utils/logger.js';
import { translate } from '../i18n/translator.js';
import { showAlert } from '../ui/noticeModal.js';
import { showUpdateModal, updateNavigationBadges } from '../components/modals/updateModal.js';

/** @type {any} */
let deferredInstallPrompt = null;

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
            document.dispatchEvent(new CustomEvent('pwa:installable'));
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
            document.dispatchEvent(new CustomEvent('pwa:installed'));
        }
    });
}

/**
 * Returns true if the application is running in a standalone PWA display mode.
 * @returns {boolean}
 */
function isRunningStandalone() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;

    const isStandalone = Boolean(window.matchMedia('(display-mode: standalone)')?.matches);
    const isWco = Boolean(window.matchMedia('(display-mode: window-controls-overlay)')?.matches);
    const isMinimalUi = Boolean(window.matchMedia('(display-mode: minimal-ui)')?.matches);
    const isFullscreen = Boolean(window.matchMedia('(display-mode: fullscreen)')?.matches);
    const isIosStandalone = Boolean(typeof navigator !== 'undefined' && (/** @type {any} */ (navigator).standalone));
    const isAndroidTwa = typeof document !== 'undefined' && Boolean(document.referrer?.startsWith('android-app://'));

    return isStandalone || isWco || isMinimalUi || isFullscreen || isIosStandalone || isAndroidTwa;
}

/**
 * Detects iOS and iPadOS browsers that support "Add to Home Screen" (Safari, Chrome CriOS, Firefox FxiOS, Edge),
 * while filtering out browsers that strip it (Brave for iOS) and in-app WebViews.
 *
 * @returns {boolean}
 */
function isSupportedIosOrIpadBrowser() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isIos = /iphone|ipod/i.test(ua);
    const isIpad = /ipad/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
    if (!isIos && !isIpad) return false;

    // Filter out Brave for iOS and in-app social WebViews that strip Home Screen actions
    const isUnsupported = /brave|fb_iab|fban|instagram|twitter|bytedance|micromessenger/i.test(ua);
    return !isUnsupported;
}

/**
 * Detects macOS Safari desktop browsers (Safari 17+) that support "Add to Dock".
 *
 * @returns {boolean}
 */
function isSupportedMacSafari() {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMacDesktop = /macintosh/i.test(ua) && !(typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
    if (!isMacDesktop) return false;

    // Must be Safari and not Chromium, Firefox, Edge, Opera, Vivaldi, or Brave
    const isSafari = /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|firefox|opr|vivaldi|brave/i.test(ua);
    if (!isSafari) return false;

    // Safari 17+ on macOS Sonoma/Sequoia introduced "Add to Dock"
    const versionMatch = ua.match(/version\/(\d+)/i);
    if (versionMatch) {
        const safariVersion = Number(versionMatch[1]) || 0;
        return safariVersion >= 17;
    }

    return true;
}

/**
 * Checks whether PWA installation is currently supported and available in this browser session.
 * Returns true if:
 * 1. Not currently running in standalone PWA mode, AND
 * 2. Either native `beforeinstallprompt` has fired (Chromium on Android / Desktop), OR
 * 3. Running in a supported iOS / iPadOS browser (Safari, Chrome CriOS, Firefox FxiOS, Edge), OR
 * 4. Running in macOS Safari (Safari 17+ supporting "Add to Dock").
 *
 * @returns {boolean}
 */
export function isPwaInstallSupported() {
    if (isRunningStandalone()) return false;
    if (deferredInstallPrompt !== null) return true;
    return isSupportedIosOrIpadBrowser() || isSupportedMacSafari();
}

/**
 * Triggers the native browser PWA installation prompt or displays platform installation guidance.
 * @returns {Promise<'accepted'|'dismissed'|'ios-guidance'|'macos-safari-guidance'|'unsupported'|'already-installed'>}
 */
export async function promptPwaInstall() {
    if (isRunningStandalone()) {
        return 'already-installed';
    }

    if (deferredInstallPrompt) {
        try {
            await deferredInstallPrompt.prompt();
            const choice = await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
        } catch (err) {
            logger.warn('Failed to invoke native PWA install prompt:', err);
        }
    }

    if (isSupportedMacSafari()) {
        await showAlert(translate('auth.installPromptMacSafari'), 'actions.installApp');
        return 'macos-safari-guidance';
    }

    if (isSupportedIosOrIpadBrowser()) {
        await showAlert(translate('auth.installPromptIos'), 'actions.installApp');
        return 'ios-guidance';
    }

    await showAlert(translate('auth.installPromptIos'), 'actions.installApp');
    return 'unsupported';
}

/**
 * Service Worker & PWA Lifecycle Manager
 * Implements user-controlled update prompt with safe background auto-activation on tab hide.
 */
export function initializePwaService() {
    if (!('serviceWorker' in navigator) || !('workbox' in window)) {
        return;
    }

    const wb = new window.workbox.Workbox('/service-worker.js');
    window.__WB__ = wb;

    let refreshing = false;

    const markSWUpdated = () => {
        try {
            const isCanonical = typeof window !== 'undefined' && window.location?.hostname
                ? !window.location.hostname.toLowerCase().includes('orecalc.tech')
                : false;
            const targetKey = isCanonical ? 'clashCalc_SWUpdatedTime' : 'oreCalc_SWUpdatedTime';
            localStorage.setItem(targetKey, new Date().toISOString());
            localStorage.removeItem('oreCalcSWUpdatedTime');
            if (isCanonical) {
                localStorage.removeItem('oreCalc_SWUpdatedTime');
            }
        } catch (_) {}
    };

    const handleSWWaiting = (reg) => {
        logger.log('A new version of OreCalc is available and waiting.');
        if (!sessionStorage.getItem('oreCalcUpdateDetectedAt')) {
            sessionStorage.setItem('oreCalcUpdateDetectedAt', Date.now().toString());
        }
        updateNavigationBadges();

        try {
            showUpdateModal(wb);
        } catch (e) {
            logger.warn('Could not open update modal:', e);
        }

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                logger.log('Tab hidden while update waiting. Triggering background skipWaiting...');
                wb.messageSkipWaiting();
                document.removeEventListener('visibilitychange', onVisibilityChange);
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
    };

    // Reload cleanly ONLY when the controller actually changes to avoid mismatched dynamic imports
    wb.addEventListener('controlling', () => {
        if (refreshing) return;
        const lastSwReload = Number(sessionStorage.getItem('clashCalc_lastSwReload') || 0);
        const now = Date.now();
        if (lastSwReload && (now - lastSwReload < 10000)) {
            logger.warn('Service worker controlling reload loop detected. Aborting reload.');
            return;
        }
        sessionStorage.setItem('clashCalc_lastSwReload', String(now));
        refreshing = true;
        markSWUpdated();
        window.location.reload();
    });

    // Handle scenario where update is waiting
    wb.addEventListener('waiting', (event) => {
        handleSWWaiting(event.sw);
    });

    // Listen for server-forced update events (e.g., on 426 responses)
    document.addEventListener('app:api-version-force-update', () => {
        const lastReload = sessionStorage.getItem('clashCalc_lastSwReload');
        const now = Date.now();
        if (lastReload && (now - Number(lastReload) < 15000)) {
            logger.warn('Forced update reload loop detected. Aborting automatic reload.');
            return;
        }
        sessionStorage.setItem('clashCalc_lastSwReload', now.toString());
        sessionStorage.removeItem('oreCalcUpdateDetectedAt');
        markSWUpdated();

        wb.register().then(reg => {
            if (reg && reg.waiting) {
                wb.messageSkipWaiting();
            } else {
                window.location.reload();
            }
        });
    });

    wb.register().then(reg => {
        if (reg) {
            const swTime = localStorage.getItem('clashCalc_SWUpdatedTime') || localStorage.getItem('oreCalc_SWUpdatedTime') || localStorage.getItem('oreCalcSWUpdatedTime');
            if (!swTime) {
                markSWUpdated();
            }
            if (reg.waiting) {
                handleSWWaiting(reg.waiting);
            } else {
                sessionStorage.removeItem('oreCalcUpdateDetectedAt');
                updateNavigationBadges();
            }

            reg.addEventListener('updatefound', () => {
                markSWUpdated();
            });

            // Check for updates periodically (every 6 hours)
            setInterval(() => {
                wb.update().catch(err => logger.error('SW manual update check failed:', err));
            }, 6 * 60 * 60 * 1000);
        }
    }).catch(err => logger.error('SW registration failed:', err));
}
