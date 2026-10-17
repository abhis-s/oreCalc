/**
 * Pure DOM presentation and layout construction for the Spotright Search Palette.
 * Tier 4: UI Renderer (Zero event listeners, pure DOM manipulation).
 */

import { translate } from '../../i18n/translator.js';
import { escapeHTML } from '../../utils/stringUtils.js';
import { sanitizeHTML } from '../../ui/noticeModal.js';
import { formatNumber } from '../../utils/numberFormatter.js';

/**
 * Creates and returns the modal dialog element for Spotright search.
 * @returns {HTMLDialogElement}
 */
export function createSpotrightDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'clashcalc-spotright';
    dialog.className = 'spotright-dialog';
    dialog.setAttribute('aria-label', translate('views.spotright.placeholder'));

    const rawEsc = translate('views.shortcuts.keys.keyboardEsc');
    const escLabel = (rawEsc && rawEsc !== 'views.shortcuts.keys.keyboardEsc') ? rawEsc : 'ESC';

    dialog.innerHTML = `
        <div class="spotright-card" id="spotright-card">
            <div class="spotright-search-bar">
                <clashcalc-assets-svg name="search" class="spotright-search-icon"></clashcalc-assets-svg>
                <div class="spotright-input-container">
                    <span id="spotright-scope-badge" class="spotright-scope-badge" hidden>
                        <span id="spotright-scope-label" class="spotright-scope-label"></span>
                        <button type="button" id="spotright-scope-clear" class="spotright-scope-clear-btn" aria-label="${escapeHTML(translate('actions.close'))}"><clashcalc-assets-svg name="close" width="10" height="10"></clashcalc-assets-svg></button>
                    </span>
                    <div class="spotright-input-field-wrapper">
                        <input
                            type="text"
                            id="spotright-input"
                            class="spotright-input"
                            placeholder="${escapeHTML(translate('views.spotright.placeholder'))}"
                            autocomplete="off"
                            autocorrect="off"
                            autocapitalize="off"
                            spellcheck="false"
                            data-i18n-placeholder="views.spotright.placeholder"
                        />
                        <div id="spotright-ghost-autocomplete" class="spotright-ghost-autocomplete" hidden aria-hidden="true"></div>
                    </div>
                    <button type="button" id="spotright-clear-btn" class="spotright-clear-btn" aria-label="${escapeHTML(translate('views.heroJourney.page.clearSearch'))}" title="${escapeHTML(translate('views.heroJourney.page.clearSearch'))}" data-i18n-aria-label="views.heroJourney.page.clearSearch" data-i18n-title="views.heroJourney.page.clearSearch" hidden>
                        <clashcalc-assets-svg name="close" width="12" height="12"></clashcalc-assets-svg>
                    </button>
                </div>
                <kbd class="spotright-kbd-shortcut" data-i18n="views.shortcuts.keys.keyboardEsc">${escapeHTML(escLabel)}</kbd>
            </div>
            <div id="spotright-filter-track" class="spotright-filter-track" role="tablist" aria-label="${escapeHTML(translate('views.heroJourney.filters.filterByType'))}">
                <button type="button" class="spotright-filter-chip is-active" data-scope="all" role="tab" aria-selected="true" data-i18n="views.heroJourney.filters.filterAll">${escapeHTML(translate('views.heroJourney.filters.filterAll'))}</button>
                <button type="button" class="spotright-filter-chip" data-scope="villages" role="tab" aria-selected="false" data-i18n="nav.views.hub.villages">${escapeHTML(translate('nav.views.hub.villages'))}</button>
                <button type="button" class="spotright-filter-chip" data-scope="equipment" role="tab" aria-selected="false" data-i18n="nav.equipment">${escapeHTML(translate('nav.equipment'))}</button>
                <button type="button" class="spotright-filter-chip" data-scope="hero" role="tab" aria-selected="false" data-i18n="views.damageCalc.filters.filterHeroes">${escapeHTML(translate('views.damageCalc.filters.filterHeroes'))}</button>
                <button type="button" class="spotright-filter-chip" data-scope="tools" role="tab" aria-selected="false" data-i18n="nav.drawerTitle">${escapeHTML(translate('nav.drawerTitle'))}</button>
                <button type="button" class="spotright-filter-chip" data-scope="settings" role="tab" aria-selected="false" data-i18n="nav.settings">${escapeHTML(translate('nav.settings'))}</button>
            </div>
            <div id="spotright-results" class="spotright-results" role="listbox" aria-label="${escapeHTML(translate('views.spotright.placeholder'))}"></div>
            <div class="spotright-footer">
                <button type="button" id="spotright-feedback-btn" class="spotright-footer-feedback-btn"
                    aria-label="${escapeHTML(translate('views.settings.feedback.title'))}"
                    title="${escapeHTML(translate('views.settings.feedback.title'))}"
                    data-i18n-title="views.settings.feedback.title">
                    <clashcalc-assets-svg name="feedback" class="spotright-footer-feedback-icon"></clashcalc-assets-svg>
                    <span class="spotright-footer-feedback-label" data-i18n="views.settings.feedback.title">${escapeHTML(translate('views.settings.feedback.title'))}</span>
                </button>
                <button type="button" id="spotright-shortcuts-btn" class="spotright-footer-shortcuts-btn"
                    aria-label="${escapeHTML(translate('views.shortcuts.title'))}"
                    title="${escapeHTML(translate('views.shortcuts.title'))}"
                    data-i18n-title="views.shortcuts.title">
                    <clashcalc-assets-svg name="keyboard" class="spotright-footer-shortcuts-icon"></clashcalc-assets-svg>
                    <span class="spotright-footer-shortcuts-label" data-i18n="views.shortcuts.title">${escapeHTML(translate('views.shortcuts.title'))}</span>
                    <kbd class="spotright-footer-kbd">?</kbd>
                </button>
                <div class="spotright-footer-brand" title="${escapeHTML(translate('views.spotright.betaTooltip'))}" data-i18n-title="views.spotright.betaTooltip">
                    <span class="spotright-footer-brand-name">Spotright</span>
                    <span class="spotright-footer-beta-chip" data-i18n="views.spotright.beta">${escapeHTML(translate('views.spotright.beta'))}</span>
                </div>
            </div>
        </div>
    `;

    return dialog;
}

