import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { getActiveUserId } from '../../core/storageKeys.js';

import { logger } from '../../utils/logger.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';
import { getAppLastUpdatedDateFormatted } from '../../utils/dateUtils.js';

import { openPrivacyModal } from './settingsLegalModals.js';
import { submitBugReport } from '../../services/apiService.js';
import { showAlert } from '../../ui/noticeModal.js';

/**
 * Synchronizes the Service Worker troubleshoot box state with whether an update is pending.
 *
 * @param {HTMLElement | null} [modal=document.getElementById('bug-report-modal')]
 */
function syncTroubleshootUpdateState(modal = (typeof document !== 'undefined' ? document.getElementById('bug-report-modal') : null)) {
    if (!modal || typeof document === 'undefined') return;
    const hasPending = typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem('oreCalcUpdateDetectedAt'));
    const box = /** @type {HTMLElement | null} */ (document.getElementById('support-sw-troubleshoot-box'));
    const titleEl = /** @type {HTMLElement | null} */ (document.getElementById('support-sw-troubleshoot-title'));
    const descEl = /** @type {HTMLElement | null} */ (document.getElementById('support-sw-troubleshoot-desc'));
    const iconEl = /** @type {HTMLElement | null} */ (document.getElementById('support-reset-sw-icon'));
    const labelEl = /** @type {HTMLElement | null} */ (document.getElementById('support-reset-sw-label'));

    if (!box || !titleEl || !descEl || !iconEl || !labelEl) return;

    box.classList.toggle('has-update', hasPending);
    if (hasPending) {
        titleEl.setAttribute('data-i18n', 'views.settings.bugReport.updateAvailableTitle');
        titleEl.textContent = translate('views.settings.bugReport.updateAvailableTitle');
        descEl.setAttribute('data-i18n', 'views.settings.bugReport.updateAvailableDesc');
        descEl.textContent = translate('views.settings.bugReport.updateAvailableDesc');
        iconEl.setAttribute('name', 'update');
        labelEl.setAttribute('data-i18n', 'views.settings.bugReport.updateNowLabel');
        labelEl.textContent = translate('views.settings.bugReport.updateNowLabel');
    } else {
        titleEl.setAttribute('data-i18n', 'views.settings.bugReport.appNotUpdatingTitle');
        titleEl.textContent = translate('views.settings.bugReport.appNotUpdatingTitle');
        descEl.setAttribute('data-i18n', 'views.settings.bugReport.swDesc');
        descEl.textContent = translate('views.settings.bugReport.swDesc');
        iconEl.setAttribute('name', 'sync');
        labelEl.setAttribute('data-i18n', 'views.settings.bugReport.forceUpdateLabel');
        labelEl.textContent = translate('views.settings.bugReport.forceUpdateLabel');
    }
}

/**
 * Opens the unified Bug Report & Feedback modal dialog.
 *
 * @param {'bug'|'feedback'} [initialMode='bug'] - The initial mode to open the modal in.
 * @param {Record<string, any>} [options={}] - Optional modal display configuration.
 */
