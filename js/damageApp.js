/**
 * Equipment Damage & ZapQuake Calculator Page Orchestrator.
 * Tier 4: Main Application Entrypoint for /damage-calculator/
 */

import { loadTranslations } from './i18n/translator.js';
import { updateUIWithTranslations } from './i18n/uiTranslator.js';
import { initDomainNotice } from './components/common/domainNotice.js';
import { initAppFooter } from './components/common/appFooter.js';
import { renderNavigationDrawerContent } from './components/common/navigationDrawerRenderer.js';
import { initAppHeader } from './components/common/appHeader.js';
import { renderBottomNavBar } from './components/common/bottomNavBar.js';
import { initExternalLinkCatcher } from './components/common/externalLinkCatcher.js';
import { initializeCommitsModal } from './components/changelog/commitsModal.js';
import { initializeChangelogModal } from './components/changelog/changelogModal.js';
import { syncLanguageUrl } from './core/languageRouter.js';
import { state } from './core/state.js';
import {
    initAppSettings,
    getAppSettings
} from './components/common/appSettings.js';
import {
    normalizePlayerTag,
    getPlayerStorageKey,
    getActiveUserId,
    PLAYER_PREFIX
} from './core/storageKeys.js';
import { getPlayerTagFromUrl, syncPlayerTagToUrl } from './core/playerUrlRouter.js';
import { getSavedProfiles, savePlayerProfileToStorage, setActivePlayerTag } from './core/playerStorage.js';
import { consolidateLocalStorageKeys } from './core/storageMigrations.js';
import { safeJsonParse } from './utils/jsonUtils.js';
import { initializeModalHistoryManager } from './utils/modalHistoryManager.js';
import { showApiErrorToast } from './ui/toast.js';
import { fetchPlayerData, saveSinglePlayerData } from './services/apiService.js';
import './utils/imageManager.js';
import './console.js';
import { preloadDefensesData } from './data/defenseTargetsData.js';
import { renderStandalonePlayerDropdown } from './components/player/standalonePlayerDropdownDisplay.js';
import {
    initStandaloneAddPlayerModal,
    initStandalonePlayerDropdown
} from './components/player/standalonePlayerDropdownInputs.js';

import {
    damageCalcState,
    loadPersistedState
} from './components/damage/damageCalcState.js';
import { syncPlayerVillageData } from './components/damage/damageCalcSyncService.js';

import {
    renderOffenseBar
} from './components/damage/damageCalcOffenseBarDisplay.js';
import { renderZapQuakePanel } from './components/damage/damageCalcZapQuakeDisplay.js';
import { renderDefenseBoardPanel } from './components/damage/damageCalcDefenseBoardDisplay.js';
import { attachDamageCalcListeners } from './components/damage/damageCalcInputs.js';
import {
    constructDamageTabUrl,
    initDamageCalcTabNav,
    resolveDamageTabFromUrl,
    switchDamageTab
} from './components/damage/damageCalcTabNav.js';
import { initializeAuthModal } from './components/auth/authModalInputs.js';
import { initializePasskeysModal } from './components/auth/passkeysModalInputs.js';
import { initializeSettingsAccount } from './components/appSettings/settingsAccountInputs.js';
import { registerGlobalErrorBoundaries } from './core/appEventInterceptors.js';
import { initializePwaService } from './services/pwaService.js';

/** @type {{ openAddPlayerModal: () => void, closeAddPlayerModal: () => void } | null} */
let activeAddPlayerModalControls = null;

/**
 * Asynchronously revalidates and refreshes player data in the background from the API.
 * Follows the stale-while-revalidate pattern: cached data renders instantly, and once
 * the remote payload arrives, state, dropdowns, drawer, and views update smoothly.
 *
 * @param {string} tag - Player tag to refresh.
 * @param {boolean} [hadCachedData=false] - Whether local cached data was already rendered.
 * @returns {Promise<boolean>} True if revalidation succeeded.
 */
