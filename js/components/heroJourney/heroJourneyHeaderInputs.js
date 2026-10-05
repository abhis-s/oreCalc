import {
    initStandalonePlayerDropdown,
    initStandaloneAddPlayerModal
} from '../player/standalonePlayerDropdownInputs.js';

/**
 * Initializes the player dropdown button, item selections, deletion, and keyboard navigation.
 * @param {Object} options
 * @param {(tag: string) => void} options.onSelectPlayer - Callback when a saved profile is selected.
 * @param {(tag: string) => void} options.onDeletePlayer - Callback when a saved profile is deleted.
 * @param {() => void} options.onAddPlayer - Callback when "+ Add Player" is clicked.
 * @param {(() => string) | null} [options.getActivePlayerTag] - Optional getter returning active normalized player tag.
 */
export function initHeroJourneyPlayerDropdown(options) {
    initStandalonePlayerDropdown(options);
}

/**
 * Initializes the Add Player modal for Hero's Journey.
 * @param {Object} options
 * @param {(tag: string) => Promise<any>} options.onLoadPlayer - Callback to load a player tag.
 * @returns {{ openAddPlayerModal: () => void, closeAddPlayerModal: () => void }} Modal controller methods.
 */
export function initHeroJourneyAddPlayerModal(options) {
    return initStandaloneAddPlayerModal(options);
}
