import { translate, loadTranslations } from './i18n/translator.js';
import { updateUIWithTranslations } from './i18n/uiTranslator.js';
import { fetchPlayerData } from './services/apiService.js';
import { safeJsonParse } from './utils/jsonUtils.js';
import { state } from './core/state.js';
import './utils/imageManager.js';
import { initHeroJourneyTooltips, initHeroJourneyTableTooltips } from './components/home/heroJourneyPopovers.js';
import { setupMountainClusterTouchInteractions } from './components/home/heroJourneyInputs.js';
import {
    autoScrollToCompletedNode,
    resetHeroJourneyScrollPositions,
    setHeroJourneyStateProvider,
    updateFilterRowLayout
} from './components/home/heroJourneyScrollManager.js';
import {
    hjState,
    computePlayerCumulativeLevel,
    buildStateFromPlayerData,
    getTagFromUrl,
    updateUrlTag,
    getSavedProfiles,
    syncPlayerToStorage
} from './components/heroJourney/heroJourneyState.js';
import { formatDisplayTag, getPlayerStorageKey, normalizePlayerTag, PLAYER_PREFIX } from './core/localStorageManager.js';
import { removeRecentSearch } from './core/recentSearchesManager.js';
import { initSettings, getCurrentSettings, initHjCrossTabSync } from './components/heroJourney/heroJourneySettings.js';
import { syncLanguageUrl } from './core/languageRouter.js';
import { initHeaderLayoutObserver } from './components/heroJourney/heroJourneyHeaderDisplay.js';
import { initSearchControls, updateHeaderLoadButton } from './components/heroJourney/heroJourneyHeaderInputs.js';
import { renderPlayerSummary } from './components/heroJourney/heroJourneyPlayerRenderer.js';
import { renderTableView, updateTableFilterRowLayout, syncTableTheadHeight } from './components/heroJourney/heroJourneyTableRenderer.js';
import {
    renderTrackView,
    updateProgressBar,
    syncClaimSwitchPill
} from './components/heroJourney/heroJourneyTrackRenderer.js';
import { getMaxCumulativeLevelsByTH } from './domain/income/heroJourneyLevels.js';
import {
    initHeroJourneyControls,
    initCustomScrollbar,
    resetFilters as handleResetFilters,
    syncTypeFiltersUI
} from './components/heroJourney/heroJourneyControlsInputs.js';

const resetFilters = () => handleResetFilters(hjState, renderUI);

/**
 * Fetches player data from backend and updates page state.
 * @param {string} tag - Player tag to fetch.
 */
