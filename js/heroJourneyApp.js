import { translate, loadTranslations } from './i18n/translator.js';
import { updateUIWithTranslations } from './i18n/uiTranslator.js';
import { fetchPlayerData } from './services/apiService.js';
import { safeJsonParse } from './utils/jsonUtils.js';
import { showApiErrorToast, showToast } from './ui/toast.js';
import { state } from './core/state.js';
import { STORAGE_KEY_MAP } from './core/constants.js';
import './utils/imageManager.js';
import './console.js';
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
    syncPlayerToStorage
} from './components/heroJourney/heroJourneyState.js';
import {
    formatDisplayTag,
    getActiveUserIdKey,
    getPlayerStorageKey,
    getStorageItem,
    isClashCalcHost,
    normalizePlayerTag,
    PLAYER_PREFIX
} from './core/storageKeys.js';
import { getSavedProfiles, setActivePlayerTag } from './core/playerStorage.js';
import { consolidateLocalStorageKeys } from './core/storageMigrations.js';
import { initAppSettings, getAppSettings } from './components/common/appSettings.js';
import { syncLanguageUrl } from './core/languageRouter.js';
import { initHeaderLayoutObserver, renderHeroJourneyPlayerDropdown } from './components/heroJourney/heroJourneyHeaderDisplay.js';
import { initHeroJourneyPlayerDropdown, initHeroJourneyAddPlayerModal } from './components/heroJourney/heroJourneyHeaderInputs.js';
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
import { initDomainNotice } from './components/common/domainNotice.js';
import { initAppFooter } from './components/common/appFooter.js';
import { initNavigationDrawer } from './components/common/navigationDrawer.js';
import { renderNavigationDrawerContent } from './components/common/navigationDrawerRenderer.js';
import { initExternalLinkCatcher } from './components/common/externalLinkCatcher.js';
import { initializeCommitsModal } from './components/changelog/commitsModal.js';
import { initializeChangelogModal } from './components/changelog/changelogModal.js';
import { initializeModalHistoryManager } from './utils/modalHistoryManager.js';
import { initializeAuthModal } from './components/auth/authModalInputs.js';
import { initializePasskeysModal } from './components/auth/passkeysModalInputs.js';
import { initializeSettingsAccount } from './components/appSettings/settingsAccountInputs.js';
import { registerGlobalErrorBoundaries } from './core/appEventInterceptors.js';
import { initializePwaService } from './services/pwaService.js';
import { markUserMigrated } from './services/apiService.js';

const resetFilters = () => handleResetFilters(hjState, renderUI);

/**
 * Fetches player data from backend and updates page state.
 * @param {string} tag - Player tag to fetch.
 * @returns {Promise<{ success: boolean, message?: string, data?: any }>}
 */
