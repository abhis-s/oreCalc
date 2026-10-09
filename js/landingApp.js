/**
 * Landing Portal Application Controller.
 * Orchestrates hub presentation, navigation drawer, tool launching, and command center modules.
 * Tier 4: UI Application Entry.
 */

import { getLanguageFromPath } from './core/languageRouter.js';
import { loadState } from './core/localStorageManager.js';
import { formatDisplayTag } from './core/storageKeys.js';
import { getSavedProfiles } from './core/playerStorage.js';
import { consolidateLocalStorageKeys } from './core/storageMigrations.js';
import { loadTranslations } from './i18n/translator.js';
import { updateUIWithTranslations } from './i18n/uiTranslator.js';
import { closeModal, initializeModalHistoryManager, openModal } from './utils/modalHistoryManager.js';
import { initializeState, state } from './core/state.js';
import './utils/svgManager.js';
import './utils/imageManager.js';
import './console.js';
import { initNavigationDrawer } from './components/common/navigationDrawer.js';
import { renderNavigationDrawerContent } from './components/common/navigationDrawerRenderer.js';
import { initAppHeader } from './components/common/appHeader.js';
import { initAppFooter } from './components/common/appFooter.js';
import { initExternalLinkCatcher } from './components/common/externalLinkCatcher.js';
import { initializeCommitsModal } from './components/changelog/commitsModal.js';
import { initAppSettings } from './components/common/appSettings.js';
import { registerGlobalErrorBoundaries } from './core/appEventInterceptors.js';
import { initializePwaService } from './services/pwaService.js';
import {
    initToolCardsLayoutObserver,
    renderGuestTeasers
} from './components/landing/landingDashboards.js';
import { renderAccountsGrid } from './components/landing/landingAccounts.js';
import {
    initLandingAccountsManager
} from './components/landing/landingAccountsController.js';
import { initLandingSearchForm } from './components/landing/landingSearchController.js';
import { initializeAuthModal } from './components/auth/authModalInputs.js';
import { initializePasskeysModal } from './components/auth/passkeysModalInputs.js';
import { initializeSettingsAccount } from './components/appSettings/settingsAccountInputs.js';

/**
 * Updates tool CTA, title link, and quick-jump shortcut hrefs to include the active player tag and language prefix.
 * @param {string} [cleanTag]
 */
function updateToolLinks(cleanTag) {
    const currentLang = getLanguageFromPath() || 'en';
    const langPrefix = currentLang === 'en' ? '' : `/${currentLang}`;
    const oreCta = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-launch-ore'));
    const hjCta = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-launch-hj'));
    const oreTitleLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-title-link-ore'));
    const hjTitleLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-title-link-hj'));
    const query = cleanTag ? `?tag=${encodeURIComponent(cleanTag)}` : '';

    const oreUrl = `${langPrefix}/ore-calculator/${query}`;
    const hjUrl = `${langPrefix}/hero-journey/${query}`;
    const damageUrl = `${langPrefix}/damage-calculator/${query}`;

    if (oreCta) oreCta.href = oreUrl;
    if (oreTitleLink) oreTitleLink.href = oreUrl;
    if (hjCta) hjCta.href = hjUrl;
    if (hjTitleLink) hjTitleLink.href = hjUrl;

    const damageCta = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-launch-damage'));
    const damageTitleLink = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-title-link-damage'));
    if (damageCta) damageCta.href = damageUrl;
    if (damageTitleLink) damageTitleLink.href = damageUrl;

    const jumpPlanner = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-jump-planner'));
    const jumpIncome = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-jump-income'));
    const jumpTrack = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-jump-track'));
    const jumpTable = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-jump-table'));
    const jumpZapQuake = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-jump-zapquake'));
    const jumpEquipmentSnipes = /** @type {HTMLAnchorElement | null} */ (document.getElementById('landing-jump-eq-snipes'));

    if (jumpPlanner) jumpPlanner.href = `${langPrefix}/ore-calculator/${query}#planner`;
    if (jumpIncome) jumpIncome.href = `${langPrefix}/ore-calculator/${query}#income`;
    if (jumpTrack) jumpTrack.href = `${langPrefix}/hero-journey/${query}#home-hj-card`;
    if (jumpTable) jumpTable.href = `${langPrefix}/hero-journey/${query}#hero-journey-table`;
    if (jumpZapQuake) jumpZapQuake.href = `${langPrefix}/damage-calculator/${query}`;
    if (jumpEquipmentSnipes) jumpEquipmentSnipes.href = `${langPrefix}/damage-calculator/${query}#cluster_planner`;
}

