import { translate } from '../../i18n/translator.js';
import { normalizePlayerTag } from '../../core/storageKeys.js';
import { getSavedProfiles, loadPlayerData, removePlayerTag, updateSavedPlayerTags } from '../../core/playerStorage.js';
import { syncPlayerTagToUrl } from '../../core/playerUrlRouter.js';
import { state } from '../../core/state.js';
import { handleStateUpdate, switchActivePlayer } from '../../core/stateManager.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';
import { autoPlaceIncomeChipsForRange } from '../../utils/autoPlaceChips.js';
import { getMaxDate, getMinDate } from '../../utils/dateUtils.js';
import { invalidatePlayerDropdownCache, renderPlayerDropdown } from './playerDropdownDisplay.js';
import { showAddPlayerModal } from './playerModalInputs.js';
import { dom } from '../../dom/domElements.js';
import { showConfirm } from '../../ui/noticeModal.js';
import { showApiErrorToast } from '../../ui/toast.js';
import { isPlayerRefreshStale } from '../../core/playerRefreshThrottler.js';
import { persistAppSettings } from '../common/appSettings.js';
import { refreshActivePlayerData } from './playerRefreshController.js';

let lastTouchTime = 0;
let isPlayerDropdownInitialized = false;

/**
 * Resets player dropdown initialization state and invalidates render cache.
 */
export function resetPlayerDropdownState() {
    isPlayerDropdownInitialized = false;
    invalidatePlayerDropdownCache();
}

/** @type {(() => string) | null} */
let activePlayerTagGetter = null;
/** @type {((tag: string) => void | Promise<void>) | null} */
let customSelectPlayerHandler = null;
/** @type {((tag: string) => void | Promise<void>) | null} */
let customDeletePlayerHandler = null;
/** @type {(() => void) | null} */
let customAddPlayerHandler = null;

/**
 * Resolves player dropdown DOM element references from dom cache or document.
 */
function getDropdownElements() {
    const isElementAttached = (el) => Boolean(el && el.isConnected !== false);
    return {
        dropdownButton: (isElementAttached(dom.player?.dropdownButton) ? dom.player.dropdownButton : null) || (typeof document !== 'undefined' ? document.getElementById('player-dropdown-button') : null),
        dropdownList: (isElementAttached(dom.player?.dropdownList) ? dom.player.dropdownList : null) || (typeof document !== 'undefined' ? document.getElementById('player-dropdown-list') : null),
        playerItemsContainer: (isElementAttached(dom.player?.playerItemsContainer) ? dom.player.playerItemsContainer : null) || (typeof document !== 'undefined' ? document.getElementById('player-items-container') : null),
        addPlayerButton: (isElementAttached(dom.player?.addPlayerButton) ? dom.player.addPlayerButton : null) || (typeof document !== 'undefined' ? document.getElementById('add-player-button') : null),
        container: typeof document !== 'undefined' ? document.querySelector('.player-dropdown-container') : null
    };
}

/**
 * Opens the player selection dropdown menu and flips chevron icon up.
 * @param {boolean} [shouldFocusItem=false] - Whether to focus active item.
 */
export function openDropdown(shouldFocusItem = false) {
    const { dropdownButton, dropdownList, playerItemsContainer } = getDropdownElements();
    const activeTag = (typeof activePlayerTagGetter === 'function' ? activePlayerTagGetter() : state?.savedPlayerTags?.[0]) || '';
    renderPlayerDropdown(activeTag);

    if (dropdownList) dropdownList.classList.add('show');
    if (dropdownButton) {
        dropdownButton.classList.add('open');
        dropdownButton.setAttribute('aria-expanded', 'true');
        const arrow = dropdownButton.querySelector('.dropdown-arrow');
        if (arrow) arrow.setAttribute('name', 'chevron-up');
    }
    if (shouldFocusItem && playerItemsContainer) {
        const activeItem = playerItemsContainer.querySelector('.player-dropdown-item.active')
            || playerItemsContainer.querySelector('.player-dropdown-item')
            || playerItemsContainer.querySelector('.player-dropdown-section-header--collapsible');
        if (activeItem) {
            /** @type {HTMLElement} */ (activeItem).focus();
        }
    }
}

/**
 * Closes the player selection dropdown menu and resets chevron icon down.
 */
