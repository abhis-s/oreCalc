import { escapeHTML } from '../../utils/stringUtils.js';
import { getSVG } from '../../utils/svgManager.js';
import { translate } from '../../i18n/translator.js';
import { formatDisplayTag, normalizePlayerTag } from '../../core/localStorageManager.js';
import { getRecentSearches, removeRecentSearch } from '../../core/recentSearchesManager.js';
import { getSavedProfiles, hjState } from './heroJourneyState.js';
import { renderHeroJourneyDropdownMarkup } from './heroJourneyHeaderDisplay.js';

let activeDropdownIndex = -1;
let isJourneyRecentCollapsed = false;

/**
 * Synchronizes the load button between active text mode, TH badge mode, and default disabled state.
 * @param {boolean} [isFocused] - Optional explicit focus state.
 */
export function updateHeaderLoadButton(isFocused) {
    const loadBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('hj-load-btn') || document.querySelector('.hj-track-btn, .hero-journey-page__load-btn'));
    const loadBtnText = document.getElementById('hj-load-btn-text');
    const loadBtnTh = document.getElementById('hj-load-btn-th');
    const searchInput = document.getElementById('hj-search-input');

    if (!loadBtn) return;

    const focused = isFocused !== undefined ? isFocused : (searchInput && document.activeElement === searchInput);
    const rawTH = Number(hjState.thLevel ?? hjState.playerData?.townHallLevel);
    const thLevel = !isNaN(rawTH) && (hjState.thLevel != null || hjState.playerData?.townHallLevel != null)
        ? Math.min(Math.max(rawTH, 1), 18)
        : null;
    const hasActivePlayer = Boolean(hjState.playerData && thLevel);
    const translated = translate('actions.load');
    const loadLabel = (translated && translated !== 'actions.load') ? translated : 'Load';

    if (focused) {
        loadBtn.disabled = false;
        loadBtn.classList.remove('has-th-badge');
        loadBtn.setAttribute('aria-label', loadLabel);
        if (loadBtnText) loadBtnText.style.display = '';
        if (loadBtnTh) loadBtnTh.style.display = 'none';
    } else if (hasActivePlayer) {
        loadBtn.disabled = false;
        loadBtn.classList.add('has-th-badge');
        loadBtn.setAttribute('aria-label', `Town Hall ${thLevel}`);
        if (loadBtnText) loadBtnText.style.display = 'none';
        if (loadBtnTh) {
            loadBtnTh.setAttribute('src', `assets/th/th${thLevel}.png`);
            loadBtnTh.setAttribute('alt', `Town Hall ${thLevel}`);
            loadBtnTh.style.display = 'block';
        }
    } else {
        loadBtn.disabled = true;
        loadBtn.classList.remove('has-th-badge');
        loadBtn.setAttribute('aria-label', loadLabel);
        if (loadBtnText) loadBtnText.style.display = '';
        if (loadBtnTh) loadBtnTh.style.display = 'none';
    }
}

/**
 * Closes the saved profiles search dropdown.
 */
function closeDropdown() {
    const dropdown = document.getElementById('hj-search-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
        activeDropdownIndex = -1;
    }
    const searchInput = document.getElementById('hj-search-input');
    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'false');
        searchInput.removeAttribute('aria-activedescendant');
    }
    if (document.activeElement !== searchInput) {
        const activePill = document.getElementById('hj-search-active-pill');
        const pillName = document.getElementById('hj-active-pill-name');
        if (activePill && pillName && pillName.textContent) {
            activePill.style.display = 'flex';
            const hashPill = document.getElementById('hj-search-hash-pill');
            const searchClear = document.getElementById('hj-search-clear');
            if (hashPill) hashPill.style.display = 'none';
            if (searchClear) searchClear.style.display = 'none';
        }
        updateHeaderLoadButton(false);
    }
}

/**
 * Renders the saved profiles dropdown based on current search input query.
 * @param {string} [query=''] - Search filter query.
 * @param {(tag: string) => void} [onSelect] - Optional selection callback.
 * @param {(tag: string) => void} [onClearActive] - Optional callback when active player is dismissed.
 */
