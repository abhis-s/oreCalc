import { dom } from '../../dom/domElements.js';
import { handleStateUpdate } from '../../app.js';
import { state } from '../../core/state.js';
import { isPlayerTagCached, removePlayerTag, loadPlayerData, updateSavedPlayerTags } from '../../core/localStorageManager.js';
import { loadAndProcessPlayerData } from '../../services/serverResponseHandler.js';

export function initializePlayerInput() {
    const input = dom.player?.tagInput;
    const loadButton = dom.player?.loadButton;
    const suggestionsContainer = dom.player?.suggestions;
    if (!loadButton || !input || !suggestionsContainer) {
        console.error('Player input DOM elements not found!', { input, loadButton, suggestionsContainer });
        return;
    }

    loadButton.addEventListener('click', () => {
        const tagToLoad = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        loadAndProcessPlayerData(tagToLoad);
        suggestionsContainer.classList.remove('show');
    });

    input.addEventListener('focus', () => {
        suggestionsContainer.classList.add('show');
        renderPlayerInput(state.lastPlayerTag, state.savedPlayerTags);
    });

    input.addEventListener('blur', () => {
        // Delay hiding to allow click events on suggestions to register
        setTimeout(() => {
            if (!suggestionsContainer.contains(document.activeElement)) {
                suggestionsContainer.classList.remove('show');
            }
        }, 100);
    });
    
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            loadButton.click();
        }
    });
    
    suggestionsContainer.addEventListener('click', (event) => {
        const suggestionItem = event.target.closest('.player-tag-suggestion-item');
        if (suggestionItem) {
            const tag = suggestionItem.dataset.tag;
            const playerData = loadPlayerData(tag);
            if (playerData) {
                state.lastPlayerTag = tag;
                // Deep clone
                state.heroes = JSON.parse(JSON.stringify(playerData.heroes));
                state.storedOres = JSON.parse(JSON.stringify(playerData.storedOres));
                state.income = JSON.parse(JSON.stringify(playerData.income));
                state.playerData = JSON.parse(JSON.stringify(playerData.playerData));
                state.uiSettings.regionalPricingEnabled = playerData.regionalPricingEnabled;

                handleStateUpdate(() => {});
                updateSavedPlayerTags(tag);
                renderPlayerInput(input.value, state.savedPlayerTags);
            } else {
                handleStateUpdate(() => { state.lastPlayerTag = tag; });
                loadButton.click();
            }
            suggestionsContainer.classList.remove('show');
        }
    });
}

export function renderPlayerInput(playerTag, savedTags) {
    const input = dom.player?.tagInput;
    const suggestionsContainer = dom.player?.suggestions;
    
    // Filter out DEFAULT0 from the list of tags to display in suggestions
    const tagsToDisplay = savedTags.filter(tag => tag !== 'DEFAULT0');

    // Ensure input field is pre-filled with DEFAULT0 if no playerTag is provided
    if (input) {
        input.value = (playerTag === 'DEFAULT0' ? '' : playerTag);
    }

    if (suggestionsContainer) {
        const cleanedPlayerTag = playerTag.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const exactMatchTag = tagsToDisplay.find(tag => tag === cleanedPlayerTag); // Search only in tags to display

        let suggestionsHtml = '';

        if (exactMatchTag) {
            suggestionsHtml += `
                <div class="player-tag-suggestion-item" data-tag="${exactMatchTag}">
                    ${getCacheStatusHtml(exactMatchTag)}
                    <span>${exactMatchTag}</span>
                    ${getDeleteButtonHtml(exactMatchTag)}
                </div>
            `;
            // Only add separator if there are other tags to display
            if (tagsToDisplay.length > 1) {
                suggestionsHtml += `<div class="suggestions-separator"></div>`;
            }
            const otherTags = tagsToDisplay.filter(tag => tag !== exactMatchTag);
            suggestionsHtml += otherTags.map(tag => `
                <div class="player-tag-suggestion-item" data-tag="${tag}">
                    ${getCacheStatusHtml(tag)}
                    <span>${tag}</span>
                    ${getDeleteButtonHtml(tag)}
                </div>
            `).join('');
        } else {
            const filterText = playerTag.toLowerCase();
            const filteredTags = tagsToDisplay.filter(tag => tag.toLowerCase().includes(filterText));
            suggestionsHtml = filteredTags.map(tag => `
                <div class="player-tag-suggestion-item" data-tag="${tag}">
                    ${getCacheStatusHtml(tag)}
                    <span>${tag}</span>
                    ${getDeleteButtonHtml(tag)}
                </div>
            `).join('');
        }

        suggestionsContainer.innerHTML = suggestionsHtml;

        suggestionsContainer.querySelectorAll('.delete-suggestion-button').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const tagToDelete = event.currentTarget.closest('.player-tag-suggestion-item').dataset.tag;
                removePlayerTag(tagToDelete);
                renderPlayerInput(input.value, state.savedPlayerTags);
            });
        });
    }
}

function getCacheStatusHtml(tag) {
    const isCached = isPlayerTagCached(tag);
    return isCached
        ? '<div class="cache-status-pill cached" title="Cached"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="m414-280 226-226-58-58-169 169-84-84-57 57 142 142ZM260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Z"/></svg></div>'
        : '<div class="cache-status-pill not-cached" title="Not Cached"><svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Z"/></svg></div>';
}

function getDeleteButtonHtml(tag) {
    const isDisabled = tag === 'DEFAULT0';
    const title = isDisabled ? 'Cannot remove default tag' : `Remove ${tag}`;
    const disabledAttr = isDisabled ? 'disabled' : '';

    return `<button class="delete-suggestion-button" title="${title}" ${disabledAttr}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
            </button>`;
}