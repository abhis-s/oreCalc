import { dom } from '../../dom/domElements.js';
import { translate } from '../../i18n/translator.js';

let countdownInterval = null;
let settingsInterval = null;

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

export function updateNavigationBadges() {
    const hasPending = !!localStorage.getItem('oreCalcUpdateDetectedAt');
    const headerSettingsBtn = document.querySelector('.tab-button[data-tab="settings"]');
    const drawerSettingsBtn = document.querySelector('.navigation-drawer__tab[data-tab="settings"]');
    const bottomSettingsBtn = document.querySelector('.nav-button[data-tab="settings"]');

    [headerSettingsBtn, drawerSettingsBtn, bottomSettingsBtn].forEach(btn => {
        if (btn) {
            if (hasPending) {
                btn.classList.add('update-pending');
            } else {
                btn.classList.remove('update-pending');
            }
        }
    });

    // Also hide the settings page update card if update is no longer pending
    if (!hasPending) {
        const card = document.getElementById('settings-update-card');
        if (card) {
            card.style.display = 'none';
        }
        if (settingsInterval) {
            clearInterval(settingsInterval);
            settingsInterval = null;
        }
    }
}

export function initSettingsUpdateCard(wb) {
    const card = document.getElementById('settings-update-card');
    const countdownText = document.getElementById('settings-update-countdown');
    const reloadBtn = document.getElementById('settings-update-now-btn');

    if (!card) return;

    const detectedAtStr = localStorage.getItem('oreCalcUpdateDetectedAt');

    if (!detectedAtStr) {
        card.style.display = 'none';
        if (settingsInterval) {
            clearInterval(settingsInterval);
            settingsInterval = null;
        }
        return;
    }

    const limitMs = 48 * 60 * 60 * 1000; // 48 hours

    const forceReload = () => {
        if (settingsInterval) clearInterval(settingsInterval);
        if (countdownInterval) clearInterval(countdownInterval);

        // Safeguard to prevent infinite reload loops (e.g. if blocked by another tab)
        const lastReload = sessionStorage.getItem('oreCalcLastUpdateReload');
        const now = Date.now();
        if (lastReload && (now - parseInt(lastReload, 10) < 15000)) {
            console.warn('Update reload loop detected. Aborting forced reload.');
            return;
        }

        sessionStorage.setItem('oreCalcLastUpdateReload', now.toString());
        localStorage.removeItem('oreCalcUpdateDetectedAt');
        updateNavigationBadges();

        card.style.display = 'none';

        wb.addEventListener('controlling', () => {
            window.location.reload();
        });
        wb.messageSkipWaiting();
    };

    const updateCardCountdown = () => {
        const currentDetectedAtStr = localStorage.getItem('oreCalcUpdateDetectedAt');

        // Check if update is no longer active before running logic
        if (!currentDetectedAtStr) {
            if (settingsInterval) {
                clearInterval(settingsInterval);
                settingsInterval = null;
            }
            card.style.display = 'none';
            return;
        }

        let currentDetectedAt = parseInt(currentDetectedAtStr, 10);
        
        // Handle negative, NaN, or future offsets
        if (isNaN(currentDetectedAt) || currentDetectedAt <= 0 || currentDetectedAt > Date.now()) {
            currentDetectedAt = Date.now();
            localStorage.setItem('oreCalcUpdateDetectedAt', currentDetectedAt.toString());
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
            const lastGrace = sessionStorage.getItem('oreCalcGraceAdded');
            if (!lastGrace) {
                let newDetectedAt = currentDetectedAt - (2 * 60 * 1000); // Shift backward to add 2 mins
                let newTimeLeft = limitMs - (Date.now() - newDetectedAt);
                if (newTimeLeft > oneHourMs) {
                    newDetectedAt = Date.now() - limitMs + oneHourMs; // Cap at 1 hour max
                }
                currentDetectedAt = newDetectedAt;
                localStorage.setItem('oreCalcUpdateDetectedAt', currentDetectedAt.toString());
                sessionStorage.setItem('oreCalcGraceAdded', 'true');

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

            let timeStr = '';
            if (days > 0) {
                timeStr += `${days}d `;
            }
            timeStr += `${hours}h ${minutes}m`;

            const rawText = translate('status.updateForcedShort') || 'Auto-update in: {time}';
            countdownText.textContent = rawText.replace('{time}', timeStr);
            applyTimerColor(countdownText, timeLeft);
        }
    };

    if (reloadBtn) {
        reloadBtn.onclick = () => {
            forceReload();
        };
    }

    card.style.display = 'block';

    if (settingsInterval) clearInterval(settingsInterval);
    updateCardCountdown();
    settingsInterval = setInterval(updateCardCountdown, 60000); // Update card every 1 minute
}

export function showUpdateModal(wb) {
    const modal = document.getElementById('update-available-modal');
    const laterBtn = document.getElementById('update-later-button');
    const reloadBtn = document.getElementById('update-reload-button');
    const closeBtn = document.getElementById('close-update-modal-btn');
    const countdownText = document.getElementById('update-force-countdown-text');
    const overlay = dom.overlay;

    if (!modal) return;

    // Check or set the update detected timestamp
    let detectedAtStr = localStorage.getItem('oreCalcUpdateDetectedAt');
    if (!detectedAtStr) {
        detectedAtStr = Date.now().toString();
        localStorage.setItem('oreCalcUpdateDetectedAt', detectedAtStr);
    }

    // Apply badge and settings card immediate update
    updateNavigationBadges();
    initSettingsUpdateCard(wb);

    const forceReload = () => {
        if (countdownInterval) clearInterval(countdownInterval);
        if (settingsInterval) clearInterval(settingsInterval);

        // Safeguard to prevent infinite reload loops (e.g. if blocked by another tab)
        const lastReload = sessionStorage.getItem('oreCalcLastUpdateReload');
        const now = Date.now();
        if (lastReload && (now - parseInt(lastReload, 10) < 15000)) {
            console.warn('Update reload loop detected. Aborting forced reload.');
            return;
        }

        sessionStorage.setItem('oreCalcLastUpdateReload', now.toString());
        localStorage.removeItem('oreCalcUpdateDetectedAt');
        updateNavigationBadges();

        wb.addEventListener('controlling', () => {
            window.location.reload();
        });
        wb.messageSkipWaiting();
    };

    const updateCountdown = () => {
        const currentDetectedAtStr = localStorage.getItem('oreCalcUpdateDetectedAt');

        // Check if update is no longer active before running logic
        if (!currentDetectedAtStr) {
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            modal.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
            return;
        }

        let currentDetectedAt = parseInt(currentDetectedAtStr, 10);
        const limitMs = 48 * 60 * 60 * 1000; // 48 hours

        // Handle negative, NaN, or future offsets
        if (isNaN(currentDetectedAt) || currentDetectedAt <= 0 || currentDetectedAt > Date.now()) {
            currentDetectedAt = Date.now();
            localStorage.setItem('oreCalcUpdateDetectedAt', currentDetectedAt.toString());
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
            const lastGrace = sessionStorage.getItem('oreCalcGraceAdded');
            if (!lastGrace) {
                let newDetectedAt = currentDetectedAt - (2 * 60 * 1000); // Shift backward to add 2 mins
                let newTimeLeft = limitMs - (Date.now() - newDetectedAt);
                if (newTimeLeft > oneHourMs) {
                    newDetectedAt = Date.now() - limitMs + oneHourMs; // Cap at 1 hour max
                }
                currentDetectedAt = newDetectedAt;
                localStorage.setItem('oreCalcUpdateDetectedAt', currentDetectedAt.toString());
                sessionStorage.setItem('oreCalcGraceAdded', 'true');

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

            let timeStr = '';
            if (days > 0) {
                timeStr += `${days}d `;
            }
            timeStr += `${hours}h ${minutes}m`;

            const rawText = translate('status.updateForcedIn') || 'This update will be forced in {time}.';
            countdownText.textContent = rawText.replace('{time}', timeStr);
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
            modal.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.classList.remove('show');
            if (overlay) overlay.classList.remove('show');
        };
    }

    if (reloadBtn) {
        reloadBtn.onclick = () => {
            forceReload();
        };
    }

    modal.classList.add('show');
    if (overlay) overlay.classList.add('show');
}
