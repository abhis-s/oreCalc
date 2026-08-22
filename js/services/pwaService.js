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
            localStorage.setItem('oreCalc_SWUpdatedTime', new Date().toISOString());
            localStorage.removeItem('oreCalcSWUpdatedTime');
        } catch (_) {}
    };

    const handleSWWaiting = (reg) => {
        logger.log('A new version of OreCalc is available and waiting.');
        if (!sessionStorage.getItem('oreCalcUpdateDetectedAt') && !localStorage.getItem('oreCalcUpdateDetectedAt')) {
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
        const lastReload = sessionStorage.getItem('oreCalcLastUpdateReload');
        const now = Date.now();
        if (lastReload && (now - parseInt(lastReload, 10) < 15000)) {
            logger.warn('Forced update reload loop detected. Aborting automatic reload.');
            return;
        }
        sessionStorage.setItem('oreCalcLastUpdateReload', now.toString());
        sessionStorage.removeItem('oreCalcUpdateDetectedAt');
        try { localStorage.removeItem('oreCalcUpdateDetectedAt'); } catch (_) {}
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
            if (!localStorage.getItem('oreCalc_SWUpdatedTime') && !localStorage.getItem('oreCalcSWUpdatedTime')) {
                markSWUpdated();
            }
            if (reg.waiting) {
                handleSWWaiting(reg.waiting);
            } else {
                sessionStorage.removeItem('oreCalcUpdateDetectedAt');
                try { localStorage.removeItem('oreCalcUpdateDetectedAt'); } catch (_) {}
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
