import { translate } from '../../i18n/translator.js';

import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../core/stateManager.js';

import { logger } from '../../utils/logger.js';
import { closeModalAnimated } from '../../utils/modalHistoryManager.js';
import { renderSyncQRCode } from '../../utils/qrCodeHelper.js';
import { isValidUUID } from '../../utils/uuidGenerator.js';

import { dom } from '../../dom/domElements.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';
import { showToast } from '../../ui/toast.js';

/**
 * Manages animated expanding and collapsing behavior for `<details>` accordion elements.
 */
export class Accordion {
    /**
     * @param {HTMLDetailsElement|HTMLElement} el
     */
    constructor(el) {
        this.el = /** @type {HTMLDetailsElement} */ (el);
        this.summary = el.querySelector('summary');
        this.content = el.querySelector('.details-content');

        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.el.classList.toggle('is-open', this.el.open);

        const icon = this.summary?.querySelector('orecalc-assets-svg.chevron');
        if (icon) {
            icon.setAttribute('name', this.el.open ? 'chevron-up' : 'chevron-down');
        }

        this.summary?.addEventListener('click', (e) => this.onClick(e));
    }

    /**
     * @param {MouseEvent} e
     */
    onClick(e) {
        e.preventDefault();
        if (this.isClosing || this.isExpanding) return;

        if (this.el.open) {
            const allDetails = this.el.parentElement?.querySelectorAll('details.sync-section') || [];
            const openDetails = Array.from(allDetails).filter(d => /** @type {HTMLDetailsElement} */ (d).open);
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
        this.el.classList.remove('is-open');

        const icon = this.summary?.querySelector('orecalc-assets-svg.chevron');
        if (icon) {
            icon.setAttribute('name', 'chevron-down');
        }

        document.dispatchEvent(new CustomEvent('deviceSyncStateChange'));

        const startHeight = `${this.el.offsetHeight}px`;
        const endHeight = `${this.summary ? this.summary.offsetHeight : 0}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 250,
            easing: 'ease-out'
        });

        this.animation.onfinish = () => this.onAnimationFinish(false);
        this.animation.oncancel = () => { this.isClosing = false; };
    }

    async open() {
        const allDetails = this.el.parentElement?.querySelectorAll('details.sync-section') || [];
        allDetails.forEach(other => {
            const otherEl = /** @type {HTMLDetailsElement & { _accordionInstance?: Accordion }} */ (other);
            if (otherEl !== this.el && otherEl.open) {
                const otherAccordion = otherEl._accordionInstance;
                if (otherAccordion) {
                    otherAccordion.shrink();
                } else {
                    otherEl.open = false;
                    otherEl.classList.remove('is-open');
                    const otherIcon = otherEl.querySelector('orecalc-assets-svg.chevron');
                    if (otherIcon) {
                        otherIcon.setAttribute('name', 'chevron-down');
                    }
                }
            }
        });

        this.el.style.height = `${this.el.offsetHeight}px`;
        this.el.open = true;
        this.el.classList.add('is-open');

        const icon = this.summary?.querySelector('orecalc-assets-svg.chevron');
        if (icon) {
            icon.setAttribute('name', 'chevron-up');
        }

        document.dispatchEvent(new CustomEvent('deviceSyncStateChange'));

        window.requestAnimationFrame(() => this.expand());
    }

    expand() {
        this.isExpanding = true;
        const startHeight = `${this.el.offsetHeight}px`;
        const summaryHeight = this.summary ? this.summary.offsetHeight : 0;
        const contentHeight = this.content ? this.content.offsetHeight : 0;
        const endHeight = `${summaryHeight + contentHeight}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 250,
            easing: 'ease-out'
        });

        this.animation.onfinish = () => this.onAnimationFinish(true);
        this.animation.oncancel = () => { this.isExpanding = false; };
    }

    /**
     * @param {boolean} open
     */
    onAnimationFinish(open) {
        this.el.open = open;
        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.el.style.height = '';
    }
}

/**
 * Initializes device sync modals, QR code renderer, and link device actions.
 */
