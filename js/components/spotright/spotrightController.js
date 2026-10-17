/**
 * Controller and event coordinator for the Spotright Search Palette.
 * Tier 4: Search Controller (Keyboard traps, selection cycling, action invocation).
 */

import { buildSpotrightRegistry, getActiveUrlTag } from './spotrightRegistry.js';
import { extractScopePrefix, searchSpotright } from './spotrightMatcher.js';
import {
    createSpotrightDialog,
    renderSpotrightResults,
    updateSpotrightSelection,
    updateGhostAutocomplete,
    updateTopHitHint,
    updateSpotrightScopeBadge,
    updateSpotrightFilterChips,
    triggerCardShake
} from './spotrightDisplay.js';
import { openFeedbackModal } from '../appSettings/settingsSupportModals.js';
import { openShortcutsModal } from '../shortcuts/shortcutsModal.js';
import { detectClipboardPlayerTag, createClipboardSpotrightItem } from './spotrightClipboard.js';
import { addRecentItem, removeRecentItem, clearRecentItems } from './spotrightRecents.js';
import { translate } from '../../i18n/translator.js';

/** @type {boolean} Guard preventing concurrent action execution while an async network lookup is in flight */
let isActionInFlight = false;

/** @type {import('./spotrightRegistry.js').SpotrightItem[] | null} Cached pre-indexed registry */
let registryCache = null;

/** @type {string | null} Detected clipboard player tag when permission is granted */
let currentClipboardTag = null;

/** @type {HTMLDialogElement | null} */
let dialogEl = null;

/** @type {HTMLInputElement | null} */
let inputEl = null;

/** @type {HTMLElement | null} */
let resultsEl = null;

/** @type {HTMLElement | null} */
let ghostEl = null;

/** @type {HTMLElement | null} */
let hintEl = null;

/** @type {HTMLElement | null} */
let badgeEl = null;

/** @type {HTMLElement | null} */
let trackEl = null;

/** @type {import('./spotrightMatcher.js').SpotrightScope} */
let currentScope = 'all';

/** @type {import('./spotrightRegistry.js').SpotrightItem[]} */
let currentMatches = [];

/** @type {number} */
let currentSelectedIndex = 0;

/** @type {{ completionText: string, fullTitle: string, actionCue: string } | null} */
let currentAutocomplete = null;

/** @type {boolean} */
let isInitialized = false;

/**
 * Safely calls requestAnimationFrame if available, falling back to synchronous execution.
 * @param {FrameRequestCallback} cb
 */
const safeRaf = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
    ? window.requestAnimationFrame.bind(window)
    : (cb) => cb(0);

/**
 * Ensures Spotright DOM elements are mounted and event bindings established.
 */
