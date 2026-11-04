import { translate } from '../../i18n/translator.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';

let countdownInterval = null;
let hasAddedGrace = false;

function applyTimerColor(element, timeLeft) {
    if (!element) return;
    const sixHoursMs = 6 * 60 * 60 * 1000;
    const oneHourMs = 1 * 60 * 60 * 1000;

    if (timeLeft < oneHourMs) {
        element.style.color = '#ea4335'; // Red
    } else if (timeLeft < sixHoursMs) {
        element.style.color = '#f1c40f'; // Yellow
    } else {
        element.style.color = ''; // Default style
    }
}

/**
 * Synchronizes update-pending badge indicator classes across all Settings navigation buttons.
 */
export function updateNavigationBadges() {
    const hasPending = !!sessionStorage.getItem('oreCalcUpdateDetectedAt');

    const headerAccountBtn = document.getElementById('header-account-btn');
    if (headerAccountBtn) {
        headerAccountBtn.classList.toggle('update-pending', hasPending);
    }

    const headerAccountDot = document.getElementById('header-account-update-dot');
    if (headerAccountDot) {
        headerAccountDot.classList.toggle('is-hidden', !hasPending);
        headerAccountDot.hidden = !hasPending;
    }

    const updateBtns = [
        document.getElementById('account-popover-update-btn'),
        document.getElementById('account-popover-guest-update-btn')
    ];
    updateBtns.forEach(btn => {
        if (btn) {
            btn.classList.toggle('is-hidden', !hasPending);
            btn.hidden = !hasPending;
        }
    });

    if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('app:update-pending', { detail: { hasPending } }));
    }

    if (hasPending) {
        const detectedAtStr = sessionStorage.getItem('oreCalcUpdateDetectedAt');
        if (detectedAtStr) {
            let detectedAt = parseInt(detectedAtStr, 10);
            if (isNaN(detectedAt) || detectedAt <= 0 || detectedAt > Date.now()) {
                detectedAt = Date.now();
            }
            const limitMs = 48 * 60 * 60 * 1000;
            const timeLeft = Math.max(0, limitMs - (Date.now() - detectedAt));
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            const timerText = hours > 0 ? `${hours}h` : `${minutes}m`;

            const timerEls = [
                document.getElementById('account-popover-update-timer'),
                document.getElementById('account-popover-guest-update-timer')
            ];
            timerEls.forEach(el => {
                if (el) {
                    el.textContent = timerText;
                    applyTimerColor(el, timeLeft);
                }
            });
        }
    }
}

/**
 * Displays the Service Worker update available dialog with dynamic countdown timer.
 * @param {any} [wb] - Workbox PWA service worker instance.
 */
