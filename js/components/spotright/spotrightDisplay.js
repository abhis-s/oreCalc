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
                </div>
                <div id="spotright-action-hint" class="spotright-action-hint" hidden aria-hidden="true"></div>
                <kbd class="spotright-kbd-shortcut">ESC</kbd>
            </div>
            <div id="spotright-filter-track" class="spotright-filter-track" role="tablist" aria-label="Filter scope">
                <button type="button" class="spotright-filter-chip is-active" data-scope="all" role="tab" aria-selected="true" data-i18n="views.heroJourney.filters.filterAll">${escapeHTML(translate('views.heroJourney.filters.filterAll'))}</button>
                <button type="button" class="spotright-filter-chip" data-scope="villages" role="tab" aria-selected="false" data-i18n="views.spotright.scopes.villages">${escapeHTML(translate('views.spotright.scopes.villages'))}</button>
                <button type="button" class="spotright-filter-chip" data-scope="equipment" role="tab" aria-selected="false" data-i18n="nav.equipment">${escapeHTML(translate('nav.equipment'))}</button>
                <button type="button" class="spotright-filter-chip" data-scope="hero" role="tab" aria-selected="false" data-i18n="views.damageCalc.filters.filterHeroes">${escapeHTML(translate('views.damageCalc.filters.filterHeroes'))}</button>
                <button type="button" class="spotright-filter-chip" data-scope="tools" role="tab" aria-selected="false" data-i18n="views.spotright.scopes.tools">${escapeHTML(translate('views.spotright.scopes.tools'))}</button>
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
export function renderSpotrightResults(container, matches, selectedIndex) {
    if (!container) return;

    if (matches.length === 0) {
        container.innerHTML = `
            <div class="spotright-empty-state">
                <clashcalc-assets-svg name="search" class="spotright-empty-icon"></clashcalc-assets-svg>
                <p class="spotright-empty-text" data-i18n="views.spotright.noResults">${escapeHTML(translate('views.spotright.noResults'))}</p>
            </div>
        `;
        return;
    }

    let lastCategory = '';
    const htmlChunks = [];

    matches.forEach((item, idx) => {
        if (item.category && item.category !== lastCategory) {
            lastCategory = item.category;
            htmlChunks.push(`
                <div class="spotright-category-heading" role="presentation">
                    <span>${escapeHTML(item.category)}</span>
                </div>
            `);
        }

        const isSelected = idx === selectedIndex;
        const iconHtml = item.isVillage
            ? `<div class="spotright-th-wrapper"><clashcalc-assets-image src="${item.icon}" alt="TH${item.thLevel}" class="spotright-th-img" size="standard"></clashcalc-assets-image><span class="spotright-th-badge">${item.thLevel}</span></div>`
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
            tagHtml = `<span class="spotright-item-tag spotright-tag--${item.entityType}">${escapeHTML(item.entityType)}</span>`;
        }

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
        } else {
            subtitleHtml = `<span class="spotright-item-subtitle">${escapeHTML(item.subtitle)}</span>`;
        }

        let actionHtml = '';
        if (isItemLoading) {
            actionHtml = `
                <clashcalc-assets-svg name="refresh" class="spotright-item-spinner" width="14" height="14"></clashcalc-assets-svg>
                <span class="spotright-action-label">${escapeHTML(translate('actions.loading'))}</span>
            `;
        } else if (item.isActiveVillage) {
            actionHtml = `
                <span class="spotright-action-label">${escapeHTML(translate('views.spotright.activeVillage') || 'Active')}</span>
                <span class="spotright-action-active-icon"><clashcalc-assets-svg name="check" width="14" height="14"></clashcalc-assets-svg></span>
            `;
        } else {
            const actionLabel = hasItemError ? (translate('actions.reload') || 'Retry') : item.actionCue;
            actionHtml = `
                <span class="spotright-action-label">${escapeHTML(actionLabel)}</span>
                <kbd class="spotright-action-enter" aria-label="Enter"><clashcalc-assets-svg name="keyboard-return" width="14" height="14"></clashcalc-assets-svg></kbd>
            `;
        }

        const villageClass = item.isVillage ? 'spotright-result-item--village' : '';
        const activeVillageClass = item.isActiveVillage ? 'is-active-village' : '';

        htmlChunks.push(`
            <div
                class="spotright-result-item ${villageClass} ${activeVillageClass} ${isSelected ? 'selected' : ''} ${isItemLoading ? 'is-loading' : ''} ${hasItemError ? 'has-error' : ''}"
                role="option"
                aria-selected="${isSelected ? 'true' : 'false'}"
                data-index="${idx}"
                data-id="${escapeHTML(item.id)}"
            >
                ${iconHtml}
                <div class="spotright-item-content">
                    <div class="spotright-item-header">
                        <span class="spotright-item-title">${escapeHTML(item.title)}</span>
                        ${tagHtml}
                    </div>
                    ${subtitleHtml}
                </div>
                <div class="spotright-item-action">
                    ${actionHtml}
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

/**
 * Updates top hit action cue suffix in the search bar.
 *
 * @param {HTMLElement|null} hintEl - The action hint container.
 * @param {{ actionCue: string } | null} autocomplete - Autocomplete descriptor.
 */
export function updateTopHitHint(hintEl, autocomplete) {
    if (!hintEl) return;

    if (autocomplete && autocomplete.actionCue) {
        hintEl.textContent = `${autocomplete.actionCue}`;
        hintEl.hidden = false;
    } else {
        hintEl.textContent = '';
        hintEl.hidden = true;
    }
}

/** @type {Record<string, string>} Scope label translation keys */
const SCOPE_TRANSLATION_KEYS = {
    all: 'views.heroJourney.filters.filterAll',
    villages: 'views.spotright.scopes.villages',
    equipment: 'nav.equipment',
    hero: 'views.damageCalc.filters.filterHeroes',
    tools: 'views.spotright.scopes.tools',
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