async function loadPlayer(tag) {
    const cleanTag = normalizePlayerTag(tag);
    if (!cleanTag || cleanTag === 'DEFAULT0') {
        return { success: false, message: 'apiErrors.invalidTag' };
    }

    resetHeroJourneyScrollPositions();

    const canonicalKey = getPlayerStorageKey(cleanTag);
    const legacyKey = `${PLAYER_PREFIX}#${cleanTag}`;

    const isSwitchingPlayer = !hjState.playerData || normalizePlayerTag(hjState.activeTag) !== cleanTag;

    if (isSwitchingPlayer) {
        setActivePlayerTag(cleanTag);
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
            if (cachedProfile && cachedProfile.tag && normalizePlayerTag(cachedProfile.tag) === cleanTag) {
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

    /** @type {{ success: boolean, message?: string, data?: any }} */
    let loadResult = { success: false, message: 'apiErrors.notFound' };
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

        renderHeroJourneyPlayerDropdown(cleanTag);
        loadResult = { success: true, data };
    } catch (err) {
        const errorKey = err.message || 'apiErrors.notFound';
        showApiErrorToast(errorKey);
        const hasMatchingCachedData = Boolean(hjState.playerData && normalizePlayerTag(hjState.activeTag) === cleanTag);
        if (hasMatchingCachedData) {
            loadResult = { success: true, data: hjState.playerData };
        } else {
            loadResult = { success: false, message: errorKey };
            if (!hjState.playerData) {
                hjState.playerData = null;
                hjState.activeTag = null;
                hjState.cumulativeLevel = 0;
                hjState.errorMessage = errorKey;
                updateUrlTag(null);
            } else {
                updateUrlTag(hjState.activeTag);
                renderHeroJourneyPlayerDropdown(normalizePlayerTag(hjState.activeTag));
            }
        }
    } finally {
        hjState.isLoading = false;
        renderUI();
        if (hjState.playerData) {
            autoScrollToCompletedNode(hjState.cumulativeLevel);
        }
    }
    return loadResult;
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
            errorBanner.hidden = false;
            errorBanner.style.display = 'flex';
        } else {
            errorBanner.hidden = true;
            errorBanner.style.display = 'none';
        }
    }

    renderHeroJourneyPlayerDropdown(hjState.activeTag);

    const maxMap = getMaxCumulativeLevelsByTH();
    const overallMax = Math.max(...Object.values(maxMap));
    const isTrueMaxPlayer = hjState.cumulativeLevel >= overallMax && overallMax > 0;
    const card = document.getElementById('home-hj-card');
    if (card) {
        card.classList.toggle('is-true-max', isTrueMaxPlayer);
    }
    const progressTracks = document.querySelectorAll('.hero-journey-progress-track');
    progressTracks.forEach(track => {
        /** @type {HTMLElement} */ (track).style.display = isTrueMaxPlayer ? 'none' : '';
    });
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
        let labelKey = 'views.heroJourney.page.hideTable';
        let fallbackText = 'Hide Data Table';

        if (hjState.tableMaximized) {
            labelKey = 'views.heroJourney.page.collapseTable';
            fallbackText = 'Collapse Data Table';
        } else if (!hjState.showTable) {
            labelKey = 'views.heroJourney.page.viewTable';
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
    updateHeroJourneyDrawer('track');
}

/**
 * Unloads the active player, clears storage partitions if ephemeral, clears the search input,
 * removes query parameters from URL, and transitions the view into an organic guest baseline.
 */
function clearActivePlayerToGuest() {
    hjState.playerData = null;
    hjState.activeTag = null;
    hjState.thLevel = 18;
    hjState.cumulativeLevel = 0;
    hjState.isAccelerated = false;
    hjState.unclaimedOnly = false;
    hjState.typeFilter = 'all';
    hjState.errorMessage = '';

    updateUrlTag(null);
    renderHeroJourneyPlayerDropdown();
    renderUI();
}

/**
 * Initializes interactive controls and event listeners.
 */
function initControls() {
    const modalControls = initHeroJourneyAddPlayerModal({
        onLoadPlayer: loadPlayer
    });

    initHeroJourneyPlayerDropdown({
        getActivePlayerTag: () => hjState.activeTag,
        onSelectPlayer: (tag) => {
            loadPlayer(tag);
        },
        onDeletePlayer: (tag) => {
            const cleanTag = normalizePlayerTag(tag);
            const activeCleanTag = normalizePlayerTag(hjState.activeTag);
            if (cleanTag && cleanTag === activeCleanTag) {
                const savedProfiles = getSavedProfiles();
                if (savedProfiles.length > 0) {
                    loadPlayer(savedProfiles[0].cleanTag || savedProfiles[0].tag);
                } else {
                    clearActivePlayerToGuest();
                }
            }
        },
        onAddPlayer: () => {
            modalControls.openAddPlayerModal();
        }
    });
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

    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#hero-journey-table') {
            if (!hjState.showTable) {
                hjState.showTable = true;
                renderUI();
            }
            const targetEl = document.getElementById('hero-journey-table');
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (window.location.hash) {
            const targetEl = document.getElementById(window.location.hash.substring(1));
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, { passive: true });
}

