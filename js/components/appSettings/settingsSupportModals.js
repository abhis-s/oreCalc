import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { getActiveUserId } from '../../core/storageKeys.js';

import { logger } from '../../utils/logger.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';

import { openPrivacyModal } from './settingsLegalModals.js';
import { submitBugReport } from '../../services/apiService.js';
import { showAlert } from '../../ui/noticeModal.js';

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
    const closeHeaderBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('close-support-header-btn') || document.getElementById('close-bug-report-header-btn'));
    const closeBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('close-support-modal-btn') || document.getElementById('close-bug-report-modal-btn'));

    /** @type {'bug'|'feedback'} */
    let currentMode = initialMode === 'feedback' ? 'feedback' : 'bug';

    /**
     * @param {'bug'|'feedback'} mode
     */
    const setSupportMode = (mode) => {
        currentMode = mode;
        const isBug = mode === 'bug';

        if (tabBug) {
            tabBug.classList.toggle('active', isBug);
            tabBug.setAttribute('aria-selected', String(isBug));
        }
        if (tabFeedback) {
            tabFeedback.classList.toggle('active', !isBug);
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

    const closeHeaderBtn = document.getElementById('close-contact-header-btn');
    const closeBtn = document.getElementById('close-contact-modal-btn');
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
