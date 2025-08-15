import { dom } from '../../dom/domElements.js';
import { state } from '../../core/state.js';
import { handleStateUpdate } from '../../app.js';
import { loadPlayerData, updateSavedPlayerTags, removePlayerTag, isPlayerTagCached } from '../../core/localStorageManager.js';
import { showAddPlayerModal } from './playerModal.js';

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

        if (state.lastPlayerTag && state.lastPlayerTag !== 'DEFAULT0') {
            const playerData = loadPlayerData(state.lastPlayerTag);
            if (playerData && playerData.playerData && playerData.playerData.name) {
                selectedPlayerName.textContent = `${playerData.playerData.name}`;
            } else {
                selectedPlayerName.textContent = `Player`;
            }
        } else {
            selectedPlayerName.textContent = 'Select a Player';
        }

        let playerItemsHtml = savedPlayers.map(tag => {
            const playerData = loadPlayerData(tag);
            const playerName = (playerData && playerData.playerData && playerData.playerData.name) ? playerData.playerData.name : 'Player';
            const isActive = tag === state.lastPlayerTag ? 'active' : '';
            const isDefaultTag = tag === 'DEFAULT0';

            const isCached = isPlayerTagCached(tag);
            const cacheIconSvg = isCached
                ? '<svg class="cache-status-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="m414-280 226-226-58-58-169 169-84-84-57 57 142 142ZM260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Z"/></svg>'
                : '<svg class="cache-status-icon" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Zm0 160q17 0 28.5-11.5T520-360q0-17-11.5-28.5T480-400q-17 0-28.5 11.5T440-360q0 17 11.5 28.5T480-320Zm-40-140h80v-180h-80v180Z"/></svg>';

            return `<div class="player-dropdown-item ${isActive}" data-tag="${tag}">
                        ${cacheIconSvg}
                        <div class="player-info-text">
                            <span>${playerName}</span>
                            <span class="player-tag-text">#${tag}</span>
                        </div>
                        <button class="delete-player-button" data-tag="${tag}" ${isDefaultTag ? 'disabled' : ''}>
                            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
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
                renderPlayerDropdown();
            });
        });
    }
}

function handlePlayerSelection(tag) {
    const playerData = loadPlayerData(tag);
    if (playerData) {
        state.lastPlayerTag = tag;
        state.heroes = JSON.parse(JSON.stringify(playerData.heroes));
        state.storedOres = JSON.parse(JSON.stringify(playerData.storedOres));
        state.income = JSON.parse(JSON.stringify(playerData.income));
        state.playerData = JSON.parse(JSON.stringify(playerData.playerData));
        state.uiSettings.regionalPricingEnabled = playerData.regionalPricingEnabled;

        handleStateUpdate(() => {});
        updateSavedPlayerTags(tag);
        renderPlayerDropdown();
    } else {
        console.error('Player data not found for tag:', tag);
    }
}