/**
 * Renders the search result list or empty state inside the results container.
 *
 * @param {HTMLElement} container - The #spotright-results element.
 * @param {import('./spotrightRegistry.js').SpotrightItem[]} matches - Scored match items.
 * @param {number} selectedIndex - Currently highlighted item index.
 */
/**
 * Safely escapes HTML and wraps matching query substrings in highlight markup.
 *
 * @param {string} text - Raw string to display.
 * @param {string} query - Raw user search query.
 * @returns {string} Sanitized HTML string with matching substrings highlighted.
 */
export function highlightMatch(text, query) {
    if (!text) return '';
    if (!query || typeof query !== 'string') return escapeHTML(text);

    let cleanQuery = query.trim().toLowerCase();
    if (cleanQuery.startsWith('/') || cleanQuery.startsWith('@')) {
        cleanQuery = cleanQuery.slice(1).trim();
    }
    if (!cleanQuery) return escapeHTML(text);

    const lowerText = text.toLowerCase();

    // 1. Try full exact query match first
    const exactIdx = lowerText.indexOf(cleanQuery);
    if (exactIdx !== -1) {
        return (
            escapeHTML(text.slice(0, exactIdx)) +
            `<mark class="spotright-match-highlight">${escapeHTML(text.slice(exactIdx, exactIdx + cleanQuery.length))}</mark>` +
            escapeHTML(text.slice(exactIdx + cleanQuery.length))
        );
    }

    // 2. Multi-token match: highlight individual whitespace-separated tokens (>= 2 chars)
    const tokens = cleanQuery.split(/\s+/).filter(t => t.length >= 2);
    if (tokens.length === 0) return escapeHTML(text);

    const ranges = [];
    for (const token of tokens) {
        let searchFrom = 0;
        let matchIdx = lowerText.indexOf(token, searchFrom);
        while (matchIdx !== -1) {
            ranges.push([matchIdx, matchIdx + token.length]);
            searchFrom = matchIdx + token.length;
            matchIdx = lowerText.indexOf(token, searchFrom);
        }
    }

    if (ranges.length === 0) return escapeHTML(text);

    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [ranges[0]];
    for (let i = 1; i < ranges.length; i++) {
        const last = merged[merged.length - 1];
        const curr = ranges[i];
        if (curr[0] <= last[1]) {
            last[1] = Math.max(last[1], curr[1]);
        } else {
            merged.push(curr);
        }
    }

    let result = '';
    let lastIndex = 0;
    for (const [start, end] of merged) {
        result += escapeHTML(text.slice(lastIndex, start));
        result += `<mark class="spotright-match-highlight">${escapeHTML(text.slice(start, end))}</mark>`;
        lastIndex = end;
    }
    result += escapeHTML(text.slice(lastIndex));
    return result;
}