function renderSavedProfilesDropdown(query = '', onSelect, onClearActive) {
    const dropdown = document.getElementById('hj-search-dropdown');
    if (!dropdown) return;

    const savedProfiles = getSavedProfiles();
    const cleanSavedSet = new Set(savedProfiles.map(p => p.cleanTag));
    const recentSearches = getRecentSearches().filter(r => !cleanSavedSet.has(r.cleanTag));
    const searchInput = document.getElementById('hj-search-input');

    if (savedProfiles.length === 0 && recentSearches.length === 0) {
        dropdown.style.display = 'none';
        if (searchInput) {
            searchInput.setAttribute('aria-expanded', 'false');
            searchInput.removeAttribute('aria-activedescendant');
        }
        return;
    }

    const activeCleanTag = normalizePlayerTag(hjState.activeTag);
    const cleanQuery = normalizePlayerTag(query);
    const isFiltering = cleanQuery && cleanQuery !== activeCleanTag;

    dropdown.innerHTML = renderHeroJourneyDropdownMarkup({
        savedProfiles,
        recentSearches,
        activeCleanTag,
        isFiltering,
        cleanQuery,
        activeDropdownIndex,
        isJourneyRecentCollapsed,
        hjState
    });
    dropdown.style.display = 'flex';

    if (searchInput) {
        searchInput.setAttribute('aria-expanded', 'true');
        if (activeDropdownIndex >= 0) {
            searchInput.setAttribute('aria-activedescendant', `hj-dropdown-item-${activeDropdownIndex}`);
        } else {
            searchInput.removeAttribute('aria-activedescendant');
        }
    }

    dropdown.querySelectorAll('.hj-dropdown-header--collapsible').forEach(header => {
        const toggleRecent = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isJourneyRecentCollapsed = !isJourneyRecentCollapsed;
            renderSavedProfilesDropdown(query, onSelect, onClearActive);
            const newHeader = dropdown.querySelector('.hj-dropdown-header--collapsible');
            if (newHeader) {
                /** @type {HTMLElement} */ (newHeader).focus();
            }
        };

        header.addEventListener('mousedown', toggleRecent);
        header.addEventListener('click', toggleRecent);
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                toggleRecent(e);
            }
        });
    });

    dropdown.querySelectorAll('.hj-dropdown-dismiss-btn').forEach(btn => {
        let isProcessing = false;
        const handleDismiss = (e) => {
            if (isProcessing) return;
            isProcessing = true;
            setTimeout(() => { isProcessing = false; }, 300);

            e.preventDefault();
            e.stopPropagation();
            const tag = btn.getAttribute('data-tag');
            if (tag) {
                const cleanTag = normalizePlayerTag(tag);
                const activeCleanTag = normalizePlayerTag(hjState.activeTag);

                removeRecentSearch(cleanTag);

                if (cleanTag && cleanTag === activeCleanTag) {
                    if (onClearActive) {
                        onClearActive(cleanTag);
                    }
                }
                renderSavedProfilesDropdown(query, onSelect, onClearActive);
            }
        };

        btn.addEventListener('mousedown', handleDismiss);
        btn.addEventListener('click', handleDismiss);
    });

    dropdown.querySelectorAll('.hj-dropdown-item').forEach(item => {
        let isProcessing = false;
        const handleSelect = (e) => {
            if (/** @type {HTMLElement} */ (e.target)?.closest('.hj-dropdown-dismiss-btn')) return;
            if (isProcessing) return;
            isProcessing = true;
            setTimeout(() => { isProcessing = false; }, 300);

            e.preventDefault();
            const tag = item.getAttribute('data-tag');
            if (tag) {
                const cleanTag = normalizePlayerTag(tag);
                const searchInput = document.getElementById('hj-search-input');
                if (searchInput) {
                    /** @type {HTMLInputElement} */ (searchInput).value = cleanTag;
                    searchInput.blur();
                }
                closeDropdown();
                updateHeaderLoadButton(false);
                if (onSelect) {
                    onSelect(cleanTag);
                }
            }
        };

        item.addEventListener('mousedown', handleSelect);
        item.addEventListener('click', handleSelect);
    });
}

/**
 * Initializes search input, autocomplete dropdown, clear button, and keyboard listeners.
 * @param {(tag: string) => void} onSearch - Callback when player search is executed.
 * @param {(tag: string) => void} [onClearActive] - Callback when active player is dismissed.
 */