export function closeDropdown() {
    const { dropdownButton, dropdownList } = getDropdownElements();
    if (dropdownList) dropdownList.classList.remove('show');
    if (dropdownButton) {
        dropdownButton.classList.remove('open');
        dropdownButton.setAttribute('aria-expanded', 'false');
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

    if (!state.allPlayersData[cleanTag] || !state.allPlayersData[cleanTag].heroes) {
        const cached = loadPlayerData(cleanTag);
        if (cached && cached.heroes) {
            state.allPlayersData[cleanTag] = cached;
        }
    }

    if (state.allPlayersData[cleanTag]?.heroes) {
        switchActivePlayer(cleanTag);
        updateSavedPlayerTags(cleanTag);
        syncPlayerTagToUrl(cleanTag);
        if (isPlayerRefreshStale(cleanTag)) {
            void refreshActivePlayerData({ background: true, targetTag: cleanTag });
        }
    } else {
        const result = await loadAndProcessPlayerData(cleanTag);
        if (result?.success) {
            syncPlayerTagToUrl(result.cleanTag || cleanTag);
        } else {
            const errorKey = result?.message || 'apiErrors.notFound';
            showApiErrorToast(errorKey);
            if (state.savedPlayerTags?.[0] && state.savedPlayerTags[0] !== 'DEFAULT0') {
                syncPlayerTagToUrl(state.savedPlayerTags[0]);
            } else {
                syncPlayerTagToUrl(null);
            }
            invalidatePlayerDropdownCache();
            renderDropdown();
            return;
        }
    }

    const { month: minMonth, year: minYear } = getMinDate();
    const { month: maxMonth, year: maxYear } = getMaxDate();
    autoPlaceIncomeChipsForRange(minMonth, minYear, maxMonth, maxYear, true);
    handleStateUpdate(() => {
        if (state.planner?.calendar) {
            state.planner.calendar.isHydrated = true;
        }
    }, false);

    invalidatePlayerDropdownCache();
    renderDropdown();
}

/**
 * Prompts for confirmation and deletes a saved player profile from storage and state.
 * @param {string} tagToDelete - Player tag to remove.
 * @returns {Promise<void>}
 */
export async function handleDeletePlayer(tagToDelete) {
    const confirmed = await showConfirm(
        translate('confirms.deleteProfile'),
        'actions.confirm',
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
                const { month: minMonth, year: minYear } = getMinDate();
                const { month: maxMonth, year: maxYear } = getMaxDate();
                autoPlaceIncomeChipsForRange(minMonth, minYear, maxMonth, maxYear, true);
                handleStateUpdate(() => {
                    if (state.planner?.calendar) {
                        state.planner.calendar.isHydrated = true;
                    }
                }, false);
            }
        } else {
            handleStateUpdate(() => {}, false);
        }

        const remainingTags = state.savedPlayerTags
            .map(normalizePlayerTag)
            .filter(tag => tag && tag !== 'DEFAULT0');
        if (remainingTags.length === 0) {
            closeDropdown();
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
 * Initializes universal player dropdown interactions, account switching, deletion, and keyboard navigation.
 *
 * @param {Object} [options={}]
 * @param {(() => string) | null} [options.getActivePlayerTag] - Optional getter returning active normalized player tag.
 * @param {((tag: string) => void | Promise<void>) | null} [options.onSelectPlayer] - Callback when profile is selected.
 * @param {((tag: string) => void | Promise<void>) | null} [options.onDeletePlayer] - Callback when profile is deleted.
 * @param {(() => void) | null} [options.onAddPlayer] - Callback when "+ Add Player" is clicked.
 */
export function initPlayerDropdown(options = {}) {
    if (options.getActivePlayerTag) {
        activePlayerTagGetter = options.getActivePlayerTag;
    }
    if (options.onSelectPlayer) {
        customSelectPlayerHandler = options.onSelectPlayer;
    }
    if (options.onDeletePlayer) {
        customDeletePlayerHandler = options.onDeletePlayer;
    }
    if (options.onAddPlayer) {
        customAddPlayerHandler = options.onAddPlayer;
    }

    if (isPlayerDropdownInitialized) return;
    isPlayerDropdownInitialized = true;

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('touchstart', () => {
            lastTouchTime = Date.now();
        }, { passive: true });
    }

    const { dropdownButton, dropdownList, playerItemsContainer, addPlayerButton, container } = getDropdownElements();

    if (playerItemsContainer) {
        const handleSectionHeaderInteraction = (event) => {
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

        playerItemsContainer.addEventListener('click', async (event) => {
            if (handleSectionHeaderInteraction(event)) return;

            const target = /** @type {HTMLElement} */ (event.target);
            const refreshBtn = target?.closest?.('.refresh-player-button');
            if (refreshBtn) {
                event.preventDefault();
                event.stopPropagation();
                const tagToRefresh = refreshBtn.getAttribute('data-tag') || refreshBtn.dataset?.tag;
                if (tagToRefresh && tagToRefresh !== 'DEFAULT0') {
                    refreshBtn.classList.add('is-spinning');
                    refreshBtn.setAttribute('disabled', 'true');
                    try {
                        await refreshActivePlayerData({ force: true, targetTag: tagToRefresh });
                    } finally {
                        refreshBtn.classList.remove('is-spinning');
                        refreshBtn.removeAttribute('disabled');
                    }
                }
                return;
            }

            const deleteBtn = target?.closest?.('.delete-player-button, .remove-player-button');
            if (deleteBtn) {
                event.preventDefault();
                event.stopPropagation();
                const tagToDelete = deleteBtn.getAttribute('data-tag') || deleteBtn.dataset?.tag;
                if (tagToDelete) {
                    if (typeof customDeletePlayerHandler === 'function') {
                        const confirmed = await showConfirm(
                            translate('confirms.deleteProfile'),
                            'actions.confirm',
                            'actions.delete'
                        );
                        if (confirmed) {
                            removePlayerTag(tagToDelete);
                            customDeletePlayerHandler(tagToDelete);
                            const remainingProfiles = getSavedProfiles();
                            if (remainingProfiles.length === 0) {
                                closeDropdown();
                            }
                        }
                    } else {
                        handleDeletePlayer(tagToDelete);
                    }
                }
                return;
            }

            const item = target?.closest?.('.player-dropdown-item');
            if (item) {
                event.preventDefault();
                const tag = item.getAttribute('data-tag') || item.dataset?.tag;
                if (tag) {
                    closeDropdown();
                    if (typeof customSelectPlayerHandler === 'function') {
                        customSelectPlayerHandler(tag);
                    } else {
                        if (!state.allPlayersData[tag]) {
                            const cached = loadPlayerData(tag);
                            if (cached) {
                                state.allPlayersData[tag] = cached;
                            }
                        }
                        handlePlayerSelection(tag);
                        dom.player?.dropdownButton?.focus();
                    }
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
            const currentRow = target?.closest?.('.player-dropdown-item, .player-dropdown-section-header--collapsible, #add-player-button, #add-player-btn');
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
                    dropdownButton?.focus();
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
                dropdownButton?.focus();
            } else if (event.key === 'Enter' || event.key === ' ') {
                const activeEl = /** @type {HTMLElement} */ (document.activeElement);
                if (activeEl?.classList?.contains('player-dropdown-item') || activeEl?.id === 'add-player-button') {
                    event.preventDefault();
                    activeEl.click();
                }
            }
        };

        playerItemsContainer.addEventListener('keydown', handleDropdownKeyNavigation);
        if (dropdownList && dropdownList !== playerItemsContainer) {
            dropdownList.addEventListener('keydown', handleDropdownKeyNavigation);
        }
    }

    if (dropdownButton) {
        dropdownButton.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const list = dom.player?.dropdownList || document.getElementById('player-dropdown-list');
                if (list?.classList.contains('show')) {
                    const activeItem = playerItemsContainer?.querySelector('.player-dropdown-item.active')
                        || playerItemsContainer?.querySelector('.player-dropdown-item');
                    if (activeItem) /** @type {HTMLElement} */ (activeItem).focus();
                } else {
                    openDropdown(true);
                }
            }
        });

        dropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const list = dom.player?.dropdownList || document.getElementById('player-dropdown-list');
            if (list) {
                if (list.classList.contains('show')) {
                    closeDropdown();
                } else {
                    openDropdown(false);
                }
            }
        });
    }

    if (addPlayerButton) {
        addPlayerButton.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });

        addPlayerButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof customAddPlayerHandler === 'function') {
                customAddPlayerHandler();
            } else {
                showAddPlayerModal();
            }
            closeDropdown();
        });
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('click', (event) => {
            if (/** @type {HTMLElement} */ (event.target)?.closest?.('.unconnected-connect-btn, #home-profile-connect-btn')) {
                if (typeof customAddPlayerHandler === 'function') {
                    customAddPlayerHandler();
                } else {
                    showAddPlayerModal();
                }
            }

            const collapseBtn = /** @type {HTMLElement} */ (event.target)?.closest?.('.profile-collapse-toggle-btn, #home-profile-collapse-btn');
            if (collapseBtn) {
                const card = collapseBtn.closest('.card, .home-profile-card, .hero-journey-card') || document.getElementById('orecalc-home-player-card') || document.getElementById('hero-journey-player-card');
                if (card) {
                    const willBeCollapsed = !card.classList.contains('is-stats-collapsed');
                    card.classList.toggle('is-stats-collapsed', willBeCollapsed);
                    collapseBtn.setAttribute('aria-expanded', String(!willBeCollapsed));
                    const label = willBeCollapsed ? translate('views.home.profile.expandStats') : translate('views.home.profile.collapseStats');
                    collapseBtn.setAttribute('aria-label', label);
                    collapseBtn.setAttribute('title', label);
                    const icon = collapseBtn.querySelector('.collapse-chevron-icon, clashcalc-assets-svg, orecalc-assets-svg');
                    if (icon) {
                        icon.setAttribute('name', willBeCollapsed ? 'chevron-down' : 'chevron-up');
                    }
                    persistAppSettings({ hideProfileStats: willBeCollapsed });
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
            const list = dom.player?.dropdownList || document.getElementById('player-dropdown-list');
            const btn = dom.player?.dropdownButton || document.getElementById('player-dropdown-button');
            if (list && list.classList.contains('show')) {
                const isClickInsideButton = btn && btn.contains(/** @type {Node} */ (event.target));
                const isClickInsideList = list.contains(/** @type {Node} */ (event.target));
                const isConnected = /** @type {HTMLElement} */ (event.target)?.isConnected;

                if (!isConnected) return;

                if (!isClickInsideButton && !isClickInsideList) {
                    closeDropdown();
                }
            }
        });

        document.addEventListener('app:playerDropdownSync', () => {
            invalidatePlayerDropdownCache();
            renderPlayerDropdown();
        });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('scroll', () => {
            closeDropdown();
        }, { passive: true });
    }

    if (container) {
        container.addEventListener('mouseenter', () => {
            if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
            if (typeof document !== 'undefined' && document.body?.classList?.contains('tour-active')) return;
            if (Date.now() - lastTouchTime < 1000) return;
            if (typeof document !== 'undefined' && document.querySelector('.modal.show')) return;
            openDropdown(false);
        });

        container.addEventListener('mouseleave', () => {
            if (typeof window !== 'undefined' && window.matchMedia && !window.matchMedia('(hover: hover)').matches) return;
            if (typeof document !== 'undefined' && document.body?.classList?.contains('tour-active')) return;
            if (Date.now() - lastTouchTime < 1000) return;
            closeDropdown();
        });

        container.addEventListener('focusin', () => {
            if (typeof document !== 'undefined' && document.body?.classList?.contains('tour-active')) return;
            if (Date.now() - lastTouchTime < 1000) return;
            if (typeof document !== 'undefined' && document.querySelector('.modal.show')) return;
            const list = dom.player?.dropdownList || document.getElementById('player-dropdown-list');
            if (list && !list.classList.contains('show')) {
                openDropdown(false);
            }
        });

        container.addEventListener('focusout', (event) => {
            if (typeof document !== 'undefined' && document.body?.classList?.contains('tour-active')) return;
            if (Date.now() - lastTouchTime < 1000) return;
            if (event.relatedTarget && !container.contains(/** @type {Node} */ (event.relatedTarget))) {
                closeDropdown();
            }
        });
    }
}

/**
 * Convenience entry point initializing player dropdown with default Ore Calculator handlers.
 */
export function initializePlayerDropdown() {
    initPlayerDropdown();
}

export { initPlayerDropdown as initStandalonePlayerDropdown };
