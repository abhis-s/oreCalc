/**
 * Account & Security Page Orchestrator.
 * Tier 4: Main Application Entrypoint for /account/
 */

import { loadTranslations } from './i18n/translator.js';
import { updateUIWithTranslations } from './i18n/uiTranslator.js';
import { initDomainNotice } from './components/common/domainNotice.js';
import { initAppFooter } from './components/common/appFooter.js';
import { renderNavigationDrawerContent } from './components/common/navigationDrawerRenderer.js';
import { initAppHeader } from './components/common/appHeader.js';
import { initExternalLinkCatcher } from './components/common/externalLinkCatcher.js';
import { initializeCommitsModal } from './components/changelog/commitsModal.js';
import { initializeChangelogModal } from './components/changelog/changelogModal.js';
import { initSpotright } from './components/spotright/spotrightController.js';
import { initShortcutsModalListener } from './components/shortcuts/shortcutsModal.js';
import { getLanguageFromPath, syncLanguageUrl } from './core/languageRouter.js';
import { initializeState, state } from './core/state.js';
import { handleStateUpdate } from './core/stateManager.js';
import { getSavedProfiles } from './core/playerStorage.js';
import { loadState, saveState } from './core/localStorageManager.js';
import { cleanupOrphanedPlayerPartitions } from './core/stateCleanup.js';
import { consolidateLocalStorageKeys } from './core/storageMigrations.js';
import { registerGlobalErrorBoundaries } from './core/appEventInterceptors.js';
import { initAppSettings, getAppSettings, persistAppSettings } from './components/common/appSettings.js';
import { initializeModalHistoryManager } from './utils/modalHistoryManager.js';
import { initializeAuthModal } from './components/auth/authModalInputs.js';
import { initializePlayerModal } from './components/player/playerModal.js';
import { initializeSettingsAccount } from './components/appSettings/settingsAccountInputs.js';
import { fetchAccountDetails, getAuthenticatedUser, isAuthenticated, initCrossTabAuthSync } from './services/authClientService.js';
import { initializePwaService } from './services/pwaService.js';
import { initializeAppData } from './services/cloudSaveService.js';
import { renderAccountPageShell } from './components/account/accountPageDisplay.js';
import { initAccountPageInputs } from './components/account/accountPageInputs.js';
import { loadAndRenderSessions } from './components/account/accountPageSessions.js';
import { initAppShellNavigator, registerAppRoute } from './core/appShellNavigator.js';
import { setupNavigatorUiHooks } from './components/common/appShellNavigatorHooks.js';
import './utils/imageManager.js';
import './console.js';

let hasAttachedAccountListeners = false;

/**
 * Initializes and populates the navigation drawer for the account page.
 */
function renderDrawer() {
    const savedProfiles = getSavedProfiles();
    const activeProfile = savedProfiles[0];
    renderNavigationDrawerContent({
        drawerEl: document.getElementById('navigation-drawer'),
        activeTool: 'account',
        playerTag: activeProfile?.cleanTag || '',
        profileData: activeProfile ? {
            name: activeProfile.name,
            tag: activeProfile.tag,
            townHallLevel: activeProfile.townHallLevel,
            trophies: activeProfile.trophies,
            cachedData: activeProfile.cachedData
        } : null
    });
}

/**
 * Main application initialization sequence.
 */