function ensureMounted() {
    if (dialogEl && document.body.contains(dialogEl)) return;

    dialogEl = createSpotrightDialog();
    document.body.appendChild(dialogEl);

    inputEl = dialogEl.querySelector('#spotright-input');
    resultsEl = dialogEl.querySelector('#spotright-results');
    ghostEl = dialogEl.querySelector('#spotright-ghost-autocomplete');
    hintEl = dialogEl.querySelector('#spotright-action-hint');
    badgeEl = dialogEl.querySelector('#spotright-scope-badge');
    trackEl = dialogEl.querySelector('#spotright-filter-track');

    // In-input scope badge clear button click
    const clearBadgeBtn = dialogEl.querySelector('#spotright-scope-clear');
    clearBadgeBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setScope('all');
    });

    // Filter track chip click delegation
    trackEl?.addEventListener('click', (event) => {
        const chip = /** @type {HTMLElement|null} */ (event.target)?.closest('.spotright-filter-chip');
        if (!chip) return;
        const scope = /** @type {import('./spotrightMatcher.js').SpotrightScope} */ (chip.getAttribute('data-scope') || 'all');
        setScope(scope);
    });

    // Dialog Backdrop Click Dismissal
    dialogEl.addEventListener('click', (event) => {
        const card = dialogEl?.querySelector('#spotright-card');
        if (card && !card.contains(/** @type {Node} */ (event.target))) {
            closeSpotright();
        }
    });

    // Native dialog cancel (ESC)
    dialogEl.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeSpotright();
    });

    // Reset card shake animation state automatically upon completion
    const card = dialogEl.querySelector('#spotright-card');
    card?.addEventListener?.('animationend', () => {
        card?.classList?.remove?.('shake');
    });

    // Input events
    inputEl?.addEventListener('input', handleInputChange);
    inputEl?.addEventListener('keydown', handleInputKeydown);

    // Results hover synchronization
    resultsEl?.addEventListener('mousemove', (event) => {
        if (isActionInFlight) return;
        const row = /** @type {HTMLElement | null} */ (event.target)?.closest('.spotright-result-item');
        if (!row) return;

        const index = Number(row.dataset.index);
        if (!isNaN(index) && index !== currentSelectedIndex && currentMatches[index]) {
            currentSelectedIndex = index;
            if (resultsEl) updateSpotrightSelection(resultsEl, currentSelectedIndex);
        }
    });

    // Results click delegation
    resultsEl?.addEventListener('click', (event) => {
        const target = /** @type {HTMLElement | null} */ (event.target);

        // Individual recent item remove
        const removeBtn = target?.closest('.spotright-recent-remove-btn');
        if (removeBtn) {
            event.preventDefault();
            event.stopPropagation();
            const itemId = /** @type {HTMLElement} */ (removeBtn).dataset.itemId;
            if (itemId) {
                removeRecentItem(itemId);
                handleInputChange();
            }
            return;
        }

        // Clear all recent items
        const clearBtn = target?.closest('.spotright-recent-clear-btn');
        if (clearBtn) {
            event.preventDefault();
            event.stopPropagation();
            clearRecentItems();
            handleInputChange();
            return;
        }

        const row = target?.closest('.spotright-result-item');
        if (!row) return;

        const index = Number(row.dataset.index);
        if (!isNaN(index) && currentMatches[index]) {
            currentSelectedIndex = index;
            executeCurrentSelection();
        }
    });

    // Feedback trigger in Spotright footer
    const feedbackBtn = dialogEl.querySelector('#spotright-feedback-btn');
    feedbackBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSpotright();
        safeRaf(() => {
            openFeedbackModal();
        });
    });

    // Shortcuts trigger in Spotright footer
    const shortcutsBtn = dialogEl.querySelector('#spotright-shortcuts-btn');
    shortcutsBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeSpotright();
        safeRaf(() => {
            openShortcutsModal();
        });
    });
}

/**
 * Updates active search domain scope and re-executes search query.
 * @param {import('./spotrightMatcher.js').SpotrightScope} newScope
 */
function setScope(newScope) {
    currentScope = newScope;
    if (badgeEl && inputEl) updateSpotrightScopeBadge(badgeEl, inputEl, currentScope);
    if (trackEl) updateSpotrightFilterChips(trackEl, currentScope);
    handleInputChange();
    inputEl?.focus();
}

/**
 * Handles typing input in the search field.
 */
function handleInputChange() {
    if (!inputEl || !resultsEl) return;

    const card = dialogEl?.querySelector('#spotright-card');
    card?.classList?.remove?.('shake');

    const prefixMatch = extractScopePrefix(inputEl.value);
    if (prefixMatch) {
        inputEl.value = prefixMatch.remainingQuery;
        currentScope = prefixMatch.scope;
        if (badgeEl) updateSpotrightScopeBadge(badgeEl, inputEl, currentScope);
        if (trackEl) updateSpotrightFilterChips(trackEl, currentScope);
    }

    const query = inputEl.value;

    if (!registryCache) {
        registryCache = buildSpotrightRegistry();
    }

    const searchResult = searchSpotright(query, registryCache, currentScope);
    currentMatches = searchResult.matches;
    currentAutocomplete = searchResult.autocomplete;
    currentSelectedIndex = 0;

    // Smart clipboard tag suggestion when search input is empty in default scope
    if (!query && currentScope === 'all' && currentClipboardTag) {
        const activeTag = getActiveUrlTag();
        if (!activeTag || activeTag !== currentClipboardTag) {
            currentMatches.unshift(createClipboardSpotrightItem(currentClipboardTag));
        }
    }

    renderSpotrightResults(resultsEl, currentMatches, currentSelectedIndex);
    updateGhostAutocomplete(ghostEl, query, currentAutocomplete);
    updateTopHitHint(hintEl, currentAutocomplete);
}