export function openBugReportModal(initialMode = 'bug', options = {}) {
    const modal = document.getElementById('bug-report-modal');
    if (!modal) return;

    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const modalTitle = /** @type {HTMLElement | null} */ (document.getElementById('support-modal-title') || document.getElementById('bug-report-modal-title'));
    const tabBug = /** @type {HTMLButtonElement | null} */ (document.getElementById('support-tab-bug'));
    const tabFeedback = /** @type {HTMLButtonElement | null} */ (document.getElementById('support-tab-feedback'));
    const infoBug = /** @type {HTMLElement | null} */ (document.getElementById('support-modal-info-bug'));
    const infoFeedback = /** @type {HTMLElement | null} */ (document.getElementById('support-modal-info-feedback'));
    const descLabel = /** @type {HTMLLabelElement | null} */ (document.getElementById('support-desc-label'));
    const attachGroup = /** @type {HTMLElement | null} */ (document.getElementById('support-attach-group'));
    const swTroubleshootBox = /** @type {HTMLElement | null} */ (document.getElementById('support-sw-troubleshoot-box'));
    const privacyBug = /** @type {HTMLElement | null} */ (document.getElementById('support-privacy-bug'));
    const privacyFeedback = /** @type {HTMLElement | null} */ (document.getElementById('support-privacy-feedback'));

    const emailInput = /** @type {HTMLInputElement | null} */ (document.getElementById('support-email') || document.getElementById('bug-report-email'));
    const emailError = /** @type {HTMLElement | null} */ (document.getElementById('support-email-error') || document.getElementById('bug-report-email-error'));
    const descTextarea = /** @type {HTMLTextAreaElement | null} */ (document.getElementById('support-desc') || document.getElementById('bug-report-desc'));
    const descError = /** @type {HTMLElement | null} */ (document.getElementById('support-desc-error') || document.getElementById('bug-report-desc-error'));
    const charCount = /** @type {HTMLElement | null} */ (document.getElementById('support-char-count') || document.getElementById('bug-report-char-count'));

    const attachCheckbox = /** @type {HTMLInputElement | null} */ (document.getElementById('support-attach-checkbox') || document.getElementById('bug-report-attach-checkbox'));
    const submitBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('submit-support-btn') || document.getElementById('submit-bug-report-btn'));
    const closeHeaderBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('close-support-modal-btn') || document.getElementById('close-support-header-btn') || document.getElementById('close-bug-report-header-btn'));
    const closeBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('cancel-support-modal-btn') || document.getElementById('close-support-modal-btn') || document.getElementById('close-bug-report-modal-btn'));

    /** @type {'bug'|'feedback'} */
    let currentMode = initialMode === 'feedback' ? 'feedback' : 'bug';

    /**
     * @param {'bug'|'feedback'} mode
     */
    const setSupportMode = (mode) => {
        currentMode = mode;
        const isBug = mode === 'bug';

        if (tabBug) {
            tabBug.classList.toggle('is-active', isBug);
            tabBug.setAttribute('aria-selected', String(isBug));
        }
        if (tabFeedback) {
            tabFeedback.classList.toggle('is-active', !isBug);
            tabFeedback.setAttribute('aria-selected', String(!isBug));
        }

        if (modalTitle) {
            modalTitle.textContent = isBug
                ? translate('views.settings.bugReport.title')
                : translate('views.settings.feedback.title');
            modalTitle.setAttribute('data-i18n', isBug ? 'views.settings.bugReport.title' : 'views.settings.feedback.title');
        }

        if (infoBug) infoBug.hidden = !isBug;
        if (infoFeedback) infoFeedback.hidden = isBug;

        if (descLabel) {
            descLabel.textContent = isBug
                ? translate('views.settings.options.bugDescription')
                : translate('views.settings.feedback.descLabel');
            descLabel.setAttribute('data-i18n', isBug ? 'views.settings.options.bugDescription' : 'views.settings.feedback.descLabel');
        }

        if (descTextarea) {
            const placeholderKey = isBug ? 'views.settings.options.bugDescPlaceholder' : 'views.settings.feedback.descPlaceholder';
            descTextarea.placeholder = translate(placeholderKey);
            descTextarea.setAttribute('data-i18n-placeholder', placeholderKey);
            descTextarea.classList.remove('input-error');
        }

        if (descError) {
            descError.textContent = '';
            descError.classList.remove('show');
        }

        if (attachGroup) attachGroup.hidden = !isBug;
        if (swTroubleshootBox) swTroubleshootBox.hidden = !isBug;

        if (privacyBug) privacyBug.hidden = !isBug;
        if (privacyFeedback) privacyFeedback.hidden = isBug;
    };

    if (tabBug) {
        tabBug.onclick = (e) => {
            e.preventDefault();
            setSupportMode('bug');
        };
    }

    if (tabFeedback) {
        tabFeedback.onclick = (e) => {
            e.preventDefault();
            setSupportMode('feedback');
        };
    }

    setSupportMode(currentMode);

    if (emailInput) {
        emailInput.value = '';
        emailInput.classList.remove('input-error');
    }
    if (emailError) {
        emailError.textContent = '';
        emailError.classList.remove('show');
    }
    if (descTextarea) {
        descTextarea.value = '';
        descTextarea.classList.remove('input-error');
    }
    if (descError) {
        descError.textContent = '';
        descError.classList.remove('show');
    }
    if (charCount) {
        charCount.textContent = '0/1000';
    }
    if (attachCheckbox) {
        attachCheckbox.checked = true;
    }

    if (descTextarea && charCount) {
        descTextarea.oninput = () => {
            const len = descTextarea.value.length;
            charCount.textContent = `${len}/1000`;
            const minLen = currentMode === 'bug' ? 20 : 10;
            if (len >= minLen) {
                descTextarea.classList.remove('input-error');
                if (descError) {
                    descError.textContent = '';
                    descError.classList.remove('show');
                }
            }
        };
    }

    if (emailInput && emailError) {
        emailInput.oninput = () => {
            emailInput.classList.remove('input-error');
            emailError.textContent = '';
            emailError.classList.remove('show');
        };
    }

    const closeModal = () => {
        closeModalAnimated(modal);
    };

    if (closeHeaderBtn) {
        closeHeaderBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    const resetSWBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('support-reset-sw-btn') || document.getElementById('bug-report-reset-sw-btn'));
    if (resetSWBtn) {
        resetSWBtn.onclick = async (e) => {
            e.preventDefault();
            resetSWBtn.disabled = true;
            resetSWBtn.style.opacity = '0.7';

            const hasPending = typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem('oreCalcUpdateDetectedAt'));

            if (hasPending) {
                if ('serviceWorker' in navigator) {
                    try {
                        const reg = await navigator.serviceWorker.getRegistration();
                        if (reg?.waiting) {
                            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                    } catch (err) {
                        logger.error('Failed to notify waiting service worker:', err);
                    }
                }
                sessionStorage.removeItem('oreCalcUpdateDetectedAt');
                window.location.reload();
                return;
            }

            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                } catch (err) {
                    logger.error('Failed to unregister service workers:', err);
                }
            }

            if ('caches' in window) {
                try {
                    await caches.delete('orecalc-cache-v1');
                } catch (err) {
                    logger.error('Failed to clear caches:', err);
                }
            }

            sessionStorage.removeItem('clashCalc_lastSwReload');
            sessionStorage.removeItem('oreCalcUpdateDetectedAt');
            window.location.reload();
        };
    }

    if (submitBtn) {
        submitBtn.onclick = async (e) => {
            e.preventDefault();

            const isBug = currentMode === 'bug';
            const minLength = isBug ? 20 : 10;
            const email = emailInput ? emailInput.value.trim() : '';
            const description = descTextarea ? descTextarea.value.trim() : '';

            if (description.length < minLength) {
                if (descError) {
                    descError.textContent = isBug
                        ? translate('errors.bugDescriptionRequired')
                        : translate('errors.feedbackDescriptionRequired');
                    descError.classList.add('show');
                }
                if (descTextarea) {
                    descTextarea.classList.add('input-error');
                    descTextarea.classList.remove('shake');
                    void descTextarea.offsetWidth;
                    descTextarea.classList.add('shake');
                }
                return;
            }

            if (email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    if (emailError) {
                        emailError.textContent = translate('errors.invalidEmail');
                        emailError.classList.add('show');
                    }
                    if (emailInput) {
                        emailInput.classList.add('input-error');
                        emailInput.classList.remove('shake');
                        void emailInput.offsetWidth;
                        emailInput.classList.add('shake');
                    }
                    return;
                }
            }

            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = translate('actions.processing');
            if (closeBtn) closeBtn.disabled = true;

            try {
                const currentUserId = getActiveUserId() || 'unknown';

                let attachedData = null;
                if (isBug && attachCheckbox && attachCheckbox.checked) {
                    const stateClone = structuredClone(state);
                    attachedData = {
                        ...stateClone,
                        userId: currentUserId
                    };
                }

                await submitBugReport(email, description, attachedData, currentUserId, currentMode);

                closeModal();
                const successAlertKey = isBug ? 'alerts.bugReportSuccess' : 'alerts.feedbackSuccess';
                await showAlert(translate(successAlertKey), 'status.success');
            } catch (err) {
                logger.error('Error submitting support report:', err);
                const failAlertKey = isBug ? 'alerts.bugReportFailure' : 'alerts.feedbackFailure';
                let errMsg = translate(failAlertKey);
                if (err.message && err.message.startsWith('apiErrors.')) {
                    errMsg = translate(err.message);
                } else if (err.message) {
                    errMsg = `${errMsg} (${err.message})`;
                }
                await showAlert(errMsg, 'status.error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                if (closeBtn) closeBtn.disabled = false;
            }
        };
    }

    const privacyLinks = modal.querySelectorAll('#bug-report-privacy-link, #feedback-privacy-link');
    privacyLinks.forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            openPrivacyModal();
        };
    });

    const versionEl = document.getElementById('support-sw-version-text');
    if (versionEl) {
        const rawVersion = (typeof window !== 'undefined' && window.__ENV__?.APP_VERSION) || state.appVersion || '3.1.0';
        versionEl.textContent = 'v' + String(rawVersion).replace(/^v/, '');
    }

    const lastUpdatedEl = document.getElementById('support-last-updated-text');
    if (lastUpdatedEl) {
        const currentLang = state.uiSettings?.language || 'en';
        const formattedDate = getAppLastUpdatedDateFormatted(currentLang);
        if (lastUpdatedEl.dataset) {
            lastUpdatedEl.dataset.i18nArgs = JSON.stringify({ date: formattedDate });
        }
        lastUpdatedEl.textContent = translate('views.settings.bugReport.desc', { date: formattedDate });
    }

    syncTroubleshootUpdateState(modal);

    openModal(modal, options);
}

