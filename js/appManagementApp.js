/**
 * App Management Page Orchestrator.
 * Tier 4: Main Application Entrypoint for /app-management/
 */

import { renderNavigationDrawerContent } from './components/common/navigationDrawerDisplay.js';
import { getSavedProfiles } from './core/playerStorage.js';
import {
    bootstrapShellLanguageAndStorage,
    finalizeRouteMount,
    initSharedShellChrome,
    mountWhenReady
} from './core/shellBootstrapper.js';
import {
    getAppStorageUsage,
    getStartupRoutePreference,
    getEnvironmentDiagnostics
} from './services/appManagementService.js';
import {
    renderStartupOptions,
    renderStorageUsage,
    renderDiagnostics
} from './components/appManagement/appManagementDisplay.js';
import { initAppManagementInputs } from './components/appManagement/appManagementInputs.js';
import './utils/imageManager.js';
import './console.js';

let isMounted = false;

/**
 * Initializes and populates the navigation drawer.
 */
function renderDrawer() {
    if (!isMounted) return;
    const savedProfiles = getSavedProfiles();
    const activeProfile = savedProfiles[0];
    renderNavigationDrawerContent({
        drawerEl: document.getElementById('navigation-drawer'),
        activeTool: 'app-management',
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
async function initAppManagementApp() {
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
            hasAccountSync: true,
            hasClickableAvatar: true
        },
        includePlayerModal: true
    });

    renderDrawer();

    const startupSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById('app-startup-select'));
    if (startupSelect) {
        renderStartupOptions(startupSelect, getStartupRoutePreference());
    }

    const storageUsageText = document.getElementById('app-storage-usage-text');
    if (storageUsageText) {
        getAppStorageUsage().then(size => {
            if (!isMounted) return;
            renderStorageUsage(storageUsageText, size);
        }).catch(() => {});
    }

    const diagContainer = document.getElementById('app-diagnostics-container');
    if (diagContainer) {
        renderDiagnostics(diagContainer, getEnvironmentDiagnostics());
    }

    initAppManagementInputs();
}

/**
 * Mounts the App Management application.
 * @param {Object} [options={}]
 * @param {boolean} [options.force=false]
 * @returns {Promise<void>}
 */
export async function mount(options = {}) {
    if (isMounted && !options.force) return;
    isMounted = true;

    await initAppManagementApp();
    finalizeRouteMount('app-management', { mount, destroy });
}

/**
 * Destroys and cleans up active App Management page controllers.
 */
export function destroy() {
    if (!isMounted) return;
    isMounted = false;
}

mountWhenReady(mount);