async function loadPlayer(tag) {
    const cleanTag = normalizePlayerTag(tag);
    const formattedTag = formatDisplayTag(cleanTag);
    if (!cleanTag || cleanTag === 'DEFAULT0') return;

    resetHeroJourneyScrollPositions();

    const canonicalKey = getPlayerStorageKey(cleanTag);
    const legacyKey = `${PLAYER_PREFIX}#${cleanTag}`;

    if (!hjState.playerData) {
        try {
            let cachedStr = localStorage.getItem(canonicalKey);
            if (!cachedStr) {
                cachedStr = localStorage.getItem(legacyKey);
                if (cachedStr) {
                    try {
                        localStorage.setItem(canonicalKey, cachedStr);
                        localStorage.removeItem(legacyKey);
                    } catch {}
                }
            }
            const cached = safeJsonParse(cachedStr, null);
            const cachedProfile = cached?.playerProfile || cached?.playerData || null;
            if (cachedProfile && cachedProfile.tag) {
                const serverTag = formatDisplayTag(cachedProfile.tag);
                hjState.playerData = cachedProfile;
                hjState.activeTag = serverTag;
                hjState.thLevel = Number(cachedProfile.townHallLevel) || 16;
                hjState.cumulativeLevel = computePlayerCumulativeLevel(cachedProfile);
                if (cached.heroJourney) {
                    hjState.isAccelerated = Boolean(cached.heroJourney.acceleratedRewards ?? cached.heroJourney.accelerated ?? (cached.heroJourney.rewardMode === 'accelerated'));
                    hjState.revealBeyondTH = cached.heroJourney.revealBeyondTH ?? false;
                    if (cached.heroJourney.typeFilter) hjState.typeFilter = cached.heroJourney.typeFilter;
                    if (typeof cached.heroJourney.unclaimedOnly === 'boolean') hjState.unclaimedOnly = cached.heroJourney.unclaimedOnly;
                }
                updateUrlTag(serverTag);
                renderUI();
            }
        } catch {}
    }

    hjState.isLoading = true;
    hjState.errorMessage = '';
    renderUI();

    try {
        const data = await fetchPlayerData(cleanTag);
        const serverTag = formatDisplayTag(data.tag || cleanTag);
        hjState.playerData = data;
        hjState.activeTag = serverTag;
        hjState.thLevel = Number(data.townHallLevel) || 16;
        hjState.cumulativeLevel = computePlayerCumulativeLevel(data);
        updateUrlTag(serverTag);

        const savedPartition = safeJsonParse(localStorage.getItem(canonicalKey) || localStorage.getItem(legacyKey), null);
        if (savedPartition?.heroJourney) {
            hjState.isAccelerated = Boolean(savedPartition.heroJourney.acceleratedRewards ?? savedPartition.heroJourney.accelerated ?? (savedPartition.heroJourney.rewardMode === 'accelerated'));
            hjState.revealBeyondTH = savedPartition.heroJourney.revealBeyondTH ?? false;
        }

        syncPlayerToStorage(data, hjState);

        const searchInput = document.getElementById('hj-search-input');
        const searchClear = document.getElementById('hj-search-clear');
        if (searchInput) {
            /** @type {HTMLInputElement} */ (searchInput).value = serverTag.replace(/^#+/, '');
            searchInput.blur();
            if (searchClear) {
                searchClear.style.display = searchInput.value.length > 0 ? 'inline-flex' : 'none';
            }
        }
    } catch (err) {
        hjState.playerData = null;
        hjState.activeTag = null;
        hjState.cumulativeLevel = 0;
        hjState.errorMessage = err.message || 'apiErrors.notFound';
        updateUrlTag(null);
    } finally {
        hjState.isLoading = false;
        renderUI();
        if (hjState.playerData) {
            autoScrollToCompletedNode(hjState.cumulativeLevel);
        }
    }
}

/**
 * Main UI render coordinator.
 */
function renderUI() {
    const errorBanner = document.getElementById('hj-error-banner');
    const errorText = document.getElementById('hj-error-banner-text');
    if (errorBanner) {
        if (hjState.errorMessage) {
            const translatedMessage = translate(hjState.errorMessage) || hjState.errorMessage;
            if (errorText) {
                errorText.textContent = translatedMessage;
            } else {
                errorBanner.textContent = translatedMessage;
            }
            errorBanner.style.display = 'flex';
        } else {
            errorBanner.style.display = 'none';
        }
    }

    const activePill = document.getElementById('hj-search-active-pill');
    const pillName = document.getElementById('hj-active-pill-name');
    const pillTag = document.getElementById('hj-active-pill-tag');
    const hashPill = document.getElementById('hj-search-hash-pill');
    const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('hj-search-input'));
    const searchClear = document.getElementById('hj-search-clear');

    if (activePill && pillName && pillTag) {
        if (hjState.playerData && hjState.activeTag) {
            const rawName = hjState.playerData.name || hjState.playerData.playerProfile?.name || translate('player.label');
            const cleanTag = normalizePlayerTag(hjState.activeTag);
            pillName.textContent = rawName;
            pillTag.textContent = `#${cleanTag}`;

            const isInputFocused = searchInput && document.activeElement === searchInput;
            if (!isInputFocused) {
                activePill.style.display = 'flex';
                if (hashPill) hashPill.style.display = 'none';
                if (searchClear) searchClear.style.display = 'none';
                if (searchInput) searchInput.style.opacity = '0';
            } else if (searchInput) {
                searchInput.style.opacity = '1';
            }
        } else {
            pillName.textContent = '';
            pillTag.textContent = '';
            activePill.style.display = 'none';
            if (hashPill) hashPill.style.display = 'inline-flex';
            if (searchInput) searchInput.style.opacity = '1';
            if (searchClear && searchInput) {
                searchClear.style.display = searchInput.value.length > 0 ? 'inline-flex' : 'none';
            }
        }
    }

    updateHeaderLoadButton();

    const maxMap = getMaxCumulativeLevelsByTH();
    const overallMax = Math.max(...Object.values(maxMap));
    const isTrueMaxPlayer = hjState.cumulativeLevel >= overallMax && overallMax > 0;
    const card = document.getElementById('home-hj-card');
    if (card) {
        card.classList.toggle('is-true-max', isTrueMaxPlayer);
    }
    const claimSwitches = document.querySelectorAll('.hj-segmented-switch');
    claimSwitches.forEach(sw => {
        /** @type {HTMLElement} */ (sw).style.display = (!hjState.playerData || isTrueMaxPlayer) ? 'none' : '';
    });

    renderPlayerSummary();
    updateProgressBar();
    renderTrackView();
    renderTableView();
    syncClaimSwitchPill();
    syncTypeFiltersUI(hjState);
    updateTableFilterRowLayout();

    const tableWrapper = document.getElementById('hj-table-wrapper');
    const tableFiltersRow = /** @type {HTMLElement | null} */ (document.getElementById('hj-table-filters-row') || document.querySelector('.hero-journey-page__view-toggle-bar .hero-journey-filters-row'));
    const toggleBtnText = document.getElementById('hj-toggle-table-text');
    if (tableWrapper) {
        tableWrapper.style.display = hjState.showTable ? 'flex' : 'none';
    }
    if (tableFiltersRow) {
        tableFiltersRow.style.display = hjState.showTable ? '' : 'none';
    }
    if (toggleBtnText) {
        let labelKey = 'views.heroJourneyPage.hideTable';
        let fallbackText = 'Hide Data Table';

        if (hjState.tableMaximized) {
            labelKey = 'views.heroJourneyPage.collapseTable';
            fallbackText = 'Collapse Data Table';
        } else if (!hjState.showTable) {
            labelKey = 'views.heroJourneyPage.viewTable';
            fallbackText = 'View Full Data Table';
        }

        toggleBtnText.textContent = translate(labelKey) || fallbackText;
        toggleBtnText.dataset.i18n = labelKey;
    }

    const pageContainer = document.querySelector('.hero-journey-page');
    const expandTableBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('expand-hj-table-btn'));
    const isMaximized = Boolean(hjState.tableMaximized);
    if (pageContainer) {
        pageContainer.classList.toggle('has-expanded-table', isMaximized);
        pageContainer.classList.toggle('has-hidden-table', !hjState.showTable);
    }
    if (expandTableBtn) {
        const iconSvg = expandTableBtn.querySelector('orecalc-assets-svg');
        if (iconSvg) {
            iconSvg.setAttribute('name', isMaximized ? 'compress' : 'expand');
        }
        const titleKey = isMaximized ? 'actions.compressTable' : 'actions.expandTable';
        const titleFallback = isMaximized ? 'Compress Table' : 'Expand Table';
        const translatedTitle = translate(titleKey) || titleFallback;
        expandTableBtn.setAttribute('title', translatedTitle);
        expandTableBtn.setAttribute('aria-label', translatedTitle);
    }

    const headerPlannerBtn = /** @type {HTMLAnchorElement|null} */ (document.querySelector('.hj-header-planner-btn'));
    if (headerPlannerBtn) {
        const cleanTag = String(hjState.activeTag || '').replace(/^#+/, '');
        headerPlannerBtn.href = cleanTag ? `/?tag=${encodeURIComponent(cleanTag)}` : '/';
    }
}

