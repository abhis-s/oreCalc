import { translate } from '../../i18n/translator.js';

import { loadPlayerData } from '../../core/localStorageManager.js';
import { state } from '../../core/state.js';

import { escapeHTML } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';

import { dom } from '../../dom/domElements.js';

let lastRenderStateKey = '';

/**
 * Invalidates the player dropdown memoized render state cache.
 */
export function invalidatePlayerDropdownCache() {
    lastRenderStateKey = '';
}

/**
 * Renders the player dropdown list and selected player label.
 * Includes dirty-cache checking to eliminate redundant DOM rewrites.
 *
 * @param {Object} [handlers]
 * @param {Function} [handlers.onSelectPlayer]
 * @param {Function} [handlers.onDeletePlayer]
 */
export function renderPlayerDropdown(handlers = {}) {
    const playerItemsContainer = dom.player?.playerItemsContainer;
    const selectedPlayerName = dom.player?.selectedPlayerName;

    if (!playerItemsContainer || !selectedPlayerName) return;

    const savedPlayers = state.savedPlayerTags.filter(tag => tag !== 'DEFAULT0');
    const activeTag = state.savedPlayerTags[0];

    if (activeTag) {
        const playerState = loadPlayerData(activeTag);
        if (playerState && playerState.playerProfile && playerState.playerProfile.name) {
            selectedPlayerName.textContent = `${playerState.playerProfile.name}`;
        } else {
            selectedPlayerName.textContent = activeTag === 'DEFAULT0' ? translate('player.addPlayer') : translate('player.label');
        }
    } else {
        selectedPlayerName.textContent = translate('player.addPlayer');
    }

    // Build state key to detect if DOM tree actually needs re-rendering
    const currentLang = state.uiSettings?.language || 'en';
    const currentKey = `${activeTag || ''}|${savedPlayers.join(',')}|${currentLang}`;

    if (currentKey === lastRenderStateKey && playerItemsContainer.children.length > 0) {
        return;
    }
    lastRenderStateKey = currentKey;

    const playerItemsHtml = savedPlayers.map(tag => {
        const playerState = loadPlayerData(tag);
        const rawPlayerName = (playerState && playerState.playerProfile && playerState.playerProfile.name) ? playerState.playerProfile.name : translate('player.label');
        const playerName = escapeHTML(rawPlayerName);
        const safeTag = escapeHTML(tag);
        const isActive = tag === activeTag ? 'active' : '';
        const isDefaultTag = tag === 'DEFAULT0';

        return `<div class="player-dropdown-item ${isActive}" data-tag="${safeTag}" tabindex="0" role="button">
                    <div class="player-info-text">
                        <span>${playerName}</span>
                        <span class="player-tag-text">#${safeTag}</span>
                    </div>
                    <button class="delete-player-button" data-tag="${safeTag}" ${isDefaultTag ? 'disabled' : ''} aria-label="${escapeHTML(translate('actions.delete'))} ${playerName}">
                        ${getSVG('trash', '', 24, 24, 'currentColor')}
                    </button>
                </div>`;
    }).join('');

    playerItemsContainer.innerHTML = playerItemsHtml;
}
