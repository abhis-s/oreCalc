import { translate } from '../../i18n/translator.js';

import { removePlayerTag } from '../../core/localStorageManager.js';
import { state } from '../../core/state.js';
import { handleStateUpdate, switchActivePlayer } from '../../core/stateManager.js';

import { invalidatePlayerDropdownCache, renderPlayerDropdown } from './playerDropdownDisplay.js';
import { showAddPlayerModal } from './playerModalInputs.js';
import { dom } from '../../dom/domElements.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';

let lastTouchTime = 0;
let isPlayerDropdownInitialized = false;

/**
 * Opens the player selection dropdown menu and flips chevron icon up.
 */
export function openDropdown() {
    const dropdownList = dom.player?.dropdownList;
    const dropdownButton = dom.player?.dropdownButton;
    if (dropdownList) dropdownList.classList.add('show');
    if (dropdownButton) {
        dropdownButton.classList.add('open');
        const arrow = dropdownButton.querySelector('.dropdown-arrow');
        if (arrow) arrow.setAttribute('name', 'chevron-up');
    }
}

/**
 * Closes the player selection dropdown menu and resets chevron icon down.
 */
export function closeDropdown() {
    const dropdownList = dom.player?.dropdownList;
    const dropdownButton = dom.player?.dropdownButton;
    if (dropdownList) dropdownList.classList.remove('show');
    if (dropdownButton) {
        dropdownButton.classList.remove('open');
        const arrow = dropdownButton.querySelector('.dropdown-arrow');
        if (arrow) arrow.setAttribute('name', 'chevron-down');
    }
}

/**
 * Handles switching the active player profile and recalculates calendar chip schedules.
 * @param {string} tag - Selected player tag.
 */
export function handlePlayerSelection(tag) {
    switchActivePlayer(tag);

    // Auto place chips for the newly selected active player to keep the calendar fully up to date
    import('../../utils/autoPlaceChips.js').then(({ autoPlaceIncomeChipsForRange }) => {
        import('../../utils/dateUtils.js').then(({ getMinDate, getMaxDate }) => {
            const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
            const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();
            autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR, true);
            handleStateUpdate(() => {
                if (state.planner?.calendar) {
                    state.planner.calendar.isHydrated = true;
                }
            }, false);
        });
    });

    invalidatePlayerDropdownCache();
    renderDropdown();
}

/**
 * Prompts for confirmation and deletes a saved player profile from storage and state.
 * @param {string} tagToDelete - Player tag to remove.
 * @returns {Promise<void>}
 */
export async function handleDeletePlayer(tagToDelete) {
    const validSavedTags = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
    if (validSavedTags.length <= 1) {
        await showAlert(
            translate('alerts.cannotDeleteLastProfile'),
            'status.info'
        );
        return;
    }

    const confirmed = await showConfirm(
        translate('confirms.deleteProfile'),
        'status.confirm',
        'actions.delete'
    );
    if (confirmed) {
        const wasActive = state.savedPlayerTags[0] === tagToDelete;
        removePlayerTag(tagToDelete);

        if (wasActive) {
            const nextTag = state.savedPlayerTags[0];
            if (nextTag) {
                switchActivePlayer(nextTag);
                import('../../utils/autoPlaceChips.js').then(({ autoPlaceIncomeChipsForRange }) => {
                    import('../../utils/dateUtils.js').then(({ getMinDate, getMaxDate }) => {
                        const { month: MIN_MONTH, year: MIN_YEAR } = getMinDate();
                        const { month: MAX_MONTH, year: MAX_YEAR } = getMaxDate();
                        autoPlaceIncomeChipsForRange(MIN_MONTH, MIN_YEAR, MAX_MONTH, MAX_YEAR, true);
                        handleStateUpdate(() => {
                            if (state.planner?.calendar) {
                                state.planner.calendar.isHydrated = true;
                            }
                        }, false);
                    });
                });
            }
        } else {
            handleStateUpdate(() => {}, false);
        }

        invalidatePlayerDropdownCache();
        renderDropdown();
    }
}

/**
 * Triggers re-rendering of the player selection dropdown menu.
 */
export function renderDropdown() {
    renderPlayerDropdown();
}

