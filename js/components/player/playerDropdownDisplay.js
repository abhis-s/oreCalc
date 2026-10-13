import { translate } from '../../i18n/translator.js';
import { formatDisplayTag, normalizePlayerTag } from '../../core/storageKeys.js';
import { getSavedProfiles, loadPlayerData } from '../../core/playerStorage.js';
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
 * Renders HTML markup for player dropdown list items.
 *
 * @param {Object} [params={}]
 * @param {Array<any>} [params.savedProfiles=[]] - Array of saved profile summaries.
 * @param {string} [params.activeCleanTag=''] - Active normalized player tag.
 * @param {boolean} [params.isFiltering=false] - Whether dropdown filtering is active.
 * @param {string} [params.cleanQuery=''] - Search filter query.
 * @param {string} [params.idPrefix=''] - Optional prefix for item id attributes.
 * @returns {string} Standardized HTML markup string.
 */
export function renderStandaloneDropdownMarkup({
    savedProfiles = [],
    activeCleanTag = '',
    isFiltering = false,
    cleanQuery = '',
    idPrefix = ''
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
        const isDefaultTag = cleanTag === 'DEFAULT0';
        const thLevel = Math.min(Math.max(Number(p.townHallLevel) || 1, 1), 18);
        const thImg = `assets/th/th${thLevel}.png`;
        const idAttr = idPrefix ? `id="${idPrefix}-${index}" ` : '';

        return `<div ${idAttr}class="player-dropdown-item ${isActive ? 'active is-active' : ''}" data-tag="${escapeHTML(cleanTag)}" tabindex="${isActive ? '0' : '-1'}" role="option" aria-selected="${isActive}">
            <div class="player-dropdown-th-wrapper">
                <clashcalc-assets-image src="${thImg}" alt="TH ${thLevel}" class="player-dropdown-th"></clashcalc-assets-image>
                <span class="player-dropdown-th-badge">${thLevel}</span>
            </div>
            <div class="player-info-text">
                <span>${playerName}</span>
                <span class="player-tag-text">${escapeHTML(displayTag)}</span>
            </div>
            <button class="remove-player-button delete-player-button" data-tag="${escapeHTML(cleanTag)}" ${isDefaultTag ? 'disabled' : ''} tabindex="-1" aria-label="${escapeHTML(translate('player.removePlayer'))}: ${playerName}" title="${escapeHTML(translate('player.removePlayer'))}">
                ${getSVG('trash', '', 16, 16, 'currentColor')}
            </button>
        </div>`;
    }).join('');

    return html;
}

/**
 * Universal renderer for player dropdown list and selected player label.
 *
 * @param {string | Object} [activeTagOrOptions=''] - Active player tag or options/handlers object.
 * @param {Object} [options={}] - Render configuration options.
 * @param {string} [options.idPrefix=''] - Optional element ID prefix for items.
 * @param {string} [options.fallbackName=''] - Fallback name if active profile summary is missing.
 */
export function renderPlayerDropdown(activeTagOrOptions = '', options = {}) {
    updateRefreshButtonVisibility();

    const playerItemsContainer = dom.player?.playerItemsContainer || (typeof document !== 'undefined' ? document.getElementById('player-items-container') : null);
    const selectedPlayerName = dom.player?.selectedPlayerName || (typeof document !== 'undefined' ? document.getElementById('selected-player-name') : null);
    const dropdownButton = dom.player?.dropdownButton || (typeof document !== 'undefined' ? document.getElementById('player-dropdown-button') : null);

    if (!playerItemsContainer || !selectedPlayerName) return;

    const configOptions = (typeof activeTagOrOptions === 'object' && activeTagOrOptions !== null) ? activeTagOrOptions : options;

    let cleanActiveTag = '';
    if (typeof activeTagOrOptions === 'string' && activeTagOrOptions.trim()) {
        cleanActiveTag = normalizePlayerTag(activeTagOrOptions.trim());
    } else if (typeof activeTagOrOptions === 'object' && activeTagOrOptions !== null && activeTagOrOptions.activeCleanTag) {
        cleanActiveTag = normalizePlayerTag(activeTagOrOptions.activeCleanTag);
    } else if (state?.savedPlayerTags?.[0]) {
        cleanActiveTag = normalizePlayerTag(state.savedPlayerTags[0]);
    }

    const cachedProfiles = getSavedProfiles();
    const hasExplicitStateTags = Array.isArray(state?.savedPlayerTags) && state.savedPlayerTags.length > 0;

    const savedProfiles = hasExplicitStateTags
        ? state.savedPlayerTags
            .map(normalizePlayerTag)
            .filter(t => t && t !== 'DEFAULT0')
            .map(cleanTag => {
                const cached = cachedProfiles.find(p => normalizePlayerTag(p.cleanTag || p.tag) === cleanTag);
                if (cached) return cached;
                const loaded = typeof loadPlayerData === 'function' ? loadPlayerData(cleanTag) : null;
                const profile = loaded?.playerProfile || null;
                return {
                    tag: formatDisplayTag(cleanTag),
                    cleanTag,
                    name: profile?.name || formatDisplayTag(cleanTag),
                    townHallLevel: Number(profile?.townHallLevel) || 1,
                    trophies: Number(profile?.trophies) || 0
                };
            })
        : cachedProfiles;

    if (cleanActiveTag && cleanActiveTag !== 'DEFAULT0') {
        const activeProfile = savedProfiles.find(p => normalizePlayerTag(p.cleanTag || p.tag) === cleanActiveTag);
        let resolvedName = activeProfile?.name || configOptions.fallbackName || '';
        if (!resolvedName && typeof loadPlayerData === 'function') {
            const loaded = loadPlayerData(cleanActiveTag);
            resolvedName = loaded?.playerProfile?.name || '';
        }
        selectedPlayerName.textContent = resolvedName || formatDisplayTag(cleanActiveTag) || translate('player.label');
    } else {
        selectedPlayerName.textContent = translate('player.addPlayer');
    }

    if (dropdownButton) {
        dropdownButton.setAttribute('aria-label', selectedPlayerName.textContent);
    }

    const currentLang = state?.uiSettings?.language || 'en';
    const profileKeys = savedProfiles.map(p => normalizePlayerTag(p.cleanTag || p.tag)).join(',');
    const currentKey = `${cleanActiveTag}|${profileKeys}|${currentLang}|${configOptions.idPrefix || ''}`;

    if (currentKey === lastRenderStateKey && playerItemsContainer.children?.length > 0) {
        return;
    }
    lastRenderStateKey = currentKey;

    playerItemsContainer.innerHTML = renderStandaloneDropdownMarkup({
        savedProfiles,
        activeCleanTag: cleanActiveTag,
        idPrefix: configOptions.idPrefix || ''
    });
}

export { renderPlayerDropdown as renderStandalonePlayerDropdown };