/**
 * Unloads the active player, clears storage partitions if ephemeral, clears the search input,
 * removes query parameters from URL, and transitions the view into an organic guest baseline.
 * @param {string} [tag] - Optional tag being dismissed.
 */
function clearActivePlayerToGuest(tag) {
    const cleanTag = normalizePlayerTag(tag || hjState.activeTag);
    if (cleanTag && cleanTag !== 'DEFAULT0') {
        removeRecentSearch(cleanTag);
        const savedProfiles = getSavedProfiles();
        const isSaved = savedProfiles.some(p => p.cleanTag === cleanTag);
        if (!isSaved) {
            try {
                localStorage.removeItem(getPlayerStorageKey(cleanTag));
                localStorage.removeItem(`${PLAYER_PREFIX}#${cleanTag}`);
            } catch {}
        }
    }

    hjState.playerData = null;
    hjState.activeTag = null;
    hjState.thLevel = 16;
    hjState.cumulativeLevel = 0;
    hjState.isAccelerated = false;
    hjState.unclaimedOnly = false;
    hjState.typeFilter = 'all';
    hjState.errorMessage = '';

    updateUrlTag(null);

    const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('hj-search-input'));
    const searchClear = document.getElementById('hj-search-clear');
    const activePill = document.getElementById('hj-search-active-pill');
    const hashPill = document.getElementById('hj-search-hash-pill');
    if (searchInput) {
        searchInput.value = '';
    }
    if (searchClear) {
        searchClear.style.display = 'none';
    }
    if (activePill) {
        activePill.style.display = 'none';
    }
    if (hashPill) {
        hashPill.style.display = 'inline-flex';
    }

    renderUI();
}