export async function revalidatePlayerData(tag, hadCachedData = false) {
    const cleanTag = normalizePlayerTag(tag);
    if (!cleanTag || cleanTag === 'DEFAULT0') return false;

    try {
        const data = await fetchPlayerData(cleanTag);
        if (!data || !data.tag) {
            throw new Error('apiErrors.notFound');
        }

        const serverTag = normalizePlayerTag(data.tag);
        // Guard against race conditions if user switched active player in the interim
        if (damageCalcState.activeTag && damageCalcState.activeTag !== cleanTag && damageCalcState.activeTag !== serverTag) {
            savePlayerProfileToStorage(data, false);
            return true;
        }

        savePlayerProfileToStorage(data, false);
        const userId = getActiveUserId();
        if (userId) {
            const canonicalKey = getPlayerStorageKey(serverTag);
            const partition = safeJsonParse(localStorage.getItem(canonicalKey), null);
            if (partition) {
                saveSinglePlayerData(userId, serverTag, partition).catch(() => {});
            }
        }
        damageCalcState.activeTag = serverTag;
        syncPlayerTagToUrl(serverTag);
        syncPlayerVillageData(data, { resetUI: false });
        renderStandalonePlayerDropdown(serverTag);
        renderActiveView();
        return true;
    } catch (err) {
        if (hadCachedData) {
            console.warn('Background player revalidation failed:', err?.message || err);
        } else {
            showApiErrorToast(err?.message || 'apiErrors.notFound');
        }
        return false;
    }
}

/**
 * Loads partitioned player data directly from localStorage for deep synchronization.
 * @param {string} cleanTag
 * @returns {any | null}
 */
function getPlayerDataFromStorage(cleanTag) {
    if (!cleanTag) return null;
    const canonicalKey = getPlayerStorageKey(cleanTag);
    const legacyKey = `${PLAYER_PREFIX}#${cleanTag}`;
    const raw = localStorage.getItem(canonicalKey) || localStorage.getItem(legacyKey);
    const partition = safeJsonParse(raw, null);
    if (!partition) return null;
    const profile = partition.playerProfile || partition.playerData || {};
    return {
        ...profile,
        tag: profile.tag || cleanTag,
        townHallLevel: profile.townHallLevel || partition.townHallLevel,
        heroes: partition.heroes || profile.heroes,
        spells: profile.spells || partition.spells
    };
}

/**
 * Initializes and synchronizes player profile data if available.
 */
function initializePlayerProfile() {
    const urlTag = getPlayerTagFromUrl();
    const savedProfiles = getSavedProfiles();

    let targetProfile = null;
    let hadCachedData = false;

    if (urlTag) {
        targetProfile = savedProfiles.find(p => p.cleanTag === urlTag);
        if (!targetProfile) {
            const rawStorage = localStorage.getItem(getPlayerStorageKey(urlTag));
            if (rawStorage) {
                targetProfile = safeJsonParse(rawStorage, null);
            }
        }
    } else if (savedProfiles.length > 0) {
        targetProfile = savedProfiles[0];
    }

    if (targetProfile) {
        const cleanTag = normalizePlayerTag(targetProfile.cleanTag || targetProfile.tag);
        if (cleanTag) {
            damageCalcState.activeTag = cleanTag;
            syncPlayerTagToUrl(cleanTag);
            hadCachedData = Boolean(targetProfile.cachedData || targetProfile.name);
        }
        const fullData = cleanTag ? getPlayerDataFromStorage(cleanTag) : null;
        syncPlayerVillageData(fullData || targetProfile.cachedData || targetProfile, { resetUI: false });
    } else if (urlTag) {
        damageCalcState.activeTag = urlTag;
        syncPlayerTagToUrl(urlTag);
        hadCachedData = false;
    }

    const activeTag = damageCalcState.activeTag || urlTag;
    if (activeTag && activeTag !== 'DEFAULT0') {
        void revalidatePlayerData(activeTag, hadCachedData);
    }
}

/**
 * Switches the active player village and synchronizes calculations.
 * @param {string} tag
 */