export function initSearchControls(onSearch, onClearActive) {
    const searchForm = document.getElementById('hj-search-form');
    const searchInput = document.getElementById('hj-search-input');
    const searchClear = document.getElementById('hj-search-clear');
    const activePill = document.getElementById('hj-search-active-pill');
    const hashPill = document.getElementById('hj-search-hash-pill');
    const loadBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('hj-load-btn') || document.querySelector('.hj-track-btn, .hero-journey-page__load-btn'));

    const showInputMode = () => {
        if (activePill) activePill.style.display = 'none';
        if (hashPill) hashPill.style.display = 'inline-flex';
        const inputEl = /** @type {HTMLInputElement | null} */ (searchInput);
        if (inputEl) {
            inputEl.style.opacity = '1';
        }
        if (searchClear && inputEl) {
            searchClear.style.display = inputEl.value.length > 0 ? 'inline-flex' : 'none';
        }
        updateHeaderLoadButton(true);
    };

    const restoreActivePillMode = () => {
        const pillName = document.getElementById('hj-active-pill-name');
        if (activePill && pillName && pillName.textContent) {
            activePill.style.display = 'flex';
            if (hashPill) hashPill.style.display = 'none';
            if (searchClear) searchClear.style.display = 'none';
            const inputEl = /** @type {HTMLInputElement | null} */ (searchInput);
            if (inputEl) {
                inputEl.style.opacity = '0';
            }
        }
        if (document.activeElement !== searchInput) {
            updateHeaderLoadButton(false);
        }
    };

    if (loadBtn) {
        loadBtn.addEventListener('mousedown', (e) => {
            if (!loadBtn.classList.contains('has-th-badge')) {
                // Prevent search input from losing focus immediately before form submit fires
                e.preventDefault();
                const inputEl = /** @type {HTMLInputElement | null} */ (searchInput);
                const val = inputEl ? normalizePlayerTag(inputEl.value) : '';
                if (val) {
                    closeDropdown();
                    restoreActivePillMode();
                    if (inputEl) inputEl.blur();
                    updateHeaderLoadButton(false);
                    onSearch(val);
                }
            }
        });

        loadBtn.addEventListener('click', (e) => {
            if (loadBtn.classList.contains('has-th-badge')) {
                e.preventDefault();
                showInputMode();
                if (searchInput) {
                    searchInput.focus();
                    /** @type {HTMLInputElement} */ (searchInput).select();
                }
                activeDropdownIndex = -1;
                renderSavedProfilesDropdown('', onSearch, onClearActive);
            }
        });
    }

    if (activePill) {
        activePill.addEventListener('click', () => {
            showInputMode();
            if (searchInput) {
                searchInput.focus();
                /** @type {HTMLInputElement} */ (searchInput).select();
            }
            activeDropdownIndex = -1;
            renderSavedProfilesDropdown('', onSearch, onClearActive);
        });

        activePill.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showInputMode();
                if (searchInput) {
                    searchInput.focus();
                    /** @type {HTMLInputElement} */ (searchInput).select();
                }
                activeDropdownIndex = -1;
                renderSavedProfilesDropdown('', onSearch, onClearActive);
            }
        });
    }

    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            closeDropdown();
            restoreActivePillMode();
            if (searchInput) searchInput.blur();
            updateHeaderLoadButton(false);
            const val = normalizePlayerTag(/** @type {HTMLInputElement} */ (searchInput).value);
            if (val) onSearch(val);
        });
    }

    if (searchInput) {
        const handleOpenDropdown = () => {
            showInputMode();
            activeDropdownIndex = -1;
            renderSavedProfilesDropdown('', onSearch, onClearActive);
            /** @type {HTMLInputElement} */ (searchInput).select();
        };

        searchInput.addEventListener('focus', handleOpenDropdown);
        searchInput.addEventListener('click', () => {
            const dropdown = document.getElementById('hj-search-dropdown');
            if (!dropdown || dropdown.style.display === 'none') {
                handleOpenDropdown();
            }
        });

        searchInput.addEventListener('blur', () => {
            setTimeout(() => {
                const isInputFocused = searchInput && document.activeElement === searchInput;
                if (!isInputFocused) {
                    updateHeaderLoadButton(false);
                    const dropdown = document.getElementById('hj-search-dropdown');
                    const isDropdownOpen = dropdown && dropdown.style.display !== 'none';
                    if (!isDropdownOpen) {
                        restoreActivePillMode();
                    }
                }
            }, 150);
        });

        searchInput.addEventListener('input', () => {
            showInputMode();
            const inputEl = /** @type {HTMLInputElement} */ (searchInput);
            if (inputEl.value.includes('#')) {
                inputEl.value = normalizePlayerTag(inputEl.value);
            }
            if (searchClear) {
                searchClear.style.display = inputEl.value.length > 0 ? 'inline-flex' : 'none';
            }
            const errorBanner = document.getElementById('hj-error-banner');
            if (errorBanner) {
                errorBanner.style.display = 'none';
            }
            activeDropdownIndex = -1;
            renderSavedProfilesDropdown(inputEl.value, onSearch, onClearActive);
        });

        searchInput.addEventListener('keydown', (e) => {
            const dropdown = document.getElementById('hj-search-dropdown');
            const isDropdownOpen = dropdown && dropdown.style.display !== 'none';

            if (!isDropdownOpen) {
                if (e.key === 'ArrowDown') {
                    showInputMode();
                    renderSavedProfilesDropdown(/** @type {HTMLInputElement} */ (searchInput).value, onSearch, onClearActive);
                    e.preventDefault();
                }
                return;
            }

            const entries = Array.from(dropdown.querySelectorAll('.hj-dropdown-item, .hj-dropdown-header--collapsible'));
            if (entries.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeDropdownIndex = (activeDropdownIndex + 1) % entries.length;
                renderSavedProfilesDropdown(/** @type {HTMLInputElement} */ (searchInput).value, onSearch, onClearActive);
                const updatedEntries = dropdown.querySelectorAll('.hj-dropdown-item, .hj-dropdown-header--collapsible');
                updatedEntries[activeDropdownIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeDropdownIndex = activeDropdownIndex === -1
                    ? entries.length - 1
                    : (activeDropdownIndex - 1 + entries.length) % entries.length;
                renderSavedProfilesDropdown(/** @type {HTMLInputElement} */ (searchInput).value, onSearch, onClearActive);
                const updatedEntries = dropdown.querySelectorAll('.hj-dropdown-item, .hj-dropdown-header--collapsible');
                updatedEntries[activeDropdownIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Home') {
                e.preventDefault();
                activeDropdownIndex = 0;
                renderSavedProfilesDropdown(/** @type {HTMLInputElement} */ (searchInput).value, onSearch, onClearActive);
                const updatedEntries = dropdown.querySelectorAll('.hj-dropdown-item, .hj-dropdown-header--collapsible');
                updatedEntries[0]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'End') {
                e.preventDefault();
                activeDropdownIndex = entries.length - 1;
                renderSavedProfilesDropdown(/** @type {HTMLInputElement} */ (searchInput).value, onSearch, onClearActive);
                const updatedEntries = dropdown.querySelectorAll('.hj-dropdown-item, .hj-dropdown-header--collapsible');
                updatedEntries[activeDropdownIndex]?.scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter') {
                if (activeDropdownIndex >= 0 && entries[activeDropdownIndex]) {
                    e.preventDefault();
                    const entry = entries[activeDropdownIndex];
                    if (entry.classList.contains('hj-dropdown-header--collapsible')) {
                        isJourneyRecentCollapsed = !isJourneyRecentCollapsed;
                        renderSavedProfilesDropdown(/** @type {HTMLInputElement} */ (searchInput).value, onSearch, onClearActive);
                    } else {
                        const tag = entry.getAttribute('data-tag');
                        if (tag) {
                            closeDropdown();
                            /** @type {HTMLInputElement} */ (searchInput).value = tag.replace(/^#+/, '');
                            if (searchInput) searchInput.blur();
                            updateHeaderLoadButton(false);
                            onSearch(tag);
                        }
                    }
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeDropdown();
            } else if (e.key === 'Delete') {
                if (activeDropdownIndex >= 0 && entries[activeDropdownIndex]) {
                    const entry = entries[activeDropdownIndex];
                    if (entry.classList.contains('hj-dropdown-item--recent')) {
                        const tag = entry.getAttribute('data-tag');
                        if (tag) {
                            e.preventDefault();
                            removeRecentSearch(tag);
                            renderSavedProfilesDropdown(/** @type {HTMLInputElement} */ (searchInput).value, onSearch, onClearActive);
                        }
                    }
                }
            }
        });
    }

    if (searchClear && searchInput) {
        searchClear.addEventListener('click', () => {
            /** @type {HTMLInputElement} */ (searchInput).value = '';
            searchClear.style.display = 'none';
            closeDropdown();
            showInputMode();
            searchInput.focus();
        });
    }

    document.addEventListener('click', (e) => {
        const searchWrapper = document.querySelector('.hero-journey-page__search-input-wrapper');
        const searchForm = document.getElementById('hj-search-form');
        if (searchForm && !searchForm.contains(/** @type {Node} */ (e.target))) {
            closeDropdown();
            restoreActivePillMode();
            if (document.activeElement !== searchInput) {
                updateHeaderLoadButton(false);
            }
        }
    });
}