/** @type {ReturnType<typeof initNavigationDrawer> | null} */
let landingDrawerInstance = null;
let activeLandingTag = '';
/** @type {import('./core/playerStorage.js').SavedProfileSummary | null} */
let activeLandingProfile = null;
/** @type {ReturnType<typeof initLandingAccountsManager> | null} */
let landingAccountsManager = null;
/** @type {ReturnType<typeof initLandingSearchForm> | null} */
let landingSearchController = null;

/**
 * Updates modular Option 2 Navigation Drawer content on the Landing Portal.
 * @param {string} [activeAction='']
 */
function updateLandingDrawer(activeAction = '') {
    renderNavigationDrawerContent({
        activeTool: 'hub',
        activeView: activeAction,
        playerTag: activeLandingTag,
        profileData: activeLandingProfile ? {
            name: activeLandingProfile.name,
            tag: activeLandingProfile.tag || formatDisplayTag(activeLandingProfile.cleanTag),
            townHallLevel: activeLandingProfile.townHallLevel || 18,
            trophies: activeLandingProfile.cachedData?.trophies || 0,
            leagueIcon: activeLandingProfile.cachedData?.league?.iconUrls?.small || '',
            leagueName: activeLandingProfile.cachedData?.league?.name || '',
            cachedData: activeLandingProfile.cachedData
        } : null,
        onAccountSwitch: (targetTag) => {
            if (landingAccountsManager?.selectVillage) {
                landingAccountsManager.selectVillage(targetTag);
            }
        }
    });
}

/**
 * Initializes the Command Center: account switching, showcase, and search form.
 */
