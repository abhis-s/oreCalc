import { dom } from '../../dom/domElements.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { loadPlayerData, updateSavedPlayerTags, removePlayerTag, isPlayerTagCached } from '../../core/localStorageManager.js';
import { showAddPlayerModal } from './playerModal.js';
import { translate } from '../../i18n/translator.js';
import { getSVG } from '../../utils/svgManager.js';
import { currencyData } from '../../data/appData.js';

export function initializePlayerDropdown() {
    const dropdownButton = dom.player.dropdownButton;
    const addPlayerButton = dom.player.addPlayerButton;

    if (dropdownButton) {
        dropdownButton.addEventListener('click', () => {
            const dropdownList = dom.player.dropdownList;
            if (dropdownList) {
                if (dropdownList.classList.contains('show')) {
                    dropdownList.classList.remove('show');
                } else {
                    dropdownList.classList.add('show');
                }
            }
        });
    }

    if (addPlayerButton) {
        addPlayerButton.addEventListener('click', () => {
            showAddPlayerModal();
            const dropdownList = dom.player.dropdownList;
            if (dropdownList) {
                dropdownList.classList.remove('show');
            }
        });
    }

    document.addEventListener('click', (event) => {
        const dropdownList = dom.player.dropdownList;
        const dropdownButton = dom.player.dropdownButton;
        if (dropdownList && dropdownList.classList.contains('show')) {
            const isClickInsideDropdownButton = dropdownButton && dropdownButton.contains(event.target);
            const isClickInsideDropdownList = dropdownList.contains(event.target);

            if (!isClickInsideDropdownButton && !isClickInsideDropdownList) {
                dropdownList.classList.remove('show');
            }
        }
    });
}

export function renderPlayerDropdown() {
    const playerItemsContainer = dom.player.playerItemsContainer;
    const selectedPlayerName = dom.player.selectedPlayerName;

    if (playerItemsContainer && selectedPlayerName) {
        const savedPlayers = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
        const activeTag = state.savedPlayerTags[0];

        if (activeTag && activeTag !== 'DEFAULT0') {
            const playerState = loadPlayerData(activeTag);
            if (playerState && playerState.playerProfile && playerState.playerProfile.name) {
                selectedPlayerName.textContent = `${playerState.playerProfile.name}`;
            } else {
                selectedPlayerName.textContent = translate('player.label');
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

            return `<div class="player-dropdown-item ${isActive}" data-tag="${tag}">
                        ${cacheIconSvg}
                        <div class="player-info-text">
                            <span>${playerName}</span>
                            <span class="player-tag-text">#${tag}</span>
                        </div>
                        <button class="delete-player-button" data-tag="${tag}" ${isDefaultTag ? 'disabled' : ''}>
                            ${getSVG('trash', '', 24, 24, 'currentColor')}
                        </button>
                    </div>`;
        }).join('');

        playerItemsContainer.innerHTML = playerItemsHtml;

        playerItemsContainer.querySelectorAll('.player-dropdown-item').forEach(item => {
            item.addEventListener('click', (event) => {
                if (event.target.closest('.delete-player-button')) {
                    return;
                }
                const tag = event.currentTarget.dataset.tag;
                handlePlayerSelection(tag);
                dom.player.dropdownList.classList.remove('show');
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
    const playerState = loadPlayerData(tag);
    if (playerState) {
        // Helper to safely clone objects with fallbacks
        const safeClone = (obj, fallback = {}) => {
            try {
                return obj ? JSON.parse(JSON.stringify(obj)) : fallback;
            } catch (e) {
                console.warn('Failed to clone state object, using fallback', e);
                return fallback;
            }
        };

        state.heroes = safeClone(playerState.heroes);
        state.storedOres = safeClone(playerState.storedOres);
        state.income = safeClone(playerState.income);
        state.planner = safeClone(playerState.planner);
        state.playerProfile = safeClone(playerState.playerProfile);

        if (playerState.currency && typeof playerState.currency === 'object') {
            state.uiSettings.currency = {
                code: playerState.currency.code || 'USD'
            };
        }

        handleStateUpdate(() => {});
        updateSavedPlayerTags(tag);
        renderPlayerDropdown();
    } else {
        console.error('Player data not found for tag:', tag);
    }
}