/**
 * Renders the search results list into the container element.
 *
 * @param {HTMLElement} container - Results container element.
 * @param {import('./spotrightRegistry.js').SpotrightItem[]} matches - Matched items.
 * @param {number} selectedIndex - Currently highlighted item index.
 * @param {string} [currentQuery=''] - Active user query for substring highlighting.
 */
export function renderSpotrightResults(container, matches, selectedIndex, currentQuery = '') {
    if (!container) return;

    if (matches.length === 0) {
        container.innerHTML = `
            <div class="spotright-empty-state">
                <clashcalc-assets-svg name="search" class="spotright-empty-icon"></clashcalc-assets-svg>
                <p class="spotright-empty-text" data-i18n="views.spotright.noResults">${escapeHTML(translate('views.spotright.noResults'))}</p>
                <button type="button" id="spotright-empty-reset-btn" class="btn-secondary spotright-empty-reset-btn">
                    <clashcalc-assets-svg name="close" width="12" height="12"></clashcalc-assets-svg>
                    <span data-i18n="views.damageCalc.filters.resetFiltersBtn">${escapeHTML(translate('views.damageCalc.filters.resetFiltersBtn'))}</span>
                </button>
            </div>
        `;
        return;
    }

    let lastCategory = '';
    const htmlChunks = [];

    matches.forEach((item, idx) => {
        if (item.category && item.category !== lastCategory) {
            lastCategory = item.category;
            const isRecentHeading = Boolean(item.isRecent);
            const clearBtnHtml = isRecentHeading
                ? `<button type="button" class="spotright-recent-clear-btn" aria-label="${escapeHTML(translate('actions.clear'))}" title="${escapeHTML(translate('actions.clear'))}">
                    <clashcalc-assets-svg name="trash" width="16" height="16"></clashcalc-assets-svg>
                </button>`
                : '';
            htmlChunks.push(`
                <div class="spotright-category-heading ${isRecentHeading ? 'spotright-category-heading--with-action' : ''}" role="presentation">
                    <span>${escapeHTML(item.category)}</span>
                    ${clearBtnHtml}
                </div>
            `);
        }

        const isSelected = idx === selectedIndex;
        const iconHtml = item.isVillage
            ? `<div class="spotright-th-wrapper"><clashcalc-assets-image src="${item.icon}" alt="${escapeHTML(translate('entities.defenses.townHall'))} ${item.thLevel}" class="spotright-th-img" size="standard"></clashcalc-assets-image><span class="spotright-th-badge">${item.thLevel}</span></div>`
            : `<div class="spotright-item-icon-wrapper ${item.iconType === 'image' ? 'spotright-item-icon--image' : 'spotright-item-icon--svg'}">${
                item.iconType === 'image'
                    ? `<clashcalc-assets-image src="${item.icon}" alt="${escapeHTML(item.title)}" class="spotright-item-icon"></clashcalc-assets-image>`
                    : `<clashcalc-assets-svg name="${item.icon}" class="spotright-item-icon"></clashcalc-assets-svg>`
            }</div>`;

        let tagHtml = '';
        if (item.isVillage) {
            const displayTag = item.displayTag || (item.cleanTag ? `#${item.cleanTag}` : '');
            tagHtml = `<span class="spotright-village-tag">${escapeHTML(displayTag)}</span>`;
            if (item.isActiveVillage) {
                tagHtml += `<span class="spotright-item-tag spotright-tag--active">${escapeHTML(translate('views.spotright.activeVillage') || 'Active')}</span>`;
            }
        } else if (item.entityType === 'epic' || item.entityType === 'common') {
            const rarityText = item.entityType === 'epic'
                ? (translate('views.equipment.epic') || 'Epic')
                : (translate('views.equipment.common') || 'Common');
            tagHtml = `<span class="spotright-item-tag spotright-tag--${item.entityType}">${escapeHTML(rarityText)}</span>`;
        }

        const breadcrumbHtml = item.parentContext
            ? `<span class="spotright-item-breadcrumb">&bull; ${escapeHTML(item.parentContext)}</span>`
            : '';

        const heroContextHtml = item.heroName && (item.entityType === 'epic' || item.entityType === 'common')
            ? `<span class="spotright-item-hero-context">${escapeHTML(item.heroName)}</span>`
            : '';

        const isItemLoading = Boolean(item.isLoading);
        const hasItemError = Boolean(item.errorMessage);
        let subtitleHtml = '';
        if (hasItemError) {
            subtitleHtml = `<span class="spotright-item-subtitle spotright-item-subtitle--error">${sanitizeHTML(item.errorMessage)}</span>`;
        } else if (item.isVillage) {
            const clanBadgeHtml = item.clanBadge
                ? `<clashcalc-assets-image src="${item.clanBadge}" alt="" class="spotright-meta-clan-badge" size="standard"></clashcalc-assets-image>`
                : '';
            const clanNameText = item.clanName || translate('views.guidedSetup.noClan') || 'No Clan';
            const clanHtml = `<span class="spotright-meta-clan">${clanBadgeHtml}<span class="spotright-meta-clan-name">${escapeHTML(clanNameText)}</span></span>`;

            const trophiesHtml = `
                <span class="spotright-meta-trophies">
                    <clashcalc-assets-svg name="trophy" width="12" height="12" class="spotright-trophy-icon" aria-hidden="true"></clashcalc-assets-svg>
                    <span>${formatNumber(Number(item.trophies) || 0)}</span>
                </span>
            `;

            const leagueHtml = item.leagueIcon
                ? `<clashcalc-assets-image src="${item.leagueIcon}" alt="${escapeHTML(item.leagueName || '')}" class="spotright-meta-league-icon" size="standard" title="${escapeHTML(item.leagueName || '')}"></clashcalc-assets-image>`
                : '';

            subtitleHtml = `
                <div class="spotright-village-meta">
                    ${clanHtml}
                    <span class="spotright-meta-divider">&bull;</span>
                    ${trophiesHtml}
                    ${leagueHtml}
                </div>
            `;
        } else if (item.subtitle && !item.isScopeSuggestion) {
            subtitleHtml = `<span class="spotright-item-subtitle">${escapeHTML(item.subtitle)}</span>`;
        }

        let actionHtml = '';
        if (isItemLoading) {
            actionHtml = `
                <clashcalc-assets-svg name="refresh" class="spotright-item-spinner" width="14" height="14"></clashcalc-assets-svg>
            `;
        } else if (item.isActiveVillage) {
            actionHtml = `
                <span class="spotright-action-active-icon"><clashcalc-assets-svg name="check" width="14" height="14"></clashcalc-assets-svg></span>
            `;
        } else if (item.isScopeSuggestion) {
            actionHtml = `
                <kbd class="spotright-action-tab" aria-label="${escapeHTML(translate('views.shortcuts.keys.keyboardTab'))}">
                    <span class="spotright-tab-label">Tab</span>
                    <clashcalc-assets-svg name="keyboard-tab" width="12" height="12"></clashcalc-assets-svg>
                </kbd>
            `;
        } else {
            actionHtml = `
                <kbd class="spotright-action-enter" aria-label="${escapeHTML(translate('views.shortcuts.keys.keyboardEnter'))}"><clashcalc-assets-svg name="keyboard-return" width="14" height="14"></clashcalc-assets-svg></kbd>
            `;
        }

        const villageClass = item.isVillage ? 'spotright-result-item--village' : '';
        const activeVillageClass = item.isActiveVillage ? 'is-active-village' : '';
        const scopeSuggestionClass = item.isScopeSuggestion ? 'spotright-result-item--scope-suggestion' : '';

        const commandPillHtml = item.isScopeSuggestion && item.command
            ? `<code class="spotright-command-pill">${highlightMatch(item.command, currentQuery)}</code>`
            : '';

        htmlChunks.push(`
            <div
                class="spotright-result-item ${villageClass} ${activeVillageClass} ${scopeSuggestionClass} ${isSelected ? 'selected' : ''} ${isItemLoading ? 'is-loading' : ''} ${hasItemError ? 'has-error' : ''}"
                role="option"
                aria-selected="${isSelected ? 'true' : 'false'}"
                data-index="${idx}"
                data-id="${escapeHTML(item.id)}"
            >
                ${iconHtml}
                <div class="spotright-item-content">
                    <div class="spotright-item-header">
                        ${commandPillHtml}
                        <span class="spotright-item-title">${highlightMatch(item.title, currentQuery)}</span>
                        ${breadcrumbHtml}
                        ${heroContextHtml}
                        ${tagHtml}
                    </div>
                    ${subtitleHtml}
                </div>
                <div class="spotright-item-action">
                    ${actionHtml}
                    ${item.isRecent ? `
                        <button type="button" class="spotright-recent-remove-btn" data-item-id="${escapeHTML(item.id)}" aria-label="${escapeHTML(translate('actions.remove'))}" title="${escapeHTML(translate('actions.remove'))}">
                            <clashcalc-assets-svg name="close" width="16" height="16"></clashcalc-assets-svg>
                        </button>
                    ` : ''}
                </div>
            </div>
        `);
    });

    container.innerHTML = htmlChunks.join('');
}