async function initCommandCenter() {
    const launchModal = document.getElementById('landing-launch-modal');
    const launchCloseBtn = document.getElementById('landing-launch-close');
    const launchStayBtn = document.getElementById('landing-modal-stay-btn');
    const launchOreLink = document.getElementById('landing-modal-launch-ore');
    const launchHjLink = document.getElementById('landing-modal-launch-hj');
    const launchDamageLink = document.getElementById('landing-modal-launch-damage');
    const launchThEl = document.getElementById('landing-launch-th');
    const launchNameEl = document.getElementById('landing-launch-name');
    const launchTagEl = document.getElementById('landing-launch-tag');

    /**
     * Opens the Launch Choice Modal for the newly added village.
     * @param {{ cleanTag: string, name: string, townHallLevel: number }} village
     */
    const openLaunchModal = (village) => {
        if (!launchModal) return;
        const thLevel = Math.max(1, Math.min(18, Number(village.townHallLevel) || 18));
        if (launchThEl) {
            launchThEl.innerHTML = `
                <orecalc-assets-image class="th-badge-img" src="assets/th/th${thLevel}.png" alt="Town Hall ${thLevel}" size="standard"></orecalc-assets-image>
                <span class="th-badge-level-overlay">${thLevel}</span>
            `;
        }
        if (launchNameEl) launchNameEl.textContent = village.name;
        if (launchTagEl) launchTagEl.textContent = formatDisplayTag(village.cleanTag);

        const rootLang = getLanguageFromPath();
        const base = (rootLang && rootLang !== 'en') ? `/${rootLang}` : '';
        if (launchOreLink) launchOreLink.setAttribute('href', `${base}/ore-calculator/?tag=${encodeURIComponent(village.cleanTag)}`);
        if (launchHjLink) launchHjLink.setAttribute('href', `${base}/hero-journey/?tag=${encodeURIComponent(village.cleanTag)}`);
        if (launchDamageLink) launchDamageLink.setAttribute('href', `${base}/damage-calculator/?tag=${encodeURIComponent(village.cleanTag)}`);

        openModal(launchModal);
    };

    const closeLaunchModal = () => {
        if (launchModal) closeModal(launchModal);
    };

    if (launchCloseBtn) launchCloseBtn.addEventListener('click', closeLaunchModal);
    if (launchStayBtn) launchStayBtn.addEventListener('click', closeLaunchModal);

    const accountsManager = initLandingAccountsManager({
        onActiveVillageChanged: (cleanTag, profile) => {
            if (cleanTag && cleanTag !== 'DEFAULT0' && typeof document !== 'undefined' && document?.documentElement?.classList) {
                document.documentElement.classList.add('has-player');
            }
            activeLandingTag = cleanTag;
            activeLandingProfile = profile;
            updateToolLinks(cleanTag);
            updateLandingDrawer();
        },
        onAllVillagesDeleted: () => {
            if (typeof document !== 'undefined' && document?.documentElement?.classList) {
                document.documentElement.classList.remove('has-player');
            }
            const accountsSection = document.getElementById('landing-saved-accounts');
            const accountsHeader = accountsSection?.querySelector('.landing-accounts-header');
            const accountsList = document.getElementById('landing-accounts-list');
            const showcaseSection = document.getElementById('landing-active-profile');
            const searchForm = document.getElementById('landing-search-form');
            const cancelBtn = document.getElementById('landing-search-cancel-btn');

            if (accountsSection) {
                accountsSection.hidden = false;
                accountsSection.style.display = 'flex';
            }
            if (accountsHeader) {
                /** @type {HTMLElement} */ (accountsHeader).hidden = true;
                /** @type {HTMLElement} */ (accountsHeader).style.display = 'none';
            }
            if (accountsList) {
                accountsList.hidden = true;
                accountsList.style.display = 'none';
            }
            if (showcaseSection) {
                showcaseSection.hidden = true;
                showcaseSection.style.display = 'none';
            }
            if (searchForm) {
                searchForm.hidden = false;
                searchForm.style.display = 'flex';
            }
            if (cancelBtn) {
                cancelBtn.hidden = true;
                cancelBtn.style.display = 'none';
            }

            landingSearchController?.updateToggleAddBtnState(false);
            updateToolLinks();
            renderGuestTeasers();
            activeLandingTag = '';
            activeLandingProfile = null;
            updateLandingDrawer();
        },
        isSearchFormOpen: () => Boolean(landingSearchController?.isSearchFormOpen()),
        setToggleAddBtnState: (isOpen) => landingSearchController?.updateToggleAddBtnState(isOpen),
        openLaunchModal
    });
    landingAccountsManager = accountsManager;

    landingSearchController = initLandingSearchForm({
        selectVillage: (cleanTag) => accountsManager.selectVillage(cleanTag),
        handleDeleteVillage: (cleanTag) => accountsManager.handleDeleteVillage(cleanTag),
        openLaunchModal
    });

    const initialProfiles = getSavedProfiles();
    const searchFormEl = document.getElementById('landing-search-form');
    const cancelBtnEl = document.getElementById('landing-search-cancel-btn');
    if (initialProfiles.length > 0) {
        if (searchFormEl) {
            searchFormEl.hidden = true;
            searchFormEl.style.display = 'none';
        }
        if (cancelBtnEl) {
            cancelBtnEl.hidden = true;
            cancelBtnEl.style.display = 'none';
        }
        landingSearchController.updateToggleAddBtnState(false);
    }

    document.addEventListener('languageChanged', () => {
        const curTag = accountsManager.getActiveTag();
        if (curTag) {
            accountsManager.selectVillage(curTag);
        } else {
            updateToolLinks();
            renderGuestTeasers();
            updateLandingDrawer();
        }
        const currentProfiles = getSavedProfiles();
        if (currentProfiles.length > 0 && curTag) {
            renderAccountsGrid(currentProfiles, curTag, accountsManager.selectVillage, accountsManager.handleDeleteVillage);
        }
    });

    initToolCardsLayoutObserver();
}

/**
 * Synchronizes landing portal state upon cross-tab player storage changes.
 */
