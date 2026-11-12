/**
 * Landing Portal Application Controller.
 * Orchestrates hub presentation, navigation drawer, tool launching, and command center modules.
 * Tier 4: UI Application Entry.
 */

import { getLanguageFromPath } from './core/languageRouter.js';
import { formatDisplayTag } from './core/storageKeys.js';
import { getSavedProfiles } from './core/playerStorage.js';
import { closeModal, openModal } from './utils/modalHistoryManager.js';
import { state } from './core/state.js';
import {
    bindStandaloneNavigationDrawer,
    bootstrapShellLanguageAndStorage,
    finalizeRouteMount,
    initSharedShellChrome,
    mountWhenReady
} from './core/shellBootstrapper.js';
import './utils/svgManager.js';
import './utils/imageManager.js';
import './console.js';
import { renderNavigationDrawerContent } from './components/common/navigationDrawerDisplay.js';
import {
    initToolCardsLayoutObserver,
    renderGuestTeasers
} from './components/landing/landingDashboards.js';
import { renderAccountsGrid } from './components/landing/landingAccounts.js';
import {
    initLandingAccountsManager
} from './components/landing/landingAccountsController.js';
import { initLandingSearchForm } from './components/landing/landingSearchController.js';
import {
    initLandingToolsInputs,
    destroyLandingToolsInputs
} from './components/landing/landingToolsInputs.js';
import { renderTownHallBadge } from './components/common/townHallBadge.js';

/**
 * Updates tool CTA, title link, and quick-jump shortcut hrefs to include the active player tag and language prefix.
 * @param {string} [cleanTag]
 */
function updateToolLinks(cleanTag) {
    const currentLang = getLanguageFromPath() || state.uiSettings?.language || 'en';
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

    const plannerQuery = query ? `${query}&tab=planner` : '?tab=planner';
    const incomeQuery = query ? `${query}&tab=income` : '?tab=income';
    const clusterQuery = query ? `${query}&tab=cluster-planner` : '?tab=cluster-planner';

    if (jumpPlanner) jumpPlanner.href = `${langPrefix}/ore-calculator/${plannerQuery}`;
    if (jumpIncome) jumpIncome.href = `${langPrefix}/ore-calculator/${incomeQuery}`;
    if (jumpTrack) jumpTrack.href = `${langPrefix}/hero-journey/${query}#hero-journey-track-card`;
    if (jumpTable) jumpTable.href = `${langPrefix}/hero-journey/${query}#hero-journey-table`;
    if (jumpZapQuake) jumpZapQuake.href = `${langPrefix}/damage-calculator/${query}`;
    if (jumpEquipmentSnipes) jumpEquipmentSnipes.href = `${langPrefix}/damage-calculator/${clusterQuery}`;
}

/** @type {ReturnType<typeof bindStandaloneNavigationDrawer>} */
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
    if (!isMounted) return;
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
    const launchCloseBtn = document.getElementById('close-landing-launch-modal-btn') || document.getElementById('landing-launch-close');
    const launchStayBtn = document.getElementById('landing-modal-stay-btn');
    const launchOreLink = document.getElementById('landing-modal-launch-ore');
    const launchHjLink = document.getElementById('landing-modal-launch-hj');
    const launchDamageLink = document.getElementById('landing-modal-launch-damage');
    const launchNameEl = document.getElementById('landing-launch-name');
    const launchTagEl = document.getElementById('landing-launch-tag');

    /**
     * Opens the Launch Choice Modal for the newly added village.
     * @param {{ cleanTag: string, name: string, townHallLevel: number }} village
     */
    const openLaunchModal = (village) => {
        if (!launchModal) return;
        const thLevel = Math.max(1, Math.min(18, Number(village.townHallLevel) || 18));
        const activeLaunchThEl = document.getElementById('landing-launch-th');
        if (activeLaunchThEl) {
            activeLaunchThEl.outerHTML = renderTownHallBadge({
                thLevel,
                size: 'md',
                className: 'account-card-th landing-modal-th',
                id: 'landing-launch-th'
            });
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
                showcaseSection.innerHTML = '';
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

    initToolCardsLayoutObserver();
}

/**
 * Synchronizes landing portal state upon cross-tab player storage changes.
 */
function refreshLandingPortal() {
    if (!isMounted || !landingAccountsManager) return;
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
            showcaseSection.innerHTML = '';
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
    document.addEventListener('languageChanged', () => {
        if (!isMounted || !landingAccountsManager) return;
        const curTag = landingAccountsManager.getActiveTag();
        if (curTag) {
            landingAccountsManager.selectVillage(curTag);
        } else {
            updateToolLinks();
            renderGuestTeasers();
            updateLandingDrawer();
        }
        const currentProfiles = getSavedProfiles();
        if (currentProfiles.length > 0 && curTag) {
            renderAccountsGrid(currentProfiles, curTag, landingAccountsManager.selectVillage, landingAccountsManager.handleDeleteVillage);
        }
    });
}

let isMounted = false;
let hasAttachedLandingListeners = false;
/** @type {Promise<void> | null} */
let activeMountPromise = null;

/**
 * Mounts the Landing Portal application.
 * @param {Object} [options={}]
 * @param {boolean} [options.force=false]
 * @returns {Promise<void>}
 */
export async function mount(options = {}) {
    if (isMounted && !options.force) return;
    if (activeMountPromise) {
        return activeMountPromise;
    }

    activeMountPromise = (async () => {
        isMounted = true;

        try {
            sessionStorage.setItem('clashCalc_sessionLaunched', 'true');
        } catch (_) {}

        await bootstrapShellLanguageAndStorage({ hydrateState: true });
        initSharedShellChrome({
            domainNotice: false,
            headerOptions: {
                headerElement: '.landing-header',
                hasPill: true,
                hasPlayerDropdown: false,
                hasTabs: false
            }
        });

        updateToolLinks();
        await initCommandCenter();
        initLandingToolsInputs();
        landingDrawerInstance = bindStandaloneNavigationDrawer(updateLandingDrawer);
        if (!hasAttachedLandingListeners) {
            hasAttachedLandingListeners = true;
            initLandingCrossTabSync();
        }

        finalizeRouteMount('hub', { mount, destroy });
    })();

    try {
        await activeMountPromise;
    } finally {
        activeMountPromise = null;
    }
}

/**
 * Destroys and cleans up active Landing Portal controllers and observers.
 */
export function destroy() {
    if (!isMounted) return;
    isMounted = false;

    destroyLandingToolsInputs();
    landingSearchController?.destroy?.();
    landingAccountsManager?.destroy?.();
    landingDrawerInstance?.destroy?.();
    landingAccountsManager = null;
    landingSearchController = null;
    landingDrawerInstance = null;
}

mountWhenReady(mount);