/**
 * Handles keyboard navigation inside the Spotright dialog.
 * @param {KeyboardEvent} event
 */
function handleInputKeydown(event) {
    if (event.isComposing) return;

    if (isActionInFlight && event.key !== 'Escape') {
        event.preventDefault();
        return;
    }

    switch (event.key) {
        case 'Backspace':
            if (inputEl && inputEl.value === '' && currentScope !== 'all') {
                event.preventDefault();
                setScope('all');
            }
            break;

        case 'ArrowDown':
            event.preventDefault();
            if (currentMatches.length > 0) {
                currentSelectedIndex = (currentSelectedIndex + 1) % currentMatches.length;
                if (resultsEl) updateSpotrightSelection(resultsEl, currentSelectedIndex);
            }
            break;

        case 'ArrowUp':
            event.preventDefault();
            if (currentMatches.length > 0) {
                currentSelectedIndex = (currentSelectedIndex - 1 + currentMatches.length) % currentMatches.length;
                if (resultsEl) updateSpotrightSelection(resultsEl, currentSelectedIndex);
            }
            break;

        case 'Tab':
            if (currentAutocomplete && currentAutocomplete.fullTitle && inputEl) {
                event.preventDefault();
                inputEl.value = currentAutocomplete.fullTitle;
                handleInputChange();
            }
            break;

        case 'ArrowRight':
            if (currentAutocomplete && currentAutocomplete.fullTitle && inputEl && inputEl.selectionStart === inputEl.value.length) {
                event.preventDefault();
                inputEl.value = currentAutocomplete.fullTitle;
                handleInputChange();
            }
            break;

        case 'Enter':
            event.preventDefault();
            executeCurrentSelection();
            break;

        case 'Escape':
            event.preventDefault();
            closeSpotright();
            break;
    }
}

/**
 * Executes the currently selected match item.
 * Regular items close Spotright immediately.
 * Async items verify in-palette, retaining Spotright open on error to preserve input.
 */
async function executeCurrentSelection() {
    if (isActionInFlight) return;

    const selectedItem = currentMatches[currentSelectedIndex];
    if (!selectedItem || typeof selectedItem.execute !== 'function') return;

    // Normal non-async items: close Spotright immediately and invoke action
    if (!selectedItem.isAsyncAction) {
        if (selectedItem.id && !selectedItem.id.startsWith('direct-tag-')) {
            addRecentItem(selectedItem.id);
        }
        closeSpotright();
        safeRaf(() => {
            selectedItem.execute();
        });
        return;
    }

    isActionInFlight = true;
    selectedItem.isLoading = true;
    selectedItem.errorMessage = null;

    if (inputEl) {
        inputEl.readOnly = true;
    }
    if (resultsEl) {
        renderSpotrightResults(resultsEl, currentMatches, currentSelectedIndex);
    }

    try {
        const result = await selectedItem.execute();
        if (result && result.success) {
            if (selectedItem.id && !selectedItem.id.startsWith('direct-tag-')) {
                addRecentItem(selectedItem.id);
            }
            isActionInFlight = false;
            closeSpotright();
            return;
        }

        // Action failed: preserve Spotright, preserve input, and display inline error
        isActionInFlight = false;
        selectedItem.isLoading = false;
        selectedItem.errorMessage = result?.message || translate('apiErrors.notFound');

        if (inputEl) {
            inputEl.readOnly = false;
            inputEl.focus();
            const len = inputEl.value.length;
            inputEl.setSelectionRange(len, len);
        }

        if (resultsEl) {
            renderSpotrightResults(resultsEl, currentMatches, currentSelectedIndex);
        }

        triggerCardShake(dialogEl);
    } catch (err) {
        isActionInFlight = false;
        selectedItem.isLoading = false;
        selectedItem.errorMessage = err?.message ? translate(err.message) : translate('apiErrors.notFound');

        if (inputEl) {
            inputEl.readOnly = false;
            inputEl.focus();
            const len = inputEl.value.length;
            inputEl.setSelectionRange(len, len);
        }

        if (resultsEl) {
            renderSpotrightResults(resultsEl, currentMatches, currentSelectedIndex);
        }

        triggerCardShake(dialogEl);
    }
}