function refreshLandingPortal() {
    if (!landingAccountsManager) return;
    const currentProfiles = getSavedProfiles();
    if (currentProfiles.length === 0) {
        if (typeof document !== 'undefined' && document?.documentElement?.classList) {
            document.documentElement.classList.remove('has-player');
        }
        updateToolLinks();
        renderGuestTeasers();
        updateLandingDrawer();
        const accountsSection = document.getElementById('landing-saved-accounts');
        const accountsHeader = accountsSection?.querySelector('.landing-accounts-header');
        const accountsList = document.getElementById('landing-accounts-list');
        const showcaseSection = document.getElementById('landing-active-profile');
        const searchForm = document.getElementById('landing-search-form');
        const cancelBtn = document.getElementById('landing-search-cancel-btn');
        if (accountsHeader) {
            /** @type {HTMLElement} */ (accountsHeader).hidden = true;
            /** @type {HTMLElement} */ (accountsHeader).style.display = 'none';
        }
        if (accountsList) {
            accountsList.hidden = true;
            accountsList.style.display = 'none';
        }
        if (showcaseSection) {
            showcaseSection.hidden = true;
            showcaseSection.style.display = 'none';
        }
        if (searchForm) {
            searchForm.hidden = false;
            searchForm.style.display = 'flex';
        }
        if (cancelBtn) {
            cancelBtn.hidden = true;
            cancelBtn.style.display = 'none';
        }
        landingSearchController?.updateToggleAddBtnState(false);
    } else {
        if (typeof document !== 'undefined' && document?.documentElement?.classList) {
            document.documentElement.classList.add('has-player');
        }
        landingSearchController?.closeSearchForm();
        landingSearchController?.updateToggleAddBtnState(false);
        const searchFormEl = document.getElementById('landing-search-form');
        const cancelBtnEl = document.getElementById('landing-search-cancel-btn');
        if (searchFormEl) {
            searchFormEl.hidden = true;
            searchFormEl.style.display = 'none';
        }
        if (cancelBtnEl) {
            cancelBtnEl.hidden = true;
            cancelBtnEl.style.display = 'none';
        }

        const currentActiveTag = landingAccountsManager.getActiveTag();
        const stillExists = currentProfiles.some(p => p.cleanTag === currentActiveTag);
        const targetTag = (stillExists && currentActiveTag) ? currentActiveTag : currentProfiles[0].cleanTag;

        renderAccountsGrid(
            currentProfiles,
            targetTag,
            landingAccountsManager.selectVillage,
            landingAccountsManager.handleDeleteVillage
        );
        landingAccountsManager.selectVillage(targetTag);
    }
}

/**
 * Initializes cross-tab storage sync for the Landing Portal.
 */
function initLandingCrossTabSync() {
    window.addEventListener('storage', (event) => {
        if (!event.key) return;
        if (
            event.key === 'clashCalc_playerTags' ||
            event.key === 'oreCalc_playerTags' ||
            event.key.startsWith('clashCalc_player_') ||
            event.key.startsWith('oreCalc_player_')
        ) {
            refreshLandingPortal();
        }
    });
    document.addEventListener('app:playerDropdownSync', () => {
        refreshLandingPortal();
    });
    document.addEventListener('app:accountSynced', () => {
        refreshLandingPortal();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refreshLandingPortal();
        }
    });
}

/**
 * Initializes header scroll elevation and layout observer on the Landing Portal.
 */
function initHeaderScroll() {
    initAppHeader({
        headerElement: '.landing-header',
        hasPill: false,
        hasPlayerDropdown: false,
        hasTabs: false
    });
}

/**
 * Initializes mobile navigation drawer on the Landing Portal.
 */
function initLandingDrawer() {
    const drawerEl = document.getElementById('navigation-drawer');
    const overlayEl = document.querySelector('.navigation-drawer__overlay');
    const buttonEl = document.getElementById('landing-hamburger-btn');
    const closeEl = drawerEl?.querySelector('.navigation-drawer__close') || null;

    if (!drawerEl || !buttonEl) return;

    updateLandingDrawer();

    landingDrawerInstance = initNavigationDrawer({
        drawerEl,
        overlayEl,
        buttonEl,
        closeEl,
        onItemClick: () => {
            landingDrawerInstance?.close();
        }
    });
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        registerGlobalErrorBoundaries();
        consolidateLocalStorageKeys();
        initializeModalHistoryManager();
        initializeCommitsModal();
        let savedState = null;
        try {
            savedState = loadState();
        } catch (e) {
            console.error('Failed to load saved state:', e);
        }
        initializeState(savedState);
        initAppSettings();
        initHeaderScroll();
        const currentLang = getLanguageFromPath() || 'en';
        if (!state.uiSettings) {
            state.uiSettings = {};
        }
        state.uiSettings.language = currentLang;
        await loadTranslations(currentLang);
        updateUIWithTranslations(true);
        await initCommandCenter();
        initAppFooter();
        initializePwaService();
        initLandingDrawer();
        initLandingCrossTabSync();
        initExternalLinkCatcher();
        initializeAuthModal();
        initializePasskeysModal();
        initializeSettingsAccount();

        if (typeof window.__APP_LOADED__ === 'function') {
            window.__APP_LOADED__();
        }
        window.isAppStartingUp = false;
    });
}
