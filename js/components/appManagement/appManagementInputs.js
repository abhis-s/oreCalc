/**
 * App Management Inputs Controller.
 * Handles interactive event listeners for the App Management route.
 * Tier 4: Inputs Controller Module.
 */

import { translate } from '../../i18n/translator.js';
import {
    setStartupRoutePreference,
    clearTemporaryAssetCaches,
    getAppStorageUsage,
    toggleWakeLock,
    getWakeLockPreference,
    isWakeLockSupported,
    getEnvironmentDiagnostics,
    detectBrowserEngine
} from '../../services/appManagementService.js';
import {
    isHapticsSupported,
    getHapticsPreference,
    setHapticsPreference,
    triggerHaptic
} from '../../services/hapticService.js';
import {
    isRunningStandalone,
    isPwaInstallSupported,
    promptPwaInstall
} from '../../services/pwaService.js';
import {
    renderStorageUsage,
    renderUpdateLifecycle,
    formatDiagnosticsReport,
    getAppVersionString,
    renderViewportDimensions,
    renderNetworkStatus
} from './appManagementDisplay.js';

let hasAttachedAppManagementListeners = false;
let hasAttachedSwRegistrationListener = false;
/** @type {((state: string) => void)|null} */
let activeUpdateStateSetter = null;

function updateDisplayModePresentation() {
    const isStandalone = isRunningStandalone();
    const heroDesc = document.getElementById('app-hero-desc');
    if (heroDesc) {
        heroDesc.setAttribute('data-i18n', isStandalone ? 'views.appManagement.subtitle' : 'views.appManagement.hero.browserSubtitle');
        heroDesc.textContent = translate(isStandalone ? 'views.appManagement.subtitle' : 'views.appManagement.hero.browserSubtitle');
    }
    const startupRow = document.getElementById('app-setting-startup');
    if (startupRow) {
        startupRow.hidden = !isStandalone;
    }
    const webkitNotice = document.getElementById('app-storage-webkit-notice');
    if (webkitNotice) {
        webkitNotice.hidden = !(detectBrowserEngine() === 'WebKit' && !isStandalone);
    }
}

function updateInstallButtonVisibility() {
    const installContainer = document.getElementById('app-hero-install-container');
    if (!installContainer) return;
    const shouldShow = isPwaInstallSupported() && !isRunningStandalone();
    installContainer.hidden = !shouldShow;
}

/**
 * Initializes all interactive input bindings on the App Management page.
 */
