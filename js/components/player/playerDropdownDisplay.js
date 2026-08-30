import { translate } from '../../i18n/translator.js';

import { formatDisplayTag, loadPlayerData, normalizePlayerTag } from '../../core/localStorageManager.js';
import { getRecentSearches } from '../../core/recentSearchesManager.js';
import { state } from '../../core/state.js';

import { escapeHTML } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';

import { dom } from '../../dom/domElements.js';

let lastRenderStateKey = '';
let isMainAppRecentCollapsed = true;

/**
 * Invalidates the player dropdown memoized render state cache.
 */
export function invalidatePlayerDropdownCache() {
    lastRenderStateKey = '';
}

/**
 * Toggles the collapsed state of the recent searches section in the main app.
 */
export function toggleMainAppRecentCollapsed() {
    isMainAppRecentCollapsed = !isMainAppRecentCollapsed;
    invalidatePlayerDropdownCache();
    renderPlayerDropdown();
}

/**
 * Returns the current in-memory collapsed state of recent searches in the main app.
 * @returns {boolean}
 */
export function getMainAppRecentCollapsed() {
    return isMainAppRecentCollapsed;
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
        .map(t => normalizePlayerTag(t))
        .filter(t => t && t !== 'DEFAULT0');
    const savedSet = new Set(savedPlayers);
    const recentSearches = getRecentSearches().filter(r => !savedSet.has(r.cleanTag));

    // Build state key to detect if DOM tree actually needs re-rendering
    const currentLang = state.uiSettings?.language || 'en';
    const currentKey = `${cleanActiveTag}|${savedPlayers.join(',')}|${recentSearches.map(r => r.cleanTag).join(',')}|${isMainAppRecentCollapsed}|${currentLang}`;

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

    const renderRecentItem = (r, isActive = false) => {
        const cleanTag = normalizePlayerTag(r.cleanTag || r.tag);
        const playerName = escapeHTML(r.name || formatDisplayTag(cleanTag));
        const safeCleanTag = escapeHTML(cleanTag);
        const displayTag = formatDisplayTag(cleanTag);
        const isItemActive = isActive || (cleanTag === cleanActiveTag);
        const thLevel = Math.min(Math.max(Number(r.townHallLevel) || 1, 1), 18);
        const thImg = `assets/th/th${thLevel}.png`;

        return `<div class="player-dropdown-item player-dropdown-item--recent ${isItemActive ? 'active' : ''}" data-tag="${safeCleanTag}" tabindex="${isItemActive ? '0' : '-1'}" role="button">
                    <div class="player-dropdown-th-wrapper">
                        <orecalc-assets-image src="${thImg}" alt="TH ${thLevel}" class="player-dropdown-th"></orecalc-assets-image>
                        <span class="player-dropdown-th-badge">${thLevel}</span>
                    </div>
                    <div class="player-info-text">
                        <span>${playerName}</span>
                        <span class="player-tag-text">${escapeHTML(displayTag)}</span>
                    </div>
                    <button class="dismiss-recent-button" data-tag="${safeCleanTag}" tabindex="-1" aria-label="${escapeHTML(translate('player.removeRecent'))}: ${playerName}" title="${escapeHTML(translate('player.removeRecent'))}">
                        ${getSVG('close', '', 14, 14, 'currentColor')}
                    </button>
                </div>`;
    };

    if (savedPlayers.length > 0) {
        html += `<div class="player-dropdown-section-header" data-i18n="player.savedProfiles">${translate('player.savedProfiles')}</div>`;
        html += savedPlayers.map(renderSavedItem).join('');
    }

    if (recentSearches.length > 0) {
        html += `<div class="player-dropdown-section-header player-dropdown-section-header--collapsible" data-i18n="player.recentSearches" role="button" tabindex="-1" aria-expanded="${!isMainAppRecentCollapsed}">
                    <span>${translate('player.recentSearches')}</span>
                    <span class="section-header-chevron">${getSVG('chevron-down', '', 12, 12, 'currentColor')}</span>
                 </div>`;
        if (!isMainAppRecentCollapsed) {
            html += recentSearches.map(r => renderRecentItem(r, false)).join('');
        }
    }

    playerItemsContainer.innerHTML = html;
}
