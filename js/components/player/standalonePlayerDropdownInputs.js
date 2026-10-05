import { translate } from '../../i18n/translator.js';
import { getSavedProfiles, removePlayerTag } from '../../core/playerStorage.js';
import { renderStandalonePlayerDropdown } from './standalonePlayerDropdownDisplay.js';
import { validatePlayerTagInput } from '../../utils/playerTagValidator.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';
import { getAddPlayerHelpContent, hideCardHelpPopover, showCardHelpPopover } from '../../utils/cardHelpPopover.js';
import { closeModalAnimated, openModal } from '../../utils/modalHistoryManager.js';
import { openPrivacyModal, openTermsOfUseModal } from '../appSettings/settingsLegalModals.js';

let isStandalonePlayerDropdownInitialized = false;
let isStandaloneAddPlayerModalInitialized = false;
let lastTouchTime = 0;
/** @type {(() => string) | null} */
let activePlayerTagGetter = null;

/**
 * Opens the standalone player dropdown list and flips chevron up.
 * @param {boolean} [shouldFocusItem=false] - Whether to focus active item.
 */
function openStandalonePlayerDropdown(shouldFocusItem = false) {
    const dropdownList = document.getElementById('player-dropdown-list');
    const dropdownButton = document.getElementById('player-dropdown-button');
    const activeTag = (typeof activePlayerTagGetter === 'function' ? activePlayerTagGetter() : '') || '';
    renderStandalonePlayerDropdown(activeTag);
    if (dropdownList) dropdownList.classList.add('show');
    if (dropdownButton) {
        dropdownButton.classList.add('open');
        dropdownButton.setAttribute('aria-expanded', 'true');
        const arrow = dropdownButton.querySelector('.dropdown-arrow');
        if (arrow) arrow.setAttribute('name', 'chevron-up');
    }
    if (shouldFocusItem) {
        const activeItem = document.querySelector('#player-items-container .player-dropdown-item.active')
            || document.querySelector('#player-items-container .player-dropdown-item');
        if (activeItem) {
            /** @type {HTMLElement} */ (activeItem).focus();
        }
    }
}

/**
 * Closes the standalone player dropdown list and resets chevron down.
 */
function closeStandalonePlayerDropdown() {
    const dropdownList = document.getElementById('player-dropdown-list');
    const dropdownButton = document.getElementById('player-dropdown-button');
    if (dropdownList) dropdownList.classList.remove('show');
    if (dropdownButton) {
        dropdownButton.classList.remove('open');
        dropdownButton.setAttribute('aria-expanded', 'false');
        const arrow = dropdownButton.querySelector('.dropdown-arrow');
        if (arrow) arrow.setAttribute('name', 'chevron-down');
    }
}

/**
 * Initializes standalone player dropdown interactions, account switching, deletion, and keyboard navigation.
 *
 * @param {Object} options
 * @param {(tag: string) => void} options.onSelectPlayer - Callback when a saved profile is selected.
 * @param {(tag: string) => void} options.onDeletePlayer - Callback when a saved profile is deleted.
 * @param {() => void} options.onAddPlayer - Callback when "+ Add Player" is clicked.
 * @param {(() => string) | null} [options.getActivePlayerTag] - Optional getter returning active normalized player tag.
 */
