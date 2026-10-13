import { translate } from '../../i18n/translator.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';
import { getAddPlayerHelpContent, hideCardHelpPopover, showCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';
import { openPrivacyModal, openTermsOfUseModal } from '../appSettings/settingsLegalModals.js';

let isStandaloneAddPlayerModalInitialized = false;

/**
 * Initializes the Add Player modal for standalone applications.
 *
 * @param {Object} options
 * @param {(tag: string) => Promise<any>} options.onLoadPlayer - Callback to load a player tag.
 * @returns {{ openAddPlayerModal: () => void, closeAddPlayerModal: () => void }} Modal controller methods.
 */
export function initStandaloneAddPlayerModal({ onLoadPlayer }) {
    const modal = /** @type {HTMLDialogElement | null} */ (document.getElementById('add-player-modal'));
    const tagInput = /** @type {HTMLInputElement | null} */ (document.getElementById('player-tag-input-modal'));
    const loadBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('load-player-modal-btn'));
    const cancelBtn = document.getElementById('cancel-add-player-button');
    const closeBtn = document.getElementById('close-add-player-modal-btn');
    const infoBtn = document.getElementById('add-player-modal-info-btn');
    const errorEl = document.getElementById('player-tag-error-message');
    const guidedBtn = /** @type {HTMLElement | null} */ (document.getElementById('add-player-guided-setup-btn'));

    if (guidedBtn) {
        guidedBtn.style.display = 'none';
    }

    const openAddPlayerModal = () => {
        if (!modal) return;
        if (tagInput) {
            tagInput.value = '';
            tagInput.classList.remove('input-error');
        }
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('show');
        }
        if (loadBtn) {
            loadBtn.disabled = true;
            loadBtn.textContent = translate('actions.load') || 'Load';
        }
        openModal(modal);
        tagInput?.focus();
    };

    const closeAddPlayerModal = () => {
        if (!modal) return;
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('show');
        }
        if (tagInput) {
            tagInput.classList.remove('input-error');
        }
        closeModalAnimated(modal);
    };

    if (!isStandaloneAddPlayerModalInitialized && modal && tagInput && loadBtn) {
        isStandaloneAddPlayerModalInitialized = true;

        tagInput.addEventListener('input', (e) => {
            const inputTarget = /** @type {HTMLInputElement} */ (e.target);
            inputTarget.value = inputTarget.value.toUpperCase();
            validatePlayerTagInput(tagInput, errorEl);
            loadBtn.disabled = inputTarget.value.trim().length === 0;
        });

        const handleSubmit = async () => {
            const { cleanedTag, isValid } = validatePlayerTagInput(tagInput, errorEl);
            if (isValid && cleanedTag) {
                const originalText = loadBtn.textContent;
                try {
                    loadBtn.disabled = true;
                    loadBtn.textContent = translate('actions.loading') || 'Loading...';
                    const result = await onLoadPlayer(cleanedTag);
                    if (result?.success !== false) {
                        closeAddPlayerModal();
                    } else {
                        const rawMsg = result?.message || 'apiErrors.notFound';
                        const translatedMsg = translate(rawMsg) || rawMsg;
                        if (errorEl) {
                            errorEl.textContent = translatedMsg;
                            errorEl.classList.add('show');
                        }
                        tagInput.classList.add('input-error');
                        tagInput.classList.remove('shake');
                        void tagInput.offsetWidth;
                        tagInput.classList.add('shake');
                    }
                } catch (err) {
                    const errorMsg = translate('errors.fetchPlayerFailed', { error: err?.message }) || translate('apiErrors.notFound');
                    if (errorEl) {
                        errorEl.textContent = errorMsg;
                        errorEl.classList.add('show');
                    }
                    tagInput.classList.add('input-error');
                    tagInput.classList.remove('shake');
                    void tagInput.offsetWidth;
                    tagInput.classList.add('shake');
                } finally {
                    loadBtn.disabled = false;
                    loadBtn.textContent = originalText;
                }
            } else if (!cleanedTag) {
                if (errorEl) {
                    errorEl.textContent = translate('errors.playerTagRequired') || 'Please enter a player tag';
                    errorEl.classList.add('show');
                }
                tagInput.classList.add('input-error');
            }
        };

        loadBtn.addEventListener('click', handleSubmit);

        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (!loadBtn.disabled) {
                    handleSubmit();
                }
            }
        });

        cancelBtn?.addEventListener('click', closeAddPlayerModal);
        closeBtn?.addEventListener('click', closeAddPlayerModal);

        infoBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            showCardHelpPopover(infoBtn, getAddPlayerHelpContent(), { isToggle: true });
        });
        infoBtn?.addEventListener('pointerenter', (e) => {
            if (e.pointerType === 'touch') return;
            showCardHelpPopover(infoBtn, getAddPlayerHelpContent(), { isToggle: false });
        });
        infoBtn?.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'touch') return;
            hideCardHelpPopover();
        });

        modal.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            if (target.closest('#add-player-terms-link')) {
                e.preventDefault();
                openTermsOfUseModal();
                return;
            }
            if (target.closest('#add-player-privacy-link')) {
                e.preventDefault();
                openPrivacyModal();
                return;
            }
            if (e.target === modal) {
                closeAddPlayerModal();
            }
        });

        if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('show')) {
                    const openModals = Array.from(document.querySelectorAll('.modal.show, dialog.modal[open]'));
                    if (openModals.length > 0 && openModals.at(-1) !== modal) return;
                    closeAddPlayerModal();
                }
            });
        }
    }

    return {
        openAddPlayerModal,
        closeAddPlayerModal
    };
}
