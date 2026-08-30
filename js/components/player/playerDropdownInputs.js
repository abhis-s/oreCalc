import { translate } from '../../i18n/translator.js';

import { loadPlayerData, normalizePlayerTag, removePlayerTag, updateSavedPlayerTags } from '../../core/localStorageManager.js';
import { removeRecentSearch } from '../../core/recentSearchesManager.js';
import { syncPlayerTagToUrl } from '../../core/playerUrlRouter.js';
import { state } from '../../core/state.js';
import { handleStateUpdate, switchActivePlayer } from '../../core/stateManager.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';

import { invalidatePlayerDropdownCache, renderPlayerDropdown, toggleMainAppRecentCollapsed } from './playerDropdownDisplay.js';
import { showAddPlayerModal } from './playerModalInputs.js';
import { dom } from '../../dom/domElements.js';
import { showAlert, showConfirm } from '../../ui/noticeModal.js';

let lastTouchTime = 0;
let isPlayerDropdownInitialized = false;

/**
 * Opens the player selection dropdown menu and flips chevron icon up.
 * @param {boolean} [shouldFocusItem=false] - Whether to focus active item.
 */
export function openDropdown(shouldFocusItem = false) {
    renderPlayerDropdown();
    const dropdownList = dom.player?.dropdownList;
    const dropdownButton = dom.player?.dropdownButton;
    if (dropdownList) dropdownList.classList.add('show');
    if (dropdownButton) {
        dropdownButton.classList.add('open');
        const arrow = dropdownButton.querySelector('.dropdown-arrow');
        if (arrow) arrow.setAttribute('name', 'chevron-up');
    }
    if (shouldFocusItem && dom.player?.playerItemsContainer) {
        const activeItem = dom.player.playerItemsContainer.querySelector('.player-dropdown-item.active')
            || dom.player.playerItemsContainer.querySelector('.player-dropdown-item')
            || dom.player.playerItemsContainer.querySelector('.player-dropdown-section-header--collapsible');
        if (activeItem) {
            /** @type {HTMLElement} */ (activeItem).focus();
        }
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
export async function handlePlayerSelection(tag) {
    const cleanTag = normalizePlayerTag(tag);
    if (!cleanTag) return;

    // Immediately remove from recent searches if present
    removeRecentSearch(cleanTag);

    // If not yet in memory state, attempt to load cached partition
    if (!state.allPlayersData[cleanTag] || !state.allPlayersData[cleanTag].heroes) {
        const cached = loadPlayerData(cleanTag);
        if (cached && cached.heroes) {
            state.allPlayersData[cleanTag] = cached;
        }
    }

    if (state.allPlayersData[cleanTag]?.heroes) {
        updateSavedPlayerTags(cleanTag);
        switchActivePlayer(cleanTag);
        syncPlayerTagToUrl(cleanTag);
    } else {
        await loadAndProcessPlayerData(cleanTag);
        syncPlayerTagToUrl(cleanTag);
    }

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
    const validSavedTags = state.savedPlayerTags
        .map(tag => normalizePlayerTag(tag))
        .filter(tag => tag && tag !== 'DEFAULT0');
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
        const wasActive = normalizePlayerTag(state.savedPlayerTags[0]) === normalizePlayerTag(tagToDelete);
        removePlayerTag(tagToDelete);

        if (wasActive) {
            const nextTag = state.savedPlayerTags[0];
            if (nextTag) {
                switchActivePlayer(nextTag);
                syncPlayerTagToUrl(nextTag);
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
 * Renders the player dropdown UI elements.
 */
export function renderDropdown() {
    renderPlayerDropdown({
        onSelectPlayer: handlePlayerSelection,
        onDeletePlayer: handleDeletePlayer
    });
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
        const handleSectionHeaderInteraction = (event) => {
            const collapsibleHeader = /** @type {HTMLElement} */ (event.target)?.closest?.('.player-dropdown-section-header--collapsible');
            if (collapsibleHeader) {
                event.preventDefault();
                event.stopPropagation();
                toggleMainAppRecentCollapsed();
                return true;
            }
            const sectionHeader = /** @type {HTMLElement} */ (event.target)?.closest?.('.player-dropdown-section-header');
            if (sectionHeader) {
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
            return false;
        };

        playerItemsContainer.addEventListener('mousedown', (event) => {
            handleSectionHeaderInteraction(event);
        });

        playerItemsContainer.addEventListener('click', (event) => {
            if (handleSectionHeaderInteraction(event)) return;

            const dismissBtn = /** @type {HTMLElement} */ (event.target)?.closest?.('.dismiss-recent-button');
            if (dismissBtn) {
                event.preventDefault();
                event.stopPropagation();
                const tagToDismiss = dismissBtn.dataset.tag;
                if (tagToDismiss) {
                    removeRecentSearch(tagToDismiss);
                    invalidatePlayerDropdownCache();
                    renderDropdown();
                }
                return;
            }

            const deleteBtn = /** @type {HTMLElement} */ (event.target)?.closest?.('.delete-player-button, .remove-player-button');
            if (deleteBtn) {
                event.preventDefault();
                event.stopPropagation();
                const tagToDelete = deleteBtn.dataset.tag;
                if (tagToDelete) handleDeletePlayer(tagToDelete);
                return;
            }
            const item = /** @type {HTMLElement} */ (event.target)?.closest?.('.player-dropdown-item');
            if (item) {
                const tag = item.dataset.tag;
                if (tag) {
                    if (!state.allPlayersData[tag]) {
                        const cached = loadPlayerData(tag);
                        if (cached) {
                            state.allPlayersData[tag] = cached;
                        }
                    }
                    handlePlayerSelection(tag);
                    closeDropdown();
                }
            }
        });

        const getNavigableRows = () => {
            const rows = Array.from(playerItemsContainer.querySelectorAll('.player-dropdown-item, .player-dropdown-section-header--collapsible'));
            if (addPlayerButton) rows.push(addPlayerButton);
            return rows;
        };

        const handleDropdownKeyNavigation = (event) => {
            const target = /** @type {HTMLElement} */ (event.target);
            const currentRow = target?.closest?.('.player-dropdown-item, .player-dropdown-section-header--collapsible, #add-player-btn');
            if (!currentRow) return;

            const rows = getNavigableRows();
            const currentIndex = rows.indexOf(currentRow);

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                const nextIndex = Math.min(rows.length - 1, currentIndex + 1);
                if (nextIndex !== currentIndex && rows[nextIndex]) {
                    currentRow.setAttribute('tabindex', '-1');
                    rows[nextIndex].setAttribute('tabindex', '0');
                    rows[nextIndex].focus();
                    if (typeof rows[nextIndex].scrollIntoView === 'function') {
                        rows[nextIndex].scrollIntoView({ block: 'nearest' });
                    }
                }
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (currentIndex <= 0) {
                    closeDropdown();
                    dom.player?.dropdownButton?.focus();
                } else {
                    const prevIndex = currentIndex - 1;
                    if (rows[prevIndex]) {
                        currentRow.setAttribute('tabindex', '-1');
                        rows[prevIndex].setAttribute('tabindex', '0');
                        rows[prevIndex].focus();
                        if (typeof rows[prevIndex].scrollIntoView === 'function') {
                            rows[prevIndex].scrollIntoView({ block: 'nearest' });
                        }
                    }
                }
            } else if (event.key === 'Home') {
                event.preventDefault();
                if (rows[0]) {
                    currentRow.setAttribute('tabindex', '-1');
                    rows[0].setAttribute('tabindex', '0');
                    rows[0].focus();
                    if (typeof rows[0].scrollIntoView === 'function') {
                        rows[0].scrollIntoView({ block: 'nearest' });
                    }
                }
            } else if (event.key === 'End') {
                event.preventDefault();
                const lastRow = rows.at(-1);
                if (lastRow) {
                    currentRow.setAttribute('tabindex', '-1');
                    lastRow.setAttribute('tabindex', '0');
                    lastRow.focus();
                    if (typeof lastRow.scrollIntoView === 'function') {
                        lastRow.scrollIntoView({ block: 'nearest' });
                    }
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeDropdown();
                dom.player?.dropdownButton?.focus();
            } else if (event.key === 'Delete' || event.key === 'Backspace') {
                const dismissBtn = target?.closest?.('.player-dropdown-item--recent')?.querySelector('.dismiss-recent-button') || target?.closest?.('.dismiss-recent-button');
                if (dismissBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const tagToDismiss = dismissBtn.dataset.tag;
                    if (tagToDismiss) {
                        removeRecentSearch(tagToDismiss);
                        invalidatePlayerDropdownCache();
                        renderDropdown();
                        const nextRows = getNavigableRows();
                        const focusTarget = nextRows[Math.min(currentIndex, nextRows.length - 1)];
                        if (focusTarget) focusTarget.focus();
                    }
                    return;
                }

                const deleteBtn = target?.closest?.('.player-dropdown-item:not(.player-dropdown-item--recent)')?.querySelector('.delete-player-button');
                if (deleteBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const tagToDelete = deleteBtn.dataset.tag;
                    if (tagToDelete && normalizePlayerTag(tagToDelete) !== 'DEFAULT0') {
                        handleDeletePlayer(tagToDelete);
                    }
                    return;
                }
            } else if (event.key === 'Enter' || event.key === ' ') {
                const collapsibleHeader = target?.closest?.('.player-dropdown-section-header--collapsible');
                if (collapsibleHeader) {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleMainAppRecentCollapsed();
                    const newHeader = playerItemsContainer.querySelector('.player-dropdown-section-header--collapsible');
                    if (newHeader) {
                        /** @type {HTMLElement} */ (newHeader).focus();
                    }
                    return;
                }

                const dismissBtn = target?.closest?.('.dismiss-recent-button');
                if (dismissBtn) {
                    event.preventDefault();
                    event.stopPropagation();
                    const tagToDismiss = dismissBtn.dataset.tag;
                    if (tagToDismiss) {
                        removeRecentSearch(tagToDismiss);
                        invalidatePlayerDropdownCache();
                        renderDropdown();
                    }
                    return;
                }

                const deleteBtn = target?.closest?.('.delete-player-button, .remove-player-button');
                if (deleteBtn) return;

                if (target?.closest?.('#add-player-btn')) {
                    event.preventDefault();
                    showAddPlayerModal();
                    closeDropdown();
                    return;
                }

                const item = target?.closest?.('.player-dropdown-item');
                if (item) {
                    event.preventDefault();
                    const tag = item.dataset.tag;
                    if (tag) {
                        if (!state.allPlayersData[tag]) {
                            const cached = loadPlayerData(tag);
                            if (cached) {
                                state.allPlayersData[tag] = cached;
                            }
                        }
                        handlePlayerSelection(tag);
                        closeDropdown();
                        dom.player?.dropdownButton?.focus();
                    }
                }
            }
        };

        playerItemsContainer.addEventListener('keydown', handleDropdownKeyNavigation);
        const dropdownList = dom.player?.dropdownList;
        if (dropdownList && dropdownList !== playerItemsContainer) {
            dropdownList.addEventListener('keydown', handleDropdownKeyNavigation);
        }
    }

    if (dropdownButton) {
        dropdownButton.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const dropdownList = dom.player?.dropdownList;
                if (dropdownList?.classList.contains('show')) {
                    const activeItem = dom.player?.playerItemsContainer?.querySelector('.player-dropdown-item.active')
                        || dom.player?.playerItemsContainer?.querySelector('.player-dropdown-item');
                    if (activeItem) /** @type {HTMLElement} */ (activeItem).focus();
                } else {
                    openDropdown(true);
                }
            }
        });

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

        const collapseBtn = /** @type {HTMLElement} */ (event.target)?.closest?.('#home-profile-collapse-btn');
        if (collapseBtn) {
            const card = document.getElementById('home-player-profile-card');
            if (card) {
                const willBeCollapsed = !card.classList.contains('is-stats-collapsed');
                card.classList.toggle('is-stats-collapsed', willBeCollapsed);
                collapseBtn.setAttribute('aria-expanded', String(!willBeCollapsed));
                const label = willBeCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats');
                collapseBtn.setAttribute('aria-label', label);
                collapseBtn.setAttribute('title', label);
                const icon = collapseBtn.querySelector('.collapse-chevron-icon, orecalc-assets-svg');
                if (icon) {
                    icon.setAttribute('name', willBeCollapsed ? 'chevron-down' : 'chevron-up');
                }
                handleStateUpdate(() => {
                    if (!state.uiSettings) {
                        state.uiSettings = /** @type {any} */ ({});
                    }
                    state.uiSettings.hideProfileStats = willBeCollapsed;
                });
            }
        }
    });

    document.addEventListener('click', (event) => {
        const dropdownList = dom.player?.dropdownList;
        const dropdownButton = dom.player?.dropdownButton;
        if (dropdownList && dropdownList.classList.contains('show')) {
            const isClickInsideDropdownButton = dropdownButton && dropdownButton.contains(event.target);
            const isClickInsideDropdownList = dropdownList.contains(event.target);
            const isConnected = event.target?.isConnected;

            if (!isConnected) return;

            if (!isClickInsideDropdownButton && !isClickInsideDropdownList) {
                closeDropdown();
            }
        }
    });

    document.addEventListener('app:playerDropdownSync', () => {
        invalidatePlayerDropdownCache();
        renderPlayerDropdown();
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
            if (event.relatedTarget && !playerDropdownContainer.contains(event.relatedTarget)) {
                closeDropdown();
            }
        });
    }
}