/**
 * Opens the Support & Feedback modal dialog directly in Feedback mode.
 */
export function openFeedbackModal() {
    openBugReportModal('feedback');
}

/**
 * Opens the Contact modal dialog.
 * @param {Record<string, any>} [options={}] - Optional modal display configuration.
 */
export function openContactModal(options = {}) {
    const modal = document.getElementById('contact-modal');
    if (!modal) return;

    if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const closeHeaderBtn = document.getElementById('close-contact-modal-btn') || document.getElementById('close-contact-header-btn');
    const closeBtn = document.getElementById('close-contact-footer-btn') || document.getElementById('close-contact-modal-btn');
    const mailBtn = document.getElementById('contact-mail-btn');

    const closeModal = () => {
        closeModalAnimated(modal);
    };

    if (closeHeaderBtn) {
        closeHeaderBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.preventDefault();
            closeModal();
        };
    }

    if (mailBtn) {
        mailBtn.onclick = (e) => {
            e.stopPropagation();
            closeModal();
        };
    }

    openModal(modal, options);
}

if (typeof document !== 'undefined') {
    document.addEventListener('app:update-pending', () => {
        const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('bug-report-modal'));
        if (modal && 'open' in modal && modal.open) {
            syncTroubleshootUpdateState(modal);
        }
    });

    document.addEventListener('app:translate', () => {
        const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('bug-report-modal'));
        if (modal && 'open' in modal && modal.open) {
            syncTroubleshootUpdateState(modal);
            const lastUpdatedEl = document.getElementById('support-last-updated-text');
            if (lastUpdatedEl) {
                const currentLang = state.uiSettings?.language || 'en';
                const formattedDate = getAppLastUpdatedDateFormatted(currentLang);
                if (lastUpdatedEl.dataset) {
                    lastUpdatedEl.dataset.i18nArgs = JSON.stringify({ date: formattedDate });
                }
                lastUpdatedEl.textContent = translate('views.settings.bugReport.desc', { date: formattedDate });
            }
        }
    });
}
