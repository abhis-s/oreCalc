import { translate } from '../../i18n/translator.js';

import { formatDisplayTag, normalizePlayerTag } from '../../core/storageKeys.js';
import { loadPlayerData } from '../../core/playerStorage.js';
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
 * Updates refresh button visibility based on whether real saved player profiles exist.
 * Hides the button if the user only has guest tags (e.g. DEFAULT0) or no profiles.
 *
 * @param {string[]} [tags] - List of saved player tags.
 */
export function updateRefreshButtonVisibility(tags = state?.savedPlayerTags) {
    const refreshButton = dom.controls?.refreshButton || (typeof document !== 'undefined' ? document.getElementById('refresh-button') : null);
    if (!refreshButton) return;

    const hasRealPlayer = Array.isArray(tags) && tags.some(tag => {
        const cleanTag = normalizePlayerTag(tag);
        return Boolean(cleanTag && cleanTag !== 'DEFAULT0');
    });

    if (hasRealPlayer) {
        refreshButton.classList.remove('is-hidden');
    } else {
        refreshButton.classList.add('is-hidden');
    }
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
    updateRefreshButtonVisibility();

    const playerItemsContainer = dom.player?.playerItemsContainer;
    const selectedPlayerName = dom.player?.selectedPlayerName;

    if (!playerItemsContainer || !selectedPlayerName) return;

    const activeTag = state.savedPlayerTags[0];
    const cleanActiveTag = normalizePlayerTag(activeTag);

    if (cleanActiveTag && cleanActiveTag !== 'DEFAULT0') {
        const playerState = loadPlayerData(cleanActiveTag);
        if (playerState && playerState.playerProfile && playerState.playerProfile.name) {
            selectedPlayerName.textContent = `${playerState.playerProfile.name}`;
        } else {
            selectedPlayerName.textContent = translate('player.label');
        }
    } else {
        selectedPlayerName.textContent = translate('player.addPlayer');
    }

    const savedPlayers = state.savedPlayerTags
        .map(normalizePlayerTag)
        .filter(t => t && t !== 'DEFAULT0');

    // Build state key to detect if DOM tree actually needs re-rendering
    const currentLang = state.uiSettings?.language || 'en';
    const currentKey = `${cleanActiveTag}|${savedPlayers.join(',')}|${currentLang}`;

    if (currentKey === lastRenderStateKey && playerItemsContainer.children.length > 0) {
        return;
    }
    lastRenderStateKey = currentKey;

    let html = '';

    const renderSavedItem = (tag) => {
        const cleanTag = normalizePlayerTag(tag);
        const playerState = loadPlayerData(cleanTag);
        const rawPlayerName = (playerState && playerState.playerProfile && playerState.playerProfile.name) ? playerState.playerProfile.name : translate('player.label');
        const playerName = escapeHTML(rawPlayerName);
        const safeCleanTag = escapeHTML(cleanTag);
        const displayTag = formatDisplayTag(cleanTag);
        const isItemActive = cleanTag === cleanActiveTag;
        const isActive = isItemActive ? 'active' : '';
        const isDefaultTag = cleanTag === 'DEFAULT0';
        const thLevel = Math.min(Math.max(Number(playerState?.playerProfile?.townHallLevel) || 1, 1), 18);
        const thImg = `assets/th/th${thLevel}.png`;

        return `<div class="player-dropdown-item ${isActive}" data-tag="${safeCleanTag}" tabindex="${isItemActive ? '0' : '-1'}" role="button">
                    <div class="player-dropdown-th-wrapper">
                        <orecalc-assets-image src="${thImg}" alt="TH ${thLevel}" class="player-dropdown-th"></orecalc-assets-image>
                        <span class="player-dropdown-th-badge">${thLevel}</span>
                    </div>
                    <div class="player-info-text">
                        <span>${playerName}</span>
                        <span class="player-tag-text">${escapeHTML(displayTag)}</span>
                    </div>
                    <button class="remove-player-button delete-player-button" data-tag="${safeCleanTag}" ${isDefaultTag ? 'disabled' : ''} tabindex="-1" aria-label="${escapeHTML(translate('player.removePlayer'))}: ${playerName}" title="${escapeHTML(translate('player.removePlayer'))}">
                        ${getSVG('trash', '', 16, 16, 'currentColor')}
                    </button>
                </div>`;
    };

    if (savedPlayers.length > 0) {
        html += `<div class="player-dropdown-section-header" data-i18n="player.savedProfiles">${translate('player.savedProfiles')}</div>`;
        html += savedPlayers.map(renderSavedItem).join('');
    }

    playerItemsContainer.innerHTML = html;
}