export function initializeDeviceSyncInputs() {
    const {
        deviceSyncBtn,
        deviceSyncModal,
        closeDeviceSyncModalBtn,
        deviceSyncUserIdDisplay,
        deviceSyncCopyBtn,
        deviceSyncQrContainer,
        deviceSyncInput,
        deviceSyncStatus,
        cancelDeviceSyncBtn,
        confirmDeviceSyncBtn,
        cloudSyncToggle
    } = dom.appSettings || {};
    const overlay = dom.overlay;

    const updateConfirmButtonVisibility = () => {
        if (!confirmDeviceSyncBtn) return;
        const linkSection = deviceSyncModal ? deviceSyncModal.querySelectorAll('details.sync-section')[1] : null;
        const isSection2Open = linkSection ? linkSection.classList.contains('is-open') : false;

        if (isSection2Open) {
            confirmDeviceSyncBtn.classList.remove('hidden');
            const inputValue = deviceSyncInput ? deviceSyncInput.value.trim() : '';
            const currentUserId = localStorage.getItem('oreCalc_userId');
            confirmDeviceSyncBtn.disabled = !(isValidUUID(inputValue) && inputValue !== currentUserId);
        } else {
            confirmDeviceSyncBtn.classList.add('hidden');
        }
    };

    document.addEventListener('deviceSyncStateChange', updateConfirmButtonVisibility);

    if (deviceSyncBtn && deviceSyncModal && overlay) {
        deviceSyncBtn.addEventListener('click', async () => {
            if (state.uiSettings.cloudSync === false) {
                const enableSync = await showConfirm(
                    translate('alerts.enableCloudSyncToCopy'),
                    'status.info',
                    'actions.enableAndCopy'
                );
                if (enableSync) {
                    handleStateUpdate(() => {
                        state.uiSettings.cloudSync = true;
                    });
                    const toggleEl = cloudSyncToggle || /** @type {HTMLInputElement|null} */ (document.getElementById('settings-cloud-sync-toggle'));
                    if (toggleEl) {
                        toggleEl.checked = true;
                    }
                } else {
                    return;
                }
            }

            const userId = localStorage.getItem('oreCalc_userId');
            if (userId && deviceSyncUserIdDisplay) {
                deviceSyncUserIdDisplay.textContent = userId;
                deviceSyncUserIdDisplay.dataset.fullId = userId;

                if (deviceSyncQrContainer) {
                    renderSyncQRCode(deviceSyncQrContainer, userId, 250);
                }
            }

            let clipboardHasValidId = false;
            if (deviceSyncInput) {
                deviceSyncInput.value = '';
                try {
                    const clipboardText = await navigator.clipboard.readText();
                    if (clipboardText) {
                        const trimmed = clipboardText.trim();
                        if (isValidUUID(trimmed) && trimmed !== userId) {
                            clipboardHasValidId = true;
                            deviceSyncInput.value = trimmed;
                            if (deviceSyncStatus) {
                                deviceSyncStatus.textContent = translate('alerts.uuidDetected');
                                deviceSyncStatus.classList.remove('error');
                                deviceSyncStatus.classList.add('success');
                                deviceSyncStatus.classList.add('show');
                            }
                        }
                    }
                } catch (err) {
                    logger.warn('Clipboard read failed or denied');
                }
            }

            if (deviceSyncModal) {
                const syncDetails = deviceSyncModal.querySelectorAll('details.sync-section');
                const hasNoProfiles = !state.savedPlayerTags || state.savedPlayerTags.length === 0 || (state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0');
                const shouldOpenSecondSection = clipboardHasValidId || hasNoProfiles;

                syncDetails.forEach((details, idx) => {
                    const detailsEl = /** @type {HTMLDetailsElement} */ (details);
                    detailsEl.open = shouldOpenSecondSection ? (idx === 1) : (idx === 0);
                    detailsEl.classList.toggle('is-open', detailsEl.open);
                    detailsEl.style.height = '';
                });

                if (shouldOpenSecondSection && deviceSyncInput) {
                    setTimeout(() => {
                        deviceSyncInput.focus();
                    }, 50);
                }
            }

            deviceSyncModal.classList.add('show');
            overlay.classList.add('show');
            updateConfirmButtonVisibility();
        });
    }

    if (deviceSyncModal) {
        const syncDetails = deviceSyncModal.querySelectorAll('details.sync-section');
        syncDetails.forEach(details => {
            const detailsEl = /** @type {HTMLDetailsElement & { _accordionInstance?: Accordion }} */ (details);
            detailsEl._accordionInstance = new Accordion(detailsEl);
        });
    }

    const handleCopySyncCode = async () => {
        const hasOnlyDefaultPlayer = state.savedPlayerTags.length === 1 && state.savedPlayerTags[0] === 'DEFAULT0';
        if (hasOnlyDefaultPlayer) {
            await showAlert(translate('views.settings.noPlayerForCopy'));
            return;
        }

        const userId = localStorage.getItem('oreCalc_userId');
        if (!userId) return;

        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            await showAlert(translate('alerts.clipboardUnsupported'));
            return;
        }

        try {
            await navigator.clipboard.writeText(userId);

            if (deviceSyncCopyBtn) {
                deviceSyncCopyBtn.classList.add('success');
                const textElem = deviceSyncCopyBtn.querySelector('.animated-btn-text');
                const originalText = textElem ? textElem.textContent : '';
                if (textElem) {
                    textElem.textContent = translate('actions.copied');
                }
                setTimeout(() => {
                    deviceSyncCopyBtn.classList.remove('success');
                    if (textElem) {
                        textElem.textContent = originalText;
                    }
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

    if (deviceSyncUserIdDisplay) {
        deviceSyncUserIdDisplay.setAttribute('tabindex', '0');
        deviceSyncUserIdDisplay.setAttribute('role', 'button');
        deviceSyncUserIdDisplay.setAttribute('aria-label', translate('actions.copy'));
        deviceSyncUserIdDisplay.addEventListener('click', handleCopySyncCode);
        deviceSyncUserIdDisplay.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCopySyncCode();
            }
        });
    }
    if (deviceSyncCopyBtn) {
        deviceSyncCopyBtn.addEventListener('click', handleCopySyncCode);
    }

    const closeDeviceSyncModal = () => {
        if (deviceSyncModal) {
            const resetAccordionState = () => {
                const syncDetails = deviceSyncModal.querySelectorAll('details.sync-section');
                syncDetails.forEach((details, idx) => {
                    const detailsEl = /** @type {HTMLDetailsElement & { _accordionInstance?: Accordion }} */ (details);
                    detailsEl.open = (idx === 0);
                    detailsEl.classList.toggle('is-open', idx === 0);
                    detailsEl.style.height = '';
                    if (detailsEl._accordionInstance) {
                        if (detailsEl._accordionInstance.animation) {
                            detailsEl._accordionInstance.animation.cancel();
                        }
                        detailsEl._accordionInstance.isClosing = false;
                        detailsEl._accordionInstance.isExpanding = false;
                    }
                });
                if (deviceSyncInput) {
                    deviceSyncInput.value = '';
                    deviceSyncInput.classList.remove('input-error');
                }
                if (deviceSyncStatus) {
                    deviceSyncStatus.textContent = '';
                    deviceSyncStatus.className = 'status-message';
                }
                if (confirmDeviceSyncBtn) {
                    confirmDeviceSyncBtn.disabled = false;
                    confirmDeviceSyncBtn.textContent = translate('actions.linkDevice');
                }
            };

            closeModalAnimated(deviceSyncModal, resetAccordionState);
        }
    };

    closeDeviceSyncModalBtn?.addEventListener('click', closeDeviceSyncModal);
    cancelDeviceSyncBtn?.addEventListener('click', closeDeviceSyncModal);
    overlay?.addEventListener('click', () => {
        if (deviceSyncModal && deviceSyncModal.classList.contains('show')) {
            closeDeviceSyncModal();
        }
    });

    confirmDeviceSyncBtn?.addEventListener('click', async () => {
        if (!deviceSyncInput) return;
        const val = deviceSyncInput.value.trim();
        if (isValidUUID(val)) {
            const originalText = confirmDeviceSyncBtn.textContent;
            try {
                confirmDeviceSyncBtn.disabled = true;
                confirmDeviceSyncBtn.textContent = translate('actions.processing');

                const { importUserData } = await import('../../services/cloudSaveService.js');
                await importUserData(val);
            } finally {
                confirmDeviceSyncBtn.disabled = false;
                confirmDeviceSyncBtn.textContent = originalText;
            }
        } else {
            if (deviceSyncStatus) {
                deviceSyncStatus.textContent = translate('alerts.invalidUserId');
                deviceSyncStatus.classList.remove('success');
                deviceSyncStatus.classList.add('error');
                deviceSyncStatus.classList.add('show');
            }
            deviceSyncInput.classList.add('input-error');

            deviceSyncInput.classList.remove('shake');
            void deviceSyncInput.offsetWidth;
            deviceSyncInput.classList.add('shake');
        }
    });

    const validateInput = () => {
        if (!deviceSyncInput) return;
        let val = deviceSyncInput.value.trim();
        if (val.includes('userId=')) {
            try {
                const url = new URL(val);
                const extractedId = url.searchParams.get('userId');
                if (extractedId) {
                    val = extractedId;
                    deviceSyncInput.value = val;
                }
            } catch (e) {
                const match = val.match(/userId=([a-f0-9-]+)/i);
                if (match && match[1]) {
                    val = match[1];
                    deviceSyncInput.value = val;
                }
            }
        }

        const currentUserId = localStorage.getItem('oreCalc_userId');

        if (!val) {
            if (deviceSyncStatus) {
                deviceSyncStatus.textContent = '';
                deviceSyncStatus.className = 'status-message';
            }
            deviceSyncInput.classList.remove('input-error');
        } else if (isValidUUID(val)) {
            if (val === currentUserId) {
                if (deviceSyncStatus) {
                    deviceSyncStatus.textContent = translate('alerts.sameUserId');
                    deviceSyncStatus.classList.remove('success');
                    deviceSyncStatus.classList.add('error');
                    deviceSyncStatus.classList.add('show');
                }
                deviceSyncInput.classList.add('input-error');
            } else {
                if (deviceSyncStatus) {
                    deviceSyncStatus.textContent = translate('alerts.validUserId');
                    deviceSyncStatus.classList.remove('error');
                    deviceSyncStatus.classList.add('success');
                    deviceSyncStatus.classList.add('show');
                }
                deviceSyncInput.classList.remove('input-error');
            }
        } else {
            if (deviceSyncStatus) {
                deviceSyncStatus.textContent = translate('alerts.invalidUserId');
                deviceSyncStatus.classList.remove('success');
                deviceSyncStatus.classList.add('error');
                deviceSyncStatus.classList.add('show');
            }
            deviceSyncInput.classList.add('input-error');
        }
        updateConfirmButtonVisibility();
    };

    deviceSyncInput?.addEventListener('input', validateInput);
    deviceSyncInput?.addEventListener('focus', validateInput);
    deviceSyncInput?.addEventListener('blur', validateInput);
}
