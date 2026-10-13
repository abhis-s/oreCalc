import { initPlayerDropdown } from './playerDropdownInputs.js';
import { initStandaloneAddPlayerModal as initModal } from './standaloneAddPlayerModal.js';

/**
 * Initializes standalone player dropdown interactions, account switching, deletion, and keyboard navigation.
 *
 * @param {Object} options
 * @param {(tag: string) => void} options.onSelectPlayer - Callback when a saved profile is selected.
 * @param {(tag: string) => void} options.onDeletePlayer - Callback when a saved profile is deleted.
 * @param {() => void} options.onAddPlayer - Callback when "+ Add Player" is clicked.
 * @param {(() => string) | null} [options.getActivePlayerTag] - Optional getter returning active normalized player tag.
 */
export function initStandalonePlayerDropdown(options) {
    initPlayerDropdown(options);
}

/**
 * Initializes the Add Player modal for standalone applications.
 *
 * @param {Object} options
 * @param {(tag: string) => Promise<any>} options.onLoadPlayer - Callback to load a player tag.
 * @returns {{ openAddPlayerModal: () => void, closeAddPlayerModal: () => void }} Modal controller methods.
 */
export function initStandaloneAddPlayerModal(options) {
    return initModal(options);
}