function switchPlayer(tag) {
    const cleanTag = normalizePlayerTag(tag);
    if (!cleanTag) return;

    setActivePlayerTag(cleanTag);

    const savedProfiles = getSavedProfiles();
    const prevProfile = savedProfiles.find(p => p.cleanTag === damageCalcState.activeTag);
    const prevTh = prevProfile?.townHallLevel || prevProfile?.cachedData?.townHallLevel || damageCalcState.playerTownHall || 18;

    damageCalcState.activeTag = cleanTag;
    syncPlayerTagToUrl(cleanTag);

    const targetProfile = savedProfiles.find(p => p.cleanTag === cleanTag);
    let hadCachedData = false;
    if (targetProfile) {
        const nextTh = targetProfile.townHallLevel || targetProfile.cachedData?.townHallLevel || 18;
        const fullData = getPlayerDataFromStorage(cleanTag);
        syncPlayerVillageData(fullData || targetProfile.cachedData || targetProfile, { resetUI: prevTh !== nextTh });
        hadCachedData = Boolean(targetProfile.cachedData || targetProfile.name);
    }

    renderStandalonePlayerDropdown(cleanTag);
    renderActiveView();
    void revalidatePlayerData(cleanTag, hadCachedData);
}

const damageNavigationRegistry = [
    {
        id: 'zapquake',
        i18nKey: 'views.damageCalc.tabs.zapQuake',
        iconOutline: 'zap-outline',
        iconFilled: 'zap-filled'
    },
    {
        id: 'cluster_planner',
        i18nKey: 'views.damageCalc.tabs.clusterPlanner',
        iconOutline: 'shield-outline',
        iconFilled: 'shield-filled'
    }
];

/**
 * Updates tab navigation button active states across desktop header and bottom nav tabs.
 */
function updateTabNavUI() {
    const tabButtons = document.querySelectorAll('.tab-button, .calc-tab-nav__btn, .bottom-nav-bar .nav-button');
    tabButtons.forEach(btn => {
        const tab = btn.getAttribute('data-tab');
        if (tab === damageCalcState.activeTab) {
            btn.classList.add('active', 'is-active');
            btn.setAttribute('aria-selected', 'true');
        } else {
            btn.classList.remove('active', 'is-active');
            btn.setAttribute('aria-selected', 'false');
        }
    });

    const bottomNavContainer = document.querySelector('.bottom-nav-bar');
    if (bottomNavContainer) {
        renderBottomNavBar({
            container: bottomNavContainer,
            items: damageNavigationRegistry,
            activeTabId: damageCalcState.activeTab
        });
    }
}

/**
 * Main render function for the active calculator view.
 */
function renderActiveView() {
    const mainContainer = document.getElementById('calc-view-container');
    if (!mainContainer) return;

    updateTabNavUI();

    switch (damageCalcState.activeTab) {
        case 'zapquake':
            renderZapQuakePanel(damageCalcState, mainContainer);
            break;
        case 'cluster_planner':
            renderDefenseBoardPanel(damageCalcState, mainContainer);
            break;
        default:
            renderZapQuakePanel(damageCalcState, mainContainer);
            break;
    }

    const modifierBarContainer = document.getElementById('calc-modifier-bar') || document.getElementById('calc-offense-bar');
    if (modifierBarContainer) {
        renderOffenseBar(damageCalcState, modifierBarContainer);
    }

    attachDamageCalcListeners(damageCalcState, document.body, renderActiveView);
    updateUIWithTranslations(true);
    renderNavigationDrawerContent({
        activeView: damageCalcState.activeTab,
        playerTag: damageCalcState.activeTag || getPlayerTagFromUrl() || '',
        onGuestLoad: () => {
            activeAddPlayerModalControls?.openAddPlayerModal();
        },
        onAccountSwitch: (tag) => {
            switchPlayer(tag);
        },
        onViewSelect: (viewId) => {
            switchDamageTab(viewId, damageCalcState, renderActiveView);
        }
    });
}

/**
 * Synchronizes damage calculator active profile upon cross-tab player storage changes.
 */
function initDamageCrossTabSync() {
    const syncFromStorage = () => {
        const saved = getSavedProfiles();
        const active = damageCalcState.activeTag;
        if (saved.length === 0) {
            damageCalcState.activeTag = '';
            syncPlayerTagToUrl('');
            renderStandalonePlayerDropdown('');
            renderActiveView();
        } else if (saved[0].cleanTag !== active) {
            switchPlayer(saved[0].cleanTag);
        } else {
            const currentProfile = saved.find(p => p.cleanTag === active);
            const fullData = getPlayerDataFromStorage(active);
            if (fullData || currentProfile) {
                syncPlayerVillageData(fullData || currentProfile.cachedData || currentProfile, { resetUI: false });
            }
            renderStandalonePlayerDropdown(active);
            renderActiveView();
        }
    };

    window.addEventListener('storage', (event) => {
        if (!event.key) return;
        if (
            event.key === 'clashCalc_playerTags' ||
            event.key === 'oreCalc_playerTags' ||
            event.key.startsWith('clashCalc_player_') ||
            event.key.startsWith('oreCalc_player_')
        ) {
            syncFromStorage();
        }
    });

    document.addEventListener('app:playerDropdownSync', () => {
        syncFromStorage();
    });

    if (typeof document?.addEventListener === 'function') {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                syncFromStorage();
            }
        });
    }
}