/**
 * Initializes the standalone Hero Journey app.
 */
async function init() {
    registerGlobalErrorBoundaries();
    consolidateLocalStorageKeys();
    initializeCommitsModal();
    if (typeof window !== 'undefined' && window.location.hash === '#hero-journey-table') {
        hjState.showTable = true;
    }
    setHeroJourneyStateProvider(() => buildStateFromPlayerData(hjState.playerData, hjState));
    const currentSettings = getAppSettings();
    const activeLang = currentSettings.language || 'en';
    if (!state.uiSettings) {
        state.uiSettings = {};
    }
    state.uiSettings.language = activeLang;
    syncLanguageUrl(activeLang, true);
    await loadTranslations(activeLang);
    updateUIWithTranslations(true);
    initAppSettings();
    initializePwaService();
    initializeModalHistoryManager();
    initializeChangelogModal();
    initializeAuthModal();
    initializePasskeysModal();
    initializeSettingsAccount();

    initAppFooter({ version: state.appVersion });

    const urlParams = new URLSearchParams(window.location.search);
    const userIdFromUrl = urlParams.get('userId');
    if (userIdFromUrl && typeof userIdFromUrl === 'string' && userIdFromUrl.trim()) {
        try {
            const existingId = getStorageItem(STORAGE_KEY_MAP.userId.canonical, STORAGE_KEY_MAP.userId.legacy);
            if (!existingId) {
                const targetKey = getActiveUserIdKey();
                localStorage.setItem(targetKey, userIdFromUrl.trim());
                if (isClashCalcHost()) {
                    localStorage.removeItem(STORAGE_KEY_MAP.userId.legacy);
                }
            }
            if (isClashCalcHost()) {
                markUserMigrated(userIdFromUrl.trim()).catch(() => {});
            }
        } catch (_) {}
    }

    initControls();
    const hasUrlTagParam = urlParams.has('tag') || urlParams.has('p') || urlParams.has('player');
    const rawUrlTag = urlParams.get('tag') || urlParams.get('p') || urlParams.get('player');
    let initialTag = getTagFromUrl();
    const cleanInitialTag = normalizePlayerTag(initialTag);
    let resolvedHjTag = cleanInitialTag;

    if (!cleanInitialTag || cleanInitialTag === 'DEFAULT0') {
        if (hasUrlTagParam && (!rawUrlTag || !rawUrlTag.trim() || cleanInitialTag === 'DEFAULT0')) {
            showToast(translate('apiErrors.invalidTag'), 'error');
        }
        const savedProfiles = getSavedProfiles();
        if (savedProfiles.length > 0) {
            initialTag = savedProfiles[0].cleanTag || savedProfiles[0].tag;
            resolvedHjTag = normalizePlayerTag(initialTag);
        } else {
            initialTag = '';
            resolvedHjTag = null;
        }
    }

    initDomainNotice({
        activePlayerTag: resolvedHjTag || null
    });

    const finalCleanTag = normalizePlayerTag(initialTag);
    if (finalCleanTag && finalCleanTag !== 'DEFAULT0') {
        const loadResult = await loadPlayer(finalCleanTag);
        if (!loadResult || !loadResult.success) {
            const errorKey = loadResult?.message || 'apiErrors.notFound';
            showApiErrorToast(errorKey);
            updateUrlTag(hjState.activeTag || null);
        }
    } else {
        updateUrlTag(null);
        renderUI();
    }

    initHeroJourneyDrawer();
    initExternalLinkCatcher();

    const handleLanguageUpdate = () => {
        renderUI();
        updateHeroJourneyDrawer();
    };
    document.addEventListener('languageChanged', handleLanguageUpdate);
    document.addEventListener('app:translate', handleLanguageUpdate);

    if (typeof window !== 'undefined' && window.location.hash) {
        const targetId = window.location.hash.substring(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
            requestAnimationFrame(() => {
                targetEl.scrollIntoView({ behavior: 'smooth' });
            });
        }
    }

    if (typeof window.__APP_LOADED__ === 'function') {
        window.__APP_LOADED__();
    }
    window.isAppStartingUp = false;
}