async function initAccountApp() {
    window.isAppStartingUp = true;
    registerGlobalErrorBoundaries();
    consolidateLocalStorageKeys();

    const savedState = loadState();
    const savedProfiles = getSavedProfiles();
    const savedTags = Array.isArray(savedProfiles) && savedProfiles.length > 0
        ? savedProfiles.map(p => p.cleanTag)
        : (savedState?.savedPlayerTags || []);

    const pathLang = getLanguageFromPath();
    const appSettings = getAppSettings();
    const targetLang = pathLang || (appSettings.language && appSettings.language !== 'auto' ? appSettings.language : 'en');
    initializeState({
        ...savedState,
        savedPlayerTags: savedTags,
        uiSettings: {
            ...(savedState?.uiSettings || {}),
            language: targetLang,
            theme: appSettings.theme,
            accentColor: appSettings.accentColor
        }
    });

    if (pathLang) {
        persistAppSettings({ language: pathLang });
    } else if (targetLang !== 'en') {
        syncLanguageUrl(targetLang, true);
    }
    await loadTranslations(targetLang);
    updateUIWithTranslations(true);

    initDomainNotice();
    initAppFooter();
    initializePwaService();

    initAppHeader({
        headerElement: '.app-header',
        hasTabs: false,
        hasPlayerDropdown: false,
        hasPill: true,
        bindDrawer: true
    });

    initAppSettings();
    initializeModalHistoryManager();
    initializeCommitsModal();
    initializeChangelogModal();
    initSpotright();
    initShortcutsModalListener();
    initializeAuthModal();
    initializePlayerModal();
    initializeSettingsAccount({
        hasAccountSync: false,
        hasClickableAvatar: false
    });
    initExternalLinkCatcher();
    initAccountPageInputs();
    initCrossTabAuthSync();

    renderDrawer();

    const isAuth = isAuthenticated();
    const user = getAuthenticatedUser();
    renderAccountPageShell(isAuth, user);

    if (typeof window !== 'undefined' && window.location.hash) {
        const targetEl = document.getElementById(window.location.hash.substring(1));
        if (targetEl && typeof targetEl.scrollIntoView === 'function') {
            targetEl.scrollIntoView({ behavior: 'smooth' });
        }
    }

    if (isAuth) {
        fetchAccountDetails().then((details) => {
            if (details) {
                renderAccountPageShell(true, getAuthenticatedUser());
            }
        }).catch(() => {});
        loadAndRenderSessions();
        initializeAppData().then((cloudData) => {
            if (cloudData) {
                const activeLanguage = getLanguageFromPath() || state.uiSettings?.language || 'en';
                initializeState(cloudData);
                if (activeLanguage) {
                    state.uiSettings.language = activeLanguage;
                }
                cleanupOrphanedPlayerPartitions(state);
                saveState(state, true);
            }
            renderAccountPageShell(true, getAuthenticatedUser());
            renderDrawer();
        }).catch(() => {});
    }

    if (!hasAttachedAccountListeners) {
        hasAttachedAccountListeners = true;
        document.addEventListener('auth:state-change', () => {
            const authed = isAuthenticated();
            renderAccountPageShell(authed, getAuthenticatedUser());
            if (authed) {
                loadAndRenderSessions();
            }
            renderDrawer();
        });

        document.addEventListener('languageChanged', () => {
            const authed = isAuthenticated();
            renderAccountPageShell(authed, getAuthenticatedUser());
            if (authed) {
                loadAndRenderSessions();
            }
            renderDrawer();
        });

        document.addEventListener('app:playerDropdownSync', () => {
            const currentProfiles = getSavedProfiles();
            if (Array.isArray(currentProfiles) && currentProfiles.length > 0) {
                handleStateUpdate(() => {
                    state.savedPlayerTags = currentProfiles.map(p => p.cleanTag);
                }, true);
            }
            const authed = isAuthenticated();
            renderAccountPageShell(authed, getAuthenticatedUser());
            renderDrawer();
        });
    }

    if (typeof window.__APP_LOADED__ === 'function') {
        window.__APP_LOADED__();
    }
    window.isAppStartingUp = false;
}

let isMounted = false;

/**
 * Mounts the Account & Security application.
 * @returns {Promise<void>}
 */
export async function mount() {
    if (isMounted) return;
    isMounted = true;

    await initAccountApp();
    setupNavigatorUiHooks();
    initAppShellNavigator();
    registerAppRoute('account', { mount, destroy });
}

/**
 * Destroys and cleans up active Account page controllers.
 */
export function destroy() {
    if (!isMounted) return;
    isMounted = false;
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => void mount());
    } else {
        void mount();
    }
}