/**
 * Application bootstrapper.
 */
async function initDamageApp() {
    registerGlobalErrorBoundaries();
    consolidateLocalStorageKeys();
    const defensesReady = preloadDefensesData();
    const settings = getAppSettings();
    state.uiSettings = {
        language: settings.language,
        theme: settings.theme,
        accentColor: settings.accentColor
    };

    syncLanguageUrl(settings.language, true);
    await Promise.all([loadTranslations(settings.language), defensesReady]);
    updateUIWithTranslations(true);

    loadPersistedState();
    initializePlayerProfile();

    const urlTab = resolveDamageTabFromUrl();
    damageCalcState.activeTab = urlTab || 'zapquake';
    if (!urlTab && typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', constructDamageTabUrl('zapquake'));
    }

    initDomainNotice();
    initAppFooter();
    initializePwaService();

    initAppHeader({
        headerElement: '.app-header',
        hasTabs: true,
        hasPlayerDropdown: true,
        hasPill: true,
        bindDrawer: true
    });

    activeAddPlayerModalControls = initStandaloneAddPlayerModal({
        onLoadPlayer: async (cleanedTag) => {
            const data = await fetchPlayerData(cleanedTag);
            if (!data || !data.tag) {
                throw new Error('apiErrors.notFound');
            }

            const savedProfiles = getSavedProfiles();
            const isFirstPlayer = savedProfiles.length === 0;
            const prevProfile = savedProfiles.find(p => p.cleanTag === damageCalcState.activeTag);
            const prevTh = prevProfile?.townHallLevel || prevProfile?.cachedData?.townHallLevel || damageCalcState.playerTownHall || 18;
            const nextTh = data.townHallLevel || 18;

            const serverTag = savePlayerProfileToStorage(data);
            damageCalcState.activeTag = serverTag;
            syncPlayerTagToUrl(serverTag);
            syncPlayerVillageData(data, { resetUI: prevTh !== nextTh, isFirstPlayer });
            renderStandalonePlayerDropdown(serverTag);
            renderActiveView();
            return { success: true };
        }
    });

    initStandalonePlayerDropdown({
        getActivePlayerTag: () => damageCalcState.activeTag,
        onSelectPlayer: (tag) => {
            switchPlayer(tag);
        },
        onDeletePlayer: (tag) => {
            const remaining = getSavedProfiles();
            const nextTag = remaining.length > 0 ? remaining[0].cleanTag : '';
            if (damageCalcState.activeTag === tag || getPlayerTagFromUrl() === tag) {
                if (nextTag) {
                    switchPlayer(nextTag);
                } else {
                    damageCalcState.activeTag = '';
                    syncPlayerTagToUrl('');
                    renderStandalonePlayerDropdown('');
                    renderActiveView();
                }
            } else {
                renderStandalonePlayerDropdown(damageCalcState.activeTag);
            }
        },
        onAddPlayer: () => {
            activeAddPlayerModalControls?.openAddPlayerModal();
        }
    });

    initAppSettings();

    initializeModalHistoryManager();
    initializeCommitsModal();
    initializeChangelogModal();
    initializeAuthModal();
    initializePasskeysModal();
    initializeSettingsAccount();

    renderStandalonePlayerDropdown(damageCalcState.activeTag);
    initExternalLinkCatcher();
    initDamageCrossTabSync();

    initDamageCalcTabNav(damageCalcState, renderActiveView);
    renderActiveView();

    document.addEventListener('languageChanged', () => {
        renderActiveView();
        renderStandalonePlayerDropdown(damageCalcState.activeTag);
    });

    if (typeof window.__APP_LOADED__ === 'function') {
        window.__APP_LOADED__();
    }
    window.isAppStartingUp = false;
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDamageApp);
    } else {
        initDamageApp();
    }
}
