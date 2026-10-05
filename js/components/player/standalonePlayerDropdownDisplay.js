import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';
import { formatDisplayTag, normalizePlayerTag } from '../../core/storageKeys.js';
import { getSavedProfiles } from '../../core/playerStorage.js';

/**
 * Renders HTML markup for standalone player dropdown list items.
 *
 * @param {Object} [params={}]
 * @param {Array<any>} [params.savedProfiles=[]] - Array of saved profile summaries.
 * @param {string} [params.activeCleanTag=''] - Active normalized player tag.
 * @param {boolean} [params.isFiltering=false] - Whether dropdown filtering is active.
 * @param {string} [params.cleanQuery=''] - Search filter query.
 * @param {string} [params.idPrefix='player-dropdown-item'] - Prefix for item id attributes.
 * @returns {string} Standardized HTML markup string.
 */
export function renderStandaloneDropdownMarkup({
    savedProfiles = [],
    activeCleanTag = '',
    isFiltering = false,
    cleanQuery = '',
    idPrefix = 'player-dropdown-item'
} = {}) {
    const listToRender = (isFiltering && cleanQuery)
        ? savedProfiles.filter(p => {
            const cleanTag = normalizePlayerTag(p.cleanTag || p.tag);
            const cleanName = (p.name || '').toUpperCase();
            const q = cleanQuery.toUpperCase();
            return cleanTag.includes(q) || cleanName.includes(q);
        })
        : savedProfiles;

    if (!listToRender || listToRender.length === 0) {
        return '';
    }

    let html = `<div class="player-dropdown-section-header" data-i18n="player.savedProfiles">${translate('player.savedProfiles')}</div>`;

    html += listToRender.map((p, index) => {
        const cleanTag = normalizePlayerTag(p.cleanTag || p.tag);
        const displayTag = formatDisplayTag(cleanTag);
        const playerName = escapeHTML(p.name || displayTag);
        const isActive = cleanTag === activeCleanTag;
        const thLevel = Math.min(Math.max(Number(p.townHallLevel) || 1, 1), 18);
        const thImg = `assets/th/th${thLevel}.png`;

        return `<div id="${idPrefix}-${index}" class="player-dropdown-item ${isActive ? 'active is-active' : ''}" data-tag="${escapeHTML(cleanTag)}" tabindex="${isActive ? '0' : '-1'}" role="option" aria-selected="${isActive}">
            <div class="player-dropdown-th-wrapper">
                <orecalc-assets-image src="${thImg}" alt="TH ${thLevel}" class="player-dropdown-th"></orecalc-assets-image>
                <span class="player-dropdown-th-badge">${thLevel}</span>
            </div>
            <div class="player-info-text">
                <span>${playerName}</span>
                <span class="player-tag-text">${escapeHTML(displayTag)}</span>
            </div>
            <button class="remove-player-button delete-player-button" data-tag="${escapeHTML(cleanTag)}" tabindex="-1" aria-label="${escapeHTML(translate('player.removePlayer'))}: ${playerName}" title="${escapeHTML(translate('player.removePlayer'))}">
                ${getSVG('trash', '', 16, 16, 'currentColor')}
            </button>
        </div>`;
    }).join('');

    return html;
}

/**
 * Renders the player dropdown button label and item container for standalone application headers.
 *
 * @param {string} [activeCleanTag=''] - Active normalized player tag.
 * @param {Object} [options={}] - Render configuration options.
 * @param {string} [options.idPrefix='player-dropdown-item'] - Element ID prefix for items.
 * @param {string} [options.fallbackName=''] - Fallback name if active profile summary is missing.
 */
export function renderStandalonePlayerDropdown(activeCleanTag = '', options = {}) {
    const selectedPlayerName = document.getElementById('selected-player-name');
    const playerItemsContainer = document.getElementById('player-items-container');

    const cleanTag = normalizePlayerTag(activeCleanTag);
    const savedProfiles = getSavedProfiles();

    if (selectedPlayerName) {
        if (cleanTag && cleanTag !== 'DEFAULT0') {
            const activeProfile = savedProfiles.find(p => normalizePlayerTag(p.cleanTag || p.tag) === cleanTag);
            const resolvedName = activeProfile?.name || options.fallbackName || formatDisplayTag(cleanTag) || translate('player.label');
            selectedPlayerName.textContent = resolvedName;
        } else {
            selectedPlayerName.textContent = translate('player.addPlayer');
        }
    }

    if (playerItemsContainer) {
        playerItemsContainer.innerHTML = renderStandaloneDropdownMarkup({
            savedProfiles,
            activeCleanTag: cleanTag,
            idPrefix: options.idPrefix || 'player-dropdown-item'
        });
    }
}
