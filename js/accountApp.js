/**
 * Account & Security Page Orchestrator.
 * Tier 4: Main Application Entrypoint for /account/
 */

import { renderNavigationDrawerContent } from './components/common/navigationDrawerRenderer.js';
import { getLanguageFromPath } from './core/languageRouter.js';
import { initializeState, state } from './core/state.js';
import { handleStateUpdate } from './core/stateManager.js';
import { getSavedProfiles } from './core/playerStorage.js';
import { saveState } from './core/localStorageManager.js';
import { cleanupOrphanedPlayerPartitions } from './core/stateCleanup.js';
import {
    bootstrapShellLanguageAndStorage,
    finalizeRouteMount,
    initSharedShellChrome,
    mountWhenReady
} from './core/shellBootstrapper.js';
import { fetchAccountDetails, getAuthenticatedUser, isAuthenticated, initCrossTabAuthSync } from './services/authClientService.js';
import { initializeAppData } from './services/cloudSaveService.js';
import { renderAccountPageShell } from './components/account/accountPageDisplay.js';
import { initAccountPageInputs } from './components/account/accountPageInputs.js';
import { loadAndRenderSessions } from './components/account/accountPageSessions.js';
import './utils/imageManager.js';
import './console.js';

let hasAttachedAccountListeners = false;
let isMounted = false;

/**
 * Initializes and populates the navigation drawer for the account page.
 */
function renderDrawer() {
    if (!isMounted) return;
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
    await bootstrapShellLanguageAndStorage({ hydrateState: true });

    initSharedShellChrome({
        headerOptions: {
            headerElement: '.app-header',
            hasTabs: false,
            hasPlayerDropdown: false,
            hasPill: true,
            bindDrawer: true
        },
        accountOptions: {
            hasAccountSync: false,
            hasClickableAvatar: false
        },
        includePlayerModal: true
    });

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
            if (!isMounted) return;
            if (details) {
                renderAccountPageShell(true, getAuthenticatedUser());
            }
        }).catch(() => {});
        loadAndRenderSessions();
        initializeAppData().then((cloudData) => {
            if (!isMounted) return;
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
            if (!isMounted) return;
            const authed = isAuthenticated();
            renderAccountPageShell(authed, getAuthenticatedUser());
            if (authed) {
                loadAndRenderSessions();
            }
            renderDrawer();
        });

        document.addEventListener('languageChanged', () => {
            if (!isMounted) return;
            const authed = isAuthenticated();
            renderAccountPageShell(authed, getAuthenticatedUser());
            if (authed) {
                loadAndRenderSessions();
            }
            renderDrawer();
        });

        document.addEventListener('app:playerDropdownSync', () => {
            if (!isMounted) return;
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
}

/**
 * Mounts the Account & Security application.
 * @param {Object} [options={}]
 * @param {boolean} [options.force=false]
 * @returns {Promise<void>}
 */
export async function mount(options = {}) {
    if (isMounted && !options.force) return;
    isMounted = true;

    await initAccountApp();
    finalizeRouteMount('account', { mount, destroy });
}

/**
 * Destroys and cleans up active Account page controllers.
 */
export function destroy() {
    if (!isMounted) return;
    isMounted = false;
}

mountWhenReady(mount);
