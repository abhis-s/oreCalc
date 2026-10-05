import { logger } from '../utils/logger.js';
import { showUpdateModal, updateNavigationBadges } from '../components/modals/updateModal.js';

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