/**
 * Initializes interactive controls and event listeners.
 */
function initControls() {
    initSearchControls(loadPlayer, clearActivePlayerToGuest);
    initHeroJourneyControls(hjState, renderUI, resetFilters);
    initCustomScrollbar();
    initHeroJourneyTooltips(() => buildStateFromPlayerData(hjState.playerData, hjState));
    initHeroJourneyTableTooltips(() => buildStateFromPlayerData(hjState.playerData, hjState));
    setupMountainClusterTouchInteractions();
    initHeaderLayoutObserver();

    window.addEventListener('resize', () => {
        updateFilterRowLayout();
        updateTableFilterRowLayout();
        syncClaimSwitchPill();
        syncTableTheadHeight();
    }, { passive: true });
}

/**
 * Initializes the standalone Hero Journey app.
 */
async function init() {
    const urlTag = getTagFromUrl();
    if (typeof sessionStorage !== 'undefined') {
        const sessionTableState = sessionStorage.getItem('orecalc_hj_table_expanded');
        if (sessionTableState !== null) {
            hjState.showTable = sessionTableState === 'true';
        }
    }
    setHeroJourneyStateProvider(() => buildStateFromPlayerData(hjState.playerData, hjState));
    const currentSettings = getCurrentSettings();
    const activeLang = currentSettings.language || 'en';
    if (!state.uiSettings) {
        state.uiSettings = {};
    }
    state.uiSettings.language = activeLang;
    syncLanguageUrl(activeLang, true);
    await loadTranslations(activeLang);
    updateUIWithTranslations(true);
    initSettings(() => {
        renderUI();
    });
    initHjCrossTabSync(() => {
        renderUI();
    });
    const appVersionDisplay = document.getElementById('app-version-display');
    if (appVersionDisplay) {
        appVersionDisplay.textContent = '| v' + (window.__ENV__?.APP_VERSION || state.appVersion || '2.2.0').replace(/^v/, '');
    }
    initControls();

    let initialTag = urlTag || getTagFromUrl();
    const cleanInitialTag = normalizePlayerTag(initialTag);

    if (!cleanInitialTag || cleanInitialTag === 'DEFAULT0') {
        const savedProfiles = getSavedProfiles();
        if (savedProfiles.length > 0) {
            initialTag = savedProfiles[0].cleanTag || savedProfiles[0].tag;
        } else {
            initialTag = '';
        }
    }

    const finalCleanTag = normalizePlayerTag(initialTag);
    if (finalCleanTag && finalCleanTag !== 'DEFAULT0') {
        const input = document.getElementById('hj-search-input');
        const clearBtn = document.getElementById('hj-search-clear');
        if (input) {
            /** @type {HTMLInputElement} */ (input).value = finalCleanTag;
            if (clearBtn) clearBtn.style.display = 'inline-flex';
        }
        await loadPlayer(finalCleanTag);
    } else {
        updateUrlTag(null);
        renderUI();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init().catch((err) => {
            console.error('Error bootstrapping Hero Journey app:', err);
        });
    });
} else {
    init().catch((err) => {
        console.error('Error bootstrapping Hero Journey app:', err);
    });
}