export function showUpdateModal(wb) {
    const modal = document.getElementById('update-available-modal');
    const laterBtn = document.getElementById('update-later-btn') || document.getElementById('update-later-button');
    const reloadBtn = document.getElementById('update-reload-btn') || document.getElementById('update-reload-button');
    const closeBtn = document.getElementById('close-update-modal-btn');
    const countdownText = document.getElementById('update-force-countdown-text');

    if (!modal) return;

    // Check or set the update detected timestamp
    let detectedAtStr = sessionStorage.getItem('oreCalcUpdateDetectedAt');
    if (!detectedAtStr) {
        detectedAtStr = Date.now().toString();
        sessionStorage.setItem('oreCalcUpdateDetectedAt', detectedAtStr);
    }

    // Apply badge immediate update
    updateNavigationBadges();

    const forceReload = () => {
        if (countdownInterval) clearInterval(countdownInterval);

        // Safeguard to prevent infinite reload loops (e.g. if blocked by another tab)
        const lastReload = sessionStorage.getItem('clashCalc_lastSwReload');
        const now = Date.now();
        if (lastReload && (now - parseInt(lastReload, 10) < 15000)) {
            console.warn('Update reload loop detected. Aborting forced reload.');
            return;
        }

        sessionStorage.setItem('clashCalc_lastSwReload', now.toString());
        sessionStorage.removeItem('oreCalcUpdateDetectedAt');
        updateNavigationBadges();

        wb.addEventListener('controlling', () => {
            window.location.reload();
        });
        wb.messageSkipWaiting();
    };

    const updateCountdown = () => {
        const currentDetectedAtStr = sessionStorage.getItem('oreCalcUpdateDetectedAt');

        if (!currentDetectedAtStr) {
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            closeModalAnimated(modal);
            return;
        }

        let currentDetectedAt = parseInt(currentDetectedAtStr, 10);
        const limitMs = 48 * 60 * 60 * 1000; // 48 hours

        // Handle negative, NaN, or future offsets
        if (isNaN(currentDetectedAt) || currentDetectedAt <= 0 || currentDetectedAt > Date.now()) {
            currentDetectedAt = Date.now();
            sessionStorage.setItem('oreCalcUpdateDetectedAt', currentDetectedAt.toString());
        }

        const elapsed = Date.now() - currentDetectedAt;
        let timeLeft = limitMs - elapsed;

        if (timeLeft <= 0) {
            forceReload();
            return;
        }

        // Apply 2 minutes grace adjustment when time left drops below 1 hour
        const oneHourMs = 1 * 60 * 60 * 1000;
        if (timeLeft > 0 && timeLeft < oneHourMs) {
            if (!hasAddedGrace) {
                let newDetectedAt = currentDetectedAt - (2 * 60 * 1000); // Shift backward to add 2 mins
                let newTimeLeft = limitMs - (Date.now() - newDetectedAt);
                if (newTimeLeft > oneHourMs) {
                    newDetectedAt = Date.now() - limitMs + oneHourMs; // Cap at 1 hour max
                }
                currentDetectedAt = newDetectedAt;
                sessionStorage.setItem('oreCalcUpdateDetectedAt', currentDetectedAt.toString());
                hasAddedGrace = true;

                timeLeft = limitMs - (Date.now() - currentDetectedAt);
            }
        }

        if (timeLeft < 0) {
            timeLeft = 0;
        }

        if (countdownText) {
            const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
            const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));

            const daysSuffix = translate('time.daysSuffix') || 'd';
            let timeStr = '';
            if (days > 0) {
                timeStr += `${days}${daysSuffix} `;
            }
            timeStr += `${hours}h ${minutes}m`;

            countdownText.textContent = translate('status.updateForcedIn', { time: timeStr });
            applyTimerColor(countdownText, timeLeft);
        }
    };

    // Clean up previous interval if running
    if (countdownInterval) clearInterval(countdownInterval);

    // Initial check
    let initialDetectedAt = parseInt(detectedAtStr, 10);
    const limitMs = 48 * 60 * 60 * 1000; // 48 hours
    if (isNaN(initialDetectedAt) || initialDetectedAt <= 0 || initialDetectedAt > Date.now()) {
        initialDetectedAt = Date.now();
    }
    const initialElapsed = Date.now() - initialDetectedAt;
    if (initialElapsed >= limitMs) {
        forceReload();
        return;
    }

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 3600000); // Check every 1 hour (3,600,000 ms)

    if (laterBtn) {
        laterBtn.onclick = () => {
            closeModalAnimated(modal);
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            closeModalAnimated(modal);
        };
    }

    if (reloadBtn) {
        reloadBtn.onclick = () => {
            forceReload();
        };
    }

    openModal(modal);
}

if (typeof document !== 'undefined') {
    document.addEventListener('app:translate', () => {
        updateNavigationBadges();
    });

    document.addEventListener('app:pwa-update-waiting', (e) => {
        const wb = /** @type {CustomEvent} */ (e).detail?.wb;
        updateNavigationBadges();
        try {
            if (wb) {
                showUpdateModal(wb);
            }
        } catch (_) {}
    });

    document.addEventListener('app:pwa-update-cleared', () => {
        updateNavigationBadges();
    });
}
