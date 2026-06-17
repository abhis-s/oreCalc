import { dom } from '../../dom/domElements.js';
import { handleStateUpdate, switchActivePlayer } from '../../app.js';
import { loadPlayerData, updateSavedPlayerTags, removePlayerTag, isPlayerTagCached } from '../../core/localStorageManager.js';
import { state } from '../../core/state.js';

import { currencyData } from '../../data/appData.js';
import { getSVG } from '../../utils/svgManager.js';
import { translate } from '../../i18n/translator.js';

import { showAddPlayerModal } from './playerModal.js';

export function openDropdown() {
    const dropdownList = dom.player.dropdownList;
    const dropdownButton = dom.player.dropdownButton;
    if (dropdownList) dropdownList.classList.add('show');
    if (dropdownButton) {
        dropdownButton.classList.add('open');
        const arrow = dropdownButton.querySelector('.dropdown-arrow');
        if (arrow) arrow.setAttribute('name', 'chevron-up');
    }
}

export function closeDropdown() {
    const dropdownList = dom.player.dropdownList;
    const dropdownButton = dom.player.dropdownButton;
    if (dropdownList) dropdownList.classList.remove('show');
    if (dropdownButton) {
        dropdownButton.classList.remove('open');
        const arrow = dropdownButton.querySelector('.dropdown-arrow');
        if (arrow) arrow.setAttribute('name', 'chevron-down');
    }
}

let lastTouchTime = 0;
document.addEventListener('touchstart', () => {
    lastTouchTime = Date.now();
}, { passive: true });

export function initializePlayerDropdown() {
    const dropdownButton = dom.player.dropdownButton;
    const addPlayerButton = dom.player.addPlayerButton;

    if (dropdownButton) {
        dropdownButton.addEventListener('click', () => {
            const dropdownList = dom.player.dropdownList;
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
        const dropdownList = dom.player.dropdownList;
        const dropdownButton = dom.player.dropdownButton;
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

    const playerControlsContainer = document.querySelector('.player-controls-container');
    if (playerControlsContainer) {
        playerControlsContainer.addEventListener('mouseenter', () => {
            if (Date.now() - lastTouchTime < 1000) return;
            if (document.querySelector('.modal.show')) return;
            openDropdown();
        });

        playerControlsContainer.addEventListener('mouseleave', () => {
            if (Date.now() - lastTouchTime < 1000) return;
            closeDropdown();
        });

        playerControlsContainer.addEventListener('focusin', () => {
            if (Date.now() - lastTouchTime < 1000) return;
            if (document.querySelector('.modal.show')) return;
            openDropdown();
        });

        playerControlsContainer.addEventListener('focusout', (event) => {
            if (Date.now() - lastTouchTime < 1000) return;
            if (!playerControlsContainer.contains(event.relatedTarget)) {
                closeDropdown();
            }
        });
    }
}

export function renderPlayerDropdown() {
    const playerItemsContainer = dom.player.playerItemsContainer;
    const selectedPlayerName = dom.player.selectedPlayerName;

    if (playerItemsContainer && selectedPlayerName) {
        const savedPlayers = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
        const activeTag = state.savedPlayerTags[0];

        if (activeTag) {
            const playerState = loadPlayerData(activeTag);
            if (playerState && playerState.playerProfile && playerState.playerProfile.name) {
                selectedPlayerName.textContent = `${playerState.playerProfile.name}`;
            } else {
                selectedPlayerName.textContent = activeTag === 'DEFAULT0' ? translate('player.selectPlaceholder') : translate('player.label');
            }
        } else {
            selectedPlayerName.textContent = translate('player.selectPlaceholder');
        }

        let playerItemsHtml = savedPlayers.map(tag => {
            const playerState = loadPlayerData(tag);
            const playerName = (playerState && playerState.playerProfile && playerState.playerProfile.name) ? playerState.playerProfile.name : translate('player.label');
            const isActive = tag === activeTag ? 'active' : '';
            const isDefaultTag = tag === 'DEFAULT0';

            const isCached = isPlayerTagCached(tag);
            const cacheIconSvg = isCached
                ? getSVG('cloud-check', 'cache-status-icon', 24, 24, 'currentColor')
                : getSVG('cloud-error', 'cache-status-icon', 24, 24, 'currentColor');

            return `<div class="player-dropdown-item ${isActive}" data-tag="${tag}" tabindex="0" role="button">
                        ${cacheIconSvg}
                        <div class="player-info-text">
                            <span>${playerName}</span>
                            <span class="player-tag-text">#${tag}</span>
                        </div>
                        <button class="delete-player-button" data-tag="${tag}" ${isDefaultTag ? 'disabled' : ''} aria-label="${translate('actions.delete') || 'Delete'} ${playerName}">
                            ${getSVG('trash', '', 24, 24, 'currentColor')}
                        </button>
                    </div>`;
        }).join('');

        playerItemsContainer.innerHTML = playerItemsHtml;

        playerItemsContainer.querySelectorAll('.player-dropdown-item').forEach(item => {
            const selectPlayer = () => {
                const tag = item.dataset.tag;
                handlePlayerSelection(tag);
                closeDropdown();
            };

            item.addEventListener('click', (event) => {
                if (event.target.closest('.delete-player-button')) {
                    return;
                }
                selectPlayer();
            });

            item.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    if (event.target.closest('.delete-player-button')) {
                        return;
                    }
                    event.preventDefault();
                    selectPlayer();
                }
            });
        });

        playerItemsContainer.querySelectorAll('.delete-player-button').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const tagToDelete = event.currentTarget.dataset.tag;
                removePlayerTag(tagToDelete);
                location.reload();
            });
        });
    }
}

function handlePlayerSelection(tag) {
    switchActivePlayer(tag);
    renderPlayerDropdown();
}
