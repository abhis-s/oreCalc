import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';

import { logger } from '../../utils/logger.js';
import { isValidUUID } from '../../utils/uuidGenerator.js';

import { getVisualIndexFromPage, updatePagination } from './welcomeCarouselDisplay.js';
import { welcomeState } from './welcomeModalState.js';
import { renderWelcomeSyncQr, updateWelcomeSyncState } from './welcomeSyncDisplay.js';
import { showAlert } from '../../ui/noticeModal.js';
import { showToast } from '../../ui/toast.js';

let isWelcomeSyncListenersInitialized = false;

class WelcomeAccordion {
    constructor(el, group) {
        this.el = el;
        this.group = group;
        this.summary = el.querySelector('.welcome-sync-summary');
        this.content = el.querySelector('.welcome-sync-details-content');
        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;

        this.summary?.addEventListener('click', (e) => this.onClick(e));
    }

    onClick(e) {
        e.preventDefault();
        if (this.isClosing || this.isExpanding) return;

        const hasRealProfiles = state.savedPlayerTags && state.savedPlayerTags.some(tag => tag !== 'DEFAULT0');
        if (!hasRealProfiles) {
            if (this.el.id === 'welcome-your-sync-code-details') {
                return;
            }
            if (this.el.id === 'welcome-link-device-details' && this.el.open) {
                return;
            }
        }

        if (this.el.open) {
            const openDetails = Array.from(this.group).filter(d => d.open);
            if (openDetails.length <= 1) {
                return;
            }
            this.shrink();
        } else {
            this.open();
        }
    }

    shrink() {
        this.isClosing = true;

        const startHeight = `${this.el.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 220,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });

        this.animation.onfinish = () => {
            this.el.open = false;
            this.el.style.height = '';
            this.animation = null;
            this.isClosing = false;
        };
        this.animation.oncancel = () => {
            this.isClosing = false;
        };
    }

    open() {
        if (this.el.id === 'welcome-your-sync-code-details') {
            renderWelcomeSyncQr();
        }

        this.group.forEach(other => {
            if (other !== this.el && other.open) {
                const otherAcc = other._welcomeAccordion;
                if (otherAcc) {
                    otherAcc.shrink();
                } else {
                    other.open = false;
                }
            }
        });

        this.el.style.height = `${this.el.offsetHeight}px`;
        this.el.open = true;

        window.requestAnimationFrame(() => this.expand());
    }

    expand() {
        this.isExpanding = true;
        const startHeight = `${this.el.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight + this.content.offsetHeight}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 220,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        });

        this.animation.onfinish = () => {
            this.el.style.height = '';
            this.animation = null;
            this.isExpanding = false;

            const inputEl = this.el.querySelector('#welcome-sync-input');
            if (inputEl && welcomeState.scrollTargetPage === null && welcomeState.currentPage === 4) {
                inputEl.focus({ preventScroll: true });
            }
        };
        this.animation.oncancel = () => {
            this.isExpanding = false;
        };
    }
}

/**
 * Initializes Page 4 Device sync and Cloud sync event listeners (Accordions, QR code trigger, code copying, linking).
 *
 * @param {HTMLElement} modal - The Welcome modal root element.
 * @param {HTMLElement|null} carousel - The Welcome modal carousel element.
 */