/**
 * Initializes player dropdown click listeners, touch handling, and keyboard interactions.
 */
export function initializePlayerDropdown() {
    if (isPlayerDropdownInitialized) return;
    isPlayerDropdownInitialized = true;

    document.addEventListener('touchstart', () => {
        lastTouchTime = Date.now();
    }, { passive: true });

    const dropdownButton = dom.player?.dropdownButton;
    const addPlayerButton = dom.player?.addPlayerButton;
    const playerItemsContainer = dom.player?.playerItemsContainer;

    if (playerItemsContainer) {
        playerItemsContainer.addEventListener('click', (event) => {
            const deleteBtn = /** @type {HTMLElement} */ (event.target)?.closest?.('.delete-player-button');
            if (deleteBtn) {
                event.stopPropagation();
                const tagToDelete = deleteBtn.dataset.tag;
                if (tagToDelete) handleDeletePlayer(tagToDelete);
                return;
            }
            const item = /** @type {HTMLElement} */ (event.target)?.closest?.('.player-dropdown-item');
            if (item) {
                const tag = item.dataset.tag;
                if (tag) {
                    handlePlayerSelection(tag);
                    closeDropdown();
                }
            }
        });

        playerItemsContainer.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                const deleteBtn = /** @type {HTMLElement} */ (event.target)?.closest?.('.delete-player-button');
                if (deleteBtn) return;
                const item = /** @type {HTMLElement} */ (event.target)?.closest?.('.player-dropdown-item');
                if (item) {
                    event.preventDefault();
                    const tag = item.dataset.tag;
                    if (tag) {
                        handlePlayerSelection(tag);
                        closeDropdown();
                    }
                }
            }
        });
    }

    if (dropdownButton) {
        dropdownButton.addEventListener('click', () => {
            const dropdownList = dom.player?.dropdownList;
            if (dropdownList) {
                if (dropdownList.classList.contains('show')) {
                    closeDropdown();
                } else {
                    openDropdown();
                }
            }
        });
    }

    if (addPlayerButton) {
        addPlayerButton.addEventListener('click', () => {
            showAddPlayerModal();
            closeDropdown();
        });
    }

    document.addEventListener('click', (event) => {
        if (/** @type {HTMLElement} */ (event.target)?.closest?.('#home-profile-connect-btn')) {
            showAddPlayerModal();
        }
    });

    document.addEventListener('click', (event) => {
        const dropdownList = dom.player?.dropdownList;
        const dropdownButton = dom.player?.dropdownButton;
        if (dropdownList && dropdownList.classList.contains('show')) {
            const isClickInsideDropdownButton = dropdownButton && dropdownButton.contains(event.target);
            const isClickInsideDropdownList = dropdownList.contains(event.target);

            if (!isClickInsideDropdownButton && !isClickInsideDropdownList) {
                closeDropdown();
            }
        }
    });

    window.addEventListener('scroll', () => {
        closeDropdown();
    }, { passive: true });

    const playerDropdownContainer = document.querySelector('.player-dropdown-container');
    if (playerDropdownContainer) {
        playerDropdownContainer.addEventListener('mouseenter', () => {
            if (!window.matchMedia('(hover: hover)').matches) return;
            if (document.body.classList.contains('tour-active')) return;
            if (Date.now() - lastTouchTime < 1000) return;
            if (document.querySelector('.modal.show')) return;
            openDropdown();
        });

        playerDropdownContainer.addEventListener('mouseleave', () => {
            if (!window.matchMedia('(hover: hover)').matches) return;
            if (document.body.classList.contains('tour-active')) return;
            if (Date.now() - lastTouchTime < 1000) return;
            closeDropdown();
        });

        playerDropdownContainer.addEventListener('focusin', () => {
            if (document.body.classList.contains('tour-active')) return;
            if (Date.now() - lastTouchTime < 1000) return;
            if (document.querySelector('.modal.show')) return;
            openDropdown();
        });

        playerDropdownContainer.addEventListener('focusout', (event) => {
            if (document.body.classList.contains('tour-active')) return;
            if (Date.now() - lastTouchTime < 1000) return;
            if (!playerDropdownContainer.contains(event.relatedTarget)) {
                closeDropdown();
            }
        });
    }
}