export function initStandalonePlayerDropdown({ onSelectPlayer, onDeletePlayer, onAddPlayer, getActivePlayerTag }) {
    if (getActivePlayerTag) {
        activePlayerTagGetter = getActivePlayerTag;
    }
    if (isStandalonePlayerDropdownInitialized) return;
    isStandalonePlayerDropdownInitialized = true;

    const dropdownButton = document.getElementById('player-dropdown-button');
    const dropdownList = document.getElementById('player-dropdown-list');
    const playerItemsContainer = document.getElementById('player-items-container');
    const addPlayerButton = document.getElementById('add-player-button');
    const playerDropdownContainer = document.querySelector('.player-dropdown-container');

    if (!dropdownButton || !dropdownList || !playerItemsContainer) return;

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('touchstart', () => {
            lastTouchTime = Date.now();
        }, { passive: true });

        document.addEventListener('click', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            if (!target.closest?.('.player-dropdown-container')) {
                closeStandalonePlayerDropdown();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dropdownList.classList.contains('show')) {
                closeStandalonePlayerDropdown();
                dropdownButton.focus();
            }
        });
    }

    dropdownButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (dropdownList.classList.contains('show')) {
            closeStandalonePlayerDropdown();
        } else {
            openStandalonePlayerDropdown(true);
        }
    });

    if (playerDropdownContainer) {
        playerDropdownContainer.addEventListener('mouseenter', () => {
            if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
            if (Date.now() - lastTouchTime < 1000) return;
            if (document.querySelector('.modal.show')) return;
            openStandalonePlayerDropdown();
        });

        playerDropdownContainer.addEventListener('mouseleave', () => {
            if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
            if (Date.now() - lastTouchTime < 1000) return;
            closeStandalonePlayerDropdown();
        });

        playerDropdownContainer.addEventListener('focusin', () => {
            if (Date.now() - lastTouchTime < 1000) return;
            if (document.querySelector('.modal.show')) return;
            if (dropdownList && !dropdownList.classList.contains('show')) {
                openStandalonePlayerDropdown();
            }
        });

        playerDropdownContainer.addEventListener('focusout', (event) => {
            if (Date.now() - lastTouchTime < 1000) return;
            if (event.relatedTarget && !playerDropdownContainer.contains(/** @type {Node} */ (event.relatedTarget))) {
                closeStandalonePlayerDropdown();
            }
        });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('scroll', () => {
            closeStandalonePlayerDropdown();
        }, { passive: true });
    }

    playerItemsContainer.addEventListener('click', async (e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const deleteBtn = target.closest('.delete-player-button, .remove-player-button');
        if (deleteBtn) {
            e.preventDefault();
            e.stopPropagation();
            const tag = deleteBtn.getAttribute('data-tag');
            if (tag) {
                const savedProfiles = getSavedProfiles();
                if (savedProfiles.length <= 1) {
                    closeStandalonePlayerDropdown();
                    await showAlert(
                        translate('alerts.cannotDeleteLastProfile'),
                        'status.info'
                    );
                    return;
                }

                const confirmed = await showConfirm(
                    translate('confirms.deleteProfile'),
                    'actions.confirm',
                    'actions.delete'
                );
                if (confirmed) {
                    removePlayerTag(tag);
                    onDeletePlayer(tag);
                }
            }
            return;
        }

        const item = target.closest('.player-dropdown-item');
        if (item) {
            e.preventDefault();
            const tag = item.getAttribute('data-tag');
            if (tag) {
                closeStandalonePlayerDropdown();
                onSelectPlayer(tag);
            }
        }
    });

    if (addPlayerButton) {
        addPlayerButton.addEventListener('click', (e) => {
            e.preventDefault();
            closeStandalonePlayerDropdown();
            onAddPlayer();
        });
    }

    dropdownList.addEventListener('keydown', (e) => {
        const items = Array.from(dropdownList.querySelectorAll('.player-dropdown-item, .add-player-button'));
        const activeIndex = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));

        if (e.key === 'Enter' || e.key === ' ') {
            const activeEl = /** @type {HTMLElement} */ (document.activeElement);
            if (activeEl?.classList?.contains('player-dropdown-item')) {
                e.preventDefault();
                activeEl.click();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = Math.min(items.length - 1, activeIndex + 1);
            /** @type {HTMLElement} */ (items[nextIndex])?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activeIndex <= 0) {
                closeStandalonePlayerDropdown();
                dropdownButton.focus();
            } else {
                /** @type {HTMLElement} */ (items[activeIndex - 1])?.focus();
            }
        } else if (e.key === 'Home') {
            e.preventDefault();
            /** @type {HTMLElement} */ (items[0])?.focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            /** @type {HTMLElement} */ (items.at(-1))?.focus();
        }
    });
}

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