/**
 * Triggers standard shake feedback on the Spotright modal card.
 *
 * @param {HTMLElement | null} dialog
 */
export function triggerCardShake(dialog) {
    if (!dialog) return;
    const card = dialog.querySelector('#spotright-card');
    if (!card) return;

    card.classList.remove('shake');
    void card.offsetWidth; // Force synchronous reflow to re-trigger CSS keyframe
    card.classList.add('shake');
}

/**
 * Updates the selected item highlighting efficiently without re-rendering the DOM tree.
 *
 * @param {HTMLElement} container - The #spotright-results container.
 * @param {number} selectedIndex - New selected item index.
 */
export function updateSpotrightSelection(container, selectedIndex) {
    if (!container) return;
    const items = container.querySelectorAll('.spotright-result-item');

    items.forEach((item, idx) => {
        const isSelected = idx === selectedIndex;
        item.classList.toggle('selected', isSelected);
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        if (isSelected) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

/**
 * Updates inline ghost autocomplete text overlay.
 *
 * @param {HTMLElement|null} ghostEl - The ghost text container element.
 * @param {string} inputVal - The user-typed input string.
 * @param {{ completionText: string, fullTitle: string } | null} autocomplete - Autocomplete descriptor.
 */
export function updateGhostAutocomplete(ghostEl, inputVal, autocomplete) {
    if (!ghostEl) return;

    if (autocomplete && autocomplete.completionText && inputVal) {
        ghostEl.innerHTML = `<span class="spotright-ghost-prefix" aria-hidden="true">${escapeHTML(inputVal)}</span><span class="spotright-ghost-suffix">${escapeHTML(autocomplete.completionText)}</span>`;
        ghostEl.hidden = false;
    } else {
        ghostEl.innerHTML = '';
        ghostEl.hidden = true;
    }
}

/** @type {Record<string, string>} Scope label translation keys */
export const SCOPE_TRANSLATION_KEYS = {
    all: 'views.heroJourney.filters.filterAll',
    villages: 'nav.views.hub.villages',
    equipment: 'nav.equipment',
    hero: 'views.damageCalc.filters.filterHeroes',
    tools: 'nav.drawerTitle',
    settings: 'nav.settings'
};

/**
 * Updates the in-input scope badge element and input placeholder.
 *
 * @param {HTMLElement|null} badgeEl - The #spotright-scope-badge container.
 * @param {HTMLInputElement|null} inputEl - The search input field.
 * @param {string} scope - Active scope identifier ('all', 'equipment', 'hero', 'tools', 'settings').
 */
export function updateSpotrightScopeBadge(badgeEl, inputEl, scope) {
    if (!badgeEl || !inputEl) return;

    if (!scope || scope === 'all') {
        badgeEl.hidden = true;
        inputEl.placeholder = translate('views.spotright.placeholder');
        return;
    }

    badgeEl.hidden = false;
    const labelEl = typeof badgeEl.querySelector === 'function' ? badgeEl.querySelector('#spotright-scope-label') : null;
    const translationKey = SCOPE_TRANSLATION_KEYS[scope];
    if (labelEl && translationKey) {
        labelEl.textContent = translate(translationKey);
    }

    inputEl.placeholder = `${translate(translationKey || 'views.spotright.placeholder')}...`;
}

/**
 * Updates the filter chips track active state and ARIA attributes.
 *
 * @param {HTMLElement|null} trackEl - The #spotright-filter-track element.
 * @param {string} scope - Active scope identifier.
 */
export function updateSpotrightFilterChips(trackEl, scope) {
    if (!trackEl || typeof trackEl.querySelectorAll !== 'function') return;

    const chips = trackEl.querySelectorAll('.spotright-filter-chip');
    chips.forEach(chip => {
        const chipScope = chip.getAttribute('data-scope') || 'all';
        const isActive = chipScope === scope;
        chip.classList.toggle('is-active', isActive);
        chip.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
}