/** @type {ReturnType<typeof initNavigationDrawer> | null} */
let hjDrawerInstance = null;

/**
 * Updates modular Option 2 Navigation Drawer content on the Hero Journey page.
 * @param {string} [activeView='track']
 */
function updateHeroJourneyDrawer(activeView = 'track') {
    const rawTag = hjState.activeTag || new URLSearchParams(window.location.search).get('tag') || '';
    const cleanTag = rawTag.replace(/^#/, '').trim();
    const isRealPlayer = Boolean(cleanTag && cleanTag !== 'DEFAULT0' && cleanTag !== 'GUEST');

    renderNavigationDrawerContent({
        activeTool: 'hero-journey',
        activeView,
        playerTag: cleanTag,
        profileData: isRealPlayer ? {
            name: hjState.playerData?.name,
            tag: cleanTag ? `#${cleanTag}` : '',
            townHallLevel: hjState.thLevel || hjState.playerData?.townHallLevel || 18,
            trophies: hjState.playerData?.trophies,
            heroLevel: hjState.cumulativeLevel,
            cachedData: hjState.playerData
        } : null,
        onAccountSwitch: (targetTag) => {
            loadPlayer(targetTag);
        },
        onGuestLoad: () => {
            const addPlayerBtn = document.getElementById('add-player-button');
            addPlayerBtn?.click();
        }
    });
}

/**
 * Initializes mobile navigation drawer on the Hero Journey page.
 */
function initHeroJourneyDrawer() {
    const drawerEl = document.getElementById('navigation-drawer');
    const overlayEl = document.querySelector('.navigation-drawer__overlay');
    const buttonEl = document.getElementById('hj-hamburger-btn');
    const closeEl = drawerEl?.querySelector('.navigation-drawer__close') || null;

    if (!drawerEl || !buttonEl) return;

    updateHeroJourneyDrawer('track');

    hjDrawerInstance = initNavigationDrawer({
        drawerEl,
        overlayEl,
        buttonEl,
        closeEl,
        onItemClick: () => {
            hjDrawerInstance?.close();
        }
    });
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

/**
 * Synchronizes Hero Journey state and views when active player or village partition updates across tabs.
 */
function syncHjFromStorage() {
    const saved = getSavedProfiles();
    const active = normalizePlayerTag(hjState.activeTag);
    if (saved.length === 0) {
        if (hjState.playerData || hjState.activeTag) {
            hjState.playerData = null;
            hjState.activeTag = null;
            hjState.cumulativeLevel = 0;
            hjState.errorMessage = '';
            updateUrlTag(null);
            renderUI();
        }
    } else if (saved[0].cleanTag !== active) {
        void loadPlayer(saved[0].cleanTag);
    } else {
        const canonicalKey = getPlayerStorageKey(active);
        const legacyKey = `${PLAYER_PREFIX}#${active}`;
        const raw = localStorage.getItem(canonicalKey) || localStorage.getItem(legacyKey);
        const cached = safeJsonParse(raw, null);
        const cachedProfile = cached?.playerProfile || cached?.playerData || null;
        if (cachedProfile && cachedProfile.tag && normalizePlayerTag(cachedProfile.tag) === active) {
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
        }
        renderUI();
    }
}

/**
 * Listens for cross-tab storage changes specific to Hero Journey.
 */
function initHjSpecificSync() {
    window.addEventListener('storage', (event) => {
        if (!event.key || !event.newValue) return;
        if (
            event.key === 'clashCalc_playerTags' ||
            event.key === 'oreCalc_playerTags' ||
            event.key.startsWith('clashCalc_player_') ||
            event.key.startsWith('oreCalc_player_')
        ) {
            syncHjFromStorage();
        }
    });
    document.addEventListener('app:playerDropdownSync', () => {
        syncHjFromStorage();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            syncHjFromStorage();
        }
    });
}
initHjSpecificSync();