export function initializeWelcomeSyncInputs(modal, carousel) {
    if (!modal || isWelcomeSyncListenersInitialized) return;

    const welcomeSyncDeviceStartBtn = document.getElementById('welcome-sync-device-start-btn');
    if (welcomeSyncDeviceStartBtn) {
        welcomeSyncDeviceStartBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            welcomeState.cameFromSyncStartBtn = true;
            welcomeState.scrollTargetPage = 4;
            updatePagination(4);
            renderWelcomeSyncQr();
            const visualIndex = getVisualIndexFromPage(4);
            if (carousel) {
                carousel.scrollTo({ left: visualIndex * carousel.clientWidth, behavior: 'smooth' });
            }

            const welcomeSyncDetailsElements = document.querySelectorAll('.welcome-sync-details');
            welcomeSyncDetailsElements.forEach((detailsEl, idx) => {
                if (idx === 1) {
                    if (detailsEl._welcomeAccordion) {
                        detailsEl._welcomeAccordion.open();
                    } else {
                        detailsEl.open = true;
                    }
                } else {
                    if (detailsEl._welcomeAccordion) {
                        detailsEl._welcomeAccordion.shrink();
                    } else {
                        detailsEl.open = false;
                    }
                }
            });

            if (navigator.clipboard && navigator.clipboard.readText) {
                try {
                    const clipboardText = await navigator.clipboard.readText();
                    const trimmed = clipboardText.trim();
                    if (isValidUUID(trimmed)) {
                        const welcomeSyncInput = document.getElementById('welcome-sync-input');
                        const welcomeSyncStatus = document.getElementById('welcome-sync-status');
                        if (welcomeSyncInput) {
                            welcomeSyncInput.value = trimmed;
                            welcomeSyncInput.classList.remove('input-error');

                            if (welcomeSyncStatus) {
                                welcomeSyncStatus.textContent = translate('alerts.uuidDetected');
                                welcomeSyncStatus.classList.remove('error');
                                welcomeSyncStatus.classList.add('success');
                                welcomeSyncStatus.style.display = 'block';
                                welcomeSyncStatus.classList.add('show');
                            }
                        }
                    }
                } catch (err) {
                    logger.warn('Clipboard read failed or denied:', err);
                }
            }
        });
    }

    const welcomeSyncDetailsElements = document.querySelectorAll('.welcome-sync-details');
    welcomeSyncDetailsElements.forEach(detailsEl => {
        detailsEl._welcomeAccordion = new WelcomeAccordion(detailsEl, welcomeSyncDetailsElements);
    });

    const welcomeSyncUserIdDisplay = document.getElementById('welcome-sync-user-id');
    const welcomeSyncCopyBtn = document.getElementById('welcome-sync-copy-btn');
    const welcomeSyncInput = document.getElementById('welcome-sync-input');
    const welcomeSyncLinkBtn = document.getElementById('welcome-sync-link-btn');
    const welcomeSyncStatus = document.getElementById('welcome-sync-status');

    const handleWelcomeCopySyncCode = async () => {
        const userId = localStorage.getItem('oreCalc_userId');
        if (!userId) return;

        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            await showAlert(translate('alerts.clipboardUnsupported'));
            return;
        }

        try {
            await navigator.clipboard.writeText(userId);

            if (welcomeSyncCopyBtn) {
                welcomeSyncCopyBtn.classList.add('success');
                const originalText = welcomeSyncCopyBtn.textContent;
                welcomeSyncCopyBtn.textContent = translate('actions.copied');
                setTimeout(() => {
                    welcomeSyncCopyBtn.classList.remove('success');
                    welcomeSyncCopyBtn.textContent = originalText;
                }, 2000);
            }

            let messageKey = '';
            if (state.uiSettings.cloudSync !== false) {
                const { triggerCloudSave } = await import('../../services/cloudSaveService.js');
                const saveSuccess = await triggerCloudSave({ silent: true });
                messageKey = saveSuccess ? 'alerts.copyAndSaveSuccess' : 'alerts.copySuccessSaveFailed';
            } else {
                messageKey = 'alerts.copySuccess';
            }

            showToast(translate(messageKey), 'success');
        } catch (err) {
            logger.error('Failed to copy sync code: ', err);
            await showAlert(translate('alerts.copiedFailed'));
        }
    };

    if (welcomeSyncUserIdDisplay) {
        welcomeSyncUserIdDisplay.addEventListener('click', handleWelcomeCopySyncCode);
    }
    if (welcomeSyncCopyBtn) {
        welcomeSyncCopyBtn.addEventListener('click', handleWelcomeCopySyncCode);
    }

    const updateLinkBtnText = () => {
        if (!welcomeSyncLinkBtn || !welcomeSyncInput) return;
        if (welcomeSyncInput.value.trim() === '') {
            welcomeSyncLinkBtn.textContent = translate('actions.paste');
        } else {
            welcomeSyncLinkBtn.textContent = translate('actions.link');
        }
    };

    if (welcomeSyncLinkBtn && welcomeSyncInput) {
        welcomeSyncLinkBtn.addEventListener('click', async () => {
            const val = welcomeSyncInput.value.trim();
            if (val === '') {
                if (!navigator.clipboard || !navigator.clipboard.readText) {
                    await showAlert(translate('alerts.clipboardUnsupported'));
                    return;
                }
                try {
                    const text = await navigator.clipboard.readText();
                    welcomeSyncInput.value = text.trim();
                    validateWelcomeInput();
                } catch (err) {
                    logger.error('Failed to read clipboard: ', err);
                    await showAlert(translate('alerts.clipboardPermissionDenied'));
                }
                return;
            }

            if (isValidUUID(val)) {
                const originalText = welcomeSyncLinkBtn.textContent;
                try {
                    welcomeSyncLinkBtn.disabled = true;
                    welcomeSyncLinkBtn.textContent = translate('actions.processing');

                    const { importUserData } = await import('../../services/cloudSaveService.js');
                    await importUserData(val);
                } finally {
                    welcomeSyncLinkBtn.disabled = false;
                    welcomeSyncLinkBtn.textContent = originalText;
                }
            } else {
                if (welcomeSyncStatus) {
                    welcomeSyncStatus.textContent = translate('alerts.invalidUserId');
                    welcomeSyncStatus.classList.remove('success');
                    welcomeSyncStatus.classList.add('error');
                    welcomeSyncStatus.style.display = 'block';
                    welcomeSyncStatus.classList.add('show');
                }
                welcomeSyncInput.classList.add('input-error');

                welcomeSyncInput.classList.remove('shake');
                void welcomeSyncInput.offsetWidth;
                welcomeSyncInput.classList.add('shake');
            }
        });
    }

    const validateWelcomeInput = () => {
        if (!welcomeSyncInput) return;
        let val = welcomeSyncInput.value.trim();
        if (val.includes('userId=')) {
            try {
                const url = new URL(val);
                const userId = url.searchParams.get('userId');
                if (userId) {
                    val = userId;
                    welcomeSyncInput.value = userId;
                }
            } catch (err) {
                // Ignore URL parse failures
            }
        }

        updateLinkBtnText();

        const submitBtn = document.getElementById('welcome-submit-btn');
        if (submitBtn && welcomeState.cameFromSyncStartBtn) {
            const currentUserId = localStorage.getItem('oreCalc_userId');
            submitBtn.disabled = !(isValidUUID(val) && val !== currentUserId);
        }

        if (val === '') {
            if (welcomeSyncStatus) {
                welcomeSyncStatus.textContent = '';
                welcomeSyncStatus.style.display = 'none';
                welcomeSyncStatus.classList.remove('show');
            }
            welcomeSyncInput.classList.remove('input-error');
        } else if (isValidUUID(val)) {
            const currentUserId = localStorage.getItem('oreCalc_userId');
            if (val === currentUserId) {
                if (welcomeSyncStatus) {
                    welcomeSyncStatus.textContent = translate('alerts.sameUserId');
                    welcomeSyncStatus.classList.remove('success');
                    welcomeSyncStatus.classList.add('error');
                    welcomeSyncStatus.style.display = 'block';
                    welcomeSyncStatus.classList.add('show');
                }
                welcomeSyncInput.classList.add('input-error');
            } else {
                if (welcomeSyncStatus) {
                    welcomeSyncStatus.textContent = translate('alerts.validUserId');
                    welcomeSyncStatus.classList.remove('error');
                    welcomeSyncStatus.classList.add('success');
                    welcomeSyncStatus.style.display = 'block';
                    welcomeSyncStatus.classList.add('show');
                }
                welcomeSyncInput.classList.remove('input-error');
            }
        } else if (val.length < 36) {
            if (welcomeSyncStatus) {
                welcomeSyncStatus.textContent = translate('alerts.incompleteUserId');
                welcomeSyncStatus.classList.remove('success');
                welcomeSyncStatus.classList.add('error');
                welcomeSyncStatus.style.display = 'block';
                welcomeSyncStatus.classList.add('show');
            }
            welcomeSyncInput.classList.add('input-error');
        } else {
            if (welcomeSyncStatus) {
                welcomeSyncStatus.textContent = translate('alerts.invalidUserId');
                welcomeSyncStatus.classList.remove('success');
                welcomeSyncStatus.classList.add('error');
                welcomeSyncStatus.style.display = 'block';
                welcomeSyncStatus.classList.add('show');
            }
            welcomeSyncInput.classList.add('input-error');
        }
    };

    if (welcomeSyncInput) {
        welcomeSyncInput.addEventListener('input', validateWelcomeInput);
    }

    const cloudSyncPref = document.getElementById('welcome-pref-cloud-sync');
    if (cloudSyncPref) {
        cloudSyncPref.addEventListener('change', () => {
            state.uiSettings.cloudSync = cloudSyncPref.checked;
            updateWelcomeSyncState();
        });
    }

    updateLinkBtnText();
    isWelcomeSyncListenersInitialized = true;
}