export function initAppManagementInputs() {
    if (typeof document === 'undefined') return;

    // 0. Hero Card Direct Install Action & Reactive Display Mode Refinements
    const installContainer = document.getElementById('app-hero-install-container');
    const installBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('app-hero-install-btn'));

    updateInstallButtonVisibility();
    updateDisplayModePresentation();

    if (!hasAttachedAppManagementListeners) {
        hasAttachedAppManagementListeners = true;
        if (typeof document !== 'undefined') {
            document.addEventListener('pwa:installable', updateInstallButtonVisibility);
            document.addEventListener('pwa:installed', () => {
                const container = document.getElementById('app-hero-install-container');
                if (container) container.hidden = true;
                updateDisplayModePresentation();
            });
            document.addEventListener('languageChanged', () => {
                updateDisplayModePresentation();
            });
            document.addEventListener('app:update-pending', (e) => {
                if (/** @type {CustomEvent} */ (e).detail?.hasPending) {
                    if (typeof activeUpdateStateSetter === 'function') {
                        activeUpdateStateSetter('installed');
                    }
                }
            });
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', () => {
                const viewportEl = document.getElementById('app-diag-viewport');
                renderViewportDimensions(viewportEl, window.innerWidth, window.innerHeight);
            }, { passive: true });

            const handleNetworkChange = () => {
                const networkEl = document.getElementById('app-diag-network-status');
                const isOnline = typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
                renderNetworkStatus(networkEl, isOnline);
            };
            window.addEventListener('online', handleNetworkChange);
            window.addEventListener('offline', handleNetworkChange);
        }
    }

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            installBtn.disabled = true;
            try {
                const outcome = await promptPwaInstall();
                if (outcome === 'accepted' || isRunningStandalone()) {
                    if (installContainer) installContainer.hidden = true;
                }
            } finally {
                installBtn.disabled = false;
            }
        });
    }

    const startupSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('app-startup-select'));
    if (startupSelect) {
        startupSelect.addEventListener('change', () => {
            setStartupRoutePreference(startupSelect.value);
        });
    }

    const clearCacheBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('app-clear-cache-btn'));
    const storageUsageText = document.getElementById('app-storage-usage-text');

    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            clearCacheBtn.disabled = true;
            const originalText = clearCacheBtn.textContent;
            try {
                await clearTemporaryAssetCaches();
                clearCacheBtn.textContent = translate('views.appManagement.storage.cleared');
                setTimeout(() => {
                    clearCacheBtn.textContent = originalText;
                    clearCacheBtn.disabled = false;
                }, 2500);
                const updatedSize = await getAppStorageUsage();
                renderStorageUsage(storageUsageText, updatedSize);
            } catch (_) {
                clearCacheBtn.disabled = false;
            }
        });
    }

    // Reactive Update & Lifecycle Engine
    const lifecycleRow = document.getElementById('app-lifecycle-row');
    const checkUpdateBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('app-check-update-btn'));
    /** @type {import('./appManagementDisplay.js').UpdateLifecycleState} */
    let currentUpdateState = 'idle';

    /**
     * @param {import('./appManagementDisplay.js').UpdateLifecycleState} newState
     */
    const setUpdateState = (newState) => {
        currentUpdateState = newState;
        if (lifecycleRow) {
            renderUpdateLifecycle(lifecycleRow, currentUpdateState, isRunningStandalone());
        }
    };
    activeUpdateStateSetter = setUpdateState;

    const hasPending = typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem('oreCalcUpdateDetectedAt'));
    setUpdateState(hasPending ? 'installed' : 'idle');

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (!reg) return;
            if (reg.waiting) {
                setUpdateState('installed');
            } else if (reg.installing) {
                setUpdateState('downloading');
                reg.installing.addEventListener('statechange', (e) => {
                    const target = /** @type {ServiceWorker} */ (e.target);
                    if (target.state === 'installing') {
                        activeUpdateStateSetter?.('installing');
                    } else if (target.state === 'installed') {
                        activeUpdateStateSetter?.('installed');
                    }
                });
            }

            if (!hasAttachedSwRegistrationListener) {
                hasAttachedSwRegistrationListener = true;
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    activeUpdateStateSetter?.('downloading');
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installing') {
                            activeUpdateStateSetter?.('installing');
                        } else if (newWorker.state === 'installed') {
                            activeUpdateStateSetter?.('installed');
                        }
                    });
                });
            }
        }).catch(() => {});
    }

    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', async () => {
            if (currentUpdateState === 'installed') {
                checkUpdateBtn.disabled = true;
                if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                    try {
                        const reg = await navigator.serviceWorker.getRegistration();
                        if (reg?.waiting) {
                            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                        } else if (typeof window !== 'undefined' && window.__WB__) {
                            window.__WB__.messageSkipWaiting();
                        }
                    } catch (_) {}
                }
                try {
                    if (typeof sessionStorage !== 'undefined') {
                        sessionStorage.removeItem('oreCalcUpdateDetectedAt');
                    }
                } catch (_) {}
                if (typeof window !== 'undefined' && window.location?.reload) {
                    window.location.reload();
                }
                return;
            }

            setUpdateState('checking');
            try {
                if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                    const reg = await navigator.serviceWorker.getRegistration();
                    if (reg) {
                        if (reg.waiting) {
                            setUpdateState('installed');
                            return;
                        }
                        await reg.update();
                    }
                }
                setTimeout(() => {
                    if (currentUpdateState === 'checking') {
                        setUpdateState('up-to-date');
                    }
                }, 800);
            } catch (_) {
                setUpdateState('idle');
            }
        });
    }

    const wakeLockSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('app-wake-lock-switch'));
    if (wakeLockSwitch) {
        if (!isWakeLockSupported()) {
            wakeLockSwitch.disabled = true;
            const parentGroup = wakeLockSwitch.closest('.management-item-row');
            parentGroup?.classList.add('is-unsupported');
        } else {
            const isPreferred = getWakeLockPreference();
            wakeLockSwitch.checked = isPreferred;
            if (isPreferred) {
                toggleWakeLock(true).catch(() => {});
            }
            wakeLockSwitch.addEventListener('change', async () => {
                await toggleWakeLock(wakeLockSwitch.checked);
            });
        }
    }

    const hapticSwitch = /** @type {HTMLInputElement|null} */ (document.getElementById('app-haptic-switch'));
    const hapticRow = document.getElementById('app-setting-haptics');
    const hapticDesc = document.getElementById('app-haptic-desc');
    if (hapticSwitch) {
        if (!isHapticsSupported()) {
            hapticSwitch.disabled = true;
            hapticSwitch.checked = false;
            hapticRow?.classList.add('is-unsupported');
            if (hapticDesc) {
                hapticDesc.textContent = `${translate('views.appManagement.preferences.tactileHapticsDesc')} ${translate('status.unsupported')}`;
            }
        } else {
            hapticSwitch.checked = getHapticsPreference();
            hapticSwitch.addEventListener('change', () => {
                setHapticsPreference(hapticSwitch.checked);
                if (hapticSwitch.checked) {
                    triggerHaptic('toggle');
                }
            });
        }
    }

    // Copy Diagnostics Button
    const copyDiagBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('app-copy-diagnostics-btn'));
    const copyDiagBtnText = document.getElementById('app-copy-diagnostics-btn-text');
    if (copyDiagBtn) {
        copyDiagBtn.addEventListener('click', async () => {
            const diagnostics = getEnvironmentDiagnostics();
            const versionStr = getAppVersionString();
            const report = formatDiagnosticsReport(diagnostics, versionStr);

            try {
                if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(report);
                }
                copyDiagBtn.disabled = true;
                if (copyDiagBtnText) {
                    const originalText = copyDiagBtnText.textContent;
                    copyDiagBtnText.textContent = translate('actions.copied');
                    setTimeout(() => {
                        copyDiagBtnText.textContent = originalText;
                        copyDiagBtn.disabled = false;
                    }, 2500);
                }
            } catch (_) {
                copyDiagBtn.disabled = false;
            }
        });
    }

    // Initial Viewport & Network presentation
    if (typeof window !== 'undefined') {
        const viewportEl = document.getElementById('app-diag-viewport');
        renderViewportDimensions(viewportEl, window.innerWidth, window.innerHeight);

        const networkEl = document.getElementById('app-diag-network-status');
        const isOnline = typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
        renderNetworkStatus(networkEl, isOnline);
    }
}
