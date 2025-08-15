export function getPlayerDOMElements() {
    return {
        dropdownButton: document.getElementById('player-dropdown-button'),
        dropdownList: document.getElementById('player-dropdown-list'),
        selectedPlayerName: document.getElementById('selected-player-name'),
        addPlayerButton: document.getElementById('add-player-button'),
        addPlayerModal: document.getElementById('add-player-modal'),
        playerTagInputModal: document.getElementById('player-tag-input-modal'),
        cancelAddPlayerButton: document.getElementById('cancel-add-player-button'),
        loadPlayerModalButton: document.getElementById('load-player-modal-btn'),
        playerTagErrorMessage: document.getElementById('player-tag-error-message'),
        playerItemsContainer: document.getElementById('player-items-container'),
    };
}