/**
 * Global shortcut listener for Cmd+K and Ctrl+K.
 * @param {KeyboardEvent} event
 */
function handleGlobalKeydown(event) {
    if (event.isComposing) return;

    const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (!isCmdK) return;

    event.preventDefault();
    toggleSpotright();
}

/**
 * Opens the Spotright search palette.
 */
export function openSpotright() {
    ensureMounted();
    if (!dialogEl || !inputEl || !resultsEl) return;

    const card = dialogEl.querySelector('#spotright-card');
    card?.classList?.remove?.('shake');

    // Refresh dynamic registry so newly saved villages and profiles are indexed
    registryCache = buildSpotrightRegistry();

    currentScope = 'all';
    currentClipboardTag = null;
    updateSpotrightScopeBadge(badgeEl, inputEl, currentScope);
    updateSpotrightFilterChips(trackEl, currentScope);

    inputEl.value = '';
    const initialResult = searchSpotright('', registryCache, currentScope);
    currentMatches = initialResult.matches;
    currentAutocomplete = null;
    currentSelectedIndex = 0;

    renderSpotrightResults(resultsEl, currentMatches, currentSelectedIndex);
    updateGhostAutocomplete(ghostEl, '', null);
    updateTopHitHint(hintEl, null);

    // Asynchronously detect clipboard player tag (strictly zero-prompt)
    detectClipboardPlayerTag().then((tag) => {
        if (!tag) return;
        const activeTag = getActiveUrlTag();
        if (activeTag && activeTag === tag) return;

        currentClipboardTag = tag;
        if (dialogEl?.hasAttribute('open') && inputEl && inputEl.value === '' && currentScope === 'all') {
            handleInputChange();
        }
    });

    const triggerBtn = document.getElementById('header-spotright-btn');
    if (triggerBtn) {
        triggerBtn.classList.add('is-open');
        triggerBtn.setAttribute('aria-expanded', 'true');
    }

    if (typeof dialogEl.showModal === 'function') {
        dialogEl.showModal();
    } else {
        dialogEl.setAttribute('open', '');
    }

    // Delay focus slightly to ensure smooth modal rendering transition
    safeRaf(() => {
        inputEl?.focus();
        inputEl?.select();
    });
}

/**
 * Closes the Spotright search palette.
 */
export function closeSpotright() {
    if (!dialogEl) return;

    const card = dialogEl.querySelector('#spotright-card');
    card?.classList?.remove?.('shake');

    isActionInFlight = false;
    if (inputEl) inputEl.readOnly = false;
    currentScope = 'all';
    currentClipboardTag = null;
    updateSpotrightScopeBadge(badgeEl, inputEl, currentScope);
    updateSpotrightFilterChips(trackEl, currentScope);

    const triggerBtn = document.getElementById('header-spotright-btn');
    if (triggerBtn) {
        triggerBtn.classList.remove('is-open');
        triggerBtn.setAttribute('aria-expanded', 'false');
    }

    if (dialogEl.hasAttribute('open')) {
        if (typeof dialogEl.close === 'function') {
            dialogEl.close();
        } else {
            dialogEl.removeAttribute('open');
        }
    }
}

/**
 * Toggles Spotright palette visibility.
 */
export function toggleSpotright() {
    if (dialogEl?.hasAttribute('open')) {
        closeSpotright();
    } else {
        openSpotright();
    }
}

/**
 * Initializes global Spotright keyboard shortcut and trigger button click listeners.
 */
export function initSpotright() {
    if (isInitialized || typeof window === 'undefined') return;
    isInitialized = true;
    window.addEventListener('keydown', handleGlobalKeydown);
    document.addEventListener('click', (event) => {
        const trigger = /** @type {HTMLElement|null} */ (event.target)?.closest?.('#header-spotright-btn, [data-action="open-spotright"]');
        if (trigger) {
            event.preventDefault();
            toggleSpotright();
        }
    });
}
