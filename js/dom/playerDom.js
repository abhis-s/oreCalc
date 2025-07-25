export function getPlayerDOMElements() {
    return {
        tagInput: document.getElementById('player-tag-input'),
        loadButton: document.getElementById('load-player-btn'),
        suggestions: document.getElementById('player-tag-suggestions'),
        controlsContainer: document.querySelector('.player-tag-controls-container'),
    };
}
